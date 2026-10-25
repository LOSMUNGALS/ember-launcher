import { ApiError } from "./service.mjs";
export const feedbackLabels = [
  "Open",
  "In the Works",
  "Not Happening",
  "Done/Fixed",
];
export function feedbackId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new ApiError(400, "Invalid feedback ID.");
  return id;
}
export function feedbackInput(p, post = false) {
  const body = String(p.body || "").trim(),
    title = String(p.title || "").trim();
  if (body.length > 10000 || (post && (!title || title.length > 160)))
    throw new ApiError(
      400,
      "Use a title up to 160 characters and a message up to 10,000 characters.",
    );
  const images = p.images || [];
  if (!Array.isArray(images) || images.length > 3)
    throw new ApiError(400, "Attach up to three images.");
  for (const image of images) {
    if (typeof image !== "string" || image.length > 710000)
      throw new ApiError(400, "Each image must be at most 512 KB.");
    const match = image.match(
      /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/,
    );
    if (!match) throw new ApiError(400, "Use PNG, JPEG, WebP or GIF images.");
    const bytes = Buffer.from(match[2], "base64"),
      hex = bytes.subarray(0, 12).toString("hex");
    const valid =
      match[1] === "png"
        ? hex.startsWith("89504e470d0a1a0a")
        : match[1] === "jpeg"
          ? hex.startsWith("ffd8ff")
          : match[1] === "gif"
            ? /^474946383[79]61/.test(hex)
            : hex.startsWith("52494646") &&
              bytes.subarray(8, 12).toString() === "WEBP";
    if (
      !valid ||
      bytes.length > 512 * 1024 ||
      bytes.toString("base64") !== match[2]
    )
      throw new ApiError(400, "Invalid image or image larger than 512 KB.");
  }
  if (!body && !images.length)
    throw new ApiError(400, "Write a message or attach an image.");
  return { title, body, images };
}
