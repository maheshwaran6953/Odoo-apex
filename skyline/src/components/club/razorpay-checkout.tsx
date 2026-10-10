"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkoutOptions,
  confirmEventPayment,
} from "@/server/actions/payments";
type Callback = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};
type Checkout = {
  open: () => void;
  on: (event: string, handler: () => void) => void;
};
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => Checkout;
  }
}
let scriptPromise: Promise<void> | undefined;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise)
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      const timeout = window.setTimeout(() => {
        script.remove();
        scriptPromise = undefined;
        reject(
          new Error(
            "Checkout took too long to load. Your payment status is unchanged.",
          ),
        );
      }, 15000);
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        scriptPromise = undefined;
        reject(
          new Error(
            "Checkout could not load. Check your connection and retry.",
          ),
        );
      };
      document.head.appendChild(script);
    });
  return scriptPromise;
}
export function RazorpayCheckout({
  paymentId,
  expiresAt,
  available,
}: {
  paymentId: string;
  expiresAt: string;
  available: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - now) / 1000),
  );
  async function open() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    let callbackReceived = false;
    try {
      const result = await checkoutOptions(paymentId);
      if (!result.ok || !result.options)
        throw new Error(
          "message" in result ? result.message : "Checkout unavailable.",
        );
      await loadCheckout();
      if (!window.Razorpay)
        throw new Error(
          "Checkout did not initialize. Recheck status before retrying.",
        );
      const instance = new window.Razorpay({
        ...result.options,
        theme: { color: "#28513f" },
        modal: {
          ondismiss: () => {
            if (!callbackReceived) {
              setBusy(false);
              setMessage(
                "Checkout closed. Your hold remains until its deadline. Recheck status if you submitted a payment.",
              );
              router.refresh();
            }
          },
        },
        handler: async (response: Callback) => {
          callbackReceived = true;
          setMessage("Verifying captured payment on the server…");
          try {
            const data = new FormData();
            data.set("paymentId", paymentId);
            data.set("orderId", response.razorpay_order_id);
            data.set("providerPaymentId", response.razorpay_payment_id);
            data.set("signature", response.razorpay_signature);
            const confirmed = await confirmEventPayment(data);
            setMessage(confirmed.message);
            if (
              confirmed.ok &&
              "href" in confirmed &&
              confirmed.href.startsWith("/tickets/")
            )
              router.push(confirmed.href);
            else router.refresh();
          } catch {
            setMessage(
              "Verification response was lost. Recheck status before paying again.",
            );
          } finally {
            setBusy(false);
          }
        },
      });
      instance.on("payment.failed", () => {
        setMessage(
          "That test payment attempt failed. You may retry within the seat-hold period, or close checkout and recheck its status.",
        );
      });
      instance.open();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Checkout unavailable. Recheck status.",
      );
      setBusy(false);
      router.refresh();
    }
  }
  return (
    <div>
      <p className="subtext mb-4" role="timer">
        {seconds
          ? `Seat hold: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} remaining`
          : "Seat hold expired. Recheck status; do not submit another payment for this attempt."}
      </p>
      <button
        className="button w-full"
        disabled={busy || !available || !seconds}
        onClick={open}
      >
        {busy ? "Checkout in progress…" : "Pay with Razorpay · TEST"}
      </button>
      {message && (
        <p className="form-feedback mt-4" role="status">
          {message}
        </p>
      )}
      <p className="subtext mt-3">
        No real money is charged. A QR ticket appears only after server
        verification of a captured test payment.
      </p>
    </div>
  );
}
