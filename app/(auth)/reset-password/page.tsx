import type { Metadata } from "next";
import { PasswordForm } from "@/components/password-form";

export const metadata: Metadata = { title: "Set new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">Set a new password</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Choose a password with at least 8 characters.</p>
      <PasswordForm />
    </>
  );
}
