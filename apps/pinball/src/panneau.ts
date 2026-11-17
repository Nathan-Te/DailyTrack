// Le panneau « Aujourd'hui » de l'accueil de « Pinball » (lot PB5b ; maquette `docs/pinball/maquettes/pinball-accueil.html`, charte § 9) : l'aperçu de la table du jour, la mission du thème (sa jauge, ce qu'elle rapporte), les modules
// présents sur la table et les quatre médailles du jour avec leurs seuils. **À la demande, jamais au premier chargement** : le kit appelle le panneau quand le contenu du jour est lu, et `definition.ts` n'importe ce fichier
// qu'alors (ligne `panneau-` de `budget.aLaDemande` de la fiche). **L'aperçu est le rendu à plat** (`dessin.ts`, jamais three.js ni le rendu haute qualité), dessiné **une fois** dans un petit canvas, après l'accueil.
// **Les seuils s'affichent quand ils sont prêts** : `pretSeuils()` (jamais `seuilsFiges`, qui forcerait d'un trait le calcul du robot) ; un jour sans fichier figé les calcule en arrière-plan (`niveau.ts`), le panneau les attend en
// les relisant toutes les demi-secondes, avec une mention discrète. Un jour figé les a d'emblée. Textes : catalogue du jeu ; couleurs : jetons de la charte ; jamais de HTML injecté (tout se pose en `textContent`).
import { MISSION_DU_THEME, MODULES_DE_MISSION, POINTS, Partie, REGLAGES, grouper, planDe, type Contenu, type Seuils } from "@cdj/pinball-sim";
import type { ContexteAujourdhui } from "@cdj/kit/jeu/types";
import { creerRendu } from "./dessin";
import { nomDuModule } from "./noms";
import "./panneau.css";

/** Les quatre médailles, de la plus basse à la plus haute : le seuil, le nom (catalogue commun) et le jeton de couleur. */
export const MEDAILLES_DU_PANNEAU = [
  { seuil: "bronze", nom: "medaille.bronze", classe: "bronze" },
  { seuil: "silver", nom: "medaille.argent", classe: "argent" },
  { seuil: "gold", nom: "medaille.or", classe: "or" },
  { seuil: "author", nom: "medaille.diamant", classe: "diamant" },
] as const;
/** L'aperçu : la largeur en pixels CSS ; la hauteur suit la table (375 × 760). */
export const LARGEUR_APERCU = 96;
const HAUTEUR_APERCU = Math.round((LARGEUR_APERCU * 760) / 375);
/** Le rythme de lecture des seuils en attente, et le nombre de lectures après lequel le panneau abandonne (une minute). */
const LECTURE_MS = 500;
const LECTURES_MAX = 120;

/** Un contenu dont les seuils se calculent en arrière-plan : `pretSeuils` les rend s'ils sont prêts, **sans jamais forcer le calcul** (`niveau.ts`). */
type ContenuAvecSeuils = Contenu & { pretSeuils?: () => Seuils | null };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, classe: string, ...enfants: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = classe;
  e.append(...enfants);
  return e;
};

/** Les noms des modules de la table, sans doublon, ceux de la mission d'abord : `mission` dit lesquels comptent pour elle. **Lot PBG1 : les rails du plan** (les rampes, puis l'orbite : leur nom du thème, « Montagnes russes », « Grand huit »…) sont de la liste, après les modules. */
export function modulesDeLaTable(contenu: Contenu, t: (cle: string) => string): { nom: string; mission: boolean }[] {
  const dediesALaMission = new Set<string>(MODULES_DE_MISSION[MISSION_DU_THEME[contenu.theme]]);
  const vus = new Map<string, boolean>();
  for (const m of contenu.modules) {
    const nom = nomDuModule(t, contenu.theme, m);
    if (nom !== null) vus.set(nom, (vus.get(nom) ?? false) || dediesALaMission.has(m));
  }
  const liste = [...vus].map(([nom, mission]) => ({ nom, mission })).sort((a, b) => Number(b.mission) - Number(a.mission));
  const plan = contenu.plan ? planDe(contenu.plan) : null;
  for (const genre of ["rampe", "orbite"] as const) {
    const present = genre === "rampe" ? (plan?.rampes.length ?? 0) > 0 : plan?.orbite != null;
    const nom = present ? nomDuModule(t, contenu.theme, genre) : null;
    if (nom !== null && !vus.has(nom)) liste.push({ nom, mission: false });
  }
  return liste;
}

export function remplirAujourdhui(contenu: Contenu, hote: HTMLElement, ctx: ContexteAujourdhui): void {
  const { t } = ctx;
  const theme = contenu.theme;
  const mission = MISSION_DU_THEME[theme];
  const but = { manege: REGLAGES.butManege, tourbillon: REGLAGES.butTourbillon, portail: REGLAGES.butPortail, geyser: REGLAGES.butGeyser }[mission];

  // L'aperçu de la table : un canvas à lui, dessiné après l'accueil (le rendu à plat ; les plaques des modules n'y seraient que du bruit à cette taille).
  const apercu = el("canvas", "p-apercu");
  apercu.setAttribute("role", "img");
  apercu.setAttribute("aria-label", t("aujourdhui.apercu", { theme: t(`theme.${theme}`) }));
  const police = getComputedStyle(hote).getPropertyValue("--jeu-police").trim() || "sans-serif";
  const dessiner = (): void => {
    if (!apercu.isConnected) return;
    try {
      const rendu = creerRendu(apercu, new Partie(contenu, REGLAGES), theme, () => null, t(`theme.${theme}`), police);
      rendu.redimensionner(LARGEUR_APERCU, HAUTEUR_APERCU);
      rendu.dessiner({ tick: 0, debug: false, alpha: 0, sauvee: 0, eclat: 0, texteSauvee: "", gains: [], multi: 0, message: null, secousse: 0, plaqueVerrou: "", plaqueJackpot: "" });
    } catch {
      apercu.remove(); // pas de canvas 2D : le panneau se lit sans
    }
  };
  setTimeout(() => requestAnimationFrame(dessiner), 0);

  const jauge = el("span", "p-mission__jauge");
  jauge.setAttribute("aria-hidden", "true");
  for (let i = 0; i < but; i++) jauge.append(document.createElement("i"));
  const carteMission = el(
    "div",
    "p-mission",
    el("p", "p-legende", t("aujourdhui.mission")),
    el("p", "p-mission__texte", t(`mission.texte.${mission}`, { but })),
    jauge,
    el("p", "p-mission__gain", t("aujourdhui.mission.gain", { points: grouper(POINTS.mission, ctx.langue) })),
    // lot PBG2 : la boucle de la partie, en une ligne
    el("p", "p-mission__boucle", t("aujourdhui.boucle")),
    el("p", "p-mission__boucle", t("aujourdhui.debloques")),
  );

  const modules = modulesDeLaTable(contenu, (cle) => t(cle));
  // lot PBG1 : le plan du jour, nommé (l'aperçu à côté le montre avec ses rails)
  const sur = el("div", "p-table", el("p", "p-legende", t("aujourdhui.table")), el("p", "p-plan", t("aujourdhui.plan", { plan: t(`plan.${contenu.plan}`) })), el("ul", "p-modules", ...modules.map((m) => { const li = el("li", "p-module", m.nom); li.dataset.mission = m.mission ? "1" : "0"; return li; })));

  const seuils = el("div", "p-seuils");
  seuils.setAttribute("role", "status");
  hote.replaceChildren(el("div", "p-aujourdhui", apercu, carteMission, sur, seuils));

  const montrer = (s: Seuils): void => {
    seuils.replaceChildren(
      el("p", "p-legende", t("aujourdhui.medailles")),
      el("ul", "p-seuils__liste", ...MEDAILLES_DU_PANNEAU.map((m) => el("li", `p-seuils__case p-seuils__case--${m.classe}`, el("span", "p-seuils__nom", t(m.nom)), el("b", "p-seuils__valeur", grouper(s[m.seuil], ctx.langue))))),
    );
  };
  // `pretSeuils` ne force jamais le calcul ; sans lui (un contenu qui n'a pas passé par `niveau.ts`), les seuils du contenu sont de simples nombres.
  const lire = (): Seuils | null => ((contenu as ContenuAvecSeuils).pretSeuils ? (contenu as ContenuAvecSeuils).pretSeuils!() : (contenu.seuilsFiges ?? null));
  const deja = lire();
  if (deja) return montrer(deja);
  seuils.replaceChildren(el("p", "p-seuils__attente", t("aujourdhui.seuils.calcul")));
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
