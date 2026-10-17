import { logout } from "@/app/actions/auth";

export default function NoAccessPage() {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-xl font-bold text-slate-900">No access</h1>
      <p className="text-sm text-slate-500">
        Your account isn&apos;t linked to this business. Ask the admin to add you.
      </p>
      <form action={logout}>
        <button className="btn-secondary w-full">Sign out</button>
      </form>
    </div>
  );
}
