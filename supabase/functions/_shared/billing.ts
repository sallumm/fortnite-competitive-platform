/** Preparation only: no deployed handler, network call, catalog or premium grant.
 * Inputs must be normalized from an authenticated provider API response, never
 * a browser/webhook. Persist decisions + history in one locked transaction.
 */
export type BillingState =
  "pending" | "paid" | "cancelled" | "expired" | "refunded";
export interface BillingOrder {
  id: string;
  userId: string;
  providerId: string;
  amountCents: number;
  currency: "BRL";
  period: "monthly" | "quarterly" | "annual";
  state: BillingState;
  providerAt: number;
  paidUntil: number;
  version: number;
}
export interface VerifiedPayment {
  providerId: string;
  reference: string;
  amountCents: number;
  currency: string;
  state: BillingState;
  providerAt: number;
  paidUntil: number;
}
const priority: Record<BillingState, number> = {
  pending: 0,
  paid: 1,
  cancelled: 2,
  expired: 3,
  refunded: 4,
};
export function reconcilePayment(
  order: BillingOrder,
  snapshot: VerifiedPayment,
  now: number,
) {
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(snapshot.providerAt) ||
    snapshot.providerAt > now + 300000 ||
    snapshot.providerAt < 0 ||
    !Number.isFinite(snapshot.paidUntil) ||
    snapshot.paidUntil < 0 ||
    !Object.hasOwn(priority, snapshot.state) ||
    !Number.isSafeInteger(order.amountCents) ||
    order.amountCents <= 0 ||
    snapshot.providerId !== order.providerId ||
    snapshot.reference !== order.id ||
    snapshot.amountCents !== order.amountCents ||
    snapshot.currency !== order.currency
  )
    throw Error("Unverified payment association or value");
  // Refund is terminal for this order; renewal needs a distinct trusted order.
  if (
    order.state === "refunded" ||
    snapshot.providerAt < order.providerAt ||
    (snapshot.providerAt === order.providerAt &&
      priority[snapshot.state] <= priority[order.state])
  )
    return { order, changed: false };
  const next = {
    ...order,
    state: snapshot.state,
    providerAt: snapshot.providerAt,
    paidUntil: snapshot.paidUntil,
    version: order.version + 1,
  };
  return { order: next, changed: true };
}
export function paymentBenefit(order: BillingOrder, now: number) {
  return (
    Number.isFinite(now) &&
    (order.state === "paid" || order.state === "cancelled") &&
    order.paidUntil > now
  );
}
// Use cryptographically random state stored server-side, single-use, bound to the
// initiating admin session. This validation does not itself consume the record.
export function validOAuthState(
  record: { value: string; session: string; expiresAt: number; used: boolean },
  value: string,
  session: string,
  now: number,
) {
  return (
    !record.used &&
    record.value.length >= 32 &&
    record.value === value &&
    record.session === session &&
    Number.isFinite(now) &&
    record.expiresAt > now
  );
}
