/**
 * 2. 아파트 가격Gap분석
 */
(function () {
  const API = window.GAP_API;
  const MOCK = window.GAP_MOCK;
  const P = window.AppStatePersist;
  const FAV = window.GAP_FAV;

  const MAX_CAND_SLOTS = 3;
  const CAND_THEME = {
    1: { color: "#99d98c", cls: "c1", lightText: false },
    2: { color: "#52b69a", cls: "c2", lightText: false },
    3: { color: "#168aad", cls: "c3", lightText: true }
  };
  /** 기준 카드 c5 배경과 동일 */
  const BASELINE_COLOR = "#1e6091";

  const useMock = new URLSearchParams(location.search).get("mock") === "1";
  let gapChart = null;
  let candSlots = [];

  const regionSelect = document.getElementById("regionSelect");
  const monthsSelect = document.getElementById("gapMonths");
  const messageEl = document.getElementById("gapMessage");
  const analyzeBtn = document.getElementById("gapAnalyzeBtn");
  const addCandBtn = document.getElementById("addGapCandBtn");
  const candSlotsRoot = document.getElementById("gapCandSlotsRoot");
  const legendEl = document.getElementById("gapLegend");
  const tableHead = document.getElementById("gapTableHead");
  const tableBody = document.getElementById("gapTableBody");

  const baseline = {
    role: "baseline",
    id: "base",
    guEl: document.getElementById("guSelectBase"),
    dongEl: document.getElementById("dongSelectBase"),
    aptEl: document.getElementById("aptSelectBase"),
    areaEl: document.getElementById("areaSelectBase"),
    starEl: document.querySelector('[data-gap-fav-star="base"]'),
    districtLabelEl: document.getElementById("districtLabelBase")
  };

  function setMessage(text, isError = false) {
    messageEl.textContent = text;
    messageEl.classList.toggle("error", isError);
  }

  function formatKrw(value) {
    if (value == null || !Number.isFinite(value)) return "-";
    return Number(value).toLocaleString("ko-KR") + "만원";
  }

  function formatGap(value) {
    if (value == null || !Number.isFinite(value)) return "-";
    const sign = value > 0 ? "+" : "";
    return sign + value.toLocaleString("ko-KR") + "만원";
  }

  function formatGapAxis(value) {
    if (value == null || !Number.isFinite(value)) return "";
    const n = Number(value);
    const sign = n > 0 ? "+" : "";
    return sign + n.toLocaleString("ko-KR");
  }

  function normalizeDongName(name) {
    return String(name || "").replaceAll(" ", "").trim();
  }

  function getSlotLawdCd(slot) {
    return slot.guEl?.value?.trim() || "";
  }

  function getGuName(slot) {
    return slot.guEl?.selectedOptions?.[0]?.text?.trim() || "";
  }

  function renderSelectOptions(selectEl, items, placeholder) {
    const opts = [`<option value="">${placeholder}</option>`];
    for (const it of items) {
      const v = typeof it === "string" ? it : it.value;
      const l = typeof it === "string" ? it : it.label;
      opts.push(`<option value="${v}">${l}</option>`);
    }
    selectEl.innerHTML = opts.join("");
    selectEl.disabled = false;
  }

  function renderAreaPlaceholder(selectEl, text) {
    selectEl.innerHTML = `<option value="">${text}</option>`;
    selectEl.disabled = true;
  }

  function renderAptOptions(selectEl, names) {
    renderSelectOptions(
      selectEl,
      (names || []).map((n) => ({ value: n, label: n })),
      "선택 안함"
    );
  }

  function getAreaListForApt(data, aptName) {
    const m = data?.areaByApt;
    if (!m || !aptName) return [];
    const v = String(aptName).trim();
    if (Array.isArray(m[v]) && m[v].length) return m[v];
    const key = Object.keys(m).find((k) => String(k).trim() === v);
    return key && Array.isArray(m[key]) ? m[key] : [];
  }

  function resolvePickToDongOption(want, list) {
    const a = String(want || "").trim();
    if (!a) return "";
    if (list.includes(a)) return a;
    const hit = list.find((x) => x.trim() === a || normalizeDongName(x) === normalizeDongName(a));
    return hit || a;
  }

  function resolvePickToAptOption(want, list) {
    const a = String(want || "").trim();
    if (!a) return "";
    if (list.includes(a)) return a;
    return list.find((x) => x.trim() === a) || a;
  }

  function setSelectValue(selectEl, value) {
    if (!selectEl) return;
    selectEl.value = value == null ? "" : String(value);
  }

  function forEachSlot(onSlot) {
    onSlot(baseline);
    candSlots.forEach(onSlot);
  }

  function getGuLabelText() {
    const region = API.REGION_OPTIONS.find((r) => r.code === regionSelect.value);
    return region?.districtLabel || "구";
  }

  function updateDistrictLabels(regionCode) {
    const region = API.REGION_OPTIONS.find((r) => r.code === regionCode);
    const label = region?.districtLabel || "구";
    if (baseline.districtLabelEl) baseline.districtLabelEl.textContent = label;
    candSlots.forEach((s) => {
      if (s.districtLabelEl) s.districtLabelEl.textContent = label;
    });
  }

  function setupSlotGu(slot, regionCode, preferredGu = "") {
    API.setupDistrictSelect(regionSelect, slot.guEl, regionCode, preferredGu);
  }

  function syncAllSlotGuFromRegion(regionCode) {
    forEachSlot((slot) => {
      setupSlotGu(slot, regionCode, slot.guEl?.value || "");
    });
  }

  function clearSlotDownstream(slot) {
    if (slot.dongEl) {
      slot.dongEl.innerHTML = '<option value="">선택 안함</option>';
      slot.dongEl.value = "";
      slot.dongEl.disabled = true;
    }
    renderAptOptions(slot.aptEl, []);
    slot.aptEl.disabled = true;
    renderAreaPlaceholder(slot.areaEl, "아파트를 먼저 선택하세요");
  }

  async function loadDongForSlot(slot) {
    const lawdCd = getSlotLawdCd(slot);
    if (!lawdCd) {
      clearSlotDownstream(slot);
      scheduleSave();
      return;
    }
    slot.dongEl.innerHTML = '<option value="">불러오는 중…</option>';
    slot.dongEl.disabled = true;
    renderAptOptions(slot.aptEl, []);
    renderAreaPlaceholder(slot.areaEl, "아파트를 먼저 선택하세요");
    try {
      const dongs = await API.getDongOptions(lawdCd);
      renderSelectOptions(slot.dongEl, dongs, "선택 안함");
      if (!dongs.length) {
        setMessage("선택한 구에 조회된 동이 없습니다. (최근 실거래 없음)", true);
      }
    } catch (err) {
      slot.dongEl.innerHTML = '<option value="">동 목록 실패</option>';
      slot.dongEl.disabled = false;
      setMessage(`동 목록 조회 실패: ${err.message}`, true);
    }
    scheduleSave();
  }

  async function refreshSlotDongIfGu(slot) {
    if (getSlotLawdCd(slot)) {
      await loadDongForSlot(slot);
    } else {
      clearSlotDownstream(slot);
    }
  }

  function buildSlotLabel(slot) {
    const apt = slot.aptEl?.value?.trim();
    const area = slot.areaEl?.value?.trim();
    const guName = getGuName(slot);
    const parts = [apt, area ? `${area}㎡` : "", guName].filter(Boolean);
    if (parts.length) return parts.join(" ");
    return slot.role === "baseline" ? "기준" : `후보${slot.id}`;
  }

  function readBaseline() {
    return {
      lawdCd: getSlotLawdCd(baseline),
      dong: baseline.dongEl.value.trim(),
      apt: baseline.aptEl.value.trim(),
      area: baseline.areaEl.value.trim(),
      label: buildSlotLabel(baseline)
    };
  }

  function readCandidate(slot) {
    return {
      id: slot.id,
      lawdCd: getSlotLawdCd(slot),
      dong: slot.dongEl.value.trim(),
      apt: slot.aptEl.value.trim(),
      area: slot.areaEl.value.trim(),
      label: buildSlotLabel(slot),
      color: slot.color
    };
  }

  function favoriteEntryFromSlot(slot) {
    return FAV.normalizeFavorite({
      lawdCd: getSlotLawdCd(slot),
      guName: getGuName(slot),
      dong: slot.dongEl.value.trim(),
      apt: slot.aptEl.value.trim(),
      area: slot.areaEl.value.trim()
    });
  }

  function slotTarget(slot) {
    return slot.role === "baseline" ? { role: "baseline" } : { role: "candidate", id: slot.id };
  }

  function getSlotByTarget(target) {
    if (target?.role === "baseline") return baseline;
    return candSlots.find((s) => s.id === target?.id) || null;
  }

  async function updateStarButton(slot) {
    if (!FAV || !slot?.starEl) return;
    try {
      const list = await FAV.readFavorites();
      const entry = favoriteEntryFromSlot(slot);
      const filled = entry.apt && FAV.isFavorite(entry, list);
      slot.starEl.textContent = filled ? "★" : "☆";
      slot.starEl.classList.toggle("filled", filled);
      slot.starEl.title = filled ? "즐겨찾기 해제" : "즐겨찾기 추가";
    } catch {
      /* ignore */
    }
  }

  async function updateAllStarButtons(scope = "all") {
    const targets =
      scope === "baseline"
        ? [baseline]
        : scope === "candidates"
          ? candSlots
          : [baseline, ...candSlots];
    for (const slot of targets) {
      await updateStarButton(slot);
    }
  }

  async function toggleSlotFavorite(slot) {
    const entry = favoriteEntryFromSlot(slot);
    if (!entry.apt) {
      setMessage("아파트를 선택한 뒤 즐겨찾기에 추가해 주세요.", true);
      return;
    }
    if (!entry.lawdCd) {
      setMessage("시군구를 선택해 주세요.", true);
      return;
    }
    try {
      const wasOn = slot.starEl?.classList.contains("filled");
      await FAV.toggleFavorite(entry);
      await updateStarButton(slot);
      setMessage(
        wasOn ? "Gap 즐겨찾기에서 해제했습니다." : "Gap 즐겨찾기에 추가했습니다."
      );
    } catch (err) {
      setMessage(`즐겨찾기 저장 실패: ${err.message}`, true);
    }
  }

  function setupMonthsSelect() {
    if (!monthsSelect) return;
    const items = [
      { value: "6", label: "6개월" },
      { value: "12", label: "12개월" },
      { value: "24", label: "24개월" },
      { value: "36", label: "36개월" }
    ];
    monthsSelect.innerHTML = items
      .map(
        (it) =>
          `<option value="${it.value}"${it.value === "12" ? " selected" : ""}>${it.label}</option>`
      )
      .join("");
  }

  function getMonthCount() {
    const n = Number(monthsSelect?.value);
    return Number.isFinite(n) && n > 0 ? n : 12;
  }

  function getSlotSeriesColor(role, slotId) {
    if (role === "baseline") return BASELINE_COLOR;
    return CAND_THEME[slotId]?.color || "#52b69a";
  }

  function textColorOnBg(hex) {
    const c = String(hex || "").toLowerCase();
    if (c === "#1e6091" || c === "#168aad" || c === "#184e77" || c === "#1a759f") {
      return "#ffffff";
    }
    return "#111111";
  }

  function collectGapPayload() {
    return {
      region: regionSelect?.value || "",
      months: monthsSelect?.value || "12",
      baseline: {
        gu: baseline.guEl.value,
        dong: baseline.dongEl.value,
        apt: baseline.aptEl.value,
        area: baseline.areaEl.value
      },
      candidates: candSlots.map((s) => ({
        id: s.id,
        gu: s.guEl.value,
        dong: s.dongEl.value,
        apt: s.aptEl.value,
        area: s.areaEl.value
      }))
    };
  }

  function saveGapState() {
    if (!P) return;
    const payload = collectGapPayload();
    if (P.saveGapCache) {
      P.saveGapCache(payload);
    } else {
      P.save(P.KEY_GAP, payload);
    }
  }

  function loadGapCache() {
    if (P?.loadGapCache) return P.loadGapCache();
    return P?.load(P.KEY_GAP) ?? null;
  }

  const scheduleSave = P ? P.debounce(saveGapState) : () => {};

  function updateAddCandButton() {
    if (!addCandBtn) return;
    const atMax = candSlots.length >= MAX_CAND_SLOTS;
    addCandBtn.hidden = atMax;
    addCandBtn.disabled = atMax;
  }

  function getNextCandId() {
    const used = new Set(candSlots.map((s) => s.id));
    for (let i = 1; i <= MAX_CAND_SLOTS; i++) {
      if (!used.has(i)) return i;
    }
    return null;
  }

  async function onSlotDongChange(slot) {
    const lawdCd = getSlotLawdCd(slot);
    const dongName = slot.dongEl.value.trim();
    if (!lawdCd || !dongName) {
      renderAptOptions(slot.aptEl, []);
      renderAreaPlaceholder(slot.areaEl, "아파트를 먼저 선택하세요");
      scheduleSave();
      void updateStarButton(slot);
      return;
    }
    slot.aptEl.disabled = true;
    slot.aptEl.innerHTML = '<option value="">아파트 목록 불러오는 중...</option>';
    renderAreaPlaceholder(slot.areaEl, "아파트를 먼저 선택하세요");
    try {
      const data = await API.getAptAreaOptions(lawdCd, dongName);
      renderAptOptions(slot.aptEl, data.aptNames);
    } catch (err) {
      renderAptOptions(slot.aptEl, []);
      setMessage(`아파트 목록 조회 실패: ${err.message}`, true);
    } finally {
      slot.aptEl.disabled = false;
      scheduleSave();
      void updateStarButton(slot);
    }
  }

  async function onSlotAptChange(slot) {
    const lawdCd = getSlotLawdCd(slot);
    const dongName = slot.dongEl.value.trim();
    const apt = slot.aptEl.value.trim();
    if (!lawdCd || !dongName || !apt) {
      renderAreaPlaceholder(slot.areaEl, "아파트를 먼저 선택하세요");
      scheduleSave();
      void updateStarButton(slot);
      return;
    }
    try {
      const data = await API.getAptAreaOptions(lawdCd, dongName);
      const areas = getAreaListForApt(data, apt);
      renderSelectOptions(
        slot.areaEl,
        areas.map((a) => ({ value: a, label: `${a}㎡` })),
        "전체"
      );
    } catch (err) {
      setMessage(`평형 목록 조회 실패: ${err.message}`, true);
    }
    scheduleSave();
    void updateStarButton(slot);
  }

  function bindSlotEvents(slot) {
    slot.guEl.addEventListener("change", () => {
      void refreshSlotDongIfGu(slot);
    });
    slot.dongEl.addEventListener("change", () => onSlotDongChange(slot));
    slot.aptEl.addEventListener("change", () => onSlotAptChange(slot));
    slot.areaEl.addEventListener("change", () => {
      scheduleSave();
      void updateStarButton(slot);
    });
    slot.starEl?.addEventListener("click", (e) => {
      e.preventDefault();
      void toggleSlotFavorite(slot);
    });
  }

  function buildSlotGuHtml(slotId, favKey, guLabel, removeBtnHtml = "") {
    return (
      '<div class="field field-compact">' +
      '<div class="field-label-row gap-gu-label-row">' +
      removeBtnHtml +
      `<button type="button" class="star-btn" data-gap-fav-star="${favKey}" title="즐겨찾기 추가/해제" aria-label="즐겨찾기">☆</button>` +
      `<label for="guSelect${slotId}" id="districtLabel${slotId}">${guLabel}</label>` +
      "</div>" +
      `<select id="guSelect${slotId}"></select></div>`
    );
  }

  function buildSlotAreaHtml(slotId, favKey) {
    return (
      '<div class="field field-compact field-area-col">' +
      '<div class="field-label-row field-label-row-right gap-area-label-row">' +
      `<label for="areaSelect${slotId}">평형</label>` +
      '<span class="gap-fav-pick-wrap">' +
      `<button type="button" class="btn-link btn-fav-pick" data-gap-fav-pick="${favKey}"><span class="btn-fav-pick-icon" aria-hidden="true">★</span><span class="btn-fav-pick-text">찜에서 선택</span></button>` +
      "</span></div>" +
      `<select id="areaSelect${slotId}"><option value="">전체</option></select></div>`
    );
  }

  function buildCandCard(slotId) {
    const theme = CAND_THEME[slotId] || CAND_THEME[1];
    const guLabel = getGuLabelText();
    const card = document.createElement("div");
    card.className = "compare-card " + theme.cls;
    card.dataset.compareSlot = String(slotId);
    const removeBtn =
      slotId > 1
        ? `<button type="button" class="btn-slot-remove" data-remove-cand="${slotId}" aria-label="후보 ${slotId} 삭제" title="삭제">×</button>`
        : "";
    card.innerHTML =
      '<div class="compare-grid row-fields gap-slot-grid">' +
      buildSlotGuHtml(slotId, String(slotId), guLabel, removeBtn) +
      '<div class="field field-compact">' +
      '<div class="field-label-row">' +
      `<label for="dongSelect${slotId}">동</label></div>` +
      `<select id="dongSelect${slotId}"><option value="">선택 안함</option></select></div>` +
      '<div class="field field-compact">' +
      `<label for="aptSelect${slotId}">아파트</label>` +
      `<select id="aptSelect${slotId}"><option value="">선택 안함</option></select></div>` +
      buildSlotAreaHtml(slotId, String(slotId)) +
      "</div>";
    const slot = {
      role: "candidate",
      id: slotId,
      color: theme.color,
      cardEl: card,
      guEl: card.querySelector(`#guSelect${slotId}`),
      dongEl: card.querySelector(`#dongSelect${slotId}`),
      aptEl: card.querySelector(`#aptSelect${slotId}`),
      areaEl: card.querySelector(`#areaSelect${slotId}`),
      starEl: card.querySelector(`[data-gap-fav-star="${slotId}"]`),
      districtLabelEl: card.querySelector(`#districtLabel${slotId}`)
    };
    setupSlotGu(slot, regionSelect.value, "");
    if (slot.districtLabelEl) slot.districtLabelEl.textContent = getGuLabelText();
    return slot;
  }

  function addCandSlot() {
    if (candSlots.length >= MAX_CAND_SLOTS) return null;
    const slotId = getNextCandId();
    if (!slotId) return null;
    const slot = buildCandCard(slotId);
    candSlots.push(slot);
    candSlotsRoot.appendChild(slot.cardEl);
    bindSlotEvents(slot);
    void refreshSlotDongIfGu(slot);
    updateAddCandButton();
    scheduleSave();
    void updateStarButton(slot);
    return slot;
  }

  function removeCandSlot(slotId) {
    if (slotId <= 1) return;
    const idx = candSlots.findIndex((s) => s.id === slotId);
    if (idx < 0) return;
    candSlots[idx].cardEl.remove();
    candSlots.splice(idx, 1);
    updateAddCandButton();
    scheduleSave();
    setMessage(`매수 후보 ${slotId} 영역을 삭제했습니다.`);
  }

  async function fillSlotFromSaved(slot, saved) {
    if (!saved) return;
    if (saved.gu) {
      setupSlotGu(slot, regionSelect.value, saved.gu);
      await loadDongForSlot(slot);
    }
    if (saved.dong) {
      setSelectValue(slot.dongEl, saved.dong);
      await onSlotDongChange(slot);
    }
    if (saved.apt) {
      setSelectValue(slot.aptEl, saved.apt);
      await onSlotAptChange(slot);
    }
    if (saved.area) setSelectValue(slot.areaEl, saved.area);
  }

  function migrateLegacySaved(saved) {
    if (!saved) return null;
    if (saved.baseline?.gu != null || saved.baseline?.dong != null) {
      if (!saved.baseline.gu && saved.gu) saved.baseline.gu = saved.gu;
      return saved;
    }
    if (!saved.slots) return saved;
    const out = { region: saved.region || "", baseline: {}, candidates: [] };
    const legacy = saved.slots;
    if (legacy.base) {
      out.region = legacy.base.region || out.region;
      out.baseline = {
        gu: legacy.base.gu || saved.gu || "",
        dong: legacy.base.dong,
        apt: legacy.base.apt,
        area: legacy.base.area
      };
    } else if (saved.gu) {
      out.baseline.gu = saved.gu;
    }
    const order = ["cand1", "cand2", "cand3"];
    let id = 1;
    for (const key of order) {
      const row = legacy[key];
      if (!row || (!row.apt && !row.dong && !row.gu)) continue;
      out.candidates.push({
        id: id++,
        gu: row.gu || saved.gu || "",
        dong: row.dong,
        apt: row.apt,
        area: row.area
      });
    }
    return out;
  }

  async function restoreGapState() {
    const raw = loadGapCache();
    const saved = migrateLegacySaved(raw);
    if (!saved) return false;

    if (saved.region) {
      regionSelect.value = saved.region;
      updateDistrictLabels(saved.region);
      syncAllSlotGuFromRegion(saved.region);
    }
    if (saved.months && monthsSelect) {
      monthsSelect.value = String(saved.months);
    }

    await fillSlotFromSaved(baseline, saved.baseline);
    /* 매수 후보는 즐겨찾기 DB·캐시에서 자동 복원하지 않음 — 사용자가 [아파트 추가+]로 직접 추가 */
    return true;
  }

  async function applyFavoriteToSlot(target, fav) {
    const slot = getSlotByTarget(target);
    if (!slot) return;

    const lawdCd = String(fav.lawdCd || "").trim();
    const regionCode = API.findRegionCodeByLawdCd(lawdCd) || regionSelect.value;

    if (regionCode !== regionSelect.value) {
      regionSelect.value = regionCode;
      updateDistrictLabels(regionCode);
      syncAllSlotGuFromRegion(regionCode);
    }

    setupSlotGu(slot, regionCode, lawdCd);
    await loadDongForSlot(slot);

    const dongList = [...slot.dongEl.options].map((o) => o.value).filter(Boolean);
    const resolvedDong = resolvePickToDongOption(fav.dong, dongList);
    if (resolvedDong && ![...slot.dongEl.options].some((o) => o.value === resolvedDong)) {
      const opt = document.createElement("option");
      opt.value = resolvedDong;
      opt.textContent = resolvedDong;
      slot.dongEl.appendChild(opt);
    }
    setSelectValue(slot.dongEl, resolvedDong);

    const data = await API.getAptAreaOptions(lawdCd, resolvedDong);
    renderAptOptions(slot.aptEl, data.aptNames);
    const resolvedApt = resolvePickToAptOption(fav.apt, data.aptNames);
    setSelectValue(slot.aptEl, resolvedApt);

    if (resolvedApt) {
      const areas = getAreaListForApt(data, resolvedApt);
      renderSelectOptions(
        slot.areaEl,
        areas.map((a) => ({ value: a, label: `${a}㎡` })),
        "전체"
      );
      if (fav.area) setSelectValue(slot.areaEl, String(fav.area));
    } else {
      renderAreaPlaceholder(slot.areaEl, "아파트를 먼저 선택하세요");
    }

    scheduleSave();
    await updateStarButton(slot);
    const label = target.role === "baseline" ? "기준" : `후보 ${target.id}`;
    setMessage(`${label}에 찜 단지를 적용했습니다.`);
  }

  function setupRegionOnly() {
    API.setupRegionSelect(regionSelect, "seoul");
    setupMonthsSelect();
    setupSlotGu(baseline, regionSelect.value, "");
    updateDistrictLabels(regionSelect.value);

    monthsSelect?.addEventListener("change", scheduleSave);

    regionSelect.addEventListener("change", async () => {
      const regionCode = regionSelect.value;
      updateDistrictLabels(regionCode);
      syncAllSlotGuFromRegion(regionCode);
      for (const slot of [baseline, ...candSlots]) {
        await refreshSlotDongIfGu(slot);
      }
      setMessage("시/도가 변경되었습니다. 구·동 목록을 갱신했습니다.");
      scheduleSave();
    });
  }

  async function fetchGapAnalysis(baselineRow, candidates) {
    const monthCount = getMonthCount();
    const quarters = API.buildQuarterLabels(monthCount);

    if (useMock && MOCK) {
      return MOCK.buildMockGapAnalysis(
        { label: baselineRow.label },
        candidates.map((c) => ({ label: c.label }))
      );
    }

    const months = API.buildTargetMonths(monthCount);
    const baseItems = await API.fetchTradeItemsForLawdMonths(baselineRow.lawdCd, months);
    const baseMap = API.aggregateQuarterlyAverage(baseItems, baselineRow);

    const series = [
      {
        id: "baseline",
        label: baselineRow.label,
        aptName: baselineRow.apt,
        color: getSlotSeriesColor("baseline"),
        role: "baseline",
        byQuarter: baseMap
      }
    ];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const items = await API.fetchTradeItemsForLawdMonths(c.lawdCd, months);
      series.push({
        id: "cand" + c.id,
        label: c.label,
        aptName: c.apt,
        color: getSlotSeriesColor("candidate", c.id),
        role: "candidate",
        byQuarter: API.aggregateQuarterlyAverage(items, c)
      });
    }

    const rows = quarters.map((qk) => {
      const basePrice = baseMap[qk] ?? null;
      const cells = series.slice(1).map((s) => {
        const price = s.byQuarter[qk] ?? null;
        const gap = price != null && basePrice != null ? price - basePrice : null;
        return { price, gap };
      });
      return { quarter: qk, basePrice, cells };
    });

    return { quarters, series, rows, isMock: false };
  }

  function renderLegend(series) {
    const lineItems = series.map(
      (s) =>
        `<span class="gap-legend-item"><span class="gap-legend-dot" style="background:${s.color}"></span>${s.label}</span>`
    );
    const barItems = series
      .filter((s) => s.role === "candidate")
      .map(
        (s) =>
          `<span class="gap-legend-item"><span class="gap-legend-bar" style="background:${s.color}"></span>${s.label} 차액</span>`
      );
    legendEl.innerHTML = [...lineItems, ...barItems].join("");
  }

  function buildGapBarDatasets(analysis) {
    const labels = analysis.quarters;
    const candSeries = analysis.series.filter((s) => s.role === "candidate");
    const groupCount = Math.max(candSeries.length, 1);

    return candSeries.map((s, idx) => ({
      type: "bar",
      yAxisID: "yGap",
      label: `${s.label} 차액`,
      data: labels.map((_, qi) => analysis.rows[qi]?.cells[idx]?.gap ?? null),
      backgroundColor: s.color + "b3",
      borderColor: s.color,
      borderWidth: 1,
      borderRadius: 2,
      order: 2,
      barPercentage: groupCount > 1 ? 0.82 : 0.55,
      categoryPercentage: groupCount > 1 ? 0.72 : 0.5
    }));
  }

  function buildPriceLineDatasets(analysis) {
    const labels = analysis.quarters;
    return analysis.series.map((s) => ({
      type: "line",
      yAxisID: "yPrice",
      label: s.label,
      data: labels.map((qk) => s.byQuarter[qk] ?? null),
      borderColor: s.color,
      backgroundColor: s.color + "33",
      borderWidth: s.role === "baseline" ? 3 : 2,
      tension: 0.25,
      spanGaps: true,
      pointRadius: 3,
      order: 1
    }));
  }

  function renderChart(analysis) {
    const ctx = document.getElementById("gapChart");
    if (gapChart) gapChart.destroy();
    const labels = analysis.quarters;
    const barDatasets = buildGapBarDatasets(analysis);
    const lineDatasets = buildPriceLineDatasets(analysis);

    gapChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [...barDatasets, ...lineDatasets]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const y = ctx.parsed.y;
                if (y == null || !Number.isFinite(y)) return null;
                return ctx.dataset.yAxisID === "yGap"
                  ? `${ctx.dataset.label}: ${formatGap(y)}`
                  : `${ctx.dataset.label}: ${formatKrw(y)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false }
          },
          yGap: {
            type: "linear",
            position: "left",
            title: { display: true, text: "차액 (만원)" },
            ticks: {
              callback: (v) => formatGapAxis(v)
            },
            grid: { color: "rgba(15, 23, 42, 0.06)" }
          },
          yPrice: {
            type: "linear",
            position: "right",
            title: { display: true, text: "평균 실거래가 (만원)" },
            ticks: {
              callback: (v) => Number(v).toLocaleString("ko-KR")
            },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderTable(analysis) {
    const baselineSeries = analysis.series[0];
    const candSeries = analysis.series.slice(1);
    const baseBg = baselineSeries?.color || BASELINE_COLOR;
    const baseFg = textColorOnBg(baseBg);

    let head = `<tr><th class="gap-th-quarter">분기</th><th class="gap-th-baseline" style="background:${baseBg};color:${baseFg}">[기준 아파트]</th>`;
    candSeries.forEach((s) => {
      const bg = s.color;
      const fg = textColorOnBg(bg);
      const apt = escapeHtml(String(s.aptName || "비교").trim() || "비교");
      head +=
        `<th class="gap-th-cand" style="background:${bg};color:${fg}" title="${apt}">` +
        `<span class="gap-th-cand-inner"><span class="gap-th-apt">${apt}</span>` +
        `<span class="gap-th-gap-label">(차액)</span></span></th>`;
    });
    head += "</tr>";
    tableHead.innerHTML = head;

    if (!analysis.rows.length) {
      tableBody.innerHTML =
        '<tr class="empty-row"><td colspan="99">분기별 데이터가 없습니다.</td></tr>';
      return;
    }

    tableBody.innerHTML = analysis.rows
      .map((row) => {
        let tr = `<tr><td class="gap-td-quarter">${row.quarter}</td><td class="gap-td-baseline" style="background:${baseBg};color:${baseFg}">${formatKrw(row.basePrice)}</td>`;
        row.cells.forEach((cell, idx) => {
          const s = candSeries[idx];
          const bg = s?.color || "#52b69a";
          const fg = textColorOnBg(bg);
          const gapClass =
            cell.gap == null ? "" : cell.gap > 0 ? "gap-positive" : cell.gap < 0 ? "gap-negative" : "";
          const onDarkGap = fg === "#ffffff" && gapClass;
          const tdClass = ["gap-td-cand", gapClass, onDarkGap ? "gap-gap-on-dark" : ""]
            .filter(Boolean)
            .join(" ");
          const colorStyle = gapClass ? "" : `color:${fg};`;
          tr += `<td class="${tdClass}" style="background:${bg};${colorStyle}">${formatGap(cell.gap)}</td>`;
        });
        return tr + "</tr>";
      })
      .join("");
  }

  async function runAnalysis() {
    const baselineRow = readBaseline();
    const candidates = candSlots.map(readCandidate).filter((c) => c.apt);

    if (!baselineRow.lawdCd || !baselineRow.apt) {
      setMessage("기준의 시군구·아파트를 선택해 주세요.", true);
      return;
    }
    if (!candidates.length) {
      setMessage("매수 후보를 1개 이상 추가·선택해 주세요.", true);
      return;
    }
    for (const c of candidates) {
      if (!c.lawdCd) {
        setMessage(`후보 ${c.id}의 시군구를 선택해 주세요.`, true);
        return;
      }
    }

    analyzeBtn.disabled = true;
    setMessage("분기별 평균 실거래가를 계산하는 중…");
    saveGapState();

    try {
      const analysis = await fetchGapAnalysis(baselineRow, candidates);
      renderLegend(analysis.series);
      renderChart(analysis);
      renderTable(analysis);
      const suffix = analysis.isMock ? " (Mock)" : "";
      setMessage(`Gap 분석 완료 (${analysis.quarters.length}개 분기)${suffix}`);
    } catch (err) {
      setMessage(`분석 실패: ${err.message}`, true);
    } finally {
      analyzeBtn.disabled = false;
    }
  }

  function bindUiDelegates() {
    document.body.addEventListener("click", (e) => {
      const rm = e.target.closest("[data-remove-cand]");
      if (rm) {
        removeCandSlot(Number(rm.getAttribute("data-remove-cand")));
        return;
      }
      const pick = e.target.closest("[data-gap-fav-pick]");
      if (pick && FAV) {
        const key = pick.getAttribute("data-gap-fav-pick");
        const target =
          key === "base"
            ? { role: "baseline" }
            : { role: "candidate", id: Number(key) };
        void FAV.openPickModal(target, pick);
      }
    });

    addCandBtn?.addEventListener("click", () => {
      const slot = addCandSlot();
      if (slot) setMessage(`매수 후보 영역이 추가되었습니다. (후보 ${candSlots.length})`);
    });

    analyzeBtn.addEventListener("click", runAnalysis);
  }

  async function boot() {
    if (useMock) setMessage("Mock 모드 (?mock=1)");

    await API.initApiBase();
    setupRegionOnly();
    bindSlotEvents(baseline);
    bindUiDelegates();
    updateAddCandButton();

    if (FAV) {
      FAV.init({
        setMessage,
        applyFavorite: applyFavoriteToSlot,
        onFavoritesChanged: () => updateAllStarButtons("baseline")
      });
    }

    if (candSlots.length === 0) {
      addCandSlot();
    }

    const restored = await restoreGapState();
    if (!restored) {
      await refreshSlotDongIfGu(baseline);
    }
    saveGapState();
    await updateAllStarButtons();
  }

  boot();
})();
