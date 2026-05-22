import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildDataGoKrQueryString } from "../lib/data-go-key.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(dir, "..", ".env"), "utf8").split(/\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq <= 0) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if (k) process.env[k] = v;
}
const key = process.env.DATA_GO_KR_SERVICE_KEY;

function parseItems(data) {
  const raw = data?.response?.body?.item ?? data?.response?.body?.items?.item;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

const tries = [
  ["V4 legal n10", "https://apis.data.go.kr/1613000/AptListServiceV4/getLegaldongAptListV4", { bjdCode: "1168010600", pageNo: "1", numOfRows: "10" }],
  ["V4 11680101", "https://apis.data.go.kr/1613000/AptListServiceV4/getLegaldongAptListV4", { bjdCode: "1168010100", pageNo: "1", numOfRows: "10" }],
  ["V4 11680103", "https://apis.data.go.kr/1613000/AptListServiceV4/getLegaldongAptListV4", { bjdCode: "1168010300", pageNo: "1", numOfRows: "10" }],
  ["V3 legal n10", "https://apis.data.go.kr/1613000/AptListServiceV3/getLegaldongAptListV3", { bjdCode: "1168010600", pageNo: "1", numOfRows: "10" }],
  ["1611 legal", "http://apis.data.go.kr/1611000/AptListService/getLegaldongAptList", { bjdCode: "1168010600", pageNo: "1", numOfRows: "10" }],
  ["1611 loadCode", "http://apis.data.go.kr/1611000/AptListService/getLegaldongAptList", { loadCode: "1168010600", pageNo: "1", numOfRows: "10" }],
  ["1611 lawd", "http://apis.data.go.kr/1611000/AptListService/getLegaldongAptList", { LAWD_CD: "11680", pageNo: "1", numOfRows: "10" }],
  ["V4 sig n10", "https://apis.data.go.kr/1613000/AptListServiceV4/getSigunguAptListV4", { bjdCode: "11680", pageNo: "1", numOfRows: "10" }]
];

for (const [name, url, p] of [
  ...tries,
  ["V4 legal xml", "https://apis.data.go.kr/1613000/AptListServiceV4/getLegaldongAptListV4", { bjdCode: "1168010600", pageNo: "1", numOfRows: "5" }]
]) {
  const params = { ...p };
  const useJson = !name.includes("xml");
  if (useJson) params._type = "json";
  const q = buildDataGoKrQueryString(new URLSearchParams(params), key);
  const r = await fetch(`${url}?${q}`);
  const t = await r.text();
  let line = `${name} HTTP ${r.status}`;
  try {
    const d = JSON.parse(t);
    const arr = parseItems(d);
    line += ` ${d?.response?.header?.resultCode} n=${arr.length}`;
    if (arr[0]) line += ` sample=${arr[0].kaptCode || arr[0].kaptcode} ${arr[0].kaptName || arr[0].kaptname}`;
  } catch {
    line += ` ${t.slice(0, 50)}`;
  }
  console.log(line);
}

{
  const q = buildDataGoKrQueryString(
    new URLSearchParams({
      sigunguCd: "11680",
      bjdongCd: "10600",
      platGbCd: "0",
      bun: "0065",
      ji: "0000",
      _type: "json"
    }),
    key
  );
  const r = await fetch(
    `https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo?${q}`
  );
  console.log("building recap", r.status, (await r.text()).slice(0, 120));
}

{
  const p = { bjdCode: "1168010600", pageNo: "1", numOfRows: "5" };
  const q1 = buildDataGoKrQueryString(new URLSearchParams({ ...p, _type: "json" }), key);
  const q2 = `ServiceKey=${encodeURIComponent(key)}&bjdCode=1168010600&pageNo=1&numOfRows=5`;
  for (const [label, q] of [
    ["serviceKey json", q1],
    ["ServiceKey caps", q2]
  ]) {
    const r = await fetch(
      `https://apis.data.go.kr/1613000/AptListServiceV3/getLegaldongAptListV3?${q}`
    );
    console.log("list key style", label, r.status, (await r.text()).slice(0, 80));
  }
}
