import { setCorsHeaders } from "../lib/cors.mjs";
import { getMarketData } from "../lib/market.mjs";

export default async function handler(req, res) {
  setCorsHeaders(res);

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
