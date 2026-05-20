import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getMarketData } from "./lib/market.mjs";
import { getFavorites, setFavorites } from "./lib/favorites-store.mjs";
import {
  getNotifyConfigStatus,
  getSubscriptions,
  setSubscriptions
} from "./lib/notify-store.mjs";
import { runDailyNotify } from "./lib/daily-notify.mjs";
import { sendTestKakaoLatestTrade } from "./lib/test-kakao-notify.mjs";
import { validateKakaoAccessToken } from "./lib/kakao.mjs";
import { buildDataGoKrQueryString } from "./lib/data-go-key.mjs";

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

function sendJson(res, status, obj, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Id",
    ...extraHeaders
  });
  res.end(JSON.stringify(obj));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function isCronAuthorized(req) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return true;
  return String(req.headers.authorization || "") === `Bearer ${secret}`;
}

function normalizeApiPath(pathname) {
  const p = String(pathname || "/").trim();
  if (p.length > 1 && p.endsWith("/")) {
    return p.slice(0, -1);
  }
  return p || "/";
}

async function handleTestKakaoTokenRoute(req, res, apiPath) {
  if (apiPath !== "/api/test/kakao-token") {
    return false;
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }
  if (!isCronAuthorized(req)) {
    sendJson(res, 401, { error: "unauthorized" });
    return true;
  }
  try {
    const tokenInfo = await validateKakaoAccessToken();
    sendJson(res, 200, { ok: true, tokenInfo });
  } catch (err) {
    sendJson(res, 500, {
      error: "kakao_token_invalid",
      message: err instanceof Error ? err.message : String(err)
    });
  }
  return true;
}

async function handleTestKakaoRoute(req, res, u, apiPath) {
  if (apiPath !== "/api/test/kakao") {
    return false;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }
  if (!isCronAuthorized(req)) {
    sendJson(res, 401, { error: "unauthorized" });
    return true;
  }
  try {
    const lawdCd = u.searchParams.get("lawdCd") || "11680";
    sendJson(res, 200, await sendTestKakaoLatestTrade({ lawdCd }));
  } catch (err) {
    sendJson(res, 500, {
      error: "test_kakao_failed",
      message: err instanceof Error ? err.message : String(err)
    });
  }
  return true;
}

async function handleApiRoute(req, res, u, apiPath) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Id"
    });
    res.end();
    return true;
  }

  if (await handleTestKakaoRoute(req, res, u, apiPath)) {
    return true;
  }

  if (apiPath === "/api/health" && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      service: "aptCompare",
      time: new Date().toISOString()
    });
    return true;
  }

  if (apiPath === "/api/config" && req.method === "GET") {
    sendJson(res, 200, {
      port: PORT,
      apiBase: `http://127.0.0.1:${PORT}`
    });
    return true;
  }

  if (apiPath === "/api/market" && req.method === "GET") {
    try {
      sendJson(res, 200, await getMarketData());
    } catch (err) {
      sendJson(res, 502, {
        error: "market_failed",
        message: err instanceof Error ? err.message : String(err)
      });
    }
    return true;
  }

  if (apiPath === "/api/favorites") {
    const clientId =
      u.searchParams.get("clientId") ||
      String(req.headers["x-client-id"] || "").trim();

    if (req.method === "GET") {
      if (!clientId) {
        sendJson(res, 400, {
          error: "missing_client_id",
          message: "clientId 쿼리 또는 X-Client-Id 헤더가 필요합니다."
        });
        return true;
      }
      try {
        const result = await getFavorites(clientId);
        sendJson(res, 200, {
          clientId,
          favorites: result.favorites,
          store: result,
          config: getNotifyConfigStatus()
        });
      } catch (err) {
        sendJson(res, 500, {
          error: "favorites_failed",
          message: err instanceof Error ? err.message : String(err)
        });
      }
      return true;
    }

    if (req.method === "POST" || req.method === "PUT") {
      try {
        const raw = await readRequestBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const id = String(body?.clientId || clientId || "").trim();
        const list = Array.isArray(body?.favorites) ? body.favorites : null;
        if (!id || !list) {
          sendJson(res, 400, {
            error: "invalid_body",
            message: '{ "clientId": "...", "favorites": [...] } 형식이 필요합니다.'
          });
          return true;
        }
        const result = await setFavorites(id, list);
        sendJson(res, 200, {
          ok: true,
          clientId: id,
          favorites: result.favorites,
          store: result,
          config: getNotifyConfigStatus()
        });
      } catch (err) {
        sendJson(res, 500, {
          error: "favorites_failed",
          message: err instanceof Error ? err.message : String(err)
        });
      }
      return true;
    }

    sendJson(res, 405, { error: "method_not_allowed" });
    return true;
  }

  if (apiPath === "/api/notifications") {
    if (req.method === "GET") {
      try {
        sendJson(res, 200, {
          subscriptions: await getSubscriptions(),
          config: getNotifyConfigStatus()
        });
      } catch (err) {
        sendJson(res, 500, {
          error: "notifications_failed",
          message: err instanceof Error ? err.message : String(err)
        });
      }
      return true;
    }

    if (req.method === "POST") {
      try {
        const raw = await readRequestBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const list = Array.isArray(body?.subscriptions) ? body.subscriptions : null;
        if (!list) {
          sendJson(res, 400, {
            error: "invalid_body",
            message: '{ "subscriptions": [...] } 형식이 필요합니다.'
          });
          return true;
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
        sendJson(res, 200, {
          ok: true,
          count: normalized.length,
          store: storeResult,
          config: getNotifyConfigStatus()
        });
      } catch (err) {
        sendJson(res, 500, {
          error: "notifications_failed",
          message: err instanceof Error ? err.message : String(err)
        });
      }
      return true;
    }
  }

  if (apiPath === "/api/cron/daily-notify" && (req.method === "GET" || req.method === "POST")) {
    if (!isCronAuthorized(req)) {
      sendJson(res, 401, { error: "unauthorized" });
      return true;
    }
    try {
      sendJson(res, 200, await runDailyNotify());
    } catch (err) {
      sendJson(res, 500, {
        error: "daily_notify_failed",
        message: err instanceof Error ? err.message : String(err)
      });
    }
    return true;
  }

  return false;
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
  const query = buildDataGoKrQueryString(params, SERVICE_KEY);
  const upstreamUrl = `${upstreamBase}?${query}`;

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
  .createServer(async (req, res) => {
    let u;
    try {
      u = new URL(req.url || "/", `http://${req.headers.host}`);
    } catch {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }

    const apiPath = normalizeApiPath(u.pathname);

    if (apiPath.startsWith("/api-proxy/") || apiPath === "/api/proxy") {
      proxyToApi(res, u);
      return;
    }

    if (apiPath.startsWith("/api/")) {
      if (await handleTestKakaoTokenRoute(req, res, apiPath)) {
        return;
      }
      if (await handleTestKakaoRoute(req, res, u, apiPath)) {
        return;
      }
      const handled = await handleApiRoute(req, res, u, apiPath);
      if (handled) return;
      sendJson(res, 404, {
        error: "api_not_found",
        message: `${apiPath} API를 찾을 수 없습니다. server.mjs 저장 후 npm start 를 다시 실행했는지 확인하세요.`
      });
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
