import { boutonPleinEcran, el, svg } from "@cdj/ui";
import type { Libre } from "./dessin";
import "./hud.css";

// Le HUD en surimpression de « Pinball » (lot PB5b ; maquettes `docs/pinball/maquettes/pinball-hud-*.html`, charte « Cartouches » § 5 et § 9). **Deux bandes** que le meuble laisse libres — en haut : pause, plein écran, le score dans
// l'afficheur encastré (chiffres ambre), le multiplicateur (moutarde dès ×2) ; en bas : la mission (nom, jauge à cases, « 3/5 ») et les billes —, **ou, sur un écran large, tout dans la marge de gauche** (la mission à droite
// sur ordinateur, l'aide du clavier en bas à gauche). La disposition est celle de `hud.css` (rapport largeur / hauteur de l'écran) : rien ici ne la calcule, mais **la zone que la table peut occuper, elle, se mesure** (`libre`) :
// un gabarit invisible dont la feuille dit les bords, marges de sécurité comprises, et que la scène donne au rendu pour qu'il cadre la table entre les bandes.
// **Les plaques ne prennent aucun toucher** (le doigt y joue les batteurs) : seuls les deux boutons en prennent. Du DOM seulement : tout texte vient du catalogue, posé en `textContent`, jamais de HTML injecté.

/** Ce que le HUD montre à chaque image (la scène le lit sur la partie). */
export interface EtatHud {
  /** Le score déjà formaté. */
  score: string;
  mult: number;
  billes: number;
  /** La mission : son nom lu, le compteur, le but et si elle est réussie. */
  mission: string;
  compteur: number;
  but: number;
  faite: boolean;
  /** La première bille est partie : l'aide d'avant le lancer s'en va. */
  lancee: boolean;
  /** Lot PBG1 : le rang du combo en cours (0 : aucun, ou son délai est passé) et la part du délai qui reste avant qu'il se perde, de 1 (un rail vient d'être mené à son bout) à 0. */
  combo: number;
  reste: number;
  /** Lot PBG2 : le niveau de la mission (1, 2…), les billes verrouillées (0 à `total`), le verrou allumé, la multibille en cours et la valeur du prochain jackpot (déjà formatée). */
  niveau: number;
  verrouillees: number;
  verrouAllume: boolean;
  multibille: boolean;
  prochain: string;
}

export interface OptionsHud {
  t: (cle: string, params?: Readonly<Record<string, string | number>>) => string;
  /** Le nombre de billes d'une partie. */
  billes: number;
  /** Lot PBG2 : le nombre de billes à verrouiller pour lancer la multibille. */
  verrous: number;
  /** Les touches de chaque commande (« ← », « Q »…) : l'aide du clavier, sur ordinateur à la première partie ; `null` : pas d'aide du clavier (écran tactile, ou une partie déjà jouée sur cette page). */
  clavier: { gauche: readonly string[]; droite: readonly string[]; lanceur: readonly string[] } | null;
  /** Lot PBG1 : le mouvement réduit (le joueur l'a demandé) : le compteur de combo ne « saute » plus à chaque rang. */
  reduit?: boolean;
  /** Ouvre la pause du kit (le bouton du HUD, ou le plein écran de l'iPhone qui ouvre l'aide « Sur l'écran d'accueil »). */
  pause(): void;
}

export interface Hud {
  /** L'élément à poser dans le plateau, au-dessus de la table. */
  racine: HTMLElement;
  /** La zone où la table doit tenir en entier, en pixels depuis le coin haut gauche de `hote` (entre les bandes, marges de sécurité comprises). */
  libre(hote: HTMLElement): Libre;
  maj(e: EtatHud): void;
  /** Un gain : l'afficheur le montre deux secondes (« +10 000 » à la mission réussie ; lot PBG1 : « +1 600 » à un rail mené à son bout, `ms` plus court) à la place du score. */
  gain(texte: string, ms?: number): void;
  detruire(): void;
}

/** La durée où l'afficheur montre le gain de la mission réussie. */
export const GAIN_MS = 2000;
/** Au-delà, le score s'écrit un peu plus petit pour tenir dans l'afficheur. */
const SCORE_LONG = 9;
/** Lot PBG2 : la jauge de la mission a au plus 6 cases (le but monte à chaque niveau). */
const CASES_MAX = 6;

export function creerHud(o: OptionsHud): Hud {
  const { t } = o;
  const pause = el("button", { classe: "pinball-hud__bouton pinball-hud__pause", attrs: { type: "button", id: "pinball-pause", "aria-label": t("kit.hud.pause") } }, svg("svg", { attrs: { viewBox: "0 0 20 20", width: 20, height: 20, "aria-hidden": "true" } }, svg("path", { attrs: { d: "M7 4v12M13 4v12", stroke: "currentColor", "stroke-width": 3, "stroke-linecap": "square", fill: "none" } })));
  // Le toucher sur ce bouton n'est jamais un batteur (`scene.ts` ignore les boutons) ; il ne garde pas le focus : un Espace de lanceur n'appuierait pas dessus.
  pause.addEventListener("click", () => o.pause());
  pause.addEventListener("pointerup", () => pause.blur());
  const plein = boutonPleinEcran({ t: (cle) => t(cle), id: "pinball-plein-ecran", classe: "pinball-hud__bouton pinball-hud__plein", avantAide: () => o.pause() });

  const chiffres = el("span", { classe: "pinball-hud__chiffres" });
  const afficheur = el("div", { classe: "pinball-hud__afficheur", attrs: { role: "img" } }, chiffres);
  const mult = el("div", { classe: "pinball-hud__mult", attrs: { role: "img" } });

  const mission = el("div", { classe: "pinball-hud__plaque pinball-mission", attrs: { role: "status" } });
  const missionNom = el("span", { classe: "pinball-mission__nom" });
  const jauge = el("span", { classe: "pinball-mission__jauge", attrs: { "aria-hidden": "true" } });
  const missionVal = el("span", { classe: "pinball-mission__val" });
  mission.append(missionNom, jauge, missionVal);

  const billes = el("div", { classe: "pinball-hud__plaque pinball-hud__billes", attrs: { role: "img" } });
  for (let i = 0; i < o.billes; i++) billes.append(el("span", { classe: "pinball-hud__bille" }));

  // Lot PBG1 : le compteur de combo — « COMBO ×3 » et une fine jauge de temps qui se vide jusqu'à ce que le combo se perde. **Toujours posé dans la grille** (caché, sans changer la mise en page : `visibility`) : le gabarit de la table lui laisse sa place.
  const comboTexte = el("span", { classe: "pinball-combo__texte" });
  const comboReste = el("i");
  const combo = el("div", { classe: "pinball-hud__plaque pinball-combo", attrs: { role: "status", "data-actif": "0", "data-haut": "0" } }, comboTexte, el("span", { classe: "pinball-combo__jauge", attrs: { "aria-hidden": "true" } }, comboReste));

  // Lot PBG2 : le verrou — deux petites billes (pleines : verrouillées), « Verrou allumé » quand la mission est réussie, et le niveau de la mission. Au coin haut droit de la zone de la table (le coin vide de l'arc), avec le combo.
  const verrouBilles = el("span", { classe: "pinball-verrou__billes", attrs: { "aria-hidden": "true" } });
  for (let i = 0; i < o.verrous; i++) verrouBilles.append(el("i"));
  const verrouTexte = el("span", { classe: "pinball-verrou__texte" });
  const verrou = el("div", { classe: "pinball-hud__plaque pinball-verrou", attrs: { role: "status", "data-etat": "eteint" } }, verrouBilles, verrouTexte);
  const coins = el("div", { classe: "pinball-hud__coins" }, combo, verrou);

  const aide = el("p", { classe: "pinball-hud__aide", texte: t("hud.aide.lancer") });
  const clavier = o.clavier ? el("div", { classe: "pinball-hud__clavier" }) : null;
  if (clavier && o.clavier) {
    const ligne = (touches: readonly string[], texte: string): HTMLElement => el("p", { classe: "pinball-hud__touche" }, ...touches.map((k) => el("kbd", { texte: k })), el("span", { texte }));
    clavier.append(ligne(o.clavier.gauche, t("commandes.action.gauche")), ligne(o.clavier.droite, t("commandes.action.droite")), ligne(o.clavier.lanceur, t("hud.clavier.lancer")));
  }
  const gabarit = el("div", { classe: "pinball-hud__libre", attrs: { "aria-hidden": "true" } });
  const racine = el("div", { classe: "pinball-hud", attrs: { "data-lancee": "0" } }, gabarit, pause, plein, afficheur, mult, mission, billes, coins, aide, ...(clavier ? [clavier] : []));

  // Les nœuds ne sont écrits que quand ce qu'ils disent change.
  let cle = "";
  let scoreAffiche = "";
  let enGain = false;
  let delaiGain = 0;
  let comboAvant = 0;
  const ecrireScore = (texte: string): void => {
    chiffres.textContent = texte;
    afficheur.dataset.long = texte.length > SCORE_LONG ? "1" : "0";
  };
  return {
    racine,
    libre(hote): Libre {
      const h = hote.getBoundingClientRect();
      const g = gabarit.getBoundingClientRect();
      const gauche = g.left - h.left;
      const droite = h.right - g.right;
      // La table n'a pas à être décalée quand elle a la place de rester au milieu : marges égales (la plus grande) si ce qui reste la contient (elle demande environ 0,56 fois la hauteur libre), sinon chacune la sienne.
      const m = Math.max(gauche, droite);
      const centree = h.width - 2 * m >= 0.56 * g.height;
      const x = centree ? m : gauche;
      return { x, y: g.top - h.top, l: Math.max(0, centree ? h.width - 2 * m : h.width - gauche - droite), h: g.height };
    },
    maj(e): void {
      // la jauge du combo se règle au quarantième : assez fin pour se voir couler, assez rare pour ne pas écrire un nœud à chaque image
      const reste = Math.round(Math.max(0, Math.min(1, e.reste)) * 40);
      const k = `${e.score}|${e.mult}|${e.billes}|${e.mission}|${e.compteur}|${e.but}|${e.faite ? 1 : 0}|${e.lancee ? 1 : 0}|${e.combo}|${e.combo > 0 ? reste : 0}|${e.niveau}|${e.verrouillees}|${e.verrouAllume ? 1 : 0}|${e.multibille ? 1 : 0}|${e.multibille ? e.prochain : ""}`;
      if (k === cle) return;
      cle = k;
      if (e.score !== scoreAffiche) {
        scoreAffiche = e.score;
        if (!enGain) ecrireScore(e.score);
        afficheur.setAttribute("aria-label", t("hud.score.aria", { score: e.score }));
      }
      mult.textContent = `×${e.mult}`;
      mult.dataset.haut = e.mult >= 2 ? "1" : "0";
      mult.setAttribute("aria-label", t("hud.mult.aria", { mult: e.mult }));
      billes.setAttribute("aria-label", t("hud.billes.aria", { n: e.billes, total: o.billes }));
      [...billes.children].forEach((b, i) => ((b as HTMLElement).dataset.perdue = i < e.billes ? "0" : "1"));
      // lot PBG2 : pendant la multibille la bande du bas dit « MULTIBILLE » et le prochain jackpot, à la place de la mission
      mission.dataset.etat = e.multibille ? "multibille" : e.faite ? "reussie" : e.lancee ? "en-cours" : "debut";
      missionNom.textContent = e.multibille ? t("hud.multibille") : e.mission;
      // la jauge a au plus `CASES_MAX` cases (le but monte à chaque niveau : 5, 8, 12, 18…) ; le texte dit le compte exact
      const cases = Math.min(e.but, CASES_MAX);
      const pleines = e.compteur >= e.but ? cases : Math.floor((e.compteur * cases) / e.but);
      while (jauge.childElementCount > cases) jauge.lastElementChild!.remove();
      while (jauge.childElementCount < cases) jauge.append(document.createElement("i"));
      jauge.dataset.dense = cases > 5 ? "1" : "0";
      [...jauge.children].forEach((c, i) => ((c as HTMLElement).dataset.plein = i < pleines ? "1" : "0"));
      missionVal.textContent = e.multibille ? t("hud.jackpot.prochain", { points: e.prochain }) : e.faite ? t("hud.mission.reussie") : `${e.compteur}/${e.but}`;
      mission.setAttribute("aria-label", e.multibille ? t("hud.multibille.aria", { points: e.prochain }) : t("hud.niveau.aria", { n: e.niveau }));
      verrou.dataset.etat = e.verrouAllume ? "allume" : e.verrouillees > 0 ? "plein" : "eteint";
      [...verrouBilles.children].forEach((b, i) => ((b as HTMLElement).dataset.plein = i < e.verrouillees ? "1" : "0"));
      verrouTexte.textContent = e.verrouAllume ? t("hud.verrou.allume") : t("hud.niveau", { n: e.niveau });
      verrou.setAttribute("aria-label", `${t("hud.verrou.aria", { n: e.verrouillees, total: o.verrous })} · ${t("hud.niveau.aria", { n: e.niveau })}`);
      racine.dataset.lancee = e.lancee ? "1" : "0";
      combo.dataset.actif = e.combo > 0 ? "1" : "0";
      if (e.combo > 0) {
        combo.dataset.haut = e.combo >= 2 ? "1" : "0";
        comboTexte.textContent = t("hud.combo", { n: e.combo });
        combo.setAttribute("aria-label", t("hud.combo.aria", { n: e.combo }));
        comboReste.style.setProperty("--p-reste", String(reste / 40));
        // un rang de plus : la plaque « saute » une fois (jamais avec le mouvement réduit)
        if (e.combo > comboAvant && e.combo >= 2 && !o.reduit && typeof combo.animate === "function") combo.animate([{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }], { duration: 240, easing: "ease-out" });
      }
      comboAvant = e.combo;
    },
    gain(texte, ms = GAIN_MS): void {
      enGain = true;
      ecrireScore(texte);
      afficheur.dataset.gain = "1";
      clearTimeout(delaiGain);
      delaiGain = window.setTimeout(() => {
        enGain = false;
        afficheur.dataset.gain = "0";
        ecrireScore(scoreAffiche);
      }, ms);
    },
    detruire(): void {
      clearTimeout(delaiGain);
      racine.remove();
    },
  };
}
