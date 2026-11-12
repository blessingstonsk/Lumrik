import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { Spinner } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
