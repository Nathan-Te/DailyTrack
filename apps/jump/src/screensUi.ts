import { bouton, el, medaille } from "@cdj/ui";
import { creerCadre } from "./cadre";
import { MEDAL_TYPE } from "./dailyInfo";
import { ligneClassement } from "./home";
import type { ArchiveRow } from "./homeLogic";
import { lier, onLangue, t, traducteurDuSocle } from "./i18n";
import type { RankRowView } from "./rankView";

// Les deux écrans « Du Jour » de Jump ouverts depuis l'accueil (lot 10 pour les archives ; **lot I5** : maquette `jump-classement.html`), dans le cadre crème
// avec la barre « ‹ JUMP » (qui ferme l'écran) et l'étiquette jaune :
//   - **Archives** (`#archives`) : les jours passés, rejouables, jamais classés — numéro, date et thème, ton résultat (temps et médaille en pastille) ;
//   - **Classement du jour** (`#leaderboard`) : rang, pseudo et **nombre de morts dessous**, médaille en pastille et en toutes lettres, temps ; **ta ligne en
//     encre** (charte § 9 : sur l'étiquette jaune la moutarde ne se distinguerait pas), visible même hors du haut (après « … », à sa vraie place).
// DOM seulement : les lignes viennent de `homeLogic.ts` (`archiveRow`) et `rankView.ts` (`rowsOf`). Ouverts, la partie reste en pause (main.ts).

interface Ecran {
  readonly isOpen: boolean;
  close(): void;
}

function ecran(id: string, aria: string, onToggle: (open: boolean) => void, retenir?: () => boolean) {
  let open = false;
  const cadre = creerCadre({ id, titreAria: aria, retour: "jeu", onRetour: () => self.close() });
  const self = {
    cadre,
    get isOpen() {
      return open;
    },
    show() {
      open = true;
      cadre.racine.hidden = false;
      cadre.defile.scrollTop = 0;
      cadre.racine.querySelector<HTMLElement>(".dj-barre-jeu__retour")?.focus({ preventScroll: true });
      onToggle(true);
    },
    close() {
      if (!open) return;
      open = false;
      cadre.racine.hidden = true;
      onToggle(false);
    },
  };
  // Échap ferme l'écran.
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code !== "Escape" || !open || retenir?.()) return; // lot F2 : la feuille d'un joueur, ouverte par-dessus, prend l'Échap
      self.close();
      e.stopImmediatePropagation();
    },
    { capture: true },
  );
  return self;
}

export interface ArchivesUi extends Ecran {
  /** Ouvre la liste ; `lignes` la calcule (l'historique a pu changer), et la recalcule au changement de langue (dates et thèmes traduits). */
  open(lignes: () => readonly ArchiveRow[]): void;
  /** Les lignes affichées (dernière ouverture). */
  readonly rows: readonly ArchiveRow[];
}

export function mountArchives(o: { href(date: string): string; onToggle(open: boolean): void }): ArchivesUi {
  const e = ecran("archives", "archives.aria", o.onToggle);
  const list = el("ul", { classe: "archives" });
  const vide = lier(el("p", { classe: "reglages__aide" }), "archives.vide");
  e.cadre.corps.append(lier(el("h1", { classe: "etiquette__titre" }), "archives.titre"), lier(el("p", { classe: "etiquette__intro" }), "archives.intro"), list, vide);
  let rows: readonly ArchiveRow[] = [];
  let source: (() => readonly ArchiveRow[]) | null = null;
  const render = () => {
    list.replaceChildren(
      ...rows.map((r) => {
        const resultat = el("span", { classe: ["archive__resultat", !r.result && "archive__resultat--vide"] });
        if (r.medal) resultat.append(medaille(traducteurDuSocle(), { type: MEDAL_TYPE[r.medal], obtenue: true, jeu: "jump" }));
        resultat.append(el("span", { texte: r.result || t("archives.pasJoue") }));
        const a = el("a", { classe: "archive", attrs: { href: o.href(r.date), "data-date": r.date } }, el("span", { classe: "archive__numero", texte: r.title }), el("span", { classe: "archive__date", texte: r.subtitle }), resultat);
        return el("li", {}, a);
      }),
    );
    vide.hidden = rows.length > 0;
  };
  onLangue(() => {
    if (source) rows = source();
    render();
  });
  return {
    get isOpen() {
      return e.isOpen;
    },
    get rows() {
      return rows;
    },
    open(lignes) {
      source = lignes;
      rows = lignes();
      render();
      e.show();
    },
    close: () => e.close(),
  };
}

export interface BoardView {
  /** « Forêt · 140 classés ». */
  subtitle: string;
  rows: RankRowView[];
  /** Ta ligne est ajoutée après « … » (hors du haut). */
  gap: boolean;
  /** Un message à la place des lignes (« Personne n'est encore classé… », classement indisponible). */
  message: string;
  /** Lot 31 : le pseudo du premier, quand sa course peut se voir (« Voir la course du n° 1 ») ; `null` : pas de bouton. */
  course: string | null;
  /** Lot F2 : le nombre de joueurs du classement « Tous » (le sélecteur l'écrit), `null` tant qu'il est inconnu. */
  participants?: number | null;
}

/** Lot F2 : les emplacements que le module des amis (chargé à la demande) remplit ; vides tant qu'il n'est pas là. */
export interface BoardHote {
  /** Sous le titre : le sélecteur « Tous / Amis » et son message discret. */
  amis: HTMLElement;
  liste: HTMLElement;
  message: HTMLElement;
  tete: HTMLElement;
  course: HTMLElement;
  /** Sous la liste : « Inviter un ami » quand on n'a aucun ami. */
  pied: HTMLElement;
  /** Appelé à la fin de chaque dessin du classement (le module des amis rend les lignes tactiles, ou remplace la liste par celle d'« Amis »). */
  apres: ((view: BoardView) => void) | null;
  /** Vrai tant qu'une feuille de joueur est ouverte par-dessus l'écran : Échap ne ferme alors que la feuille. */
  echap: (() => boolean) | null;
}

export interface BoardUi extends Ecran {
  open(view: BoardView): void;
  update(view: BoardView): void;
  readonly hote: BoardHote;
}

export function mountBoard(o: { onToggle(open: boolean): void; onCourse(): void }): BoardUi {
  let hote: BoardHote;
  const e = ecran("leaderboard", "classement.aria", o.onToggle, () => hote.echap?.() ?? false);
  const subtitle = el("p", { classe: "etiquette__sous-titre" });
  const tete = el(
    "div",
    { classe: "ligne ligne--tete", attrs: { "aria-hidden": "true" } },
    lier(el("span", { classe: "ligne__rang" }), "classement.col.rang"),
    lier(el("span", { classe: "ligne__qui" }), "classement.col.pseudo"),
    lier(el("span", { classe: "ligne__medaille" }), "classement.col.medaille"),
    lier(el("span", { classe: "ligne__temps" }), "classement.col.temps"),
  );
  const list = el("ol", { classe: "lignes" });
  const message = el("p", { classe: "reglages__aide" });
  // Lot 31 : « Voir la course du n° 1 » (la lecture de l'essai du premier, sur la scène) sous la liste ; absent sans classé.
  const course = bouton({ texte: t("classement.course"), variante: "secondaire", onClick: () => o.onCourse() }) as HTMLButtonElement;
  course.id = "board-course";
  course.hidden = true;
  hote = { amis: el("div", { classe: "classement-amis" }), liste: list, message, tete, course, pied: el("div", { classe: "classement-amis__pied" }), apres: null, echap: null };
  e.cadre.corps.append(el("div", { classe: "etiquette__tete" }, lier(el("h1", { classe: "etiquette__titre" }), "classement.titre"), subtitle), hote.amis, tete, list, message, course, hote.pied);
  let view: BoardView | null = null;
  const render = (v: BoardView) => {
    view = v;
    subtitle.textContent = v.subtitle;
    const lignes = v.rows.map((r) => ligneClassement(r, true));
    if (v.gap && lignes.length > 1) lignes.splice(lignes.length - 1, 0, el("li", { classe: "ligne ligne--trou", attrs: { "aria-hidden": "true" }, texte: "…" }));
    list.replaceChildren(...lignes);
    message.textContent = v.message;
    message.hidden = v.message === "";
    tete.hidden = v.rows.length === 0;
    course.hidden = v.course === null;
    if (v.course !== null) lier(course, "classement.course");
    if (v.course !== null) course.setAttribute("aria-label", t("classement.course.aria", { nom: v.course }));
    hote.apres?.(v);
  };
  onLangue(() => {
    if (view) render(view);
  });
  return {
    get isOpen() {
      return e.isOpen;
    },
    open(v) {
      render(v);
      e.show();
    },
    update: render,
    close: () => e.close(),
    hote,
  };
}
