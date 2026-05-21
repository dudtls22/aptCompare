/** index.html 조회 조건 저장·복원 (탭·재접속) */
(function () {
  const P = window.AppStatePersist;
  if (!P) return;

  let bound = false;

  function persistIndexNow(getSlots) {
    const slots = typeof getSlots === "function" ? getSlots() : [];
    const data = P.collectIndexState(slots);
    if (P.saveIndexCache) {
      P.saveIndexCache(data);
    } else {
      P.save(P.KEY_INDEX, data);
    }
  }

  function bindIndexPersistence(getSlots) {
    if (bound) return;
    bound = true;

    const persist = P.debounce(() => persistIndexNow(getSlots));
    const flushOnHide = () => persistIndexNow(getSlots);

    ["regionSelect", "guSelect", "months"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", persist);
    });

    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLSelectElement)) return;
      if (/^dongSelect|^aptSelect|^areaSelect/.test(t.id)) persist();
    });

    window.addEventListener("pagehide", flushOnHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushOnHide();
    });
  }

  function hasIndexCache() {
    const saved = P.loadIndexCache ? P.loadIndexCache() : P.load(P.KEY_INDEX);
    if (!saved) return false;
    if (saved.region || saved.gu || saved.months) return true;
    return (saved.slots || []).some((r) => r && (r.dong || r.apt || r.area));
  }

  async function restoreIndexState(ctx) {
    const saved = P.loadIndexCache ? P.loadIndexCache() : P.load(P.KEY_INDEX);
    if (!saved || !ctx) return false;

    if (saved.region) {
      P.writeSelect("regionSelect", saved.region);
      ctx.setupDistrictSelect(saved.region, saved.gu || "");
    }
    if (saved.months) P.writeSelect("months", saved.months);

    if (typeof ctx.ensureSlotCount === "function") {
      await ctx.ensureSlotCount(saved.slots);
    }

    const lawdCd = saved.gu || P.readSelect("guSelect");
    if (lawdCd) {
      P.writeSelect("guSelect", lawdCd);
      try {
        await ctx.loadDongOptionsByDistrict(lawdCd);
      } catch {
        /* ignore */
      }
    }

    for (const row of saved.slots || []) {
      const id = row.id;
      if (!id) continue;
      if (!row.dong && !row.apt && !row.area) continue;
      if (row.dong) {
        if (typeof ctx.setDongForSlot === "function") {
          ctx.setDongForSlot(id, row.dong);
        } else {
          P.writeSelect("dongSelect" + id, row.dong);
        }
      }
      try {
        await ctx.loadAptAreaForSlot(
          id,
          row.dong || "",
          row.apt || "",
          row.area || ""
        );
      } catch {
        /* ignore */
      }
    }
    return true;
  }

  window.IndexStatePersist = {
    bindIndexPersistence,
    restoreIndexState,
    persistIndexNow,
    hasIndexCache
  };
})();
