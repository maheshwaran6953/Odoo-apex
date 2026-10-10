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
  return (
    <input
      className="input"
      name={name}
      type="datetime-local"
      required={required}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}
