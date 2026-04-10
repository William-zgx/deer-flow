import type { Message } from "@langchain/langgraph-sdk";

import type {
  AgentThread,
  AgentThreadContext,
  ThreadBranchMetadata,
} from "./types";

type ThreadRouteTarget =
  | string
  | {
      thread_id: string;
      context?: Pick<AgentThreadContext, "agent_name"> | null;
      metadata?: ThreadBranchMetadata | null;
    };

type ThreadRouteContext =
  | string
  | Pick<AgentThreadContext, "agent_name">
  | null
  | undefined;

function normalizeCustomAgentName(agentName: string | null | undefined) {
  if (typeof agentName !== "string") {
    return undefined;
  }

  const normalized = agentName.trim();
  if (!normalized || normalized === "default") {
    return undefined;
  }

  return normalized;
}

function resolveThreadAgentName(
  thread: ThreadRouteTarget,
  context?: ThreadRouteContext,
) {
  const contextAgentName =
    typeof context === "string" ? context : context?.agent_name;
  const normalizedContextAgentName = normalizeCustomAgentName(contextAgentName);
  if (normalizedContextAgentName) {
    return normalizedContextAgentName;
  }

  if (typeof thread === "string") {
    return undefined;
  }

  const normalizedThreadAgentName = normalizeCustomAgentName(
    thread.context?.agent_name,
  );
  if (normalizedThreadAgentName) {
    return normalizedThreadAgentName;
  }

  return normalizeCustomAgentName(thread.metadata?.agent_name);
}

export function pathOfThread(thread: ThreadRouteTarget, context?: ThreadRouteContext) {
  const threadId = typeof thread === "string" ? thread : thread.thread_id;
  const routeAgentName = resolveThreadAgentName(thread, context);
  if (routeAgentName) {
    return `/workspace/agents/${encodeURIComponent(routeAgentName)}/chats/${threadId}`;
  }
  return `/workspace/chats/${threadId}`;
}

export function textOfMessage(message: Message) {
  if (typeof message.content === "string") {
    return message.content;
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === "text") {
        return part.text;
      }
    }
  }
  return null;
}

export function titleOfThread(thread: AgentThread) {
  return thread.values?.title ?? "Untitled";
}

export function agentNameOfThreadMetadata(
  metadata: ThreadBranchMetadata | null | undefined,
) {
  return normalizeCustomAgentName(metadata?.agent_name);
}

export function isBranchThreadMetadata(metadata: ThreadBranchMetadata | null | undefined) {
  return metadata?.branch_role === "branch";
}
