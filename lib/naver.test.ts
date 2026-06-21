import { describe, it, expect } from "vitest";
import { parsePriceToManwon, parseNaverArticle, parseNaverArticles } from "./naver";

describe("parsePriceToManwon", () => {
  it("억 단위", () => {
    expect(parsePriceToManwon("33억")).toBe(330000);
    expect(parsePriceToManwon("1억")).toBe(10000);
  });
  it("억+만원 복합", () => {
    expect(parsePriceToManwon("12억 5,000")).toBe(125000);
    expect(parsePriceToManwon("1억2,000")).toBe(12000);
  });
  it("만원만", () => {
    expect(parsePriceToManwon("8,500")).toBe(8500);
  });
  it("월세 보증/월 → 보증금만", () => {
    expect(parsePriceToManwon("1,000/50")).toBe(1000);
    expect(parsePriceToManwon("1억/120")).toBe(10000);
  });
  it("비정상은 0", () => {
    expect(parsePriceToManwon("")).toBe(0);
    expect(parsePriceToManwon("협의")).toBe(0);
  });
});

describe("parseNaverArticle / parseNaverArticles", () => {
  const raw = {
    articleName: "개포자이",
    tradeTypeName: "매매",
    dealOrWarrantPrc: "33억",
    areaName: "201A",
    floorInfo: "중/22",
    articleConfirmYmd: "20260618",
  };
  it("원시 객체 → NaverArticle", () => {
    const a = parseNaverArticle(raw)!;
    expect(a).toMatchObject({ tradeType: "매매", priceManwon: 330000, priceText: "33억", floorInfo: "중/22" });
  });
  it("호가 없으면 null", () => {
    expect(parseNaverArticle({ tradeTypeName: "매매" })).toBeNull();
  });
  it("매매·전세만 필터", () => {
    const list = [
      raw,
      { ...raw, tradeTypeName: "월세", dealOrWarrantPrc: "1,000/50" },
      { ...raw, tradeTypeName: "전세", dealOrWarrantPrc: "15억" },
    ];
    const out = parseNaverArticles(list, { saleAndJeonseOnly: true });
    expect(out).toHaveLength(2);
    expect(out.map((a) => a.tradeType)).toEqual(["매매", "전세"]);
  });
});
