"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCheck,
  DollarSign,
  Send,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { NotificationType } from "@prisma/client";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/fetcher";
import { NOTIFICATION_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationsResponse } from "@/types/api";

const ICONS: Record<NotificationType, LucideIcon> = {
  INVOICE_SENT: Send,
  PAYMENT_RECEIVED: DollarSign,
  PAYMENT_OVERDUE: AlertTriangle,
  REMINDER_SENT: BellRing,
};

const ICON_ACCENT: Record<NotificationType, string> = {
  INVOICE_SENT: "text-primary bg-primary/15",
  PAYMENT_RECEIVED: "text-success bg-success/15",
  PAYMENT_OVERDUE: "text-destructive bg-destructive/15",
  REMINDER_SENT: "text-warning bg-warning/15",
};

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api<NotificationsResponse>("/api/notifications")
      .then((d) => {
        setItems(d.items);
        setUnread(d.unreadCount);
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markAll() {
    try {
      await api("/api/notifications/mark-read", {
        method: "PUT",
        body: JSON.stringify({}),
      });
      toast.success("All notifications marked as read");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "You're all caught up."}
      >
        <Button variant="outline" onClick={markAll} disabled={unread === 0}>
          <CheckCheck className="h-4 w-4" />
          Mark all as read
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-2 sm:p-3">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications"
              description="Activity on your invoices will show up here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                const body = (
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-accent/50",
                      !n.isRead && "bg-primary/5"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        ICON_ACCENT[n.type] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        {NOTIFICATION_LABELS[n.type] ?? n.type}
                      </p>
                      <p className="text-sm">{n.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    {!n.isRead ? (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    ) : null}
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.invoiceId ? (
                      <Link href={`/invoices/${n.invoiceId}`}>{body}</Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
