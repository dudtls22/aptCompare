import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadDotEnv();

const SERVICE_KEY = (process.env.DATA_GO_KR_SERVICE_KEY || "").trim();
const PORT = Number(process.env.PORT) || 3333;

const UPSTREAM_BY_PATH = {
  "/api-proxy/trade-dev": "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev",
  "/api-proxy/trade": "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"
};
const UPSTREAM_BY_TARGET = {
  "trade-dev": "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev",
  trade: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function serveStatic(res, relPath) {
  const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(__dirname, normalized);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function proxyToApi(res, u) {
  if (!SERVICE_KEY) {
    sendJson(res, 500, {
      error: "missing_service_key",
      message: ".env 파일에 DATA_GO_KR_SERVICE_KEY 를 설정하세요. (.env.example 참고)"
    });
    return;
  }
  const target = u.searchParams.get("target") || "";
  const upstreamBase = u.pathname === "/api/proxy"
    ? UPSTREAM_BY_TARGET[target]
    : UPSTREAM_BY_PATH[u.pathname];
  if (!upstreamBase) {
    res.writeHead(404);
    res.end("Unknown proxy path");
    return;
  }

  const params = new URLSearchParams(u.search);
  params.delete("target");
  params.set("serviceKey", SERVICE_KEY);
  const upstreamUrl = `${upstreamBase}?${params.toString()}`;

  https
    .get(upstreamUrl, (r) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => {
        const body = Buffer.concat(chunks);
        const rawCt = r.headers["content-type"] || "application/json";
        res.writeHead(r.statusCode || 502, { "Content-Type": rawCt });
        res.end(body);
      });
    })
    .on("error", (e) => {
      sendJson(res, 502, { error: "upstream", message: String(e.message) });
    });
}

http
  .createServer((req, res) => {
    let u;
    try {
      u = new URL(req.url || "/", `http://${req.headers.host}`);
    } catch {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }

    if (u.pathname.startsWith("/api-proxy/") || u.pathname === "/api/proxy") {
      proxyToApi(res, u);
      return;
    }

    let rel = u.pathname === "/" ? "index.html" : u.pathname.replace(/^\//, "");
    if (rel.includes("..")) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    serveStatic(res, rel);
  })
  .listen(PORT, () => {
    console.log(`http://localhost:${PORT}/`);
    if (!SERVICE_KEY) {
      console.warn("[aptCompare] DATA_GO_KR_SERVICE_KEY 가 비어 있습니다. .env 를 만든 뒤 키를 넣으세요.");
    }
  });
