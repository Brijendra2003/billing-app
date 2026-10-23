"use client";

import Link, { useLinkStatus } from "next/link";
import { Spinner } from "@/components/ui";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import {
  BarChart3,
  Calculator,
  CreditCard,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Menu,
  Package,
  Receipt,
  Settings,
  Trash2,
  Users,
  X,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/tools/area-calculator", label: "Area Calculator", icon: Calculator },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/trash", label: "Trash", icon: Trash2 },
];

function NavLinks(props: { onNavigate?: () => void }) {
  // The active highlight depends on the URL, so it streams in after the static shell.
  return (
    <Suspense fallback={<NavList path="" {...props} />}>
      <ActiveNavLinks {...props} />
    </Suspense>
  );
}

function ActiveNavLinks(props: { onNavigate?: () => void }) {
  return <NavList path={usePathname()} {...props} />;
}

function NavList({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="size-4.5 shrink-0" />
            {label}
            <PendingHint />
          </Link>
        );
      })}
    </nav>
  );
}

/** Small spinner next to a nav item while its page is loading. */
function PendingHint() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className="ml-auto size-3.5 text-brand-600" /> : null;
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-3">
      <span className="rounded-lg bg-brand-600 p-1.5 text-white">
        <FileSpreadsheet className="size-4" />
      </span>
      <span className="font-bold tracking-tight text-slate-900">SmartBill CRM</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex">
      <Brand />
      <div className="mt-6 flex-1 overflow-y-auto">
        <NavLinks />
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button className="btn-ghost -ml-2 px-2" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white px-3 py-5 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button className="btn-ghost px-2" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
