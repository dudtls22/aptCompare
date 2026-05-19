import { setCorsHeaders } from "../../lib/cors.mjs";
import { runDailyNotify } from "../../lib/daily-notify.mjs";

function isAuthorized(req) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return true;
  const auth = String(req.headers?.authorization || "");
  return auth === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  setCorsHeaders(res, "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  try {
    const result = await runDailyNotify();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: "daily_notify_failed",
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
