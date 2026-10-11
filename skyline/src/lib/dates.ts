export const clubTimeZone =
  process.env.NEXT_PUBLIC_CLUB_TIME_ZONE || "Asia/Kolkata";
export function clubDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: clubTimeZone,
  }).format(new Date(value));
}
export function clubDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: clubTimeZone,
    timeZoneName: "short",
  }).format(new Date(value));
}
export function clubDatePart(value: Date | string, part: "day" | "month") {
  return new Intl.DateTimeFormat("en-GB", {
    ...(part === "day"
      ? { day: "numeric" as const }
      : { month: "short" as const }),
    timeZone: clubTimeZone,
  }).format(new Date(value));
}
