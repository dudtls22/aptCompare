import { buildDataGoKrQueryString } from "./data-go-key.mjs";
import {
  isDealCancelled,
  itemDealDateString,
  itemNewlyRegisteredOn
} from "./deal-status.mjs";

const UPSTREAM_TRADE =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";

export { isDealCancelled, itemDealDateString, itemNewlyRegisteredOn } from "./deal-status.mjs";

export function normalizeDongName(name) {
  return String(name || "").replaceAll(" ", "").trim();
}

function dongCoreName(name) {
  const n = normalizeDongName(name);
  if (!n) return "";
  if (n.endsWith("동")) return n.slice(0, -1);
  return n;
}

export function isSameDong(itemDongName, selectedDongName) {
  const a = normalizeDongName(itemDongName);
  const b = normalizeDongName(selectedDongName);
  if (!a || !b) return false;
  if (a === b) return true;
  const aCore = dongCoreName(a);
  const bCore = dongCoreName(b);
  return Boolean(aCore) && aCore === bCore;
}

export function getDongName(item) {
  return String(
    item?.umdNm ?? item?.UMD_NM ?? item?.umd_nm ?? item?.dong ?? item?.DONG ?? item?.법정동 ?? ""
  ).trim();
}

export function getAptName(item) {
  return String(item?.aptNm || item?.apartment || item?.아파트 || "").trim();
}

function getAreaValue(item) {
  const raw = item?.excluUseAr || item?.exclusiveArea || item?.전용면적;
  const n = Number.parseFloat(String(raw ?? "").replaceAll(",", "").trim());
  return Number.isFinite(n) ? n : null;
}

export function getAreaFloorValue(item) {
  const area = getAreaValue(item);
  return area == null ? null : Math.floor(area);
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

/** 즐겨찾기 알림: 오늘 API 등록된 건(rgstDate) + 동/아파트/평형 일치, 취소 건 제외 */
export function itemMatchesSubscription(item, sub, todayStr) {
  if (!itemNewlyRegisteredOn(item, todayStr)) return false;
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
    LAWD_CD: lawdCd,
    DEAL_YMD: ymParam,
    pageNo: "1",
    numOfRows: "1000",
    _type: "json"
  });
  const query = buildDataGoKrQueryString(params, serviceKey);
  const res = await fetch(`${UPSTREAM_TRADE}?${query}`);
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
  const prefix = isDealCancelled(item) ? "[취소] " : "";
  return `${prefix}${priceText}${floorText}`;
}
