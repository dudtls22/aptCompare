import { setCorsHeaders } from "../lib/cors.mjs";

export default function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const port = Number(process.env.PORT) || 3333;
  res.status(200).json({
    port,
    apiBase: `http://127.0.0.1:${port}`
  });
}
