function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Id");
}

async function getMarketData() {
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

  let kb = {
    symbol: "105560.KS",
    name: "KB금융",
    price: null,
    changePercent: null,
    currency: "KRW"
  };
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

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const data = await getMarketData();
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({
      error: "market_failed",
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
