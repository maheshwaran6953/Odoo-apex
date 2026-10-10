"use server";
import { db } from "@/lib/db";
import { requireUser, requireRole } from "@/server/auth";
import {
  abandonCheckout,
  createCheckoutOrder,
  reconcilePayment,
  requestFullRefund,
  reserveCheckout,
  verifyCheckout,
} from "@/server/payments-service";
import { testGatewayConfig } from "@/server/razorpay";
import { bookingOpen } from "@/server/events-service";
import { Prisma } from "@prisma/client";
function failure(error: unknown) {
  return {
    ok: false,
    message:
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientInitializationError
        ? "Payment service is temporarily unavailable. Recheck status before retrying checkout."
        : error instanceof Error
          ? error.message
          : "Payment status could not be checked. Recheck before retrying checkout.",
  };
}
async function ownedPayment(id: string, staff = true) {
  const user = await requireUser();
  const payment = await db.payment.findUnique({ where: { id } });
  if (
    !payment ||
    (payment.userId !== user.id &&
      !(staff && ["STAFF", "TREASURER"].includes(user.role)))
  )
    throw new Error("Payment not found.");
  return { user, payment };
}
export async function startEventCheckout(data: FormData) {
  const user = await requireUser();
  const eventId = String(data.get("eventId") || "");
  const phone = String(data.get("phone") || "").trim();
  if (phone.length > 30 || (phone && !/^[+\d\s().-]+$/.test(phone)))
    return { ok: false, message: "Enter a valid optional phone number." };
  try {
    const payment = await reserveCheckout(eventId, user.id, phone);
    await createCheckoutOrder(payment.id);
    return {
      ok: true,
      message:
        "Checkout created. Open it to complete your test payment; no ticket has been issued yet.",
      href: `/payments/${payment.id}`,
      linkLabel: "Open test checkout",
    };
  } catch (error) {
    return failure(error);
  }
}
export async function checkoutOptions(id: string) {
  try {
    const { user, payment } = await ownedPayment(id, false);
    const event = await db.event.findUniqueOrThrow({
      where: { id: payment.eventId },
    });
    if (
      user.disabledAt ||
      !user.emailVerifiedAt ||
      !bookingOpen(event) ||
      event.paymentMode !== "RAZORPAY_TEST" ||
      payment.currency !== "INR" ||
      payment.status !== "PENDING" ||
      payment.expiresAt <= new Date() ||
      !payment.providerOrderId
    )
      throw new Error(
        "This checkout is no longer available. Recheck payment status before retrying.",
      );
    return {
      ok: true as const,
      options: {
        key: testGatewayConfig().keyId,
        order_id: payment.providerOrderId,
        amount: payment.amountCents,
        currency: payment.currency,
        name: "Skyline Student Association",
        description: `${event.name} — TEST payment`,
      },
    };
  } catch (error) {
    return { ...failure(error), options: null };
  }
}
export async function confirmEventPayment(data: FormData) {
  try {
    const id = String(data.get("paymentId") || "");
    await ownedPayment(id, false);
    const payment = await verifyCheckout(
      id,
      String(data.get("orderId") || ""),
      String(data.get("providerPaymentId") || ""),
      String(data.get("signature") || ""),
    );
    return {
      ok: true,
      message:
        payment.status === "CONFIRMED"
          ? "Test capture verified. Your QR ticket is ready."
          : "Payment requires staff review. No new QR ticket was issued.",
      href:
        payment.status === "CONFIRMED" && payment.ticketId
          ? `/tickets/${payment.ticketId}`
          : `/payments/${id}`,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function recheckPayment(data: FormData) {
  try {
    const id = String(data.get("paymentId") || "");
    const { payment: previous } = await ownedPayment(id);
    const claim = await db.payment.updateMany({
      where: {
        id,
        OR: [
          { lastCheckedAt: null },
          { lastCheckedAt: { lt: new Date(Date.now() - 15000) } },
        ],
      },
      data: { lastCheckedAt: new Date() },
    });
    if (!claim.count)
      return {
        ok: false,
        message:
          "Status was checked recently. Wait 15 seconds before checking again.",
      };
    const payment =
      previous.status === "INIT"
        ? await createCheckoutOrder(id)
        : await reconcilePayment(id);
    return {
      ok: true,
      message: `Server checked payment status: ${payment.status.replaceAll("_", " ")}.`,
      ...(payment.status === "CONFIRMED" && payment.ticketId
        ? { href: `/tickets/${payment.ticketId}` }
        : {}),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function releaseCheckout(data: FormData) {
  try {
    const id = String(data.get("paymentId") || "");
    const { user } = await ownedPayment(id, false);
    if (data.get("confirm") !== "on")
      throw new Error(
        "Confirm that you want to release the seat. A late capture will require staff review.",
      );
    const payment = await abandonCheckout(id, user.id);
    return {
      ok: true,
      message: [
        "CONFIRMED",
        "REVIEW",
        "REFUND_REQUIRED",
        "REFUND_PENDING",
        "REFUNDED",
      ].includes(payment.status)
        ? "Payment already received. Use ticket cancellation or contact staff; this action cannot refund it."
        : "Checkout hold released. Recheck any payment you already submitted before starting another checkout.",
    };
  } catch (error) {
    return failure(error);
  }
}
export async function refundTestPayment(data: FormData) {
  await requireRole(["STAFF", "TREASURER"]);
  try {
    if (data.get("confirm") !== "on")
      throw new Error("Confirm the full test refund first.");
    const payment = await requestFullRefund(
      String(data.get("paymentId") || ""),
    );
    return {
      ok: true,
      message:
        payment?.status === "REFUNDED"
          ? "Full test refund confirmed by Razorpay."
          : "Test refund submitted or reconciled. Check its status; completion is not guaranteed yet.",
    };
  } catch (error) {
    return failure(error);
  }
}
