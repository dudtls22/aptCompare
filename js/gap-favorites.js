/**
 * Gap 화면 전용 즐겨찾기 (1번 화면 DB와 분리)
 */
(function (global) {
  const CLIENT_ID_KEY = "aptCompareGapClientId";
  const MIRROR_KEY = "aptCompareGapFavoritesMirror";
  const API_PATH = "/api/gap-favorites";

  let onMessage = () => {};

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function normalizeDongName(name) {
    return String(name || "").replaceAll(" ", "").trim();
  }

  function normalizeFavorite(entry) {
    return {
      lawdCd: String(entry?.lawdCd ?? "").trim(),
      guName: String(entry?.guName ?? "").trim(),
      dong: String(entry?.dong ?? "").trim(),
      apt: String(entry?.apt ?? "").trim(),
      area:
        entry?.area != null && String(entry.area).trim() !== ""
          ? String(entry.area).trim()
          : ""
    };
  }

  function favoriteKey(entry) {
    const lawdCd = String(entry?.lawdCd ?? "").trim();
    const dong = normalizeDongName(entry.dong);
    const apt = String(entry?.apt ?? "").trim();
    const area = String(entry?.area ?? "").trim();
    const base = `${lawdCd}|${dong}|${apt}`;
    return area ? `${base}|${area}` : base;
  }

  function getClientId() {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `gap-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  }

  function readMirror() {
    try {
      const raw = localStorage.getItem(MIRROR_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr)
        ? arr.map(normalizeFavorite).filter((f) => f.lawdCd && f.apt)
        : [];
    } catch {
      return [];
    }
  }

  function writeMirror(list) {
    const normalized = list.map(normalizeFavorite).filter((f) => f.lawdCd && f.apt);
    localStorage.setItem(MIRROR_KEY, JSON.stringify(normalized));
    return normalized;
  }

  async function getApiBase() {
    const API = global.GAP_API;
    if (API?.getApiProxyBase) return API.getApiProxyBase();
    await API?.initApiBase?.();
    return API?.getApiProxyBase?.() ?? "";
  }

  async function readFavorites() {
    const clientId = getClientId();
    try {
      const base = await getApiBase();
      const res = await fetch(
        `${base}${API_PATH}?clientId=${encodeURIComponent(clientId)}`,
        {
          headers: { "X-Client-Id": clientId },
          cache: "no-store"
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      let loaded = Array.isArray(data?.favorites)
        ? data.favorites.map(normalizeFavorite)
        : [];
      if (data?.store?.warning) {
        console.warn("[gap-favorites]", data.store.warning);
      }
      if (loaded.length) {
        writeMirror(loaded);
      } else {
        const mirror = readMirror();
        if (mirror.length) loaded = mirror;
      }
      return loaded;
    } catch (err) {
      const mirror = readMirror();
      if (mirror.length) {
        console.warn("[gap-favorites] API 실패, 브라우저 저장분 사용:", err.message);
        return mirror;
      }
      throw err;
    }
  }

  async function persistFavorites(list, options = {}) {
    const normalized = list.map(normalizeFavorite).filter((f) => f.lawdCd && f.apt);
    const clientId = getClientId();
    try {
      const base = await getApiBase();
      const res = await fetch(`${base}${API_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Id": clientId
        },
        cache: "no-store",
        body: JSON.stringify({ clientId, favorites: normalized })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      const favorites = Array.isArray(data?.favorites)
        ? data.favorites.map(normalizeFavorite)
        : normalized;
      writeMirror(favorites);
      if (data?.store?.warning && !options.silent) {
        onMessage(data.store.warning, true);
      }
      return { ...data, favorites };
    } catch (err) {
      const saved = writeMirror(normalized);
      if (!options.silent) {
        onMessage(
          `Gap 즐겨찾기 서버 저장 실패, 이 브라우저에만 저장했습니다: ${err.message}`,
          true
        );
      }
      return { favorites: saved, storage: "browser-mirror" };
    }
  }

  async function toggleFavorite(entry) {
    const list = await readFavorites();
    const k = favoriteKey(entry);
    const idx = list.findIndex((e) => favoriteKey(e) === k);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(normalizeFavorite(entry));
    }
    await persistFavorites(list);
  }

  async function removeFavoriteByKey(key) {
    const list = await readFavorites();
    await persistFavorites(list.filter((e) => favoriteKey(e) !== key));
  }

  function isFavorite(entry, list) {
    const k = favoriteKey(entry);
    return (list || []).some((e) => favoriteKey(e) === k);
  }

  function openAppModal(overlay, triggerEl) {
    if (!overlay) return;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    if (triggerEl && typeof triggerEl.focus === "function") {
      overlay._gapRestoreFocus = triggerEl;
    }
  }

  function closeAppModal(overlay) {
    if (!overlay) return;
    const restore = overlay._gapRestoreFocus;
    delete overlay._gapRestoreFocus;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    if (restore && typeof restore.focus === "function") {
      restore.focus({ preventScroll: true });
    }
  }

  let slotPickTarget = null;

  async function renderManageModal() {
    const body = document.getElementById("gapFavoritesModalBody");
    if (!body) return;
    let list;
    try {
      list = (await readFavorites())
        .slice()
        .sort((a, b) => favoriteKey(a).localeCompare(favoriteKey(b)));
    } catch (err) {
      body.innerHTML = `<p class="fav-empty">즐겨찾기 불러오기 실패: ${escapeHtml(err.message)}</p>`;
      return;
    }
    const hint =
      '<p class="hint notify-hint">Gap 분석 전용 즐겨찾기입니다. 「1. 아파트 실거래 변동」 화면 찜과 별도로 저장됩니다.</p>';
    if (!list.length) {
      body.innerHTML = hint + '<p class="fav-empty">즐겨찾기된 아파트가 없습니다.</p>';
      return;
    }
    body.innerHTML =
      hint +
      list
        .map((f) => {
          const k = favoriteKey(f);
          const kEnc = encodeURIComponent(k);
          const title = escapeHtml(f.apt || "-");
          const meta = escapeHtml(
            `${f.guName || ""} · ${f.dong || ""}${f.area ? ` · ${f.area}㎡` : " · 평형 전체"}`
          );
          return (
            `<div class="fav-row">
          <button type="button" class="star-btn filled" data-gap-fav-modal-toggle="${kEnc}" title="즐겨찾기 해제">★</button>
          <div class="fav-row-main">
            <div class="fav-row-title">${title}</div>
            <div class="fav-row-meta">${meta}</div>
          </div>
          <button type="button" class="btn-remove-fav" data-gap-fav-remove="${kEnc}" title="목록에서 제거">×</button>
        </div>`
          );
        })
        .join("");
  }

  async function renderPickModal() {
    const body = document.getElementById("gapSlotFavModalBody");
    const titleEl = document.getElementById("gapSlotFavModalTitle");
    if (!body) return;
    const slotLabel =
      slotPickTarget?.role === "baseline"
        ? "기준"
        : `후보 ${slotPickTarget?.id ?? ""}`;
    if (titleEl) titleEl.textContent = `${slotLabel} — 즐겨찾기에서 선택`;

    let list;
    try {
      list = (await readFavorites())
        .slice()
        .sort((a, b) => favoriteKey(a).localeCompare(favoriteKey(b)));
    } catch (err) {
      body.innerHTML =
        '<p class="section-title" style="margin-top:0;">즐겨찾기에서 선택</p>' +
        `<p class="fav-empty">불러오기 실패: ${escapeHtml(err.message)}</p>`;
      return;
    }
    if (!list.length) {
      body.innerHTML =
        '<p class="section-title" style="margin-top:0;">즐겨찾기에서 선택</p>' +
        '<p class="fav-empty">즐겨찾기를 먼저 추가해주세요.</p>' +
        '<p class="hint" style="margin-top:0;">슬롯에서 아파트 선택 후 ☆를 눌러 단지를 저장한 뒤 다시 시도해주세요.</p>';
      return;
    }
    body.innerHTML =
      '<p class="section-title" style="margin-top:0;">즐겨찾기</p>' +
      `<p class="hint" style="margin-top:0; margin-bottom:10px;">${escapeHtml(slotLabel)}에 적용할 단지를 선택하세요. 별을 누르면 목록에서 해제할 수 있습니다.</p>` +
      list
        .map((f) => {
          const k = favoriteKey(f);
          const kEnc = encodeURIComponent(k);
          const title = escapeHtml(f.apt || "-");
          const meta = escapeHtml(
            `${f.guName || ""} · ${f.dong || ""}${f.area ? ` · ${f.area}㎡` : " · 평형 전체"}`
          );
          return (
            `<div class="fav-row pickable" data-gap-fav-pick-key="${kEnc}" role="button" tabindex="0">
            <button type="button" class="star-btn filled" data-gap-slot-star="${kEnc}" title="즐겨찾기">★</button>
            <div class="fav-row-main">
              <div class="fav-row-title">${title}</div>
              <div class="fav-row-meta">${meta}</div>
            </div>
          </div>`
          );
        })
        .join("");
  }

  async function openPickModal(target, triggerEl) {
    slotPickTarget = target;
    const modal = document.getElementById("gapSlotFavModal");
    openAppModal(modal, triggerEl);
    await renderPickModal();
    const firstPick = document
      .getElementById("gapSlotFavModalBody")
      ?.querySelector(".fav-row.pickable");
    if (firstPick instanceof HTMLElement) {
      firstPick.focus();
    }
  }

  function bindModals(handlers) {
    const manageModal = document.getElementById("gapFavoritesModal");
    const pickModal = document.getElementById("gapSlotFavModal");
    const closeManage = document.getElementById("closeGapFavoritesModal");
    const closePick = document.getElementById("closeGapSlotFavModal");
    const manageBody = document.getElementById("gapFavoritesModalBody");
    const pickBody = document.getElementById("gapSlotFavModalBody");

    closeManage?.addEventListener("click", () => closeAppModal(manageModal));
    closePick?.addEventListener("click", () => closeAppModal(pickModal));

    manageModal?.addEventListener("click", (e) => {
      if (e.target === manageModal) closeAppModal(manageModal);
    });
    pickModal?.addEventListener("click", (e) => {
      if (e.target === pickModal) closeAppModal(pickModal);
    });

    manageBody?.addEventListener("click", async (e) => {
      const rm = e.target.closest("[data-gap-fav-remove]");
      if (rm) {
        await removeFavoriteByKey(decodeURIComponent(rm.getAttribute("data-gap-fav-remove") || ""));
        await renderManageModal();
        handlers?.onFavoritesChanged?.();
        return;
      }
      const tg = e.target.closest("[data-gap-fav-modal-toggle]");
      if (tg) {
        const k = decodeURIComponent(tg.getAttribute("data-gap-fav-modal-toggle") || "");
        const list = await readFavorites();
        const f = list.find((x) => favoriteKey(x) === k);
        if (f) {
          await toggleFavorite(f);
          await renderManageModal();
          handlers?.onFavoritesChanged?.();
        }
      }
    });

    pickBody?.addEventListener("click", async (e) => {
      const star = e.target.closest("[data-gap-slot-star]");
      if (star) {
        e.stopPropagation();
        const k = decodeURIComponent(star.getAttribute("data-gap-slot-star") || "");
        const list = await readFavorites();
        const f = list.find((x) => favoriteKey(x) === k);
        if (f) {
          await toggleFavorite(f);
          await renderPickModal();
          handlers?.onFavoritesChanged?.();
        }
        return;
      }
      const row = e.target.closest("[data-gap-fav-pick-key]");
      if (!row || !slotPickTarget) return;
      const k = decodeURIComponent(row.getAttribute("data-gap-fav-pick-key") || "");
      const list = await readFavorites();
      const fav = list.find((x) => favoriteKey(x) === k);
      if (!fav) return;
      closeAppModal(pickModal);
      await handlers?.applyFavorite?.(slotPickTarget, fav);
    });

    pickBody?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const row = e.target.closest("[data-gap-fav-pick-key]");
      if (row) {
        e.preventDefault();
        row.click();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (manageModal?.classList.contains("open")) closeAppModal(manageModal);
      if (pickModal?.classList.contains("open")) closeAppModal(pickModal);
    });
  }

  global.GAP_FAV = {
    init(opts = {}) {
      onMessage = opts.setMessage || onMessage;
      bindModals(opts);
    },
    readFavorites,
    toggleFavorite,
    removeFavoriteByKey,
    favoriteKey,
    normalizeFavorite,
    isFavorite,
    openPickModal,
    renderManageModal,
    closeAppModal,
    getClientId
  };
})(typeof window !== "undefined" ? window : globalThis);
