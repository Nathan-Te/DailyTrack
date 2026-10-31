import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/polices/rubik-mono-one-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "./jeu.css";
import { parisDay } from "@cdj/clock";
import { empreinteVue, Partie, type Rapier, SCENARIO_ESSAI, type Scenario, scenarioPaliers, TICKS_PAR_SECONDE, type VuePartie } from "@cdj/tower-sim";
import { brancherMusique } from "@cdj/musique/branche";
import { el, formatDateCourte } from "@cdj/ui";
import { Entrees } from "./entrees";
import { texteDebug } from "./debug";
import { MemoireFantome } from "./fantomeLocal";
import { monterFin } from "./fin";
import { Hud } from "./hud";
import { appliquerDocument, chargerLangue, langueCourante, t } from "./i18n";
import { contenuDuJour } from "./jour";
import { monterPause } from "./pause";
import { Scene3D } from "./scene";
import { monterTune, reglagesDeDepart } from "./tune";
import { choisirJour, lireOptions, PRODUCTION } from "./urlOptions";

// Le jeu de Tower (lots T1 et T2) : une partie complète sur le contenu d'un jour (`dailyTower`, ou le jour figé : `/tower/`, `?seed=AAAA-MM-JJ`), la suite fixe d'essai (`?scenario=essai`) ou la tour
// des paliers (`?scenario=paliers&effet=…`). Lot T2 : chaque partie s'enregistre (une rediffusion), l'écran de fin garde celle de la meilleure partie de la session et le fantôme local en dérive.
// Ce fichier assemble la simulation (`@cdj/tower-sim`, pas fixe de 60 Hz, commandes en
// masque de bits par tick), la scène (Three.js orthographique), le HUD, la pause, l'écran de fin, les commandes (clavier et boutons) et le fantôme local. La boucle fait autant de
// ticks que le temps écoulé en demande (au plus `TICKS_MAX` par image) et dessine entre le dernier tick et le suivant (`alpha`) : une image à 120 Hz ne saccade pas.
// Pas de serveur (lot T4).

const TICKS_MAX = 6;
/** Niveau de la musique pendant une partie (1 dans la pause et à l'écran de fin). */
const MUSIQUE_EN_PARTIE = 0.6;
/** Le stockage de l'appareil, où la musique garde ses réglages communs à toute la plateforme (`cdj:musique`) ; refusé : sans mémoire. */
const stockageMusique = (): Storage | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};
const options = lireOptions(location.search, PRODUCTION);

interface PorteDeTest {
  partie(): Partie;
  vue(): VuePartie;
  /** Arrête la boucle temps réel : le test avance lui-même, tick par tick. */
  manuel(oui?: boolean): void;
  /** Avance de `n` ticks avec le masque `commandes` (les boutons ne sont pas lus), puis dessine. */
  avancer(n: number, commandes?: number): void;
  empreinte(): string;
  /** Le nombre de pièces du fantôme posé derrière la tour (la silhouette se calcule après la fin de la partie : tranche par tranche). */
  fantome(): number;
  /** Le contenu joué. */
  contenu(): Scenario;
  /** La rediffusion (texte `base64url`) de la meilleure partie de la session, ou null. */
  rediffusion(): string | null;
}

async function demarrer(): Promise<void> {
  await chargerLangue();
  appliquerDocument();
  const racine = document.getElementById("tower")!;
  const message = el("div", { classe: "tower__message", attrs: { role: "status" }, texte: t("chargement.texte") });
  racine.append(message);

  // WebGL absent : on le dit, sans rien charger de plus.
  const test = document.createElement("canvas");
  if (!(test.getContext("webgl2") ?? test.getContext("webgl"))) {
    message.textContent = t("page.sansWebgl");
    document.documentElement.dataset.ready = "true";
    return;
  }

  // La physique (Rapier et son WebAssembly) est chargée à la demande : un fichier à part, jamais dans le premier chargement de la page.
  let R: Rapier;
  try {
    R = await (await import("@cdj/tower-sim/rapier")).chargerRapier();
  } catch {
    message.textContent = t("chargement.echec");
    document.documentElement.dataset.ready = "true";
    return;
  }
  message.remove();

  const reglages = reglagesDeDepart();
  const tactile = options.tactile === "1" || (options.tactile !== "0" && matchMedia("(pointer: coarse)").matches);
  const entrees = new Entrees(() => reglages.entrees);
  // Le contenu : un jour (aujourd'hui, ou `?seed=` ; sur la production une date future est refusée), la suite d'essai, ou les paliers.
  let contenu: Scenario;
  let refuse = false;
  let enTete: () => string;
  if (options.scenario === "essai") {
    contenu = SCENARIO_ESSAI;
    enTete = () => t("fin.eyebrow");
  } else if (options.scenario === "paliers") {
    contenu = scenarioPaliers(options.effet);
    enTete = () => t("fin.eyebrow.paliers");
  } else {
    const choix = choisirJour(options.seed, parisDay(Date.now()), PRODUCTION);
    refuse = choix.refuse;
    contenu = await contenuDuJour(choix.jour);
    enTete = () => t("fin.eyebrow.jour", { date: formatDateCourte(choix.jour, langueCourante()) });
  }
  const scene = new Scene3D(racine, contenu.plateformeDemi8);
  const memoire = new MemoireFantome();
  let fantomeVoulu = true;
  let partie: Partie;
  let pause = false;
  let manuel = false;
  let acc = 0;
  let dernier = performance.now();

  const nomFantome = (): string => t(fantomeVoulu ? "fantome.meilleure" : "fantome.aucun");
  const poserFantome = (): void => scene.poserFantome(fantomeVoulu ? (memoire.get()?.pieces ?? null) : null);

  /** Ce que la scène et le HUD montrent des paliers : le trait pointillé du prochain, les traînées d'un coup de vent sur la pièce active. */
  let declenchesVus = 0;
  function synchroPaliers(v: VuePartie): void {
    scene.poserPalier(v.palier?.metres ?? null);
    const active = v.active >= 0 ? v.pieces.find((p) => p.id === v.active) : undefined;
    scene.poserVent(active?.effet === "vent" ? (contenu.ventSens === -1 ? -1 : 1) : 0);
    if (v.declenches > declenchesVus && v.dernierEffet) {
      const palier = contenu.paliers?.[v.declenches - 1];
      if (palier) hud.annoncerPalier(palier.metres, v.dernierEffet);
    }
    declenchesVus = v.declenches;
  }

  const hud = new Hud({
    racine,
    entrees,
    tactile,
    vies: reglages.sim.vies,
    onPause: () => ouvrirPause(),
    onFantome: () => {
      fantomeVoulu = !fantomeVoulu;
      poserFantome();
      hud.maj(partie.vue(), nomFantome());
    },
  });
  const fin = monterFin(racine, { onRejouer: () => nouvellePartie(), eyebrow: enTete });
  // Lot « musique » : la musique commune de la plateforme, branchée en une ligne (le lecteur se charge au premier geste : `docs/plateforme/musique.md`). Un peu plus basse pendant une partie (à décider par Nathan) ; ses réglages sont dans la pause.
  const musique = brancherMusique("tower", stockageMusique);
  const menu = monterPause(racine, { onReprendre: () => reprendre(), onRecommencer: () => nouvellePartie(), musique: () => musique.lecteur() });
  musique.baisser(MUSIQUE_EN_PARTIE);
  const debug = options.debug ? el("pre", { classe: "debug", attrs: { id: "debug" } }) : null;
  if (debug) racine.append(debug);
  if (options.tune) monterTune(racine, reglages, () => nouvellePartie());

  function nouvellePartie(): void {
    partie?.dispose();
    partie = new Partie(R, contenu, { ...reglages.sim });
    scene.vider();
    poserFantome();
    hud.cacherAnnonce();
    declenchesVus = 0;
    fin.cacher();
    menu.fermer();
    hud.cache = false;
    pause = false;
    musique.baisser(MUSIQUE_EN_PARTIE);
    entrees.toutRelacher();
    acc = 0;
    const v = partie.vue();
    scene.sync(v);
    synchroPaliers(v);
    hud.maj(v, nomFantome());
    document.documentElement.dataset.phase = v.phase;
    dernier = performance.now();
  }

  function ouvrirPause(): void {
    if (pause || fin.ouverte || partie.etape === "fini") return;
    pause = true;
    entrees.toutRelacher();
    hud.cache = true; // la maquette de la pause n'a pas de HUD : le voile est sur la scène seule
    menu.ouvrir(partie.vue());
    musique.baisser(1);
  }

  function reprendre(): void {
    if (!pause) return;
    pause = false;
    menu.fermer();
    hud.cache = false;
    entrees.toutRelacher();
    dernier = performance.now();
    musique.baisser(MUSIQUE_EN_PARTIE);
  }

  function terminer(): void {
    const r = partie.resultat()!;
    const v = partie.vue();
    // La partie s'est enregistrée : si c'est la meilleure de la session, on garde SA REDIFFUSION, et la silhouette du fantôme est l'état final de cette partie rejouée. Tout cela est chargé
    // à la demande (`fantomeRejeu`) : les commandes sont copiées tout de suite, la partie est détruite dès qu'on rejoue.
    const commandes = [...partie.commandesJouees()];
    const enreg = { commandesJouees: () => commandes, scenario: partie.scenario, reglages: { ...partie.reglages } };
    void import("./fantomeRejeu").then(async (m) => {
      const rediffusion = m.enregistrer(enreg);
      const f = m.fantomeDe(rediffusion, r);
      if (!memoire.proposer(f)) return;
      f.pieces = await m.silhouetteDe(R, contenu, rediffusion);
      if (memoire.get() === f) poserFantome();
    }).catch(() => undefined);
    hud.cache = true;
    musique.baisser(1);
    fin.montrer(v, r, reglages.sim.vies);
  }

  function tick(commandes: number): void {
    partie.avancer(commandes);
    const v = partie.vue();
    scene.sync(v);
    synchroPaliers(v);
    if (document.documentElement.dataset.phase !== v.phase) document.documentElement.dataset.phase = v.phase;
    if (v.phase === "fini" && !fin.ouverte) terminer();
  }

  // Le clavier : ← → ↑ X ↓ Espace ; Échap ou P ouvre et ferme la pause. Un écran ouvert (pause, fin) prend le clavier.
  entrees.brancherClavier(window, () => !pause && !fin.ouverte);
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape" && e.code !== "KeyP") return;
    if (pause) reprendre();
    else ouvrirPause();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) ouvrirPause();
  });
  window.addEventListener("resize", () => scene.redimensionner());

  let compteImages = 0;
  function image(maintenant: number): void {
    const dt = Math.min(0.1, (maintenant - dernier) / 1000);
    dernier = maintenant;
    if (!pause && !manuel && partie.etape !== "fini") {
      acc += dt * TICKS_PAR_SECONDE;
      let n = 0;
      while (acc >= 1 && n < TICKS_MAX) {
        tick(entrees.lire());
        acc -= 1;
        n++;
      }
      if (n === TICKS_MAX) acc = 0;
    }
    const vue = partie.vue();
    hud.maj(vue, nomFantome());
    if (vue.palier) hud.placerPalier(scene.ecranY(vue.palier.metres), 100, window.innerHeight - 120);
    scene.dessiner(pause || manuel || partie.etape === "fini" ? 1 : acc, dt);
    if (debug && ++compteImages % 6 === 0) debug.textContent = texteDebug(vue);
    requestAnimationFrame(image);
  }

  nouvellePartie();
  if (refuse) hud.annoncerTexte(t("jour.pasEncore"));
  if (!PRODUCTION) {
    const porte: PorteDeTest = {
      partie: () => partie,
      vue: () => partie.vue(),
      manuel: (oui = true) => {
        manuel = oui;
      },
      avancer: (n, commandes = 0) => {
        for (let i = 0; i < n && partie.etape !== "fini"; i++) tick(commandes);
        hud.maj(partie.vue(), nomFantome());
        scene.dessiner(1, 0);
      },
      empreinte: () => empreinteVue(partie.vue()),
      fantome: () => (fantomeVoulu ? (memoire.get()?.pieces?.length ?? 0) : 0),
      contenu: () => contenu,
      rediffusion: () => memoire.get()?.code ?? null,
    };
    (window as unknown as { __tower: PorteDeTest }).__tower = porte;
  }
  document.documentElement.dataset.ready = "true";
  requestAnimationFrame(image);
}

void demarrer();
