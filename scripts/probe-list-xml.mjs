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
const url =
  "https://apis.data.go.kr/1613000/AptListServiceV4/getLegaldongAptListV4";

for (const type of ["json", "xml", null]) {
  const params = { bjdCode: "1168010600", pageNo: "1", numOfRows: "5" };
  if (type) params._type = type;
  const q = buildDataGoKrQueryString(new URLSearchParams(params), key);
  const r = await fetch(`${url}?${q}`, { headers: { Referer: "https://www.data.go.kr/" } });
  const t = await r.text();
  console.log("\n_type=", type ?? "(none)", "status", r.status);
  console.log(t.slice(0, 300));
}
