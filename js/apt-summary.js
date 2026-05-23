/**
 * 아파트 요약 표 · 평형 타입(84A 등) 라벨
 */
(function (global) {
  const VERCEL_API_FALLBACK = "https://apt-compare-beta.vercel.app";
  let aptBasisApiBasePromise = null;

  async function resolveAptBasisApiBase() {
    if (typeof global.getApiProxyBase === "function") {
      const b = global.getApiProxyBase();
      if (b !== undefined && b !== null) return String(b);
    }
    if (global.GAP_API?.getApiProxyBase) {
      const b = global.GAP_API.getApiProxyBase();
      if (b !== undefined && b !== null) return String(b);
    }
    try {
      const res = await fetch("/api/health", { method: "GET" });
      if (res.ok) return "";
    } catch {
      /* same-origin API 없음 */
    }
    const host = global.location?.hostname || "";
    if (host.endsWith(".vercel.app")) return "";
    return VERCEL_API_FALLBACK;
  }

  function getAptBasisApiBase() {
    if (!aptBasisApiBasePromise) {
      aptBasisApiBasePromise = resolveAptBasisApiBase();
    }
    return aptBasisApiBasePromise;
  }

  let clientLookupPromise = null;

  function getStaticAssetBase() {
    const p = String(global.location?.pathname || "/");
    const m = p.match(/^(\/[^/]+)\//);
    if (m) return m[1];
    if (p === "/aptCompare" || p.startsWith("/aptCompare/")) return "/aptCompare";
    return "";
  }

  async function loadClientKaptLookup() {
    if (!clientLookupPromise) {
      clientLookupPromise = (async () => {
        const base = getStaticAssetBase();
        const url = `${base}/data/kapt-lookup.json`.replace(/\/{2,}/g, "/");
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) return { byAptSeq: {}, byKey: {} };
          const raw = await res.json();
          return {
            byAptSeq: raw?.byAptSeq && typeof raw.byAptSeq === "object" ? raw.byAptSeq : {},
            byKey: raw?.byKey && typeof raw.byKey === "object" ? raw.byKey : {}
          };
        } catch {
          return { byAptSeq: {}, byKey: {} };
        }
      })();
    }
    return clientLookupPromise;
  }

  function resolveKaptCodeFromClientLookup(data, cond) {
    const explicit = String(cond?.kaptCode || "").trim();
    if (explicit) return explicit;

    const aptSeq = String(cond?.aptSeq || "").trim();
    if (aptSeq && data.byAptSeq[aptSeq]) return String(data.byAptSeq[aptSeq]).trim();

    const lawd = String(cond?.lawdCd || "").trim();
    const apt = String(cond?.apt || "").trim();
    const dong = String(cond?.dong || "").trim();
    const bjd = String(cond?.bjdCode || "").trim().slice(0, 10);
    const napt = normalizeAptName(apt);
    const ndong = normalizeDongName(dong);

    const candidates = [
      `${lawd}::${apt}::${dong}`,
      `${lawd}::${apt}`,
      `${bjd}::${apt}`,
      `${lawd}::${napt}::${ndong}`,
      `${lawd}::${napt}`,
      `${bjd}::${napt}`,
      napt
    ];
    for (const key of candidates) {
      if (key && data.byKey[key]) return String(data.byKey[key]).trim();
    }

    if (!napt) return "";

    for (const [key, code] of Object.entries(data.byKey)) {
      const parts = key.split("::");
      const namePart = normalizeAptName(parts[parts.length - 1]);
      if (namePart !== napt) continue;
      if (lawd && !key.startsWith(`${lawd}::`) && !key.startsWith(`${bjd}::`)) continue;
      if (ndong && parts.length >= 3) {
        const dongPart = normalizeDongName(parts[parts.length - 2]);
        if (dongPart && dongPart !== ndong && !ndong.includes(dongPart) && !dongPart.includes(ndong)) {
          continue;
        }
      }
      return String(code).trim();
    }
    return "";
  }

  function normalizeAptName(name) {
    return String(name || "").replaceAll(" ", "").trim();
  }

  function normalizeDongName(name) {
    return String(name || "").replaceAll(" ", "").trim();
  }

  function dongCoreName(name) {
    const n = normalizeDongName(name);
    if (!n) return "";
    if (n.endsWith("동")) return n.slice(0, -1);
    return n;
  }

  function isSameDong(itemDongName, selectedDongName) {
    const a = normalizeDongName(itemDongName);
    const b = normalizeDongName(selectedDongName);
    if (!a || !b) return false;
    if (a === b) return true;
    const aCore = dongCoreName(a);
    const bCore = dongCoreName(b);
    return Boolean(aCore) && aCore === bCore;
  }

  function getDongName(item) {
    return String(
      item?.umdNm ?? item?.UMD_NM ?? item?.umd_nm ?? item?.dong ?? item?.DONG ?? ""
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

  function itemMatchesCondition(item, cond) {
    const dong = String(cond?.dong || "").trim();
    const apt = String(cond?.apt || "").trim();
    const area = String(cond?.area || "").trim();
    if (dong && !isSameDong(getDongName(item), dong)) return false;
    if (apt && getAptName(item) !== apt) return false;
    if (area) {
      const af = getAreaFloorValue(item);
      if (af == null || String(af) !== area) return false;
    }
    return true;
  }

  function pickBuildYear(items, cond) {
    const counts = new Map();
    for (const it of items) {
      if (!itemMatchesCondition(it, cond)) continue;
      const y = String(it?.buildYear ?? it?.BUILD_YEAR ?? "").trim();
      if (y && /^\d{4}$/.test(y)) counts.set(y, (counts.get(y) || 0) + 1);
    }
    if (!counts.size) return "";
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  function pickAptSeq(items, cond) {
    for (const it of items) {
      if (!itemMatchesCondition(it, cond)) continue;
      const seq = String(it?.aptSeq ?? it?.APT_SEQ ?? "").trim();
      if (seq) return seq;
    }
    return "";
  }

  function pickBjdCode(items, cond) {
    for (const it of items) {
      if (!itemMatchesCondition(it, cond)) continue;
      const sgg = String(it?.sggCd ?? it?.SGG_CD ?? cond?.lawdCd ?? "").trim();
      const umd = String(it?.umdCd ?? it?.UMD_CD ?? "").trim();
      if (sgg.length >= 5 && umd) {
        return `${sgg.slice(0, 5)}${String(umd).padStart(5, "0")}`.slice(0, 10);
      }
    }
    const lawd = String(cond?.lawdCd || "").trim();
    return lawd.length === 5 ? lawd : "";
  }

  /** 실거래(상세) 지번 → 건축물대장 표제부 조회용 */
  function pickParcel(items, cond) {
    for (const it of items) {
      if (!itemMatchesCondition(it, cond)) continue;
      const sigunguCd = String(it?.sggCd ?? it?.SGG_CD ?? cond?.lawdCd ?? "")
        .trim()
        .slice(0, 5);
      const umd = String(it?.umdCd ?? it?.UMD_CD ?? "").trim();
      const bon = it?.bonbun ?? it?.BONBUN ?? it?.jibun ?? it?.JIBUN ?? "";
      const bu = it?.bubun ?? it?.BUBUN ?? "0";
      if (sigunguCd.length !== 5 || !umd || bon === "" || bon == null) continue;
      const landCd = String(it?.landCd ?? it?.LAND_CD ?? "0").trim();
      return {
        sigunguCd,
        bjdongCd: String(umd).padStart(5, "0").slice(0, 5),
        platGbCd: landCd === "1" ? "1" : "0",
        bun: String(bon).replace(/\D/g, "").padStart(4, "0").slice(-4),
        ji: String(bu).replace(/\D/g, "").padStart(4, "0").slice(-4)
      };
    }
    return null;
  }

  /** 준공년월 표기: 2026.01 (연.월) */
  function formatCompletionYm(year, month) {
    const y = String(year ?? "").trim();
    const m = String(month ?? "").trim();
    if (/^\d{4}$/.test(y) && /^\d{1,2}$/.test(m)) {
      return `${y}.${m.padStart(2, "0")}`;
    }
    if (/^\d{4}$/.test(y)) return y;
    return "";
  }

  function formatCompletionFromBasis(basis) {
    const usedate = String(basis?.kaptUsedate ?? basis?.useAprDay ?? "").trim();
    if (/^\d{8}$/.test(usedate)) {
      return formatCompletionYm(usedate.slice(0, 4), usedate.slice(4, 6));
    }
    if (/^\d{6}$/.test(usedate)) {
      return formatCompletionYm(usedate.slice(0, 4), usedate.slice(4, 6));
    }
    const y = String(basis?.buildYear ?? "").trim();
    if (/^\d{4}$/.test(y)) return y;
    return "";
  }

  function formatCompletionFromTradeYear(year) {
    const y = String(year || "").trim();
    if (/^\d{4}$/.test(y)) return y;
    return "-";
  }

  function formatHouseholds(n) {
    if (n == null || n === "") return "-";
    const num = Number(String(n).replaceAll(",", "").trim());
    if (!Number.isFinite(num) || num <= 0) return "-";
    return `${num.toLocaleString("ko-KR")}세대`;
  }

  /** apt → floorKey → 전용면적(원값) 목록 (오름차순, 중복 제거) */
  function buildFloorPlanIndex(items) {
    const byApt = new Map();
    for (const it of items) {
      const apt = getAptName(it);
      if (!apt) continue;
      const raw = getAreaValue(it);
      if (raw == null) continue;
      const floorKey = String(Math.floor(raw));
      if (!byApt.has(apt)) byApt.set(apt, new Map());
      const byFloor = byApt.get(apt);
      if (!byFloor.has(floorKey)) byFloor.set(floorKey, []);
      const list = byFloor.get(floorKey);
      const key = raw.toFixed(3);
      if (!list.some((x) => x.toFixed(3) === key)) list.push(raw);
    }
    for (const byFloor of byApt.values()) {
      for (const list of byFloor.values()) {
        list.sort((a, b) => a - b);
      }
    }
    return byApt;
  }

  function resolveFloorPlanType(index, apt, areaSelection, items, cond) {
    const aptKey = String(apt || "").trim();
    const floorKey = String(areaSelection || "").trim();
    if (!aptKey || !floorKey) return "";
    const variants = index.get(aptKey)?.get(floorKey);
    if (!variants?.length) return "";
    if (variants.length === 1) return `${floorKey}A`;

    if (items?.length && cond) {
      let bestIdx = 0;
      let bestCount = -1;
      for (let i = 0; i < variants.length; i++) {
        let count = 0;
        for (const it of items) {
          if (!itemMatchesCondition(it, cond)) continue;
          const raw = getAreaValue(it);
          if (raw != null && Math.abs(raw - variants[i]) < 0.02) count++;
        }
        if (count > bestCount) {
          bestCount = count;
          bestIdx = i;
        }
      }
      if (bestCount > 0) {
        return `${floorKey}${String.fromCharCode(65 + Math.min(bestIdx, 25))}`;
      }
    }
    return `${floorKey}A`;
  }

  function resolveFloorPlanTypeForItem(index, apt, areaSelection, item) {
    const aptKey = String(apt || "").trim();
    const floorKey = String(areaSelection || "").trim();
    if (!aptKey || !floorKey) return "";
    const variants = index.get(aptKey)?.get(floorKey);
    if (!variants?.length) return "";
    const raw = getAreaValue(item);
    let idx = 0;
    if (raw != null && variants.length > 1) {
      const found = variants.findIndex((v) => Math.abs(v - raw) < 0.02);
      if (found >= 0) idx = found;
      else {
        let best = 0;
        let bestDiff = Infinity;
        for (let i = 0; i < variants.length; i++) {
          const d = Math.abs(variants[i] - raw);
          if (d < bestDiff) {
            bestDiff = d;
            best = i;
          }
        }
        idx = best;
      }
    }
    const letter = String.fromCharCode(65 + Math.min(idx, 25));
    return `${floorKey}${letter}`;
  }

  function buildSummaryRowsFromTrade(conditions, items) {
    const planIndex = buildFloorPlanIndex(items);
    return conditions.map((cond) => {
      const buildYear = pickBuildYear(items, cond);
      const areaType = resolveFloorPlanType(planIndex, cond.apt, cond.area, items, cond);
      return {
        aptName: cond.apt || "-",
        completion: formatCompletionFromTradeYear(buildYear),
        households: "-",
        areaType,
        lawdCd: cond.lawdCd || "",
        dong: cond.dong || "",
        apt: cond.apt || "",
        area: cond.area || "",
        aptSeq: pickAptSeq(items, cond),
        bjdCode: pickBjdCode(items, cond),
        parcel: pickParcel(items, cond)
      };
    });
  }

  function mergeBasisIntoRows(rows, basisByKey) {
    if (!basisByKey || typeof basisByKey !== "object") return rows;
    return rows.map((row) => {
      const key = `${row.lawdCd}::${row.apt}::${row.dong}`;
      const alt = `${row.lawdCd}::${row.apt}`;
      const basis = basisByKey[key] || basisByKey[alt] || basisByKey[row.apt];
      if (!basis) return row;
      const completion = formatCompletionFromBasis(basis) || row.completion;
      const hh =
        basis.totHhldCnt ??
        basis.TOT_HHLD_CNT ??
        basis.kaptdaCnt ??
        basis.KAPTDA_CNT ??
        basis.kaptDaCnt ??
        basis.hoCnt ??
        basis.HO_CNT ??
        basis.hhldCnt ??
        basis.HHLD_CNT;
      const households = hh != null ? formatHouseholds(hh) : row.households;
      return { ...row, completion, households };
    });
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderAptSummaryTable(tbodyEl, rows) {
    if (!tbodyEl) return;
    if (!rows?.length) {
      tbodyEl.innerHTML =
        '<tr class="empty-row"><td colspan="3">조회 후 아파트 정보가 표시됩니다.</td></tr>';
      return;
    }
    tbodyEl.innerHTML = rows
      .map(
        (r) =>
          `<tr>
          <td>${escapeHtml(r.aptName)}</td>
          <td>${escapeHtml(r.completion)}</td>
          <td>${escapeHtml(r.households)}</td>
        </tr>`
      )
      .join("");
  }

  function updateAptSummaryHint(hintEl, message) {
    if (!hintEl) return;
    const text = String(message || "").trim();
    if (!text) {
      hintEl.hidden = true;
      hintEl.textContent = "";
      return;
    }
    hintEl.hidden = false;
    hintEl.textContent = text;
  }

  async function fetchBasisEnrichment(rows) {
    const base = await getAptBasisApiBase();
    const url = `${base}/api/apt-basis`;
    const lookup = await loadClientKaptLookup();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conditions: rows.map((r) => ({
          lawdCd: r.lawdCd,
          dong: r.dong,
          apt: r.apt,
          aptSeq: r.aptSeq,
          bjdCode: r.bjdCode,
          kaptCode: resolveKaptCodeFromClientLookup(lookup, r),
          parcel: r.parcel || null
        }))
      })
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      return { byKey: null, hint: "K-apt API 응답을 읽지 못했습니다." };
    }
    if (!res.ok) {
      const statusHint =
        res.status === 403 || res.status === 404
          ? " /api/apt-basis 가 서버에 없거나 배포되지 않았습니다. Vercel Redeploy·Git push(api/apt-basis.js) 확인."
          : "";
      return {
        byKey: null,
        hint:
          (data?.message || data?.hints?.[0] || `K-apt API 오류 (HTTP ${res.status})`) +
          statusHint
      };
    }
    const hint =
      data?.hints?.[0] ||
      (data?.errors?.length ? data.errors.slice(0, 2).join(" · ") : "");
    return { byKey: data?.byKey || null, hint, errors: data?.errors || [] };
  }

  function rowsMissingHouseholds(rows) {
    return (rows || []).every((r) => !r.households || r.households === "-");
  }

  async function renderAptSummaryWithEnrichment(tbodyEl, conditions, items, hintEl) {
    const rows = buildSummaryRowsFromTrade(conditions, items);
    renderAptSummaryTable(tbodyEl, rows);
    updateAptSummaryHint(hintEl, "");
    try {
      const { byKey, hint, errors } = await fetchBasisEnrichment(rows);
      if (byKey && Object.keys(byKey).length) {
        const merged = mergeBasisIntoRows(rows, byKey);
        renderAptSummaryTable(tbodyEl, merged);
        if (rowsMissingHouseholds(merged)) {
          const errText = errors?.length ? errors.slice(0, 2).join(" · ") : "";
          const msg = [hint, errText].filter(Boolean).join(" ");
          if (msg) updateAptSummaryHint(hintEl, msg);
        }
        return merged;
      }
      const errText = errors?.length ? errors.slice(0, 2).join(" · ") : "";
      const msg = [hint, errText].filter(Boolean).join(" ");
      if (msg) updateAptSummaryHint(hintEl, msg);
    } catch (err) {
      updateAptSummaryHint(
        hintEl,
        "K-apt 연동 실패: " + (err?.message || "네트워크 오류")
      );
    }
    return rows;
  }

  function appendAreaTypeToCompareLabel(baseLabel, areaType) {
    const base = String(baseLabel || "").trim() || "-";
    const type = String(areaType || "").trim();
    if (!type) return base;
    const suffix = type.startsWith("-") ? type : `-${type}`;
    if (base.includes(suffix) || base.endsWith(type)) return base;
    return `${base} ${suffix}`;
  }

  global.APT_SUMMARY = {
    getAptBasisApiBase,
    buildFloorPlanIndex,
    buildSummaryRowsFromTrade,
    resolveFloorPlanType,
    resolveFloorPlanTypeForItem,
    renderAptSummaryTable,
    renderAptSummaryWithEnrichment,
    appendAreaTypeToCompareLabel,
    itemMatchesCondition,
    getAptName,
    getAreaFloorValue
  };
})(typeof window !== "undefined" ? window : globalThis);
