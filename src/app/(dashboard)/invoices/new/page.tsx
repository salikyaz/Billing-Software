"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFieldArray, useForm } from "react-hook-form";
import { ArrowLeft, Eye, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/fetcher";
import { addDays, formatCurrency, round2, toNumber } from "@/lib/utils";
import type { Client, Invoice, Service, Settings } from "@/types/api";

interface LineItem {
  serviceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface FormValues {
  clientId: string;
  items: LineItem[];
  taxRate: number;
  dueDate: string;
  notes: string;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { register, control, handleSubmit, watch, setValue, getValues } =
    useForm<FormValues>({
      defaultValues: {
        clientId: "",
        items: [{ serviceId: "", description: "", quantity: 1, unitPrice: 0 }],
        taxRate: 0,
        dueDate: isoDate(addDays(new Date(), 7)),
        notes: "",
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  useEffect(() => {
    api<Client[]>("/api/clients")
      .then((c) => setClients(c.filter((x) => x.isActive)))
      .catch(() => undefined);
    api<Service[]>("/api/services")
      .then((s) => setServices(s.filter((x) => x.isActive)))
      .catch(() => undefined);
    api<Settings>("/api/settings")
      .then((s) => setValue("taxRate", toNumber(s.taxRate)))
      .catch(() => undefined);
  }, [setValue]);

  const items = watch("items");
  const taxRate = watch("taxRate");
  const clientId = watch("clientId");
  const notes = watch("notes");
  const dueDate = watch("dueDate");

  const selectedClient = clients.find((c) => c.id === clientId);
  const currency = selectedClient?.currency ?? "USD";

  const { subtotal, tax, total } = useMemo(() => {
    const sub = (items ?? []).reduce(
      (acc, it) =>
        acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
      0
    );
    const t = round2((sub * (Number(taxRate) || 0)) / 100);
    return { subtotal: round2(sub), tax: t, total: round2(sub + t) };
  }, [items, taxRate]);

  function onServiceChange(index: number, serviceId: string) {
    setValue(`items.${index}.serviceId`, serviceId);
    const svc = services.find((s) => s.id === serviceId);
    if (svc) {
      const current = getValues(`items.${index}.description`);
      if (!current) setValue(`items.${index}.description`, svc.name);
      setValue(`items.${index}.unitPrice`, toNumber(svc.defaultPrice));
    }
  }

  function buildPayload(values: FormValues) {
    return {
      clientId: values.clientId,
      items: values.items.map((it) => ({
        serviceId: it.serviceId || undefined,
        description: it.description,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
      })),
      taxRate: Number(values.taxRate) || 0,
      dueDate: values.dueDate || undefined,
      notes: values.notes || undefined,
    };
  }

  function validate(values: FormValues): string | null {
    if (!values.clientId) return "Please select a client";
    if (!values.items.length) return "Add at least one line item";
    for (const it of values.items) {
      if (!it.description.trim()) return "Every line item needs a description";
    }
    return null;
  }

  async function save(send: boolean) {
    const values = getValues();
    const err = validate(values);
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const invoice = await api<Invoice>("/api/invoices", {
        method: "POST",
        body: JSON.stringify(buildPayload(values)),
      });
      if (send) {
        await api(`/api/invoices/${invoice.id}/send`, { method: "POST" });
        toast.success("Invoice created and sent");
      } else {
        toast.success("Draft saved");
      }
      router.push(`/invoices/${invoice.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
            Back to invoices
          </Link>
        </Button>
        <PageHeader title="New Invoice" description="Build and send an invoice." />
      </div>

      <form onSubmit={handleSubmit(() => save(false))} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={clientId}
                onValueChange={(v) => setValue("clientId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? ` — ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" type="date" {...register("dueDate")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Line Items</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  serviceId: "",
                  description: "",
                  quantity: 1,
                  unitPrice: 0,
                })
              }
            >
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[200px_1fr_90px_130px_auto] lg:items-end"
              >
                <div className="space-y-1.5">
                  <Label className="text-xs">Service</Label>
                  <Select
                    value={items[index]?.serviceId ?? ""}
                    onValueChange={(v) => onServiceChange(index, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Custom" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Input
                    {...register(`items.${index}.description` as const)}
                    placeholder="Description"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    {...register(`items.${index}.quantity` as const, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Unit Price</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    {...register(`items.${index}.unitPrice` as const, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 lg:flex-col lg:items-end">
                  <span className="text-sm font-medium">
                    {formatCurrency(
                      (Number(items[index]?.quantity) || 0) *
                        (Number(items[index]?.unitPrice) || 0),
                      currency
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...register("notes")}
                placeholder="Optional notes shown on the invoice…"
                rows={5}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(subtotal, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <Label htmlFor="taxRate" className="text-muted-foreground">
                  Tax rate (%)
                </Label>
                <Input
                  id="taxRate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="h-8 w-24 text-right"
                  {...register("taxRate", { valueAsNumber: true })}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">
                  {formatCurrency(tax, currency)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button type="submit" variant="secondary" disabled={submitting}>
            {submitting ? "Saving…" : "Save Draft"}
          </Button>
          <Button
            type="button"
            onClick={() => save(true)}
            disabled={submitting}
          >
            {submitting ? "Working…" : "Save & Send"}
          </Button>
        </div>
      </form>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">INVOICE</h3>
                <p className="text-sm text-muted-foreground">Draft</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-medium">
                  {selectedClient?.name ?? "No client selected"}
                </p>
                {selectedClient?.company ? (
                  <p className="text-muted-foreground">
                    {selectedClient.company}
                  </p>
                ) : null}
                {selectedClient?.email ? (
                  <p className="text-muted-foreground">
                    {selectedClient.email}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Due {dueDate || "—"}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{it.description || "—"}</td>
                    <td className="py-2 text-right">{it.quantity}</td>
                    <td className="py-2 text-right">
                      {formatCurrency(it.unitPrice, currency)}
                    </td>
                    <td className="py-2 text-right">
                      {formatCurrency(
                        (Number(it.quantity) || 0) *
                          (Number(it.unitPrice) || 0),
                        currency
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Tax ({taxRate || 0}%)
                </span>
                <span>{formatCurrency(tax, currency)}</span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
            </div>
            {notes ? (
              <p className="mt-4 text-sm text-muted-foreground">{notes}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
