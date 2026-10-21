import type { JumpMedal } from "@cdj/jump-sim";
import { shortDate } from "./dailyInfo";
import { fNombre, fTicks, messageErreur, t } from "./i18n";
import { rankText, type JumpBoard } from "./rankApi";
import type { KnownRank } from "./rankQueue";
import type { RankState } from "./ranking";

// Ce que montrent l'écran d'arrivée, l'accueil et l'écran du classement du jour (lot P1 de la plateforme), **logique pure** (testée sans DOM) : le
// rang (« 3e sur 128 »), le top 10 avec ta ligne mise en valeur (ajoutée en dessous si tu n'y es pas), et un état clair quand le serveur ne répond
// pas (« Classement indisponible, ton temps sera envoyé ») ou que la version n'est plus la bonne. Une archive montre son classement figé et ton
// rang si tu l'avais joué. Sans serveur, rien ne s'affiche. Lot I5 : les textes viennent des catalogues (codes d'erreur : `messageErreur`) ; une ligne
// porte la médaille en type (pastille du socle, le nom toujours écrit) et les morts du joueur (le classement de la maquette `jump-classement.html`).

export interface RankRowView {
  rank: string;
  name: string;
  time: string;
  medal: JumpMedal | null;
  /** « 3 morts » (sous le pseudo). */
  deaths: string;
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
  board: { status: "loading" | "ok" | "offline" | "error"; board: JumpBoard | null; code: string } | null;
}

/** Les lignes d'un classement : le haut, puis ta ligne à sa vraie place si tu n'y es pas (après « … »). */
export function rowsOf(board: JumpBoard | null): { rows: RankRowView[]; gap: boolean } {
  if (!board) return { rows: [], gap: false };
  const mine = board.me?.rank ?? null;
  const row = (r: JumpBoard["top"][number]): RankRowView => ({ rank: String(r.rank), name: r.name, time: fTicks(r.ticks), medal: r.medal, deaths: t("commun.morts", { n: r.deaths }), mine: r.rank === mine });
  const rows = board.top.map(row);
  const gap = board.me !== null && !board.top.some((r) => r.rank === mine);
  if (gap) rows.push(row(board.me!));
  return { rows, gap };
}

/** « 140 classés » */
export const classesText = (n: number): string => t("rang.classes", { n, total: fNombre(n) });

export function arrivalRankView(i: ArrivalRankInput): RankView {
  if (!i.enabled || (i.mode !== "jour" && i.mode !== "archive")) return HIDDEN;
  const { rows, gap } = rowsOf(i.board?.board ?? null);
  const boardDown = i.board !== null && (i.board.status === "offline" || i.board.status === "error") && !i.board.board;
  if (i.mode === "archive") {
    const b = i.board?.board ?? null;
    const status = boardDown
      ? t("rang.indisponible")
      : !b
        ? t("rang.chargement")
        : b.me
          ? t("rang.ceJourLa", { rang: rankText(b.me.rank, b.participants) })
          : b.participants > 0
            ? t("rang.pasClasseCeJourLa", { classes: classesText(b.participants) })
            : t("rang.personne");
    return { ...HIDDEN, shown: true, title: t("rang.titreFige", { date: shortDate(i.date) }), status, tone: boardDown ? "warn" : b ? "ok" : "wait", rows, gap };
  }
  const base = { ...HIDDEN, shown: true, title: t("rang.titre"), rows, gap };
  const s = i.state;
  if (s.status === "version") return { ...base, status: t("rang.version"), tone: "warn", reload: true };
  if (s.status === "name" && i.pending) return { ...base, status: t("rang.pseudo"), tone: "wait", askName: true, nameMessage: s.code ? messageErreur(s.code) : "", suggestions: s.suggestions };
  if (s.status === "offline" && i.pending) return { ...base, status: t(s.code === "trop_envois" ? "rang.tropEnvois" : "rang.horsLigne"), tone: "warn" };
  if (s.status === "revoked" || (s.status === "refused" && s.code)) return { ...base, status: messageErreur(s.code), tone: "warn" };
  if (i.pending) return { ...base, status: t("rang.envoi"), tone: "wait" };
  const rank = i.board?.board?.me ? { rank: i.board.board.me.rank, participants: i.board.board.participants } : i.known;
  if (rank) return { ...base, status: rankText(rank.rank, rank.participants), tone: "ok" };
  if (boardDown) return { ...base, status: t("rang.indisponible"), tone: "warn" };
  if (i.board?.status === "loading" && !i.board.board) return { ...base, status: t("rang.chargement"), tone: "wait" };
  return { ...base, status: i.board?.board ? classesText(i.board.board.participants) : "", tone: "ok" };
}

/** L'accueil : « Ton rang du jour : 3e sur 128 » si tu as un temps classé aujourd'hui, sinon rien. */
export function homeRankText(enabled: boolean, known: KnownRank | null): string {
  return enabled && known ? t("rang.duJour", { rang: rankText(known.rank, known.participants) }) : "";
}
