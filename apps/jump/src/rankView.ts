import { MEDAL_ICON, shortDate } from "./dailyInfo";
import { rankText, type JumpBoard } from "./rankApi";
import type { KnownRank } from "./rankQueue";
import type { RankState } from "./ranking";
import { formatTicks } from "./session";

// Ce que montrent l'écran d'arrivée et l'accueil du classement du jour (lot P1 de la plateforme), **logique pure** (testée sans DOM) : le rang
// (« 3ᵉ sur 128 »), le top 10 avec ta ligne mise en valeur (ajoutée en dessous si tu n'y es pas), et un état clair quand le serveur ne répond
// pas (« Classement indisponible, ton temps sera envoyé ») ou que la version n'est plus la bonne. Une archive montre son classement figé et ton
// rang si tu l'avais joué. Sans serveur, rien ne s'affiche : l'écran est celui du lot 10.

export interface RankRowView {
  rank: string;
  name: string;
  time: string;
  medal: string;
  mine: boolean;
}

export interface RankView {
  shown: boolean;
  title: string;
  /** La ligne d'état : le rang, ou ce qui se passe (envoi, panne, version). */
  status: string;
  tone: "ok" | "wait" | "warn";
  /** « Recharger » (autre version). */
  reload: boolean;
  /** Le formulaire du pseudo (premier envoi, pseudo refusé), son message et des pseudos libres à toucher. */
  askName: boolean;
  nameMessage: string;
  suggestions: string[];
  rows: RankRowView[];
  /** Ta ligne n'est pas dans le top 10 : elle est ajoutée après une séparation. */
  gap: boolean;
}

const HIDDEN: RankView = { shown: false, title: "", status: "", tone: "ok", reload: false, askName: false, nameMessage: "", suggestions: [], rows: [], gap: false };

export interface ArrivalRankInput {
  enabled: boolean;
  /** `jour` : le niveau du jour (envoyé) ; `archive` : classement figé, rien n'est envoyé ; autre chose : rien à montrer. */
  mode: "jour" | "archive" | "futur" | "essai";
  date: string;
  state: RankState;
  /** Un envoi de ce jour attend dans la file. */
  pending: boolean;
  known: KnownRank | null;
  board: { status: "loading" | "ok" | "offline" | "error"; board: JumpBoard | null; message: string } | null;
}

function rowsOf(board: JumpBoard | null): { rows: RankRowView[]; gap: boolean } {
  if (!board) return { rows: [], gap: false };
  const mine = board.me?.rank ?? null;
  const row = (r: JumpBoard["top"][number]): RankRowView => ({ rank: String(r.rank), name: r.name, time: formatTicks(r.ticks), medal: r.medal ? MEDAL_ICON[r.medal] : "", mine: r.rank === mine });
  const rows = board.top.map(row);
  const gap = board.me !== null && !board.top.some((r) => r.rank === mine);
  if (gap) rows.push(row(board.me!));
  return { rows, gap };
}

export function arrivalRankView(i: ArrivalRankInput): RankView {
  if (!i.enabled || (i.mode !== "jour" && i.mode !== "archive")) return HIDDEN;
  const { rows, gap } = rowsOf(i.board?.board ?? null);
  const boardDown = i.board !== null && (i.board.status === "offline" || i.board.status === "error") && !i.board.board;
  if (i.mode === "archive") {
    const b = i.board?.board ?? null;
    const status = boardDown
      ? "Classement indisponible"
      : !b
        ? "Chargement du classement…"
        : b.me
          ? `Ton rang ce jour-là : ${rankText(b.me.rank, b.participants)}`
          : b.participants > 0
            ? `${b.participants} classé${b.participants > 1 ? "s" : ""} · tu n'as pas été classé ce jour-là`
            : "Personne n'a été classé ce jour-là";
    return { ...HIDDEN, shown: true, title: `Classement figé du ${shortDate(i.date)}`, status, tone: boardDown ? "warn" : b ? "ok" : "wait", rows, gap };
  }
  const base = { ...HIDDEN, shown: true, title: "Classement du jour", rows, gap };
  const s = i.state;
  if (s.status === "version") return { ...base, status: "Une nouvelle version du jeu est disponible", tone: "warn", reload: true };
  if (s.status === "name" && i.pending) return { ...base, status: "Choisis ton pseudo pour entrer au classement", tone: "wait", askName: true, nameMessage: s.message, suggestions: s.suggestions };
  if (s.status === "offline" && i.pending) return { ...base, status: s.message || "Classement indisponible, ton temps sera envoyé.", tone: "warn" };
  if (s.status === "revoked" || (s.status === "refused" && s.message)) return { ...base, status: s.message, tone: "warn" };
  if (i.pending) return { ...base, status: "Envoi au classement…", tone: "wait" };
  const rank = i.board?.board?.me ? { rank: i.board.board.me.rank, participants: i.board.board.participants } : i.known;
  if (rank) return { ...base, status: rankText(rank.rank, rank.participants), tone: "ok" };
  if (boardDown) return { ...base, status: "Classement indisponible", tone: "warn" };
  if (i.board?.status === "loading" && !i.board.board) return { ...base, status: "Chargement du classement…", tone: "wait" };
  return { ...base, status: i.board?.board ? `${i.board.board.participants} classé${i.board.board.participants > 1 ? "s" : ""}` : "", tone: "ok" };
}

/** L'accueil : « Ton rang du jour : 3ᵉ sur 128 » si tu as un temps classé aujourd'hui, sinon rien. */
export function homeRankText(enabled: boolean, known: KnownRank | null): string {
  return enabled && known ? `Ton rang du jour : ${rankText(known.rank, known.participants)}` : "";
}
