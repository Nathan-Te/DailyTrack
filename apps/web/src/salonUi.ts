import { afficheur } from "@cdj/ui";
import { creerCadre, type Cadre } from "./cadre";
import type { BoardLine } from "./boardView";
import { boardErrorEl, linesEls, watchLinkEl } from "./boardView";
import type { BoardPanel } from "./boardPanel";
import { button, el, flashLabel } from "./dom";
import { fRang, fTemps, langueCourante, onLangue, t } from "./i18n";
import { disambiguateNames } from "./profile";
import type { SalonBoard, SalonRow } from "./salonApi";
import { countdownText, podiumRows } from "./salon";

// DOM du Salon (lot 26, passé à la charte au lot I4) : la plaque du compte à rebours de la session, le classement de la session, le podium de fin de
// session (le cadre posé sur la scène, lot I4b, et l'étiquette Track, `cadre.ts`). Aucune logique de jeu ici (voir `salon.ts`) ; les textes viennent du catalogue
// (`catalogue.salon.ts`) et suivent la langue.

/** Lignes à montrer : les premières, puis ton entourage, avec « … » là où des places manquent. */
export function visibleRows(board: Pick<SalonBoard, "rows">): (SalonRow | "gap")[] {
  const out: (SalonRow | "gap")[] = [];
  let last = 0;
  for (const r of [...board.rows].sort((a, b) => a.rank - b.rank)) {
    if (last > 0 && r.rank > last + 1) out.push("gap");
    out.push(r);
    last = r.rank;
  }
  return out;
}

/** En course, le classement tient dans un coin : les cinq premiers, puis ton entourage (une place avant, une après). */
export const BOARD_COMPACT_TOP = 5;
/** Sur petit écran (téléphone), le coin est plus petit encore : trois lignes. */
const compactTop = (): number => (typeof matchMedia === "function" && matchMedia("(max-width: 900px), (max-height: 520px)").matches ? 3 : BOARD_COMPACT_TOP);

export function compactRows(board: Pick<SalonBoard, "rows" | "me">, top = compactTop()): SalonRow[] {
  const near = (r: SalonRow) => board.me !== null && Math.abs(r.rank - board.me.rank) <= 1;
  return [...board.rows].filter((r) => r.rank <= top || near(r)).sort((a, b) => a.rank - b.rank);
}

// --- La plaque du compte à rebours (en haut à droite, à la place de l'objectif de médaille) --------------------------------------------------

/** Ce que la plaque montre : le temps restant de la session, la finale (« Dernière chance »), les joueurs présents. */
export interface CountdownView {
  remainingMs: number;
  finale: boolean;
  players: number;
}

/**
 * Remplit la plaque `#medals` : légende (« Suivant dans » ; « Dernière chance » pendant la finale), temps restant en mono, joueurs présents. Rien n'est
 * redessiné si rien ne change ; la classe `last` marque la finale. Rend la clé de ce qui est affiché (le contrôleur la compare pour ne rien refaire).
 */
export function renderCountdown(box: HTMLElement, v: CountdownView): string {
  const key = `${langueCourante()}|${countdownText(v.remainingMs)}|${v.finale}|${v.players}`;
  if (box.dataset.salon === key) return key;
  box.dataset.salon = key;
  let parts = box.querySelector<HTMLElement>(".salon-compte");
  if (!parts) {
    box.replaceChildren(el("span", "objectif__legende salon-compte"), el("span", "objectif__valeur chiffres salon-temps"), el("span", "salon-joueurs"));
    parts = box.querySelector<HTMLElement>(".salon-compte")!;
  }
  parts.textContent = t(v.finale ? "salon.compte.derniere" : "salon.compte.legende");
  box.querySelector(".salon-temps")!.textContent = countdownText(v.remainingMs);
  box.querySelector(".salon-joueurs")!.textContent = t("salon.compte.joueurs", { n: v.players });
  box.classList.toggle("last", v.finale);
  return key;
}

// --- Le classement de la session (coin de la course) ----------------------------------------------------------------------------------------------

/** Remplit le panneau de classement de la session (`#board`) : ta ligne en moutarde et marquée « toi », les pseudos en double suffixés. */
export function renderSalonBoard(panel: BoardPanel, board: SalonBoard | null, label: string, watchHref?: string): void {
  panel.root.classList.add("salon");
  if (!board) {
    panel.setTitle(t("salon.classement.chargement", { heure: label }));
    panel.body.replaceChildren();
    return;
  }
  panel.setTitle(
    board.participants === 0
      ? t("salon.classement.vide", { heure: label })
      : t("salon.classement.titre", { heure: label, classes: t("salon.classement.classes", { n: board.participants }), presents: t("salon.classement.presents", { n: board.players }) }),
  );
  const rows = compactRows(board);
  const names = disambiguateNames(rows.map((r) => r.name));
  const lines: (BoardLine | "gap")[] = [];
  let last = 0;
  rows.forEach((r, i) => {
    if (last > 0 && r.rank > last + 1) lines.push("gap");
    lines.push({ rank: r.rank, name: names[i]!, ms: r.ms, medal: null, me: !!r.mine, ...(r.rank === 1 ? {} : { gap: r.gap }) });
    last = r.rank;
  });
  // Revoir le meilleur tour de la session en cours (lot 27b).
  const link = board.participants > 0 && watchHref ? [watchLinkEl(watchHref)] : [];
  panel.body.replaceChildren(...linesEls(lines, { compact: true }), ...link);
}

/** Une erreur de lecture du classement, à la place des lignes (le texte vient du code, jamais du `message` du serveur). */
export function renderSalonBoardError(panel: BoardPanel, code: string): void {
  panel.body.append(boardErrorEl(code));
}

// --- Le podium de fin de session ---------------------------------------------------------------------------------------------------------------

export interface PodiumView {
  label: string;
  board: SalonBoard | null;
  /** Ton meilleur temps de la session et ta place (si tu en as une). */
  mine: { ms: number; rank: number; participants: number } | null;
  shareLine: string | null;
  secondsLeft: number;
  /** Copie la ligne à partager ; rend vrai si elle est copiée. */
  onCopy?: () => Promise<boolean>;
}

const PASTILLES = ["or", "argent", "bronze"] as const;
const podiums = new WeakMap<HTMLElement, { cadre: Cadre; view: PodiumView | null }>();

/** Le cadre du podium (créé une fois) : la barre des jeux et l'étiquette Track. Le podium se ferme tout seul : le retour mène au portail. */
function podiumCadre(box: HTMLElement): { cadre: Cadre; view: PodiumView | null } {
  let p = podiums.get(box);
  if (!p) {
    const cadre = creerCadre({ racine: box, titreAria: "podium.aria", retour: "portail", haut: true }); // par-dessus l'arrivée de la session (lot I4b : un seul voile)
    p = { cadre, view: null };
    podiums.set(box, p);
    onLangue(() => {
      const cur = podiums.get(box);
      if (cur?.view && !box.hidden) renderPodium(box, cur.view);
    });
  }
  return p;
}

/** Remplit le podium de fin de session (`#podium`, un cadre) : les trois premiers, ta place, la ligne à partager, le décompte du circuit suivant. */
export function renderPodium(box: HTMLElement, v: PodiumView): void {
  const p = podiumCadre(box);
  p.view = v;
  const corps = p.cadre.corps;
  const tete = el("div", "etiquette__tete");
  tete.append(el("h1", "etiquette__titre", t("salon.titre")), el("p", "etiquette__sous-titre", t("podium.titre", { heure: v.label })));
  const top = v.board ? podiumRows(v.board) : [];
  const list = el("ol", "lignes places");
  top.forEach((r, i) => {
    const d = el("li", r.mine ? "place me ligne ligne--moi" : "place ligne");
    const pastille = el("span", `pastille pastille--${PASTILLES[i]!}`);
    pastille.setAttribute("aria-hidden", "true");
    d.append(el("span", "medal ligne__rang", fRang(i + 1)), pastille, el("span", "who ligne__nom", r.name), el("span", "time ligne__temps", fTemps(r.ms)));
    list.append(d);
  });
  const children: HTMLElement[] = [tete];
  if (top.length === 0) children.push(el("p", "none note", t(v.board ? "podium.aucun" : "podium.indisponible")));
  else children.push(list);
  children.push(el("p", "mine", v.mine ? t("podium.maPlace", { rang: fRang(v.mine.rank), total: v.mine.participants, temps: fTemps(v.mine.ms) }) : t("podium.sansTemps")));
  if (v.shareLine) {
    children.push(el("p", "share chiffres", v.shareLine));
    if (v.onCopy) {
      const copy = v.onCopy;
      children.push(
        button(t("podium.copier"), "", async (b) => {
          flashLabel(b, t((await copy()) ? "podium.copie" : "podium.copieEchec"));
        }),
      );
    }
  }
  const next = el("div", "next");
  next.append(afficheur({ legende: t("podium.suivant"), valeur: countdownText(Math.max(0, Math.ceil(v.secondsLeft)) * 1000) }));
  children.push(next);
  corps.replaceChildren(...children);
}
