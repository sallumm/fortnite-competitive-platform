import { it, expect } from "vitest";
import {
  reconcilePayment,
  paymentBenefit,
  validOAuthState,
  type BillingOrder,
  type VerifiedPayment,
} from "../supabase/functions/_shared/billing";
const order: BillingOrder = {
  id: "server-order",
  userId: "owner",
  providerId: "provider-resource",
  amountCents: 100,
  currency: "BRL",
  period: "monthly",
  state: "pending",
  providerAt: 0,
  paidUntil: 0,
  version: 1,
};
const paid: VerifiedPayment = {
  providerId: order.providerId,
  reference: order.id,
  amountCents: 100,
  currency: "BRL",
  state: "paid",
  providerAt: 10,
  paidUntil: 100,
};
it.each(["monthly", "quarterly", "annual"] as const)(
  "reconciles %s without trusting browser plan/price",
  (period) => {
    const result = reconcilePayment({ ...order, period }, paid, 20);
    expect(result.changed).toBe(true);
    expect(paymentBenefit(result.order, 20)).toBe(true);
    expect(reconcilePayment(result.order, paid, 20).changed).toBe(false);
    expect(paymentBenefit(result.order, 100)).toBe(false);
  },
);
it("honors a refund at the same timestamp and cannot revive it with a late paid event", () => {
  const first = reconcilePayment(order, paid, 20).order;
  const refund = reconcilePayment(first, { ...paid, state: "refunded" }, 20);
  expect(refund.changed).toBe(true);
  expect(paymentBenefit(refund.order, 20)).toBe(false);
  expect(
    reconcilePayment(refund.order, { ...paid, providerAt: 11 }, 20).order.state,
  ).toBe("refunded");
});
it("ignores older states and preserves contracted time after cancellation", () => {
  const first = reconcilePayment(order, paid, 20).order;
  expect(
    reconcilePayment(first, { ...paid, state: "pending", providerAt: 9 }, 20)
      .changed,
  ).toBe(false);
  const cancel = reconcilePayment(
    first,
    { ...paid, state: "cancelled", providerAt: 11 },
    20,
  ).order;
  expect(paymentBenefit(cancel, 99)).toBe(true);
  expect(paymentBenefit(cancel, 100)).toBe(false);
});
it.each([
  { amountCents: 1 },
  { currency: "USD" },
  { reference: "other-owner" },
  { providerId: "other-resource" },
  { providerAt: NaN },
  { paidUntil: Infinity },
])("rejects forged or malformed association %j", (patch) => {
  expect(() => reconcilePayment(order, { ...paid, ...patch }, 20)).toThrow();
});
it("validates OAuth state against session, expiry and consumption", () => {
  const state = {
    value: "x".repeat(32),
    session: "admin-session",
    expiresAt: 30,
    used: false,
  };
  expect(validOAuthState(state, state.value, state.session, 20)).toBe(true);
  expect(validOAuthState(state, state.value, "attacker", 20)).toBe(false);
  expect(
    validOAuthState({ ...state, used: true }, state.value, state.session, 20),
  ).toBe(false);
  expect(validOAuthState(state, state.value, state.session, 30)).toBe(false);
});
