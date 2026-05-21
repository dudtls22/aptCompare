/**
 * Gap 분석 — 지역·실거래 API 공통
 */
(function (global) {
  const API_PROXY_ROUTES = [
    { target: "trade-dev", label: "trade-dev" },
    { target: "trade", label: "trade" }
  ];
  const VERCEL_API_PROXY_BASE = "https://apt-compare-beta.vercel.app";

  let API_PROXY_BASE = "";

  const REGION_OPTIONS = global.KOREA_REGION_OPTIONS || [];
  const DISTRICT_OPTIONS_BY_REGION = global.KOREA_DISTRICT_OPTIONS_BY_REGION || {};
  const DEFAULT_LAWD_BY_REGION = global.KOREA_DEFAULT_LAWD_BY_REGION || {};
  const LAWD_PREFIX_TO_REGION = global.KOREA_LAWD_PREFIX_TO_REGION || {};

  const monthDataPromiseCache = {};
  const dongOptionsPromiseCache = {};
  const aptAreaCache = {};

  function ymToString(d) {
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const RD = () => global.RegionDong;

  function lawdApiCodesForQuery(lawdCd) {
    return RD()?.lawdApiCodesForQuery(lawdCd) ?? [String(lawdCd || "").trim()].filter(Boolean);
  }

  async function probeSameOriginApi() {
    try {
      const res = await fetch("/api/health", { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function resolveApiProxyBase() {
    if (typeof location !== "undefined" && location.hostname.endsWith(".vercel.app")) {
      return "";
    }
    if (await probeSameOriginApi()) return "";
    return VERCEL_API_PROXY_BASE;
  }

  function getApiProxyBase() {
    return API_PROXY_BASE;
  }

  async function initApiBase() {
    try {
      API_PROXY_BASE = await resolveApiProxyBase();
    } catch {
      API_PROXY_BASE = (await probeSameOriginApi()) ? "" : VERCEL_API_PROXY_BASE;
    }
  }

  function getDistrictOptions(regionCode) {
    return Array.isArray(DISTRICT_OPTIONS_BY_REGION[regionCode])
      ? DISTRICT_OPTIONS_BY_REGION[regionCode]
      : [];
  }

  function setupRegionSelect(selectEl, value = "seoul") {
    selectEl.innerHTML = REGION_OPTIONS.map(
      (r) => `<option value="${r.code}">${r.name}</option>`
    ).join("");
    selectEl.value = value;
  }

  function setupDistrictSelect(regionSelect, guSelect, regionCode, preferredCode = "") {
    const region = REGION_OPTIONS.find((r) => r.code === regionCode) || REGION_OPTIONS[0];
    const sorted = [...getDistrictOptions(region.code)].sort((a, b) =>
      a.name.localeCompare(b.name, "ko")
    );
    guSelect.innerHTML = sorted
      .map((d) => `<option value="${d.code}">${d.name}</option>`)
      .join("");
    const def = DEFAULT_LAWD_BY_REGION[region.code] || sorted[0]?.code || "";
    const codes = lawdApiCodesForQuery(preferredCode);
    let pick = def;
    for (const c of codes) {
      if (sorted.some((d) => d.code === c)) {
        pick = c;
        break;
      }
    }
    guSelect.value = pick;
  }

  function isSameDong(itemDong, selected) {
    return RD()?.isSameDong(itemDong, selected) ?? false;
  }

  function getDongName(item) {
    return RD()?.getTradeDongRaw(item) ?? "";
  }

  function getAptName(item) {
    return String(item?.aptNm || item?.apartment || item?.아파트 || "").trim();
  }

  function getAreaFloorValue(item) {
    const raw = item?.excluUseAr || item?.exclusiveArea || item?.전용면적;
    const n = Number.parseFloat(String(raw ?? "").replaceAll(",", "").trim());
    return Number.isFinite(n) ? Math.floor(n) : null;
  }

  function parseDealAmount(amountText) {
    return Number(String(amountText).replaceAll(",", "").trim());
  }

  function getDealDateLabel(item, fallbackYm) {
    const y = String(item?.dealYear || "").trim();
    const m = String(item?.dealMonth || "").trim().padStart(2, "0");
    const d = String(item?.dealDay || "").trim().padStart(2, "0");
    if (y && m && d) return `${y}-${m}-${d}`;
    return `${fallbackYm}-01`;
  }

  function isDealCancelled(item) {
    const cdealDay = String(item?.cdealDay ?? item?.CDEAL_DAY ?? "").trim();
    if (cdealDay && cdealDay !== "-" && cdealDay !== "0") return true;
    const cdealType = String(item?.cdealType ?? item?.CDEAL_TYPE ?? "").trim();
    if (cdealType && cdealType !== "-" && cdealType !== "0") return true;
    const gbn = String(item?.dealingGbn ?? item?.DEALING_GBN ?? "").trim();
    return /취소|해제/.test(gbn);
  }

  function itemMatchesSelection(item, dong, apt, area) {
    if (dong && !isSameDong(getDongName(item), dong)) return false;
    if (apt && getAptName(item) !== apt) return false;
    if (area) {
      const af = getAreaFloorValue(item);
      if (af == null || String(af) !== String(area)) return false;
    }
    return true;
  }

  function buildTargetMonths(monthCount) {
    const result = [];
    const cursor = new Date();
    cursor.setDate(1);
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
      result.push({
        ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        ymParam: ymToString(d)
      });
    }
    return result;
  }

  async function fetchOneMonth({ lawdCd, ymParam }) {
    let lastError;
    for (const route of API_PROXY_ROUTES) {
      try {
        const params = new URLSearchParams({
          target: route.target,
          LAWD_CD: lawdCd,
          DEAL_YMD: ymParam,
          pageNo: "1",
          numOfRows: "1000",
          _type: "json"
        });
        const url = `${getApiProxyBase()}/api/proxy?${params.toString()}`;
        const res = await fetch(url);
        const rawText = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = JSON.parse(rawText);
        const header = data?.response?.header;
        const code = String(header?.resultCode ?? "");
        if (code !== "00" && code !== "000") {
          throw new Error(header?.resultMsg || "API 오류");
        }
        const items = data?.response?.body?.items?.item || [];
        return Array.isArray(items) ? items : [items];
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("API 오류");
  }

  function fetchOneMonthCached({ lawdCd, ymParam }) {
    const key = `${lawdCd}::${ymParam}`;
    if (!monthDataPromiseCache[key]) {
      monthDataPromiseCache[key] = fetchOneMonth({ lawdCd, ymParam }).catch((e) => {
        delete monthDataPromiseCache[key];
        throw e;
      });
    }
    return monthDataPromiseCache[key];
  }

  async function fetchTradeItemsForLawdMonths(lawdCd, targetMonths) {
    const codes = lawdApiCodesForQuery(lawdCd);
    const all = [];
    for (const code of codes) {
      const results = await Promise.allSettled(
        targetMonths.map((m) => fetchOneMonthCached({ lawdCd: code, ymParam: m.ymParam }))
      );
      for (const r of results) {
        if (r.status === "fulfilled" && Array.isArray(r.value)) {
          all.push(...r.value);
        }
      }
    }
    return all;
  }

  async function getDongOptions(lawdCd) {
    const key = String(lawdCd || "");
    if (!dongOptionsPromiseCache[key]) {
      dongOptionsPromiseCache[key] = (async () => {
        const staticDongs = RD()?.getStaticDongList(lawdCd) ?? [];
        let apiDongs = [];
        try {
          const months = buildTargetMonths(24);
          const items = await fetchTradeItemsForLawdMonths(lawdCd, months);
          apiDongs = RD()?.collectDongsFromTradeItems(items) ?? [];
        } catch (e) {
          if (!staticDongs.length) throw e;
        }
        return RD()?.mergeDongLists(staticDongs, apiDongs) ?? [];
      })().catch((e) => {
        delete dongOptionsPromiseCache[key];
        throw e;
      });
    }
    return dongOptionsPromiseCache[key];
  }

  async function getAptAreaOptions(lawdCd, dong) {
    const key = `${lawdCd}::${dong}`;
    if (aptAreaCache[key]) return aptAreaCache[key];
    const months = buildTargetMonths(24);
    const items = await fetchTradeItemsForLawdMonths(lawdCd, months);
    const aptSet = new Set();
    const areaByApt = {};
    for (const it of items) {
      if (!itemMatchesSelection(it, dong, "", "")) continue;
      const apt = getAptName(it);
      if (!apt) continue;
      aptSet.add(apt);
      if (!areaByApt[apt]) areaByApt[apt] = new Set();
      const af = getAreaFloorValue(it);
      if (af != null) areaByApt[apt].add(String(af));
    }
    const aptNames = [...aptSet].sort((a, b) => a.localeCompare(b, "ko"));
    const out = {
      aptNames,
      areaByApt: Object.fromEntries(
        aptNames.map((a) => [
          a,
          [...(areaByApt[a] || [])].sort((x, y) => x.localeCompare(y, "ko", { numeric: true }))
        ])
      )
    };
    aptAreaCache[key] = out;
    return out;
  }

  function dateToQuarterKey(dateStr) {
    const m = /^(\d{4})-(\d{2})/.exec(String(dateStr || ""));
    if (!m) return "";
    const y = m[1];
    const mi = parseInt(m[2], 10);
    const q = Math.ceil(mi / 3);
    return `${y} Q${q}`;
  }

  function buildQuarterLabels(monthCount = 36) {
    const months = buildTargetMonths(monthCount);
    const set = new Set();
    for (const m of months) {
      set.add(dateToQuarterKey(`${m.ym}-01`));
    }
    return [...set].sort();
  }

  function aggregateQuarterlyAverage(items, selection) {
    const { dong, apt, area } = selection;
    const buckets = {};
    for (const it of items) {
      if (!itemMatchesSelection(it, dong, apt, area)) continue;
      if (isDealCancelled(it)) continue;
      const price = parseDealAmount(it.dealAmount);
      if (!Number.isFinite(price) || price <= 0) continue;
      const ym = getDealDateLabel(it, "").slice(0, 7);
      const qk = dateToQuarterKey(`${ym}-01`);
      if (!qk) continue;
      if (!buckets[qk]) buckets[qk] = [];
      buckets[qk].push(price);
    }
    const byQuarter = {};
    for (const [qk, arr] of Object.entries(buckets)) {
      byQuarter[qk] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    }
    return byQuarter;
  }

  function findRegionCodeByLawdCd(lawdCd) {
    const prefix = String(lawdCd || "").trim().slice(0, 2);
    return LAWD_PREFIX_TO_REGION[prefix] || "";
  }

  function getDistrictName(lawdCd) {
    for (const region of REGION_OPTIONS) {
      const d = getDistrictOptions(region.code).find((x) => x.code === lawdCd);
      if (d) return d.name;
    }
    return "";
  }

  global.GAP_API = {
    initApiBase,
    getApiProxyBase,
    setupRegionSelect,
    setupDistrictSelect,
    getDistrictOptions,
    getDongOptions,
    getAptAreaOptions,
    fetchTradeItemsForLawdMonths,
    buildTargetMonths,
    buildQuarterLabels,
    aggregateQuarterlyAverage,
    findRegionCodeByLawdCd,
    getDistrictName,
    REGION_OPTIONS,
    LAWD_PREFIX_TO_REGION
  };
})(typeof window !== "undefined" ? window : globalThis);
