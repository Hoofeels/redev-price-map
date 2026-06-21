import { describe, it, expect } from "vitest";
import {
  parseBsnsListRows,
  mapStage,
  mapProjectType,
  extractComplexName,
  toZone,
} from "./cleanup";

// 정보몽땅 lsubBsnsSttus.do 응답 구조를 본뜬 픽스처
const FIXTURE = `<table class="table01"><tbody>
<tr><td>1</td><td>강남구</td><td>재건축</td><td>개포주공5단지아파트 재건축정비사업 조합</td><td>개포동 187</td><td>관리처분인가</td><td>100건</td><td>-</td><td>100%</td><td>지도</td></tr>
<tr><td>2</td><td>강남구</td><td>재건축</td><td>개포주공4단지아파트 재건축정비사업 조합</td><td>개포동 189</td><td>준공인가</td><td>50건</td><td>-</td><td>90%</td><td>지도</td></tr>
<tr><td>3</td><td>노원구</td><td>재개발</td><td>상계뉴타운4구역 주택재개발정비사업조합</td><td>상계동 100</td><td>사업시행인가</td><td>30건</td><td>-</td><td>80%</td><td>지도</td></tr>
<tr><td>4</td><td>강남구</td><td>소규모재건축</td><td>개포현대2차 소규모재건축사업조합</td><td>개포동 12</td><td>조합설립인가</td><td>10건</td><td>-</td><td>70%</td><td>지도</td></tr>
</tbody></table>`;

describe("parseBsnsListRows", () => {
  it("4개 행을 파싱한다", () => {
    const rows = parseBsnsListRows(FIXTURE);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      signguName: "강남구",
      projectTypeText: "재건축",
      jibun: "개포동 187",
      stageText: "관리처분인가",
    });
  });
});

describe("mapStage", () => {
  it("포함 단계만 매핑", () => {
    expect(mapStage("조합설립인가")).toBe("조합설립인가");
    expect(mapStage("사업시행인가")).toBe("사업시행인가");
    expect(mapStage("관리처분인가")).toBe("관리처분인가");
    expect(mapStage("철거")).toBe("이주·철거");
  });
  it("제외 단계는 null", () => {
    expect(mapStage("준공인가")).toBeNull();
    expect(mapStage("착공")).toBeNull();
    expect(mapStage("추진위원회승인")).toBeNull();
    expect(mapStage("조합해산")).toBeNull();
  });
});

describe("mapProjectType", () => {
  it("재개발/재건축만, 소규모재건축 등은 제외", () => {
    expect(mapProjectType("재개발")).toBe("재개발");
    expect(mapProjectType("재개발(주택정비형)")).toBe("재개발");
    expect(mapProjectType("재개발(도시정비형)")).toBe("재개발");
    expect(mapProjectType("재건축")).toBe("재건축");
    expect(mapProjectType("소규모재건축")).toBeNull();
    expect(mapProjectType("가로주택정비")).toBeNull();
    expect(mapProjectType("지역주택")).toBeNull();
    expect(mapProjectType("도시환경")).toBeNull();
  });
});

describe("extractComplexName", () => {
  it("재건축 사업장명에서 대표 단지명을 추출", () => {
    expect(extractComplexName("개포주공5단지아파트 재건축정비사업 조합")).toBe("개포주공5단지");
    expect(extractComplexName("은마아파트 주택재건축정비사업조합")).toBe("은마");
  });
});

describe("toZone (필터)", () => {
  it("포함 단계+재개발/재건축만 zone으로 변환", () => {
    const rows = parseBsnsListRows(FIXTURE);
    const zones = rows.map((r, i) => toZone(r, i)).filter(Boolean);
    // row1(관리처분 재건축)✓, row2(준공 제외)✗, row3(사업시행 재개발)✓, row4(소규모재건축 제외)✗
    expect(zones).toHaveLength(2);
    const z0 = zones[0]!;
    expect(z0.sigungu).toBe("강남구");
    expect(z0.stage).toBe("관리처분인가");
    expect(z0.projectType).toBe("재건축");
    expect(z0.representativeComplex).toBe("개포주공5단지");
    expect(z0.representativeAddress).toBe("서울 강남구 개포동 187");
    expect(z0.sido).toBe("서울");
  });
});
