import { db } from "@/lib/db";
import { newToken } from "@/lib/password";
import {
  bookingOpen,
  CHECKOUT_HOLD_STATES,
  eventTransaction,
  notify,
  paymentHoldCount,
  promoteWaitlist,
} from "./events-service";
import {
  fetchOrder,
  fetchPayment,
  gatewayReady,
  ProviderError,
  providerId,
  providerRequest,
  testGatewayConfig,
  verifyCheckoutSignature,
  type ProviderOrder,
  type ProviderPayment,
  type ProviderRefund,
} from "./razorpay";

export async function reserveCheckout(
  eventId: string,
  userId: string,
  phone?: string,
) {
  testGatewayConfig();
  return eventTransaction(eventId, async (tx) => {
    await promoteWaitlist(tx, eventId);
    const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: { member: { include: { membership: true } } },
    });
    if (event.paymentMode !== "RAZORPAY_TEST" || event.currency !== "INR")
      throw new Error(
        "This event does not support INR Razorpay Test Mode checkout.",
      );
    if (!bookingOpen(event)) throw new Error("Registration is closed.");
    if (user.disabledAt || !user.emailVerifiedAt)
      throw new Error("Verified identity is required before checkout.");
    const ticket = await tx.ticket.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (ticket && ticket.status !== "CANCELLED")
      throw new Error("You already have a ticket for this event.");
    const previous = await tx.payment.findFirst({
      where: {
        eventId,
        userId,
        status: {
          in: [
            ...CHECKOUT_HOLD_STATES,
            "REVIEW",
            "REFUND_REQUIRED",
            "REFUND_PENDING",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (previous) {
      if (!CHECKOUT_HOLD_STATES.includes(previous.status))
        throw new Error(
          "Your earlier payment requires review or refund. Open My payments before booking again.",
        );
      return previous;
    }
    if (
      (await tx.payment.count({
        where: { userId, createdAt: { gt: new Date(Date.now() - 3600000) } },
      })) >= 12
    )
      throw new Error(
        "Too many checkout attempts this hour. Recheck an existing payment or try later.",
      );
    const offer = await tx.waitlistEntry.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    const hasOffer =
      offer?.status === "OFFERED" &&
      !!offer.offerExpiresAt &&
      offer.offerExpiresAt > new Date();
    const sold = await tx.ticket.count({
      where: { eventId, status: { not: "CANCELLED" } },
    });
    const offered = await tx.waitlistEntry.count({
      where: { eventId, status: "OFFERED", offerExpiresAt: { gt: new Date() } },
    });
    if (
      sold +
        offered +
        (await paymentHoldCount(tx, eventId)) -
        (hasOffer ? 1 : 0) >=
      event.capacity
    )
      throw new Error("No seats are available. Join the waitlist.");
    const membership = user.member?.membership;
    const member =
      membership?.status === "ACTIVE" && membership.expiresAt > new Date();
    const amountCents = member
      ? event.memberPriceCents
      : event.nonMemberPriceCents;
    if (
      !Number.isSafeInteger(amountCents) ||
      amountCents < 100 ||
      amountCents > 10000000
    )
      throw new Error("Test checkout prices must be between ₹1 and ₹100,000.");
    const expiresAt = new Date(
      Math.min(
        Date.now() + 10 * 60000,
        event.startsAt.getTime(),
        event.registrationClosesAt?.getTime() ?? Infinity,
        hasOffer ? offer!.offerExpiresAt!.getTime() : Infinity,
      ),
    );
    const payment = await tx.payment.create({
      data: {
        eventId,
        userId,
        amountCents,
        ticketType: member ? "MEMBER" : "NON_MEMBER",
        currency: "INR",
        attendeePhone: phone || null,
        expiresAt,
      },
    });
    if (hasOffer)
      await tx.waitlistEntry.update({
        where: { id: offer!.id },
        data: { status: "PAYMENT_PENDING" },
      });
    return payment;
  });
}

function matchingOrder(
  order: ProviderOrder,
  payment: { id: string; amountCents: number; currency: string },
) {
  if (
    order.receipt !== payment.id ||
    order.amount !== payment.amountCents ||
    order.currency !== payment.currency
  )
    throw new Error(
      "Provider order does not match the server's checkout record.",
    );
  providerId(order.id, "order");
}
async function attachOrder(paymentId: string, order: ProviderOrder) {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
  });
  matchingOrder(order, payment);
  return eventTransaction(payment.eventId, async (tx) => {
    const current = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    if (current.providerOrderId && current.providerOrderId !== order.id)
      throw new Error("Conflicting provider order. Staff review required.");
    return tx.payment.update({
      where: { id: paymentId },
      data: {
        providerOrderId: order.id,
        status:
          CHECKOUT_HOLD_STATES.includes(current.status) &&
          current.expiresAt > new Date()
            ? "PENDING"
            : current.status,
        issue: null,
      },
    });
  });
}
export async function createCheckoutOrder(paymentId: string) {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
  });
  if (payment.providerOrderId || payment.status !== "INIT") return payment;
  const claim = await db.payment.updateMany({
    where: { id: paymentId, status: "INIT", expiresAt: { gt: new Date() } },
    data: { status: "CREATING" },
  });
  if (!claim.count)
    return db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  try {
    const order = await providerRequest<ProviderOrder>("orders", "POST", {
      amount: payment.amountCents,
      currency: payment.currency,
      receipt: payment.id,
      partial_payment: false,
      notes: { skyline_payment: payment.id },
    });
    return await attachOrder(payment.id, order);
  } catch (error) {
    // Network/server failures are ambiguous: the provider may have created an order.
    await eventTransaction(payment.eventId, async (tx) => {
      if (
        error instanceof ProviderError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408 &&
        error.status !== 429
      ) {
        await tx.payment.updateMany({
          where: { id: payment.id, status: "CREATING" },
          data: { expiresAt: new Date(0), issue: error.message },
        });
        await promoteWaitlist(tx, payment.eventId);
        await tx.payment.updateMany({
          where: { id: payment.id, status: "EXPIRED" },
          data: { status: "FAILED", issue: error.message },
        });
      } else
        await tx.payment.updateMany({
          where: { id: payment.id, status: "CREATING" },
          data: {
            issue:
              "Order creation response was uncertain. Recheck this attempt; do not create a replacement order.",
          },
        });
    });
    return db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  }
}

async function recoverOrder(payment: {
  id: string;
  createdAt: Date;
  amountCents: number;
  currency: string;
}) {
  const from = Math.floor(payment.createdAt.getTime() / 1000) - 60;
  const found: ProviderOrder[] = [];
  for (let skip = 0; skip < 1000; skip += 100) {
    const page = await providerRequest<{ items: ProviderOrder[] }>(
      `orders?from=${from}&count=100&skip=${skip}`,
    );
    found.push(...page.items.filter((o) => o.receipt === payment.id));
    if (page.items.length < 100) break;
    if (skip === 900)
      throw new Error(
        "Order reconciliation limit reached. Review the receipt in Razorpay before retrying.",
      );
  }
  if (found.length > 1)
    throw new Error("Multiple orders share a receipt. Staff review required.");
  return found[0] ? attachOrder(payment.id, found[0]) : null;
}

async function finalizeCapture(
  paymentId: string,
  provider: ProviderPayment,
  order: ProviderOrder,
) {
  const row = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  matchingOrder(order, row);
  if (
    row.providerOrderId !== order.id ||
    provider.order_id !== order.id ||
    provider.amount !== row.amountCents ||
    provider.currency !== row.currency
  )
    throw new Error(
      "Payment amount, currency or order does not match checkout.",
    );
  providerId(provider.id, "pay");
  if (
    provider.status !== "captured" ||
    provider.captured !== true ||
    order.status !== "paid"
  )
    throw new Error(
      "Payment is not fully captured yet. Recheck its status before retrying checkout.",
    );
  if ((provider.amount_refunded || 0) > 0)
    throw new Error(
      "This payment has a refund. Reconcile its refund before issuing any ticket.",
    );
  return eventTransaction(row.eventId, async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { event: true, user: true },
    });
    if (payment.providerPaymentId && payment.providerPaymentId !== provider.id)
      throw new Error("A different payment is already linked to this order.");
    if (
      [
        "CONFIRMED",
        "REVIEW",
        "REFUND_REQUIRED",
        "REFUND_PENDING",
        "REFUNDED",
      ].includes(payment.status)
    )
      return payment;
    const prior = await tx.ticket.findUnique({
      where: {
        eventId_userId: { eventId: payment.eventId, userId: payment.userId },
      },
    });
    const eligible =
      CHECKOUT_HOLD_STATES.includes(payment.status) &&
      payment.expiresAt > new Date() &&
      bookingOpen(payment.event) &&
      !payment.user.disabledAt &&
      !!payment.user.emailVerifiedAt &&
      (!prior || prior.status === "CANCELLED");
    const ledger = await tx.transaction.create({
      data: {
        type: "INCOME",
        category: "TICKET",
        amountCents: payment.amountCents,
        currency: "INR",
        status: "test",
        memberId: payment.user.memberId,
        description: `${payment.event.name} — Razorpay TEST capture ${provider.id}; no real funds`,
      },
    });
    if (!eligible) {
      const review = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "REVIEW",
          providerPaymentId: provider.id,
          capturedAt: new Date(),
          ledgerId: ledger.id,
          issue:
            "Captured after hold expiry, cancellation, account restriction or another booking. No ticket issued. Staff must refund/reconcile.",
        },
      });
      await notify(
        tx,
        payment.userId,
        `payment-review:${payment.id}`,
        "Payment needs staff review",
        "Test capture received, but your seat could not be confirmed. No QR ticket was issued. Contact club staff.",
        `/payments/${payment.id}`,
      );
      await promoteWaitlist(tx, payment.eventId);
      return review;
    }
    const data = {
      eventId: payment.eventId,
      userId: payment.userId,
      memberId: payment.user.memberId,
      attendeeName: payment.user.name,
      attendeeEmail: payment.user.email,
      attendeePhone: payment.attendeePhone,
      type: payment.ticketType,
      priceCents: payment.amountCents,
      currency: "INR",
      paymentMode: "RAZORPAY_TEST",
      status: "PAID" as const,
      code: `SKY-${newToken().slice(0, 20).toUpperCase()}`,
      qrToken: newToken(),
      ledgerId: ledger.id,
      cancelledAt: null,
      checkedInAt: null,
      reminderAt: null,
    };
    const ticket = prior
      ? await tx.ticket.update({ where: { id: prior.id }, data })
      : await tx.ticket.create({ data });
    await tx.waitlistEntry.updateMany({
      where: {
        eventId: payment.eventId,
        userId: payment.userId,
        status: "PAYMENT_PENDING",
      },
      data: { status: "CLAIMED" },
    });
    const confirmed = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "CONFIRMED",
        providerPaymentId: provider.id,
        capturedAt: new Date(),
        ticketId: ticket.id,
        ledgerId: ledger.id,
        issue: null,
      },
    });
    await notify(
      tx,
      payment.userId,
      `payment-confirmed:${payment.id}`,
      "Your test payment and ticket are confirmed",
      `${payment.event.name}: Razorpay Test Mode capture verified. No real money was charged. Your QR ticket is ready.`,
      `/tickets/${ticket.id}`,
    );
    return confirmed;
  });
}

export async function verifyCheckout(
  paymentId: string,
  orderId: string,
  providerPaymentId: string,
  signature: string,
) {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
  });
  if (
    !payment.providerOrderId ||
    payment.providerOrderId !== orderId ||
    !verifyCheckoutSignature(
      payment.providerOrderId,
      providerPaymentId,
      signature,
    )
  )
    throw new Error(
      "Payment verification failed. No ticket was issued. Recheck the payment from My payments.",
    );
  const [provider, order] = await Promise.all([
    fetchPayment(providerPaymentId),
    fetchOrder(payment.providerOrderId),
  ]);
  return finalizeCapture(paymentId, provider, order);
}
export async function reconcilePayment(paymentId: string) {
  testGatewayConfig();
  let payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
  });
  await db.payment.update({
    where: { id: paymentId },
    data: { lastCheckedAt: new Date() },
  });
  if (!payment.providerOrderId && payment.status !== "INIT")
    payment = (await recoverOrder(payment)) || payment;
  if (payment.providerOrderId) {
    const order = await fetchOrder(payment.providerOrderId);
    matchingOrder(order, payment);
    const list = await providerRequest<{ items: ProviderPayment[] }>(
      `orders/${providerId(order.id, "order")}/payments`,
    );
    const paid = list.items.filter(
      (p) => p.status === "captured" || p.status === "refunded",
    );
    if (paid.length > 1)
      throw new Error("Multiple captures require staff review.");
    if (paid[0]) {
      const actual = await fetchPayment(paid[0].id);
      if (
        actual.order_id !== order.id ||
        actual.amount !== payment.amountCents ||
        actual.currency !== payment.currency
      )
        throw new Error("Provider payment does not match checkout.");
      if (
        actual.amount_refunded ||
        actual.status === "refunded" ||
        payment.status === "REFUND_PENDING"
      ) {
        if (!payment.providerPaymentId)
          await eventTransaction(payment.eventId, async (tx) => {
            const current = await tx.payment.findUniqueOrThrow({
              where: { id: payment.id },
            });
            if (current.providerPaymentId) {
              if (current.providerPaymentId !== actual.id)
                throw new Error("Conflicting refunded payment reference.");
              return;
            }
            const ledger = await tx.transaction.create({
              data: {
                type: "INCOME",
                category: "TICKET",
                amountCents: current.amountCents,
                currency: current.currency,
                status: "test",
                description: `${payment.id} — TEST payment already refunded before confirmation`,
              },
            });
            await tx.payment.update({
              where: { id: current.id },
              data: {
                providerPaymentId: actual.id,
                ledgerId: ledger.id,
                capturedAt: new Date(),
                status: "REVIEW",
                issue:
                  "Refund received before ticket confirmation; no ticket issued.",
              },
            });
          });
        await reconcileRefund(payment.id, actual);
      } else await finalizeCapture(payment.id, actual, order);
    }
  }
  await eventTransaction(payment.eventId, (tx) =>
    promoteWaitlist(tx, payment.eventId),
  );
  return db.payment.findUniqueOrThrow({ where: { id: paymentId } });
}
export async function abandonCheckout(paymentId: string, userId: string) {
  const row = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (row.userId !== userId) throw new Error("Checkout not found.");
  return eventTransaction(row.eventId, async (tx) => {
    await tx.payment.updateMany({
      where: { id: paymentId, status: { in: CHECKOUT_HOLD_STATES } },
      data: { expiresAt: new Date(0) },
    });
    await promoteWaitlist(tx, row.eventId);
    return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  });
}

export async function reconcileRefund(
  paymentId: string,
  provided?: ProviderPayment,
) {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
  });
  if (!payment.providerPaymentId)
    throw new Error("No captured payment is linked for refund reconciliation.");
  const provider = provided || (await fetchPayment(payment.providerPaymentId));
  if (
    provider.id !== payment.providerPaymentId ||
    provider.order_id !== payment.providerOrderId ||
    provider.amount !== payment.amountCents ||
    provider.currency !== payment.currency
  )
    throw new Error("Refund payment reference does not match.");
  const list = await providerRequest<{ items: ProviderRefund[] }>(
    `payments/${providerId(provider.id, "pay")}/refunds?count=100`,
  );
  if (list.items.length >= 100)
    throw new Error("Too many refund records. Staff review required.");
  const processed = list.items.filter(
    (r) =>
      r.status === "processed" &&
      r.payment_id === provider.id &&
      r.currency === payment.currency,
  );
  const amount = processed.reduce((n, r) => n + r.amount, 0);
  if (amount > 0 && amount !== payment.amountCents) {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "REVIEW",
        issue:
          "Partial/external refund detected. Staff must reconcile; no full-refund claim made.",
      },
    });
    return;
  }
  if (
    amount !== payment.amountCents ||
    provider.amount_refunded !== payment.amountCents
  )
    return;
  return eventTransaction(payment.eventId, async (tx) => {
    const current = await tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    if (current.status === "REFUNDED") return current;
    if (current.ledgerId)
      await tx.transaction.update({
        where: { id: current.ledgerId },
        data: { status: "void" },
      });
    if (current.ticketId) {
      const ticket = await tx.ticket.findUnique({
        where: { id: current.ticketId },
      });
      // A rebooked ticket can share the old ID; refund only this payment's ledger.
      if (
        ticket?.ledgerId === current.ledgerId &&
        ticket.status !== "CHECKED_IN"
      )
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: "CANCELLED", cancelledAt: new Date(), qrToken: null },
        });
    }
    const refunded = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "REFUNDED",
        refundedAt: new Date(),
        providerRefundId:
          processed.length === 1 ? processed[0].id : current.providerRefundId,
        issue: null,
      },
    });
    await notify(
      tx,
      payment.userId,
      `payment-refunded:${payment.id}`,
      "Test refund confirmed",
      "Razorpay confirmed the full test refund. No real funds were involved.",
      `/payments/${payment.id}`,
    );
    await promoteWaitlist(tx, payment.eventId);
    return refunded;
  });
}
export async function requestFullRefund(paymentId: string) {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
  });
  if (
    !["REFUND_REQUIRED", "REVIEW", "REFUND_PENDING"].includes(payment.status) ||
    !payment.providerPaymentId
  )
    throw new Error(
      "Cancel the ticket first, or review a captured payment without a seat, before requesting a full test refund.",
    );
  if (payment.status === "REFUND_PENDING" && payment.providerRefundId)
    return reconcilePayment(paymentId);
  const actual = await fetchPayment(payment.providerPaymentId);
  if (
    actual.order_id !== payment.providerOrderId ||
    actual.amount !== payment.amountCents ||
    actual.currency !== payment.currency
  )
    throw new Error("Refund amount or order does not match.");
  if (actual.amount_refunded || actual.status === "refunded")
    return reconcileRefund(paymentId, actual);
  if (!actual.captured || actual.status !== "captured")
    throw new Error("Only captured test payments can be refunded.");
  await eventTransaction(payment.eventId, async (tx) => {
    const current = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
    if (
      !["REFUND_REQUIRED", "REVIEW", "REFUND_PENDING"].includes(current.status)
    )
      throw new Error("Refund state changed. Refresh first.");
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "REFUND_PENDING",
        issue: "Refund requested. Awaiting provider confirmation.",
      },
    });
  });
  let refund: ProviderRefund;
  try {
    refund = await providerRequest<ProviderRefund>(
      `payments/${providerId(actual.id, "pay")}/refund`,
      "POST",
      { amount: payment.amountCents, speed: "normal", receipt: payment.id },
      { "X-Refund-Idempotency": `skyline-refund-${payment.id}` },
    );
  } catch (error) {
    if (
      error instanceof ProviderError &&
      error.status >= 400 &&
      error.status < 500 &&
      ![408, 409, 429].includes(error.status)
    ) {
      await db.payment.updateMany({
        where: {
          id: payment.id,
          status: "REFUND_PENDING",
          providerRefundId: null,
        },
        data: {
          status: payment.status === "REVIEW" ? "REVIEW" : "REFUND_REQUIRED",
          issue: `Razorpay rejected the refund request (HTTP ${error.status}). No refund completion was recorded. Review this payment in the Razorpay Test Mode dashboard for the reason, including available test refund balance, then recheck before retrying.`,
        },
      });
    }
    throw error;
  }
  if (
    refund.payment_id !== actual.id ||
    refund.amount !== payment.amountCents ||
    refund.currency !== payment.currency
  )
    throw new Error("Refund response does not match. Staff review required.");
  await db.payment.updateMany({
    where: { id: payment.id, status: "REFUND_PENDING" },
    data: { providerRefundId: refund.id },
  });
  await reconcileRefund(payment.id);
  return db.payment.findUniqueOrThrow({ where: { id: payment.id } });
}

export async function processPaymentUpdates() {
  if (!gatewayReady()) return;
  const rows = await db.payment.findMany({
    where: {
      status: { in: ["CREATING", "PENDING", "REFUND_PENDING", "EXPIRED"] },
      OR: [
        { lastCheckedAt: null },
        { lastCheckedAt: { lt: new Date(Date.now() - 60000) } },
      ],
      expiresAt: { gt: new Date(Date.now() - 24 * 3600000) },
    },
    orderBy: [{ lastCheckedAt: "asc" }, { createdAt: "asc" }],
    take: 25,
  });
  for (const row of rows)
    try {
      await reconcilePayment(row.id);
    } catch (error) {
      await db.payment.update({
        where: { id: row.id },
        data: {
          issue:
            error instanceof ProviderError
              ? error.message
              : "Provider reconciliation could not complete. Use Recheck status or contact staff.",
        },
      });
    }
}

export async function processProviderWebhook(
  eventId: string,
  bodyHash: string,
  payload: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string } };
      order?: { entity?: { id?: string } };
      refund?: { entity?: { payment_id?: string } };
    };
  },
) {
  const type = payload.event || "unknown";
  // Persist the digest first: conflicting replays cannot mutate a second payment.
  const prior = await db.paymentWebhook.upsert({
    where: { id: eventId },
    create: { id: eventId, bodyHash, eventType: type },
    update: {},
  });
  if (prior.bodyHash !== bodyHash)
    throw new Error("Conflicting webhook replay.");
  if (prior.completed) return;
  if (["payment.captured", "order.paid", "refund.processed"].includes(type)) {
    const providerPaymentId =
      payload.payload?.payment?.entity?.id ||
      payload.payload?.refund?.entity?.payment_id;
    const actual = providerPaymentId
      ? await fetchPayment(providerPaymentId)
      : null;
    const orderId = actual?.order_id || payload.payload?.order?.entity?.id;
    if (!orderId) throw new Error("Webhook lacks a payment/order reference.");
    const order = await fetchOrder(orderId);
    const payment = await db.payment.findFirst({
      where: { OR: [{ providerOrderId: order.id }, { id: order.receipt }] },
    });
    // Signed events from unrelated test orders are acknowledged, not imported.
    if (payment) {
      if (!payment.providerOrderId) await attachOrder(payment.id, order);
      await reconcilePayment(payment.id);
    }
  }
  await db.paymentWebhook.update({
    where: { id: eventId },
    data: { completed: true, processedAt: new Date() },
  });
}
