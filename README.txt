밝길 (Balgil) — 밤길 안전 경로 안내

[폴더 구조]
balgil/
  index.html                  ← 앱 본체. 이것만 있어도 완전히 작동합니다.
  functions/api/analyze.js    ← AI 백엔드. 2단계에서 Wrangler로 배포합니다.
  README.txt

[1단계 — 정적 배포]
  Cloudflare 대시보드에 balgil 폴더를 드래그하면 끝.
  functions 폴더는 이때 무시됩니다(정상). AI 자리는 규칙 분석이 대신합니다.

[2단계 — AI 백엔드 추가]
  1) aistudio.google.com 에서 API 키 발급 (무료, 카드 불필요)
  2) Cloudflare 프로젝트 Settings > Variables and Secrets 에
     이름: GEMINI_API_KEY  / 타입: Secret  로 등록
  3) 이 폴더에서 아래 명령 실행
     npx wrangler pages deploy . --project-name=밝길프로젝트이름
  4) 앱에서 신고를 등록했을 때 "엔진 — AI 분석" 이 뜨면 성공
