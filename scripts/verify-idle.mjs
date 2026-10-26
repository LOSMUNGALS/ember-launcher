import assert from "node:assert/strict";
import { _electron } from "playwright";
import { mkdtemp, mkdir } from "node:fs/promises";
import path from "node:path";
await mkdir(".test-data", { recursive: true });
const root = await mkdtemp(path.resolve(".test-data/audit-loop-"));
const app = await _electron.launch({
  args: ["."],
  env: {
    ...process.env,
    EMBER_DATA_DIR: root,
    EMBER_ACCOUNT_URL: "http://127.0.0.1:1",
  },
});
try {
  const page = await app.firstWindow();
  await page.locator(".account-card").waitFor();
  await page.evaluate(() => {
    window.auditEvents = 0;
    window.ember2.subscribe(() => window.auditEvents++);
  });
  await page.waitForTimeout(1000);
  const count = await page.evaluate(() => window.auditEvents);
  assert.ok(count < 10, "Idle notification loop: " + count);
  console.log("PASS: idle window has " + count + " change events per second.");
} finally {
  await app.close();
}
