"use client";

import { useRef, useState, useTransition } from "react";
import {
  connectStripe,
  createCharge,
  createDiscount,
  deleteDiscount,
  setDiscountActive,
} from "../actions";

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
        selected
          ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
          : "border-gray-300 hover:border-[var(--color-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

const primaryButton =
  "self-start rounded bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] px-3 py-2 text-sm disabled:opacity-50";
const input = "border rounded px-3 py-2 text-sm";

export function StripeConnectButton({ label }: { label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={isPending}
        className={primaryButton}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await connectStripe();
              if ("error" in result) setError(result.error);
              else window.location.assign(result.url);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Couldn't reach Stripe.");
            }
          })
        }
      >
        {isPending ? "Opening Stripe..." : label}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

const KINDS = [
  { id: "season", label: "Season" },
  { id: "dues", label: "Dues" },
  { id: "regatta", label: "Regatta fee" },
  { id: "travel", label: "Travel" },
  { id: "other", label: "Other" },
];

export function NewChargeForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("season");
  const [installments, setInstallments] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primaryButton}>
        New charge
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      className="border rounded-lg p-4 flex flex-col gap-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          try {
            const { id } = await createCharge(formData);
            window.location.assign(`/payments/manage/${id}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
          }
        });
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium">New charge</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:underline">
          Cancel
        </button>
      </div>
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Choice key={k.id} selected={kind === k.id} onClick={() => setKind(k.id)}>
            {k.label}
          </Choice>
        ))}
      </div>
      <input name="title" required placeholder="Name, like Fall 2026 Season" className={input} />
      <input name="amount" required inputMode="decimal" placeholder="Amount, like 450" className={input} />
      <textarea name="description" rows={2} placeholder="Details families should see (optional)" className={input} />
      <label className="flex flex-col gap-1 text-xs text-gray-500">
        Due date (optional)
        <input type="date" name="due_date" className={`${input} text-black`} />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="signup_open" defaultChecked={kind === "season"} />
        Families can sign rowers up for this themselves
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="allow_installments"
          checked={installments}
          onChange={(e) => setInstallments(e.target.checked)}
        />
        Allow paying in installments (charged automatically)
      </label>
      {installments && (
        <div className="flex flex-wrap items-center gap-2 text-sm pl-6">
          <input
            name="installment_count"
            type="number"
            min={2}
            max={12}
            defaultValue={4}
            className={`${input} w-20`}
          />
          payments, every
          <input
            name="installment_interval_days"
            type="number"
            min={7}
            max={120}
            defaultValue={30}
            className={`${input} w-20`}
          />
          days
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={isPending} className={primaryButton}>
        {isPending ? "Creating..." : "Create charge"}
      </button>
    </form>
  );
}

export function NewDiscountForm({
  charges,
  rowers,
}: {
  charges: { id: string; title: string }[];
  rowers: { id: string; display_name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="border rounded-lg p-4 flex flex-col gap-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          try {
            await createDiscount(formData);
            formRef.current?.reset();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
          }
        });
      }}
    >
      <h3 className="font-medium">New discount</h3>
      <input type="hidden" name="kind" value={kind} />
      <input name="name" required placeholder="Name, like Sibling or Early bird" className={input} />
      <div className="flex flex-wrap items-center gap-2">
        <Choice selected={kind === "percent"} onClick={() => setKind("percent")}>
          Percent off
        </Choice>
        <Choice selected={kind === "amount"} onClick={() => setKind("amount")}>
          Dollars off
        </Choice>
        <input
          name="value"
          required
          inputMode="decimal"
          placeholder={kind === "percent" ? "10" : "50"}
          className={`${input} w-24`}
        />
        <span className="text-sm text-gray-500">{kind === "percent" ? "%" : "$"}</span>
      </div>
      <select name="charge_id" defaultValue="" className={input}>
        <option value="">Any charge</option>
        {charges.map((c) => (
          <option key={c.id} value={c.id}>
            Only {c.title}
          </option>
        ))}
      </select>
      <select name="profile_id" defaultValue="" className={input}>
        <option value="">Every rower</option>
        {rowers.map((r) => (
          <option key={r.id} value={r.id}>
            Only {r.display_name}
          </option>
        ))}
      </select>
      <label className="flex flex-col gap-1 text-xs text-gray-500">
        Ends after (optional, e.g. for an early-bird discount)
        <input type="date" name="expires_on" className={`${input} text-black`} />
      </label>
      <p className="text-xs text-gray-500">
        Applies automatically when a rower is billed or signs up. It doesn&apos;t change bills that already exist;
        adjust those on the charge&apos;s page.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={isPending} className={primaryButton}>
        {isPending ? "Saving..." : "Add discount"}
      </button>
    </form>
  );
}

export function DiscountRowActions({ id, active }: { id: string; active: boolean }) {
  const [, startTransition] = useTransition();
  return (
    <div className="flex gap-3 shrink-0">
      <button
        type="button"
        onClick={() => startTransition(() => setDiscountActive(id, !active))}
        className="text-xs font-medium hover:underline"
      >
        {active ? "Turn off" : "Turn on"}
      </button>
      <button
        type="button"
        onClick={() => startTransition(() => deleteDiscount(id))}
        className="text-xs font-medium text-red-600 hover:underline"
      >
        Delete
      </button>
    </div>
  );
}
