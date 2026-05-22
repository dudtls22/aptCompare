function readBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}

export default async function handler(req, res) {
  const { setCorsHeaders } = await import(new URL("../lib/cors.mjs", import.meta.url).href);
  const { getFavorites, setFavorites } = await import(
    new URL("../lib/favorites-store.mjs", import.meta.url).href
  );
  const { getNotifyConfigStatus } = await import(
    new URL("../lib/notify-store.mjs", import.meta.url).href
  );

  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const body = req.method === "GET" ? null : readBody(req);

  try {
    if (req.method === "GET") {
      const result = await getFavorites();
      res.status(200).json({
        favorites: result.favorites,
        store: result,
        config: getNotifyConfigStatus()
      });
      return;
    }

    if (req.method === "POST" || req.method === "PUT") {
      const list = Array.isArray(body?.favorites) ? body.favorites : null;
      if (!list) {
        res.status(400).json({
          error: "invalid_body",
          message: '{ "favorites": [...] } 형식이 필요합니다.'
        });
        return;
      }

      const result = await setFavorites(list);
      res.status(200).json({
        ok: true,
        favorites: result.favorites,
        store: result,
        config: getNotifyConfigStatus()
      });
      return;
    }

    res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    res.status(500).json({
      error: "favorites_failed",
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
