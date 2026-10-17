import type { Metadata } from "next";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">Forgot password</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>
      <ForgotForm />
    </>
  );
}
