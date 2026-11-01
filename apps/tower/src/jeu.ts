import "./jeu.css";
import { installerCataloguesDuJeu } from "./catalogue.jeu.fr";
import { readPlayerId } from "@cdj/profile";
import { empreinteVue, medailleObtenue, medaillesDe, Partie, type Rapier, type Scenario, TICKS_PAR_SECONDE, type VuePartie } from "@cdj/tower-sim";
import { el, formatDateCourte, nomMedaille } from "@cdj/ui";
import { BOUTON_FIXE, TOUCHE_FIXE } from "@cdj/ui/src/commandes";
import { padPourLeJeu } from "@cdj/ui/src/manetteLien";
import type { Entree } from "./aideLigne";
import { adresseAccueil, estArchive } from "./jourPasse";
import { commandes } from "./commandes";
import { monterClassement } from "./classementUi";
import { texteDebug } from "./debug";
import { Entrees, padActif } from "./entrees";
import { evenementsDeFin, type EvenementJeu, Observateur } from "./evenements";
import { cleNomFantome, type EtatFantome, etatInitial, etatValide, suivant } from "./fantomeEtat";
import { type FantomePiece, MemoireFantome } from "./fantomeLocal";
import type { Musique } from "@cdj/musique/branche";
import { monterFin, type VueEnvoi } from "./fin";
import { formatHauteur } from "./formatHauteur";
import { hasardAffichage } from "./hasardAffichage";
import { Hud } from "./hud";
import { appliquerDocument, chargerLangue, langueCourante, t, traducteurDuSocle } from "./i18n";
import { type EtatMedailles, SANS_MEDAILLES, TYPE_MEDAILLE } from "./medailles";
import { hoteMessage, type MessageDirect, monterMessage } from "./messageDirect";
import { chargerPalette, poserPalette } from "./palette";
import { AnalyseurPanique } from "./panique";
import { monterPause } from "./pause";
import { textePartage } from "./partage";
import type { Preparation } from "./preparation";
import { lireRecords, proposerRecord } from "./records";
import { ecrireSons, lireSons, type ReglagesSons } from "./reglagesSons";
import { ecrireReglagesJoueur, facteurDe, lireReglagesJoueur, type ReglagesJoueur } from "./reglagesJoueur";
import { Scene3D } from "./scene";
import { chargerSuite } from "./jeuSuivant";
import { creerSession, type Session, suivreGeneration } from "./session";
import { gameStorage } from "./stockage";
import { classablePourReglages } from "./classable";
import { reglagesDeDepart, reglagesEssai } from "./reglagesEssai";
import { Sons } from "./sons";
import { monterTune } from "./tune";
import { type OptionsUrl, PRODUCTION } from "./urlOptions";

// Le jeu de Tower (lots T1 à T4), **chargé à la demande** derrière l'accueil (`accueil.ts`) : la scène (Three.js), la partie, le HUD, la pause et l'arrivée. Une partie complète sur le contenu d'un jour
// (`dailyTower`, ou le jour figé), la suite fixe d'essai (`?scenario=essai`) ou la tour des paliers (`?scenario=paliers&effet=…`). Chaque partie s'enregistre (une rediffusion) ; le record du jour est gardé
// dans le navigateur (`records.ts`) et, s'il bat le précédent, **envoyé au serveur, qui le rejoue** (`envoi.ts`) ; l'arrivée affiche ce que le serveur a rejoué (rang, médaille, « nouveau record »). Sans
// serveur ou hors ligne le jeu reste jouable et le dit en une ligne.
// La boucle fait autant de ticks que le temps écoulé en demande (au plus `TICKS_MAX` par image) et dessine entre le dernier tick et le suivant (`alpha`) : une image à 120 Hz ne saccade pas.
//
// Lot T3 — les médailles et les thèmes. Le thème du jour (ou `?theme=`) pose la palette de la scène avant qu'elle soit construite. Les médailles viennent du fichier du jour préparé (le bot de
// l'auteur), de l'estimation géométrique (production sans fichier : provisoires) ou du calcul du bot dans un Web Worker (hors production sans fichier : « Médailles en calcul… », `botDemande.ts`,
// jamais chargé en production). `?bot` : regarder le bot jouer — la file de ses commandes vient de la preuve du fichier, ou du worker ; sans commande en attente la partie attend.
// Lot T4 — le fantôme a trois états (Aucun, Ma meilleure, Diamant : `fantomeEtat.ts`) ; « Ma meilleure » vient de la rediffusion gardée dans le navigateur, « Diamant » du serveur, une fois classé.

const TICKS_MAX = 6;
/** Les pièces qu'on joue avec l'aide des commandes affichée : à la quatrième, elle disparaît. */
const PIECES_AIDE = 3;

/** Ce que l'accueil donne au jeu. */
export interface ContexteJeu {
  options: OptionsUrl;
  session: Session;
  preparation: Preparation;
  /** La physique, préchargée par l'accueil. */
  rapier: Promise<Rapier>;
  /** Le joueur est-il déjà classé aujourd'hui (le Diamant est débloqué) ? Lu par l'accueil. */
  dejaClasse?: boolean;
  /** La musique commune (lot « musique »), branchée une seule fois dans `main.ts` : l'accueil joue la scène `menu`, le jeu celle du thème. */
  musique: Musique;
}

/** Niveau de la musique pendant une partie (1 dans la pause et à l'écran de fin) : à décider par Nathan. */
const MUSIQUE_EN_PARTIE = 0.6;

interface PorteDeTest {
  partie(): Partie;
  vue(): VuePartie;
  /** Arrête la boucle temps réel : le test avance lui-même, tick par tick. */
  manuel(oui?: boolean): void;
  /** Repart d'une partie neuve (aucun tick joué) : un test scripté commence toujours au même tick 0. */
  recommencer(): void;
  /** Avance de `n` ticks avec le masque `commandes` (les boutons ne sont pas lus), puis dessine. */
  avancer(n: number, commandes?: number): void;
  empreinte(): string;
  /** Le nombre de pièces du fantôme posé derrière la tour (la silhouette se calcule après la fin de la partie : tranche par tranche). */
  fantome(): number;
  /** L'état du bouton fantôme et ce qui est disponible. */
  etatFantome(): { etat: EtatFantome; meilleure: boolean; diamant: boolean };
  /** Le contenu joué. */
  contenu(): Scenario;
  /** La rediffusion (texte `base64url`) de la meilleure partie, ou null. */
  rediffusion(): string | null;
  /** Les médailles du jour (lot T3) et ce que le bot a rendu (Diamant en mm, ou null tant qu'il calcule). */
  medailles(): EtatMedailles;
  diamantBot(): number | null;
  /** Le nombre de commandes que le bot a rendues (`?bot`). */
  commandesBot(): number;
  /** L'état de l'envoi au serveur (lot T4). */
  envoi(): { statut: string; code: string; rang: number | null };
  /** Lot T5 : cette partie est-elle une partie d'ESSAI (un réglage de `?debug&tune` diffère) ? Une telle partie n'est jamais classée. */
  essai(): boolean;
  /** Lot T5 : la partie peut-elle être envoyée au classement ? */
  classable(): boolean;
  /** Lot T5 : les réglages de sensation en vigueur. */
  reglages(): ReturnType<typeof reglagesDeDepart>;
  /** Lot T5 : les sons (le contexte est-il créé, et ce qui a été joué) et les événements du dernier tick. */
  sons(): { pret: boolean; joues: readonly string[] };
  evenements(): readonly EvenementJeu[];
}

/** Les outils d'essai (`?scenario=essai|paliers`) : pas d'accueil, la partie tout de suite, comme avant le lot T4. */
export async function demarrerScenario(options: OptionsUrl, musique: Musique): Promise<void> {
  installerCataloguesDuJeu();
  await chargerLangue();
  appliquerDocument();
  const racine = document.getElementById("tower")!;
  const message = el("div", { classe: "tower__message", attrs: { role: "status" }, texte: t("chargement.texte") });
  racine.append(message);
  try {
    const rapier = import("@cdj/tower-sim/rapier").then((m) => m.chargerRapier());
    const preparation = await (await import("./preparation")).preparerScenario(options);
    message.remove();
    await demarrerJeu({ options, session: creerSession(options), preparation, rapier, musique });
  } catch {
    message.textContent = t("chargement.echec");
    document.documentElement.dataset.ready = "true";
  }
}

export async function demarrerJeu(ctx: ContexteJeu): Promise<void> {
  const { options, session, preparation, musique } = ctx;
  installerCataloguesDuJeu(); // les textes que seul le jeu lit (lot T5), hors du premier chargement
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

  // La physique (Rapier et son WebAssembly) est préchargée par l'accueil : un fichier à part, jamais dans le premier chargement de la page.
  let R: Rapier;
  try {
    R = await ctx.rapier;
  } catch {
    message.textContent = t("chargement.echec");
    document.documentElement.dataset.ready = "true";
    return;
  }
  message.remove();

  const stockage = gameStorage();
  const reglages = reglagesDeDepart();
  // Lot T7 : les réglages d'affichage du joueur (Réglages › Affichage, `tower:reglages`) : le fantôme au départ, les secousses, la panique des yeux. **Affichage seulement** : rien ne retourne dans la simulation.
  let reglagesJ: ReglagesJoueur = lireReglagesJoueur(stockage);
  /** Le gain de la panique des yeux : le curseur de `?debug&tune` fois le choix du joueur (Réglages › Affichage). */
  const gainYeux = (): number => reglages.rendu.panique * facteurDe(reglagesJ.yeux);
  /** Les réglages de rendu de `?debug&tune` avec les choix du joueur (secousses, yeux) : relus à chaque image par la scène. */
  const renduEffectif = (): typeof reglages.rendu => ({ ...reglages.rendu, secousse: reglages.rendu.secousse * facteurDe(reglagesJ.secousses), panique: gainYeux() });
  const { tactile } = session;
  const entrees = new Entrees(() => reglages.entrees);
  const contenu = preparation.contenu;
  const jourLu = preparation.jourLu;
  const date = preparation.date;
  const enTete = (): string =>
    options.scenario === "essai"
      ? t("fin.eyebrow")
      : options.scenario === "paliers"
        ? t("fin.eyebrow.paliers")
        : preparation.numero !== null
          ? t("fin.eyebrow.tour", { numero: preparation.numero, theme: t(`theme.${preparation.theme}`) })
          : t("fin.eyebrow.jour", { date: formatDateCourte(preparation.jour!, langueCourante()) });
  // Le thème : `?theme=` (hors production), sinon celui du jour ; la suite d'essai et les paliers gardent le port. La palette est posée avant la scène et le HUD.
  poserPalette(await chargerPalette(preparation.theme));
  let medailles: EtatMedailles = preparation.medailles;
  /** `?bot` : les commandes du bot, un masque par tick ; `diamantBot` : sa hauteur, connue quand il a fini. */
  const fileBot: number[] = [];
  let indexBot = 0;
  let diamantBot: number | null = null;
  let botComplet = false;
  let botAttend = false;

  // Lot T5 : le hasard d'AFFICHAGE (clignements, gouttes, secousses, variations des sons) n'est jamais celui de la simulation ; chaque usage a sa graine.
  const hasardScene = hasardAffichage(0x70e7);
  const hasardSon = hasardAffichage(0x5017);
  const scene = new Scene3D(racine, contenu.plateformeDemi8, { hasard: hasardScene, rendu: renduEffectif });
  const stockageSons = stockage;
  let reglagesSons: ReglagesSons = lireSons(stockageSons);
  const sons = new Sons({ reglages: () => reglagesSons, volumes: () => reglages.rendu.volumes, hasard: hasardSon });
  sons.brancher();
  let ventEnCours = false;
  let derniersEvenements: readonly EvenementJeu[] = [];
  let analyseur = new AnalyseurPanique(contenu.plateformeDemi8, undefined, gainYeux);
  const observateur = new Observateur();
  scene.surPlouf = (x, taille) => void sons.jouer({ genre: "plouf", x, taille });
  const memoire = new MemoireFantome();
  let etatFantome: EtatFantome = "aucun";
  let diamantPieces: FantomePiece[] | null = null;
  /** Le Diamant est débloqué : le joueur est classé aujourd'hui (l'accueil l'a lu, ou le serveur vient de classer une partie). */
  let classe = ctx.dejaClasse === true;
  let diamantRefuse = false;
  let partie: Partie;
  let pause = false;
  let manuel = false;
  let acc = 0;
  let dernier = performance.now();

  // Ce qui peut être classé : le contenu du jour d'aujourd'hui, joué normalement (ni le bot, ni des réglages de sensation modifiés, ni un tirage ou un thème forcés). Lot T5 : **relu à chaque partie**
  // (les curseurs de `?debug&tune` bougent en cours de route) : toute partie jouée avec un réglage d'essai (`reglagesEssai` : entrées, simulation, physique, largeur de plateforme) n'est jamais classée.
  const classableAvec = (): boolean =>
    date !== null && classablePourReglages({ scenario: options.scenario, jour: preparation.jour ?? -1, aujourdhui: session.aujourdhui, bot: options.bot, tireForce: options.tirage !== 0 || options.theme !== null }, reglages) && jourLu !== null;
  let classable = classableAvec();
  /** Cette partie a des réglages d'essai : ni classement, ni record, ni fantôme. */
  let essai = false;

  // Hors production seulement : le bot de l'auteur. Sa preuve est dans le fichier du jour, ou son Web Worker la calcule (une minute) ; les deux modules sont chargés à la demande, et la constante de
  // construction `import.meta.env.VITE_PRODUCTION` (écrite en clair ici pour que la construction retire tout ce bloc, et avec lui le worker, du jeu publié) le ferme en production.
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

  // --- Le fantôme : trois états (Aucun, Ma meilleure, Diamant) ---
  const dispo = (): { meilleure: boolean; diamant: boolean } => ({ meilleure: (memoire.get()?.pieces?.length ?? 0) > 0, diamant: classe && !diamantRefuse && session.source !== null && classable });
  const nomFantome = (): string => t(cleNomFantome(etatFantome));
  const poserFantome = (): void => {
    etatFantome = etatValide(etatFantome, dispo());
    scene.poserFantome(etatFantome === "meilleure" ? (memoire.get()?.pieces ?? null) : etatFantome === "diamant" ? diamantPieces : null);
  };
  /** Le Diamant se demande au serveur la première fois qu'on le choisit (il refuse tant qu'on n'est pas classé, et pour un jour sans preuve). */
  async function chargerDiamant(): Promise<void> {
    const pid = readPlayerId(stockage ?? { getItem: () => null });
    if (diamantPieces || !session.source || !pid || date === null) return;
    const r = await session.source.diamant(date, pid);
    if (r.ok && r.data.pieces.length > 0) diamantPieces = r.data.pieces;
    else diamantRefuse = true;
    if (etatFantome === "diamant") {
      if (diamantRefuse) etatFantome = "aucun";
      poserFantome();
      hud.maj(partie.vue(), nomFantome());
    }
  }
  // « Ma meilleure » vient aussi de la rediffusion GARDÉE dans le navigateur (la meilleure partie du jour, même d'une visite précédente) : rejouée en tranches pour sa silhouette.
  if (date !== null && classable) {
    const gardee = lireRecords(stockage)[date];
    if (gardee) {
      void import("./fantomeRejeu")
        .then(async (m) => {
          const rediffusion = m.lireRediffusion(gardee.rediffusion);
          const f = m.fantomeDe(rediffusion, { hauteurMm: gardee.hauteurMm, vies: gardee.vies, ticks: gardee.ticks });
          if (!memoire.proposer(f)) return;
          f.pieces = await m.silhouetteDe(R, contenu, rediffusion);
          if (memoire.get() === f) {
            if (etatFantome === "aucun" && reglagesJ.fantome === "meilleure" && partie.etape === "jeu" && partie.vue().numero <= 1) etatFantome = "meilleure";
            poserFantome();
            hud.maj(partie.vue(), nomFantome());
          }
        })
        .catch(() => undefined);
    }
  }

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
    onFantome: () => changerFantome(),
  });
  /** Le bouton fantôme (et la touche choisie pour « fantôme ») : Aucun → Ma meilleure → Diamant → Aucun. */
  function changerFantome(): void {
    etatFantome = suivant(etatFantome, dispo());
    if (etatFantome === "diamant" && !diamantPieces) void chargerDiamant();
    poserFantome();
    hud.maj(partie.vue(), nomFantome());
  }
  // Lot T7 : une tour passée (ouverte depuis les Archives) se joue en archive : jamais classée, jamais envoyée ; une plaque le dit en partie.
  const archive = options.scenario === "jour" && estArchive(preparation.jour, session.aujourdhui);
  hud.majArchive(archive);

  // --- L'envoi au serveur et l'arrivée ---
  /** Le dernier record proposé : cette partie bat-elle celui du navigateur ? */
  let nouveauRecord = false;
  let rediffusionPrete = false;
  const vueEnvoi = (): VueEnvoi => ({ etat: session.envoi.state, reponse: date ? (session.envoi.resultats.get(date) ?? null) : null, nouveauRecord, pasMieux: rediffusionPrete && !nouveauRecord });
  const fin = monterFin(racine, {
    eyebrow: enTete,
    onRejouer: () => nouvellePartie(),
    onPartager: () => void partager(),
    onClassement: () => void ouvrirClassement(),
    onAccueil: () => allerAccueil(),
    onPseudo: (nom) => void session.envoi.choisirPseudo(nom),
    onRecharger: () => location.reload(),
  });
  // Lot TP : « Jeu suivant du jour » à l'arrivée : une lecture de `GET /api/portail/jour` (au plus une par 10 s) une fois le classement connu du serveur ; serveur injoignable ou aucune identité : rien.
  let suiteLue = 0;
  const lireLaSuite = async (force: boolean): Promise<void> => {
    if (!classable || !session.base || (!force && Date.now() - suiteLue < 10_000)) return;
    const id = readPlayerId(stockage ?? { getItem: () => null });
    if (!id) return;
    suiteLue = Date.now();
    const suite = await chargerSuite(session.base, id);
    if (suite) fin.majSuite(suite);
  };
  session.envoi.surChangement(() => {
    if (fin.ouverte && rediffusionPrete) fin.majEnvoi(vueEnvoi());
    const rep = date ? session.envoi.resultats.get(date) : undefined;
    if (rep && !classe) {
      classe = true; // classé : le Diamant est débloqué pour la partie suivante
      hud.maj(partie.vue(), nomFantome());
    }
    if (rep && fin.ouverte) void lireLaSuite(true);
  });
  // Lot « musique » : la scène est le thème de la partie (celui de la palette, `preparation.theme` : `?theme=`, sinon celui du jour ; la suite d'essai et les paliers gardent le port) ; un peu plus basse pendant une partie, ses réglages sont dans la pause.
  const menu = monterPause(racine, {
    onReprendre: () => reprendre(),
    onRecommencer: () => nouvellePartie(),
    onAccueil: () => allerAccueil(),
    onAide: () => void ouvrirAide(),
    onReglages: () => void ouvrirReglages(),
    musique: () => musique.lecteur(),
    // Lot T5 : les effets sonores ont leur case et leur volume dans la pause (la musique, son bloc commun juste dessous) ; lot T7 : et dans Réglages › Son.
    sons: { lire: () => reglagesSons, ecrire: (r) => appliquerSons(r) },
  });
  // Le message en direct : l'accueil, l'arrivée et (lot T7) la pause ; jamais pendant une partie.
  const message2: MessageDirect | null = session.base ? monterMessage({ base: session.base, stockage, hotes: { accueil: hoteMessage(), arrivee: fin.hoteMessage, pause: menu.hoteMessage } }) : null;
  function appliquerSons(r: ReglagesSons): void {
    reglagesSons = r;
    ecrireSons(stockageSons, r);
    sons.souffle(ventEnCours && !pause);
    menu.relireSons();
    reglagesMontes?.relireSons();
  }
  // Lot T7 : « Comment jouer » et Réglages depuis la pause — des modules à la demande, posés sur la pause (qui reste ouverte dessous).
  let aideMontee: Awaited<ReturnType<typeof import("./commentJouer").monterAide>> | null = null;
  async function ouvrirAide(): Promise<void> {
    const m = await import("./commentJouer");
    aideMontee ??= m.monterAide(racine, { tactile });
    aideMontee.ouvrir();
  }
  let reglagesMontes: Awaited<ReturnType<typeof import("./reglages").monterReglages>> | null = null;
  async function ouvrirReglages(): Promise<void> {
    const m = await import("./reglages");
    reglagesMontes ??= m.monterReglages(racine, {
      jour: () => ({ jour: preparation.jour ?? session.aujourdhui, numero: preparation.numero }),
      musique: () => musique.lecteur(),
      sons: { lire: () => reglagesSons, ecrire: (r) => appliquerSons(r) },
      reglages: {
        lire: () => reglagesJ,
        ecrire: (r) => {
          reglagesJ = r;
          ecrireReglagesJoueur(stockage, r);
        },
      },
      tactile,
      profilHref: "../profil/?retour=/tower/",
    });
    reglagesMontes.ouvrir();
  }
  /** Un écran posé sur la pause est ouvert : Échap, P et Start lui appartiennent. */
  const ecranOuvert = (): boolean => (aideMontee?.ouverte ?? false) || (reglagesMontes?.ouvert ?? false) || (dialogueClassement?.ouvert ?? false);
  /** « Accueil de Tower » : la page de l'accueil. **La partie en cours est abandonnée, jamais envoyée** : seul `terminer()` (la fin d'une partie) propose un record et envoie. */
  function allerAccueil(): void {
    location.assign(adresseAccueil(location.pathname, location.search));
  }
  musique.scene(`theme:${preparation.theme}`);
  musique.baisser(MUSIQUE_EN_PARTIE);
  const debug = options.debug ? el("pre", { classe: "debug", attrs: { id: "debug" } }) : null;
  if (debug) racine.append(debug);
  // Lot T5 : l'outil de réglage (`?debug&tune`, fermé en production : `options.tune` est faux). Il est importé statiquement, DANS le jeu : un `import()` de plus l'aurait séparé en un morceau à part et
  // fait grossir le premier chargement (la liste des morceaux préchargés de `main` : +16 o, mesuré) ; son poids est dans `tower.jeu`.
  if (options.tune) monterTune(racine, reglages, { demiJour: contenu.plateformeDemi8, onRecommencer: () => nouvellePartie() });

  /** Le classement du jour en dialogue : la réponse du dernier envoi, sinon une lecture du serveur. */
  let dialogueClassement: ReturnType<typeof monterClassement> | null = null;
  async function ouvrirClassement(): Promise<void> {
    dialogueClassement ??= monterClassement(racine);
    const connu = date ? session.envoi.resultats.get(date)?.board : undefined;
    if (connu) return dialogueClassement.ouvrir(connu);
    dialogueClassement.ouvrir(null, "chargement");
    if (!session.source || !date) return dialogueClassement.ouvrir(null, "indisponible");
    const r = await session.source.board(date, readPlayerId(stockage ?? { getItem: () => null }));
    if (r.ok) suivreGeneration(r.data);
    dialogueClassement.ouvrir(r.ok ? r.data : null, r.ok ? "ok" : "indisponible");
  }

  /** « Partager » : la ligne (`partage.ts`) sur la feuille du téléphone, sinon dans le presse-papiers ; sinon le texte à sélectionner. */
  async function partager(): Promise<void> {
    const r = partie.resultat();
    if (!r) return;
    const m = medailles.medailles ? medailleObtenue(r.hauteurMm, medailles.medailles) : null;
    const titre = preparation.numero !== null ? t("partage.titre", { numero: preparation.numero }) : t("partage.titreSansNumero", { date: date ?? "" });
    const texte = textePartage({ titre, hauteurMm: r.hauteurMm, medaille: m, vies: r.vies, total: reglages.sim.vies, langue: langueCourante() }, location);
    const envoye = await (await import("./partageDom")).envoyerPartage(texte, tactile);
    if (envoye === "annule") return;
    fin.majPartage(envoye === "echec" ? t("fin.partage.echec") : t(envoye === "partage" ? "fin.partage.partage" : "fin.partage.copie"), envoye === "echec" ? texte : null);
  }

  /** Lot T5 : réagit à un événement de la partie — le son, la secousse, le clignement des vies. Affichage seulement : rien n'en retourne dans la simulation. */
  function reagir(ev: EvenementJeu): void {
    sons.jouer(ev);
    if (ev.genre === "ventDebut") ventEnCours = true;
    else if (ev.genre === "ventFin") ventEnCours = false;
    else if (ev.genre === "perte") {
      scene.secouer(ev.cascade >= 1);
      hud.clignerVies();
    } else if (ev.genre === "effondrement" && ev.force === 2) scene.secouer(true);
  }

  function nouvellePartie(): void {
    partie?.dispose();
    // Lot T5 : les réglages d'essai de `?debug&tune` (physique, largeur de plateforme forcée) s'appliquent à la partie qui commence ; une partie qui en a est marquée « d'essai » et jamais classée.
    classable = classableAvec();
    essai = reglagesEssai(reglages);
    const scenario: Scenario = reglages.plateformeDemi8 !== null ? { ...contenu, plateformeDemi8: reglages.plateformeDemi8 } : contenu;
    partie = new Partie(R, scenario, { ...reglages.sim }, { physique: { ...reglages.physique } });
    scene.poserPlateforme(scenario.plateformeDemi8);
    scene.poserEchelles(partie.taillesDEssai);
    analyseur = new AnalyseurPanique(scenario.plateformeDemi8, partie.taillesDEssai, gainYeux);
    observateur.reinitialiser();
    ventEnCours = false;
    sons.souffle(false);
    scene.vider();
    etatFantome = etatInitial(dispo(), reglagesJ.fantome);
    poserFantome();
    hud.cacherAnnonce();
    declenchesVus = 0;
    fin.cacher();
    dialogueClassement?.fermer();
    menu.fermer();
    musique.baisser(MUSIQUE_EN_PARTIE);
    message2?.montrer(null);
    hud.cache = false;
    pause = false;
    entrees.toutRelacher();
    acc = 0;
    indexBot = 0;
    nouveauRecord = false;
    rediffusionPrete = false;
    const v = partie.vue();
    scene.sync(v);
    scene.poserPanique(analyseur.analyser(v));
    observateur.observer(v);
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
    sons.souffle(false); // le souffle du vent se tait pendant la pause
    musique.baisser(1);
    menu.ouvrir(partie.vue());
    message2?.montrer("pause");
  }

  function reprendre(): void {
    if (!pause) return;
    pause = false;
    menu.fermer();
    message2?.montrer(null);
    musique.baisser(MUSIQUE_EN_PARTIE);
    sons.souffle(ventEnCours);
    hud.cache = false;
    entrees.toutRelacher();
    dernier = performance.now();
  }

  function terminer(): void {
    const r = partie.resultat()!;
    const v = partie.vue();
    musique.baisser(1);
    const obtenue = medailles.medailles ? medailleObtenue(r.hauteurMm, medailles.medailles) : null;
    // La partie s'est enregistrée : sa rediffusion est gardée comme record du jour si elle bat le précédent (et part au serveur, qui la rejoue) ; si c'est la meilleure du fantôme, la silhouette est
    // l'état final de cette partie rejouée. Tout cela est chargé à la demande (`fantomeRejeu`) : les commandes sont copiées tout de suite, la partie est détruite dès qu'on rejoue.
    const masques = [...partie.commandesJouees()];
    const enreg = { commandesJouees: () => masques, scenario: partie.scenario, reglages: { ...partie.reglages } };
    // Lot T5 : une partie d'essai (réglages de `?debug&tune`) n'a ni record, ni fantôme, ni envoi : sa rediffusion ne se rejouerait pas aux réglages normaux.
    if (!options.bot && !essai) {
      void import("./fantomeRejeu")
        .then(async (m) => {
          const rediffusion = m.enregistrer(enreg);
          const f = m.fantomeDe(rediffusion, r);
          if (classable && date !== null) {
            const { nouveau } = proposerRecord(stockage, date, { hauteurMm: r.hauteurMm, vies: r.vies, ticks: r.ticks, medaille: obtenue, rediffusion: f.code });
            nouveauRecord = nouveau;
            rediffusionPrete = true;
            if (fin.ouverte) fin.majEnvoi(vueEnvoi());
            if (nouveau) session.envoi.offrir();
          }
          if (!memoire.proposer(f)) return;
          f.pieces = await m.silhouetteDe(R, contenu, rediffusion);
          if (memoire.get() === f) poserFantome();
        })
        .catch(() => undefined);
    }
    hud.cache = true;
    const lignes: string[] = [];
    // La meilleure médaille du jour (la session comprise) est celle du record gardé.
    const record = date ? lireRecords(stockage)[date] : undefined;
    const meilleure = !options.bot && classable ? (record && record.hauteurMm > r.hauteurMm ? record.medaille : obtenue) : null;
    if (meilleure) lignes.push(t("fin.medailles.session", { medaille: nomMedaille(traducteurDuSocle(), TYPE_MEDAILLE[meilleure]) }));
    if (options.bot && diamantBot !== null) lignes.push(t("bot.diamant", { hauteur: formatHauteur(diamantBot) }));
    if (essai) lignes.push(t("fin.essai"));
    if (archive) lignes.push(t("fin.archive"));
    // Lot T5 : la fin de partie sonne, puis une courte fanfare pour la médaille obtenue.
    for (const ev of evenementsDeFin(r.motif, obtenue)) sons.jouer(ev);
    const franchis = (contenu.paliers ?? []).slice(0, v.declenches).map((p) => p.metres);
    fin.montrer({ vue: v, r, vies: reglages.sim.vies, medailles, note: lignes.length > 0 ? lignes.join(" · ") : null, franchis, classable, jour: preparation.jour, numero: preparation.numero });
    // Le classement : « envoi en cours » tout de suite pour une partie qui peut être classée (le record s'enregistre juste après) ; sans serveur « hors ligne, non classé ».
    if (classable) fin.majEnvoi({ etat: session.source ? { statut: "sending", code: "", suggestions: [] } : session.envoi.state, reponse: date ? (session.envoi.resultats.get(date) ?? null) : null, nouveauRecord: false, pasMieux: false });
    message2?.montrer("arrivee");
    // Déjà classé plus tôt dans la journée (cette partie ne bat pas le record) : le serveur connaît le résultat, la suite peut se lire tout de suite.
    if (classe) void lireLaSuite(false);
  }

  function tick(commandes: number): void {
    partie.avancer(commandes);
    const v = partie.vue();
    scene.sync(v);
    // Lot T5 : la vue de la partie, lue (jamais écrite) par l'affichage : la panique des yeux, puis les événements (sons, secousse, clignement des vies).
    scene.poserPanique(analyseur.analyser(v));
    derniersEvenements = observateur.observer(v, analyseur.nouveauxAffoles);
    for (const ev of derniersEvenements) reagir(ev);
    synchroPaliers(v);
    if (document.documentElement.dataset.phase !== v.phase) document.documentElement.dataset.phase = v.phase;
    if (v.phase === "fini" && !fin.ouverte) terminer();
  }

  // Lot T7 (règle M2) : **aucune touche n'est écrite ici** — le clavier passe par `commandes` (les touches d'origine : ← A / → D, ↑ W X, ↓ S Espace, P, G, Entrée ; ou celles que le joueur a choisies dans
  // Réglages › Commandes) ; Échap est fixe. Un écran ouvert (pause, fin, aide, réglages) prend le clavier.
  /** La dernière entrée du joueur : elle décide de ce que l'aide dessine (touches ou boutons de manette) ; au tactile elle ne s'affiche pas. */
  let entree: Entree = tactile ? "tactile" : "clavier";
  const enJeu = (): boolean => !pause && !fin.ouverte && !ecranOuvert() && partie.etape !== "fini";
  entrees.brancherClavier(window, () => enJeu(), commandes);
  /** Échap et la touche « pause » ouvrent et ferment la pause ; Start fait de même à la manette. Un écran posé sur la pause (réglages, aide, classement) garde ces touches pour lui. */
  function basculerPause(): void {
    if (ecranOuvert()) return;
    if (pause) reprendre();
    else ouvrirPause();
  }
  /** Entrée vaut « recommencer » seulement hors d'un bouton, d'un lien ou d'un champ : sur eux, c'est eux qu'elle active. */
  const surControle = (e: KeyboardEvent): boolean => e.target instanceof HTMLElement && e.target.closest("button, a[href], input, select, textarea, [role=button]") !== null;
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    entree = "clavier";
    if (document.documentElement.dataset.capture) return; // Réglages › Commandes attend une touche : elle n'agit pas sur le jeu
    const action = e.code === TOUCHE_FIXE ? "pause" : commandes.actionDeTouche(e.code);
    if (action === "pause") {
      if (!e.repeat) basculerPause();
    } else if (action === "recommencer" && !e.repeat && enJeu() && !surControle(e)) {
      nouvellePartie();
    } else if (action === "fantome" && !e.repeat && enJeu()) {
      changerFantome();
    }
  });
  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") entree = "tactile";
  });
  // La manette : lue à chaque image par `padPourLeJeu` (un menu ouvert la cache, sauf Start : un appui ne sert jamais deux fois). Gauche et droite répètent comme au clavier (`entrees.lire`).
  let startTenu = false;
  let recommencerTenu = false;
  let fantomeTenu = false;
  function lireManette(): void {
    if (options.bot || typeof navigator === "undefined" || !navigator.getGamepads) return;
    const pad = padPourLeJeu(navigator.getGamepads().find((p): p is Gamepad => !!p && p.connected));
    if (pad && padActif(pad)) entree = "manette";
    const start = !!pad?.buttons[BOUTON_FIXE]?.pressed;
    if (start && !startTenu) basculerPause();
    startTenu = start;
    const recommencer = !!pad && commandes.enfonceeManette("recommencer", pad);
    const fantome = !!pad && commandes.enfonceeManette("fantome", pad);
    const jouable = enJeu();
    if (jouable && recommencer && !recommencerTenu) nouvellePartie();
    else if (jouable && fantome && !fantomeTenu) changerFantome();
    recommencerTenu = recommencer;
    fantomeTenu = fantome;
    entrees.lirePad(jouable ? pad : undefined, commandes);
  }
  // L'aide des commandes : au départ d'une partie, une ligne sous la bande ; elle disparaît après quelques pièces (`aideLigne.ts`, chargée à la demande : un appareil tactile ne la montre jamais). Redessinée si
  // l'entrée ou les touches changent.
  let aideCle = "";
  function majAideLigne(): void {
    const visible = !options.bot && !pause && !fin.ouverte && entree !== "tactile" && partie.vue().numero <= PIECES_AIDE;
    const cle = visible ? entree : "";
    if (cle === aideCle) return;
    aideCle = cle;
    if (!visible) return hud.majAide(null);
    void import("./aideLigne").then((m) => aideCle === entree && hud.majAide(m.noeudsAide(commandes, entree as "clavier" | "manette", langueCourante())));
  }
  commandes.surChangement(() => {
    aideCle = "?";
  });
  document.addEventListener("visibilitychange", () => {
    sons.surVisibilite(document.hidden);
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
    lireManette();
    majAideLigne();
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
  if (preparation.refuse) hud.annoncerTexte(t("jour.pasEncore"));
  if (!PRODUCTION) {
    const porte: PorteDeTest = {
      partie: () => partie,
      vue: () => partie.vue(),
      manuel: (oui = true) => {
        manuel = oui;
      },
      recommencer: () => nouvellePartie(),
      avancer: (n, commandes) => {
        for (let i = 0; i < n && partie.etape !== "fini"; i++) tick(commandes ?? (options.bot ? Math.max(0, commandeSuivante()) : 0));
        hud.maj(partie.vue(), nomFantome());
        scene.dessiner(1, 0);
      },
      empreinte: () => empreinteVue(partie.vue()),
      fantome: () => (etatFantome === "meilleure" ? (memoire.get()?.pieces?.length ?? 0) : etatFantome === "diamant" ? (diamantPieces?.length ?? 0) : 0),
      etatFantome: () => ({ etat: etatFantome, ...dispo() }),
      contenu: () => contenu,
      rediffusion: () => memoire.get()?.code ?? null,
      medailles: () => medailles,
      diamantBot: () => diamantBot,
      commandesBot: () => fileBot.length,
      envoi: () => ({ statut: session.envoi.state.statut, code: session.envoi.state.code, rang: date ? (session.envoi.resultats.get(date)?.rank ?? null) : null }),
      essai: () => essai,
      classable: () => classable,
      reglages: () => reglages,
      sons: () => ({ pret: sons.pret, joues: sons.joues }),
      evenements: () => derniersEvenements,
    };
    (window as unknown as { __tower: PorteDeTest }).__tower = porte;
  }
  document.documentElement.dataset.ready = "true";
  requestAnimationFrame(image);
}
