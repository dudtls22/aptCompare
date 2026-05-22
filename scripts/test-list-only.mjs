import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildDataGoKrQueryString } from "../lib/data-go-key.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq <= 0) continue;
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  process.env[t.slice(0, eq).trim()] = v;
}

const key = process.env.DATA_GO_KR_SERVICE_KEY;

async function probe(name, url, params) {
  const q = buildDataGoKrQueryString(
    new URLSearchParams({ pageNo: "1", numOfRows: "10", _type: "json", ...params }),
    key
  );
  const r = await fetch(`${url}?${q}`, { headers: { Referer: "https://www.data.go.kr/" } });
  const t = await r.text();
  let info = `HTTP ${r.status}`;
  try {
    const d = JSON.parse(t);
    const h = d?.response?.header;
    info += ` code=${h?.resultCode} ${h?.resultMsg}`;
    const body = d?.response?.body;
    const raw = body?.item ?? body?.items?.item;
    const arr = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
    info += ` items=${arr.length}`;
    if (arr[0]) {
      info += ` sample=${arr[0].kaptCode || arr[0].kaptcode} ${arr[0].kaptName || arr[0].kaptname}`;
    }
  } catch {
    info += ` body=${t.slice(0, 80)}`;
  }
  console.log(name, "->", info);
}

console.log("key len:", (key || "").length);

await probe(
  "Legal V4 대치동",
  "https://apis.data.go.kr/1613000/AptListServiceV4/getLegaldongAptListV4",
  { bjdCode: "1168010600" }
);
await probe(
  "Sigungu V4 강남구",
  "https://apis.data.go.kr/1613000/AptListServiceV4/getSigunguAptListV4",
  { bjdCode: "11680" }
);
