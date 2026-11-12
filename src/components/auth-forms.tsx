"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useAuth } from "@/components/providers/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.83z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function ModeNote() {
  const { mode } = useAuth();
  if (mode !== "local") return null;
  return (
    <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
      <strong>Local mode:</strong> Supabase isn&apos;t configured, so your account and progress are stored securely in this browser only. Google sign-in and reset emails need Supabase.
    </p>
  );
}

function GoogleButton({ next }: { next: string }) {
  const { signInWithGoogle, mode } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  return (
    <div>
      <Button
        variant="outline"
        block
        loading={loading}
        disabled={mode === "local"}
        title={mode === "local" ? "Requires Supabase" : undefined}
        onClick={async () => {
          setError(null);
          setLoading(true);
          try {
            await signInWithGoogle(next);
          } catch (e) {
            setError((e as Error).message);
            setLoading(false);
          }
        }}
      >
        <GoogleIcon /> Continue with Google
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-500">
          {error}
        </p>
      )}
    </div>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase text-muted">
      <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/dashboard";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(params.get("error"));
  const [loading, setLoading] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email)) return setError("Please enter a valid email address.");
    if (!password) return setError("Please enter your password.");
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Sign in to keep your streak going.</p>
      <div className="mt-6 space-y-4">
        <ModeNote />
        <GoogleButton next={next} />
      </div>
      <Divider />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}
        <Button type="submit" block size="lg" loading={loading}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New to Lumrik?{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Tell us what to call you.";
    if (!EMAIL_RE.test(email)) errs.email = "Please enter a valid email address.";
    if (password.length < 8) errs.password = "Use at least 8 characters.";
    else if (!/[0-9]/.test(password) || !/[a-zA-Z]/.test(password)) errs.password = "Use letters and at least one number.";
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      const { needsConfirmation } = await signUp(email, password, name);
      if (needsConfirmation) setSent(true);
      else router.replace("/onboarding");
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (sent)
    return (
      <div className="text-center">
        <div className="text-5xl">📬</div>
        <h1 className="mt-4 font-display text-2xl font-extrabold">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted">
          We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account and start learning.
        </p>
        <Link href="/login" className="mt-6 inline-block font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Free forever. Start your first lesson in two minutes.</p>
      <div className="mt-6 space-y-4">
        <ModeNote />
        <GoogleButton next="/onboarding" />
      </div>
      <Divider />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" htmlFor="name" error={errors.name}>
          <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters, with letters and a number.">
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
        </Field>
        {formError && (
          <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
            {formError}
          </p>
        )}
        <Button type="submit" block size="lg" loading={loading}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) return setError("Please enter a valid email address.");
    setError(null);
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Reset your password</h1>
      {sent ? (
        <p className="mt-4 rounded-xl bg-emerald-500/10 p-4 text-sm">If an account exists for {email}, a reset link is on its way. The link opens a page where you can choose a new password.</p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <p className="text-sm text-muted">Enter your email and we&apos;ll send you a link to choose a new password.</p>
          <Field label="Email" htmlFor="email" error={error}>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" block size="lg" loading={loading}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const { updatePassword, user, ready } = useAuth();
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setError(null);
    setLoading(true);
    try {
      await updatePassword(password);
      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  if (ready && !user)
    return (
      <div>
        <h1 className="font-display text-2xl font-extrabold">Link expired</h1>
        <p className="mt-2 text-sm text-muted">This reset link is invalid or has expired. Request a new one.</p>
        <Link href="/forgot-password" className="mt-4 inline-block font-semibold text-primary hover:underline">
          Request a new link
        </Link>
      </div>
    );

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Choose a new password</h1>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="New password" htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={error}>
          <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" block size="lg" loading={loading}>
          Update password
        </Button>
      </form>
    </div>
  );
}
