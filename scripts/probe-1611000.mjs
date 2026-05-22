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

async function tryUrl(name, url, params) {
  const q = buildDataGoKrQueryString(
    new URLSearchParams({ pageNo: "1", numOfRows: "10", _type: "json", ...params }),
    key
  );
  const r = await fetch(`${url}?${q}`);
  const t = await r.text();
  let info = `${r.status}`;
  try {
    const d = JSON.parse(t);
    info += ` ${d?.response?.header?.resultCode} ${d?.response?.header?.resultMsg}`;
    const body = d?.response?.body;
    const raw = body?.item ?? body?.items?.item;
    const arr = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
    info += ` n=${arr.length}`;
    if (arr[0]) info += ` ${JSON.stringify(arr[0]).slice(0, 120)}`;
  } catch {
    info += ` ${t.slice(0, 80)}`;
  }
  console.log(name, "->", info);
}

await tryUrl(
  "1611000 list legal",
  "http://apis.data.go.kr/1611000/AptListService/getLegaldongAptList",
  { loadCode: "1168010600" }
);
await tryUrl(
  "1611000 basic",
  "http://apis.data.go.kr/1611000/AptBasicInfoService/getAptBasicInfo",
  { kaptCode: "A10027875" }
);
await tryUrl(
  "1613000 Hub apt",
  "https://apis.data.go.kr/1613000/AptBasisInfoService/getAphusBassInfo",
  { kaptCode: "A10027875" }
);
