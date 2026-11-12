"use client";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { ButtonLink } from "@/components/ui/button";

export function LandingCta() {
  const { user, ready } = useAuth();
  if (ready && user)
    return (
      <ButtonLink href="/dashboard" size="lg">
        Continue learning <ArrowRight className="h-5 w-5" aria-hidden />
      </ButtonLink>
    );
  return (
    <div className="flex flex-wrap gap-3">
      <ButtonLink href="/register" size="lg">
        Get started free <ArrowRight className="h-5 w-5" aria-hidden />
      </ButtonLink>
      <ButtonLink href="/login" size="lg" variant="outline">
        I have an account
      </ButtonLink>
    </div>
  );
}

export function LandingNavActions() {
  const { user, ready } = useAuth();
  if (ready && user)
    return (
      <ButtonLink href="/dashboard" size="sm">
        Open app
      </ButtonLink>
    );
  return (
    <>
      <ButtonLink href="/login" size="sm" variant="ghost">
        Sign in
      </ButtonLink>
      <ButtonLink href="/register" size="sm">
        Get started
      </ButtonLink>
    </>
  );
}
