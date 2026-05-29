"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/fetcher";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import type { ClientDetail, Service } from "@/types/api";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [newServiceId, setNewServiceId] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [newPrice, setNewPrice] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<ClientDetail>(`/api/clients/${id}`)
      .then(setClient)
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
    api<Service[]>("/api/services")
      .then((s) => setServices(s.filter((x) => x.isActive)))
      .catch(() => undefined);
  }, [load]);

  async function addService() {
    if (!newServiceId) {
      toast.error("Select a service");
      return;
    }
    setAdding(true);
    try {
      await api(`/api/clients/${id}/services`, {
        method: "POST",
        body: JSON.stringify({
          serviceId: newServiceId,
          quantity: Number(newQty) || 1,
          customPrice: newPrice ? Number(newPrice) : null,
        }),
      });
      toast.success("Service assigned");
      setNewServiceId("");
      setNewQty("1");
      setNewPrice("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function removeService(serviceId: string) {
    try {
      await api(`/api/clients/${id}/services`, {
        method: "DELETE",
        body: JSON.stringify({ serviceId }),
      });
      toast.success("Service removed");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <EmptyState title="Client not found" description="It may have been removed." />
    );
  }

  const paidInvoices = client.invoices.filter((i) => i.status === "PAID");

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4" />
            Back to clients
          </Link>
        </Button>
        <PageHeader
          title={client.name}
          description={client.company ?? undefined}
        >
          <Badge
            className={
              client.isActive
                ? "bg-success/15 text-success hover:bg-success/15"
                : ""
            }
            variant={client.isActive ? "default" : "secondary"}
          >
            {client.isActive ? "Active" : "Inactive"}
          </Badge>
        </PageHeader>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <Info icon={Mail} label="Email" value={client.email} />
          <Info icon={Phone} label="Phone" value={client.phone ?? "—"} />
          <Info icon={Building2} label="Company" value={client.company ?? "—"} />
          <Info icon={MapPin} label="Address" value={client.address ?? "—"} />
        </CardContent>
      </Card>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="services">Recurring Services</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="p-0 sm:p-2">
              {client.invoices.length === 0 ? (
                <EmptyState
                  className="m-4"
                  title="No invoices"
                  description="This client has no invoices yet."
                />
              ) : (
                <InvoiceTable invoices={client.invoices} currency={client.currency} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assign a service</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-[1fr_120px_140px_auto] sm:items-end">
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={newServiceId} onValueChange={setNewServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({formatCurrency(s.defaultPrice)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Qty</Label>
                <Input
                  type="number"
                  min={1}
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Custom price</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Default"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                />
              </div>
              <Button onClick={addService} disabled={adding}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 sm:p-2">
              {client.clientServices.length === 0 ? (
                <EmptyState
                  className="m-4"
                  title="No recurring services"
                  description="Assign services billed automatically each cycle."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.clientServices.map((cs) => (
                      <TableRow key={cs.id}>
                        <TableCell className="font-medium">
                          {cs.service.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {cs.service.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {cs.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            cs.customPrice ?? cs.service.defaultPrice,
                            client.currency
                          )}
                          {cs.customPrice ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              (custom)
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeService(cs.serviceId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="p-0 sm:p-2">
              {paidInvoices.length === 0 ? (
                <EmptyState
                  className="m-4"
                  title="No payments yet"
                  description="Paid invoices will appear here."
                />
              ) : (
                <InvoiceTable
                  invoices={paidInvoices}
                  currency={client.currency}
                  dateField="paidAt"
                  dateLabel="Paid"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function InvoiceTable({
  invoices,
  currency,
  dateField = "dueDate",
  dateLabel = "Due",
}: {
  invoices: ClientDetail["invoices"];
  currency: string;
  dateField?: "dueDate" | "paidAt";
  dateLabel?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>{dateLabel}</TableHead>
          <TableHead className="text-right">Total</TableHead>
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
            <TableCell>
              <StatusBadge status={inv.status} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(inv[dateField])}
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatCurrency(toNumber(inv.total), inv.currency || currency)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
