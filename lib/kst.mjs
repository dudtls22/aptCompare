const TZ = "Asia/Seoul";

export function getKstParts() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute
  };
}

export function getKstDateString() {
  const p = getKstParts();
  return `${p.year}-${p.month}-${p.day}`;
}

export function getKstYmParam() {
  const p = getKstParts();
  return `${p.year}${p.month}`;
}
