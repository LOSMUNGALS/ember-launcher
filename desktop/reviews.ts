export function reviewSummary(raw: any) {
  const q =
    raw?.response?.query_summary ||
    (raw?.success === 1 ? raw.query_summary : undefined);
  if (
    !q ||
    !Number.isSafeInteger(q.total_reviews) ||
    !Number.isSafeInteger(q.total_positive) ||
    q.total_reviews < 0 ||
    q.total_positive < 0 ||
    q.total_positive > q.total_reviews
  )
    return undefined;
  return {
    positive: q.total_positive,
    total: q.total_reviews,
    summary: String(q.review_score_desc || "Not Enough Reviews").slice(0, 100),
  };
}
export const reviewUrl = (id: string) =>
  "https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?" +
  new URLSearchParams({
    input_json: JSON.stringify({
      appid: Number(id),
      num_per_page: 1,
      languages: ["all"],
      purchase_type: 1,
      review_type: 0,
      filter: 1,
      day_range: 0,
      display_language: "english",
    }),
  });
