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
  
  // Flag to know if the path actually means we are creating a new chat
  const isNewPath = pathname.endsWith("/new") || !isValidUUID(threadIdFromPath);

  const [threadId, setThreadId] = useState(() => {
    return isNewPath ? uuid() : threadIdFromPath;
  });

  const [isNewThread, setIsNewThread] = useState(() => isNewPath);

  // Keep track of the last path we processed to avoid regenerating UUID on replaceState
  const lastProcessedPath = useRef(pathname);

  useEffect(() => {
    // If the path hasn't really changed (e.g. just a query param or replaceState didn't trigger full Next.js cycle), do nothing
    if (lastProcessedPath.current === pathname) return;
    lastProcessedPath.current = pathname;

    const _isNewPath = pathname.endsWith("/new") || !isValidUUID(threadIdFromPath);
    
    if (_isNewPath) {
      setIsNewThread(true);
      setThreadId(uuid());
    } else {
      setIsNewThread(false);
      setThreadId(threadIdFromPath);
    }
  }, [pathname, threadIdFromPath]);

  const isMock = searchParams.get("mock") === "true";
  return { threadId, setThreadId, isNewThread, setIsNewThread, isMock };
}
