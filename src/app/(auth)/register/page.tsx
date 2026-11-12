import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth-forms";
import { Spinner } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <RegisterForm />
    </Suspense>
  );
}
