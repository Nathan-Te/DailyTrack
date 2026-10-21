import { el, medaille } from "@cdj/ui";
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

function ecran(id: string, aria: string, onToggle: (open: boolean) => void) {
  let open = false;
  const cadre = creerCadre({ id, titreAria: aria, retour: "jeu", scene: true, onRetour: () => self.close() });
  const self = {
    cadre,
    get isOpen() {
      return open;
    },
    show() {
      open = true;
      cadre.racine.hidden = false;
      cadre.corps.scrollTop = 0;
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
      if (e.code !== "Escape" || !open) return;
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
}

export interface BoardUi extends Ecran {
  open(view: BoardView): void;
  update(view: BoardView): void;
}

export function mountBoard(o: { onToggle(open: boolean): void }): BoardUi {
  const e = ecran("leaderboard", "classement.aria", o.onToggle);
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
  e.cadre.corps.append(el("div", { classe: "etiquette__tete" }, lier(el("h1", { classe: "etiquette__titre" }), "classement.titre"), subtitle), tete, list, message);
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
  };
}
