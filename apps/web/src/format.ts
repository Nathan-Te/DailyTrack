/** 35142 → « 35,142 s » ; 95142 → « 1:35,142 ». */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const frac = String(total % 1000).padStart(3, "0");
  return m > 0 ? `${m}:${String(s).padStart(2, "0")},${frac}` : `${s},${frac} s`;
}

/** Écart signé : « +0,210 » / « −0,210 ». */
export function formatDelta(ms: number): string {
  const sign = ms < 0 ? "−" : "+";
  const abs = Math.abs(Math.round(ms));
  return `${sign}${Math.floor(abs / 1000)},${String(abs % 1000).padStart(3, "0")}`;
}
