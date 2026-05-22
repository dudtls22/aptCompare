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

async function probe(name, op, params) {
  const url = `https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/${op}`;
  const q = buildDataGoKrQueryString(
    new URLSearchParams({ pageNo: "1", numOfRows: "10", _type: "json", ...params }),
    key
  );
  const r = await fetch(`${url}?${q}`, { headers: { Referer: "https://www.data.go.kr/" } });
  const t = await r.text();
  let info = `${r.status}`;
  try {
    const d = JSON.parse(t);
    const h = d?.response?.header;
    info += ` ${h?.resultCode} ${h?.resultMsg}`;
    const body = d?.response?.body;
    const raw = body?.item ?? body?.items?.item;
    const arr = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
    info += ` n=${arr.length}`;
    if (arr[0]) {
      info += ` hh=${arr[0].kaptdaCnt ?? arr[0].hoCnt} code=${arr[0].kaptCode} name=${arr[0].kaptName}`;
    } else if (body?.item && typeof body.item === "object") {
      const it = body.item;
      info += ` single hh=${it.kaptdaCnt} code=${it.kaptCode}`;
    }
  } catch {
    info += ` ${t.slice(0, 100)}`;
  }
  console.log(name, info);
}

const ops = [
  ["BassInfo kaptCode", "getAphusBassInfoV4", { kaptCode: "A10027875" }],
  ["BassList bjd", "getAphusBassInfoListV4", { bjdCode: "1168010600" }],
  ["BassList name", "getAphusBassInfoListV4", { kaptName: "래미안대치팰리스" }],
  ["BassList aptSeq", "getAphusBassInfoListV4", { aptSeq: "11680-4394" }],
  ["DtlInfo kaptCode", "getAphusDtlInfoV4", { kaptCode: "A10027875" }],
  ["DtlInfo aptSeq", "getAphusDtlInfoV4", { aptSeq: "11680-4394" }],
  ["BassInfo aptSeq", "getAphusBassInfoV4", { aptSeq: "11680-4394" }]
];

for (const [n, op, p] of ops) await probe(n, op, p);
