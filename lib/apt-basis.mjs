import { buildDataGoKrQueryString } from "./data-go-key.mjs";
import { resolveKaptCodeFromLookup } from "./apt-kapt-lookup.mjs";
import { fetchHouseholdFromBuildingRegistry } from "./building-registry.mjs";

/** 공공데이터포털 최신 명세: AptBasisInfoServiceV4, AptListServiceV4 */
const BASIS_ENDPOINTS = [
  "https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4",
  "https://apis.data.go.kr/1613000/AptBasisInfoServiceV3/getAphusBassInfoV3",
  "https://apis.data.go.kr/1613000/AptBasisInfoService2/getAphusBassInfoV2",
  "https://apis.data.go.kr/1613000/AptBasisInfoService1/getAphusBassInfo"
];

const LIST_LEGAL_ENDPOINTS = [
  "https://apis.data.go.kr/1613000/AptListServiceV4/getLegaldongAptListV4",
  "https://apis.data.go.kr/1613000/AptListServiceV3/getLegaldongAptListV3",
  "https://apis.data.go.kr/1613000/AptListService2/getLegaldongAptList",
  "https://apis.data.go.kr/1613000/AptListService1/getLegaldongAptList"
];

const LIST_SIGUNGU_ENDPOINTS = [
  "https://apis.data.go.kr/1613000/AptListServiceV4/getSigunguAptListV4",
  "https://apis.data.go.kr/1613000/AptListServiceV3/getSigunguAptListV3",
  "https://apis.data.go.kr/1613000/AptListService2/getSigunguAptList",
  "https://apis.data.go.kr/1613000/AptListService1/getSigunguAptList"
];

const listCache = new Map();
const basisCache = new Map();

function normalizeAptName(name) {
  return String(name || "").replaceAll(" ", "").trim();
}

function normalizeDongName(name) {
  return String(name || "").replaceAll(" ", "").trim();
}

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

async function fetchJsonUrl(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", Referer: "https://www.data.go.kr/" }
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.httpStatus = res.status;
    err.bodyPreview = text.slice(0, 120);
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JSON 파싱 실패");
  }
}

async function tryEndpoints(endpoints, buildParams, serviceKey) {
  const errors = [];
  for (const baseUrl of endpoints) {
    const label = baseUrl.split("/").slice(-2).join("/");
    try {
      const params = buildParams();
      const query = buildDataGoKrQueryString(
        new URLSearchParams({ ...params, _type: "json" }),
        serviceKey
      );
      const data = await fetchJsonUrl(`${baseUrl}?${query}`);
      const header = data?.response?.header;
      if (!isApiSuccess(header)) {
        errors.push(`${label}: ${header?.resultMsg || "API 오류"} (${header?.resultCode})`);
        continue;
      }
      return { data, label, errors };
    } catch (err) {
      const msg =
        err.httpStatus === 403
          ? `${label}: 인증키 미승인(403) — 마이페이지에서 해당 API와 인증키 연결 확인`
          : `${label}: ${err.message}${err.bodyPreview ? ` (${err.bodyPreview})` : ""}`;
      errors.push(msg);
    }
  }
  return { data: null, label: "", errors };
}

async function fetchAptList(url, cacheKey, params, serviceKey) {
  const key = String(cacheKey || "").trim();
  if (!key) return { items: [], errors: [] };
  if (listCache.has(key)) return { items: listCache.get(key), errors: [] };

  const { data, errors } = await tryEndpoints([url], () => params, serviceKey);
  if (!data) return { items: [], errors };

  const items = parseItems(data);
  listCache.set(key, items);
  return { items, errors };
}

async function fetchListByLegalDong(bjdCode, serviceKey) {
  const code = String(bjdCode || "").trim().slice(0, 10);
  if (code.length < 10) return { items: [], errors: ["법정동코드 10자리 없음"] };

  const cacheKey = `legal::${code}`;
  if (listCache.has(cacheKey)) return { items: listCache.get(cacheKey), errors: [] };

  const errors = [];
  for (const url of LIST_LEGAL_ENDPOINTS) {
    const { items, errors: e } = await fetchAptList(
      url,
      cacheKey,
      { bjdCode: code, pageNo: "1", numOfRows: "50" },
      serviceKey
    );
    if (items?.length) return { items, errors: e || [] };
    if (e?.length) errors.push(...e);
  }
  return { items: [], errors };
}

async function fetchListBySigungu(lawdCd, serviceKey) {
  const code = String(lawdCd || "").trim().slice(0, 5);
  if (code.length !== 5) return { items: [], errors: ["시군구코드 5자리 없음"] };

  const cacheKey = `sigungu::${code}`;
  if (listCache.has(cacheKey)) return { items: listCache.get(cacheKey), errors: [] };

  const errors = [];
  for (const url of LIST_SIGUNGU_ENDPOINTS) {
    try {
      const params = { bjdCode: code, pageNo: "1", numOfRows: "50" };
      const query = buildDataGoKrQueryString(
        new URLSearchParams({ ...params, _type: "json" }),
        serviceKey
      );
      const data = await fetchJsonUrl(`${url}?${query}`);
      const header = data?.response?.header;
      if (!isApiSuccess(header)) {
        errors.push(`${url}: ${header?.resultMsg || "목록 API 오류"}`);
        continue;
      }
      const items = parseItems(data);
      if (items.length) {
        listCache.set(cacheKey, items);
        return { items, errors: [] };
      }
    } catch (err) {
      errors.push(
        err.httpStatus === 403
          ? `단지목록: 인증키 미승인(403) — '공동주택 단지 목록제공 서비스' 활용신청 필요`
          : `단지목록: ${err.message}`
      );
    }
  }
  return { items: [], errors };
}

function getKaptCodeFromListItem(it) {
  return String(it?.kaptCode ?? it?.kaptcode ?? it?.KAPT_CODE ?? "").trim();
}

function getKaptNameFromListItem(it) {
  return String(it?.kaptName ?? it?.kaptname ?? it?.KAPT_NAME ?? "").trim();
}

function findKaptCodeInList(list, aptName, dongName) {
  const want = normalizeAptName(aptName);
  if (!want || !list?.length) return "";

  const dong = normalizeDongName(dongName);
  const scoped = dong
    ? list.filter((it) => {
        const addr = String(
          it?.kaptAddr ?? it?.doroJuso ?? it?.kaptaddr ?? it?.KAPT_ADDR ?? ""
        ).replaceAll(" ", "");
        const doro = String(it?.doroJuso ?? "").replaceAll(" ", "");
        return addr.includes(dong) || doro.includes(dong);
      })
    : list;
  const pool = scoped.length ? scoped : list;

  let hit = pool.find((it) => normalizeAptName(getKaptNameFromListItem(it)) === want);
  if (hit) return getKaptCodeFromListItem(hit);

  hit = pool.find((it) => {
    const n = normalizeAptName(getKaptNameFromListItem(it));
    return n && (n.includes(want) || want.includes(n));
  });
  if (hit) return getKaptCodeFromListItem(hit);

  hit = list.find((it) => normalizeAptName(getKaptNameFromListItem(it)) === want);
  return hit ? getKaptCodeFromListItem(hit) : "";
}

async function fetchBasisByKaptCode(kaptCode, serviceKey) {
  const code = String(kaptCode || "").trim();
  if (!code) return { row: null, errors: [] };
  if (basisCache.has(code)) return { row: basisCache.get(code), errors: [] };

  const errors = [];
  for (const baseUrl of BASIS_ENDPOINTS) {
    const label = baseUrl.split("/").slice(-1)[0];
    try {
      const query = buildDataGoKrQueryString(
        new URLSearchParams({ kaptCode: code, _type: "json" }),
        serviceKey
      );
      const data = await fetchJsonUrl(`${baseUrl}?${query}`);
      const header = data?.response?.header;
      if (!isApiSuccess(header)) {
        errors.push(`${label}: ${header?.resultMsg || "기본정보 API 오류"}`);
        continue;
      }
      const items = parseItems(data);
      const row = items[0] || null;
      if (isValidEnrichmentRow(row)) {
        basisCache.set(code, row);
        return { row, errors: [] };
      }
    } catch (err) {
      errors.push(
        err.httpStatus === 403
          ? `${label}: 인증키 미승인(403) — '공동주택 기본 정보제공 서비스' 활용신청·인증키 연결 확인`
          : `${label}: ${err.message}`
      );
    }
  }
  return { row: null, errors };
}

function rowKey(cond) {
  const lawd = String(cond?.lawdCd || "").trim();
  const apt = String(cond?.apt || "").trim();
  const dong = String(cond?.dong || "").trim();
  return `${lawd}::${apt}::${dong}`;
}

function pickHouseholdCount(basis) {
  if (!basis) return null;
  const raw =
    basis.totHhldCnt ??
    basis.TOT_HHLD_CNT ??
    basis.kaptdaCnt ??
    basis.KAPTDA_CNT ??
    basis.kaptDaCnt ??
    basis.hoCnt ??
    basis.HO_CNT ??
    basis.hhldCnt ??
    basis.HHLD_CNT;
  return raw;
}

function isValidEnrichmentRow(row) {
  if (!row || typeof row !== "object") return false;
  const hh = pickHouseholdCount(row);
  return hh != null && hh !== "" && Number(hh) > 0;
}

function storeEnrichmentRow(byKey, cond, row) {
  const rk = rowKey(cond);
  const lawd = String(cond?.lawdCd || "").trim();
  const apt = String(cond?.apt || "").trim();
  byKey[rk] = row;
  const alt = `${lawd}::${apt}`;
  if (!byKey[alt]) byKey[alt] = row;
  if (!byKey[apt]) byKey[apt] = row;
}

async function tryBuildingRegistry(cond, serviceKey, errors) {
  const parcel = cond?.parcel;
  if (!parcel) return null;
  const { row, errors: brErr } = await fetchHouseholdFromBuildingRegistry(parcel, serviceKey);
  if (brErr?.length) errors.push(...brErr);
  return isValidEnrichmentRow(row) ? row : null;
}

/**
 * @param {Array<{ lawdCd?: string, dong?: string, apt?: string, bjdCode?: string, kaptCode?: string, parcel?: object }>} conditions
 */
export async function enrichAptBasisBatch(conditions, serviceKey) {
  const key = String(serviceKey || "").trim();
  if (!key) {
    throw new Error("DATA_GO_KR_SERVICE_KEY 가 설정되지 않았습니다.");
  }

  const byKey = {};
  const errors = [];
  const hints = new Set();

  for (const cond of conditions || []) {
    const apt = String(cond?.apt || "").trim();
    if (!apt) continue;
    const rk = rowKey(cond);
    if (byKey[rk]) continue;

    let kaptCode = resolveKaptCodeFromLookup(cond);
    const bjd = String(cond?.bjdCode || "").trim();
    const lawd = String(cond?.lawdCd || "").trim();
    const dong = String(cond?.dong || "").trim();

    if (!kaptCode && bjd.length >= 10) {
      const { items, errors: listErr } = await fetchListByLegalDong(bjd, key);
      if (listErr?.length) errors.push(...listErr);
      kaptCode = findKaptCodeInList(items, apt, dong);
    }

    if (!kaptCode && lawd.length === 5) {
      const { items, errors: listErr } = await fetchListBySigungu(lawd, key);
      if (listErr?.length) errors.push(...listErr);
      kaptCode = findKaptCodeInList(items, apt, dong);
      if (!kaptCode && !items.length) {
        hints.add(
          "단지목록 API가 500이면 data/kapt-lookup.json 에 단지코드를 추가하거나, 포털에서 단지목록 CSV를 받아 `node scripts/import-kapt-csv.mjs` 로 등록하세요. (문의 1566-0025)"
        );
      }
    }

    if (kaptCode) {
      const { row, errors: basisErr } = await fetchBasisByKaptCode(kaptCode, key);
      if (basisErr?.length) errors.push(...basisErr);
      if (isValidEnrichmentRow(row)) {
        storeEnrichmentRow(byKey, cond, row);
        continue;
      }
    }

    const brRow = await tryBuildingRegistry(cond, key, errors);
    if (brRow) {
      storeEnrichmentRow(byKey, cond, brRow);
      continue;
    }

    if (!kaptCode) {
      errors.push(
        `${apt}: 세대수 조회 실패 — kaptCode 없음(단지목록 500·lookup 미등록) 또는 건축물대장 지번 미매칭.`
      );
      hints.add(
        "공동주택 기본정보·건축물대장 표제부 API 활용신청 및 인증키 연결을 확인하세요. trade-dev(상세) 조회 시 지번·kaptCode 전달이 필요합니다."
      );
      continue;
    }

    hints.add(
      "아파트 기본정보(getAphusBassInfo)가 403이면 data.go.kr → 활용신청 → '공동주택 기본 정보제공 서비스' 인증키 연결 후 Redeploy 하세요."
    );
  }

  return {
    byKey,
    errors: [...new Set(errors)],
    hints: [...hints]
  };
}
