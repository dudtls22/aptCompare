import { buildDataGoKrQueryString } from "./data-go-key.mjs";

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
  const raw = data?.response?.body?.items?.item;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function isApiSuccess(header) {
  const code = String(header?.resultCode ?? "");
  return code === "00" || code === "000";
}

async function fetchJsonUrl(url) {
  const res = await fetch(url);
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
  if (!key) return [];
  if (listCache.has(key)) return listCache.get(key);

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
      { bjdCode: code, pageNo: "1", numOfRows: "1000" },
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
      const params = { bjdCode: code, pageNo: "1", numOfRows: "1000" };
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

function findKaptCodeInList(list, aptName, dongName) {
  const want = normalizeAptName(aptName);
  if (!want || !list?.length) return "";

  const dong = normalizeDongName(dongName);
  const scoped = dong
    ? list.filter((it) => {
        const addr = String(it?.kaptAddr ?? it?.doroJuso ?? it?.kaptaddr ?? "").replaceAll(
          " ",
          ""
        );
        const doro = String(it?.doroJuso ?? "").replaceAll(" ", "");
        return addr.includes(dong) || doro.includes(dong);
      })
    : list;
  const pool = scoped.length ? scoped : list;

  let hit = pool.find((it) => normalizeAptName(it?.kaptName) === want);
  if (hit?.kaptCode) return String(hit.kaptCode).trim();

  hit = pool.find((it) => {
    const n = normalizeAptName(it?.kaptName);
    return n && (n.includes(want) || want.includes(n));
  });
  if (hit?.kaptCode) return String(hit.kaptCode).trim();

  hit = list.find((it) => normalizeAptName(it?.kaptName) === want);
  return hit?.kaptCode ? String(hit.kaptCode).trim() : "";
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
      if (row) {
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
    basis.kaptdaCnt ??
    basis.KAPTDA_CNT ??
    basis.kaptDaCnt ??
    basis.hhldCnt ??
    basis.HHLD_CNT ??
    basis.totHhldCnt;
  return raw;
}

/**
 * @param {Array<{ lawdCd?: string, dong?: string, apt?: string, bjdCode?: string }>} conditions
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

    let kaptCode = "";
    const bjd = String(cond?.bjdCode || "").trim();
    const lawd = String(cond?.lawdCd || "").trim();
    const dong = String(cond?.dong || "").trim();

    if (bjd.length >= 10) {
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
          "세대수 조회에는 '공동주택 단지 목록제공 서비스' 활용신청이 추가로 필요할 수 있습니다."
        );
      }
    }

    if (!kaptCode) {
      errors.push(`${apt}: K-apt 단지코드(kaptCode)를 찾지 못했습니다.`);
      continue;
    }

    const { row, errors: basisErr } = await fetchBasisByKaptCode(kaptCode, key);
    if (basisErr?.length) errors.push(...basisErr);
    if (!row) {
      hints.add(
        "공동주택 기본정보 API( V4 )가 403이면 data.go.kr 마이페이지 → 활용신청 → 해당 API → 사용할 인증키를 연결한 뒤 Redeploy 하세요."
      );
      continue;
    }

    if (!pickHouseholdCount(row)) {
      errors.push(`${apt}: 기본정보 응답에 세대수(kaptdaCnt) 없음`);
    }

    byKey[rk] = row;
    const alt = `${lawd}::${apt}`;
    if (!byKey[alt]) byKey[alt] = row;
    if (!byKey[apt]) byKey[apt] = row;
  }

  return {
    byKey,
    errors: [...new Set(errors)],
    hints: [...hints]
  };
}
