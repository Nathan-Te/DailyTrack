import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/polices/rubik-mono-one-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "./jeu.css";
import { empreinteVue, Partie, SCENARIO_ESSAI, TICKS_PAR_SECONDE, type Rapier, type VuePartie } from "@cdj/tower-sim";
import { el } from "@cdj/ui";
import { Entrees } from "./entrees";
import { texteDebug } from "./debug";
import { fantomeDe, MemoireFantome } from "./fantomeLocal";
import { monterFin } from "./fin";
import { Hud } from "./hud";
import { appliquerDocument, chargerLangue, t } from "./i18n";
import { monterPause } from "./pause";
import { Scene3D } from "./scene";
import { monterTune, reglagesDeDepart } from "./tune";
import { lireOptions, PRODUCTION } from "./urlOptions";

// Le jeu de Tower (lot T1) : une partie complète sur la suite fixe d'essai (`?scenario=essai`). Ce fichier assemble la simulation (`@cdj/tower-sim`, pas fixe de 60 Hz, commandes en
// masque de bits par tick), la scène (Three.js orthographique), le HUD, la pause, l'écran de fin, les commandes (clavier et boutons) et le fantôme local. La boucle fait autant de
// ticks que le temps écoulé en demande (au plus `TICKS_MAX` par image) et dessine entre le dernier tick et le suivant (`alpha`) : une image à 120 Hz ne saccade pas.
// Pas de contenu du jour, de rediffusion ni de serveur (lots T2 à T4).

const TICKS_MAX = 6;
const options = lireOptions(location.search, PRODUCTION);

interface PorteDeTest {
  partie(): Partie;
  vue(): VuePartie;
  /** Arrête la boucle temps réel : le test avance lui-même, tick par tick. */
  manuel(oui?: boolean): void;
  /** Avance de `n` ticks avec le masque `commandes` (les boutons ne sont pas lus), puis dessine. */
  avancer(n: number, commandes?: number): void;
  empreinte(): string;
  /** Le nombre de pièces du fantôme posé derrière la tour. */
  fantome(): number;
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
  const scene = new Scene3D(racine, SCENARIO_ESSAI.plateformeDemi8);
  const memoire = new MemoireFantome();
  let fantomeVoulu = true;
  let partie: Partie;
  let pause = false;
  let manuel = false;
  let acc = 0;
  let dernier = performance.now();

  const nomFantome = (): string => t(fantomeVoulu ? "fantome.meilleure" : "fantome.aucun");
  const poserFantome = (): void => scene.poserFantome(fantomeVoulu ? (memoire.get()?.pieces ?? null) : null);

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
  const fin = monterFin(racine, { onRejouer: () => nouvellePartie() });
  const menu = monterPause(racine, { onReprendre: () => reprendre(), onRecommencer: () => nouvellePartie() });
  const debug = options.debug ? el("pre", { classe: "debug", attrs: { id: "debug" } }) : null;
  if (debug) racine.append(debug);
  if (options.tune) monterTune(racine, reglages, () => nouvellePartie());

  function nouvellePartie(): void {
    partie?.dispose();
    partie = new Partie(R, SCENARIO_ESSAI, { ...reglages.sim });
    scene.vider();
    poserFantome();
    fin.cacher();
    menu.fermer();
    hud.cache = false;
    pause = false;
    entrees.toutRelacher();
    acc = 0;
    const v = partie.vue();
    scene.sync(v);
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
  }

  function reprendre(): void {
    if (!pause) return;
    pause = false;
    menu.fermer();
    hud.cache = false;
    entrees.toutRelacher();
    dernier = performance.now();
  }

  function terminer(): void {
    const r = partie.resultat()!;
    const v = partie.vue();
    memoire.proposer(fantomeDe(v, r));
    hud.cache = true;
    fin.montrer(v, r, reglages.sim.vies);
  }

  function tick(commandes: number): void {
    partie.avancer(commandes);
    const v = partie.vue();
    scene.sync(v);
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
    scene.dessiner(pause || manuel || partie.etape === "fini" ? 1 : acc, dt);
    if (debug && ++compteImages % 6 === 0) debug.textContent = texteDebug(vue);
    requestAnimationFrame(image);
  }

  nouvellePartie();
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
      fantome: () => (fantomeVoulu ? (memoire.get()?.pieces.length ?? 0) : 0),
    };
    (window as unknown as { __tower: PorteDeTest }).__tower = porte;
  }
  document.documentElement.dataset.ready = "true";
  requestAnimationFrame(image);
}

void demarrer();
