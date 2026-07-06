# 서울·경기 재개발/재건축 실거래가 지도

서울·경기 지역 정비사업(재개발·재건축) 구역을 지도 위에서 탐색하고, 선택한 구역의 국토교통부 실거래가를 함께 확인하는 웹 애플리케이션입니다.

## 주요 기능

- 🗺️ **지도 탐색** — 서울·경기 정비사업 구역을 마커로 표시 (재개발/재건축 색상 구분, OpenStreetMap 기반)
- 🔎 **필터** — 시도 · 사업유형 · 정비 단계(선택 단계 이상) · 키워드 검색
- 📋 **구역 상세 패널** — 선택 구역의 기본 정보와 거래 내역
- 💰 **국토부 실거래가 라이브** — 선택 구역의 시군구 실거래가를 실시간 조회해 매칭 (`MOLIT_API_KEY` 설정 시)

## 기술 스택

- [Next.js](https://nextjs.org) 16 (App Router) · React 19 · TypeScript
- [Leaflet](https://leafletjs.com) / react-leaflet (지도)
- Tailwind CSS 4
- Vitest (유닛) · Playwright (E2E)

## 로컬 실행

```bash
npm install
npm run dev            # http://localhost:3000
```

실거래가 라이브 기능을 쓰려면 [공공데이터포털](https://www.data.go.kr)에서 국토교통부 실거래가 서비스키를 발급받아 `.env.local`에 넣으세요 (`.env.example` 참고):

```
MOLIT_API_KEY=발급받은_서비스키
```

키가 없어도 앱은 정상 동작하며, 실거래가만 표시되지 않습니다(graceful degrade).

## 데이터 출처

| 데이터 | 출처 | 비고 |
| --- | --- | --- |
| 서울 정비사업 구역 | 정보몽땅(cleanup.seoul.go.kr) | 공개 데이터 |
| 경기 정비사업 구역 | 경기데이터드림(data.gg.go.kr) | 공개 OpenAPI |
| 실거래가 | 국토교통부(data.go.kr) | 런타임 API 조회 |
| 시군구 행정경계 | KOSTAT / [southkorea-maps](https://github.com/southkorea/southkorea-maps)(POPONG) | CC BY 4.0 (출처표시) |

> **⚠️ 로컬 전용 데이터**
> 네이버부동산 호가(`data/naver-asking.json`)와 서울 정비구역 경계 폴리곤(`data/zone-boundaries.json`, 공공누리 4유형)은
> 각 서비스 ToS/라이선스상 **공개 재배포가 제한**되어 저장소에는 빈 파일(`[]` / `{}`)로만 커밋됩니다.
> 실데이터는 로컬에서 스크립트로 생성해 로컬에서만 사용합니다(`docs/NEXT_STEPS.md` 참고).
> 따라서 공개 배포본에는 호가·경계 폴리곤이 표시되지 않습니다.

## 배포

[Vercel](https://vercel.com)에 GitHub 저장소를 연결하면 `main` 브랜치 push마다 자동 배포됩니다.
서버 라우트(`/api/transactions`)가 서버리스 함수로 동작하므로 실거래가 라이브 기능이 그대로 유지됩니다.
Vercel 프로젝트 설정에서 환경변수 `MOLIT_API_KEY`(server-side)를 추가하세요.
