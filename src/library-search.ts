const normalized = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
function oneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length === b.length) {
      if (a[i] === b[j + 1] && a[i + 1] === b[j]) {
        i += 2;
        j += 2;
      } else {
        i++;
        j++;
      }
    } else if (a.length > b.length) i++;
    else j++;
  }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
}
export function matchesSearch(
  query: string,
  ...titles: (string | undefined)[]
) {
  const q = normalized(query);
  if (!q) return true;
  return titles.some((title) => {
    const value = normalized(title || "");
    if (value.includes(q)) return true;
    const words = value.split(" ");
    return q
      .split(" ")
      .every((term) =>
        words.some(
          (word) =>
            word.startsWith(term) || (term.length >= 4 && oneEdit(term, word)),
        ),
      );
  });
}
