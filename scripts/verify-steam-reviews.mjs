import { jsonHttps } from "../desktop/http.ts";
import { reviewSummary, reviewUrl } from "../desktop/reviews.ts";
import assert from "node:assert/strict";
const summary = reviewSummary(await jsonHttps(reviewUrl("730")));
assert.ok(summary && summary.total > 0);
console.log(
  JSON.stringify({
    source: "Steam IUserReviewsService",
    appId: "730",
    total: summary.total,
    positive: summary.positive,
    summary: summary.summary,
  }),
);
