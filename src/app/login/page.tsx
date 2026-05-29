"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

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
import { Logo } from "@/components/brand/logo";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function finishSignIn(twoFactorCode?: string) {
    const res = await signIn("credentials", {
      email,
      password,
      code: twoFactorCode ?? "",
      redirect: false,
    });
    if (res?.error) {
      toast.error(
        twoFactorCode ? "Invalid or expired code" : "Invalid email or password"
      );
      return;
    }
    toast.success("Welcome back");
    router.push("/dashboard");
    router.refresh();
  }

  // Step 1: verify credentials; branch on whether 2FA is required.
  async function onSubmitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Invalid email or password");
        return;
      }
      if (data.twoFactorRequired) {
        setStep("code");
        toast.success("We sent a 6-digit code to your email");
      } else {
        await finishSignIn();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: submit the emailed 2FA code.
  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await finishSignIn(code.trim());
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) toast.success("A new code has been sent");
      else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Could not resend code");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-secondary p-4">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto">
            <Logo width={190} priority />
          </div>
          <CardTitle className="text-xl">
            {step === "code" ? "Two-factor verification" : "Admin Sign In"}
          </CardTitle>
          <CardDescription>
            {step === "code"
              ? "Enter the 6-digit code we emailed you."
              : "Sign in to your billing dashboard"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "credentials" ? (
            <form onSubmit={onSubmitCredentials} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@aitek-solutions.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={onSubmitCode} className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  className="text-center text-lg tracking-[0.5em]"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || code.length < 6}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Verify & sign in"
                )}
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    setCode("");
                  }}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={loading}
                  className="font-medium text-primary hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
