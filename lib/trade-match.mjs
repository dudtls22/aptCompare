const UPSTREAM_TRADE =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";

export function normalizeDongName(name) {
  return String(name || "").replaceAll(" ", "").trim();
}

function toDongKey(name) {
  return normalizeDongName(name).replace(/\d+동$/u, "동");
}

export function isSameDong(itemDongName, selectedDongName) {
  const itemKey = toDongKey(itemDongName);
  const selectedKey = toDongKey(selectedDongName);
  return Boolean(itemKey) && Boolean(selectedKey) && itemKey === selectedKey;
}

function getDongName(item) {
  return String(
    item?.umdNm ?? item?.UMD_NM ?? item?.umd_nm ?? item?.dong ?? item?.DONG ?? item?.법정동 ?? ""
  ).trim();
}

function getAptName(item) {
  return String(item?.aptNm || item?.apartment || item?.아파트 || "").trim();
}

function getAreaValue(item) {
  const raw = item?.excluUseAr || item?.exclusiveArea || item?.전용면적;
  const n = Number.parseFloat(String(raw ?? "").replaceAll(",", "").trim());
  return Number.isFinite(n) ? n : null;
}

function getAreaFloorValue(item) {
  const area = getAreaValue(item);
  return area == null ? null : Math.floor(area);
}

function itemDealDateString(item) {
  const y = String(item?.dealYear || "").trim();
  const m = String(item?.dealMonth || "").trim().padStart(2, "0");
  const d = String(item?.dealDay || "").trim().padStart(2, "0");
  if (!y || !m || !d) return "";
  return `${y}-${m}-${d}`;
}

function areaMatches(item, savedArea) {
  const want = String(savedArea || "").trim();
  if (!want) return true;
  const itemArea = getAreaValue(item);
  if (itemArea == null) return false;
  const wantNum = Number.parseFloat(want);
  if (Number.isFinite(wantNum) && Math.abs(itemArea - wantNum) < 0.51) return true;
  const wf = Math.floor(Number.parseFloat(want));
  const itemFloor = getAreaFloorValue(item);
  return Number.isFinite(wf) && itemFloor === wf;
}

export function itemMatchesSubscription(item, sub, todayStr) {
  if (itemDealDateString(item) !== todayStr) return false;
  const apt = String(sub?.apt || "").trim();
  if (!apt) return false;
  const itemApt = getAptName(item);
  if (itemApt !== apt && normalizeDongName(itemApt) !== normalizeDongName(apt)) return false;
  const dong = String(sub?.dong || "").trim();
  if (dong && !isSameDong(getDongName(item), dong)) return false;
  return areaMatches(item, sub?.area);
}

export async function fetchMonthTrades(lawdCd, ymParam) {
  const serviceKey = (process.env.DATA_GO_KR_SERVICE_KEY || "").trim();
  if (!serviceKey) {
    throw new Error("DATA_GO_KR_SERVICE_KEY 가 설정되지 않았습니다.");
  }
  const params = new URLSearchParams({
    serviceKey,
    LAWD_CD: lawdCd,
    DEAL_YMD: ymParam,
    pageNo: "1",
    numOfRows: "1000",
    _type: "json"
  });
  const res = await fetch(`${UPSTREAM_TRADE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`실거래 API HTTP ${res.status}`);
  }
  const data = await res.json();
  const header = data?.response?.header;
  const resultCode = String(header?.resultCode ?? "");
  const isSuccess = resultCode === "00" || resultCode === "000";
  if (!isSuccess) {
    throw new Error(header?.resultMsg || `실거래 API 오류 (${resultCode})`);
  }
  const items = data?.response?.body?.items?.item || [];
  return Array.isArray(items) ? items : items ? [items] : [];
}

export function formatDealLine(item) {
  const amount = Number(String(item?.dealAmount ?? "").replaceAll(",", "").trim());
  const priceText = Number.isFinite(amount) ? `${amount.toLocaleString("ko-KR")}만원` : "-";
  const floor = String(item?.floor || item?.층 || "").trim();
  const floorText = floor ? ` ${floor}층` : "";
  return `${priceText}${floorText}`;
}
