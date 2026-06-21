import { describe, it, expect } from "vitest";
import { cleanAddressForGeocode, approxDongCentroid, parseKakaoGeocode } from "./geocode";

describe("cleanAddressForGeocode", () => {
  it("서울/경기 시도명 보정", () => {
    expect(cleanAddressForGeocode("서울 노원구 상계동 138")).toBe(
      "서울특별시 노원구 상계동 138",
    );
    expect(cleanAddressForGeocode("경기도 고양시 일산동 960-16번지 일원")).toBe(
      "경기도 고양시 일산동 960-16",
    );
  });
  it("괄호 주석·번지·일원 제거", () => {
    expect(
      cleanAddressForGeocode("경기도 고양시 덕양구 고양동 22-2번지 일원(제일복지회관 주변)"),
    ).toBe("경기도 고양시 덕양구 고양동 22-2");
  });
});

describe("approxDongCentroid (동 중심 근사 폴백)", () => {
  it("등록된 동은 중심 근방 좌표(지터 포함)", () => {
    const c = approxDongCentroid("서울 노원구 공릉동 154-3", "seoul-x-1")!;
    expect(c.lat).toBeCloseTo(37.6256, 1); // 공릉동 근방
    expect(c.lng).toBeCloseTo(127.0718, 1);
  });
  it("같은 동 다른 구역은 의미있게 분리(겹침 방지)", () => {
    const a = approxDongCentroid("서울 노원구 상계동 자력2구역 17블럭 1롯트", "seoul-11350-45")!;
    const b = approxDongCentroid("서울 노원구 상계동 자력6구역 8블럭 9롯트", "seoul-11350-46")!;
    const sep = Math.abs(a.lat - b.lat) + Math.abs(a.lng - b.lng);
    expect(sep).toBeGreaterThan(0.001); // 한 글자 차이 id도 충분히 분리
  });
  it("미등록 동은 null", () => {
    expect(approxDongCentroid("서울 강남구 대치동 316", "seoul-y")).toBeNull();
  });
});

describe("parseKakaoGeocode (보조 지오코더 폴백)", () => {
  it("documents[0]의 x/y를 lng/lat로 파싱", () => {
    const json = {
      documents: [{ x: "127.06557", y: "37.49795", address_name: "서울 노원구 공릉동 154-3" }],
    };
    expect(parseKakaoGeocode(json)).toEqual({ lat: 37.49795, lng: 127.06557 });
  });
  it("빈/비정상 응답은 null", () => {
    expect(parseKakaoGeocode({ documents: [] })).toBeNull();
    expect(parseKakaoGeocode({})).toBeNull();
    expect(parseKakaoGeocode(null)).toBeNull();
    expect(parseKakaoGeocode({ documents: [{ x: "abc", y: "" }] })).toBeNull();
  });
});
