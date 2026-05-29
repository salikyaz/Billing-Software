"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/fetcher";
import type { Settings } from "@/types/api";

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "PHP"];

type Form = {
  companyName: string;
  companyEmail: string;
  companyAddress: string;
  companyPhone: string;
  logoUrl: string;
  taxRate: string;
  defaultCurrency: string;
  billingDay: string;
  reminderAfterDays: string;
  invoiceNumberPrefix: string;
  msClientId: string;
  msTenantId: string;
  msClientSecret: string;
  sharedMailbox: string;
  stripePublishableKey: string;
  stripeSecretKey: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function hydrate(s: Settings) {
    setSettings(s);
    setForm({
      companyName: s.companyName ?? "",
      companyEmail: s.companyEmail ?? "",
      companyAddress: s.companyAddress ?? "",
      companyPhone: s.companyPhone ?? "",
      logoUrl: s.logoUrl ?? "",
      taxRate: String(s.taxRate ?? "0"),
      defaultCurrency: s.defaultCurrency ?? "USD",
      billingDay: String(s.billingDay ?? 1),
      reminderAfterDays: String(s.reminderAfterDays ?? 7),
      invoiceNumberPrefix: s.invoiceNumberPrefix ?? "INV",
      msClientId: s.msClientId ?? "",
      msTenantId: s.msTenantId ?? "",
      msClientSecret: "",
      sharedMailbox: s.sharedMailbox ?? "",
      stripePublishableKey: s.stripePublishableKey ?? "",
      stripeSecretKey: "",
    });
  }

  useEffect(() => {
    api<Settings>("/api/settings")
      .then(hydrate)
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        companyName: form.companyName,
        companyEmail: form.companyEmail,
        companyAddress: form.companyAddress,
        companyPhone: form.companyPhone,
        logoUrl: form.logoUrl,
        taxRate: Number(form.taxRate) || 0,
        defaultCurrency: form.defaultCurrency,
        billingDay: Number(form.billingDay) || 1,
        reminderAfterDays: Number(form.reminderAfterDays) || 0,
        invoiceNumberPrefix: form.invoiceNumberPrefix,
        msClientId: form.msClientId,
        msTenantId: form.msTenantId,
        sharedMailbox: form.sharedMailbox,
        stripePublishableKey: form.stripePublishableKey,
      };
      // Only send secrets when provided (blank preserves existing).
      if (form.msClientSecret) payload.msClientSecret = form.msClientSecret;
      if (form.stripeSecretKey) payload.stripeSecretKey = form.stripeSecretKey;

      const updated = await api<Settings>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      hydrate(updated);
      toast.success("Settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure your billing system.">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </PageHeader>

      <Tabs defaultValue="company">
        <TabsList className="flex-wrap">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="stripe">Stripe</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Company</CardTitle>
              <CardDescription>
                Shown on invoices and outgoing emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name">
                <Input
                  value={form.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                />
              </Field>
              <Field label="Company email">
                <Input
                  type="email"
                  value={form.companyEmail}
                  onChange={(e) => set("companyEmail", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={form.companyPhone}
                  onChange={(e) => set("companyPhone", e.target.value)}
                />
              </Field>
              <Field label="Logo URL">
                <Input
                  value={form.logoUrl}
                  onChange={(e) => set("logoUrl", e.target.value)}
                  placeholder="https://…"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address">
                  <Textarea
                    value={form.companyAddress}
                    onChange={(e) => set("companyAddress", e.target.value)}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>
                Defaults applied to new invoices and automation.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Default tax rate (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.taxRate}
                  onChange={(e) => set("taxRate", e.target.value)}
                />
              </Field>
              <Field label="Default currency">
                <Select
                  value={form.defaultCurrency}
                  onValueChange={(v) => set("defaultCurrency", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Billing day of month (1-28)">
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={form.billingDay}
                  onChange={(e) => set("billingDay", e.target.value)}
                />
              </Field>
              <Field label="Send reminder after (days overdue)">
                <Input
                  type="number"
                  min={0}
                  value={form.reminderAfterDays}
                  onChange={(e) => set("reminderAfterDays", e.target.value)}
                />
              </Field>
              <Field label="Invoice number prefix">
                <Input
                  value={form.invoiceNumberPrefix}
                  onChange={(e) => set("invoiceNumberPrefix", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Email (Microsoft Graph)</CardTitle>
                  <CardDescription>
                    Send invoices via an Outlook shared mailbox.
                  </CardDescription>
                </div>
                <ConfiguredBadge ok={settings?.configured.graph ?? false} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Client ID">
                <Input
                  value={form.msClientId}
                  onChange={(e) => set("msClientId", e.target.value)}
                />
              </Field>
              <Field label="Tenant ID">
                <Input
                  value={form.msTenantId}
                  onChange={(e) => set("msTenantId", e.target.value)}
                />
              </Field>
              <Field label="Client secret">
                <Input
                  type="password"
                  placeholder="•••• leave blank to keep"
                  value={form.msClientSecret}
                  onChange={(e) => set("msClientSecret", e.target.value)}
                />
              </Field>
              <Field label="Shared mailbox">
                <Input
                  value={form.sharedMailbox}
                  onChange={(e) => set("sharedMailbox", e.target.value)}
                  placeholder="billing@aitek-solutions.com"
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stripe">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Stripe</CardTitle>
                  <CardDescription>
                    Generate payment links for invoices.
                  </CardDescription>
                </div>
                <ConfiguredBadge ok={settings?.configured.stripe ?? false} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Publishable key">
                <Input
                  value={form.stripePublishableKey}
                  onChange={(e) => set("stripePublishableKey", e.target.value)}
                  placeholder="pk_live_…"
                />
              </Field>
              <Field label="Secret key">
                <Input
                  type="password"
                  placeholder="•••• leave blank to keep"
                  value={form.stripeSecretKey}
                  onChange={(e) => set("stripeSecretKey", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ConfiguredBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <Badge className="bg-success/15 text-success hover:bg-success/15">
      <CheckCircle2 className="mr-1 h-3 w-3" />
      Configured
    </Badge>
  ) : (
    <Badge variant="secondary">
      <XCircle className="mr-1 h-3 w-3" />
      Not configured
    </Badge>
  );
}
