// Le panneau « Aujourd'hui » de l'accueil de « Gravity » (lot GR4, charte rév. 18 § 9) : l'ordre des cinq thèmes du jour, en tuiles à la couleur du thème avec leur mécanique, puis les seuils des médailles.
// **Les thèmes s'affichent tout de suite** (ils sont dans le contenu du jour). **Les seuils s'affichent quand ils sont prêts** : `pretSeuils()` (jamais `seuilsFiges`, qui forcerait le calcul du robot d'un trait) ; un jour sans fichier
// figé les calcule en arrière-plan (`niveau.ts`), le panneau les attend en lisant `pretSeuils()` toutes les demi-secondes, avec une mention discrète. Un jour figé les a d'emblée.
// Lot GR5 : il a son propre morceau (`panneau-`, chargé par `definition.ts` quand le kit l'appelle, le contenu du jour lu) — la scène, elle, n'est plus demandée qu'à JOUER (`chargerPartie`) : rien de plus au premier chargement. Textes : catalogues du jeu ; couleurs : jetons de la charte et couleurs
// des thèmes de `@cdj/visuels/plateformes` ; jamais de HTML injecté (tout se pose en `textContent`).
import { MORCEAUX_PAR_THEME, LARGEUR_MORCEAU, grouper, reglesDuContenu, type Contenu, type Seuils } from "@cdj/gravity-sim";
import type { ContexteAujourdhui } from "@cdj/kit/jeu/types";
import { THEMES } from "@cdj/visuels/plateformes";
import { enCss } from "./couleurs";
import "./panneau.css";

/** Les quatre médailles, de la plus basse à la plus haute : le seuil, le nom (catalogue commun) et le jeton de couleur. */
export const MEDAILLES_DU_PANNEAU = [
  { seuil: "bronze", nom: "medaille.bronze", classe: "bronze" },
  { seuil: "silver", nom: "medaille.argent", classe: "argent" },
  { seuil: "gold", nom: "medaille.or", classe: "or" },
  { seuil: "author", nom: "medaille.diamant", classe: "diamant" },
] as const;
/** La longueur d'un thème en mètres, arrondie à la centaine (19 morceaux de 16 colonnes : 304 m) — le chiffre que dit le panneau. */
export const METRES_PAR_THEME = Math.round((MORCEAUX_PAR_THEME * LARGEUR_MORCEAU) / 100) * 100;
/** La longueur d'un thème que dit le panneau pour ce contenu (celle de son générateur, ou celle d'un essai : `?longueur=`). */
const metresParTheme = (c: Contenu): number => Math.round((reglesDuContenu(c).morceauxParTheme * LARGEUR_MORCEAU) / 100) * 100;
/** Le rythme de lecture des seuils en attente, et le nombre de lectures après lequel le panneau abandonne (une minute). */
const LECTURE_MS = 500;
const LECTURES_MAX = 120;

/** Un contenu dont les seuils se calculent en arrière-plan : `pretSeuils` les rend s'ils sont prêts, **sans jamais forcer le calcul**. */
type ContenuAvecSeuils = Contenu & { pretSeuils?: () => Seuils | null };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, ...enfants: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = classe;
  e.append(...enfants);
  return e;
};

export function remplirAujourdhui(contenu: Contenu, hote: HTMLElement, ctx: ContexteAujourdhui): void {
  const { t } = ctx;
  const tuiles = el(
    "ol",
    "g-themes",
    ...contenu.ordre.map((id, i) => {
      const th = THEMES[id].tiles;
      const tuile = el("li", "g-themes__tuile", el("b", "g-themes__nom", `${i + 1}. ${t(`theme.${id}`)}`), el("span", "g-themes__meca", t(`theme.${id}.meca`)));
      tuile.style.setProperty("--g-fond", enCss(th.rimBottom)); // la couleur sombre du thème : le texte papier y tient (test)
      tuile.style.setProperty("--g-bord", enCss(th.rimTop)); // son bord clair, comme les tuiles du jeu
      return tuile;
    }),
  );
  const seuils = el("div", "g-seuils");
  seuils.setAttribute("role", "status");
  hote.replaceChildren(el("p", "g-aujourdhui__legende", t("aujourdhui.ordre")), tuiles, el("p", "g-aujourdhui__boucle", t("aujourdhui.boucle", { m: metresParTheme(contenu) })), seuils);

  const attente = el("p", "g-aujourdhui__attente", t("aujourdhui.seuils.calcul"));
  const montrer = (s: Seuils): void => {
    seuils.replaceChildren(
      el("p", "g-aujourdhui__legende", t("aujourdhui.seuils")),
      el(
        "ul",
        "g-seuils__liste",
        ...MEDAILLES_DU_PANNEAU.map((m) => el("li", `g-seuils__case g-seuils__case--${m.classe}`, el("span", "g-seuils__nom", t(m.nom)), el("b", "g-seuils__valeur", grouper(s[m.seuil], ctx.langue)))),
      ),
    );
  };
  const lire = (): Seuils | null => (contenu as ContenuAvecSeuils).pretSeuils?.() ?? null;
  const deja = lire();
  if (deja) return montrer(deja);
  seuils.replaceChildren(attente);
  let n = 0;
  const minuteur = setInterval(() => {
    const s = lire();
    if (s) {
      clearInterval(minuteur);
      montrer(s);
    } else if (++n >= LECTURES_MAX || !hote.isConnected) {
      clearInterval(minuteur); // le panneau n'est plus là, ou le calcul ne finira pas : rien de plus à attendre
      if (hote.isConnected) seuils.replaceChildren();
    }
  }, LECTURE_MS);
}
