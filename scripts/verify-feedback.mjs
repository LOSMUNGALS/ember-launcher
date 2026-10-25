import { _electron } from "playwright";
import { mkdtemp, mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { startService } from "../server/index.mjs";
await mkdir("artifacts", { recursive: true });
await mkdir(".test-data", { recursive: true });
const directory = await mkdtemp(path.resolve(".test-data/feedback-"));
const service = await startService({
  directory,
  port: 0,
  adminEmail: "owner@example.com",
});
const password = "Feedback-ui-fixture-only-2026";
await service.accounts.bootstrap(password);
const admin = (
  await service.accounts.login({ identifier: "owner@example.com", password })
).token;
for (const username of ["creator", "reader"]) {
  await service.accounts.register({
    email: username + "@example.com",
    username,
    password,
  });
  const user = service.accounts
    .requests(admin)
    .find((u) => u.username === username);
  service.accounts.decide(admin, user.id, "approved");
}
const app = await _electron.launch({
  args: ["."],
  env: {
    ...process.env,
    EMBER_DATA_DIR: directory,
    EMBER_ACCOUNT_URL: service.url,
  },
});
const page = await app.firstWindow(),
  failures = [];
page.on("pageerror", (e) => failures.push(e.message));
const login = async (identifier) => {
  await page.evaluate(
    async ({ identifier, password }) => {
      await window.ember2.call("accountLogout");
      await window.ember2.call("accountLogin", { identifier, password });
    },
    { identifier, password },
  );
  await page.getByTitle("Feedback", { exact: true }).click();
};
try {
  await page.waitForFunction(() => !!window.ember2);
  await login("creator");
  await page.getByRole("button", { name: "New post" }).click();
  await page.getByLabel("Post title").fill("Download progress suggestion");
  await page
    .getByLabel("Post description")
    .fill("Please show more useful progress information.");
  const buffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6h0AAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer });
  await page.getByAltText("Attached image 1").waitFor();
  await page.getByRole("button", { name: "Create post", exact: true }).click();
  await page.getByLabel("Reply message").waitFor();
  await page
    .getByLabel("Reply message")
    .fill("Extra details from the creator.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await page
    .getByText("Extra details from the creator.", { exact: true })
    .waitFor();
  await login("reader");
  await page
    .getByRole("button")
    .filter({
      has: page.getByText("Download progress suggestion", { exact: true }),
    })
    .click();
  await page
    .getByText("Everyone can read this discussion.", { exact: false })
    .waitFor();
  assert.equal(await page.getByLabel("Reply message").count(), 0);
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll(".feedback-message img")).some(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
  await login("owner@example.com");
  await page.locator(".feedback-card").first().click();
  await page.getByLabel("Set feedback label").selectOption("In the Works");
  await page.getByLabel("Reply message").fill("We are working on this.");
  // Exercise clipboard image paste through the browser's normal paste event.
  await page.getByLabel("Reply message").evaluate((element, base64) => {
    const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
      transfer = new DataTransfer();
    transfer.items.add(
      new File([data], "clipboard.png", { type: "image/png" }),
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, buffer.toString("base64"));
  await page.getByAltText("Attached image 1").waitFor();
  await page.getByRole("button", { name: "Send reply" }).click();
  await page.getByText("We are working on this.", { exact: true }).waitFor();
  await page.screenshot({ path: "artifacts/ember-feedback.png" });
  const id = service.accounts.feedbackList(admin).posts[0].id;
  assert.equal(
    service.accounts.feedbackThread(admin, { id }).messages.length,
    3,
  );
  assert.equal(
    service.accounts.feedbackThread(admin, { id }).post.label,
    "In the Works",
  );
  await page.getByLabel("Set feedback label").selectOption("Done/Fixed");
  await page
    .getByRole("button", { name: "Refresh", exact: false })
    .first()
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete post", exact: true }).click();
  await page.getByText("No posts found.", { exact: false }).waitFor();
  assert.equal(service.accounts.feedbackList(admin).posts.length, 0);
  assert.deepEqual(failures, []);
  console.log(
    "Feedback UI passed: create, upload, paste, replies, read-only reader, labels, delete, shared images.",
  );
} catch (error) {
  await page.screenshot({ path: "artifacts/feedback-failure.png" });
  console.error((await page.locator("body").innerText()).slice(-5000));
  throw error;
} finally {
  await app.close();
  await service.close();
}
