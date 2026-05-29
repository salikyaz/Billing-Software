"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Bell,
  CheckCircle2,
  CreditCard,
  Download,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/fetcher";
import { APP_NAME } from "@/lib/constants";
import { cn, formatCurrency, formatDate, formatDateTime, toNumber } from "@/lib/utils";
import type { InvoiceDetail } from "@/types/api";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<InvoiceDetail>(`/api/invoices/${id}`)
      .then(setInvoice)
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function action(path: string, successMsg: string) {
    setBusy(true);
    try {
      await api(`/api/invoices/${id}/${path}`, { method: "POST" });
      toast.success(successMsg);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvoice() {
    setBusy(true);
    try {
      await api(`/api/invoices/${id}`, { method: "DELETE" });
      toast.success(
        invoice?.status === "DRAFT" ? "Invoice deleted" : "Invoice cancelled"
      );
      setCancelOpen(false);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <EmptyState
        title="Invoice not found"
        description="It may have been removed."
      />
    );
  }

  const currency = invoice.currency;
  const canSend =
    invoice.status === "DRAFT" ||
    invoice.status === "SENT" ||
    invoice.status === "OVERDUE";
  const canRemind = invoice.status === "SENT" || invoice.status === "OVERDUE";
  const canMarkPaid =
    invoice.status !== "PAID" && invoice.status !== "CANCELLED";
  const canCancel =
    invoice.status !== "PAID" && invoice.status !== "CANCELLED";

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
            Back to invoices
          </Link>
        </Button>
        <PageHeader title={invoice.invoiceNumber}>
          <StatusBadge status={invoice.status} />
        </PageHeader>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canSend && (
          <Button
            onClick={() =>
              action(
                "send",
                invoice.status === "DRAFT" ? "Invoice sent" : "Invoice resent"
              )
            }
            disabled={busy}
          >
            <Send className="h-4 w-4" />
            {invoice.status === "DRAFT" ? "Send" : "Resend"}
          </Button>
        )}
        {canMarkPaid && (
          <Button
            variant="success"
            onClick={() => action("mark-paid", "Marked as paid")}
            disabled={busy}
          >
            <CheckCircle2 className="h-4 w-4" />
            Mark Paid
          </Button>
        )}
        {canRemind && (
          <Button
            variant="outline"
            onClick={() => action("reminder", "Reminder sent")}
            disabled={busy}
          >
            <Bell className="h-4 w-4" />
            Send Reminder
          </Button>
        )}
        <Button variant="outline" asChild>
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
        </Button>
        {canCancel && (
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setCancelOpen(true)}
            disabled={busy}
          >
            <Ban className="h-4 w-4" />
            {invoice.status === "DRAFT" ? "Delete" : "Cancel"}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Document */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{APP_NAME}</h2>
                <p className="text-sm text-muted-foreground">Invoice</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-lg font-bold">{invoice.invoiceNumber}</p>
                <p className="text-muted-foreground">
                  Issued {formatDate(invoice.createdAt)}
                </p>
                <p className="text-muted-foreground">
                  Due {formatDate(invoice.dueDate)}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="mb-1 text-xs uppercase text-muted-foreground">
                Bill To
              </p>
              <p className="font-medium">{invoice.client.name}</p>
              {invoice.client.company ? (
                <p className="text-sm text-muted-foreground">
                  {invoice.client.company}
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {invoice.client.email}
              </p>
              {invoice.client.address ? (
                <p className="text-sm text-muted-foreground">
                  {invoice.client.address}
                </p>
              ) : null}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">
                      {it.description}
                    </TableCell>
                    <TableCell className="text-right">{it.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(it.unitPrice, currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(it.total, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-6 ml-auto w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Tax ({toNumber(invoice.taxRate)}%)
                </span>
                <span>{formatCurrency(invoice.tax, currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{formatCurrency(invoice.total, currency)}</span>
              </div>
            </div>

            {invoice.notes ? (
              <div className="mt-8 border-t pt-4">
                <p className="mb-1 text-xs uppercase text-muted-foreground">
                  Notes
                </p>
                <p className="text-sm">{invoice.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Side panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline invoice={invoice} />
            </CardContent>
          </Card>

          {invoice.stripePaymentLinkUrl ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <a
                    href={invoice.stripePaymentLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <CreditCard className="h-4 w-4" />
                    Open Payment Link
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-2">
          {invoice.emailLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No emails sent yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.emailLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.recipientEmail}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {log.subject}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.status === "SUCCESS" ? "default" : "destructive"
                        }
                        className={
                          log.status === "SUCCESS"
                            ? "bg-success/15 text-success hover:bg-success/15"
                            : ""
                        }
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(log.sentAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={invoice.status === "DRAFT" ? "Delete invoice?" : "Cancel invoice?"}
        description={`Invoice ${invoice.invoiceNumber} will be ${
          invoice.status === "DRAFT" ? "permanently deleted" : "cancelled"
        }.`}
        confirmLabel={invoice.status === "DRAFT" ? "Delete" : "Cancel invoice"}
        destructive
        loading={busy}
        onConfirm={cancelInvoice}
      />
    </div>
  );
}

function Timeline({ invoice }: { invoice: InvoiceDetail }) {
  const steps: { label: string; date: string | null; done: boolean }[] = [
    { label: "Created", date: invoice.createdAt, done: true },
    {
      label: "Sent",
      date: invoice.sentAt,
      done: Boolean(invoice.sentAt),
    },
  ];
  if (invoice.reminderSentAt) {
    steps.push({
      label: "Reminder sent",
      date: invoice.reminderSentAt,
      done: true,
    });
  }
  if (invoice.status === "OVERDUE") {
    steps.push({ label: "Overdue", date: invoice.dueDate, done: true });
  }
  steps.push({
    label: "Paid",
    date: invoice.paidAt,
    done: invoice.status === "PAID",
  });

  return (
    <ol className="relative space-y-5 border-l border-border pl-5">
      {steps.map((step, i) => (
        <li key={i} className="relative">
          <span
            className={cn(
              "absolute -left-[1.45rem] top-0.5 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-card",
              step.done
                ? step.label === "Overdue"
                  ? "bg-destructive"
                  : "bg-primary"
                : "bg-muted"
            )}
          />
          <p
            className={cn(
              "text-sm font-medium",
              !step.done && "text-muted-foreground"
            )}
          >
            {step.label}
          </p>
          {step.date && step.done ? (
            <p className="text-xs text-muted-foreground">
              {formatDateTime(step.date)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Pending</p>
          )}
        </li>
      ))}
    </ol>
  );
}
