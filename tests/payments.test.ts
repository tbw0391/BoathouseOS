import { describe, expect, it } from "vitest";
import {
  amountPaid,
  applicableDiscount,
  billTotal,
  installmentAmounts,
  parseMoney,
  payerSurcharge,
  platformFee,
} from "@/lib/payments";
import type { Discount } from "@/lib/database.types";

const discount = (d: Partial<Discount>): Discount => ({
  id: "d",
  name: "Discount",
  kind: "amount",
  percent_bps: null,
  amount_cents: null,
  charge_id: null,
  profile_id: null,
  expires_on: null,
  active: true,
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
  ...d,
});

describe("parseMoney", () => {
  it("reads dollars into cents", () => {
    expect(parseMoney("$12.50")).toBe(1250);
    expect(parseMoney("12")).toBe(1200);
    expect(parseMoney("1,234.56")).toBe(123456);
    expect(parseMoney(" 0.1 ")).toBe(10);
  });
  it("rejects zero, negatives and junk", () => {
    expect(parseMoney("0")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
});

describe("payerSurcharge", () => {
  it("covers Stripe's 2.9% + 30c so the club nets the full amount", () => {
    for (const net of [100, 2500, 10000, 123456]) {
      const gross = net + payerSurcharge(net);
      expect(gross * 0.971 - 30).toBeGreaterThanOrEqual(net);
      // ...without overcharging by more than a cent.
      expect((gross - 1) * 0.971 - 30).toBeLessThan(net);
    }
    expect(payerSurcharge(10000)).toBe(330);
  });
  it("is zero for nothing owed", () => {
    expect(payerSurcharge(0)).toBe(0);
  });
});

describe("platformFee", () => {
  it("is 1%, rounded to the cent", () => {
    expect(platformFee(10000)).toBe(100);
    expect(platformFee(1250)).toBe(13);
    expect(platformFee(0)).toBe(0);
  });
});

describe("installmentAmounts", () => {
  it("splits evenly with leftover cents on the first payment", () => {
    expect(installmentAmounts(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(installmentAmounts(9000, 3)).toEqual([3000, 3000, 3000]);
  });
  it("always adds back up to the total", () => {
    for (const [total, n] of [[12345, 4], [1, 3], [99999, 7]]) {
      expect(installmentAmounts(total, n).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});

describe("applicableDiscount", () => {
  it("adds up matching discounts", () => {
    const res = applicableDiscount(
      20000,
      [
        discount({ name: "Sibling", kind: "percent", percent_bps: 1000 }),
        discount({ name: "Volunteer", amount_cents: 5000 }),
      ],
      "charge",
      "rower"
    );
    expect(res).toEqual({ discountCents: 7000, note: "Sibling, Volunteer" });
  });
  it("skips inactive, expired, and other charges' or rowers' discounts", () => {
    const res = applicableDiscount(
      20000,
      [
        discount({ amount_cents: 1000, active: false }),
        discount({ amount_cents: 1000, expires_on: "2000-01-01" }),
        discount({ amount_cents: 1000, charge_id: "other-charge" }),
        discount({ amount_cents: 1000, profile_id: "other-rower" }),
      ],
      "charge",
      "rower"
    );
    expect(res).toEqual({ discountCents: 0, note: null });
  });
  it("never discounts more than the charge", () => {
    expect(applicableDiscount(3000, [discount({ amount_cents: 5000 })], "c", "r").discountCents).toBe(3000);
  });
});

describe("bill totals", () => {
  it("counts only succeeded payments", () => {
    expect(billTotal({ amount_cents: 10000, discount_cents: 1500 })).toBe(8500);
    expect(
      amountPaid([
        { amount_cents: 3000, status: "succeeded" },
        { amount_cents: 2000, status: "refunded" },
        { amount_cents: 1000, status: "failed" },
      ])
    ).toBe(3000);
  });
});
