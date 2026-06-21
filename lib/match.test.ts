import { describe, it, expect } from "vitest";
import { matchTradesToZone, extractDong } from "./match";
import type { RedevelopmentZone, Transaction } from "./types";

function zone(partial: Partial<RedevelopmentZone>): RedevelopmentZone {
  return {
    id: "z",
    name: "z",
    sido: "서울",
    sigungu: "강남구",
    projectType: "재건축",
    stage: "관리처분인가",
    lat: 0,
    lng: 0,
    representativeAddress: "",
    dataAsOf: "2026-05-31",
    source: "TEST",
    transactions: [],
    ...partial,
  };
}

function tx(complexName: string | null): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    date: "2026-01-01",
    priceManwon: 10000,
    areaM2: 50,
    floor: 1,
    complexName,
    dealType: "기존매물",
    propertyType: "아파트",
  };
}

describe("extractDong", () => {
  it("주소에서 마지막 법정동을 추출한다", () => {
    expect(extractDong("서울 노원구 상계동")).toBe("상계동");
    expect(extractDong("서울 강남구 개포동")).toBe("개포동");
    expect(extractDong("경기 수원시 권선구")).toBe(null);
  });
});

describe("matchTradesToZone", () => {
  it("재건축: 대표 단지명을 포함하는 거래만 매칭한다", () => {
    const z = zone({ representativeComplex: "개포주공6단지" });
    const trades = [tx("개포주공6단지"), tx("개포주공 6단지"), tx("이웃단지"), tx(null)];
    const matched = matchTradesToZone(z, trades);
    // 공백 제거 후 비교 → "개포주공 6단지"도 매칭
    expect(matched).toHaveLength(2);
  });

  it("재개발: 대표 주소 법정동으로 매칭한다(단지명 폴백)", () => {
    const z = zone({
      projectType: "재개발",
      representativeComplex: null,
      representativeAddress: "서울 노원구 상계동",
    });
    const trades = [tx("상계동 빌라"), tx("상계동 다세대"), tx("중계동 빌라")];
    const matched = matchTradesToZone(z, trades);
    expect(matched).toHaveLength(2);
  });

  it("재개발: 거래의 법정동(dong) 필드로 매칭(올바른 차원)", () => {
    const z = zone({
      projectType: "재개발",
      representativeComplex: null,
      representativeAddress: "서울 동작구 흑석동",
    });
    // 단지명엔 동이 없지만 dong 필드가 흑석동 → 매칭
    const t1: Transaction = { ...tx("OO빌라"), dong: "흑석동" };
    const t2: Transaction = { ...tx("XX주택"), dong: "상도동" };
    const matched = matchTradesToZone(z, [t1, t2]);
    expect(matched).toHaveLength(1);
    expect(matched[0].dong).toBe("흑석동");
  });

  it("대표 단지/주소가 없으면 빈 배열", () => {
    const z = zone({ representativeComplex: null, representativeAddress: "" });
    expect(matchTradesToZone(z, [tx("아무단지")])).toEqual([]);
  });
});
