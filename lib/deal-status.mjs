/** 공공데이터 아파트 실거래 — 해제(취소) · 등록일 판별 */

export function itemDealDateString(item) {
  const y = String(item?.dealYear ?? item?.DEAL_YEAR ?? "").trim();
  const m = String(item?.dealMonth ?? item?.DEAL_MONTH ?? "").trim().padStart(2, "0");
  const d = String(item?.dealDay ?? item?.DEAL_DAY ?? "").trim().padStart(2, "0");
  if (!y || !m || !d) return "";
  return `${y}-${m}-${d}`;
}

export function itemRgstDateString(item) {
  const raw = String(item?.rgstDate ?? item?.RGST_DATE ?? item?.등록일 ?? "").trim();
  if (!raw || raw === "-" || raw === "0") return "";

  const dot = raw.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (dot) {
    return `20${dot[1]}-${dot[2]}-${dot[3]}`;
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }

  return "";
}

export function isDealCancelled(item) {
  const cdealDay = String(item?.cdealDay ?? item?.CDEAL_DAY ?? "").trim();
  if (cdealDay && cdealDay !== "-" && cdealDay !== "0" && cdealDay !== "00") {
    return true;
  }

  const cdealType = String(item?.cdealType ?? item?.CDEAL_TYPE ?? "").trim();
  if (cdealType && cdealType !== "-" && cdealType !== "0") {
    return true;
  }

  const gbn = String(item?.dealingGbn ?? item?.DEALING_GBN ?? "").trim();
  if (/취소|해제/.test(gbn)) {
    return true;
  }

  return false;
}

/** API에 새로 올라온 날(등록일) 기준 — 없으면 계약일 */
export function itemNewlyRegisteredOn(item, dateStr) {
  const rgst = itemRgstDateString(item);
  if (rgst) {
    return rgst === dateStr;
  }
  return itemDealDateString(item) === dateStr;
}

export function formatDealStatusLabel(item) {
  return isDealCancelled(item) ? "취소" : "";
}
