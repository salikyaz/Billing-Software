"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Plus,
  Send,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import type { InvoiceStatus } from "@prisma/client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TableSkeleton } from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/fetcher";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Client, InvoiceWithClient } from "@/types/api";

const STATUSES: InvoiceStatus[] = [
  "DRAFT",
  "SENT",
  "PAID",
  "OVERDUE",
  "CANCELLED",
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState<string>("all");
  const [clientId, setClientId] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [cancelTarget, setCancelTarget] = useState<InvoiceWithClient | null>(
    null
  );
  const [working, setWorking] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (clientId !== "all") params.set("clientId", clientId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    api<InvoiceWithClient[]>(`/api/invoices${qs ? `?${qs}` : ""}`)
      .then(setInvoices)
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [status, clientId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<Client[]>("/api/clients")
      .then(setClients)
      .catch(() => undefined);
  }, []);

  async function action(
    inv: InvoiceWithClient,
    path: string,
    successMsg: string
  ) {
    try {
      await api(`/api/invoices/${inv.id}/${path}`, { method: "POST" });
      toast.success(successMsg);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setWorking(true);
    try {
      await api(`/api/invoices/${cancelTarget.id}`, { method: "DELETE" });
      toast.success("Invoice cancelled");
      setCancelTarget(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Create, send and track invoices.">
        <Button asChild>
          <Link href="/invoices/new">
            <Plus className="h-4 w-4" />
            New Invoice
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 sm:p-2">
          {loading ? (
            <div className="p-6">
              <TableSkeleton cols={6} />
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              className="m-4"
              icon={FileText}
              title="No invoices found"
              description="Adjust filters or create a new invoice."
              action={
                <Button asChild>
                  <Link href="/invoices/new">
                    <Plus className="h-4 w-4" />
                    New Invoice
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{inv.client?.name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(inv.dueDate)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(inv.total, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/invoices/${inv.id}`}>
                              <Eye className="h-4 w-4" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          {(inv.status === "DRAFT" ||
                            inv.status === "SENT" ||
                            inv.status === "OVERDUE") && (
                            <DropdownMenuItem
                              onClick={() =>
                                action(
                                  inv,
                                  "send",
                                  inv.status === "DRAFT"
                                    ? "Invoice sent"
                                    : "Invoice resent"
                                )
                              }
                            >
                              <Send className="h-4 w-4" />
                              {inv.status === "DRAFT" ? "Send Now" : "Resend"}
                            </DropdownMenuItem>
                          )}
                          {(inv.status === "SENT" ||
                            inv.status === "OVERDUE") && (
                            <DropdownMenuItem
                              onClick={() =>
                                action(inv, "reminder", "Reminder sent")
                              }
                            >
                              <Bell className="h-4 w-4" />
                              Send Reminder
                            </DropdownMenuItem>
                          )}
                          {inv.status !== "PAID" &&
                            inv.status !== "CANCELLED" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  action(inv, "mark-paid", "Marked as paid")
                                }
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Mark Paid
                              </DropdownMenuItem>
                            )}
                          <DropdownMenuItem asChild>
                            <a
                              href={`/api/invoices/${inv.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Download className="h-4 w-4" />
                              Download PDF
                            </a>
                          </DropdownMenuItem>
                          {inv.status !== "CANCELLED" &&
                            inv.status !== "PAID" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setCancelTarget(inv)}
                                >
                                  <Ban className="h-4 w-4" />
                                  {inv.status === "DRAFT"
                                    ? "Delete"
                                    : "Cancel"}
                                </DropdownMenuItem>
                              </>
                            )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title={
          cancelTarget?.status === "DRAFT"
            ? "Delete invoice?"
            : "Cancel invoice?"
        }
        description={`Invoice ${cancelTarget?.invoiceNumber} will be ${
          cancelTarget?.status === "DRAFT" ? "permanently deleted" : "cancelled"
        }.`}
        confirmLabel={cancelTarget?.status === "DRAFT" ? "Delete" : "Cancel invoice"}
        destructive
        loading={working}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
