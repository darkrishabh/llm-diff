export type DiffLine = { type: "same" | "add" | "remove"; text: string };

const MAX_LINES = 1200;

/** Line-level LCS diff for two strings (split on newlines). */
export function diffLines(a: string, b: string): DiffLine[] {
  const A = a.split("\n");
  const B = b.split("\n");
  if (A.length > MAX_LINES || B.length > MAX_LINES) {
    return [
      {
        type: "same",
        text: `Outputs are too long to diff inline (${A.length} vs ${B.length} lines). Use side-by-side or shorten the text.`,
      },
    ];
  }
  const n = A.length;
  const m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        A[i] === B[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  function walk(i: number, j: number): void {
    if (i === n && j === m) return;
    if (i < n && j < m && A[i] === B[j]) {
      out.push({ type: "same", text: A[i] });
      walk(i + 1, j + 1);
      return;
    }
    if (j < m && (i === n || dp[i + 1][j] < dp[i][j + 1])) {
      out.push({ type: "add", text: B[j] });
      walk(i, j + 1);
      return;
    }
    if (i < n) {
      out.push({ type: "remove", text: A[i] });
      walk(i + 1, j);
      return;
    }
    out.push({ type: "add", text: B[j] });
    walk(i, j + 1);
  }
  walk(0, 0);
  return out;
}
