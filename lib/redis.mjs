export function hasRedis() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || "").trim() &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim()
  );
}

export async function redisKeys(pattern) {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) {
    return [];
  }

  const res = await fetch(`${url}/keys/${encodeURIComponent(pattern)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Redis KEYS failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data?.result) ? data.result : [];
}

export async function redisGet(key) {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) {
    return null;
  }

  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error(`Redis GET failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data?.result == null) {
    return null;
  }
  return data.result;
}

export async function redisSet(key, value) {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL·TOKEN 이 설정되지 않았습니다.");
  }

  const stringValue = typeof value === "string" ? value : JSON.stringify(value);
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(stringValue)
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Redis SET failed: HTTP ${res.status}${detail ? ` — ${detail.slice(0, 120)}` : ""}`
    );
  }
  return true;
}
