import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 단위 테스트만(lib). Playwright e2e(tests/)는 제외.
    include: ["lib/**/*.test.ts"],
    exclude: ["tests/**", "node_modules/**", ".next/**"],
  },
});
