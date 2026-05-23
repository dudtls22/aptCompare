/**
 * 2. 아파트 가격Gap분석
 */
(function () {
  const API = window.GAP_API;
  const MOCK = window.GAP_MOCK;
  const P = window.AppStatePersist;
  const FAV = window.GAP_FAV;
  const APT_SUM = window.APT_SUMMARY;

  const MAX_CAND_SLOTS = 3;
  /** 1번 화면 SLOT_THEME 과 동일 순서: 1·2·3=후보, 5=기준 */
  const CAND_THEME = {
    1: { color: "#a1c181", cls: "c1", lightText: false },
    2: { color: "#619b8a", cls: "c2", lightText: true },
    3: { color: "#fcca46", cls: "c3", lightText: false }
  };
  const BASELINE_COLOR = "#233d4d";

  const useMock = new URLSearchParams(location.search).get("mock") === "1";
  let gapChart = null;
  let candSlots = [];

  const regionSelect = document.getElementById("regionSelect");
  const monthsSelect = document.getElementById("gapMonths");
  const messageEl = document.getElementById("gapMessage");
  const analyzeBtn = document.getElementById("gapAnalyzeBtn");
  const gapRestoreHint = document.getElementById("gapRestoreHint");
  const addCandBtn = document.getElementById("addGapCandBtn");
  const candSlotsRoot = document.getElementById("gapCandSlotsRoot");
  const legendEl = document.getElementById("gapLegend");
  const tableHead = document.getElementById("gapTableHead");
  const tableBody = document.getElementById("gapTableBody");
  const gapAptSummaryBody = document.getElementById("gapAptSummaryBody");
  const gapAptSummaryHint = document.getElementById("gapAptSummaryHint");

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

  function buildSlotLabel(slot, areaType) {
    const apt = slot.aptEl?.value?.trim();
    const area = slot.areaEl?.value?.trim();
    const guName = getGuName(slot);
    const parts = [apt, area ? `${area}㎡` : "", guName].filter(Boolean);
    let label = parts.length ? parts.join(" ") : "";
    if (label && areaType && APT_SUM) {
      label = APT_SUM.appendAreaTypeToCompareLabel(label, areaType);
    }
    if (label) return label;
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
    return CAND_THEME[slotId]?.color || "#619b8a";
  }

  function textColorOnBg(hex) {
    const c = String(hex || "").toLowerCase();
    if (c === "#233d4d" || c === "#619b8a") {
      return "#f8fafc";
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

  function addSelectOptionIfMissing(selectEl, value, label) {
    const v = String(value || "").trim();
    if (!v || !selectEl) return;
    if ([...selectEl.options].some((o) => o.value === v)) return;
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = label || v;
    selectEl.appendChild(opt);
  }

  async function fillSlotFromSaved(slot, saved) {
    if (!saved) return;

    const lawdCd = String(saved.gu || "").trim();
    if (lawdCd) {
      setupSlotGu(slot, regionSelect.value, lawdCd);
      await loadDongForSlot(slot);
    }

    const dongList = [...slot.dongEl.options].map((o) => o.value).filter(Boolean);
    const resolvedDong = resolvePickToDongOption(saved.dong, dongList);
    if (resolvedDong) {
      addSelectOptionIfMissing(slot.dongEl, resolvedDong, resolvedDong);
      setSelectValue(slot.dongEl, resolvedDong);
      await onSlotDongChange(slot);
    }

    const slotLawd = getSlotLawdCd(slot);
    const dongName = slot.dongEl.value.trim();
    if (saved.apt && slotLawd && dongName) {
      try {
        const data = await API.getAptAreaOptions(slotLawd, dongName);
        const resolvedApt = resolvePickToAptOption(saved.apt, data.aptNames);
        if (resolvedApt) {
          addSelectOptionIfMissing(slot.aptEl, resolvedApt, resolvedApt);
          setSelectValue(slot.aptEl, resolvedApt);
          await onSlotAptChange(slot);
          if (saved.area) {
            const areas = getAreaListForApt(data, resolvedApt);
            const areaStr = String(saved.area);
            if (areas.map((a) => String(a)).includes(areaStr)) {
              setSelectValue(slot.areaEl, areaStr);
            } else {
              addSelectOptionIfMissing(slot.areaEl, areaStr, `${areaStr}㎡`);
              setSelectValue(slot.areaEl, areaStr);
            }
          }
        }
      } catch {
        addSelectOptionIfMissing(slot.aptEl, saved.apt, saved.apt);
        setSelectValue(slot.aptEl, saved.apt);
        if (saved.area) {
          addSelectOptionIfMissing(slot.areaEl, String(saved.area), `${saved.area}㎡`);
          setSelectValue(slot.areaEl, String(saved.area));
        }
      }
    }

    void updateStarButton(slot);
  }

  function indexCacheToGapPayload(indexSaved) {
    if (!indexSaved) return null;
    const slots = (indexSaved.slots || []).filter(
      (r) => r && (r.dong || r.apt || r.area)
    );
    const hasCommon =
      indexSaved.region || indexSaved.gu || indexSaved.months || slots.length;
    if (!hasCommon) return null;

    const sorted = [...slots].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    const baseline = {
      gu: String(indexSaved.gu || "").trim(),
      dong: "",
      apt: "",
      area: ""
    };
    const candidates = [];

    if (sorted.length) {
      const first = sorted[0];
      baseline.dong = first.dong || "";
      baseline.apt = first.apt || "";
      baseline.area = first.area || "";
      for (let i = 1; i < sorted.length && candidates.length < MAX_CAND_SLOTS; i++) {
        const row = sorted[i];
        candidates.push({
          id: candidates.length + 1,
          gu: baseline.gu,
          dong: row.dong || "",
          apt: row.apt || "",
          area: row.area || ""
        });
      }
    }

    return {
      region: indexSaved.region || "",
      months: indexSaved.months || "12",
      baseline,
      candidates
    };
  }

  function hasSavedGapPayload(saved) {
    if (!saved) return false;
    if (saved.region || saved.months) return true;
    if (hasSavedSlotValues(saved.baseline)) return true;
    return (saved.candidates || []).some(hasSavedSlotValues);
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

  function hasSavedSlotValues(row) {
    return !!(row && (row.gu || row.dong || row.apt || row.area));
  }

  async function restoreCandidatesFromSaved(savedCandidates) {
    const rows = (savedCandidates || [])
      .filter(hasSavedSlotValues)
      .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    if (!rows.length) return;

    const maxId = Math.min(
      MAX_CAND_SLOTS,
      Math.max(1, ...rows.map((r) => Number(r.id) || 1))
    );
    while (candSlots.length < maxId) {
      if (!addCandSlot()) break;
    }

    for (const row of rows) {
      const slot = candSlots.find((s) => s.id === Number(row.id));
      if (slot) await fillSlotFromSaved(slot, row);
    }
    updateAddCandButton();
  }

  function loadSavedGapPayload() {
    const raw = loadGapCache();
    let saved = migrateLegacySaved(raw);
    if (!hasSavedGapPayload(saved) && P?.loadIndexCache) {
      const fromIndex = indexCacheToGapPayload(P.loadIndexCache());
      if (fromIndex) saved = fromIndex;
    }
    return saved;
  }

  async function restoreGapState() {
    const saved = loadSavedGapPayload();
    if (!hasSavedGapPayload(saved)) return false;

    if (saved.region) {
      regionSelect.value = saved.region;
      updateDistrictLabels(saved.region);
    }
    if (saved.months && monthsSelect) {
      monthsSelect.value = String(saved.months);
    }

    await fillSlotFromSaved(baseline, saved.baseline);
    await restoreCandidatesFromSaved(saved.candidates);
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
      const mock = MOCK.buildMockGapAnalysis(
        { label: baselineRow.label, aptName: baselineRow.apt },
        candidates.map((c) => ({ label: c.label, aptName: c.apt }))
      );
      mock.summaryConditions = [
        {
          lawdCd: baselineRow.lawdCd,
          dong: baselineRow.dong,
          apt: baselineRow.apt,
          area: baselineRow.area
        },
        ...candidates.map((c) => ({
          lawdCd: c.lawdCd,
          dong: c.dong,
          apt: c.apt,
          area: c.area
        }))
      ];
      mock.allItems = [];
      return mock;
    }

    const months = API.buildTargetMonths(monthCount);
    const baseItems = await API.fetchTradeItemsForLawdMonths(baselineRow.lawdCd, months);
    const baseMap = API.aggregateQuarterlyAverage(baseItems, baselineRow);
    let allItems = [...baseItems];
    const candPayloads = [];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const items = await API.fetchTradeItemsForLawdMonths(c.lawdCd, months);
      allItems = allItems.concat(items);
      candPayloads.push({ c, items });
    }

    const planIndex = APT_SUM ? APT_SUM.buildFloorPlanIndex(allItems) : null;
    const baselineCond = {
      lawdCd: baselineRow.lawdCd,
      dong: baselineRow.dong,
      apt: baselineRow.apt,
      area: baselineRow.area
    };
    const baselineAreaType =
      planIndex && APT_SUM
        ? APT_SUM.resolveFloorPlanType(
            planIndex,
            baselineRow.apt,
            baselineRow.area,
            allItems,
            baselineCond
          )
        : "";

    const series = [
      {
        id: "baseline",
        label: buildSlotLabel(baseline, baselineAreaType),
        aptName: baselineRow.apt,
        areaType: baselineAreaType,
        color: getSlotSeriesColor("baseline"),
        role: "baseline",
        byQuarter: baseMap
      }
    ];

    for (const { c, items } of candPayloads) {
      const slot = candSlots.find((s) => s.id === c.id);
      const candCond = {
        lawdCd: c.lawdCd,
        dong: c.dong,
        apt: c.apt,
        area: c.area
      };
      const areaType =
        planIndex && APT_SUM
          ? APT_SUM.resolveFloorPlanType(planIndex, c.apt, c.area, allItems, candCond)
          : "";
      series.push({
        id: "cand" + c.id,
        label: slot ? buildSlotLabel(slot, areaType) : c.label,
        aptName: c.apt,
        areaType,
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

    const summaryConditions = [
      {
        lawdCd: baselineRow.lawdCd,
        dong: baselineRow.dong,
        apt: baselineRow.apt,
        area: baselineRow.area
      },
      ...candidates.map((c) => ({
        lawdCd: c.lawdCd,
        dong: c.dong,
        apt: c.apt,
        area: c.area
      }))
    ];

    return { quarters, series, rows, allItems, summaryConditions, isMock: false };
  }

  function aptDisplayName(s) {
    const apt = String(s.aptName || "").trim();
    const type = String(s.areaType || "").trim();
    if (!apt) return "";
    return type && APT_SUM ? APT_SUM.appendAreaTypeToCompareLabel(apt, type) : apt;
  }

  function legendNameForSeries(s) {
    const apt = aptDisplayName(s);
    if (s.role === "baseline") {
      return apt ? `${apt} (기준)` : "기준";
    }
    return apt || String(s.label || "").trim() || "비교";
  }

  function renderLegend(series) {
    if (!legendEl) return;
    legendEl.innerHTML = series
      .map((s) => {
        const text = escapeHtml(legendNameForSeries(s));
        const icon =
          s.role === "baseline"
            ? `<span class="gap-legend-bar" style="background:${s.color}"></span>`
            : `<span class="gap-legend-dot" style="background:${s.color}"></span>`;
        return `<span class="gap-legend-item">${icon}${text}</span>`;
      })
      .join("");
  }

  /** 기준 아파트 평균 실거래가 — 막대(우측 축) */
  function buildBaselinePriceBarDataset(analysis) {
    const baseline = analysis.series.find((s) => s.role === "baseline");
    if (!baseline) return [];
    const labels = analysis.quarters;
    return [
      {
        type: "bar",
        yAxisID: "yPrice",
        label: legendNameForSeries(baseline),
        data: labels.map((qk) => baseline.byQuarter[qk] ?? null),
        backgroundColor: baseline.color + "b3",
        borderColor: baseline.color,
        borderWidth: 1,
        borderRadius: 2,
        order: 1,
        barPercentage: 0.45,
        categoryPercentage: 0.55
      }
    ];
  }

  /** 후보 아파트 Gap — 꺾은선(좌측 축), 가격 꺾은선 없음 */
  function buildGapLineDatasets(analysis) {
    const labels = analysis.quarters;
    const candSeries = analysis.series.filter((s) => s.role === "candidate");
    return candSeries.map((s, idx) => ({
      type: "line",
      yAxisID: "yGap",
      label: `${legendNameForSeries(s)} 차액`,
      data: labels.map((_, qi) => analysis.rows[qi]?.cells[idx]?.gap ?? null),
      borderColor: s.color,
      backgroundColor: s.color + "33",
      borderWidth: 3.5,
      tension: 0.25,
      spanGaps: true,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointHitRadius: 12,
      order: 2
    }));
  }

  function renderChart(analysis) {
    const ctx = document.getElementById("gapChart");
    if (gapChart) gapChart.destroy();
    const labels = analysis.quarters;
    const barDatasets = buildBaselinePriceBarDataset(analysis);
    const lineDatasets = buildGapLineDatasets(analysis);

    gapChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [...barDatasets, ...lineDatasets]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: true, axis: "xy" },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "nearest",
            intersect: true,
            callbacks: {
              label: (ctx) => {
                const y = ctx.parsed.y;
                if (y == null || !Number.isFinite(y)) return null;
                if (ctx.dataset.yAxisID === "yPrice") {
                  return `${ctx.dataset.label}: ${formatKrw(y)}`;
                }
                return `${ctx.dataset.label}: ${formatGap(y)}`;
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

    const baseApt = escapeHtml(
      aptDisplayName(baselineSeries) ||
        String(baselineSeries?.aptName || "아파트명").trim() ||
        "아파트명"
    );
    let head =
      `<tr><th class="gap-th-quarter">분기</th>` +
      `<th class="gap-th-baseline" style="background:${baseBg};color:${baseFg}" title="${baseApt}">` +
      `<span class="gap-th-cand-inner"><span class="gap-th-apt">${baseApt}</span>` +
      `<span class="gap-th-gap-label">(기준)</span></span></th>`;
    candSeries.forEach((s) => {
      const bg = s.color;
      const fg = textColorOnBg(bg);
      const apt = escapeHtml(aptDisplayName(s) || String(s.aptName || "비교").trim() || "비교");
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
          const bg = s?.color || "#619b8a";
          const fg = textColorOnBg(bg);
          const gapClass =
            cell.gap == null ? "" : cell.gap > 0 ? "gap-positive" : cell.gap < 0 ? "gap-negative" : "";
          const onDarkGap = fg === "#f8fafc" && gapClass;
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
      if (APT_SUM && gapAptSummaryBody && analysis.summaryConditions?.length) {
        void APT_SUM.renderAptSummaryWithEnrichment(
          gapAptSummaryBody,
          analysis.summaryConditions,
          analysis.allItems || [],
          gapAptSummaryHint
        );
      }
      saveGapState();
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

    window.addEventListener("pagehide", () => saveGapState());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveGapState();
    });
  }

  function setGapRestoreUi(active) {
    if (gapRestoreHint) gapRestoreHint.hidden = !active;
    if (analyzeBtn) analyzeBtn.disabled = active;
  }

  function hasGapCacheToRestore() {
    return hasSavedGapPayload(loadSavedGapPayload());
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

    const shouldRestoreGap = hasGapCacheToRestore();
    if (shouldRestoreGap) setGapRestoreUi(true);

    try {
      const restored = await restoreGapState();
      if (!restored) {
        await refreshSlotDongIfGu(baseline);
      }
    } finally {
      setGapRestoreUi(false);
    }

    if (candSlots.length === 0) {
      addCandSlot();
    }

    saveGapState();
    await updateAllStarButtons();
  }

  boot();
})();
