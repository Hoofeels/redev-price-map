import type { RedevelopmentZone } from "./types";
import { SEOUL_SIGNGU } from "./seoulSigngu";

/**
 * 시군구 → 법정동코드(LAWD_CD, 5자리). 국토부 실거래가 API LAWD_CD 파라미터용.
 * 서울: SEOUL_SIGNGU(25개 전체)에서 조달.
 * 경기: 구 단위(파티션된 시) + 시 단위 테이블. 구는 주소에서 파싱.
 */

const SEOUL_LAWD: Record<string, string> = Object.fromEntries(
  SEOUL_SIGNGU.map((s) => [s.name, s.code]),
);

// 경기: 자치구(파티션된 시) 단위 코드
const GYEONGGI_GU_LAWD: Record<string, string> = {
  // 수원시
  장안구: "41111", 권선구: "41113", 팔달구: "41115", 영통구: "41117",
  // 성남시
  수정구: "41131", 중원구: "41133", 분당구: "41135",
  // 고양시
  덕양구: "41281", 일산동구: "41285", 일산서구: "41287",
  // 안양시
  만안구: "41171", 동안구: "41173",
  // 안산시
  상록구: "41271", 단원구: "41273",
  // 용인시
  처인구: "41461", 기흥구: "41463", 수지구: "41465",
};

// 경기: 비파티션 시·군 단위 코드
const GYEONGGI_SI_LAWD: Record<string, string> = {
  수원시: "41110", 성남시: "41130", 의정부시: "41150", 안양시: "41170",
  부천시: "41190", 광명시: "41210", 평택시: "41220", 동두천시: "41250",
  안산시: "41270", 고양시: "41280", 과천시: "41290", 구리시: "41310",
  남양주시: "41360", 오산시: "41370", 시흥시: "41390", 군포시: "41410",
  의왕시: "41430", 하남시: "41450", 용인시: "41460", 파주시: "41480",
  이천시: "41500", 안성시: "41550", 김포시: "41570", 화성시: "41590",
  광주시: "41610", 양주시: "41630", 포천시: "41650", 여주시: "41670",
  연천군: "41800", 가평군: "41820", 양평군: "41830",
};

/**
 * 주소에서 (파티션된 시의) 자치구명을 탐지.
 * 주의: JS 정규식 `\b`는 한글을 단어문자로 보지 않아 `([가-힣]+구)\b`가
 * "영통구 " 같은 토큰을 못 잡는다(→ 항상 시-단위 코드로 폴백, MOLIT 0건).
 * 알려진 자치구 목록과 includes로 매칭해 정확한 구-단위 LAWD_CD를 얻는다.
 */
function extractGu(address: string): string | null {
  for (const gu of Object.keys(GYEONGGI_GU_LAWD)) {
    if (address.includes(gu)) return gu;
  }
  return null;
}

/**
 * 파티션 시 주소에 자치구가 없을 때(예: "고양시 행신동", "안산시 고잔동") 법정동→자치구 보정.
 * 오탐 방지를 위해 3자 이상 동만 등록(짧은 2자 동은 부분일치 위험). 필요 시 확장.
 */
const GYEONGGI_DONG_GU: Record<string, string> = {
  // 고양시 — 덕양구
  행신동: "덕양구", 화정동: "덕양구", 주교동: "덕양구", 성사동: "덕양구",
  원당동: "덕양구", 능곡동: "덕양구", 토당동: "덕양구",
  // 고양시 — 일산동구
  일산동: "일산동구", 마두동: "일산동구", 백석동: "일산동구",
  장항동: "일산동구", 정발산동: "일산동구",
  // 고양시 — 일산서구
  주엽동: "일산서구", 대화동: "일산서구", 탄현동: "일산서구", 가좌동: "일산서구",
  // 안산시 — 단원구
  고잔동: "단원구", 원곡동: "단원구", 초지동: "단원구", 선부동: "단원구",
  // 안산시 — 상록구
  본오동: "상록구", 부곡동: "상록구",
};

function extractGuFromDong(address: string): string | null {
  for (const dong of Object.keys(GYEONGGI_DONG_GU)) {
    if (address.includes(dong)) return GYEONGGI_DONG_GU[dong];
  }
  return null;
}

export function getLawdCode(
  zone: Pick<RedevelopmentZone, "sigungu" | "sido" | "representativeAddress">,
): string | null {
  if (zone.sido === "서울") {
    return SEOUL_LAWD[zone.sigungu] ?? null;
  }
  if (zone.sido === "경기") {
    // 파티션된 시: 주소의 구 → (없으면) 법정동→구 보정 → 그래도 없으면 시 단위
    const addr = zone.representativeAddress;
    const gu = addr ? (extractGu(addr) ?? extractGuFromDong(addr)) : null;
    if (gu && GYEONGGI_GU_LAWD[gu]) return GYEONGGI_GU_LAWD[gu];
    return GYEONGGI_SI_LAWD[zone.sigungu] ?? null;
  }
  return null;
}
