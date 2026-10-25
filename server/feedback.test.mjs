import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { remoteAccounts } from "./remote.mjs";
import { Accounts } from "./service.mjs";
import { startService } from "./index.mjs";
import { feedbackInput } from "./feedback-validation.mjs";
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6h0AAAAASUVORK5CYII=";
for (const hosted of [false, true])
  test(
    (hosted ? "Hosted" : "Local") +
      " feedback persists images and enforces creator/admin discussion access over HTTP",
    async () => {
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "ember-feedback-"),
      );
      const accountStore = hosted
        ? await remoteAccounts({
            client: createClient({
              url: pathToFileURL(path.join(directory, "remote.sqlite")).href,
            }),
            adminEmail: "owner@example.com",
          })
        : new Accounts(
            path.join(directory, "local.sqlite"),
            "owner@example.com",
          );
      const service = await startService({ directory, port: 0, accountStore });
      const request = async (route, token, body) => {
        const response = await fetch(service.url + "/api/" + route, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + (token || ""),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        return { status: response.status, body: await response.json() };
      };
      try {
        const password = "Feedback-fixture-password-2026";
        await accountStore.bootstrap(password);
        const admin = (
          await accountStore.login({
            identifier: "owner@example.com",
            password,
          })
        ).token;
        const users = [];
        for (const username of ["creator", "reader"]) {
          await accountStore.register({
            email: username + "@example.com",
            username,
            password,
          });
          const user = (await accountStore.requests(admin)).find(
            (u) => u.username === username,
          );
          await accountStore.decide(admin, user.id, "approved");
          users.push(
            (await accountStore.login({ identifier: username, password }))
              .token,
          );
        }
        const [creator, reader] = users;
        assert.equal((await request("feedback")).status, 401);
        assert.equal(
          (
            await request("feedback", undefined, {
              title: "No auth",
              body: "Blocked",
            })
          ).status,
          401,
        );
        const created = await request("feedback", creator, {
          title: "Download issue",
          body: "Steps to reproduce",
          images: [image],
        });
        assert.equal(created.status, 200);
        const id = created.body.id;
        assert.equal(
          (await request("feedback?query=download&label=Open", reader)).body
            .posts.length,
          1,
        );
        assert.equal(
          (await request("feedback?query=other", reader)).body.posts.length,
          0,
        );
        assert.equal(
          (await request("feedback?label=MadeUp", reader)).status,
          400,
        );
        let thread = (await request("feedback/thread?id=" + id, reader)).body;
        assert.equal(thread.canReply, false);
        assert.equal(thread.messages[0].body, "Steps to reproduce");
        const imageId = thread.messages[0].images[0];
        assert.equal(
          (await request("feedback/image?id=" + imageId, reader)).body.data,
          image,
        );
        assert.equal(
          (await request("feedback/image?id=" + imageId)).status,
          401,
        );
        assert.equal(
          (
            await request("feedback/reply", reader, {
              id,
              body: "Blocked reply",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request("feedback/moderate", creator, {
              id,
              action: "label",
              label: "Done/Fixed",
            })
          ).status,
          403,
        );
        assert.equal(
          (await request("feedback/moderate", reader, { id, action: "delete" }))
            .status,
          403,
        );
        assert.equal(
          (
            await request("feedback/reply", creator, {
              id,
              body: "More information",
              images: [image],
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request("feedback/reply", admin, {
              id,
              body: "We are investigating",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request("feedback/reply", creator, {
              id,
              images: ["data:image/svg+xml;base64,PHN2Zz4="],
            })
          ).status,
          400,
        );
        for (const label of ["In the Works", "Not Happening", "Done/Fixed"])
          assert.equal(
            (
              await request("feedback/moderate", admin, {
                id,
                action: "label",
                label,
              })
            ).status,
            200,
          );
        thread = (await request("feedback/thread?id=" + id, creator)).body;
        assert.equal(thread.canReply, true);
        assert.equal(thread.post.label, "Done/Fixed");
        assert.equal(thread.messages.length, 3);
        const before = thread.messages[1].id;
        assert.equal(
          (
            await request(
              "feedback/thread?id=" + id + "&before=" + before,
              reader,
            )
          ).body.messages.length,
          1,
        );
        assert.equal(
          (await request("feedback?before=" + id, reader)).body.posts.length,
          0,
        );
        assert.equal(
          (await request("feedback/thread?id=-1", reader)).status,
          400,
        );
        assert.equal(
          (await request("feedback/moderate", admin, { id, action: "delete" }))
            .status,
          200,
        );
        assert.equal(
          (await request("feedback/thread?id=" + id, creator)).status,
          404,
        );
        assert.equal(
          (await request("feedback/image?id=" + imageId, reader)).status,
          404,
        );
        assert.equal(
          Number(
            (
              await accountStore.db
                .prepare("SELECT COUNT(*) n FROM feedback_images")
                .get()
            ).n,
          ),
          0,
        );
        assert.equal(
          (
            await request("feedback", creator, {
              title: "Still works",
              body: "A new post after deleting",
            })
          ).status,
          200,
        );
        const readerUser = (await accountStore.requests(admin)).find(
          (u) => u.username === "reader",
        );
        await accountStore.decide(admin, readerUser.id, "revoked");
        assert.equal((await request("feedback", reader)).status, 401);
      } finally {
        await service.close();
        await rm(directory, {
          recursive: true,
          force: true,
          maxRetries: 10,
          retryDelay: 200,
        });
      }
    },
  );
test("feedback rejects oversized, spoofed and excessive image attachments", () => {
  assert.throws(
    () => feedbackInput({ body: "x", images: [image, image, image, image] }),
    /three images/,
  );
  assert.throws(
    () =>
      feedbackInput({
        images: [
          "data:image/png;base64," +
            Buffer.alloc(513 * 1024).toString("base64"),
        ],
      }),
    /512 KB/,
  );
  assert.throws(
    () =>
      feedbackInput({
        images: [
          "data:image/png;base64," +
            Buffer.from("<script>alert(1)</script>").toString("base64"),
        ],
      }),
    /Invalid image/,
  );
  assert.throws(() => feedbackInput({ title: "", body: "x" }, true), /title/);
  assert.throws(() => feedbackInput({}), /Write a message/);
  assert.equal(
    feedbackInput({ title: "Screenshot", images: [image] }, true).images.length,
    1,
  );
});
