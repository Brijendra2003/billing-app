import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-black text-slate-200">404</p>
      <h1 className="text-lg font-bold">Page not found</h1>
      <p className="text-sm text-slate-500">This page doesn&apos;t exist, or the link has been revoked.</p>
      <Link href="/dashboard" className="btn-primary mt-2">
        Go to dashboard
      </Link>
    </main>
  );
}
