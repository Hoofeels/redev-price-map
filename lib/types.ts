// 도메인 모델 — 스펙 Ontology(8 엔티티) 기반
// .omc/specs/deep-interview-seoul-gyeonggi-redevelopment-price-map.md

export type SiDo = "서울" | "경기";

export type ProjectType = "재개발" | "재건축";

/** 포함 단계: 조합설립인가 ~ 관리처분인가(이주·철거 포함, 착공부터 제외) */
export type StageName =
  | "조합설립인가"
  | "사업시행인가"
  | "관리처분인가"
  | "이주·철거";

export const STAGE_ORDER: StageName[] = [
  "조합설립인가",
  "사업시행인가",
  "관리처분인가",
  "이주·철거",
];

export type DealType = "기존매물" | "입주권";

export type PropertyType = "아파트" | "빌라·단독";

/** 국토부 실거래 1건 */
export interface Transaction {
  id: string;
  /** 거래일 YYYY-MM-DD */
  date: string;
  /** 거래금액(만원) */
  priceManwon: number;
  /** 전용면적(㎡) */
  areaM2: number;
  /** 층 (없으면 null) */
  floor: number | null;
  /** 단지명/주소 (대표 매칭 기준) */
  complexName: string | null;
  /** 법정동명 (재개발 구역 매칭용, 있으면) */
  dong?: string | null;
  dealType: DealType;
  propertyType: PropertyType;
}

/** 정비구역 (core domain) */
export interface RedevelopmentZone {
  id: string;
  name: string;
  sido: SiDo;
  sigungu: string;
  projectType: ProjectType;
  stage: StageName;
  /** 구역 중심 좌표 (마커) */
  lat: number;
  lng: number;
  /** 경계 폴리곤 (확보된 구역만, [lat, lng][]) */
  boundary?: [number, number][];
  /** 실거래가 매칭 대표 주소 */
  representativeAddress: string;
  /** 재건축 대상 대표 단지 (재개발은 null 가능) */
  representativeComplex?: string | null;
  /** 데이터 기준일 YYYY-MM-DD (불완전성 투명 표시) */
  dataAsOf: string;
  /** 데이터 출처 */
  source: string;
  /** 실주소 지오코딩으로 좌표 확정 여부(false면 시군구 중심 근사) */
  geocoded?: boolean;
  transactions: Transaction[];
}

export interface ZoneFilter {
  sido: SiDo | "전체";
  projectType: ProjectType | "전체";
  stage: StageName | "전체";
  /** 시군구 부분일치 검색어 */
  query: string;
}

export const DEFAULT_FILTER: ZoneFilter = {
  sido: "전체",
  projectType: "전체",
  stage: "전체",
  query: "",
};
