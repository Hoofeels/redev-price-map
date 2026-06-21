import { describe, it, expect } from "vitest";
import { getLawdCode } from "./lawd";

describe("getLawdCode", () => {
  it("서울은 시군구명으로 5자리 코드", () => {
    const code = getLawdCode({ sido: "서울", sigungu: "강남구", representativeAddress: "서울 강남구 대치동" });
    expect(code).toMatch(/^11\d{3}$/);
  });

  it("경기 파티션 시는 주소의 자치구로 구-단위 LAWD (한글 \\b 버그 회귀 방지)", () => {
    // 영통구 → 41117 (이전엔 \b 때문에 추출 실패 → 41110 시-단위로 폴백, MOLIT 0건)
    expect(
      getLawdCode({ sido: "경기", sigungu: "수원시", representativeAddress: "경기도 수원시 영통구 원천동 48" }),
    ).toBe("41117");
    // 중원구 → 41133
    expect(
      getLawdCode({ sido: "경기", sigungu: "성남시", representativeAddress: "경기도 성남시 중원구 상대원동 195-5" }),
    ).toBe("41133");
  });

  it("파티션 시: 주소에 구가 없으면 법정동→구 보정", () => {
    // 고양 행신동 → 덕양구 41281 (이전엔 시-단위 41280으로 폴백되어 MOLIT 0건)
    expect(
      getLawdCode({ sido: "경기", sigungu: "고양시", representativeAddress: "경기도 고양시 행신동 173-1번지일원" }),
    ).toBe("41281");
    // 고양 일산동 → 일산동구 41285
    expect(
      getLawdCode({ sido: "경기", sigungu: "고양시", representativeAddress: "경기도 고양시 일산동 960-16번지 일원" }),
    ).toBe("41285");
    // 안산 고잔동 → 단원구 41273
    expect(
      getLawdCode({ sido: "경기", sigungu: "안산시", representativeAddress: "경기도 안산시 고잔동 612" }),
    ).toBe("41273");
  });

  it("비파티션 시는 주소에 구가 없어도 시-단위 코드", () => {
    expect(
      getLawdCode({ sido: "경기", sigungu: "의정부시", representativeAddress: "경기도 의정부시 신곡동 406번지 일원" }),
    ).toBe("41150");
  });

  it("미등록 시군구는 null", () => {
    expect(getLawdCode({ sido: "경기", sigungu: "없는시", representativeAddress: "경기도 없는시 어딘가" })).toBeNull();
  });
});
