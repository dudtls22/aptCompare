import { enrichAptBasisBatch } from "../lib/apt-basis.mjs";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
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
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const conditions = Array.isArray(body?.conditions) ? body.conditions : [];
    const result = await enrichAptBasisBatch(conditions, serviceKey);
    res.status(200).json({
      ok: true,
      byKey: result.byKey,
      errors: result.errors,
      hints: result.hints
    });
  } catch (err) {
    res.status(502).json({
      error: "apt_basis_failed",
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
