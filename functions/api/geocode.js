// 밝길 — 주소 검색 프록시 (Cloudflare Pages Functions)
// Nominatim의 검색 결과를 화면이 쓰는 간단한 형식으로 바꿉니다.

const LANGUAGES = new Set(["ko", "en", "ja", "zh-CN", "vi", "es", "fr"]);

export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  const query = (requestUrl.searchParams.get("q") || "").trim().replace(/\s+/g, " ");
  const language = LANGUAGES.has(requestUrl.searchParams.get("lang")) ? requestUrl.searchParams.get("lang") : "ko";

  if (!query || query.length > 120) return json({ error: "검색어를 확인해 주세요" }, 400);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    format: "jsonv2", limit: "5", "accept-language": language, q: query
  }).toString();

  let response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    return json({ error: "주소 검색 서버에 연결하지 못했습니다" }, 502);
  }
  if (!response.ok) return json({ error: "주소 검색 서버 응답 " + response.status }, 502);

  const results = await response.json();
  return json({
    결과: results.slice(0, 5).map(place => ({
      이름: String(place.display_name || ""),
      lat: Number(place.lat), lon: Number(place.lon)
    })).filter(place => Number.isFinite(place.lat) && Number.isFinite(place.lon))
  }, 200, "public, max-age=3600");
}

export async function onRequest() {
  return json({ error: "GET 요청만 지원합니다" }, 405);
}

function json(body, status = 200, cacheControl = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl
    }
  });
}
