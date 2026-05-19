import { setCorsHeaders } from "../lib/cors.mjs";

export default function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  res.status(200).json({
    ok: true,
    service: "aptCompare",
    time: new Date().toISOString()
  });
}
