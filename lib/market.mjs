export async function getMarketData() {
  const [fxRes, kbRes] = await Promise.all([
    fetch("https://api.frankfurter.app/latest?from=USD&to=KRW"),
    fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/105560.KS?interval=1m&range=1d",
      { headers: { "User-Agent": "aptCompare/1.0" } }
    )
  ]);

  let fx = { rate: null, date: null, source: "frankfurter" };
  if (fxRes.ok) {
    const fxJson = await fxRes.json();
    fx = {
      rate: fxJson?.rates?.KRW ?? null,
      date: fxJson?.date ?? null,
      source: "frankfurter"
    };
  } else {
    fx = { rate: null, error: `HTTP ${fxRes.status}`, source: "frankfurter" };
  }

  let kb = { symbol: "105560.KS", name: "KB금융", price: null, changePercent: null, currency: "KRW" };
  if (kbRes.ok) {
    const kbJson = await kbRes.json();
    const meta = kbJson?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice ?? meta?.previousClose ?? null;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? null;
    let changePercent = null;
    if (price != null && prev != null && prev !== 0) {
      changePercent = ((price - prev) / prev) * 100;
    }
    kb = {
      symbol: "105560.KS",
      name: meta?.longName || meta?.shortName || "KB금융",
      price,
      changePercent,
      currency: meta?.currency || "KRW",
      marketTime: meta?.regularMarketTime || null
    };
  } else {
    kb = { ...kb, error: `HTTP ${kbRes.status}` };
  }

  return {
    updatedAt: new Date().toISOString(),
    fx,
    kb
  };
}
