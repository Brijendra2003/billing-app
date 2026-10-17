import { Receipt } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-white">
          <div className="mb-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/20">
            <Receipt className="size-7" />
          </div>
          <p className="text-lg font-bold tracking-tight">SmartBill CRM</p>
          <p className="text-sm text-slate-300">Admin portal</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">{children}</div>
      </div>
    </main>
  );
}
