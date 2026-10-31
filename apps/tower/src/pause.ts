import type { VuePartie } from "@cdj/tower-sim";
import { bouton, boutonPleinEcran, el, suivreDialogue } from "@cdj/ui";
import type { ControleMusique } from "@cdj/ui/src/panneauMusique";
import { boutonJouer } from "./composants";
import { formatHauteur } from "./hud";
import { t, traducteurDuSocle } from "./i18n";
import type { ReglagesSons } from "./reglagesSons";

// La pause de Tower (lot T1) — **sur le modèle de `docs/plateforme/maquettes/cartouches/jump-pause.html`** (charte rév. 8 et 9 : un dialogue sans barre des jeux, posé sur le voile à
// rayures, au-dessus de la scène) avec l'étiquette de Tower : fond menthe, « PAUSE » en Rubik Mono One à l'ombre papier, l'état de la partie, **une** réplique, REPRENDRE (fond encre,
// texte menthe, épaisseur vert sapin), puis les actions rares : recommencer et le plein écran. Ouverte, la partie ne fait aucun pas de simulation. Écarts au modèle : voir le rapport du lot.

export interface Pause {
  readonly ouverte: boolean;
  ouvrir(vue: VuePartie): void;
  fermer(): void;
  traduire(): void;
}

export interface OptionsPause {
  onReprendre(): void;
  onRecommencer(): void;
  /** Lot « musique » : le lecteur commun, chargé à la première ouverture de la pause. */
  musique(): Promise<ControleMusique>;
  /** Lot T5 : le réglage des effets sonores (une case « Sons » et un volume : il n'existe pas de réglage de sons commun à la plateforme). */
  sons: { lire(): ReglagesSons; ecrire(r: ReglagesSons): void };
}

export function monterPause(racine: HTMLElement, o: OptionsPause): Pause {
  const voile = el("div", { classe: "voile voile--pause", attrs: { id: "pause-ecran", hidden: true } });
  const dialogue = el("section", { classe: "dialogue", attrs: { role: "dialog", "aria-modal": "true" } });
  const titre = el("h2", { classe: "dialogue__titre" });
  const etat = el("span", { classe: "pause__etat" });
  const replique = el("p", { classe: "pause__replique" });
  const reprendre = boutonJouer("", () => o.onReprendre(), "pause-reprendre");
  const recommencer = bouton({ texte: "", variante: "secondaire", onClick: () => o.onRecommencer() }) as HTMLButtonElement;
  recommencer.id = "pause-recommencer";
  const plein = boutonPleinEcran({ t: (c) => traducteurDuSocle().t(c as never), id: "pause-plein-ecran", classe: ["dj-bouton", "dj-bouton--secondaire"], texte: true });
  const placeMusique = el("div", { classe: "pause__musique" });
  // Lot T5 : les effets sonores — une case et un volume (le réglage de la musique, lui, est le bloc commun juste dessous).
  const caseSons = el("input", { attrs: { type: "checkbox", id: "pause-sons" } }) as HTMLInputElement;
  const nomSons = el("span", { classe: "pause__sons-nom" });
  const volumeSons = el("input", { attrs: { type: "range", min: 0, max: 100, step: 5, id: "pause-sons-volume" } }) as HTMLInputElement;
  const blocSons = el("div", { classe: "pause__sons", attrs: { role: "group" } }, el("label", { classe: "pause__sons-case" }, caseSons, nomSons), volumeSons);
  const lireSons = (): void => {
    const r = o.sons.lire();
    caseSons.checked = r.actifs;
    volumeSons.value = String(Math.round(r.volume * 100));
    volumeSons.disabled = !r.actifs;
  };
  const ecrireSons = (): void => {
    o.sons.ecrire({ actifs: caseSons.checked, volume: Number(volumeSons.value) / 100 });
    volumeSons.disabled = !caseSons.checked;
  };
  caseSons.addEventListener("change", ecrireSons);
  volumeSons.addEventListener("input", ecrireSons);
  dialogue.append(el("div", { classe: "pause__tete" }, titre, etat), replique, reprendre, el("div", { classe: "pause__actions" }, recommencer, plein), blocSons, placeMusique);
  voile.append(dialogue);
  racine.append(voile);
  suivreDialogue(voile, { focusInitial: () => reprendre });

  let ouverte = false;
  let derniere: VuePartie | null = null;
  // Lot « musique » : le bloc commun (volume, couper, morceau suivant, en écoute), monté à la première ouverture avec le lecteur.
  let chargerMusique: (() => void) | null = () => {
    chargerMusique = null;
    void import("@cdj/ui/src/panneauMusique").then((m) => m.monterPanneau(o.musique, placeMusique), () => undefined);
  };
  const traduire = () => {
    dialogue.setAttribute("aria-label", t("pause.aria"));
    titre.textContent = t("pause.titre");
    replique.textContent = t("pause.phrase");
    reprendre.textContent = t("pause.reprendre");
    recommencer.textContent = t("pause.recommencer");
    nomSons.textContent = t("pause.sons");
    blocSons.setAttribute("aria-label", t("pause.sons"));
    volumeSons.setAttribute("aria-label", t("pause.sons.volume"));
    if (derniere) etat.textContent = t("pause.etat", { n: Math.min(derniere.numero, derniere.total), total: derniere.total, hauteur: formatHauteur(derniere.hauteurMm) });
  };
  return {
    get ouverte() {
      return ouverte;
    },
    ouvrir(vue) {
      derniere = vue;
      traduire();
      if (ouverte) return;
      ouverte = true;
      voile.hidden = false;
      lireSons();
      chargerMusique?.();
      dialogue.scrollTop = 0;
    },
    fermer() {
      if (!ouverte) return;
      ouverte = false;
      voile.hidden = true;
    },
    traduire,
  };
}
