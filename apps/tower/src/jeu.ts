import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/polices/rubik-mono-one-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "./jeu.css";
import { parisDay } from "@cdj/clock";
import { type Contenu, empreinteVue, estimationGeometrique, medailleObtenue, medaillesDe, Partie, type Rapier, type Scenario, TICKS_PAR_SECONDE, type VuePartie } from "@cdj/tower-sim";
import { el, formatDateCourte, nomMedaille } from "@cdj/ui";
import { Entrees } from "./entrees";
import { texteDebug } from "./debug";
import { MemoireFantome } from "./fantomeLocal";
import { monterFin } from "./fin";
import { formatHauteur, Hud } from "./hud";
import { appliquerDocument, chargerLangue, langueCourante, t, traducteurDuSocle } from "./i18n";
import { chargerJour, type JourDuJeu } from "./jour";
import { type EtatMedailles, MemoireMedaille, SANS_MEDAILLES, TYPE_MEDAILLE } from "./medailles";
import { chargerPalette, poserPalette } from "./palette";
import { monterPause } from "./pause";
import { Scene3D } from "./scene";
import { monterTune, reglagesDeDepart } from "./tune";
import { choisirJour, lireOptions, PRODUCTION } from "./urlOptions";
// Lot M1 : les menus à la manette, chargés à la première manette (`manette.ts` démarre le moteur en se chargeant : Tower ne lit pas la manette en partie, donc pas de filtre,
// et le moindre octet compte dans son budget).
addEventListener("gamepadconnected", () => import("./manette")); // (un module ne s'exécute qu'une fois : les manettes suivantes ne rechargent rien)

// Le jeu de Tower (lots T1 et T2) : une partie complète sur le contenu d'un jour (`dailyTower`, ou le jour figé : `/tower/`, `?seed=AAAA-MM-JJ`), la suite fixe d'essai (`?scenario=essai`) ou la tour
// des paliers (`?scenario=paliers&effet=…`). Lot T2 : chaque partie s'enregistre (une rediffusion), l'écran de fin garde celle de la meilleure partie de la session et le fantôme local en dérive.
// Ce fichier assemble la simulation (`@cdj/tower-sim`, pas fixe de 60 Hz, commandes en
// masque de bits par tick), la scène (Three.js orthographique), le HUD, la pause, l'écran de fin, les commandes (clavier et boutons) et le fantôme local. La boucle fait autant de
// ticks que le temps écoulé en demande (au plus `TICKS_MAX` par image) et dessine entre le dernier tick et le suivant (`alpha`) : une image à 120 Hz ne saccade pas.
// Pas de serveur (lot T4).
//
// Lot T3 — les médailles et les thèmes. Le thème du jour (ou `?theme=`) pose la palette de la scène avant qu'elle soit construite. Les médailles viennent du fichier du jour préparé (le bot de
// l'auteur), de l'estimation géométrique (production sans fichier : provisoires) ou du calcul du bot dans un Web Worker (hors production sans fichier : « Médailles en calcul… », `botDemande.ts`,
// jamais chargé en production). `?bot` : regarder le bot jouer — la file de ses commandes vient de la preuve du fichier, ou du worker pièce par pièce ; sans commande en attente la partie attend.

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
  /** Le nombre de pièces du fantôme posé derrière la tour (la silhouette se calcule après la fin de la partie : tranche par tranche). */
  fantome(): number;
  /** Le contenu joué. */
  contenu(): Scenario;
  /** La rediffusion (texte `base64url`) de la meilleure partie de la session, ou null. */
  rediffusion(): string | null;
  /** Les médailles du jour (lot T3) et ce que le bot a rendu (Diamant en mm, ou null tant qu'il calcule). */
  medailles(): EtatMedailles;
  diamantBot(): number | null;
  /** Le nombre de commandes que le bot a rendues (`?bot`). */
  commandesBot(): number;
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
  let jourLu: JourDuJeu | null = null;
  if (options.scenario === "essai") {
    contenu = (await import("@cdj/tower-sim/scenarios/outils")).SCENARIO_ESSAI; // les scénarios d'essai sont des outils (fermés en production) : à la demande, hors du premier chargement (lot T3b)
    enTete = () => t("fin.eyebrow");
  } else if (options.scenario === "paliers") {
    contenu = (await import("@cdj/tower-sim/scenarios/outils")).scenarioPaliers(options.effet);
    enTete = () => t("fin.eyebrow.paliers");
  } else {
    const choix = choisirJour(options.seed, parisDay(Date.now()), PRODUCTION);
    refuse = choix.refuse;
    jourLu = await chargerJour(choix.jour, options.tirage);
    contenu = jourLu.contenu;
    enTete = () => t("fin.eyebrow.jour", { date: formatDateCourte(choix.jour, langueCourante()) });
  }
  // Le thème : `?theme=` (hors production), sinon celui du jour ; la suite d'essai et les paliers gardent le port. La palette est posée avant la scène et le HUD.
  poserPalette(await chargerPalette(options.theme ?? (contenu as Partial<Contenu>).theme ?? "port"));
  // Les médailles (lot T3) : le fichier du jour préparé, sinon l'estimation (production, provisoire) ou le calcul du bot (hors production). Aucune pour la suite d'essai et les paliers.
  let medailles: EtatMedailles = SANS_MEDAILLES;
  if (jourLu?.medailles) medailles = { medailles: jourLu.medailles, provisoire: false, enCalcul: false };
  else if (jourLu && PRODUCTION) medailles = { medailles: estimationGeometrique(jourLu.contenu), provisoire: true, enCalcul: false };
  else if (jourLu) medailles = { medailles: null, provisoire: false, enCalcul: true };
  const memoireMedaille = new MemoireMedaille();
  /** `?bot` : les commandes du bot, un masque par tick ; `diamantBot` : sa hauteur, connue quand il a fini. */
  const fileBot: number[] = [];
  let indexBot = 0;
  let diamantBot: number | null = null;
  let botComplet = false;
  let botAttend = false;

  const scene = new Scene3D(racine, contenu.plateformeDemi8);
  const memoire = new MemoireFantome();
  let fantomeVoulu = true;
  let partie: Partie;
  let pause = false;
  let manuel = false;
  let acc = 0;
  let dernier = performance.now();

  // Hors production seulement : le bot de l'auteur. Sa preuve est dans le fichier du jour, ou son Web Worker la calcule (une minute) en rendant les pièces à mesure ; les deux modules sont
  // chargés à la demande, et la constante de construction `import.meta.env.VITE_PRODUCTION` (écrite en clair ici pour que la construction retire tout ce bloc, et avec lui le worker, du jeu publié) le ferme en production.
  if (import.meta.env.VITE_PRODUCTION !== "1" && jourLu) {
    const lu = jourLu;
    const sansMedailles = lu.medailles === null;
    /** `&bot` : les commandes d'une preuve (celle du fichier, ou la partie retenue que rend le worker) rejoignent la file du bot. */
    const jouer = (preuve: string): void => void import("./botDemande").then((m) => fileBot.push(...m.masquesDePreuve(preuve)));
    if (options.bot && lu.preuve !== null) {
      botComplet = true;
      diamantBot = lu.medailles?.auteur ?? null;
      jouer(lu.preuve);
    }
    if (sansMedailles || (options.bot && lu.preuve === null)) {
      void import("./botDemande").then((m) =>
        m.demanderBot(contenu, (msg) => {
          // Lot T3b : le worker rend la partie RETENUE d'un coup (la variante qui donne le Diamant), pas le réglage ordinaire pièce par pièce : `&bot` la joue ensuite.
          botComplet = true;
          if (msg.genre === "fin") {
            diamantBot = msg.hauteurMm;
            if (options.bot) jouer(msg.preuve);
            if (sansMedailles) medailles = { medailles: medaillesDe(msg.hauteurMm), provisoire: false, enCalcul: false };
          } else if (sansMedailles) {
            medailles = SANS_MEDAILLES;
            hud.annoncerTexte(t("chargement.echec"));
          }
          fin.majMedailles(medailles);
        }),
      );
    }
  }

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
  const menu = monterPause(racine, { onReprendre: () => reprendre(), onRecommencer: () => nouvellePartie() });
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
    entrees.toutRelacher();
    acc = 0;
    indexBot = 0;
    const v = partie.vue();
    scene.sync(v);
    synchroPaliers(v);
    hud.maj(v, nomFantome());
    hud.majObjectif(medailles, v.hauteurMm);
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
    // La partie s'est enregistrée : si c'est la meilleure de la session, on garde SA REDIFFUSION, et la silhouette du fantôme est l'état final de cette partie rejouée. Tout cela est chargé
    // à la demande (`fantomeRejeu`) : les commandes sont copiées tout de suite, la partie est détruite dès qu'on rejoue.
    if (!options.bot && medailles.medailles) memoireMedaille.proposer(medailleObtenue(r.hauteurMm, medailles.medailles));
    const commandes = [...partie.commandesJouees()];
    const enreg = { commandesJouees: () => commandes, scenario: partie.scenario, reglages: { ...partie.reglages } };
    if (!options.bot) void import("./fantomeRejeu").then(async (m) => {
      const rediffusion = m.enregistrer(enreg);
      const f = m.fantomeDe(rediffusion, r);
      if (!memoire.proposer(f)) return;
      f.pieces = await m.silhouetteDe(R, contenu, rediffusion);
      if (memoire.get() === f) poserFantome();
    }).catch(() => undefined);
    hud.cache = true;
    const meilleure = memoireMedaille.get();
    const lignes: string[] = [];
    if (meilleure) lignes.push(t("fin.medailles.session", { medaille: nomMedaille(traducteurDuSocle(), TYPE_MEDAILLE[meilleure]) }));
    if (options.bot && diamantBot !== null) lignes.push(t("bot.diamant", { hauteur: formatHauteur(diamantBot) }));
    fin.montrer(v, r, reglages.sim.vies, medailles, lignes.length > 0 ? lignes.join(" · ") : null);
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

  /** La commande du prochain tick : les touches du joueur, ou (`?bot`) la suivante du bot — −1 s'il n'a pas encore décidé. Hors de la phase de jeu (la stabilisation) aucune commande n'est lue. */
  function commandeSuivante(): number {
    if (!options.bot) return entrees.lire();
    if (partie.etape !== "jeu") return 0;
    return indexBot < fileBot.length ? fileBot[indexBot++]! : -1;
  }

  let compteImages = 0;
  function image(maintenant: number): void {
    const dt = Math.min(0.1, (maintenant - dernier) / 1000);
    dernier = maintenant;
    if (!pause && !manuel && partie.etape !== "fini") {
      acc += dt * TICKS_PAR_SECONDE;
      let n = 0;
      while (acc >= 1 && n < TICKS_MAX) {
        const c = commandeSuivante();
        if (c < 0) {
          acc = 0; // le bot n'a pas encore décidé : la partie attend
          break;
        }
        tick(c);
        acc -= 1;
        n++;
      }
      if (options.bot) {
        const attend = indexBot >= fileBot.length && partie.etape === "jeu" && !botComplet;
        if (attend !== botAttend) {
          botAttend = attend;
          hud.fixerLigne(attend ? t("bot.reflechit") : null);
        }
      }
      if (n === TICKS_MAX) acc = 0;
    }
    const vue = partie.vue();
    hud.maj(vue, nomFantome());
    hud.majObjectif(medailles, vue.hauteurMm);
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
      avancer: (n, commandes) => {
        for (let i = 0; i < n && partie.etape !== "fini"; i++) tick(commandes ?? (options.bot ? Math.max(0, commandeSuivante()) : 0));
        hud.maj(partie.vue(), nomFantome());
        scene.dessiner(1, 0);
      },
      empreinte: () => empreinteVue(partie.vue()),
      fantome: () => (fantomeVoulu ? (memoire.get()?.pieces?.length ?? 0) : 0),
      contenu: () => contenu,
      rediffusion: () => memoire.get()?.code ?? null,
      medailles: () => medailles,
      diamantBot: () => diamantBot,
      commandesBot: () => fileBot.length,
    };
    (window as unknown as { __tower: PorteDeTest }).__tower = porte;
  }
  document.documentElement.dataset.ready = "true";
  requestAnimationFrame(image);
}

void demarrer();
