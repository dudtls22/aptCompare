/**
 * 실거래·K-apt API 진단: node scripts/test-proxy-local.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildDataGoKrQueryString } from "../lib/data-go-key.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq <= 0) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (k) process.env[k] = v;
}

const key = (process.env.DATA_GO_KR_SERVICE_KEY || "").trim();
console.log("key present:", Boolean(key), "len:", key.length);

const endpoints = {
  trade: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade",
  "trade-dev":
    "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"
};

const base = new URLSearchParams({
  LAWD_CD: "11680",
  DEAL_YMD: "202504",
  pageNo: "1",
  numOfRows: "2",
  _type: "json"
});

for (const [name, url] of Object.entries(endpoints)) {
  const q = buildDataGoKrQueryString(new URLSearchParams(base), key);
  const r = await fetch(`${url}?${q}`);
  const text = await r.text();
  let code = `${r.status}`;
  try {
    const d = JSON.parse(text);
    code = `${r.status} ${d?.response?.header?.resultCode} ${d?.response?.header?.resultMsg}`;
    const item = d?.response?.body?.items?.item;
    const one = Array.isArray(item) ? item[0] : item;
    if (one) {
      console.log(
        `  sample keys: ${Object.keys(one).slice(0, 8).join(", ")} aptSeq=${one.aptSeq || "-"}`
      );
    }
  } catch {
    code = `${r.status} ${text.slice(0, 120)}`;
  }
  console.log(name, "->", code);
}

for (const target of ["trade", "trade-dev"]) {
  try {
    const r = await fetch(
      `http://127.0.0.1:3333/api/proxy?target=${target}&LAWD_CD=11680&DEAL_YMD=202504&pageNo=1&numOfRows=2&_type=json`
    );
    const t = await r.text();
    let extra = "";
    try {
      extra = JSON.parse(t)?.response?.header?.resultCode || JSON.parse(t)?.error || "";
    } catch {
      extra = t.slice(0, 30);
    }
    console.log(`localhost proxy ${target} ->`, r.status, extra);
  } catch (e) {
    console.log(`localhost proxy ${target} ->`, e.message);
  }
}
