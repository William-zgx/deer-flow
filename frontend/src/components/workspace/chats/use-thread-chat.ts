"use client";

import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { uuid } from "@/core/utils/uuid";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  if (!id) return false;
  return UUID_RE.test(id);
}

export function useThreadChat() {
  const { thread_id: threadIdFromPath } = useParams<{ thread_id: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 只在组件挂载时计算一次初始值
  const [threadId, setThreadId] = useState(() => {
    const isNew = pathname.endsWith("/new") || !isValidUUID(threadIdFromPath);
    return isNew ? uuid() : threadIdFromPath;
  });

  const [isNewThread, setIsNewThread] = useState(() => {
    return pathname.endsWith("/new") || !isValidUUID(threadIdFromPath);
  });

  useEffect(() => {
    const isNewPath = pathname.endsWith("/new") || !isValidUUID(threadIdFromPath);

    if (isNewPath) {
      // 关键修复：
      // 如果当前组件的状态认为已经是老对话（isNewThread === false），
      // 且 threadId 是一个有效的 UUID（说明是在发送第一条消息后 history.replaceState 造成的滞后 pathname），
      // 那么我们 **不要** 把状态重置为新建对话！
      setIsNewThread((prevIsNewThread) => {
        // 如果已经是老对话了，坚决保持 false
        if (!prevIsNewThread) return false;
        return true;
      });

      setThreadId((prev) => {
        // 只有当没有有效 UUID 时才生成新的
        if (isValidUUID(prev)) return prev;
        return uuid();
      });
    } else {
      // 如果路径是有效的真实 UUID（用户从列表点击进来，触发了真实的路由导航）
      // 确保状态同步到这个真实的 UUID
      setIsNewThread(false);
      setThreadId(threadIdFromPath);
    }
  }, [pathname, threadIdFromPath]);

  const isMock = searchParams.get("mock") === "true";
  return { threadId, setThreadId, isNewThread, setIsNewThread, isMock };
}
