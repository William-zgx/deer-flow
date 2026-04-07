"use client";

import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

  // 监听真正的路由变化，如果用户点击了侧边栏其他的对话或者“新建对话”按钮
  useEffect(() => {
    // 检查当前的 threadId 状态和路径中的 thread_id 是否一致
    // 注意：当我们使用 history.replaceState 时，threadIdFromPath 不会改变，
    // 但是在这个 hook 外部，业务代码已经手动调用了 setThreadId(new_uuid)，
    // 所以这里只有当“真正”发生了页面导航跳转时（也就是路径参数与我们当前状态不匹配时），才需要重置
    const isNewPath = pathname.endsWith("/new") || !isValidUUID(threadIdFromPath);

    if (isNewPath) {
      // 只有当我们处于 /new 路由，并且当前的 threadId 不是有效UUID，或者我们刚刚从其他路由跳回 /new 时，
      // 我们才重新生成并设置为新会话
      setIsNewThread(true);
      // 如果当前 threadId 已经是我们在新建页面生成的临时 UUID，不要覆盖它
      // 否则生成一个新的 UUID
      setThreadId((prev) => (isValidUUID(prev) ? prev : uuid()));
    } else {
      // 如果路径是一个有效的 UUID
      // 如果当前状态的 threadId 和路径不一致，说明发生了真正的页面跳转，需要同步状态
      if (threadIdFromPath !== threadId) {
        setIsNewThread(false);
        setThreadId(threadIdFromPath);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, threadIdFromPath]); // 不将 threadId 放入依赖，避免循环触发

  const isMock = searchParams.get("mock") === "true";
  return { threadId, setThreadId, isNewThread, setIsNewThread, isMock };
}
