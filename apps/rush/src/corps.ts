import { Color, DirectionalLight, Fog, Group, HemisphereLight, Mesh, MeshToonMaterial, PCFShadowMap, Scene, Vector3, WebGLRenderer, type Material, type Object3D } from "three";
import { formatDay } from "@cdj/core";
import {
  B_BELIER,
  B_CHENE,
  BOND_ANNONCE,
  BOND_VOL,
  COMPETENCE,
  GELATON,
  CHAMAN,
  CRACHE_ANNONCE,
  CRACHE_PORTEE,
  CRACHEUR,
  PB_ANNONCE,
  PB_CONE,
  PB_CONE_COS,
  PORTE_BOUCLIER,
  TOTEM,
  TOTEM_ANNONCE,
  TOTEM_PERIODE,
  ANNONCE_PLONGEON,
  competenceDuPilote,
  etatPilote,
  type Strategie,
  indiceCompetence,
  B_DUC,
  B_REINE,
  CHAUVE,
  CM_PAR_CHANFREIN,
  DUREE_TICKS,
  INACCESSIBLE,
  GELEE,
  MARCHE,
  MAX_CHANGEMENTS,
  MAX_CHOIX,
  ONDE,
  PIERRES,
  POING,
  RAYON_ARENE,
  RECUPERE,
  RUGIT,
  REGLAGES_DEFAUT,
  RUSH_GENERATOR_VERSION,
  TICKS_PAR_SECONDE,
  VARIANTE,
  Z_BANDE,
  Z_INVOCATION,
  Z_SPORES,
  BOSS_IDS,
  M,
  Partie,
  AMELIORATIONS,
  ameliorationsDe,
  caseDe,
  centreDeCase,
  choisirCarte,
  contenuScenario,
  dailyRush,
  Fantome,
  descendre,
  diamantDuJour,
  enregistrer,
  entreesDuBot,
  formatTemps,
  indiceBoss,
  indiceMonstre,
  lireJourFige,
  pilote,
  pointDevant,
  reglagesDe,
  seuilsDuJour,
  sontLesReglagesParDefaut,
  type Changement,
  type Choix,
  type Contenu,
  type Evenement,
  type Monstre,
  type Reglages,
  type Seuils,
  type Zone,
} from "@cdj/rush-sim";
import { dateDemandable, lireFichierDeJour } from "@cdj/kit/jour";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import { commandesDuJeu } from "@cdj/kit/jeu/commandes";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import { bornes, animerChevalier, creerChevalier, creerRocher, type ChevalierVu } from "./acteurs";
import { cameraDuBestiaireMonstres, MonstresVus, etiquettesDuBestiaire } from "./ennemisVue";
import { animerBoss, cadreDuBoss, capDuBoss, cleBoss, creerBoss, type BossVu } from "./bosses";
import { monterBestiaire, RAYON_BESTIAIRE } from "./bestiaire";
import { CameraRush, type ModeNiveau, type PointCadre } from "./camera";
import { eclair } from "./cel";
import { monterDecor } from "./decor";
import { monterNiveauVu } from "./niveauVue";
import { FICHE } from "./fiche";
import "./rush.css"; // le HUD, les boutons et la carte ne servent qu'en partie : leur feuille est chargée avec la scène (jamais dans le premier chargement)
import { Controles } from "./controles";
import { Annonces, Anneaux, ArcCoup, Bandes, Cones, Cratere, Eclats, Gemmes, LignesCourse, Nuages, OndesEpee, Ombres, Racines, Reticule, Traits } from "./effets";
import { carteVue, competenceVue } from "./cartes";
import { monterVases, ECLATS_VASE } from "./vasesVue";
import { chargerModeles, MODELES_COMMUNS, modelesDuContenu } from "./modeles";
import { BouclierVu, CerclesJoueur, LameTourbillon, OndesChoc, TraineeElan } from "./competencesVue";
import { carteDesJours } from "./carte";
import { completerEcranDeFin, partieDeFin, type ResumeFin } from "./fin";
import { tableauDesMedailles } from "./medaillesVue";
import { lireEssai } from "./essai";
import { monterInterface } from "./interface";
import { Rendu, type Qualite } from "./rendu";
import { PALETTES } from "./palette";
import { SENSATIONS_DEFAUT, sensationsDe, type Sensations } from "./sensations";
import { musiqueDuKit as musique } from "./kitSon";
import { Sons, niveauEffets, type SonNom } from "./sons";
import { monterTune } from "./tune";
import { directionDeVisee, pointSurLeSol, ZONE_MORTE_VISEE } from "./visee";

// Le corps de Rush, chargé à la demande (Three.js, la scène, les sons) : l'accueil n'en paie pas le poids. `nouvellePartieRush` assemble la partie : la simulation (`@cdj/rush-sim`, 60 Hz, entière), la scène 3D qui la
// lit, les effets de sensation (arrêt sur image, secousse, éclair blanc, éclats, sons) qui ne touchent jamais à la simulation, les commandes et les surimpressions. Le kit appelle `avancer()` 60 fois par seconde et
// `dessiner()` à chaque image.

declare const __JOURS_FIGES__: readonly string[] | undefined;
const JOURS_FIGES: readonly string[] = typeof __JOURS_FIGES__ === "undefined" ? [] : __JOURS_FIGES__;

/**
 * Le contenu d'un jour, ses MODÈLES chargés (lot BR-A1) : ceux de toute partie (le chevalier, les vases…) partent tout de suite, ceux du jour (le boss du jour, les monstres présents) dès que le contenu est connu. Un modèle qui ne
 * vient pas (réseau, délai) laisse sa forme procédurale : la partie se joue quand même.
 */
export async function contenuDuJour(jour: number, base: string): Promise<Contenu> {
  // `&modeles=0` (essai, jamais en production) : les formes procédurales d'avant le lot BR-A1, pour comparer (captures « avant »)
  if (!BUILD_RESTRICTED && new URLSearchParams(location.search).get("modeles") === "0") return contenuSansModeles(jour, base);
  const communs = chargerModeles(MODELES_COMMUNS, base);
  const c = await contenuSansModeles(jour, base);
  await Promise.all([communs, chargerModeles(modelesDuContenu(c), base)]);
  return c;
}

/** Le contenu d'un jour : un scénario d'essai de l'adresse, sinon le fichier figé s'il existe (`jours/AAAA-MM-JJ.json`) et se relit, sinon le générateur courant. */
async function contenuSansModeles(jour: number, base: string): Promise<Contenu> {
  const essai = lireEssai(location.search, BUILD_RESTRICTED);
  const { ameliorations } = essai;
  const comp = essai.competence === null ? undefined : (indiceCompetence(essai.competence) >= 0 ? indiceCompetence(essai.competence) : undefined); // lot BR5 : `&competence=`
  // Lot BR2 : `?scenario=cartes` (le choix s'ouvre tout de suite, `&nv=` : à quel niveau) ; `&ameliorations=` : des améliorations données au départ de n'importe quel scénario.
  if (essai.scenario === "cartes") return contenuScenario("cartes", { jour: essai.jour ?? jour, nv: essai.nv, ameliorations, competence: comp });
  // Lot BR3 : `?scenario=boss&boss=reine` joue l'un des cinq boss (un identifiant inconnu : le golem) ; `?scenario=bestiaire` les montre côte à côte.
  if (essai.scenario !== null && essai.scenario !== "jour") return contenuScenario(essai.scenario, { phase2: essai.phase2, monstres: essai.monstres, jour: essai.jour ?? jour, ameliorations, boss: essai.boss === null ? undefined : indiceBoss(essai.boss), competence: comp, ennemis: essai.ennemis.map(indiceMonstre).filter((k) => k >= 0), elite: essai.elite });
  // Lot BR1 : `?scenario=jour&jour=AAAA-MM-JJ` (ou `?scenario=carte`) joue un autre jour que celui d'aujourd'hui : un essai, jamais classé, jamais en production.
  if (essai.jour !== null) return { ...dailyRush(essai.jour, RUSH_GENERATOR_VERSION), ameliorations: ameliorationsDe(ameliorations), ...(comp !== undefined ? { competence: comp } : {}) };
  if (essai.carte !== null || essai.medailles !== null) return dailyRush(jour, RUSH_GENERATOR_VERSION);
  // Lot BR4 : `?scenario=fin` joue le niveau du jour (ou `&jour=`), pour que l'écran de fin ait les médailles d'un vrai jour.
  if (essai.fin !== null) return dailyRush(essai.jour ?? jour, RUSH_GENERATOR_VERSION);
  const date = formatDay(jour);
  const nouveau = (c: Contenu): Contenu => (ameliorations.length > 0 || comp !== undefined ? { ...c, ...(ameliorations.length > 0 ? { ameliorations: ameliorationsDe(ameliorations) } : {}), ...(comp !== undefined ? { competence: comp } : {}) } : c);
  if (dateDemandable(date, import.meta.env.VITE_PRODUCTION === "1", JOURS_FIGES)) {
    try {
      const lu = lireJourFige(await lireFichierDeJour("jours", date, base, 4000));
      if (lu) return nouveau(lu);
    } catch {
      /* absent ou abîmé : le générateur */
    }
  }
  return nouveau(dailyRush(jour, RUSH_GENERATOR_VERSION));
}

/** Les seuils du jour tel qu'il est servi (lot BR4) : ceux du fichier figé, sinon le Diamant du pilote (le meilleur des trois stratégies) et ses pourcentages. */
export const seuilsDeRush = (c: Contenu): Seuils => seuilsDuJour(c);
export const rediffusionDiamantRush = (c: Contenu): string => {
  const bot = entreesDuBot(c);
  return enregistrer(c, bot.changements, bot.choix, bot.competence);
};

/** Les éclats d'un type de monstre qui meurt ou qui apparaît (lot BR6 : sept types). */
const genreEclat = (type: number): "gelee" | "gelaton" | "chauve" | "cracheur" | "chaman" | "totem" | "acier" =>
  type === GELEE ? "gelee" : type === GELATON ? "gelaton" : type === CRACHEUR ? "cracheur" : type === CHAMAN ? "chaman" : type === TOTEM ? "totem" : type === PORTE_BOUCLIER ? "acier" : "chauve";

const mod = (x: number, n: number): number => ((x % n) + n) % n;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const metres = (u: number): number => u / M;
const PAS_MS = 1000 / TICKS_PAR_SECONDE;

/** La position d'un corps d'un tick à l'autre : le dessin la lisse entre les deux. */
interface Suivi {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const suivi = (x: number, y: number): Suivi => ({ x0: x, y0: y, x1: x, y1: y });
const pousser = (s: Suivi, x: number, y: number): void => {
  s.x0 = s.x1;
  s.y0 = s.y1;
  s.x1 = x;
  s.y1 = y;
};

interface ActeurBete {
  suivi: Suivi;
  eclair: number;
  yaw: number;
  /** L'écrasement sous un coup, de 0 (juste touché) à 1 (fini), et son amplitude. */
  ecrase: number;
  force: number;
}

export function nouvellePartieRush(contenu: Contenu, hote: HTMLElement, o: OptionsPartie): PartieDuJeu {
  const essai = lireEssai(location.search, BUILD_RESTRICTED);
  if (essai.carte !== null) return carteDesJours(contenu.jour, essai.carte, hote, o);
  if (essai.medailles !== null) return tableauDesMedailles(contenu.jour, essai.medailles, hote, o);
  if (essai.fin !== null) return partieDeFin(contenu, essai.fin, o);
  const manuel = new URLSearchParams(location.search).has("manuel");
  const debug = !BUILD_RESTRICTED && new URLSearchParams(location.search).has("debug");
  const t = o.t;
  const palette = PALETTES[o.theme] ?? PALETTES.prairie!;
  const collees = essai.reglages === null ? REGLAGES_DEFAUT : reglagesDe(essai.reglages);
  const etat = { reglages: (sontLesReglagesParDefaut(collees) ? REGLAGES_DEFAUT : collees) as Reglages, sensations: sensationsDe(essai.sensations) as Sensations };
  let lecteur: { reglages(): { volume: number; coupee: boolean } } | null = null;
  void musique()?.lecteur().then((l) => (lecteur = l as unknown as typeof lecteur), () => undefined);
  const sonsAvecKit = new Sons(() => (lecteur ? niveauEffets(lecteur.reglages().volume, lecteur.reglages().coupee) : 0.8));
  sonsAvecKit.deverrouiller(); // le clic sur « Jouer » vient d'avoir lieu : le contexte audio démarre tout de suite
  const geste = (): void => sonsAvecKit.deverrouiller();
  addEventListener("pointerdown", geste);
  addEventListener("keydown", geste);
  const son = (n: SonNom, h = 1): void => sonsAvecKit.jouer(n, h);

  const bestiaire = contenu.scenario === "bestiaire";
  // Lot BR6 : `?scenario=bestiaire-monstres` : les sept monstres et un élite de chaque, figés (la partie ne joue pas), une caméra fixe qui les cadre.
  const bestiaireM = contenu.scenario === "bestiaire-monstres";
  const figee = contenu.scenario === "vitrine" || bestiaire || bestiaireM;

  // --- Les commandes et l'interface ---
  const commandes = (() => {
    try {
      return commandesDuJeu(FICHE, null as never, null as never); // l'instance du kit (une par jeu) : les touches choisies dans Réglages › Commandes
    } catch {
      return null;
    }
  })();
  const controles = new Controles(commandes);
  const ui = monterInterface(hote, t, o.tactile, controles, o.libelle);

  // --- La simulation ---
  let partie = new Partie(contenu, etat.reglages, true);
  /** Le bestiaire : le chevalier se tient devant la rangée, à gauche, pour donner l'échelle (la partie est figée). */
  const placerPourLeBestiaire = (): void => {
    if (!bestiaire) return;
    partie.c.x = Math.round(-12.4 * M);
    partie.c.y = Math.round(6.5 * M);
  };
  placerPourLeBestiaire();
  let changements: Changement[] = [];
  let derniere = 0;
  // Lot BR4 : le fantôme est une `Fantome` de la simulation (la rediffusion rejouée tick pour tick, ses choix de cartes compris) ; `fantomeSim` est sa partie.
  let fantome: Fantome | null = null;
  let fantomeSim: Partie | null = null;
  // Lot BR2 : les choix d'amélioration faits (une partie sauvée les emporte : c'est un événement d'entrée de la rediffusion), et la carte en surbrillance.
  let choixFaits: Choix[] = [];
  let selectionChoix = 0;
  // Lot BR5 : la compétence choisie au départ (−1 tant que l'écran de choix est ouvert) : un événement d'entrée de la rediffusion.
  let competenceChoisie = partie.c.comp;

  // --- La scène ---
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  const ratio = Math.min(devicePixelRatio || 1, o.tactile ? 1.5 : 2);
  renderer.setPixelRatio(ratio);
  renderer.setClearColor(new Color(palette.fond));
  renderer.shadowMap.type = PCFShadowMap;
  renderer.info.autoReset = false; // le pipeline dessine plusieurs fois par image (ombres, scène, passes) : on remet les compteurs à zéro nous-mêmes, une fois par image
  renderer.domElement.setAttribute("aria-hidden", "true");
  ui.zone3d.append(renderer.domElement);
  const scene = new Scene();
  const rig = new CameraRush();
  const camera = rig.camera;
  // La lumière (lot BR0c) : une hémisphérique (le ciel bleu, le sable chaud), le soleil (de droite et un peu de face) et son OMBRE PORTÉE : une carte de 1 024 serrée sur l'arène, au bord adouci.
  scene.add(new HemisphereLight(palette.hemiCiel, palette.hemiSol, palette.intensiteAmbiance));
  const soleil = new DirectionalLight(palette.lumiere, palette.intensiteLumiere);
  soleil.position.set(9, 18, 4);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(1024, 1024);
  const cs = soleil.shadow.camera;
  // L'ombre SUIT la caméra (lot BR1 : la carte est plus grande que l'arène) : une carte de 1 024 sur ~36 m autour du point regardé, calée sur la grille des texels (pas de scintillement).
  const demiOmbre = bestiaire ? 27 : 18; // lot BR3 : la rangée du bestiaire est large
  cs.left = -demiOmbre;
  cs.right = demiOmbre;
  cs.top = demiOmbre;
  cs.bottom = -demiOmbre;
  cs.near = 2;
  cs.far = bestiaire ? 90 : 60;
  soleil.shadow.radius = 3.5;
  soleil.shadow.bias = -0.0005;
  soleil.shadow.normalBias = 0.04;
  scene.add(soleil, soleil.target);
  scene.fog = new Fog(palette.brume, 55, 150); // une brume légère vers l'horizon

  // Le niveau de rendu (lot BR0c) : `?qualite=` l'impose ; sinon haute, avec un passage automatique en basse si les images par seconde chutent (jamais de retour en haute dans la partie).
  let qualite: Qualite = essai.qualite ?? "haute";
  const rendu = new Rendu(renderer, scene, camera, qualite);
  const appliquerQualite = (q: Qualite): void => {
    qualite = q;
    rendu.definir(q);
    soleil.castShadow = q === "haute";
    ombres.maillage.visible = q === "basse";
    scene.traverse((n: Object3D) => {
      const m = (n as Mesh).material as Material | Material[] | undefined;
      if (Array.isArray(m)) for (const x of m) x.needsUpdate = true;
      else if (m) m.needsUpdate = true;
    });
  };
  const R = metres(RAYON_ARENE);
  const niveau = contenu.niveau;
  // Lot BR3 : le bestiaire pose les cinq boss sur un plateau plus large, avec leur nom dessous.
  const salle = bestiaire ? monterBestiaire(ui.racine, palette, scene, (id) => t(`boss.nom.${cleBoss(id)}`)) : null;
  if (bestiaire) ui.racine.dataset.bestiaire = "1";
  const decor = salle ? salle.decor : niveau ? monterNiveauVu(niveau, palette) : monterDecor(R, palette);
  scene.background = decor.ciel;
  scene.add(decor.groupe);
  if (salle) scene.add(salle.groupe);
  const vasesVue = monterVases(); // lot BR5 : les groupes de vases (jarres, tonneaux, petites caisses)
  scene.add(vasesVue.groupe);
  // Lot BR6 : tous les monstres sont des tas instanciés (un appel de dessin par type et par pièce), élites, bulles du chaman et projectiles compris.
  const monstresVus = new MonstresVus();
  scene.add(monstresVus.groupe);
  const etiquettesM = bestiaireM ? etiquettesDuBestiaire(ui.racine, t) : null;
  const centreArene = niveau ? { x: metres(niveau.arene.x), z: metres(niveau.arene.y) } : { x: 0, z: 0 };

  const ombres = new Ombres(); // les ombres en disques : la basse qualité (en haute, de vraies ombres portées)
  scene.add(ombres.maillage);
  const cratere = new Cratere();
  scene.add(cratere.groupe);
  const eclats = new Eclats();
  eclats.quantite = etat.sensations.eclats / 100;
  scene.add(eclats.maillage);
  const annonces = new Annonces();
  scene.add(annonces.groupe);
  const bandes = new Bandes(); // lot BR3 : plongeon, charge, racines
  const lignesCrachat = new Bandes(10); // lot BR6 : la ligne de visée des cracheurs
  const cones = new Cones(6); // lot BR6 : le cône du coup de bouclier d'un porte-bouclier
  scene.add(bandes.groupe, lignesCrachat.groupe, cones.groupe);
  const nuages = new Nuages(); // lot BR3 : les spores du vieux chêne
  scene.add(nuages.groupe);
  const racines = new Racines();
  scene.add(racines.maillage);
  const anneaux = new Anneaux();
  scene.add(anneaux.groupe);
  const arc = new ArcCoup();
  scene.add(arc.maillage);
  const traits = new Traits();
  scene.add(traits.maillage);
  const lignesCourse = new LignesCourse(); // lot BR1b : les lignes de vitesse de la course
  scene.add(lignesCourse.maillage);
  const gemmesVue = new Gemmes(); // lot BR2 : les gemmes d'XP
  scene.add(gemmesVue.groupe);
  const ondesEpeeVue = new OndesEpee(); // lot BR2 : l'onde de l'épée
  scene.add(ondesEpeeVue.groupe);
  // Lot BR5 : les compétences (la lame du tourbillon, le cercle d'atterrissage du bond — cyan, jamais rouge —, son onde de choc, le bouclier lancé) et la traînée du coup d'élan.
  const lame = new LameTourbillon();
  const cerclesJoueur = new CerclesJoueur();
  const ondesChoc = new OndesChoc();
  const bouclierVu = new BouclierVu();
  const trainee = new TraineeElan();
  scene.add(lame.groupe, cerclesJoueur.groupe, ondesChoc.groupe, bouclierVu.groupe, trainee.maillage);
  const reticule = new Reticule();
  scene.add(reticule.maillage);

  const chevalier: ChevalierVu = creerChevalier();
  scene.add(chevalier.racine);
  const sChev = suivi(partie.c.x, partie.c.y);
  let yawChev = Math.atan2(Math.cos((partie.c.dir * Math.PI * 2) / 128), Math.sin((partie.c.dir * Math.PI * 2) / 128));
  const bossVu: BossVu | null = partie.golem ? creerBoss(partie.golem.kind) : null; // lot BR3 : l'un des cinq boss (le golem pour les anciens scénarios)
  if (bossVu) scene.add(bossVu.racine);
  const idBoss = partie.golem ? BOSS_IDS[partie.golem.kind]! : "golem";
  const nomBoss = t(`boss.nom.${cleBoss(idBoss)}`);
  if (contenu.scenario === "boss") ui.presenter(nomBoss); // le scénario `boss` n'a ni barrière ni réveil : le boss se présente dès le départ
  const sGolem = suivi(partie.golem?.x ?? 0, partie.golem?.y ?? 0);
  let yawGolem = partie.golem ? Math.atan2(partie.c.x - partie.golem.x, partie.c.y - partie.golem.y) : Math.PI / 2;
  const fantomeVu: ChevalierVu = creerChevalier();
  fantomeVu.racine.visible = false;
  fantomeVu.racine.traverse((n: Object3D) => {
    const m = (n as Mesh).material as { transparent?: boolean; opacity?: number; type?: string } | undefined;
    if (!m) return;
    if (m.type === "ShaderMaterial") n.visible = false;
    else {
      m.transparent = true;
      m.opacity = 0.35;
    }
  });
  scene.add(fantomeVu.racine);
  const sFantome = suivi(0, 0);

  const bêtes = new Map<number, ActeurBete>();
  const rochers: { groupe: Group; matiere: MeshToonMaterial }[] = [];
  for (let i = 0; i < 6; i++) {
    const r = creerRocher();
    r.groupe.visible = false;
    scene.add(r.groupe);
    rochers.push(r);
  }

  // --- Les sensations en cours ---
  let gel = 0; // l'arrêt sur image : des ticks de simulation retenus
  let dernierArretCoup = -1; // le dernier coup qui a eu son arrêt sur image : un seul par coup
  let dernierArretMs = -1e9; // et au moins 300 ms entre deux arrêts
  let credit = 1; // le ralenti : la part de tick qu'on laisse passer
  let ralenti = 1;
  let ralentiFin = 0;
  let trauma = 0;
  let kickX = 0;
  let kickZ = 0;
  let flashChev = 0;
  let finDepuis = -1; // le moment (ms) où la partie s'est finie
  let temps = 0; // le temps du jeu, en secondes, sert aux animations (ne compte pas l'arrêt sur image)
  let dernierDessin = performance.now();
  let dernierTick = performance.now();
  let ticksDepuisDessin = 0;
  let dernierPas = 0; // le moment (ms) de la dernière poussière de pas
  let dernierSpore = 0; // lot BR3 : la dernière volute de spores
  let dernierSouffle = 0; // lot BR3 : la dernière bouffée du grand-duc essoufflé
  let dernierGrattage = 0; // et du bélier qui gratte le sol
  let fpsMoy = 60;
  const reduit = o.reduit;

  const secouer = (x: number, dx = 0, dz = 0): void => {
    if (reduit) return;
    trauma = Math.min(1, trauma + (x * etat.sensations.secousse) / 100);
    kickX += dx * x * 0.35;
    kickZ += dz * x * 0.35;
  };
  const arreter = (ms: number): void => {
    const ticks = Math.round(ms / PAS_MS);
    if (ticks > gel) gel = ticks;
  };
  /** L'arrêt sur image est RARE (lot BR0c : les coups 1 et 2 n'en ont pas) : jamais plus d'un par coup (même s'il touche cinq monstres), et au moins 300 ms entre deux. */
  const arretDuCoup = (ms: number): void => {
    const maintenant = performance.now();
    if (partie.coupId === dernierArretCoup || maintenant - dernierArretMs < 300) return;
    dernierArretCoup = partie.coupId;
    dernierArretMs = maintenant;
    arreter(ms);
  };
  /** La poussée de la caméra dans le sens du coup (quelques centimètres) : elle revient en une dizaine d'images. */
  const pousserCamera = (dx: number, dz: number, m: number): void => {
    if (reduit) return;
    kickX += dx * m;
    kickZ += dz * m;
  };
  const ralentir = (facteur: number, duree: number): void => {
    ralenti = facteur;
    ralentiFin = performance.now() + duree;
  };

  const trouverBete = (m: Monstre): ActeurBete => {
    let a = bêtes.get(m.id);
    if (!a) {
      a = { suivi: suivi(m.x, m.y), eclair: 0, yaw: 0, ecrase: 1, force: 0 };
      bêtes.set(m.id, a);
    }
    return a;
  };

  const direction = (dx: number, dz: number): [number, number] => {
    const n = Math.hypot(dx, dz) || 1;
    return [dx / n, dz / n];
  };

  // --- Les bandes : la simulation retire une zone au tick de son impact ; on garde celles qui existaient juste avant ce tick pour savoir d'où elle partait ---
  let bandesAvant: Zone[] = [];
  /** L'impact d'une bande (plongeon du grand-duc, charge du bélier, racines du chêne) : des éclats tout le long du segment, la secousse ; le chêne fait jaillir des racines. */
  const impactDeBande = (e: Evenement, x: number, z: number, genre: number): void => {
    const b = bandesAvant.find((q) => q.x2 === e.x && q.y2 === e.y);
    const x0 = b ? metres(b.x) : x;
    const z0 = b ? metres(b.y) : z;
    const demi = metres(e.b);
    if (genre === B_CHENE) {
      racines.bande(x0, z0, x, z, demi);
      secouer(0.45);
      son("pierre");
      for (let k = 0; k < 5; k++) {
        const u = (k + 0.5) / 5;
        eclats.gerbe("poussiere", x0 + (x - x0) * u, 0.2, z0 + (z - z0) * u, 5, { vitesse: 3.5, taille: 0.2, haut: 2.4, duree: 0.7, gravite: 5 });
      }
      eclats.gerbe("spore", x, 0.8, z, 8, { vitesse: 3, taille: 0.16, haut: 3, duree: 0.8, gravite: 3 });
      return;
    }
    const lourd = genre === B_BELIER;
    for (let k = 0; k < 6; k++) {
      const u = (k + 0.5) / 6;
      eclats.gerbe("poussiere", x0 + (x - x0) * u, 0.2, z0 + (z - z0) * u, lourd ? 7 : 5, { vitesse: 4, taille: lourd ? 0.28 : 0.22, haut: 2.2, duree: 0.8, gravite: 5 });
    }
    eclats.gerbe("poussiere", x, 0.3, z, 30, { vitesse: 7, taille: 0.3, haut: 3.2, duree: 0.9, gravite: 5 });
    eclats.gerbe(lourd ? "pierre" : "etincelle", x, 0.5, z, lourd ? 18 : 12, { vitesse: 7.5, taille: lourd ? 0.22 : 0.09, haut: 6, duree: 0.8 });
    secouer(lourd ? 0.6 : 0.55);
    son(lourd ? "impact" : "pierre");
    if (lourd) cratere.poser(x, z, demi * 0.9 + 0.2, 4);
  };

  // --- Les événements de la simulation → sons, éclats, secousses ---
  const traiter = (e: Evenement): void => {
    const x = metres(e.x);
    const z = metres(e.y);
    const [ax, az] = direction(x - metres(partie.c.x), z - metres(partie.c.y));
    switch (e.k) {
      case "coup":
        // Le souffle de l'épée suit l'anticipation ; l'arc ne paraît qu'à la phase active.
        son(e.a === 0 ? "coup1" : e.a === 1 ? "coup2" : "coup3");
        arc.lancer(metres(partie.c.x), metres(partie.c.y), (e.b * Math.PI * 2) / 128, metres(partie.porteeCoup(e.a)), (partie.arcCoup(e.a) * Math.PI) / 180, e.a, partie.impactCoup(e.a)); // lot BR2 : la portée et l'arc comptent les améliorations
        break;
      case "touche": {
        // L'IMPACT (lot BR0c). Coups 1 et 2 : PAS d'arrêt sur image — l'éclair blanc de la cible, son écrasement, le recul (la simulation), une poussée de la caméra et des éclats. Le 3ᵉ coup (le coup final) a la secousse et un arrêt de 90 ms ;
        // le coup qui fait passer le golem en phase 2 a le sien (150 ms). Jamais plus d'un arrêt par coup, au moins 300 ms entre deux.
        const final = e.a === 2;
        const golem = e.b >= 2;
        if (final) arretDuCoup(etat.sensations.arretImage);
        if (e.b === 3) arretDuCoup(etat.sensations.arretPhase);
        eclats.gerbe("etincelle", x, 0.9, z, (golem ? 14 : 9) * (final ? 1.7 : 1), { vitesse: final ? 8 : 6.5, dx: ax, dz: az, eventail: 1.1, taille: 0.1, haut: 3 });
        if (golem) eclats.gerbe("pierre", x, 1.6, z, final ? 9 : 5, { vitesse: 4, taille: 0.14, dx: ax, dz: az });
        if (final) {
          secouer(golem ? 0.4 : 0.3, ax, az);
          eclats.gerbe("poussiere", x, 0.3, z, 8, { vitesse: 3.5, taille: 0.14, haut: 1.5, duree: 0.45, gravite: 5 });
        }
        pousserCamera(ax, az, final ? 0.16 : 0.07);
        son(golem ? "toucheGolem" : final ? "toucheFort" : "touche", 1 + Math.random() * 0.15);
        for (const m of partie.monstres) if (m.flash === 7) {
          const a = trouverBete(m);
          a.eclair = etat.sensations.eclair;
          a.ecrase = 0;
          a.force = final ? 1.5 : 1;
        }
        if (partie.golem && partie.golem.flash === 7) {
          golemEclair = etat.sensations.eclair;
          golemSursaut = 1;
        }
        break;
      }
      case "mort": {
        const g = genreEclat(e.a);
        eclats.gerbe(g, x, 0.6, z, e.a === GELATON ? 12 : e.a === TOTEM || e.a === PORTE_BOUCLIER ? 30 : 22, { vitesse: 6, taille: e.a === GELATON ? 0.12 : 0.16, haut: 5 });
        eclats.gerbe("etincelle", x, 0.7, z, 8, { vitesse: 7, taille: 0.09, haut: 4 });
        son("mort", 0.9 + Math.random() * 0.3);
        break;
      }
      case "esquive":
        son("esquive");
        traits.lancer(x, z, (e.a * Math.PI * 2) / 128);
        eclats.gerbe("poussiere", x, 0.15, z, 8, { vitesse: 3, taille: 0.12, haut: 1.4, duree: 0.4, gravite: 5 });
        break;
      case "frole":
        son("frole");
        ralentir(0.45, 260);
        eclats.gerbe("etincelle", x, 0.9, z, 14, { vitesse: 5, taille: 0.08, haut: 2.5 });
        break;
      case "degats":
        son("degats");
        ui.degats();
        o.vibrer([60, 40, 90]);
        flashChev = etat.sensations.eclair * 2;
        eclats.gerbe("etincelle", x, 0.9, z, 12, { vitesse: 5, taille: 0.1 });
        break;
      case "annonce":
        son("annonce");
        break;
      case "impact": {
        const genre = partie.golem?.kind ?? 0;
        if (e.a === Z_BANDE) {
          impactDeBande(e, x, z, genre);
          break;
        }
        if (genre === B_CHENE && e.a === PIERRES) {
          // les « pierres » du vieux chêne sont des racines qui jaillissent du cercle
          racines.cercle(x, z, metres(e.b));
          eclats.gerbe("poussiere", x, 0.2, z, 20, { vitesse: 5, taille: 0.22, haut: 2.6, duree: 0.8, gravite: 5 });
          eclats.gerbe("spore", x, 0.6, z, 6, { vitesse: 3, taille: 0.16, haut: 3, duree: 0.8, gravite: 4 });
          secouer(0.4);
          son("pierre");
          break;
        }
        const poing = e.a === POING;
        eclats.gerbe("poussiere", x, 0.2, z, poing ? 44 : 24, { vitesse: poing ? 7.5 : 5, taille: poing ? 0.32 : 0.24, haut: 3.4, duree: 0.95, gravite: 5 });
        if (genre === B_REINE) eclats.gerbe("reine", x, 0.4, z, 26, { vitesse: 7, taille: 0.22, haut: 5, duree: 0.8 }); // le bond de la reine : une éclaboussure de gelée, pas des pierres
        else eclats.gerbe("pierre", x, 0.3, z, poing ? 22 : 10, { vitesse: 7, taille: 0.2, haut: 7.5, duree: 1.0 });
        secouer(poing ? 0.7 : 0.45);
        son(poing ? "impact" : "pierre");
        cratere.poser(x, z, metres(e.b) * (poing ? 0.62 : 0.8) + 0.15, genre === B_REINE ? 3 : poing ? 6 : 4);
        eclats.gerbe("poussiere", x, 0.25, z, poing ? 20 : 8, { vitesse: poing ? 11 : 6, taille: 0.2, haut: 1.2, duree: 1.0, gravite: 1.5 });
        break;
      }
      case "division":
        // la reine se divise : une éclaboussure de gelée, elle ondule
        son("mort", 0.7);
        secouer(0.3);
        golemSursaut = 1.8;
        eclats.gerbe("reine", x, 1.4, z, 44, { vitesse: 7.5, taille: 0.24, haut: 6.5, duree: 0.85 });
        eclats.gerbe("gelee", x, 0.8, z, 20, { vitesse: 6, taille: 0.16, haut: 4, duree: 0.7 });
        break;
      case "choc":
        // le bélier percute le muret : des éclats de pierre, la poussière, la secousse
        son("impact");
        secouer(0.8);
        golemSursaut = 1.6;
        eclats.gerbe("pierre", x, 1.6, z, 36, { vitesse: 8, taille: 0.26, haut: 8, duree: 1.0 });
        eclats.gerbe("poussiere", x, 0.5, z, 34, { vitesse: 6.5, taille: 0.3, haut: 3, duree: 0.9, gravite: 4 });
        eclats.gerbe("etincelle", x, 1.4, z, 14, { vitesse: 7, taille: 0.1, haut: 4, duree: 0.5 });
        cratere.poser(x, z, 2.2, 4);
        break;
      case "nuage":
        // les spores éclatent : le nuage reste (dessiné d'après la simulation), un jet de volutes
        son("onde");
        secouer(0.25);
        eclats.gerbe("spore", x, 0.6, z, 40, { vitesse: Math.max(2, metres(e.a) * 1.4), taille: 0.26, haut: 1.8, duree: 1.1, gravite: 0.6 });
        break;
      case "invoque":
        // une gelée naît : une éclaboussure verte, un petit son ; lot BR6 : le totem fait naître trois gélatons (un grondement violet, des éclats bleus et violets)
        if (e.a === TOTEM) {
          son("totem");
          eclats.gerbe("totem", x, 0.8, z, 20, { vitesse: 4, taille: 0.14, haut: 3.6, duree: 0.6 });
          eclats.gerbe("gelaton", x, 0.4, z, 14, { vitesse: 3.6, taille: 0.12, haut: 3, duree: 0.5 });
          break;
        }
        son("apparition");
        eclats.gerbe("gelee", x, 0.5, z, 16, { vitesse: 4, taille: 0.16, haut: 3.4, duree: 0.55 });
        eclats.gerbe("etincelle", x, 0.8, z, 8, { vitesse: 3, taille: 0.09, haut: 3, duree: 0.45 });
        break;
      case "onde":
        son("onde");
        secouer(0.5);
        eclats.gerbe("feu", x, 0.3, z, 20, { vitesse: 7, taille: 0.14, haut: 2, duree: 0.5 });
        break;
      case "phase2":
        son("phase2");
        secouer(1);
        eclats.gerbe("feu", x, 2.5, z, 40, { vitesse: 7, taille: 0.2, haut: 8, duree: 0.9 });
        ralentir(0.5, 700);
        break;
      case "victoire":
        son("victoire");
        secouer(1);
        ralentir(0.3, 1500);
        eclats.gerbe("pierre", x, 2, z, 80, { vitesse: 9, taille: 0.3, haut: 10, duree: 1.3 });
        eclats.gerbe("feu", x, 2.2, z, 60, { vitesse: 8, taille: 0.22, haut: 9, duree: 1.1 });
        eclats.gerbe("etincelle", x, 2.5, z, 40, { vitesse: 10, taille: 0.14, haut: 8, duree: 1.2 });
        o.vibrer([80, 40, 80, 40, 200]);
        break;
      case "defaite":
        son("defaite");
        ralentir(0.4, 900);
        break;
      case "apparition":
        eclats.gerbe(genreEclat(e.a), x, 0.4, z, 7, { vitesse: 3, taille: 0.12, haut: 2.5, duree: 0.45 });
        break;
      // Lot BR6 : un coup PARÉ par un porte-bouclier (des étincelles d'acier et un clang aigu, distincts d'un coup qui touche), le crachat et son projectile, l'aura d'un chaman, le coup de bouclier, la salle d'épreuve, une vague, un élite qui tombe.
      case "para":
        son("para", 0.95 + Math.random() * 0.15);
        eclats.gerbe("acier", x, 1.0, z, 10, { vitesse: 6, dx: ax, dz: az, eventail: 0.9, taille: 0.1, haut: 2.2, duree: 0.4 });
        eclats.gerbe("etincelle", x, 1.0, z, 8, { vitesse: 7, dx: -ax, dz: -az, eventail: 1.3, taille: 0.08, haut: 2.5, duree: 0.35 });
        pousserCamera(ax, az, 0.05);
        break;
      case "tir":
        son("crache", 0.9 + Math.random() * 0.2);
        eclats.gerbe("cracheur", x, 0.7, z, 8, { vitesse: 3, taille: 0.12, haut: 1.4, duree: 0.4 });
        break;
      case "projectileDetruit":
        son("pop", e.b === 2 ? 1.2 : 0.9);
        eclats.gerbe(e.b === 2 ? "etincelle" : "cracheur", x, 0.75, z, e.b === 2 ? 9 : 6, { vitesse: 4, taille: 0.1, haut: 1.8, duree: 0.35 });
        break;
      case "aura": {
        const maintenant = performance.now();
        if (maintenant - dernierSonAura > 500) {
          dernierSonAura = maintenant;
          son("aura");
        }
        eclats.gerbe("chaman", x, 1.5, z, 4, { vitesse: 1.6, taille: 0.07, haut: 1.4, duree: 0.5, gravite: -0.5 });
        break;
      }
      case "coupBouclier": {
        son("coupBouclier");
        secouer(0.25);
        const f = (e.a * Math.PI * 2) / 128;
        eclats.gerbe("poussiere", x + Math.cos(f) * 1.5, 0.2, z + Math.sin(f) * 1.5, 12, { vitesse: 4.5, dx: Math.cos(f), dz: Math.sin(f), eventail: 1.1, taille: 0.2, haut: 1.4, duree: 0.6, gravite: 4 });
        eclats.gerbe("acier", x + Math.cos(f) * 1.2, 0.8, z + Math.sin(f) * 1.2, 8, { vitesse: 5, dx: Math.cos(f), dz: Math.sin(f), eventail: 1.0, taille: 0.1, haut: 2, duree: 0.4 });
        break;
      }
      case "epreuve":
        // a = 1 : les portes de la salle se ferment ; 2 : elles se rouvrent
        son(e.a === 1 ? "porte" : "niveau");
        secouer(e.a === 1 ? 0.5 : 0.2);
        ui.presenter(t(e.a === 1 ? "epreuve.debut" : "epreuve.fin"));
        o.vibrer([40, 30, 90]);
        break;
      case "vague":
        son("vague");
        ui.presenter(t("epreuve.vague", { n: e.a, total: partie.niveau?.epreuve.vagues.length ?? 3 }));
        break;
      case "elite":
        son("eliteMort");
        secouer(0.35);
        eclats.gerbe("etincelle", x, 1.2, z, 40, { vitesse: 8, taille: 0.12, haut: 7, duree: 0.9 });
        eclats.gerbe("feu", x, 0.6, z, 18, { vitesse: 5, taille: 0.16, haut: 4, duree: 0.6 });
        break;
      case "brasier":
        son("elan", 0.7);
        eclats.gerbe("feu", x, 0.3, z, 16, { vitesse: 3, taille: 0.14, haut: 1.8, duree: 0.6 });
        break;
      case "sismique":
        son("sismique");
        secouer(0.3);
        ondesChoc.lancer(x, z, metres(e.a));
        eclats.gerbe("poussiere", x, 0.2, z, 22, { vitesse: 7, taille: 0.22, haut: 1.2, duree: 0.7, gravite: 3 });
        break;
      case "frenesie":
        eclats.gerbe("etincelle", x, 1.6, z, 3 + e.a, { vitesse: 3, taille: 0.07, haut: 2, duree: 0.3 });
        break;
      case "bloque":
        son("bloque");
        eclats.gerbe("etincelle", x, 2.4, z, 6, { vitesse: 5, taille: 0.08 });
        break;
      case "sauve":
        eclats.gerbe("etincelle", x, 1, z, 30, { vitesse: 6, taille: 0.1, haut: 5 });
        break;
      case "alerte":
        // un monstre du niveau remarque le chevalier : un éclat jaune au-dessus de lui (le « ! »)
        eclats.gerbe("etincelle", x, e.a === CHAUVE ? 2.2 : 1.3, z, 5, { vitesse: 2.5, taille: 0.1, haut: 2.5, duree: 0.4 });
        break;
      case "brise": {
        // Lot BR5 — un VASE cède (a : le genre, b : ce qu'il contient). Le « retour » demandé : des éclats de terre cuite ou de bois qui volent, un son de céramique ou de bois, les voisins qui sursautent, ce qu'il contient qui jaillit.
        // (Pas de secousse d'écran ni d'arrêt sur image : ils restent réservés au 3ᵉ coup et aux attaques du boss.)
        const jarre = e.a === 0;
        son(jarre ? "jarre" : "bois", 0.85 + Math.random() * 0.3);
        // lot BR-A1 : les éclats MODÉLISÉS du vase jaillissent de leur place ; les particules ne sont plus que la poussière de céramique ou les échardes
        const modelise = vasesVue.briser(e.a, x, z, ax, az, temps);
        eclats.gerbe(ECLATS_VASE[e.a] ?? "bois", x, 0.55, z, modelise ? 10 : jarre ? 22 : 16, { vitesse: 6.5, taille: jarre ? 0.12 : 0.16, haut: 5.2, duree: 0.95, gravite: 16 });
        if (!modelise) eclats.gerbe(jarre ? "jarre" : "planche", x, 0.4, z, 9, { vitesse: 4, taille: jarre ? 0.2 : 0.22, haut: 3, duree: 0.8, dx: ax, dz: az, eventail: 1.4, gravite: 14 });
        eclats.gerbe("poussiere", x, 0.25, z, 8, { vitesse: 2.6, taille: 0.2, haut: 1.2, duree: 0.6, gravite: 3 });
        vasesVue.secouer(x, z, temps);
        break;
      }
      case "gemme":
        // ce que le vase ou le monstre laissait jaillit : une gemme (étincelles dorées), une recharge (violet) ou un cœur (rose)
        eclats.gerbe(e.b === 1 ? "recharge" : "etincelle", x, 0.6, z, 5, { vitesse: 2.6, taille: 0.07, haut: 3.2, duree: 0.35 });
        break;
      case "ramasse": {
        // un tintement qui monte quand on en ramasse plusieurs de suite ; la recharge et le cœur ont le leur
        const maintenant = performance.now();
        chaineGemmes = maintenant - dernierRamasse < 320 ? Math.min(8, chaineGemmes + 1) : 0;
        dernierRamasse = maintenant;
        if (e.b === 2) son("soin");
        else if (maintenant - dernierSonRamasse > 45) {
          dernierSonRamasse = maintenant;
          son("ramasse", (e.b === 1 ? 1.4 : 1) + chaineGemmes * 0.07);
        }
        eclats.gerbe(e.b === 1 ? "recharge" : "etincelle", metres(partie.c.x), 1, metres(partie.c.y), 3, { vitesse: 2, taille: 0.06, haut: 2.4, duree: 0.3 });
        break;
      }
      case "niveau":
        // un niveau gagné : le monde se fige, des étincelles autour du chevalier
        son("niveau");
        o.vibrer([30, 30, 70]);
        eclats.gerbe("etincelle", x, 1, z, 30, { vitesse: 6, taille: 0.1, haut: 6, duree: 0.7 });
        eclats.gerbe("feu", x, 0.4, z, 14, { vitesse: 4, taille: 0.14, haut: 3, duree: 0.5 });
        break;
      case "carte":
        son("carte");
        eclats.gerbe("etincelle", x, 1, z, 22, { vitesse: 5, taille: 0.09, haut: 5, duree: 0.6 });
        break;
      case "ondeEpee":
        son("ondeEpee");
        break;
      case "competence": {
        // Lot BR5 : la compétence part : son souffle, une gerbe d'étincelles autour du chevalier.
        son(e.a === 0 ? "tourbillon" : e.a === 1 ? "bond" : "bouclier");
        o.vibrer([25, 20, 25]);
        eclats.gerbe("lame", x, 0.9, z, e.a === 0 ? 18 : 12, { vitesse: 5.5, taille: 0.1, haut: 2.4, duree: 0.5 });
        break;
      }
      case "pulsation": {
        // une passe du tourbillon : une couronne d'étincelles dorées au bord de la zone, qui partent vers l'extérieur
        const R = metres(e.b) * 0.9;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2 + e.a * 0.4;
          eclats.gerbe("lame", x + Math.cos(a) * R, 0.6, z + Math.sin(a) * R, 1, { vitesse: 4, taille: 0.11, dx: Math.cos(a), dz: Math.sin(a), eventail: 0.5, haut: 1.6, duree: 0.4 });
        }
        eclats.gerbe("poussiere", x, 0.2, z, 6, { vitesse: 5, taille: 0.14, haut: 0.8, duree: 0.4, gravite: 3 });
        break;
      }
      case "atterrissage": {
        // le bond écrase le sol : l'onde de choc (cyan), la poussière en couronne, des éclats de pierre. (Ni secousse ni arrêt sur image : réservés au 3ᵉ coup et aux attaques du boss.)
        son("atterri");
        ondesChoc.lancer(x, z, metres(e.b));
        eclats.gerbe("poussiere", x, 0.25, z, 36, { vitesse: 8, taille: 0.26, haut: 2.6, duree: 0.8, gravite: 5 });
        eclats.gerbe("pierre", x, 0.3, z, 14, { vitesse: 6.5, taille: 0.16, haut: 6, duree: 0.8 });
        eclats.gerbe("lame", x, 0.6, z, 14, { vitesse: 7, taille: 0.1, haut: 3, duree: 0.5 });
        cratere.poser(x, z, 1.6, 3);
        pousserCamera(0, 0.12, 1);
        break;
      }
      case "bouclier":
        son("bouclier");
        break;
      case "bouclierTouche":
        son("touche", 1.2 + Math.random() * 0.15);
        eclats.gerbe("etincelle", x, 0.9, z, 8, { vitesse: 5.5, taille: 0.09, haut: 2.5 });
        break;
      case "bouclierRetour":
        eclats.gerbe("etincelle", x, 0.95, z, 6, { vitesse: 3, taille: 0.08, haut: 1.5, duree: 0.35 });
        break;
      case "elan": {
        // le coup d'élan : la fente part (son, poussière, la traînée)
        son("elan");
        trainee.lancer(metres(partie.c.x), metres(partie.c.y), (e.a * Math.PI * 2) / 128);
        const arriere = (e.a * Math.PI * 2) / 128 + Math.PI;
        eclats.gerbe("poussiere", x + Math.cos(arriere) * 0.3, 0.12, z + Math.sin(arriere) * 0.3, 8, { vitesse: 3, taille: 0.14, haut: 0.9, duree: 0.4, gravite: 3 });
        break;
      }
      case "prete":
        // la compétence est rechargée : un tintement et des étincelles violettes (le bouton pulse)
        son("prete");
        eclats.gerbe("recharge", x, 1.1, z, 14, { vitesse: 3.5, taille: 0.1, haut: 3.5, duree: 0.5 });
        break;
      case "moulinet":
        // le 3ᵉ coup frappe tout autour : un nuage d'étincelles en couronne
        eclats.gerbe("etincelle", x, 0.8, z, 22, { vitesse: 7, taille: 0.1, haut: 1.2, duree: 0.45 });
        break;
      case "tranchant":
        eclats.gerbe("etincelle", x, 0.9, z, 8, { vitesse: 5, taille: 0.08, haut: 2.5 });
        break;
      case "soin":
        son("soin");
        eclats.gerbe("etincelle", x, 1, z, 16, { vitesse: 3, taille: 0.09, haut: 4, duree: 0.6 });
        break;
      case "barriere":
        // la barrière se referme derrière le chevalier
        son("impact");
        secouer(0.5);
        eclats.gerbe("poussiere", x, 0.3, z, 26, { vitesse: 5, taille: 0.22, haut: 2.5, duree: 0.8, gravite: 4 });
        break;
      case "eveil":
        // le boss se réveille : son nom paraît ~1 s (il rugit, invulnérable)
        ui.presenter(nomBoss);
        son("phase2");
        secouer(0.7);
        eclats.gerbe("feu", x, 2.5, z, 24, { vitesse: 6, taille: 0.18, haut: 6, duree: 0.7 });
        break;
    }
  };
  let golemEclair = 0;
  let golemSursaut = 0;
  let dernierRamasse = -1e9;
  let dernierSonRamasse = -1e9;
  let dernierSonAura = -1e9; // lot BR6 : l'aura d'un chaman tinte toutes les 40 ticks : un seul tintement par demi-seconde
  let chaineGemmes = 0;

  // --- Le choix d'une amélioration (lot BR2) : le monde est figé (la simulation n'avance plus, le chrono non plus) jusqu'à ce que le joueur ait choisi une carte ---
  const ouvrirChoixVue = (): void => {
    const ch = partie.choix;
    if (!ch) return;
    selectionChoix = 0;
    ui.ouvrirChoix(t("choix.titre", { n: ch.nv }), t("choix.aria", { n: ch.nv }), ch.cartes.map((i) => carteVue(i, partie.paliers[i]!, etat.reglages, t, partie.golem?.kind ?? -1, partie.c.comp)), (i) => valider(i));
  };
  // Lot BR5 : le choix de la compétence au départ — le même écran, avant que le chrono parte (le monde est figé) ; un événement d'entrée de la rediffusion.
  const ouvrirDepartVue = (): void => {
    if (!partie.attenteDepart) return;
    selectionChoix = 0;
    ui.ouvrirChoix(t("depart.titre"), t("depart.aria"), [0, 1, 2].map((i) => competenceVue(i, etat.reglages, t)), (i) => valider(i));
  };
  const validerDepart = (i: number): void => {
    if (!partie.attenteDepart || !ui.choixOuvert() || !partie.choisirCompetence(i)) return;
    competenceChoisie = i;
    controles.effacerAppuis();
    ui.fermerChoix();
  };
  /** Le joueur choisit la carte `i` : un événement d'entrée (noté pour la rediffusion), la simulation repart — ou ouvre aussitôt le choix du niveau suivant. */
  const valider = (i: number): void => {
    if (partie.attenteDepart) return validerDepart(i);
    const ch = partie.choix;
    if (!ch || !ui.choixOuvert()) return;
    if (choixFaits.length >= MAX_CHOIX || !partie.choisir(ch.nv, i)) return;
    choixFaits.push({ tick: partie.tick, nv: ch.nv, carte: i });
    controles.effacerAppuis();
    ui.fermerChoix();
    for (const ev of partie.evenements) traiter(ev);
    partie.vider();
    if (partie.choix) ouvrirChoixVue();
  };
  const deplacerSelection = (pas: number): void => {
    const n = partie.attenteDepart ? 3 : (partie.choix?.cartes.length ?? 0);
    if (n === 0) return;
    selectionChoix = (selectionChoix + pas + n) % n;
    ui.selection(selectionChoix);
  };
  /** Pendant le choix, 1 2 3 choisissent la carte, Entrée la carte en surbrillance (les flèches, ZQSD et la manette déplacent la surbrillance par les actions du kit : `action`). Écouteur en CAPTURE : Entrée est « Recommencer » pour le kit, il ne doit pas la lui laisser. */
  const surTouchePendantChoix = (e: KeyboardEvent): void => {
    if (!ui.choixOuvert() || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = /^(?:Digit|Numpad)([1-3])$/.exec(e.code);
    const entree = e.code === "Enter" || e.code === "NumpadEnter";
    if (!m && !entree) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    valider(m ? Number(m[1]) - 1 : selectionChoix);
  };
  addEventListener("keydown", surTouchePendantChoix, true);
  if (partie.choix) ouvrirChoixVue(); // `?scenario=cartes` : le choix est ouvert dès le départ
  ouvrirDepartVue(); // le jour : la compétence se choisit avant de partir

  // --- Un tick de simulation ---
  const pasDeSimulation = (): void => {
    const entree = controles.lire(partie.tick);
    let e = entree;
    if (e !== derniere) {
      if (changements.length >= MAX_CHANGEMENTS) e = derniere; // la rediffusion est pleine : l'entrée ne change plus
      else {
        changements.push({ tick: partie.tick, e });
        derniere = e;
      }
    }
    bandesAvant = partie.zones.length === 0 ? [] : partie.zones.filter((q) => q.type === Z_BANDE);
    partie.avancer(e);
    avancerFantome();
    pousser(sChev, partie.c.x, partie.c.y);
    if (partie.golem) pousser(sGolem, partie.golem.x, partie.golem.y);
    if (fantomeSim) pousser(sFantome, fantomeSim.c.x, fantomeSim.c.y);
    for (const m of partie.actifs) pousser(trouverBete(m).suivi, m.x, m.y); // les dormeurs ne bougent pas : leur suivi naît à leur place
    ticksDepuisDessin++;
    dernierTick = performance.now();
    for (const ev of partie.evenements) traiter(ev);
    partie.vider();
    if (partie.choix && !ui.choixOuvert()) ouvrirChoixVue(); // un niveau gagné : le monde se fige, les trois cartes s'affichent
    if (partie.finie && finDepuis < 0) finDepuis = performance.now();
  };
  /** Le fantôme joue la même partie que le joueur à qui il appartient, tick pour tick : à un niveau gagné, il fait SON choix tout de suite (le monde figé ne fait pas passer de ticks) ; l'écran des cartes n'est que celui du joueur. */
  function avancerFantome(): void {
    if (!fantome || fantome.finie) return;
    if (!fantome.avancer() && fantome.finie && !fantome.partie.finie) {
      fantome = null;
      fantomeSim = null;
      fantomeVu.racine.visible = false;
    }
  }

  const redemarrer = (): void => {
    resumeFin = null;
    partie = new Partie(contenu, etat.reglages, true);
    placerPourLeBestiaire();
    changements = [];
    choixFaits = [];
    derniere = 0;
    ui.fermerChoix();
    competenceChoisie = partie.c.comp;
    if (partie.choix) ouvrirChoixVue();
    ouvrirDepartVue();
    bêtes.clear();
    pousser(sChev, partie.c.x, partie.c.y);
    pousser(sChev, partie.c.x, partie.c.y);
    finDepuis = -1;
    gel = 0;
    rig.recommencer();
  };

  // --- Le tune ---
  const tune = essai.tune ? monterTune(ui.racine, t, etat, (r) => { etat.reglages = r; redemarrer(); }, (s) => { etat.sensations = s; eclats.quantite = s.eclats / 100; }, o.langue) : null;

  // --- Le fantôme ---
  const lireFantome = (r: string | null): void => {
    fantome = null;
    fantomeSim = null;
    fantomeVu.racine.visible = false;
    if (!r || contenu.scenario !== "jour") return;
    try {
      fantome = new Fantome(contenu, r);
      fantomeSim = fantome.partie;
      while (fantomeSim && fantomeSim.tick < partie.tick && !fantomeSim.finie) avancerFantome();
      if (!fantomeSim) return;
      sFantome.x0 = sFantome.x1 = fantomeSim.c.x;
      sFantome.y0 = sFantome.y1 = fantomeSim.c.y;
      fantomeVu.racine.visible = true;
    } catch {
      fantome = null;
      fantomeSim = null;
    }
  };
  // Lot BR4 : `?scenario=jour&fantome=1` (essai) montre le fantôme du Diamant dès le départ, sans avoir à jouer le jour pour le débloquer.
  lireFantome(o.fantome ?? (essai.fantome && contenu.scenario === "jour" ? rediffusionDiamantRush(contenu) : null));

  // --- Le dessin ---
  const redimensionner = (): void => {
    const r = ui.zone3d.getBoundingClientRect();
    const l = Math.max(2, Math.floor(r.width));
    const h = Math.max(2, Math.floor(r.height));
    renderer.setSize(l, h, false);
    rendu.taille(l, h, ratio);
    camera.aspect = l / h;
    camera.updateProjectionMatrix();
  };
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(ui.zone3d);
  redimensionner();

  // --- La souris (PC, lot BR0b) : elle VISE (le point du sol sous le curseur), le clic gauche frappe (maintenu, il enchaîne) ---
  let souris: { x: number; y: number } | null = null; // le curseur, en coordonnées d'écran de la scène (de −1 à 1, y vers le haut) ; `null` tant que le joueur n'a pas pris la souris
  let derniereVisee = -1;
  const surPointeur = (e: PointerEvent): void => {
    if (e.pointerType !== "mouse") {
      souris = null; // un doigt reprend la main : plus de visée à la souris
      return;
    }
    const r = ui.zone3d.getBoundingClientRect();
    souris = { x: ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1, y: -(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1) };
  };
  const clicBas = (e: PointerEvent): void => {
    surPointeur(e);
    if (e.pointerType === "mouse" && e.button === 0) {
      controles.boutonSouris = true;
      controles.action("coup"); // un clic plus bref qu'un arrêt sur image ne se perd pas
    }
    if (e.pointerType === "mouse" && e.button === 2) {
      controles.boutonSourisDroit = true; // lot BR5 : le clic droit lance la compétence
      controles.action("competence");
    }
  };
  const clicHaut = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && e.button === 0) controles.boutonSouris = false;
    if (e.pointerType === "mouse" && e.button === 2) controles.boutonSourisDroit = false;
  };
  const clicPerdu = (): void => {
    controles.boutonSouris = false;
    controles.boutonSourisDroit = false;
  };
  const pasDeMenu = (e: Event): void => e.preventDefault();
  ui.zone3d.addEventListener("pointermove", surPointeur);
  ui.zone3d.addEventListener("pointerdown", clicBas);
  ui.zone3d.addEventListener("contextmenu", pasDeMenu);
  addEventListener("pointerup", clicHaut);
  addEventListener("blur", clicPerdu);
  controles.visee = () => {
    if (!souris) return -1;
    const p = pointSurLeSol(camera, souris.x, souris.y);
    if (!p) return derniereVisee;
    const dx = p.x - metres(partie.c.x);
    const dz = p.z - metres(partie.c.y);
    if (Math.hypot(dx, dz) < ZONE_MORTE_VISEE) return derniereVisee;
    derniereVisee = directionDeVisee(dx, dz);
    return derniereVisee;
  };

  // La caméra basse (lot BR0b) : `CameraRush` suit le chevalier (cadré dans le tiers inférieur) et recule juste assez pour garder le golem (jusqu'à sa tête) et les cercles qui vont tomber dans l'image.
  const garder: PointCadre[] = [];
  const placerCamera = (dt: number, cx: number, cz: number, golem: { x: number; z: number } | null): void => {
    let sx = 0;
    let sz = 0;
    if (trauma > 0) {
      const a = trauma * trauma * 0.55;
      sx = (Math.sin(temps * 91.7) + Math.sin(temps * 53.3)) * 0.5 * a + kickX;
      sz = (Math.sin(temps * 77.1 + 1) + Math.sin(temps * 61.9)) * 0.5 * a + kickZ;
    }
    garder.length = 0;
    if (golem) {
      // lot BR3 : ce que chaque boss prend (la tête et les épaules du golem, les bras écartés ; la cime du chêne ; le grand-duc en vol, ailes comprises)
      const cadre = cadreDuBoss(partie.golem!.kind, bossVu?.haut ?? 0);
      garder.push({ x: golem.x, z: golem.z, haut: cadre.haut, r: cadre.r }); // le poing levé de l'annonce peut sortir par le haut
    }
    for (const z of partie.zones) {
      if (z.type === POING || z.type === Z_SPORES) garder.push({ x: metres(z.x), z: metres(z.y), r: metres(z.r) }); // le coup de poing ; les pierres tombent près du chevalier, l'onde part du golem
      else if (z.type === Z_BANDE) garder.push({ x: metres(z.x2), z: metres(z.y2), r: metres(z.r) }); // lot BR3 : l'arrivée de la bande (son départ est le boss)
    }
    if (figee) rig.recommencer(); // la vitrine est figée : la caméra est posée d'un coup, sans amorti
    if (bestiaireM) {
      // Lot BR6 : le bestiaire des monstres : une caméra fixe qui cadre les sept (et leurs élites).
      const k = cameraDuBestiaireMonstres(camera.aspect);
      camera.position.set(...k.position);
      camera.lookAt(...k.regard);
      camera.updateMatrixWorld(true);
      soleil.target.position.set(0, 0, 0);
      soleil.position.set(9, 18, 4);
      soleil.target.updateMatrixWorld();
      return;
    }
    if (salle) {
      // Le bestiaire : une caméra FIXE qui cadre les cinq boss à la même échelle (jamais de secousse).
      salle.camera(camera, camera.aspect);
      soleil.target.position.set(0, 0, 0);
      soleil.position.set(9, 18, 4);
      soleil.target.updateMatrixWorld();
      return;
    }
    let mode: ModeNiveau | undefined;
    if (niveau) {
      // Dans le niveau : elle suit le chevalier le long du chemin, puis se fond dans le cadrage de l'arène quand il s'en approche (à 24 m du centre, fondue à 13 m) ; la barrière fermée, c'est l'arène.
      const d = Math.hypot(cx - centreArene.x, cz - centreArene.z);
      mode = { arene: centreArene, melange: partie.barriere >= 0 ? 1 : Math.max(0, Math.min(1, (24 - d) / 11)) };
    }
    rig.maj(dt, etat.sensations, camera.aspect, cx, cz, golem, garder, { x: sx, z: sz }, mode);
    {
      // Le soleil et sa carte d'ombre suivent le point regardé (calés sur les texels).
      const r = rig.regard;
      const pas = (2 * demiOmbre) / 1024;
      const tx = Math.round(r.x / pas) * pas;
      const tz = Math.round(r.z / pas) * pas;
      soleil.target.position.set(tx, 0, tz);
      soleil.position.set(tx + 9, 18, tz + 4);
      soleil.target.updateMatrixWorld();
    }
    if (cameraLibre) {
      // La porte d'essai (`?debug`) peut poser la caméra où elle veut (un gros plan d'un coup, par exemple).
      camera.position.set(cameraLibre.p[0], cameraLibre.p[1], cameraLibre.p[2]);
      camera.lookAt(cameraLibre.v[0], cameraLibre.v[1], cameraLibre.v[2]);
    }
  };

  const yawVers = (actuel: number, but: number, dt: number, vitesse: number): number => {
    let d = mod(but - actuel + Math.PI, Math.PI * 2) - Math.PI;
    d *= 1 - Math.exp(-dt * vitesse);
    return actuel + d;
  };

  let cameraLibre: { p: [number, number, number]; v: [number, number, number] } | null = null;
  let msDessin = 0;
  let imagesVues = 0;
  let lenteurs = 0;
  let dernierReel = performance.now();
  appliquerQualite(qualite);
  // Lot BR4 : la fin de partie. L'écran de fin est celui du kit ; le jeu y pose le boss du jour, les cartes choisies et le Diamant (`fin.ts`), à chaque image tant que la partie est finie (le kit refait l'écran à chaque changement de l'envoi).
  let resumeFin: ResumeFin | null = null;
  const completerLaFin = (): void => {
    if (contenu.scenario !== "jour") return;
    resumeFin ??= { boss: contenu.boss, competence: competenceChoisie, paliers: partie.paliers, diamant: { ticks: seuilsDuJour(contenu).author, strategie: contenu.seuilsFiges ? undefined : diamantDuJour(contenu).strategie } };
    completerEcranDeFin(resumeFin, o);
  };
  const dessiner = (): void => {
    if (partie.finie) completerLaFin();
    const now = performance.now();
    let dt = Math.min(0.05, (now - dernierDessin) / 1000);
    dernierDessin = now;
    if (manuel) {
      dt = ticksDepuisDessin / TICKS_PAR_SECONDE;
      ticksDepuisDessin = 0;
    }
    if (ralentiFin > 0 && now > ralentiFin) {
      ralenti = 1;
      ralentiFin = 0;
    }
    // Pendant l'arrêt sur image, le monde est figé : seuls les éclats avancent, au ralenti.
    const fige = gel > 0;
    const dtMonde = fige ? 0 : dt * ralenti;
    temps += dtMonde;
    const alpha = fige || manuel ? 1 : Math.min(1, (now - dernierTick) / PAS_MS);
    trauma = Math.max(0, trauma - dt * 1.9);
    kickX *= Math.exp(-dt * 12);
    kickZ *= Math.exp(-dt * 12);
    const c = partie.c;

    // Le chevalier.
    const cx = metres(lerp(sChev.x0, sChev.x1, alpha));
    const cz = metres(lerp(sChev.y0, sChev.y1, alpha));
    chevalier.racine.position.set(cx, 0, cz);
    yawChev = yawVers(yawChev, Math.atan2(Math.cos((c.dir * Math.PI * 2) / 128), Math.sin((c.dir * Math.PI * 2) / 128)), dt, c.etat === 1 ? 40 : 18);
    chevalier.racine.rotation.y = yawChev;
    animerChevalier(chevalier, c, {
      dt: dtMonde,
      temps,
      duree: partie.dureeCoup(partie.c.combo),
      impact: partie.impactCoup(partie.c.combo),
      ticks: c.t + alpha,
      cache: c.degat > 0 && c.esq === 0 && Math.floor(now / 70) % 2 === 0 && !partie.perdue,
      course: partie.course / 100,
    });
    // La course (lot BR1b) : des lignes de vitesse derrière lui et plus de poussière.
    const vitesseCourse = c.marche && c.etat === 0 && !fige && !partie.finie ? partie.course / 100 : 0;
    lignesCourse.maj(cx, cz, (c.dir * Math.PI * 2) / 128, vitesseCourse, temps);
    if (flashChev > 0) flashChev -= dt * 60;
    eclair(chevalier.matieres, flashChev > 0 ? 0.9 : 0);
    if (partie.perdue) {
      const u = Math.min(1, (now - finDepuis) / 500);
      chevalier.pivot.rotation.z = u * 1.45;
      chevalier.pivot.position.y = 0.6 - u * 0.22;
    } else chevalier.pivot.rotation.z = 0;
    if (c.etat === 2 && !fige && Math.random() < 0.6) eclats.gerbe("poussiere", cx, 0.12, cz, 1, { vitesse: 1, taille: 0.1, haut: 0.6, duree: 0.3, gravite: 3 });
    else if (c.marche && c.etat !== 2 && !fige && !partie.finie && now - dernierPas > 150) {
      // la poussière des pas : un petit nuage derrière le pied qui se lève
      dernierPas = now;
      const arriere = ((c.dir * Math.PI * 2) / 128) + Math.PI;
      eclats.gerbe("poussiere", cx + Math.cos(arriere) * 0.25, 0.1, cz + Math.sin(arriere) * 0.25, vitesseCourse > 0.3 ? 4 : 2, { vitesse: vitesseCourse > 0.3 ? 2.2 : 1.2, taille: vitesseCourse > 0.3 ? 0.14 : 0.09, haut: 0.7, duree: 0.35, gravite: 3 });
    }

    // Le fantôme.
    if (fantomeSim) {
      const fx = metres(lerp(sFantome.x0, sFantome.x1, alpha));
      const fz = metres(lerp(sFantome.y0, sFantome.y1, alpha));
      fantomeVu.racine.position.set(fx, 0, fz);
      fantomeVu.racine.rotation.y = Math.atan2(Math.cos((fantomeSim.c.dir * Math.PI * 2) / 128), Math.sin((fantomeSim.c.dir * Math.PI * 2) / 128));
      animerChevalier(fantomeVu, fantomeSim.c, { dt: dtMonde, temps, duree: fantomeSim.dureeCoup(fantomeSim.c.combo), impact: fantomeSim.impactCoup(fantomeSim.c.combo), ticks: fantomeSim.c.t + alpha, cache: false });
    }

    ombres.debut();
    ombres.poser(cx, cz, 0.55);

    // Le boss (lot BR3 : l'un des cinq ; `partie.golem` garde son nom historique).
    let gx = 0;
    let gz = 0;
    const g = partie.golem;
    if (g && bossVu) {
      gx = metres(lerp(sGolem.x0, sGolem.x1, alpha));
      gz = metres(lerp(sGolem.y0, sGolem.y1, alpha));
      bossVu.racine.position.set(gx, 0, gz);
      // La vitrine fige le golem de face (à peine tourné vers la droite) : la composition de la cible ; en partie, il se tourne vers le chevalier — le grand-duc dans le sens de son vol, le bélier et le grand-duc qui annoncent le long de leur bande.
      const cap = capDuBoss(g, partie.zones, c, { dx: sGolem.x1 - sGolem.x0, dy: sGolem.y1 - sGolem.y0 });
      const vif = g.etat === 1 && (g.kind === B_DUC || g.kind === B_BELIER) ? 9 : g.etat === 1 ? 2 : 4;
      yawGolem = figee ? 0.1 : yawVers(yawGolem, cap, dt, vif);
      bossVu.racine.rotation.y = yawGolem;
      const deplace = Math.hypot(sGolem.x1 - sGolem.x0, sGolem.y1 - sGolem.y0) > 20;
      golemSursaut = Math.max(0, golemSursaut - dtMonde * 7);
      const dort = !partie.golemEveille;
      const fraction = Math.max(0, g.t - 1 + alpha);
      animerBoss(bossVu, figee || dort ? { ...g, etat: MARCHE } : g, {
        dt: dtMonde,
        temps,
        t: g.kind === 0 ? g.t : fraction,
        vivant: g.hp > 0,
        mort: finDepuis >= 0 && g.hp <= 0 ? (now - finDepuis) / PAS_MS : 0,
        marche: deplace && !dort,
        sursaut: golemSursaut,
        tick: partie.tick - 1 + alpha,
        zones: partie.zones,
        elan: partie.dur(24),
        dort,
      });
      if (golemEclair > 0) golemEclair -= dt * 60;
      eclair(bossVu.matieres, Math.max(golemEclair > 0 ? 0.85 : 0, bossVu.reflet));
      ombres.poser(gx, gz, g.r > 0 ? metres(g.r) * 1.15 : 2, bossVu.haut * 0.6);
      // Le grand-duc posé, essoufflé : des bouffées de poussière (le moment où le frapper).
      if (g.kind === B_DUC && g.sol === 1 && g.etat === RECUPERE && !fige && now - dernierSouffle > 330) {
        dernierSouffle = now;
        eclats.gerbe("poussiere", gx, 0.3, gz, 3, { vitesse: 2.6, taille: 0.16, haut: 1.2, duree: 0.45, gravite: 3 });
      }
      // Le bélier qui gratte le sol ou qui charge : de la poussière sous ses sabots.
      if (g.kind === B_BELIER && g.etat === 1 && !fige && now - dernierGrattage > 110) {
        dernierGrattage = now;
        eclats.gerbe("poussiere", gx + Math.sin(yawGolem) * 2.6, 0.15, gz + Math.cos(yawGolem) * 2.6, 3, { vitesse: 3, taille: 0.2, haut: 1.4, duree: 0.45, gravite: 4 });
      }
    }
    if (salle) {
      // Le bestiaire : les cinq boss en attente, leur nom à sa place, l'ombre sous chacun.
      const zone = ui.zone3d.getBoundingClientRect();
      salle.camera(camera, camera.aspect); // la caméra d'abord : les étiquettes se projettent avec elle
      salle.maj(dtMonde, temps, camera, zone.width, zone.height);
      for (const q of salle.positions) ombres.poser(q.x, q.z, q.rayon, q.haut() * 0.6);
    }

    // Les monstres (lot BR6) : tous en tas instanciés. Un dormeur à plus de 46 m du chevalier n'est ni suivi ni dessiné ; un actif l'est toujours (sa position se lisse d'un tick à l'autre).
    const vus = new Set<number>();
    monstresVus.debut();
    const chamans = new Map<number, { x: number; z: number }>();
    for (const m of partie.actifs) if (m.type === CHAMAN && m.hp > 0) chamans.set(m.id, { x: metres(m.x) + 0.44, z: metres(m.y) + 0.12 });
    monstresVus.chamans = chamans;
    lignesCrachat.debut();
    cones.debut();
    const portee2 = (46 * M) * (46 * M);
    for (const m of partie.monstres) {
      if (m.hp <= 0) continue;
      if (m.actif === 0 && (m.x - c.x) * (m.x - c.x) + (m.y - c.y) * (m.y - c.y) > portee2) continue;
      const a = trouverBete(m);
      vus.add(m.id);
      const mx = metres(lerp(a.suivi.x0, a.suivi.x1, alpha));
      const mz = metres(lerp(a.suivi.y0, a.suivi.y1, alpha));
      // où il regarde : un cracheur dans sa visée et un gélaton/une gelée dans leur bond (la direction verrouillée), un porte-bouclier ou un chaman vers le chevalier, les autres vers le chevalier
      const verrou = (m.type === CRACHEUR && m.etat === ANNONCE_PLONGEON) || ((m.type === GELEE || m.type === GELATON) && (m.cx !== 0 || m.cy !== 0));
      const vers = verrou ? Math.atan2(m.cx, m.cy) : Math.atan2(c.x - m.x, c.y - m.y);
      a.yaw = yawVers(a.yaw, vers, dt, 12);
      let q = 0;
      if (a.ecrase < 1) {
        // L'écrasement sous un coup : la cible s'aplatit puis rebondit (un ressort amorti), en un quart de seconde.
        a.ecrase = Math.min(1, a.ecrase + dtMonde * 4.2);
        q = Math.exp(-5.5 * a.ecrase) * Math.cos(a.ecrase * 10) * 0.42 * a.force;
      }
      if (a.eclair > 0) a.eclair -= dt * 60;
      monstresVus.poserMonstre(m, partie, mx, mz, a.yaw, a.eclair > 0 ? 0.9 : 0, q, temps);
      const rm = metres(partie.rayonM(m));
      ombres.poser(mx, mz, m.type === CHAUVE ? 0.38 : Math.max(0.4, rm * 1.3), m.type === CHAUVE ? 0.9 : 0);
      // Les annonces des nouveaux ennemis (le rouge est réservé au danger : toutes sont des dangers) : la LIGNE du cracheur, le CÔNE du porte-bouclier, l'ANNEAU du totem.
      if (m.type === CRACHEUR && m.etat === ANNONCE_PLONGEON) {
        const ux = m.cx / 1024;
        const uz = m.cy / 1024;
        const longueur = Math.min(metres(CRACHE_PORTEE), 14);
        lignesCrachat.poser(mx + ux * rm, mz + uz * rm, mx + ux * longueur, mz + uz * longueur, 0.28, bornes(m.t / partie.rapide(m, CRACHE_ANNONCE), 0, 1), temps);
      } else if (m.type === PORTE_BOUCLIER && m.etat === ANNONCE_PLONGEON) {
        const f = (m.face * Math.PI * 2) / 128;
        cones.poser(mx, mz, Math.cos(f), Math.sin(f), metres(PB_CONE), PB_CONE_COS / 1024, bornes(m.t / partie.rapide(m, PB_ANNONCE), 0, 1), temps);
      } else if (m.type === TOTEM && m.etat === ANNONCE_PLONGEON) {
        annonces.poser(mx, mz, 1.6 * (m.elite === 1 ? 1.5 : 1), bornes((m.t - (TOTEM_PERIODE - TOTEM_ANNONCE)) / TOTEM_ANNONCE, 0, 1), temps, true);
      }
    }
    for (const q of partie.projectiles) {
      const px = metres(q.x - q.vx * (1 - alpha));
      const pz = metres(q.y - q.vy * (1 - alpha));
      monstresVus.poserProjectile(q, px, pz, temps);
      ombres.poser(px, pz, 0.25);
    }
    monstresVus.fin();
    etiquettesM?.maj(partie, camera, ui.zone3d.getBoundingClientRect());
    // Les vases (lot BR5) : posés d'après la simulation ; leur ombre en disque en basse qualité.
    vasesVue.maj(partie.vases, temps);
    if (qualite === "basse") for (const v of partie.vases) if (v.id >= 0) ombres.poser(metres(v.x), metres(v.y), metres(v.r) * 1.25);
    for (const id of bêtes.keys()) if (!vus.has(id)) bêtes.delete(id);

    // Les zones annoncées (cercles, bandes, anneaux d'invocation), les nuages, les ondes, les pierres qui tombent.
    annonces.debut();
    bandes.debut();
    nuages.debut();
    anneaux.debut();
    let nbRochers = 0;
    const genreBoss = g ? g.kind : 0;
    for (const z of partie.zones) {
      const total = z.ti - z.t0;
      const p = 1 - (z.ti - partie.tick - (1 - alpha)) / total;
      if (z.type === Z_BANDE) bandes.poser(metres(z.x), metres(z.y), metres(z.x2), metres(z.y2), metres(z.r), p, temps);
      else annonces.poser(metres(z.x), metres(z.y), metres(z.r), p, temps, z.type === Z_INVOCATION); // lot BR3 : l'anneau d'invocation n'est pas un danger (violet pâle, sans clignotement)
      const reste = z.ti - partie.tick;
      if (z.type === PIERRES && genreBoss !== B_CHENE && reste <= 26 && nbRochers < rochers.length) {
        // la pierre tombe pendant les 26 derniers ticks de l'annonce (le chêne, lui, fait jaillir des racines)
        const u = 1 - reste / 26;
        const r = rochers[nbRochers++]!;
        r.groupe.visible = true;
        r.groupe.position.set(metres(z.x), 0.7 + 13 * (1 - u * u), metres(z.y));
        r.groupe.rotation.set(u * 3, u * 2, 0);
      }
    }
    for (let i = nbRochers; i < rochers.length; i++) rochers[i]!.groupe.visible = false;
    for (const o2 of partie.ondes) anneaux.poser(metres(o2.x), metres(o2.y), metres(o2.r), metres(o2.epaisseur));
    for (const n of partie.nuages) {
      // il paraît à l'éclatement, reste, puis s'estompe avant sa fin ; des volutes y flottent
      const opacite = Math.max(0, Math.min(1, (partie.tick - n.t0) / 16, (n.fin - partie.tick) / 50));
      nuages.poser(metres(n.x), metres(n.y), metres(n.r), opacite, temps);
      if (!fige && now - dernierSpore > 90) {
        dernierSpore = now;
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * metres(n.r) * 0.85;
        eclats.gerbe("spore", metres(n.x) + Math.cos(a) * d, 0.3, metres(n.y) + Math.sin(a) * d, 1, { vitesse: 0.5, taille: 0.2, haut: 0.9, duree: 1.5, gravite: -0.3 });
      }
    }
    ombres.fin();

    // Les compétences (lot BR5) : la lame du tourbillon autour du chevalier, le cercle d'atterrissage du bond (cyan) dès l'accroupissement, l'onde de choc, les boucliers lancés, la traînée de la fente.
    const comp = c.etat === COMPETENCE ? c.comp : -1;
    const tc = c.t + alpha;
    lame.maj(comp === 0 && !fige, cx, cz, metres(partie.rayonTourbillon()), tc, 1 - tc / partie.dureeTourbillon());
    cerclesJoueur.debut();
    if (comp === 1) cerclesJoueur.poser(metres(c.tx), metres(c.ty), metres(partie.rayonBond()), tc / (BOND_ANNONCE + BOND_VOL));
    ondesChoc.maj(dtMonde);
    for (const l of bouclierVu.maj(partie.boucliers, temps, metres)) if (!fige) eclats.gerbe("lame", l.x, 0.95, l.z, 1, { vitesse: 0.6, taille: 0.08, haut: 0.2, duree: 0.28, gravite: 0 });
    trainee.maj(dt, cx, cz, c.fente > 0);
    // La poussée du champ de la caméra : un peu plus large en pleine course, et pendant la fente (l'élan se sent) ; elle revient doucement.
    const cibleChamp = (vitesseCourse > 0 ? vitesseCourse * 2.4 : 0) + (c.fente > 0 ? 2.2 : 0);
    rig.poussee += (cibleChamp - rig.poussee) * (1 - Math.exp(-dt * (cibleChamp > rig.poussee ? 9 : 3.5)));

    cratere.maj(dt);
    racines.maj(fige ? 0 : dt);
    arc.maj(dtMonde, cx, cz);
    traits.maj(fige ? 0 : dt);
    eclats.maj(fige ? dt * 0.15 : dt * (0.4 + 0.6 * ralenti));
    placerCamera(dt, cx, cz, g ? { x: gx, z: gz } : null);
    // Le réticule : seulement à la souris, et pas dans la vitrine.
    const visee = souris && !figee ? pointSurLeSol(camera, souris.x, souris.y) : null;
    if (visee) reticule.poser(visee.x, visee.z);
    else reticule.cacher();

    // L'interface (lot BR2 : le niveau et l'XP ; les cœurs comptent « Cœur en plus »).
    ui.coeurs(c.coeurs, c.coeursMax);
    if (niveau) ui.niveau(partie.nv, partie.xp - partie.xpSeuil(partie.nv), partie.xpSeuil(partie.nv + 1) - partie.xpSeuil(partie.nv));
    else ui.niveau(null, 0, 1);
    gemmesVue.maj(partie.gemmes, partie.tick, temps, metres);
    ui.recharge(1 - c.recharge / partie.rechargeMax(), partie.competencePrete);
    ondesEpeeVue.maj(partie.ondesEpee, metres);
    if (g && partie.golemEveille) ui.boss(Math.max(0, g.hp) / g.hpMax, g.phase, nomBoss);
    else if (partie.epreuve.etat === 1 && partie.niveau) {
      // Lot BR6 : la salle d'épreuve : la barre se vide à mesure que la vague est vaincue (le nom dit laquelle).
      const ep = partie.epreuve;
      const taille = partie.niveau.epreuve.vagues[Math.max(0, ep.vague - 1)]?.length ?? 1;
      ui.boss(ep.vague === 0 ? 1 : Math.min(1, ep.restants / taille), 0, t("epreuve.vague", { n: Math.max(1, ep.vague), total: partie.niveau.epreuve.vagues.length }));
    } else ui.boss(null, 1);
    if (niveau && partie.barriere < 0 && !partie.finie) {
      // « BOSS → 38 m » : la distance par le chemin jusqu'à l'arène, et la flèche vers le point du chemin qui vient (projeté à l'écran).
      const k = caseDe(niveau, c.x, c.y);
      const m = k >= 0 && niveau.dist[k]! !== INACCESSIBLE ? Math.round((niveau.dist[k]! * CM_PAR_CHANFREIN) / 100) : null;
      const devant = pointDevant(niveau, niveau.dist, c.x, c.y, 5);
      let angle = 0;
      if (devant) {
        const a = new Vector3(cx, 0, cz).project(camera);
        const b = new Vector3(metres(devant[0]), 0, metres(devant[1])).project(camera);
        angle = Math.atan2(-(b.y - a.y), (b.x - a.x) * camera.aspect);
      }
      ui.cible(m, angle);
    } else ui.cible(null);
    // Lot BR6 : les portes de la salle d'épreuve montent à la fermeture (24 ticks) et redescendent à la réouverture.
    const ferme = partie.epreuve.etat === 1 ? Math.min(1, (partie.tick - partie.epreuve.debut + alpha) / 24) : 0;
    decor.maj?.({ x: cx, z: cz }, camera.position, partie.barriere >= 0 ? Math.min(1, (partie.tick - partie.barriere + alpha) / 24) : 0, ferme);

    renderer.info.reset();
    rendu.dessiner();
    // Le passage automatique en basse qualité : les images par seconde (mesurées sur le temps réel entre deux images, jamais en pas à pas) sont restées sous 30 pendant une seconde et demie.
    if (!manuel && !figee && essai.qualite === null && qualite === "haute" && document.visibilityState === "visible") {
      imagesVues++;
      const reel = (now - dernierReel) / 1000;
      dernierReel = now;
      if (imagesVues > 90) {
        lenteurs = reel > 1 / 30 ? lenteurs + 1 : Math.max(0, lenteurs - 2);
        if (lenteurs > 45) appliquerQualite("basse");
      }
    } else dernierReel = now;
    if (essai.fps) {
      fpsMoy = lerp(fpsMoy, 1 / Math.max(dt, 0.001), 0.05);
      msDessin = lerp(msDessin, performance.now() - now, 0.05);
      ui.fps(`${qualite} · ${fpsMoy.toFixed(0)} i/s · ${msDessin.toFixed(1)} ms de dessin · ${renderer.info.render.calls} appels · ${renderer.info.render.triangles} triangles · ${partie.monstres.length} monstres`);
    }
  };

  // --- La porte d'essai (`?debug`) ---
  if (debug) {
    (window as unknown as { __rush: unknown }).__rush = {
      partie: () => partie,
      controles,
      forcer: (e: number, ticks: number) => {
        controles.forcee = { e, reste: ticks };
      },
      empreinte: () => partie.empreinte(),
      changements: () => changements,
      /** Lot BR2 : les choix d'amélioration faits (la rediffusion les emporte), le choix en attente (`null` : le monde tourne), la carte en surbrillance, et de quoi choisir. */
      choix: () => choixFaits,
      choixEnAttente: () => (partie.choix ? { nv: partie.choix.nv, cartes: partie.choix.cartes.map((i) => AMELIORATIONS[i]!.id) } : null),
      selection: () => selectionChoix,
      choisir: (i: number) => valider(i),
      /** Lot BR5 : le choix de la compétence au départ — en attente ?, celle qui est choisie (−1 : aucune), et de quoi la choisir. */
      attenteDepart: () => partie.attenteDepart,
      competence: () => competenceChoisie,
      choisirCompetence: (i?: number) => validerDepart(i ?? competenceDuPilote(partie.contenu.boss)),
      sons: () => sonsAvecKit.joues,
      calls: () => renderer.info.render.calls,
      /** Pose la caméra (position, point regardé) pour un gros plan ; `null` : la caméra du jeu. */
      cameraLibre: (p: [number, number, number] | null, v: [number, number, number] = [0, 0, 0]) => {
        cameraLibre = p ? { p, v } : null;
      },
      scene: () => scene,
      qualite: () => qualite,
      definirQualite: (q: Qualite) => appliquerQualite(q),
      /** Une image dessinée tout de suite (de quoi compter les appels de dessin d'une qualité). */
      dessinerMaintenant: () => dessiner(),
      redemarrer,
      /** Lot BR4 : le fantôme (`null` : aucun) — son tick, sa position (unités), son niveau, s'il se voit et l'opacité la plus forte de ses matières (il est translucide). */
      fantome: () => {
        if (!fantomeSim) return null;
        let opacite = 0;
        fantomeVu.racine.traverse((n: Object3D) => {
          const m = (n as Mesh).material as { opacity?: number; visible?: boolean } | undefined;
          if (m && n.visible && typeof m.opacity === "number") opacite = Math.max(opacite, m.opacity);
        });
        return { tick: fantomeSim.tick, x: fantomeSim.c.x, y: fantomeSim.c.y, nv: fantomeSim.nv, visible: fantomeVu.racine.visible, opacite, finie: fantomeSim.finie };
      },
      /** Le niveau du jour (grille, clairières, monstres), ou `null` dans un scénario. */
      niveau: () => partie.niveau,
      /** Pose le chevalier en (x, z) mètres (les captures : un chemin, un camp, l'entrée de l'arène) ; la caméra est reposée d'un coup. */
      aller: (x: number, z: number) => {
        partie.c.x = Math.round(x * M);
        partie.c.y = Math.round(z * M);
        pousser(sChev, partie.c.x, partie.c.y);
        pousser(sChev, partie.c.x, partie.c.y);
        rig.recommencer();
      },
      /** Pose la caméra de suivi tout de suite. */
      recadrer: () => rig.recommencer(),
      /** Un point du chemin principal à cette fraction (0 : le départ, 1 : l'arène), en mètres : on remonte le champ de distance depuis le départ. */
      pointSurLeChemin: (fraction: number): [number, number] => {
        const n = partie.niveau!;
        let idx = caseDe(n, n.depart.x, n.depart.y);
        const total = n.dist[idx]!;
        for (let i = 0; i < 5000 && n.dist[idx]! > total * (1 - fraction); i++) {
          const s = descendre(n, n.dist, idx);
          if (s < 0) break;
          idx = s;
        }
        const [x, y] = centreDeCase(n, idx);
        return [metres(x), metres(y)];
      },
      /** Un point du chemin, dehors, à `m` mètres du bord de l'arène (sur l'axe de la porte). */
      avantLArene: (m: number): [number, number] => {
        const n = partie.niveau!;
        const a = (n.arene.dir * Math.PI * 2) / 128;
        return [metres(n.arene.x) + Math.cos(a) * (R + m), metres(n.arene.y) + Math.sin(a) * (R + m)];
      },
      centreDuCamp: (i: number): [number, number] => {
        const n = partie.niveau!;
        const camps = n.clairieres.filter((c) => c.genre === "camp");
        const c = camps[i % camps.length]!;
        return [metres(c.x), metres(c.y)];
      },
      versLArene: (): number => {
        const n = partie.niveau!;
        return ((Math.trunc(((n.arene.dir + 64) % 128) / 4) % 32) + 1) | 0;
      },
      /** Pose le curseur de la souris en coordonnées d'écran de la scène (de −1 à 1) : de quoi viser dans un test. `null` : plus de souris. */
      souris: (x: number | null, y = 0) => {
        souris = x === null ? null : { x, y };
      },
      visee: () => controles.visee(),
      camera: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z, fov: camera.fov }),
      piloter: () => pilote(partie),
      /** Joue `n` ticks au plus avec le pilote de la simulation (pas à pas, sans dessin) : de quoi finir une partie entière dans un test. */
      jouerPilote: (n: number, attente = 0, strategie: Strategie = "foncer") => {
        const etatPil = etatPilote(strategie, -2, partie);
        // lot BR5 : le pilote choisit sa compétence au départ (celle qu'il joue pour le boss du jour)
        if (partie.attenteDepart) validerDepart(competenceDuPilote(partie.contenu.boss));
        // `attente` ticks immobile d'abord : une partie différente de celle du Diamant (qui serait refusée comme une copie)
        for (let i = 0; i < attente && !partie.finie; i++) {
          controles.forcee = { e: 0, reste: 1 };
          pasDeSimulation();
        }
        for (let i = 0; i < n && !partie.finie; i++) {
          // lot BR2 : le pilote fait ses choix d'amélioration (ceux de « foncer »)
          for (let garde = 0; partie.choix && ui.choixOuvert() && garde < 50; garde++) valider(choisirCarte(partie, strategie));
          controles.forcee = { e: pilote(partie, etatPil), reste: 1 };
          pasDeSimulation();
        }
      },
    };
  }

  return {
    avancer() {
      if (partie.finie || figee) return; // la vitrine est une scène figée : elle ne joue pas
      if (partie.choix || partie.attenteDepart) return; // lot BR2 : un niveau gagné fige le monde (et le chrono, qui compte les ticks) jusqu'au choix ; lot BR5 : le départ attend la compétence
      if (gel > 0) {
        gel--;
        return;
      }
      credit += ralenti;
      if (credit < 1) return;
      credit -= 1;
      pasDeSimulation();
    },
    finie() {
      if (!partie.finie || finDepuis < 0) return false;
      const attente = partie.victoire ? (reduit ? 800 : 2800) : partie.perdue ? 1400 : 0;
      return performance.now() - finDepuis >= attente;
    },
    action(id) {
      sonsAvecKit.deverrouiller();
      // Lot BR2 : pendant le choix, les flèches / ZQSD / la croix / le stick (les actions de déplacement du kit) déplacent la surbrillance, « coup » (A, J) valide la carte en surbrillance.
      if (ui.choixOuvert()) {
        if (id === "gauche" || id === "haut") deplacerSelection(-1);
        else if (id === "droite" || id === "bas") deplacerSelection(1);
        else if (id === "coup") valider(selectionChoix);
        return;
      }
      controles.action(id);
    },
    dessiner,
    hud() {
      const g = partie.golem && partie.golemEveille ? partie.golem : null;
      const principal = g ? t("hud.boss", { nom: nomBoss, pct: Math.max(0, Math.ceil((g.hp * 100) / g.hpMax)) }) : t("hud.tues", { n: partie.tues });
      return { principal, secondaire: formatTemps(Math.min(partie.tick, DUREE_TICKS), o.langue) };
    },
    resultat() {
      return { score: VARIANTE.score(partie.resultat()), rediffusion: enregistrer(contenu, changements, choixFaits, competenceChoisie) };
    },
    fantome: lireFantome,
    detruire() {
      removeEventListener("pointerdown", geste);
      removeEventListener("keydown", geste);
      removeEventListener("keydown", surTouchePendantChoix, true);
      removeEventListener("pointerup", clicHaut);
      removeEventListener("blur", clicPerdu);
      ui.zone3d.removeEventListener("pointermove", surPointeur);
      ui.zone3d.removeEventListener("pointerdown", clicBas);
      ui.zone3d.removeEventListener("contextmenu", pasDeMenu);
      decor.detruire();
      rendu.detruire();
      observateur.disconnect();
      controles.detruire();
      tune?.detruire();
      ui.detruire();
      renderer.dispose();
      renderer.forceContextLoss();
      delete (window as unknown as { __rush?: unknown }).__rush;
    },
  };
}
