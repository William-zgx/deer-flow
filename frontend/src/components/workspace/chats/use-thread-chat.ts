"use client";

import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { uuid } from "@/core/utils/uuid";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_RE.test(id);
}

export function useThreadChat() {
  const { thread_id: threadIdFromPath } = useParams<{ thread_id: string }>();
  const pathname = usePathname();

  const searchParams = useSearchParams();
  const [threadId, setThreadId] = useState(() => {
    return threadIdFromPath === "new" || !isValidUUID(threadIdFromPath)
      ? uuid()
      : threadIdFromPath;
  });

  const [isNewThread, setIsNewThread] = useState(
    () => threadIdFromPath === "new" || !isValidUUID(threadIdFromPath),
  );

  useEffect(() => {
    if (pathname.endsWith("/new") || !isValidUUID(threadIdFromPath)) {
      setIsNewThread(true);
      setThreadId(uuid());
      return;
    }
    setIsNewThread(false);
    setThreadId(threadIdFromPath);
  }, [pathname, threadIdFromPath]);
  const isMock = searchParams.get("mock") === "true";
  return { threadId, setThreadId, isNewThread, setIsNewThread, isMock };
}
