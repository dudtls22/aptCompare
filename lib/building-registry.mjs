import { buildDataGoKrQueryString } from "./data-go-key.mjs";

/** 건축물대장 총괄표제부 — 단지 전체 세대수(hhldCnt) */
const RECAP_URL =
  "https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo";

const brCache = new Map();

function parseItems(data) {
  const body = data?.response?.body;
  const raw = body?.item ?? body?.items?.item;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function isApiSuccess(header) {
  const code = String(header?.resultCode ?? "");
  return code === "00" || code === "000";
}

function pad4(v) {
  const digits = String(v ?? "")
    .replace(/\D/g, "")
    .trim();
  if (!digits) return "";
  return digits.padStart(4, "0").slice(-4);
}

/**
 * @param {{ sigunguCd?: string, bjdongCd?: string, platGbCd?: string, bun?: string, ji?: string }} parcel
 */
export function normalizeParcel(parcel) {
  const sigunguCd = String(parcel?.sigunguCd ?? "").trim().slice(0, 5);
  const bjdongCd = String(parcel?.bjdongCd ?? "")
    .trim()
    .padStart(5, "0")
    .slice(0, 5);
  const bun = pad4(parcel?.bun);
  const ji = pad4(parcel?.ji ?? "0") || "0000";
  if (sigunguCd.length !== 5 || bjdongCd.length !== 5 || !bun) return null;

  const plat = String(parcel?.platGbCd ?? "0").trim();
  const platGbCd = plat === "1" ? "1" : "0";

  return { sigunguCd, bjdongCd, platGbCd, bun, ji };
}

function pickHouseholdFromBuildingItem(item) {
  if (!item) return null;
  const raw =
    item.hhldCnt ??
    item.HHLD_CNT ??
    item.totHhldCnt ??
    item.TOT_HHLD_CNT ??
    item.householdCnt;
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replaceAll(",", "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pickUseDateFromBuildingItem(item) {
  const raw = String(
    item?.useAprDay ?? item?.USE_APR_DAY ?? item?.useConfmDe ?? item?.pmsDay ?? ""
  ).trim();
  return /^\d{8}$/.test(raw) ? raw : "";
}

function toEnrichmentRow(item) {
  const hh = pickHouseholdFromBuildingItem(item);
  if (hh == null) return null;
  return {
    hhldCnt: hh,
    totHhldCnt: hh,
    kaptdaCnt: hh,
    kaptUsedate: pickUseDateFromBuildingItem(item),
    useAprDay: pickUseDateFromBuildingItem(item),
    kaptName: String(item?.bldNm ?? item?.BLD_NM ?? item?.dongNm ?? "").trim(),
    platPlc: String(item?.platPlc ?? item?.PLAT_PLC ?? "").trim(),
    dongNm: String(item?.dongNm ?? item?.DONG_NM ?? "").trim(),
    _source: "building-recap"
  };
}

function jiCandidates(ji) {
  const j = pad4(ji) || "0000";
  const out = [];
  const add = (v) => {
    if (v && !out.includes(v)) out.push(v);
  };
  add("0000");
  add(j);
  return out;
}

async function fetchRecapForParcel(base, platGbCd, ji, serviceKey) {
  const query = buildDataGoKrQueryString(
    new URLSearchParams({
      sigunguCd: base.sigunguCd,
      bjdongCd: base.bjdongCd,
      platGbCd,
      bun: base.bun,
      ji,
      numOfRows: "10",
      pageNo: "1",
      _type: "json"
    }),
    serviceKey
  );
  const res = await fetch(`${RECAP_URL}?${query}`, {
    headers: { Accept: "application/json", Referer: "https://www.data.go.kr/" }
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.httpStatus = res.status;
    throw err;
  }
  const data = JSON.parse(text);
  const header = data?.response?.header;
  if (!isApiSuccess(header)) {
    throw new Error(`${header?.resultMsg || "API 오류"} (${header?.resultCode})`);
  }
  return parseItems(data);
}

/**
 * @param {{ sigunguCd?: string, bjdongCd?: string, platGbCd?: string, bun?: string, ji?: string }} parcel
 */
export async function fetchHouseholdFromBuildingRegistry(parcel, serviceKey) {
  const norm = normalizeParcel(parcel);
  if (!norm) return { row: null, errors: ["건축물대장: 지번(시군구·법정동·본번) 정보 없음"] };

  const cacheKey = `${norm.sigunguCd}:${norm.bjdongCd}:${norm.bun}`;
  if (brCache.has(cacheKey)) return { row: brCache.get(cacheKey), errors: [] };

  const errors = [];
  const platCandidates = norm.platGbCd === "0" ? ["0", "1"] : [norm.platGbCd, "0"];
  let bestRow = null;

  for (const platGbCd of platCandidates) {
    for (const ji of jiCandidates(norm.ji)) {
      try {
        const items = await fetchRecapForParcel(norm, platGbCd, ji, serviceKey);
        for (const item of items) {
          const row = toEnrichmentRow(item);
          if (!row) continue;
          if (!bestRow || row.hhldCnt > bestRow.hhldCnt) bestRow = row;
        }
      } catch (err) {
        const msg =
          err.httpStatus === 403
            ? `getBrRecapTitleInfo: 인증키 미승인(403) — '건축HUB 건축물대장' 활용신청·인증키 연결 확인`
            : `getBrRecapTitleInfo(ji=${ji}): ${err.message}`;
        errors.push(msg);
      }
    }
    if (bestRow) break;
  }

  if (bestRow) {
    brCache.set(cacheKey, bestRow);
    return { row: bestRow, errors: [] };
  }

  return { row: null, errors: [...new Set(errors)] };
}
