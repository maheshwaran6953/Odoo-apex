"use client";
import { useEffect, useState } from "react";
export function LocalDateInput({
  name,
  iso,
  required = false,
}: {
  name: string;
  iso?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState("");
  useEffect(() => {
    if (iso) {
      const date = new Date(iso);
      setValue(
        new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16),
      );
    }
  }, [iso]);
  const parsed = value ? new Date(value) : null;
  const submitted =
    parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
  return (
    <>
      <input type="hidden" name={name} value={submitted} />
      <input
        className="input"
        type="datetime-local"
        required={required}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </>
  );
}
