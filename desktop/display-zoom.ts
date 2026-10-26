export function displayZoom(width: number, user = 1) {
  const multiplier = Number.isFinite(user)
    ? Math.max(0.6, Math.min(1.8, user))
    : 1;
  return Math.max(
    0.6,
    Math.min(2.5, Math.max(1, Math.min(1.6, width / 1920)) * multiplier),
  );
}
export function changeZoom(current: number, direction: number) {
  return (
    Math.round(
      Math.max(0.6, Math.min(1.8, current + (direction > 0 ? 0.1 : -0.1))) * 10,
    ) / 10
  );
}
