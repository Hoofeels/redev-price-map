import type { ProjectType, RedevelopmentZone, StageName } from "./types";
import { SIGNGU_BY_NAME, type Signgu } from "./seoulSigngu";

/**
 * 서울 정비사업 정보몽땅 스크래퍼 (cleanup.seoul.go.kr).
 * 데이터 엔드포인트: GET /cleanup/bsnssttus/lsubBsnsSttus.do?signguCode=&pageIndex=
 *   → HTML 조각(사업장 목록 테이블) 반환. 인증키 불필요.
 * 컬럼: [번호, 자치구, 사업구분, 사업장명, 대표지번, 진행단계, ...]
 *
 * parseBsnsListRows는 순수 함수 → HTML 픽스처로 테스트.
 */

const ENDPOINT =
  "https://cleanup.seoul.go.kr/cleanup/bsnssttus/lsubBsnsSttus.do";
const REFERER =
  "https://cleanup.seoul.go.kr/cleanup/bsnssttus/lscrMainIndx.do";

export interface RawBsns {
  signguName: string;
  projectTypeText: string;
  name: string;
  jibun: string;
  stageText: string;
}

/** 진행단계 텍스트 → StageName. 스펙 포함범위(조합설립인가~철거)만 매핑, 그 외 null. */
export function mapStage(text: string): StageName | null {
  const t = text.replace(/\s+/g, "");
  if (t.includes("조합설립인가") || t.includes("주민대표회의")) return "조합설립인가";
  if (t.includes("사업시행인가")) return "사업시행인가";
  if (t.includes("관리처분인가")) return "관리처분인가";
  if (t.includes("철거") || t.includes("이주")) return "이주·철거";
  // 정비계획수립/안전진단/정비구역지정/추진위/착공/분양/준공/이전고시/조합해산/청산 → 제외
  return null;
}

/**
 * 사업구분 텍스트 → ProjectType (재개발/재건축만).
 * 실제 값 예: "재개발(주택정비형)", "재개발(도시정비형)", "재건축".
 * 소규모재건축·가로주택정비·지역주택 등은 스펙 범위 밖 → null.
 * (소규모재건축은 "소"로 시작하므로 startsWith("재건축")에 안 걸림)
 */
export function mapProjectType(text: string): ProjectType | null {
  const t = text.replace(/\s+/g, "");
  if (t.startsWith("재개발") || t.startsWith("주택재개발")) return "재개발";
  if (t.startsWith("재건축") || t.startsWith("주택재건축")) return "재건축";
  return null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** HTML 조각에서 사업장 행을 파싱. */
export function parseBsnsListRows(html: string): RawBsns[] {
  const tbody = /<tbody[\s\S]*?<\/tbody>/i.exec(html);
  const scope = tbody ? tbody[0] : html;
  const rows = scope.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const out: RawBsns[] = [];
  for (const row of rows) {
    const tds = (row.match(/<td[\s\S]*?<\/td>/gi) ?? []).map(stripTags);
    if (tds.length < 6) continue;
    // [0]번호 [1]자치구 [2]사업구분 [3]사업장명 [4]대표지번 [5]진행단계
    const signguName = tds[1];
    if (!signguName.endsWith("구")) continue; // 헤더/안내행 스킵
    out.push({
      signguName,
      projectTypeText: tds[2],
      name: tds[3],
      jibun: tds[4],
      stageText: tds[5],
    });
  }
  return out;
}

/** 재건축 사업장명에서 대표 단지명 추출(휴리스틱). 실거래가 매칭용. */
export function extractComplexName(name: string): string | null {
  let s = name;
  for (const marker of ["주택재개발", "주택재건축", "재개발", "재건축", "정비사업", "도시환경", "조합"]) {
    const i = s.indexOf(marker);
    if (i > 0) {
      s = s.slice(0, i);
      break;
    }
  }
  s = s.replace(/\s+/g, "").replace(/아파트$/, "");
  return s.length >= 2 ? s : null;
}

/**
 * 자치구 전체 사업장 HTML을 1회 요청으로 수집.
 * 주의: 자치구 파라미터명은 `scupBsnsSttus.signguCode`(프리픽스 필수),
 * 페이지 크기는 `pageSize`. 큰 pageSize로 페이지네이션을 회피한다.
 */
export async function fetchBsnsList(
  signguCode: string,
  pageSize = 1000,
): Promise<string> {
  const params = new URLSearchParams({
    "scupBsnsSttus.signguCode": signguCode,
    pageSize: String(pageSize),
    cpage: "1",
  });
  const url = `${ENDPOINT}?${params.toString()}`;
  const res = await fetch(url, { headers: { Referer: REFERER } });
  if (!res.ok) throw new Error(`정보몽땅 fetch 실패: HTTP ${res.status}`);
  return res.text();
}

/** RawBsns → RedevelopmentZone (스테이지/유형 필터, 지오코딩은 자치구 중심+지터 폴백). */
export function toZone(
  raw: RawBsns,
  index: number,
): RedevelopmentZone | null {
  const stage = mapStage(raw.stageText);
  const projectType = mapProjectType(raw.projectTypeText);
  if (!stage || !projectType) return null;

  const signgu: Signgu | undefined = SIGNGU_BY_NAME[raw.signguName];
  // 자치구 중심 + 결정적 지터(겹침 방지). 실좌표는 VWorld 지오코딩으로 후처리(별도 키).
  const jitter = (n: number) => ((index * 9301 + n * 49297) % 233280) / 233280 - 0.5;
  const lat = (signgu?.lat ?? 37.5665) + jitter(1) * 0.04;
  const lng = (signgu?.lng ?? 126.978) + jitter(2) * 0.04;

  return {
    id: `seoul-${signgu?.code ?? "x"}-${index}`,
    name: raw.name,
    sido: "서울",
    sigungu: raw.signguName,
    projectType,
    stage,
    lat,
    lng,
    representativeAddress: `서울 ${raw.signguName} ${raw.jibun}`.trim(),
    representativeComplex: projectType === "재건축" ? extractComplexName(raw.name) : null,
    dataAsOf: "",
    source: "정보몽땅(cleanup.seoul.go.kr)",
    transactions: [],
  };
}
