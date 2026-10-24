import { Suspense } from "react";
import { LogOut, Plus, Search } from "lucide-react";
import Link from "next/link";
import Form from "next/form";
import { SubmitButton } from "@/components/submit-button";
import { MobileNav, Sidebar } from "@/components/nav";
import { ProfileMenu } from "@/components/profile-menu";
import { getContext } from "@/lib/auth";
import { logout } from "@/app/actions/auth";

async function UserMenu() {
  const ctx = await getContext();
  return (
    <ProfileMenu name={ctx.business.name} email={ctx.email}>
      <form action={logout}>
        <SubmitButton
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          icon={<LogOut className="size-4" />}
        >
          Sign out
        </SubmitButton>
      </form>
    </ProfileMenu>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-60">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <MobileNav />
          <Form action="/search" className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              placeholder="Search clients, invoices, products…"
              className="input h-9 rounded-full bg-slate-50 pl-9"
              aria-label="Search"
            />
          </Form>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/invoices/new" className="btn-primary btn-sm hidden sm:inline-flex">
              <Plus className="size-4" /> New invoice
            </Link>
            <Suspense fallback={<div className="size-8 rounded-full bg-slate-100" />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
