import { setCorsHeaders } from "../lib/cors.mjs";
import {
  getNotifyConfigStatus,
  getSubscriptions,
  setSubscriptions
} from "../lib/notify-store.mjs";

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    if (req.method === "GET") {
      const subscriptions = await getSubscriptions();
      res.status(200).json({
        subscriptions,
        config: getNotifyConfigStatus()
      });
      return;
    }

    if (req.method === "POST") {
      const body = readBody(req);
      const list = Array.isArray(body?.subscriptions) ? body.subscriptions : null;
      if (!list) {
        res.status(400).json({
          error: "invalid_body",
          message: '{ "subscriptions": [...] } 형식이 필요합니다.'
        });
        return;
      }

      const normalized = list
        .filter((s) => s && s.notify !== false)
        .map((s) => ({
          lawdCd: String(s.lawdCd || "").trim(),
          guName: String(s.guName || "").trim(),
          dong: String(s.dong || "").trim(),
          apt: String(s.apt || "").trim(),
          area: s.area != null ? String(s.area).trim() : "",
          notify: true
        }))
        .filter((s) => s.lawdCd && s.apt);

      const storeResult = await setSubscriptions(normalized);
      res.status(200).json({
        ok: true,
        count: normalized.length,
        store: storeResult,
        config: getNotifyConfigStatus()
      });
      return;
    }

    res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    res.status(500).json({
      error: "notifications_failed",
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
