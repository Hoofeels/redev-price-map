import { describe, it, expect } from "vitest";
import {
  parseGyeonggiResponse,
  parseTotalCount,
  deriveGyeonggiStage,
  toGyeonggiZone,
  extractGyeonggiComplex,
  looksLikeZoneCode,
  correctName,
  type GyeonggiRow,
} from "./gyeonggi";

// 실제 GenrlimprvBizpropls 응답 구조를 본뜬 픽스처
const FIXTURE = {
  GenrlimprvBizpropls: [
    {
      head: [
        { list_total_count: 5 },
        { RESULT: { CODE: "INFO-000", MESSAGE: "정상 처리되었습니다." } },
        { api_version: "1.0" },
      ],
    },
    {
      row: [
        {
          SIGUN_NM: "고양시",
          SIGUN_CD: "41280",
          BIZ_TYPE_NM: "재개발",
          IMPRV_ZONE_NM: "일산Ⅰ-2구역",
          LOCPLC_ADDR: "경기도 고양시 일산동 960-16번지 일원",
          ASSOCTN_FOUND_CONFMTN_DE: "20190115",
          BIZ_IMPLMTN_CONFMTN_DE: null,
          MANAGE_DISPOSIT_CONFMTN_DE: null,
          STRCONTR_DE: null,
          GENRL_LOTOUT_DE: null,
          COMPLTN_DE: null,
        },
        {
          SIGUN_NM: "수원시",
          SIGUN_CD: "41110",
          BIZ_TYPE_NM: "재건축",
          IMPRV_ZONE_NM: "권선6구역",
          LOCPLC_ADDR: "경기도 수원시 권선구",
          ASSOCTN_FOUND_CONFMTN_DE: "20200101",
          BIZ_IMPLMTN_CONFMTN_DE: "20210101",
          MANAGE_DISPOSIT_CONFMTN_DE: "20220101",
          STRCONTR_DE: null,
          GENRL_LOTOUT_DE: null,
          COMPLTN_DE: null,
        },
        {
          SIGUN_NM: "성남시",
          SIGUN_CD: "41130",
          BIZ_TYPE_NM: "재건축",
          IMPRV_ZONE_NM: "신흥구역",
          ASSOCTN_FOUND_CONFMTN_DE: "20180101",
          STRCONTR_DE: "20230101", // 착공 → 제외
        },
        {
          SIGUN_NM: "부천시",
          BIZ_TYPE_NM: "주거환경개선", // 유형 밖 → 제외
          IMPRV_ZONE_NM: "x",
          ASSOCTN_FOUND_CONFMTN_DE: "20200101",
        },
        {
          SIGUN_NM: "안양시",
          BIZ_TYPE_NM: "재개발",
          IMPRV_ZONE_NM: "y",
          ASSOCTN_FOUND_CONFMTN_DE: null, // 조합설립 전 → 제외
        },
      ] as GyeonggiRow[],
    },
  ],
};

describe("parseGyeonggiResponse / parseTotalCount", () => {
  it("row 배열과 총건수를 파싱", () => {
    expect(parseGyeonggiResponse(FIXTURE)).toHaveLength(5);
    expect(parseTotalCount(FIXTURE)).toBe(5);
  });
  it("비정상 입력은 빈 배열", () => {
    expect(parseGyeonggiResponse({})).toEqual([]);
    expect(parseGyeonggiResponse(null)).toEqual([]);
  });
});

describe("deriveGyeonggiStage", () => {
  const rows = parseGyeonggiResponse(FIXTURE);
  it("날짜 필드로 단계 도출", () => {
    expect(deriveGyeonggiStage(rows[0])).toBe("조합설립인가");
    expect(deriveGyeonggiStage(rows[1])).toBe("관리처분인가");
    expect(deriveGyeonggiStage(rows[2])).toBeNull(); // 착공
    expect(deriveGyeonggiStage(rows[4])).toBeNull(); // 조합설립 전
  });
});

describe("extractGyeonggiComplex", () => {
  it("괄호 안 단지명을 추출(숫자 이전)", () => {
    expect(extractGyeonggiComplex("영통2구역(매탄주공4,5단지)")).toBe("매탄주공");
    expect(extractGyeonggiComplex("팔달1구역(현대아파트)")).toBe("현대");
  });
  it("괄호 없으면 일반 휴리스틱", () => {
    expect(extractGyeonggiComplex("은행주공아파트")).toBe("은행주공");
  });
  it("구역명(단지 아님)은 null → 법정동 폴백에 위임", () => {
    // B fix: 괄호없는 구역명은 MOLIT 단지명과 절대 매칭 안 됨
    expect(extractGyeonggiComplex("행신Ⅱ-1구역")).toBeNull(); // 로마숫자+구역
    expect(extractGyeonggiComplex("115-12구역")).toBeNull(); // 번호+구역
    expect(extractGyeonggiComplex("권선6구역")).toBeNull(); // 구역
  });
  it("결합단지(·)는 정상 단지명으로 유지", () => {
    expect(extractGyeonggiComplex("성지·궁전아파트")).toBe("성지·궁전");
  });
});

describe("looksLikeZoneCode", () => {
  it("구역/로마숫자/번호시작은 구역명", () => {
    expect(looksLikeZoneCode("행신Ⅱ-1구역")).toBe(true);
    expect(looksLikeZoneCode("115-12구역")).toBe(true);
    expect(looksLikeZoneCode("권선6구역")).toBe(true);
  });
  it("실제 단지명은 구역명 아님", () => {
    expect(looksLikeZoneCode("은행주공")).toBe(false);
    expect(looksLikeZoneCode("매탄주공")).toBe(false);
    expect(looksLikeZoneCode("성지·궁전")).toBe(false);
    expect(looksLikeZoneCode("고잔연립6")).toBe(false); // 끝 숫자는 허용(연립명)
  });
});

describe("correctName (소스 문자깨짐 보정)", () => {
  it("'?'(U+003F)를 결합단지 구분자 '·'로 보정", () => {
    // C fix: 경기데이터드림 원본이 '성지?궁전아파트'로 깨져 옴
    expect(correctName("성지?궁전아파트")).toBe("성지·궁전아파트");
  });
  it("정상 이름은 그대로", () => {
    expect(correctName("은행주공아파트")).toBe("은행주공아파트");
  });
  it("재건축 row에 보정+대표단지가 반영", () => {
    const row: GyeonggiRow = {
      SIGUN_NM: "성남시",
      SIGUN_CD: "41130",
      BIZ_TYPE_NM: "재건축",
      IMPRV_ZONE_NM: "성지?궁전아파트",
      LOCPLC_ADDR: "경기도 성남시 중원구 상대원동 195-5",
      ASSOCTN_FOUND_CONFMTN_DE: "20180101",
      MANAGE_DISPOSIT_CONFMTN_DE: "20220101",
    };
    const zone = toGyeonggiZone(row, 0)!;
    expect(zone.name).toBe("성지·궁전아파트");
    expect(zone.representativeComplex).toBe("성지·궁전");
  });
});

describe("toGyeonggiZone (필터)", () => {
  it("포함 단계+재개발/재건축만 zone으로 변환", () => {
    const rows = parseGyeonggiResponse(FIXTURE);
    const zones = rows.map((r, i) => toGyeonggiZone(r, i)).filter(Boolean);
    expect(zones).toHaveLength(2); // 고양 재개발(조합설립) + 수원 재건축(관리처분)
    const z0 = zones[0]!;
    expect(z0.sido).toBe("경기");
    expect(z0.sigungu).toBe("고양시");
    expect(z0.stage).toBe("조합설립인가");
    expect(z0.projectType).toBe("재개발");
    expect(z0.representativeAddress).toContain("일산동");
    expect(z0.source).toContain("경기데이터드림");
  });
});
