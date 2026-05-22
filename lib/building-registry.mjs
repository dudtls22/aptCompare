import { buildDataGoKrQueryString } from "./data-go-key.mjs";

/** 국토교통부 건축물대장 표제부·총괄표제부 (BldRgstHubService) */
const BR_ENDPOINTS = [
  ["getBrRecapTitleInfo", "https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo"],
  ["getBrTitleInfo", "https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo"]
];

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
    _source: "building"
  };
}

/**
 * @param {{ sigunguCd?: string, bjdongCd?: string, platGbCd?: string, bun?: string, ji?: string }} parcel
 */
export async function fetchHouseholdFromBuildingRegistry(parcel, serviceKey) {
  const norm = normalizeParcel(parcel);
  if (!norm) return { row: null, errors: ["건축물대장: 지번(시군구·법정동·본번) 정보 없음"] };

  const cacheKey = `${norm.sigunguCd}:${norm.bjdongCd}:${norm.platGbCd}:${norm.bun}:${norm.ji}`;
  if (brCache.has(cacheKey)) return { row: brCache.get(cacheKey), errors: [] };

  const errors = [];
  const platCandidates = norm.platGbCd === "0" ? ["0", "1"] : [norm.platGbCd, "0"];

  for (const platGbCd of platCandidates) {
    for (const [label, baseUrl] of BR_ENDPOINTS) {
      try {
        const query = buildDataGoKrQueryString(
          new URLSearchParams({
            sigunguCd: norm.sigunguCd,
            bjdongCd: norm.bjdongCd,
            platGbCd,
            bun: norm.bun,
            ji: norm.ji,
            numOfRows: "5",
            pageNo: "1",
            _type: "json"
          }),
          serviceKey
        );
        const res = await fetch(`${baseUrl}?${query}`, {
          headers: { Accept: "application/json", Referer: "https://www.data.go.kr/" }
        });
        const text = await res.text();
        if (!res.ok) {
          errors.push(
            res.status === 403
              ? `${label}: 인증키 미승인(403) — '건축물대장 표제부' 활용신청·인증키 연결 확인`
              : `${label}: HTTP ${res.status}`
          );
          continue;
        }
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          errors.push(`${label}: JSON 파싱 실패`);
          continue;
        }
        const header = data?.response?.header;
        if (!isApiSuccess(header)) {
          errors.push(`${label}: ${header?.resultMsg || "API 오류"} (${header?.resultCode})`);
          continue;
        }
        const items = parseItems(data);
        for (const item of items) {
          const row = toEnrichmentRow(item);
          if (row) {
            brCache.set(cacheKey, row);
            return { row, errors: [] };
          }
        }
      } catch (err) {
        errors.push(`${label}: ${err.message}`);
      }
    }
  }

  return { row: null, errors: [...new Set(errors)] };
}
