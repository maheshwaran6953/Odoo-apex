/** Quotes every cell and neutralizes formula-leading values, including padded ones. */
export function csvDocument(rows: readonly (readonly string[])[]): string {
  const cell = (value: string) => {
    const safe = /^(?:\s*[=+@-]|[\t\r\n])/.test(value) ? "'" + value : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
export function csvResponse(
  rows: readonly (readonly string[])[],
  filename: string,
) {
  return new Response(csvDocument(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
