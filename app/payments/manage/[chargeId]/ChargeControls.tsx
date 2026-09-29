"use client";

import { useState, useTransition } from "react";
import {
  archiveCharge,
  assignCharge,
  recordManualPayment,
  setBillDiscount,
  setBillStatus,
  setChargeSignupOpen,
} from "../../actions";
import type { Team } from "@/lib/database.types";
import { unwrap, unwrapIfResult } from "@/lib/userError";

const small = "text-xs font-medium hover:underline";
const input = "border rounded px-2 py-1 text-sm";
const primaryButton =
  "rounded bg-[var(--color-secondary)] text-white border-2 border-[var(--color-primary)] px-3 py-1.5 text-sm disabled:opacity-50";

export function ChargeToggles({ chargeId, signupOpen, archived }: { chargeId: string; signupOpen: boolean; archived: boolean }) {
  const [, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-4">
      {!archived && (
        <button type="button" className={small} onClick={() => startTransition(() => setChargeSignupOpen(chargeId, !signupOpen))}>
          {signupOpen ? "Close sign-up" : "Open for family sign-up"}
        </button>
      )}
      <button type="button" className={small} onClick={() => startTransition(() => archiveCharge(chargeId, !archived))}>
        {archived ? "Unarchive" : "Archive"}
      </button>
    </div>
  );
}

const SQUADS: { id: Team; label: string }[] = [
  { id: "mens", label: "Men's" },
  { id: "womens", label: "Women's" },
  { id: "masters", label: "Masters" },
  { id: "development", label: "Development" },
];

// Bill squads or picked rowers; already-billed rowers are skipped.
export function AssignPanel({
  chargeId,
  rowers,
}: {
  chargeId: string;
  rowers: { id: string; display_name: string; billed: boolean }[];
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const unbilled = rowers.filter((r) => !r.billed);

  function toggle<T>(list: T[], item: T) {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  }

  function run(target: { teams?: Team[]; rowerIds?: string[] }) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const { created, skipped } = unwrap(await assignCharge(chargeId, target));
        setMessage(`Billed ${created} rower${created === 1 ? "" : "s"}${skipped ? ` (${skipped} already billed)` : ""}.`);
        setTeams([]);
        setPicked([]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="rounded-lg border-2 border-gray-200 p-4 flex flex-col gap-3">
      <h2 className="font-semibold">Bill rowers</h2>
      <div className="flex flex-wrap gap-2">
        {SQUADS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={teams.includes(s.id)}
            onClick={() => setTeams(toggle(teams, s.id))}
            className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
              teams.includes(s.id)
                ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                : "border-gray-300"
            }`}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          disabled={isPending || teams.length === 0}
          onClick={() => run({ teams })}
          className={primaryButton}
        >
          Bill {teams.length ? "these squads" : "a squad"}
        </button>
      </div>
      <button
        type="button"
        disabled={isPending || unbilled.length === 0}
        onClick={() => run({ rowerIds: unbilled.map((r) => r.id) })}
        className={`${primaryButton} self-start`}
      >
        Bill everyone rowing ({unbilled.length} not billed yet)
      </button>
      {unbilled.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-gray-600">Or pick rowers</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {unbilled.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setPicked(toggle(picked, r.id))}
                className={`rounded-full border-2 px-3 py-1 text-sm ${
                  picked.includes(r.id)
                    ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white"
                    : "border-gray-300"
                }`}
              >
                {r.display_name}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={isPending || picked.length === 0}
            onClick={() => run({ rowerIds: picked })}
            className={`${primaryButton} mt-2`}
          >
            Bill {picked.length} picked
          </button>
        </details>
      )}
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// Per-bill treasurer actions: adjust the discount, record cash/check, waive,
// cancel, or reopen.
export function BillActions({
  billId,
  status,
  discountDollars,
  discountNote,
  balanceDollars,
}: {
  billId: string;
  status: "owed" | "paid" | "waived" | "cancelled";
  discountDollars: string;
  discountNote: string;
  balanceDollars: string;
}) {
  const [panel, setPanel] = useState<"none" | "discount" | "payment">("none");
  const [method, setMethod] = useState("check");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        unwrapIfResult(await fn());
        setPanel("none");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <button type="button" className={small} onClick={() => setPanel(panel === "discount" ? "none" : "discount")}>
          Discount
        </button>
        {status === "owed" && (
          <button type="button" className={small} onClick={() => setPanel(panel === "payment" ? "none" : "payment")}>
            Record payment
          </button>
        )}
        {status === "owed" && (
          <button type="button" className={small} onClick={() => run(() => setBillStatus(billId, "waived"))}>
            Waive
          </button>
        )}
        {status === "owed" && (
          <button
            type="button"
            className={`${small} text-red-600`}
            onClick={() => run(() => setBillStatus(billId, "cancelled"))}
          >
            Cancel
          </button>
        )}
        {(status === "waived" || status === "cancelled") && (
          <button type="button" className={small} onClick={() => run(() => setBillStatus(billId, "owed"))}>
            Reopen
          </button>
        )}
      </div>

      {panel === "discount" && (
        <form
          className="flex flex-wrap items-center gap-2"
          action={(fd) =>
            run(() => setBillDiscount(billId, String(fd.get("discount") ?? ""), String(fd.get("note") ?? "")))
          }
        >
          <span className="text-sm">$</span>
          <input name="discount" defaultValue={discountDollars} inputMode="decimal" className={`${input} w-24`} />
          <input name="note" defaultValue={discountNote} placeholder="Reason, like Financial aid" className={`${input} flex-1 min-w-32`} />
          <button type="submit" disabled={isPending} className={primaryButton}>
            Save
          </button>
        </form>
      )}

      {panel === "payment" && (
        <form
          className="flex flex-wrap items-center gap-2"
          action={(fd) => {
            fd.set("bill_id", billId);
            fd.set("method", method);
            run(() => recordManualPayment(fd));
          }}
        >
          {["check", "cash", "other"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`rounded border-2 px-2 py-1 text-xs font-medium capitalize ${
                method === m ? "border-[var(--color-primary)] bg-[var(--color-secondary)] text-white" : "border-gray-300"
              }`}
            >
              {m}
            </button>
          ))}
          <span className="text-sm">$</span>
          <input name="amount" defaultValue={balanceDollars} inputMode="decimal" className={`${input} w-24`} />
          <input name="note" placeholder="Check # (optional)" className={`${input} w-36`} />
          <button type="submit" disabled={isPending} className={primaryButton}>
            Record
          </button>
        </form>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
