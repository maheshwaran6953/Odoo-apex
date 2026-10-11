"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useClubFeedback } from "./feedback";
import Link from "next/link";

type Result = {
  ok: boolean;
  message: string;
  code?: string;
  href?: string;
  linkLabel?: string;
};
type Props = {
  action: (data: FormData) => Promise<Result>;
  children: React.ReactNode;
  className?: string;
};

export function ActionForm({ action, children, className = "" }: Props) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const router = useRouter();
  const notify = useClubFeedback();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || pending) return;
    const data = new FormData(event.currentTarget);
    // Omit browser placeholders for unselected optional file inputs before
    // multipart serialization. Named empty files remain for server validation.
    for (const name of Array.from(new Set(data.keys()))) {
      const values = data.getAll(name);
      const selected = values.filter(
        (value) =>
          typeof value === "string" || value.name !== "" || value.size > 0,
      );
      if (selected.length === values.length) continue;
      data.delete(name);
      for (const value of selected) data.append(name, value);
    }
    // datetime-local values have no timezone; convert using the attendee's browser.
    for (const field of ["startsAt", "registrationClosesAt"]) {
      const startsAt = data.get(field);
      if (typeof startsAt === "string" && startsAt) {
        const parsed = new Date(startsAt);
        if (Number.isFinite(parsed.getTime()))
          data.set(field, parsed.toISOString());
      }
    }
    setPending(true);
    setResult(null);
    try {
      const response = await action(data);
      setResult(response);
      if (response.ok) {
        notify(response);
        router.refresh();
      }
    } catch (error) {
      setResult({
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      method="post"
      className={className}
      onSubmit={submit}
      aria-busy={pending}
    >
      <fieldset disabled={!hydrated || pending} className="action-fields">
        {children}
      </fieldset>
      <noscript>
        <p className="form-feedback failure">
          Enable JavaScript to submit this form securely.
        </p>
      </noscript>
      {pending && (
        <p className="form-feedback" role="status">
          <Loader2 size={16} className="animate-spin" />
          Saving your changes…
        </p>
      )}
      {result && (
        <div
          className={`form-feedback ${result.ok ? "success" : "failure"}`}
          role={result.ok ? "status" : "alert"}
        >
          {result.ok ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
          <div>
            {result.message}
            {result.code && (
              <>
                <p className="mt-2 text-xs">
                  Your entry code · save this for the door
                </p>
                <strong className="ticket-code">{result.code}</strong>
              </>
            )}
            {result.href && (
              <Link href={result.href} className="button small mt-3">
                {result.linkLabel || "Open QR ticket"}
              </Link>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
