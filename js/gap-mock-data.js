/**
 * Gap 분석 Mock 데이터 (API 없이 UI·차트·표 검증용)
 * 사용: gap.html?mock=1
 */
(function (global) {
  function quarterLabels(count = 12) {
    const out = [];
    const now = new Date();
    let y = now.getFullYear();
    let q = Math.ceil((now.getMonth() + 1) / 3);
    for (let i = 0; i < count; i++) {
      out.unshift(`${y} Q${q}`);
      q -= 1;
      if (q < 1) {
        q = 4;
        y -= 1;
      }
    }
    return out;
  }

  function seriesFromBase(base, drift, volatility) {
    const labels = quarterLabels(12);
    const map = {};
    let v = base;
    labels.forEach((qk, i) => {
      v += drift + (Math.sin(i * 0.7) * volatility);
      map[qk] = Math.round(v);
    });
    return map;
  }

  /**
   * @param {{ label: string }} baseline
   * @param {{ label: string }[]} candidates
   */
  function buildMockGapAnalysis(baseline, candidates) {
    const quarters = quarterLabels(12);
    const baselineMap = seriesFromBase(92000, 800, 1200);
    const candidateMaps = candidates.map((c, i) =>
      seriesFromBase(88000 + i * 4500, 600 + i * 100, 900 + i * 80)
    );

    const series = [
      {
        id: "baseline",
        label: baseline.label || "기준 아파트",
        color: "#233d4d",
        role: "baseline",
        byQuarter: baselineMap
      },
      ...candidates.map((c, i) => ({
        id: `cand${i + 1}`,
        label: c.label || `비교 ${i + 1}`,
        color: ["#a1c181", "#619b8a", "#fcca46"][i],
        role: "candidate",
        byQuarter: candidateMaps[i]
      }))
    ];

    const rows = quarters.map((qk) => {
      const basePrice = baselineMap[qk] ?? null;
      const cells = series.slice(1).map((s) => {
        const price = s.byQuarter[qk] ?? null;
        const gap =
          price != null && basePrice != null ? price - basePrice : null;
        return { price, gap };
      });
      return { quarter: qk, basePrice, cells };
    });

    return { quarters, series, rows, isMock: true };
  }

  global.GAP_MOCK = { buildMockGapAnalysis, quarterLabels };
})(typeof window !== "undefined" ? window : globalThis);
