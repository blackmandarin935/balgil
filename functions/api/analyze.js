// 밝길 — AI 신고 분석 백엔드
// 이 파일은 Cloudflare Pages Functions로 실행됩니다.
// 경로가 곧 주소입니다: functions/api/analyze.js  →  https://<프로젝트>.pages.dev/api/analyze
//
// API 키는 브라우저에 내려가지 않고 여기(env.GEMINI_API_KEY)에만 존재합니다.

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  if (!text || text.length > 500) {
    return Response.json({ error: "신고 내용을 확인해 주세요" }, { status: 400 });
  }
  if (!env.GEMINI_API_KEY) {
    return Response.json({ error: "API 키 미설정" }, { status: 503 });
  }

  const prompt =
    "너는 도시 보행 안전 신고를 분류하는 시스템이다. 아래 시민 신고를 읽고 JSON만 출력해라.\n" +
    '형식: {"유형":"조명|시야|노면|치안|기타","심각도":1,"요약":"15자 이내","조치":"20자 이내 담당부서 조치 제안"}\n' +
    "심각도는 1(경미), 2(보통), 3(시급) 중 하나의 숫자.\n\n신고: " + text;

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    "gemini-2.5-flash-lite:generateContent?key=" + env.GEMINI_API_KEY;

  let data;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
      })
    });
    data = await res.json();
  } catch {
    return Response.json({ error: "AI 서버 연결 실패" }, { status: 502 });
  }

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const level = Math.min(3, Math.max(1, Number(parsed.심각도) || 1));
    return Response.json({
      유형: parsed.유형 || "기타",
      심각도: level,
      요약: String(parsed.요약 || "").slice(0, 20),
      조치: String(parsed.조치 || "현장 확인 필요").slice(0, 30)
    });
  } catch {
    return Response.json({ error: "분석 결과 해석 실패" }, { status: 502 });
  }
}
