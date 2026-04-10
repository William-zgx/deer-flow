# Context Branching Design

## Goal

Add a Git-like context branching workflow to DeerFlow so a user can:

- branch off from the current conversation state
- ask an unrelated side question inside the branch
- return to the main conversation without polluting the main thread's context window
- optionally bring back only a distilled conclusion later

This should reduce long-thread context growth while keeping side explorations available.

## Recommended Product Scope

### V1

Treat a branch as a new DeerFlow `thread_id` created from a selected checkpoint of another thread.

This is the safest approach because DeerFlow already has:

- thread CRUD and metadata in the Gateway
- thread-local checkpoint history in the checkpointer
- per-thread sandbox data directories for uploads, outputs, and workspace

### V1 Assumptions

- The common case is "fork, explore, come back", not true two-way merge.
- Returning to the main thread should not automatically copy child messages back.
- Uploaded files from the parent thread should remain usable in the child branch.
- Full `git merge` semantics are out of scope for V1; we should support a safer "summarize back" flow later.

## Existing Reuse Points

The current codebase already exposes most of the primitives needed:

- Thread records live in the Store and carry arbitrary metadata:
  `backend/app/gateway/routers/threads.py`
- A thread already has a latest state snapshot plus `checkpoint_id` and `parent_checkpoint_id`:
  `backend/app/gateway/routers/threads.py`
- The Gateway already exposes checkpoint history by thread:
  `backend/app/gateway/routers/threads.py`
- The frontend chat runtime is keyed entirely by `threadId`, so switching branches is naturally just switching threads:
  `frontend/src/core/threads/hooks.ts`
  `frontend/src/components/workspace/chats/use-thread-chat.ts`
- Uploaded files and sandbox data are currently isolated per thread:
  `backend/packages/harness/deerflow/agents/middlewares/uploads_middleware.py`
  `backend/packages/harness/deerflow/config/paths.py`

Because of that, context branching can be implemented without changing the core agent loop.

## Core Design

### 1. Mental model

- `main thread`: the original conversation line
- `branch thread`: a new thread forked from a specific checkpoint in another thread
- `fork point`: the parent thread checkpoint that becomes the branch base
- `return`: just navigate back to the parent thread; no merge required

### 2. Storage model

Keep each branch as a normal thread with extra metadata.

Suggested thread metadata fields:

```json
{
  "root_thread_id": "uuid-of-root-thread",
  "parent_thread_id": "uuid-of-immediate-parent-thread",
  "fork_checkpoint_id": "checkpoint-id-used-as-branch-base",
  "forked_from_title": "Original thread title at fork time",
  "branch_name": "Side question about pricing",
  "branch_role": "main|branch",
  "branch_depth": 1,
  "return_thread_id": "uuid-of-thread-to-go-back-to",
  "branch_status": "active|archived"
}
```

Notes:

- The root thread uses `branch_role=main`.
- Child branches use `branch_role=branch`.
- `root_thread_id` lets us render a tree and group sibling branches.
- `return_thread_id` gives the UI a deterministic "Back to main line" target.

### 3. Branch creation algorithm

Add a dedicated Gateway endpoint:

`POST /api/threads/{thread_id}/branches`

Suggested request:

```json
{
  "checkpoint_id": "optional-specific-checkpoint",
  "branch_name": "Why is this failing only in prod?",
  "copy_uploads": true,
  "copy_outputs": false,
  "copy_workspace": false,
  "initial_message": "帮我只分析这个线上报错成因，不要影响主流程"
}
```

Suggested response:

```json
{
  "thread_id": "new-branch-thread-id",
  "parent_thread_id": "source-thread-id",
  "root_thread_id": "root-thread-id",
  "fork_checkpoint_id": "resolved-checkpoint-id",
  "created_at": "timestamp"
}
```

Server-side steps:

1. Resolve the source checkpoint from `{thread_id, checkpoint_id?}`.
2. Read the source checkpoint tuple via the existing checkpointer.
3. Create a brand-new child `thread_id`.
4. Copy the source `checkpoint.channel_values` into a fresh checkpoint under the child thread.
5. Write branch metadata into both:
   - Store thread record
   - child checkpoint metadata
6. Copy parent uploads into the child thread's uploads directory.
7. Optionally send `initial_message` as the first user message on the new branch.

This gives the child branch a complete, isolated runnable snapshot while preserving the parent thread unchanged.

## Why This Saves Context

Without branching:

- the unrelated side discussion becomes part of the main thread history
- every later message on the main flow pays for those extra turns

With branching:

- the child thread pays the fork cost once
- the main thread continues from its original checkpoint chain
- later mainline requests do not include the branch conversation

That is the main context-saving win.

## File and Sandbox Handling

This is the main non-obvious implementation detail.

Today uploaded files are thread-local and exposed to the model as `/mnt/user-data/uploads/...`.
If we fork only the checkpoint but do not handle files, the child branch may lose access to files referenced by the parent thread.

### Recommended V1 policy

- Copy `uploads/` on branch creation
- Do not copy `outputs/` or `workspace/` by default

Why:

- `uploads/` are the most important dependency for question answering
- `outputs/` and `workspace/` can be large and are less often needed for side questions
- copying uploads keeps the current `/mnt/user-data/uploads/...` contract intact with minimal runtime changes

### Optional V2 optimization

Replace eager copy with read-only inheritance or copy-on-write overlay, but only after V1 proves the UX.

## API Surface

### New endpoints

`POST /api/threads/{thread_id}/branches`

- fork a branch from latest or specified checkpoint

`GET /api/threads/{thread_id}/branches`

- list direct children of a thread

`GET /api/threads/{thread_id}/branch-tree`

- return the root thread plus descendants for tree rendering

### Keep existing endpoints

- `GET /api/threads/{thread_id}/state`
- `POST /api/threads/{thread_id}/history`
- `POST /api/threads/search`

These remain useful for:

- picking the current fork point
- future "fork from older checkpoint" UI
- flat search and fallback navigation

## Frontend Design

### V1 UX

In the chat header for an existing thread, add:

- `New branch` action
- if current thread is a branch, `Back to parent` action
- a lightweight breadcrumb:
  `Main thread / Side question`

Recommended placement:

- next to `ExportTrigger` and `ArtifactTrigger` in:
  `frontend/src/app/workspace/chats/[thread_id]/page.tsx`

### V1 interaction flow

1. User clicks `New branch`
2. Frontend calls `POST /api/threads/{thread_id}/branches`
3. Frontend navigates to `/workspace/chats/{new_branch_thread_id}`
4. Branch page loads through the existing `useThreadStream` flow
5. User explores freely
6. User clicks `Back to parent`
7. Frontend navigates back to `return_thread_id`

No new streaming protocol is required because branch switching is already compatible with the current `threadId`-driven frontend architecture.

### Sidebar

Do not build a full Git-style tree in V1.

Recommended V1 sidebar behavior:

- keep the current flat recent list
- visually mark branch items with:
  - branch icon
  - branch name
  - optional parent title hint

Recommended V2:

- collapsible thread tree grouped by `root_thread_id`

## Merge Strategy

Do not implement raw checkpoint merging in V1.

Raw merge is risky because it would need to reconcile:

- message history
- tool outputs
- pending task state
- artifacts and file paths
- uploaded files and branch-local workspace state

### Safer V2 alternative

Add `Bring back summary` instead of `merge`.

Possible flow:

1. User selects a branch checkpoint range or uses branch head.
2. System summarizes the branch into a compact note.
3. That note is appended to the parent thread as a user-approved message or system-side memory note.

This gives most of the product value with much lower correctness risk.

## Rollout Plan

### Phase 1

- backend branch creation endpoint
- branch metadata model
- upload copying
- frontend `New branch` and `Back to parent`
- branch badge in thread title or header

### Phase 2

- direct child branch listing
- simple branch tree view
- fork from an older checkpoint in history

### Phase 3

- summarize branch back into parent
- optional branch archiving
- optional copy-on-write inherited uploads/workspace

## Testing

### Backend

- create branch from latest checkpoint
- create branch from explicit checkpoint
- verify child thread state equals source checkpoint state at fork time
- verify parent thread remains unchanged after child branch runs
- verify uploads are available in the child branch
- verify branch metadata appears in Store search results

### Frontend

- create branch from active chat
- navigate to branch thread after creation
- return to parent thread
- ensure parent thread messages are unchanged after branch interaction

## Risks

### 1. Snapshot size

Branch creation duplicates the current checkpoint state, including message history.
This is acceptable for V1 because it is simple and gives the desired context isolation, but we should watch storage growth.

### 2. Branching during an active stream

If the parent thread is still streaming, the latest stable checkpoint may lag behind the visible UI.

Recommended guard:

- disable `New branch` while the current thread is streaming
- or explicitly fork from the latest persisted checkpoint only

### 3. Deletion semantics

Deleting a parent thread while child branches still exist can orphan the tree.

Recommended V1 rule:

- do not cascade delete automatically
- warn before deleting a thread that still has children

## Recommendation

Ship V1 as:

- branch = new thread cloned from parent checkpoint
- uploads copied on fork
- no automatic merge
- explicit return-to-parent navigation

This fits DeerFlow's current architecture, minimizes risk, and directly achieves the user's main goal: isolate unrelated side conversations so they do not bloat the main thread context.

## One Product Decision To Confirm

Should V1 only support:

- "fork, explore, return"

Or should it also support:

- "selectively bring branch conclusions back to the parent"

My recommendation is:

- V1: fork and return only
- V2: add "bring back summary"
