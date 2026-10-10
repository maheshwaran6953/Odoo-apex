import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";

// Explicit opt-in: writes isolated temporary fixtures, never seeds/resets club data.
// Provider responses are simulated in this process; these are NOT Razorpay payments.
async function main() {
  if (!process.argv.includes("--temporary-fixtures"))
    throw new Error(
      "Pass --temporary-fixtures to permit isolated fixture creation and cleanup.",
    );
  loadEnvConfig(process.cwd());
  const saved = {
    id: process.env.RAZORPAY_KEY_ID,
    secret: process.env.RAZORPAY_KEY_SECRET,
    webhook: process.env.RAZORPAY_WEBHOOK_SECRET,
  };
  process.env.RAZORPAY_KEY_ID = "rzp_test_fixture";
  process.env.RAZORPAY_KEY_SECRET = randomBytes(32).toString("hex");
  process.env.RAZORPAY_WEBHOOK_SECRET = randomBytes(32).toString("hex");
  const { db } = await import("../src/lib/db");
  const service = await import("../src/server/payments-service");
  const events = await import("../src/server/events-service");
  const gateway = await import("../src/server/razorpay");
  const { hashPassword } = await import("../src/lib/password");
  const tag = `payment-check-${randomBytes(8).toString("hex")}`;
  const userIds: string[] = [],
    eventIds: string[] = [],
    webhookIds: string[] = [];
  type Order = import("../src/server/razorpay").ProviderOrder;
  type Payment = import("../src/server/razorpay").ProviderPayment;
  type Refund = import("../src/server/razorpay").ProviderRefund;
  const orders = new Map<string, Order>(),
    payments = new Map<string, Payment>(),
    refunds = new Map<string, Refund>();
  const refundKeys = new Map<string, Refund>();
  let sequence = 0,
    orderPosts = 0,
    loseOrderResponse = false,
    loseRefundResponse = false,
    rejectRefund = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(
      url.origin,
      "https://api.razorpay.com",
      "Unexpected network request blocked",
    );
    const path = url.pathname.replace("/v1/", "");
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    let value: unknown;
    if (path === "orders" && init?.method === "POST") {
      orderPosts++;
      const order: Order = {
        id: `order_fixture${++sequence}`,
        receipt: body.receipt,
        amount: body.amount,
        currency: body.currency,
        status: "created",
      };
      orders.set(order.id, order);
      value = order;
      if (loseOrderResponse) {
        loseOrderResponse = false;
        throw new Error("Simulated lost order response");
      }
    } else if (path === "orders")
      value = {
        items: Array.from(orders.values()).slice(
          Number(url.searchParams.get("skip") || 0),
          Number(url.searchParams.get("skip") || 0) + 100,
        ),
      };
    else if (/^orders\/[^/]+\/payments$/.test(path))
      value = {
        items: Array.from(payments.values()).filter(
          (p) => p.order_id === path.split("/")[1],
        ),
      };
    else if (/^orders\/[^/]+$/.test(path))
      value = orders.get(path.split("/")[1]);
    else if (
      /^payments\/[^/]+\/refund$/.test(path) &&
      init?.method === "POST"
    ) {
      if (rejectRefund) {
        rejectRefund = false;
        return new Response("{}", { status: 400 });
      }
      const id = path.split("/")[1];
      const key = new Headers(init.headers).get("X-Refund-Idempotency")!;
      assert.ok(key.startsWith("skyline-refund-"));
      let refund = refundKeys.get(key);
      if (!refund) {
        refund = {
          id: `rfnd_fixture${++sequence}`,
          payment_id: id,
          amount: body.amount,
          currency: "INR",
          status: "processed",
        };
        refunds.set(refund.id, refund);
        refundKeys.set(key, refund);
        Object.assign(payments.get(id)!, {
          status: "refunded",
          amount_refunded: body.amount,
        });
      }
      value = refund;
      if (loseRefundResponse) {
        loseRefundResponse = false;
        throw new Error("Simulated lost refund response");
      }
    } else if (/^payments\/[^/]+\/refunds$/.test(path))
      value = {
        items: Array.from(refunds.values()).filter(
          (r) => r.payment_id === path.split("/")[1],
        ),
      };
    else if (/^payments\/[^/]+$/.test(path))
      value = payments.get(path.split("/")[1]);
    else throw new Error(`Unexpected provider path ${path}`);
    return new Response(JSON.stringify(value || {}), {
      status: value ? 200 : 404,
      headers: { "Content-Type": "application/json" },
    });
  };
  const pass = (name: string) => console.log(`PASS: ${name}`);
  const newEvent = async (capacity = 1) => {
    const e = await db.event.create({
      data: {
        name: tag,
        description: "Temporary integrity verification; simulated provider",
        startsAt: new Date(Date.now() + 86400000),
        location: "Fixture only",
        capacity,
        memberPriceCents: 15000,
        nonMemberPriceCents: 20000,
        currency: "INR",
        paymentMode: "RAZORPAY_TEST",
      },
    });
    eventIds.push(e.id);
    return e;
  };
  const capture = (orderId: string, status = "captured") => {
    const order = orders.get(orderId)!;
    const p: Payment = {
      id: `pay_fixture${++sequence}`,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      status,
      captured: status === "captured",
      amount_refunded: 0,
    };
    if (p.captured) order.status = "paid";
    payments.set(p.id, p);
    return p;
  };
  const signature = (orderId: string, paymentId: string) =>
    createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
  try {
    for (let i = 0; i < 3; i++) {
      const u = await db.user.create({
        data: {
          name: "Payment verification fixture",
          email: `${tag}-${i}@example.test`,
          passwordHash: hashPassword(randomBytes(24).toString("hex")),
          emailVerifiedAt: new Date(),
          emailReminders: false,
        },
      });
      userIds.push(u.id);
    }
    const e = await newEvent();
    const concurrent = await Promise.allSettled(
      userIds.slice(0, 2).map((id) => service.reserveCheckout(e.id, id)),
    );
    assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
    const winning = concurrent.find(
      (r) => r.status === "fulfilled",
    ) as PromiseFulfilledResult<
      Awaited<ReturnType<typeof service.reserveCheckout>>
    >;
    let hold = winning.value;
    assert.equal(
      (await service.reserveCheckout(e.id, hold.userId)).id,
      hold.id,
    );
    await assert.rejects(
      events.eventTransaction(e.id, (tx) =>
        events.registerAttendee(tx, e.id, userIds[2]),
      ),
      /cannot bypass payment/,
    );
    pass(
      "Concurrent last-seat checkout, active-attempt reuse and practice bypass rejection",
    );
    await Promise.all([
      service.createCheckoutOrder(hold.id),
      service.createCheckoutOrder(hold.id),
    ]);
    assert.equal(orderPosts, 1);
    hold = await db.payment.findUniqueOrThrow({ where: { id: hold.id } });
    assert.ok(hold.providerOrderId);
    const paid = capture(hold.providerOrderId);
    await assert.rejects(
      service.verifyCheckout(
        hold.id,
        hold.providerOrderId,
        paid.id,
        "0".repeat(64),
      ),
    );
    paid.amount++;
    await assert.rejects(
      service.verifyCheckout(
        hold.id,
        hold.providerOrderId,
        paid.id,
        signature(hold.providerOrderId, paid.id),
      ),
    );
    paid.amount--;
    paid.currency = "USD";
    await assert.rejects(
      service.verifyCheckout(
        hold.id,
        hold.providerOrderId,
        paid.id,
        signature(hold.providerOrderId, paid.id),
      ),
    );
    paid.currency = "INR";
    paid.status = "authorized";
    paid.captured = false;
    await assert.rejects(
      service.verifyCheckout(
        hold.id,
        hold.providerOrderId,
        paid.id,
        signature(hold.providerOrderId, paid.id),
      ),
    );
    assert.equal(await db.ticket.count({ where: { eventId: e.id } }), 0);
    pass(
      "Forged signature, wrong amount/currency and authorization without capture issue no ticket",
    );
    paid.status = "captured";
    paid.captured = true;
    paid.order_id = "order_wrongfixture";
    await assert.rejects(
      service.verifyCheckout(
        hold.id,
        hold.providerOrderId,
        paid.id,
        signature(hold.providerOrderId, paid.id),
      ),
    );
    paid.order_id = hold.providerOrderId;
    await db.event.update({
      where: { id: e.id },
      data: { nonMemberPriceCents: 25000 },
    });
    const hookId = `${tag}-captured`;
    webhookIds.push(hookId);
    await Promise.all([
      service.verifyCheckout(
        hold.id,
        hold.providerOrderId,
        paid.id,
        signature(hold.providerOrderId, paid.id),
      ),
      service.processProviderWebhook(hookId, "digest-one", {
        event: "payment.captured",
        payload: { payment: { entity: { id: paid.id } } },
      }),
    ]);
    const confirmed = await db.payment.findUniqueOrThrow({
      where: { id: hold.id },
      include: { ticket: true },
    });
    assert.equal(confirmed.status, "CONFIRMED");
    assert.ok(confirmed.ticket?.qrToken);
    assert.equal(confirmed.amountCents, 20000);
    assert.equal(confirmed.ticket?.priceCents, 20000);
    assert.equal(await db.ticket.count({ where: { eventId: e.id } }), 1);
    assert.equal(
      await db.notification.count({
        where: { key: `payment-confirmed:${hold.id}` },
      }),
      1,
    );
    assert.equal(
      (
        await db.transaction.findUniqueOrThrow({
          where: { id: confirmed.ledgerId! },
        })
      ).status,
      "test",
    );
    await service.processProviderWebhook(hookId, "digest-one", {
      event: "payment.captured",
    });
    await assert.rejects(
      service.processProviderWebhook(hookId, "different-digest", {
        event: "order.paid",
      }),
    );
    pass(
      "Concurrent callback/webhook create one QR ticket, test ledger and notification; conflicting replay rejected",
    );
    // Model cancellation atomically; authentication/server-action checks are separate browser checks.
    await events.eventTransaction(e.id, async (tx) => {
      await tx.ticket.update({
        where: { id: confirmed.ticketId! },
        data: { status: "CANCELLED", qrToken: null, cancelledAt: new Date() },
      });
      await tx.payment.update({
        where: { id: hold.id },
        data: { status: "REFUND_REQUIRED" },
      });
    });
    rejectRefund = true;
    await assert.rejects(service.requestFullRefund(hold.id));
    assert.equal(
      (await db.payment.findUniqueOrThrow({ where: { id: hold.id } })).status,
      "REFUND_REQUIRED",
    );
    assert.equal(refundKeys.size, 0);
    pass(
      "Definitively rejected refund remains required, not falsely pending or completed",
    );
    loseRefundResponse = true;
    await assert.rejects(service.requestFullRefund(hold.id));
    assert.equal(
      (await db.payment.findUniqueOrThrow({ where: { id: hold.id } })).status,
      "REFUND_PENDING",
    );
    await service.requestFullRefund(hold.id);
    assert.equal(refundKeys.size, 1);
    assert.equal(
      (await db.payment.findUniqueOrThrow({ where: { id: hold.id } })).status,
      "REFUNDED",
    );
    assert.equal(
      (
        await db.transaction.findUniqueOrThrow({
          where: { id: confirmed.ledgerId! },
        })
      ).status,
      "void",
    );
    pass(
      "Lost refund response recovers without a second refund; ledger voided only after processed confirmation",
    );
    const lateEvent = await newEvent();
    const late = await service.reserveCheckout(lateEvent.id, userIds[0]);
    loseOrderResponse = true;
    const ambiguous = await service.createCheckoutOrder(late.id);
    assert.equal(ambiguous.status, "CREATING");
    const before = orderPosts;
    await service.createCheckoutOrder(late.id);
    assert.equal(orderPosts, before);
    const recovered = await service.reconcilePayment(late.id);
    assert.ok(recovered.providerOrderId);
    await db.payment.update({
      where: { id: late.id },
      data: { expiresAt: new Date(0) },
    });
    const entry = await db.waitlistEntry.create({
      data: { eventId: lateEvent.id, userId: userIds[1] },
    });
    await events.eventTransaction(lateEvent.id, (tx) =>
      events.promoteWaitlist(tx, lateEvent.id),
    );
    assert.equal(
      (await db.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } }))
        .status,
      "OFFERED",
    );
    capture(recovered.providerOrderId!);
    const review = await service.reconcilePayment(late.id);
    assert.equal(review.status, "REVIEW");
    assert.equal(review.ticketId, null);
    const offerCheckout = await service.reserveCheckout(
      lateEvent.id,
      userIds[1],
    );
    assert.equal(
      (await db.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } }))
        .status,
      "PAYMENT_PENDING",
    );
    await assert.rejects(service.reserveCheckout(lateEvent.id, userIds[2]));
    await assert.rejects(service.abandonCheckout(offerCheckout.id, userIds[2]));
    await service.abandonCheckout(offerCheckout.id, userIds[1]);
    assert.equal(
      (await db.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } }))
        .status,
      "OFFERED",
    );
    pass(
      "Ambiguous order recovery, expiry/FIFO offer, late-capture review, offer transfer/restoration and hold ownership",
    );
    const lostEvent = await newEvent();
    const lost = await service.reserveCheckout(lostEvent.id, userIds[0]);
    const lostOrder = await service.createCheckoutOrder(lost.id);
    capture(lostOrder.providerOrderId!);
    assert.equal((await service.reconcilePayment(lost.id)).status, "CONFIRMED");
    pass(
      "Lost checkout callback recovered by authoritative provider reconciliation",
    );
    const refundedEvent = await newEvent();
    const refundedHold = await service.reserveCheckout(
      refundedEvent.id,
      userIds[0],
    );
    const refundedOrder = await service.createCheckoutOrder(refundedHold.id);
    const external = capture(refundedOrder.providerOrderId!);
    external.status = "refunded";
    external.amount_refunded = external.amount;
    refunds.set("rfnd_externalfixture", {
      id: "rfnd_externalfixture",
      payment_id: external.id,
      amount: external.amount,
      currency: external.currency,
      status: "processed",
    });
    const refunded = await service.reconcilePayment(refundedHold.id);
    assert.equal(refunded.status, "REFUNDED");
    assert.equal(refunded.ticketId, null);
    assert.equal(
      await db.ticket.count({ where: { eventId: refundedEvent.id } }),
      0,
    );
    pass(
      "External full refund before callback records and voids evidence without issuing a QR",
    );
    const disabledEvent = await newEvent();
    await db.user.update({
      where: { id: userIds[2] },
      data: { disabledAt: new Date() },
    });
    await assert.rejects(
      service.reserveCheckout(disabledEvent.id, userIds[2]),
      /Verified identity/,
    );
    await db.user.update({
      where: { id: userIds[2] },
      data: { disabledAt: null, emailVerifiedAt: null },
    });
    await assert.rejects(
      service.reserveCheckout(disabledEvent.id, userIds[2]),
      /Verified identity/,
    );
    pass("Disabled and unverified accounts cannot reserve payment seats");
    process.env.RAZORPAY_KEY_ID = "rzp_live_fixture";
    assert.throws(gateway.testGatewayConfig);
    process.env.RAZORPAY_KEY_ID = "rzp_test_fixture";
    assert.equal(
      gateway.verifyWebhookSignature("original", "0".repeat(64)),
      false,
    );
    const signed = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update("original")
      .digest("hex");
    assert.equal(gateway.verifyWebhookSignature("original", signed), true);
    assert.equal(gateway.verifyWebhookSignature("tampered", signed), false);
    pass(
      "Live credentials blocked; raw-body webhook signature and tamper rejection",
    );
  } finally {
    globalThis.fetch = originalFetch;
    const fixturePayments = await db.payment.findMany({
      where: { eventId: { in: eventIds } },
      select: { ledgerId: true },
    });
    const ledgers = fixturePayments.flatMap((p) =>
      p.ledgerId ? [p.ledgerId] : [],
    );
    await db.$transaction(
      async (tx) => {
        await tx.payment.deleteMany({ where: { eventId: { in: eventIds } } });
        await tx.ticket.deleteMany({ where: { eventId: { in: eventIds } } });
        await tx.waitlistEntry.deleteMany({
          where: { eventId: { in: eventIds } },
        });
        await tx.notification.deleteMany({
          where: { userId: { in: userIds } },
        });
        await tx.emailMessage.deleteMany({
          where: {
            to: { in: userIds.map((_, i) => `${tag}-${i}@example.test`) },
          },
        });
        await tx.transaction.deleteMany({ where: { id: { in: ledgers } } });
        await tx.event.deleteMany({ where: { id: { in: eventIds } } });
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
        await tx.paymentWebhook.deleteMany({
          where: { id: { in: webhookIds } },
        });
      },
      { timeout: 15000 },
    );
    await db.$disconnect();
    for (const [key, value] of Object.entries({
      RAZORPAY_KEY_ID: saved.id,
      RAZORPAY_KEY_SECRET: saved.secret,
      RAZORPAY_WEBHOOK_SECRET: saved.webhook,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    console.log(
      "Temporary fixtures removed. Existing club records were not seeded or reset. Provider was simulated, not Razorpay sandbox.",
    );
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Payment verification failed",
  );
  process.exitCode = 1;
});
