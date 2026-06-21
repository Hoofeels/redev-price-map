import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOTS = "test-results";
mkdirSync(SHOTS, { recursive: true });

test.describe("US-005/006 지도·필터·상세패널", () => {
  test("지도 렌더 + 필터 + 마커 클릭 → 상세패널", async ({ page }) => {
    await page.goto("/");

    // 헤더
    await expect(
      page.getByRole("heading", { name: /재개발\/재건축 실거래가 지도/ }),
    ).toBeVisible();

    // 지도 컨테이너 + 타일 렌더 (basemap)
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".leaflet-tile").first()).toBeVisible({ timeout: 20000 });

    // 마커(CircleMarker = path.leaflet-interactive) 존재
    const markers = page.locator("path.leaflet-interactive");
    await expect(markers.first()).toBeVisible({ timeout: 20000 });
    const allCount = await markers.count();
    expect(allCount).toBeGreaterThan(50); // 285구역 → 다수 마커
    await page.screenshot({ path: `${SHOTS}/01-map-all.png`, fullPage: true });

    // 결과 개수 표시 (AC5 필터 영역)
    await expect(page.getByText(/결과/).first()).toBeVisible();

    // 필터: 지역 → 경기 (AC5) → 마커 수 감소
    await page.getByLabel("지역").selectOption("경기");
    await page.waitForTimeout(800);
    const gyeonggiCount = await markers.count();
    expect(gyeonggiCount).toBeGreaterThan(0);
    expect(gyeonggiCount).toBeLessThan(allCount);
    await page.screenshot({ path: `${SHOTS}/02-filter-gyeonggi.png`, fullPage: true });

    // 필터: 단계 → 관리처분인가 (AC5)
    await page.getByLabel("지역").selectOption("전체");
    await page.getByLabel("단계").selectOption("관리처분인가");
    await page.waitForTimeout(800);
    const stageCount = await markers.count();
    expect(stageCount).toBeGreaterThan(0);
    expect(stageCount).toBeLessThan(allCount);
    await page.screenshot({ path: `${SHOTS}/03-filter-stage.png`, fullPage: true });

    // 초기화
    await page.getByLabel("단계").selectOption("전체");
    await page.waitForTimeout(500);

    // 마커 클릭 → 상세 패널 (AC6/AC7) — 요약 통계 + 거래 목록 (AC8)
    await markers.first().click({ force: true });
    await expect(page.getByText("거래 건수")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("평균가")).toBeVisible();
    await expect(page.getByText("㎡당 단가")).toBeVisible();
    await expect(page.getByText("최근 추이")).toBeVisible();
    await expect(page.getByText("실거래 목록")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/04-detail-panel.png`, fullPage: true });

    // 패널 닫기
    await page.getByRole("button", { name: "닫기" }).click();
    await expect(page.getByText("지도에서 구역을 클릭하면")).toBeVisible();
  });
});
