import { readFileSync } from "fs";
import { redisSet, redisGet, hasRedis, parseRedisJsonList } from "../lib/redis.mjs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
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

const key = "apt:favorites:__test__";
const payload = [{ lawdCd: "11140", guName: "중구", dong: "명동", apt: "테스트아파트", area: "", notify: false }];

console.log("hasRedis", hasRedis());
await redisSet(key, payload);
const raw = await redisGet(key);
console.log("raw sample", String(raw).slice(0, 80));
const parsed = parseRedisJsonList(raw);
console.log("ok", parsed.length === 1 && parsed[0].apt === "테스트아파트");

const legacy = JSON.stringify(JSON.stringify(payload));
const legacyParsed = parseRedisJsonList(legacy);
console.log("legacyOk", legacyParsed.length === 1 && legacyParsed[0].apt === "테스트아파트");
