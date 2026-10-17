import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">Sign in</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Use your admin email and password.</p>
      <LoginForm />
    </>
  );
}
