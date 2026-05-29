import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Accent = "primary" | "success" | "warning" | "destructive";

const accentStyles: Record<Accent, { ring: string; text: string }> = {
  primary: { ring: "bg-primary/15", text: "text-primary" },
  success: { ring: "bg-success/15", text: "text-success" },
  warning: { ring: "bg-warning/15", text: "text-warning" },
  destructive: { ring: "bg-destructive/15", text: "text-destructive" },
};

export function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: LucideIcon;
  accent?: Accent;
}) {
  const styles = accentStyles[accent];
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subValue ? (
            <p className="text-xs text-muted-foreground">{subValue}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            styles.ring
          )}
        >
          <Icon className={cn("h-6 w-6", styles.text)} />
        </div>
      </CardContent>
    </Card>
  );
}
