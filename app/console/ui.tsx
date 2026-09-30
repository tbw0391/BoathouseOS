import Link from "next/link";
import { signOut } from "@/app/login/actions";

// Shared bits for the console's pages.

export function ConsolePage({
  title,
  back,
  subtitle,
  children,
}: {
  title: string;
  back?: { href: string; label: string };
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div>
        {back && (
          <Link href={back.href} className="text-sm text-gray-500 hover:underline">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
      </div>
      {children}
    </main>
  );
}

export function Card({ title, children, tone }: { title?: string; children: React.ReactNode; tone?: "danger" }) {
  return (
    <section
      className={`bg-white rounded-lg p-4 flex flex-col gap-3 border ${tone === "danger" ? "border-red-300" : "border-gray-200"}`}
    >
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </>
  );
  const cls = "bg-white border border-gray-200 rounded-lg p-3 block";
  return href ? (
    <Link href={href} className={`${cls} hover:border-[var(--color-primary)]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" | "red" | "amber" | "blue" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return <span className={`inline-block text-xs rounded px-1.5 py-0.5 ${tones[tone]}`}>{children}</span>;
}

export const buttonClass =
  "bg-[var(--color-primary)] text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50";
export const outlineButtonClass =
  "border-2 border-[var(--color-primary)] text-[var(--color-primary)] rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50";
export const inputClass = "border rounded px-3 py-2 text-sm bg-white";

// Signed in, but not as a global admin (e.g. a club admin who opened the
// console's address).
export function NotGlobalAdmin() {
  return (
    <main className="max-w-md mx-auto px-4 py-16 flex flex-col gap-4 text-center">
      <h1 className="text-xl font-bold">This account isn&apos;t a global admin</h1>
      <p className="text-sm text-gray-600">
        The console is only for BoathouseOS&apos;s global admins. Sign out and sign in with the global admin
        account, or go to your club&apos;s own address.
      </p>
      <form action={signOut}>
        <button type="submit" className={buttonClass}>
          Sign out
        </button>
      </form>
    </main>
  );
}
