"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/fetcher";
import type { NotificationsResponse } from "@/types/api";

/** Polls the notifications endpoint and exposes the unread count. */
export function useNotifications(pollMs = 30_000) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const data = await api<NotificationsResponse>("/api/notifications");
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore polling errors silently
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { unreadCount, refresh };
}
