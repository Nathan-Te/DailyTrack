import type { VuePartie } from "@cdj/tower-sim";
import { bouton, boutonPleinEcran, cheminMentions, el, suivreDialogue } from "@cdj/ui";
import type { ControleMusique } from "@cdj/ui/src/panneauMusique";
import { boutonJouer } from "./composants";
import { formatHauteur } from "./hud";
import { langueCourante, t, traducteurDuSocle } from "./i18n";
import type { ReglagesSons } from "./reglagesSons";
import { monterBlocSons } from "./sonsUi";

// La pause de Tower (lots T1 et T7) — **sur le modèle de `docs/plateforme/maquettes/cartouches/jump-pause.html`** (charte rév. 8 et 9 : un dialogue sans barre des jeux, posé sur le voile à
// rayures, au-dessus de la scène) avec l'étiquette de Tower : fond menthe, « PAUSE » en Rubik Mono One à l'ombre papier, l'état de la partie, **une** réplique, REPRENDRE (fond encre,
// texte menthe, épaisseur vert sapin), puis les actions rares : recommencer, « Comment jouer », Réglages, le plein écran et l'accueil de Tower ; les effets sonores et la musique commune ;
// le message en direct en tête et le lien des mentions légales en pied. Ouverte, la partie ne fait aucun pas de simulation. Écarts au modèle : voir le rapport du lot T7.

export interface Pause {
  readonly ouverte: boolean;
  ouvrir(vue: VuePartie): void;
  fermer(): void;
  traduire(): void;
  /** Le message en direct de la pause (lot T7) : un emplacement vide, sans place tant qu'il n'y a rien. */
  readonly hoteMessage: HTMLElement;
  /** Le réglage des effets a changé ailleurs (Réglages ouverts depuis la pause). */
  relireSons(): void;
}

export interface OptionsPause {
  onReprendre(): void;
  onRecommencer(): void;
  /** Lot T7 : « Accueil de Tower » (la partie en cours est abandonnée, jamais envoyée), « Comment jouer » et Réglages. */
  onAccueil(): void;
  onAide(): void;
  onReglages(): void;
  /** Lot « musique » : le lecteur commun, chargé à la première ouverture de la pause. */
  musique(): Promise<ControleMusique>;
  /** Lot T5 : le réglage des effets sonores (une case « Sons » et un volume : il n'existe pas de réglage de sons commun à la plateforme). */
  sons: { lire(): ReglagesSons; ecrire(r: ReglagesSons): void };
}

export function monterPause(racine: HTMLElement, o: OptionsPause): Pause {
  const voile = el("div", { classe: "voile voile--pause", attrs: { id: "pause-ecran", hidden: true } });
  const dialogue = el("section", { classe: "dialogue", attrs: { role: "dialog", "aria-modal": "true" } });
  const hoteMessage = el("div", { classe: "message-direct message-direct--pause" });
  const titre = el("h2", { classe: "dialogue__titre" });
  const etat = el("span", { classe: "pause__etat" });
  const replique = el("p", { classe: "pause__replique" });
  const reprendre = boutonJouer("", () => o.onReprendre(), "pause-reprendre");
  const secondaire = (id: string, onClick: () => void): HTMLButtonElement => {
    const b = bouton({ texte: "", variante: "secondaire", onClick: () => onClick() }) as HTMLButtonElement;
    b.id = id;
    return b;
  };
  const recommencer = secondaire("pause-recommencer", o.onRecommencer);
  const aide = secondaire("pause-aide", o.onAide);
  const reglages = secondaire("pause-reglages", o.onReglages);
  const accueil = secondaire("pause-accueil", o.onAccueil);
  const plein = boutonPleinEcran({ t: (c) => traducteurDuSocle().t(c as never), id: "pause-plein-ecran", classe: ["dj-bouton", "dj-bouton--secondaire"], texte: true });
  const placeMusique = el("div", { classe: "pause__musique" });
  const sons = monterBlocSons({ lire: () => o.sons.lire(), ecrire: (r) => o.sons.ecrire(r), idCase: "pause-sons", idVolume: "pause-sons-volume" });
  const mentions = el("a", { classe: "pause__lien", attrs: { id: "pause-mentions", href: "" } });
  dialogue.append(hoteMessage, el("div", { classe: "pause__tete" }, titre, etat), replique, reprendre, el("div", { classe: "pause__actions" }, recommencer, aide, reglages, plein, accueil), sons.element, placeMusique, el("div", { classe: "pause__pied" }, mentions));
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
    aide.textContent = t("pause.aide");
    reglages.textContent = t("pause.reglages");
    accueil.textContent = t("jeu.accueil");
    mentions.textContent = t("pause.mentions");
    mentions.setAttribute("href", cheminMentions(langueCourante(), "../"));
    sons.traduire();
    if (derniere) etat.textContent = t("pause.etat", { n: Math.min(derniere.numero, derniere.total), total: derniere.total, hauteur: formatHauteur(derniere.hauteurMm) });
  };
  return {
    get ouverte() {
      return ouverte;
    },
    hoteMessage,
    ouvrir(vue) {
      derniere = vue;
      traduire();
      if (ouverte) return;
      ouverte = true;
      voile.hidden = false;
      sons.relire();
      chargerMusique?.();
      dialogue.scrollTop = 0;
    },
    fermer() {
      if (!ouverte) return;
      ouverte = false;
      voile.hidden = true;
    },
    traduire,
    relireSons: () => sons.relire(),
  };
}
