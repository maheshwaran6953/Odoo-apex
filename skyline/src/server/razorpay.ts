import { createHmac, timingSafeEqual } from "node:crypto";

export type ProviderOrder = {
  id: string;
  receipt: string;
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, string>;
};
export type ProviderPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
  amount_refunded?: number;
};
export type ProviderRefund = {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
};
export class ProviderError extends Error {
  constructor(public status: number) {
    super(
      `Razorpay returned HTTP ${status}. Recheck the payment before retrying.`,
    );
  }
}
export function testGatewayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !secret)
    throw new Error(
      "Razorpay Test Mode is not configured. Ask club staff to add the test keys privately.",
    );
  if (!/^rzp_test_[A-Za-z0-9]+$/.test(keyId))
    throw new Error(
      "Only Razorpay Test Mode keys are allowed. Live payments are disabled.",
    );
  return { keyId, secret };
}
export function gatewayReady() {
  try {
    testGatewayConfig();
    return true;
  } catch {
    return false;
  }
}
export function validHmac(body: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(
    createHmac("sha256", secret).update(body).digest(),
    Buffer.from(signature, "hex"),
  );
}
export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  return validHmac(
    `${orderId}|${paymentId}`,
    signature,
    testGatewayConfig().secret,
  );
}
export function verifyWebhookSignature(body: string, signature: string) {
  testGatewayConfig();
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      "Webhook secret is not configured with at least 32 characters.",
    );
  return validHmac(body, signature, secret);
}
export async function providerRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const { keyId, secret } = testGatewayConfig();
  // The host is fixed; browser input cannot redirect credentials to another service.
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new ProviderError(response.status);
  return response.json() as Promise<T>;
}
export function providerId(value: string, prefix: string) {
  if (!new RegExp(`^${prefix}_[A-Za-z0-9]{1,80}$`).test(value))
    throw new Error("Invalid payment provider reference.");
  return value;
}
export const fetchOrder = (id: string) =>
  providerRequest<ProviderOrder>(`orders/${providerId(id, "order")}`);
export const fetchPayment = (id: string) =>
  providerRequest<ProviderPayment>(`payments/${providerId(id, "pay")}`);
