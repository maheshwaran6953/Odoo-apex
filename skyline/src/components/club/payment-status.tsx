const labels: Record<string, string> = {
  INIT: "Preparing checkout",
  CREATING: "Creating order",
  PENDING: "Awaiting test payment",
  CONFIRMED: "Test payment confirmed",
  FAILED: "Checkout failed",
  EXPIRED: "Seat hold expired",
  REVIEW: "Staff review needed",
  REFUND_REQUIRED: "Test refund required",
  REFUND_PENDING: "Test refund processing",
  REFUNDED: "Test refund confirmed",
};
export function PaymentStatus({ status }: { status: string }) {
  return (
    <span
      className={`badge ${["CONFIRMED", "REFUNDED"].includes(status) ? "active" : ["FAILED", "EXPIRED", "REVIEW"].includes(status) ? "danger" : "pending"}`}
    >
      {labels[status] || status}
    </span>
  );
}
