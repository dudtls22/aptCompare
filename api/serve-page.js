import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const htmlPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html");

export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).end("Method Not Allowed");
    return;
  }
  try {
    const html = fs.readFileSync(htmlPath, "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.status(200).end(req.method === "HEAD" ? "" : html);
  } catch (err) {
    res.status(500).json({
      error: "index_not_found",
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
