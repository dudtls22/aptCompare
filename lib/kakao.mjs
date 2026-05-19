export async function sendKakaoMemo(text) {
  const token = (process.env.KAKAO_ACCESS_TOKEN || "").trim();
  if (!token) {
    throw new Error("KAKAO_ACCESS_TOKEN 이 설정되지 않았습니다.");
  }

  const template = {
    object_type: "text",
    text: String(text).slice(0, 1800),
    link: {
      web_url: "https://dudtls22.github.io/aptCompare/",
      mobile_web_url: "https://dudtls22.github.io/aptCompare/"
    }
  };

  const body = new URLSearchParams({
    template_object: JSON.stringify(template)
  });

  const res = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
    },
    body: body.toString()
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errJson = await res.json();
      detail = errJson?.msg || errJson?.message || JSON.stringify(errJson);
    } catch {
      detail = await res.text();
    }
    throw new Error(`카카오 전송 실패 (HTTP ${res.status}): ${detail}`);
  }

  return { ok: true };
}
