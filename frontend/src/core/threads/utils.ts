import type { Message } from "@langchain/langgraph-sdk";

import type { AgentThread, ThreadBranchMetadata } from "./types";

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

export function pathOfThread(threadId: string, agentName?: string) {
  const routeAgentName = normalizeCustomAgentName(agentName);
  if (routeAgentName) {
    return `/workspace/agents/${routeAgentName}/chats/${threadId}`;
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

export function agentNameOfThreadMetadata(metadata: ThreadBranchMetadata | null | undefined) {
  return normalizeCustomAgentName(metadata?.agent_name);
}

export function isBranchThreadMetadata(metadata: ThreadBranchMetadata | null | undefined) {
  return metadata?.branch_role === "branch";
}
