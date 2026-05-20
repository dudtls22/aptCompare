import { buildDataGoKrQueryString } from "../lib/data-go-key.mjs";

const UPSTREAM_BY_TARGET = {
  "trade-dev": "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev",
  trade: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"
};

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const serviceKey = (process.env.DATA_GO_KR_SERVICE_KEY || "").trim();

  if (!serviceKey) {
    res.status(500).json({
      error: "missing_service_key",
      message: "Vercel 환경변수 DATA_GO_KR_SERVICE_KEY 를 설정하세요."
    });
    return;
  }

  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const target = url.searchParams.get("target") || "trade";
    const upstreamBase = UPSTREAM_BY_TARGET[target];

    if (!upstreamBase) {
      res.status(400).json({
        error: "invalid_target",
        message: "target은 trade 또는 trade-dev 여야 합니다."
      });
      return;
    }

    url.searchParams.delete("target");
    const query = buildDataGoKrQueryString(url.searchParams, serviceKey);
    const upstreamUrl = `${upstreamBase}?${query}`;
    const upstreamRes = await fetch(upstreamUrl);
    const text = await upstreamRes.text();

    res.status(upstreamRes.status);
    res.setHeader(
      "Content-Type",
      upstreamRes.headers.get("content-type") || "application/json; charset=utf-8"
    );
    res.send(text);
  } catch (err) {
    res.status(502).json({
      error: "proxy_failed",
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
