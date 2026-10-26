import { _electron } from "playwright";
import { mkdtemp, mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
await mkdir(".test-data", { recursive: true });
const root = await mkdtemp(path.resolve(".test-data/zoom-"));
let app, page;
const launch = async () => {
  app = await _electron.launch({
    args: ["."],
    env: {
      ...process.env,
      EMBER_DATA_DIR: root,
      EMBER_ACCOUNT_URL: "http://127.0.0.1:1",
    },
  });
  page = await app.firstWindow();
  await page.locator(".account-card").waitFor();
};
const zoom = () =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.getZoomFactor(),
  );
try {
  await launch();
  const base = await zoom();
  await page.mouse.move(300, 300);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(250);
  assert.ok((await zoom()) > base);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(250);
  assert.ok(Math.abs((await zoom()) - base) < 0.01);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(250);
  await page.keyboard.up("Control");
  const raised = await zoom();
  await app.close();
  await launch();
  assert.ok(Math.abs((await zoom()) - raised) < 0.01);
  await page.keyboard.down("Control");
  await page.mouse.click(300, 300, { button: "middle" });
  await page.keyboard.up("Control");
  await page.waitForTimeout(250);
  assert.ok(Math.abs((await zoom()) - base) < 0.01);
  await page.screenshot({ path: "artifacts/part4-zoom-reset.png" });
  console.log(
    "Ctrl-wheel increases/decreases zoom, survives restart; Ctrl-middle-click resets on login screen.",
  );
} finally {
  await app?.close();
}
