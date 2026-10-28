// Lignes de classement (lot 29, charte « Cartouches » au lot I4), communes à l'accueil, à la page du classement, au coin de la course et au classement
// du Salon : ta ligne sur fond moutarde et marquée « toi » (charte § 9), deux joueurs au même pseudo distingués par un court suffixe. Logique pure
// (`dayLines`) et fabrication des lignes (`lineEl`). Les classes `row`, `rank`, `who`, `you`, `time`, `icon`, `gap` sont celles que visent les tests ;
// `ligne*` sont celles de la feuille (interface.css, accueil.css).
import { medaille } from "@cdj/ui";
import type { Medal } from "@cdj/sim";
import type { BoardRow, Leaderboard } from "./api";
import { el } from "./dom";
import { fEcart, fTemps, messageErreur, t, traducteurDuSocle } from "./i18n";
import { dayShort } from "./dates";
import { disambiguateNames } from "./profile";

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

/** Les médailles du jeu (`author`…) et celles du socle (`auteur`…). */
export const MEDAL_TYPE = { author: "diamant", gold: "or", silver: "argent", bronze: "bronze" } as const;

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

/**
 * Une ligne du tableau : place, pseudo (avec « toi »), temps, médaille (pastille et nom : la couleur seule ne porte pas l'information) ou écart.
 * `compact` : le coin de la course, où le nom de la médaille n'est dit qu'aux lecteurs d'écran.
 */
export function lineEl(l: BoardLine, { compact = false }: { compact?: boolean } = {}): HTMLElement {
  const d = el("div", l.me ? "row ligne ligne--moi me" : "row ligne");
  const who = el("span", "who ligne__nom", l.name);
  if (l.me) who.append(el("span", "you", t("palmares.toi")));
  d.append(el("span", "rank ligne__rang", String(l.rank)), who);
  const icon = el("span", "icon ligne__medaille");
  if (l.medal) {
    const m = medaille(traducteurDuSocle(), { type: MEDAL_TYPE[l.medal], obtenue: true, forme: "pastille", jeu: "track" });
    if (compact) m.classList.add("ligne__medaille--compacte");
    icon.append(m);
  } else if (l.gap) icon.textContent = fEcart(l.gap);
  d.append(icon, el("span", "time ligne__temps", fTemps(l.ms)));
  return d;
}

export const gapEl = (): HTMLElement => el("div", "gap ligne ligne--trou", "…");

export function linesEls(lines: (BoardLine | "gap")[], options: { compact?: boolean } = {}): HTMLElement[] {
  return lines.map((l) => (l === "gap" ? gapEl() : lineEl(l, options)));
}

/** Le titre d'un classement du jour : « Classement du jour · 212 pilotes », ou « Classement figé · mar. 13 oct. » pour un jour figé. */
export function boardTitle(lb: Pick<Leaderboard, "date" | "participants">, live: boolean): string {
  const titre = live ? t("palmares.titreJour") : t("palmares.titreFige", { date: dayShort(lb.date) });
  return lb.participants === 0 ? t("palmares.titreSansPilote", { titre }) : t("palmares.titreEtPilotes", { titre, n: lb.participants });
}

/** Lien « Revoir le meilleur tour » du coin de la course : la même page en mode spectateur. */
export function watchLinkEl(href: string): HTMLAnchorElement {
  const a = el("a", "watchlink lien");
  a.href = href;
  a.textContent = t("palmares.revoir");
  return a;
}

/** Un classement impossible à lire : le texte de l'erreur (code du serveur ou local), jamais le `message` du serveur. */
export function boardErrorEl(code: string): HTMLElement {
  return el("div", "error note--erreur", messageErreur(code));
}
