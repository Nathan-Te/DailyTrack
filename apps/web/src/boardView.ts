// Lignes de classement (lot 29), communes à l'accueil, au classement en course et à celui du Salon : ta ligne marquée « toi », deux joueurs au
// même pseudo distingués par un court suffixe. Logique pure (`dayLines`) et fabrication des lignes (`lineEl`).
import type { Medal } from "@cdj/sim";
import type { BoardRow, Leaderboard } from "./api";
import { el } from "./dom";
import { formatDelta, formatTime } from "./format";
import { disambiguateNames } from "./profile";
import { MEDAL_ICON } from "./share";

export interface BoardLine {
  rank: number;
  name: string;
  ms: number;
  medal: Medal | null;
  /** Ta ligne. */
  me: boolean;
  /** Écart au premier (ms), s'il est connu (Salon). */
  gap?: number;
}

/** Les lignes à montrer : les premiers, puis « … » et ta ligne si tu es plus loin. Les pseudos en double sont suffixés (`Nom·2`). */
export function dayLines(lb: Pick<Leaderboard, "top" | "me">): (BoardLine | "gap")[] {
  const isMe = (r: BoardRow) => lb.me !== null && r.rank === lb.me.rank && r.name === lb.me.name;
  const rows: BoardRow[] = [...lb.top];
  const extra = lb.me && lb.me.rank > lb.top.length ? lb.me : null;
  if (extra) rows.push(extra);
  const names = disambiguateNames(rows.map((r) => r.name));
  const lines: (BoardLine | "gap")[] = [];
  rows.forEach((r, i) => {
    if (extra && r === extra) lines.push("gap");
    lines.push({ rank: r.rank, name: names[i]!, ms: r.ms, medal: r.medal, me: isMe(r) || r === extra });
  });
  return lines;
}

/** Une ligne du tableau : place, pseudo (avec « toi »), temps, médaille ou écart. */
export function lineEl(l: BoardLine): HTMLElement {
  const d = el("div", l.me ? "row me" : "row");
  const who = el("span", "who", l.name);
  if (l.me) who.append(el("span", "you", "toi"));
  d.append(el("span", "rank", String(l.rank)), who, el("span", "time", formatTime(l.ms)), el("span", "icon", l.medal ? MEDAL_ICON[l.medal] : l.gap ? formatDelta(l.gap) : ""));
  return d;
}

export const gapEl = (): HTMLElement => el("div", "gap", "…");

export function linesEls(lines: (BoardLine | "gap")[]): HTMLElement[] {
  return lines.map((l) => (l === "gap" ? gapEl() : lineEl(l)));
}
