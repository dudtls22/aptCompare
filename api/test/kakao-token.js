import { setCorsHeaders } from "../../lib/cors.mjs";
import { validateKakaoAccessToken } from "../../lib/kakao.mjs";

function isAuthorized(req) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return true;
  return String(req.headers?.authorization || "") === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  setCorsHeaders(res, "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  try {
    const info = await validateKakaoAccessToken();
    res.status(200).json({ ok: true, tokenInfo: info });
  } catch (err) {
    res.status(500).json({
      error: "kakao_token_invalid",
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
