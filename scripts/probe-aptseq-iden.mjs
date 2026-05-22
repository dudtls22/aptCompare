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
    new URLSearchParams({ ...params, _type: "json", pageNo: "1", numOfRows: "5" }),
    key
  );
  const r = await fetch(`${url}?${q}`, {
    headers: { Referer: "https://www.data.go.kr/" }
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.log(name, r.status, "non-json", text.slice(0, 120));
    return;
  }
  const h = data?.response?.header;
  const body = data?.response?.body;
  const raw = body?.item ?? body?.items?.item;
  const arr = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  console.log(name, r.status, h?.resultCode, h?.resultMsg, "items", arr.length);
  if (arr[0]) console.log(" ", JSON.stringify(arr[0]).slice(0, 240));
}

const devUrl =
  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
const dq = buildDataGoKrQueryString(
  new URLSearchParams({
    LAWD_CD: "11680",
    DEAL_YMD: "202501",
    pageNo: "1",
    numOfRows: "200",
    _type: "json"
  }),
  key
);
const dr = await fetch(`${devUrl}?${dq}`);
const dd = await dr.json();
const items = dd?.response?.body?.items?.item;
const arr = items ? (Array.isArray(items) ? items : [items]) : [];
const hit =
  arr.find((x) => String(x.aptNm || "").includes("래미안대치")) ||
  arr.find((x) => x.aptSeq);
console.log("trade hit", hit?.aptNm, hit?.aptSeq);
const aptSeq = hit?.aptSeq || "11680-380";

await probe(
  "Iden1 aptSeq",
  "https://apis.data.go.kr/1613000/AptIdenInfoService1/getAptIdenInfo",
  { aptSeq }
);
await probe(
  "Iden2 aptSeq",
  "https://apis.data.go.kr/1613000/AptIdenInfoService2/getAptIdenInfoUse",
  { aptSeq }
);
await probe(
  "Basis aptSeq as kaptCode",
  "https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4",
  { kaptCode: aptSeq }
);
