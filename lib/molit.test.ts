import { describe, it, expect } from "vitest";
import {
  parseMolitXml,
  buildMolitUrl,
  recentDealMonths,
  assertMolitOk,
} from "./molit";

// 영문 태그(1613000 v2) — 아파트 매매 2건
const APT_XML_EN = `<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>
<item><aptNm>개포주공6단지</aptNm><dealAmount>235,000</dealAmount><dealYear>2025</dealYear><dealMonth>10</dealMonth><dealDay>2</dealDay><excluUseAr>53.6</excluUseAr><floor>5</floor><umdNm>개포동</umdNm></item>
<item><aptNm>이웃단지</aptNm><dealAmount>120,000</dealAmount><dealYear>2025</dealYear><dealMonth>11</dealMonth><dealDay>15</dealDay><excluUseAr>84.9</excluUseAr><floor>3</floor><umdNm>개포동</umdNm></item>
</items><numOfRows>100</numOfRows><pageNo>1</pageNo><totalCount>2</totalCount></body></response>`;

// 한글 태그 + 단일 item(배열 아님) — 연립다세대
const RH_XML_KO = `<response><body><items><item><연립다세대>상계빌라</연립다세대><거래금액>78,000</거래금액><년>2025</년><월>11</월><일>12</일><전용면적>59.8</전용면적><층>3</층><법정동>상계동</법정동></item></items></body></response>`;

const EMPTY_XML = `<response><header><resultCode>000</resultCode></header><body><items></items><totalCount>0</totalCount></body></response>`;

describe("parseMolitXml", () => {
  it("영문 태그 아파트 2건을 파싱한다", () => {
    const txs = parseMolitXml(APT_XML_EN, "apt");
    expect(txs).toHaveLength(2);
    const first = txs[0];
    expect(first.date).toBe("2025-10-02");
    expect(first.priceManwon).toBe(235000);
    expect(first.areaM2).toBeCloseTo(53.6);
    expect(first.floor).toBe(5);
    expect(first.complexName).toBe("개포주공6단지");
    expect(first.dong).toBe("개포동");
    expect(first.dealType).toBe("기존매물");
    expect(first.propertyType).toBe("아파트");
  });

  it("한글 태그 + 단일 item을 배열로 정규화한다", () => {
    const txs = parseMolitXml(RH_XML_KO, "rh");
    expect(txs).toHaveLength(1);
    expect(txs[0].priceManwon).toBe(78000);
    expect(txs[0].date).toBe("2025-11-12");
    expect(txs[0].complexName).toBe("상계빌라");
    expect(txs[0].propertyType).toBe("빌라·단독");
  });

  it("빈 items는 빈 배열을 반환한다", () => {
    expect(parseMolitXml(EMPTY_XML, "apt")).toEqual([]);
  });
});

describe("assertMolitOk", () => {
  it("성공코드(00/000)는 통과", () => {
    expect(() => assertMolitOk(APT_XML_EN)).not.toThrow();
    expect(() => assertMolitOk("<response><body></body></response>")).not.toThrow();
  });
  it("오류코드(쿼터/키)는 throw", () => {
    const errXml = `<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>22</returnReasonCode><returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>`;
    expect(() => assertMolitOk(errXml)).toThrow(/22/);
    const keyErr = `<response><header><resultCode>30</resultCode><resultMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</resultMsg></header></response>`;
    expect(() => assertMolitOk(keyErr)).toThrow(/30/);
  });
});

describe("buildMolitUrl", () => {
  it("필수 파라미터를 포함한다", () => {
    const url = buildMolitUrl("apt", {
      serviceKey: "KEY123",
      lawdCd: "11680",
      dealYmd: "202604",
    });
    expect(url).toContain("/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev");
    expect(url).toContain("serviceKey=KEY123");
    expect(url).toContain("LAWD_CD=11680");
    expect(url).toContain("DEAL_YMD=202604");
  });
});

describe("recentDealMonths", () => {
  it("anchor 포함 최근 N개월을 내림차순으로 반환한다", () => {
    expect(recentDealMonths("202606", 3)).toEqual(["202606", "202605", "202604"]);
  });

  it("연초 경계를 넘어간다", () => {
    expect(recentDealMonths("202601", 2)).toEqual(["202601", "202512"]);
  });
});
