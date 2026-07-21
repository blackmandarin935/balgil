// 밝길 — AI 신고 분석 백엔드 (Cloudflare Pages Functions)
// 경로가 곧 주소: functions/api/analyze.js → /api/analyze
// API 키는 브라우저로 내려가지 않고 env.GEMINI_API_KEY 에만 있습니다.

const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash"
];
const TYPES = new Set(["조명", "시야", "노면", "치안", "기타"]);

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "잘못된 요청" }, 400);
  }

  const text = (body.text || "").trim();
  if (!text || text.length > 500) return json({ error: "신고 내용을 확인해 주세요" }, 400);
  if (!env.GEMINI_API_KEY) return json({ error: "API 키 미설정" }, 503);

  const prompt =
    "너는 도시 보행 안전 신고를 분류하는 시스템이다. 아래 시민 신고는 한국어, English, 日本語, 简体中文, Tiếng Việt, Español, Français 중 하나로 작성될 수 있다. JSON만 출력해라.\n" +
    '형식: {"유형":"조명|시야|노면|치안|기타","심각도":1,"요약":"15자 이내","조치":"20자 이내 담당부서 조치 제안"}\n' +
    "심각도는 1(경미), 2(보통), 3(시급) 중 하나의 숫자.\n\n신고: " + text;

  const tried = [];

  for (const model of MODELS) {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
                model + ":generateContent?key=" + env.GEMINI_API_KEY;

    let res, data;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        })
      });
      data = await res.json();
    } catch (e) {
      tried.push({ model, 단계: "연결", 메시지: String(e) });
      continue;
    }

    if (!res.ok || data.error) {
      tried.push({
        model,
        단계: "구글응답",
        status: res.status,
        메시지: data?.error?.message || "알 수 없음",
        사유: data?.error?.status || ""
      });
      continue;
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!raw) {
      tried.push({
        model,
        단계: "빈응답",
        차단사유: data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || "없음"
      });
      continue;
    }

    try {
      const p = JSON.parse(raw.replace(/```json|```/g, "").trim());
      return json({
        유형: TYPES.has(p.유형) ? p.유형 : "기타",
        심각도: Math.min(3, Math.max(1, Number(p.심각도) || 1)),
        요약: String(p.요약 || "").slice(0, 20),
        조치: String(p.조치 || "현장 확인 필요").slice(0, 30),
        모델: model
      });
    } catch {
      tried.push({ model, 단계: "파싱", 원본: raw.slice(0, 200) });
    }
  }

  return json({ error: "모든 모델 실패", 시도내역: tried }, 502);
}

// 브라우저에서 주소창에 /api/analyze 를 그냥 열면 상태를 알려줍니다.
export async function onRequestGet({ env }) {
  if (!env.GEMINI_API_KEY) {
    return json({ 상태: "키 없음", 안내: "GEMINI_API_KEY 를 Secret 으로 등록하고 재배포하세요" }, 503);
  }
  const keyLen = env.GEMINI_API_KEY.length;
  const looksOk = env.GEMINI_API_KEY.startsWith("AIza");

  let models = [];
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + env.GEMINI_API_KEY);
    const d = await r.json();
    if (d.error) {
      return json({ 상태: "키 거부됨", 키길이: keyLen, AIza로시작: looksOk, 구글메시지: d.error.message }, 502);
    }
    models = (d.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map(m => m.name.replace("models/", ""))
      .slice(0, 40);
  } catch (e) {
    return json({ 상태: "연결 실패", 메시지: String(e) }, 502);
  }

  return json({ 상태: "정상", 키길이: keyLen, AIza로시작: looksOk, 사용가능모델: models });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
