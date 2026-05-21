/**
 * 화면 간 이동 시 입력값 유지 (sessionStorage)
 */
(function (global) {
  const KEY_INDEX = "aptCompare.index.v1";
  const KEY_GAP = "aptCompare.gap.v1";
  const KEY_GAP_CACHE = "aptCompare.gap.cache.v1";

  function save(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* ignore quota */
    }
  }

  function load(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function readSelect(id) {
    const el = document.getElementById(id);
    if (!el) return "";
    return String(el.value ?? "");
  }

  function writeSelect(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value == null ? "" : String(value);
  }

  function debounce(fn, ms = 400) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function collectIndexState(slots) {
    const slotData = (slots || []).map((s) => ({
      id: s.id,
      dong: readSelect("dongSelect" + s.id),
      apt: readSelect("aptSelect" + s.id),
      area: readSelect("areaSelect" + s.id)
    }));
    return {
      region: readSelect("regionSelect"),
      gu: readSelect("guSelect"),
      months: readSelect("months"),
      slots: slotData
    };
  }

  function loadGapCache() {
    const fromSession = load(KEY_GAP);
    if (fromSession) return fromSession;
    try {
      const raw = localStorage.getItem(KEY_GAP_CACHE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveGapCache(data) {
    save(KEY_GAP, data);
    try {
      localStorage.setItem(KEY_GAP_CACHE, JSON.stringify(data));
    } catch {
      /* ignore quota */
    }
  }

  global.AppStatePersist = {
    KEY_INDEX,
    KEY_GAP,
    KEY_GAP_CACHE,
    loadGapCache,
    saveGapCache,
    save,
    load,
    readSelect,
    writeSelect,
    debounce,
    collectIndexState
  };
})(typeof window !== "undefined" ? window : globalThis);
