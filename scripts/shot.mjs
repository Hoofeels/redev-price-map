import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3200/", { waitUntil: "networkidle" });
await page.waitForSelector("path.leaflet-interactive", { timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: "test-results/live-01-overview.png" });

// 마커 하나 클릭해서 상세 패널 노출
await page.locator("path.leaflet-interactive").first().click({ force: true });
await page.waitForTimeout(2500); // 라이브 실거래가 fetch
await page.screenshot({ path: "test-results/live-02-detail.png" });

await browser.close();
console.log("done");
