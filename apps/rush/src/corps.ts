import { Color, DirectionalLight, Fog, Group, HemisphereLight, Mesh, MeshToonMaterial, PCFShadowMap, Scene, WebGLRenderer, type Material, type Object3D } from "three";
import { formatDay } from "@cdj/core";
import {
  CHAUVE,
  DUREE_TICKS,
  GELEE,
  MARCHE,
  MAX_CHANGEMENTS,
  ONDE,
  PIERRES,
  POING,
  RAYON_ARENE,
  RAYON_GOLEM,
  REGLAGES_DEFAUT,
  RUSH_GENERATOR_VERSION,
  TICKS_PAR_SECONDE,
  VARIANTE,
  M,
  Partie,
  contenuScenario,
  dailyRush,
  decoderRediffusion,
  enregistrer,
  formatTemps,
  lireJourFige,
  pilote,
  seuilsDe,
  touchesDuBot,
  type Changement,
  type Contenu,
  type Evenement,
  type Monstre,
  type Reglages,
  type Seuils,
} from "@cdj/rush-sim";
import { dateDemandable, lireFichierDeJour } from "@cdj/kit/jour";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import { commandesDuJeu } from "@cdj/kit/jeu/commandes";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import {
  animerChauve,
  animerChevalier,
  animerGelee,
  animerGolem,
  creerChauve,
  creerChevalier,
  creerGelee,
  creerGolem,
  creerRocher,
  type BeteVue,
  type ChevalierVu,
  type GolemVu,
} from "./acteurs";
import { CameraRush, type PointCadre } from "./camera";
import { eclair } from "./cel";
import { monterDecor } from "./decor";
import { FICHE } from "./fiche";
import { Controles } from "./controles";
import { Annonces, Anneaux, ArcCoup, Cratere, Eclats, Ombres, Reticule, Traits } from "./effets";
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

/** Le contenu d'un jour : un scénario d'essai de l'adresse, sinon le fichier figé s'il existe (`jours/AAAA-MM-JJ.json`) et se relit, sinon le générateur courant. */
export async function contenuDuJour(jour: number, base: string): Promise<Contenu> {
  const essai = lireEssai(location.search, BUILD_RESTRICTED);
  if (essai.scenario !== null && essai.scenario !== "jour") return contenuScenario(essai.scenario, { phase2: essai.phase2, monstres: essai.monstres, jour });
  const date = formatDay(jour);
  if (dateDemandable(date, import.meta.env.VITE_PRODUCTION === "1", JOURS_FIGES)) {
    try {
      const lu = lireJourFige(await lireFichierDeJour("jours", date, base, 4000));
      if (lu) return lu;
    } catch {
      /* absent ou abîmé : le générateur */
    }
  }
  return dailyRush(jour, RUSH_GENERATOR_VERSION);
}

export const seuilsDeRush = (c: Contenu): Seuils => seuilsDe(c);
export const rediffusionDiamantRush = (c: Contenu): string => enregistrer(c, touchesDuBot(c));

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
  vue: BeteVue;
  suivi: Suivi;
  eclair: number;
  yaw: number;
  /** L'écrasement sous un coup, de 0 (juste touché) à 1 (fini), et son amplitude. */
  ecrase: number;
  force: number;
}

export function nouvellePartieRush(contenu: Contenu, hote: HTMLElement, o: OptionsPartie): PartieDuJeu {
  const essai = lireEssai(location.search, BUILD_RESTRICTED);
  const manuel = new URLSearchParams(location.search).has("manuel");
  const debug = !BUILD_RESTRICTED && new URLSearchParams(location.search).has("debug");
  const t = o.t;
  const palette = PALETTES[o.theme] ?? PALETTES.clair!;
  const etat = { reglages: (essai.reglages ?? REGLAGES_DEFAUT) as Reglages, sensations: sensationsDe(essai.sensations) as Sensations };
  let lecteur: { reglages(): { volume: number; coupee: boolean } } | null = null;
  void musique()?.lecteur().then((l) => (lecteur = l as unknown as typeof lecteur), () => undefined);
  const sonsAvecKit = new Sons(() => (lecteur ? niveauEffets(lecteur.reglages().volume, lecteur.reglages().coupee) : 0.8));
  sonsAvecKit.deverrouiller(); // le clic sur « Jouer » vient d'avoir lieu : le contexte audio démarre tout de suite
  const geste = (): void => sonsAvecKit.deverrouiller();
  addEventListener("pointerdown", geste);
  addEventListener("keydown", geste);
  const son = (n: SonNom, h = 1): void => sonsAvecKit.jouer(n, h);

  const figee = contenu.scenario === "vitrine";

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
  let changements: Changement[] = [];
  let derniere = 0;
  let fantomeSim: Partie | null = null;
  let fantomeChangements: Changement[] = [];
  let fantomeIndex = 0;
  let fantomeEntree = 0;

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
  cs.left = -15;
  cs.right = 15;
  cs.top = 15;
  cs.bottom = -15;
  cs.near = 2;
  cs.far = 50;
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
  const decor = monterDecor(R, palette);
  scene.background = decor.ciel;
  scene.add(decor.groupe);

  const ombres = new Ombres(); // les ombres en disques : la basse qualité (en haute, de vraies ombres portées)
  scene.add(ombres.maillage);
  const cratere = new Cratere();
  scene.add(cratere.groupe);
  const eclats = new Eclats();
  eclats.quantite = etat.sensations.eclats / 100;
  scene.add(eclats.maillage);
  const annonces = new Annonces();
  scene.add(annonces.groupe);
  const anneaux = new Anneaux();
  scene.add(anneaux.groupe);
  const arc = new ArcCoup();
  scene.add(arc.maillage);
  const traits = new Traits();
  scene.add(traits.maillage);
  const reticule = new Reticule();
  scene.add(reticule.maillage);

  const chevalier: ChevalierVu = creerChevalier();
  scene.add(chevalier.racine);
  const sChev = suivi(partie.c.x, partie.c.y);
  let yawChev = Math.atan2(Math.cos((partie.c.dir * Math.PI * 2) / 128), Math.sin((partie.c.dir * Math.PI * 2) / 128));
  const golemVu: GolemVu | null = partie.golem ? creerGolem() : null;
  if (golemVu) scene.add(golemVu.racine);
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
  const reserve: Record<number, BeteVue[]> = { [GELEE]: [], [CHAUVE]: [] };
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
      const vue = reserve[m.type]!.pop() ?? (m.type === GELEE ? creerGelee() : creerChauve());
      vue.racine.userData.type = m.type;
      vue.aleatoire = (m.id * 0.37) % 7;
      vue.racine.visible = true;
      scene.add(vue.racine);
      a = { vue, suivi: suivi(m.x, m.y), eclair: 0, yaw: 0, ecrase: 1, force: 0 };
      bêtes.set(m.id, a);
    }
    return a;
  };

  const rendre = (a: ActeurBete): void => {
    a.vue.racine.visible = false;
    a.vue.racine.removeFromParent();
    reserve[a.vue.racine.userData.type as number]?.push(a.vue);
  };

  const direction = (dx: number, dz: number): [number, number] => {
    const n = Math.hypot(dx, dz) || 1;
    return [dx / n, dz / n];
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
        arc.lancer(metres(partie.c.x), metres(partie.c.y), (e.b * Math.PI * 2) / 128, metres((etat.reglages.portee * M) / 100) * (e.a === 2 ? 1.25 : 1), (Math.min(90, etat.reglages.arc + (e.a === 2 ? 30 : 0)) * Math.PI) / 180, e.a, partie.impactCoup(e.a));
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
        const g = e.a === GELEE ? "gelee" : "chauve";
        eclats.gerbe(g, x, 0.6, z, 22, { vitesse: 6, taille: 0.16, haut: 5 });
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
        const poing = e.a === POING;
        eclats.gerbe("poussiere", x, 0.2, z, poing ? 44 : 24, { vitesse: poing ? 7.5 : 5, taille: poing ? 0.32 : 0.24, haut: 3.4, duree: 0.95, gravite: 5 });
        eclats.gerbe("pierre", x, 0.3, z, poing ? 22 : 10, { vitesse: 7, taille: 0.2, haut: 7.5, duree: 1.0 });
        secouer(poing ? 0.7 : 0.45);
        son(poing ? "impact" : "pierre");
        cratere.poser(x, z, metres(e.b) * (poing ? 0.62 : 0.8) + 0.15, poing ? 6 : 4);
        eclats.gerbe("poussiere", x, 0.25, z, poing ? 20 : 8, { vitesse: poing ? 11 : 6, taille: 0.2, haut: 1.2, duree: 1.0, gravite: 1.5 });
        break;
      }
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
        eclats.gerbe(e.a === GELEE ? "gelee" : "chauve", x, 0.4, z, 7, { vitesse: 3, taille: 0.12, haut: 2.5, duree: 0.45 });
        break;
      case "bloque":
        son("bloque");
        eclats.gerbe("etincelle", x, 2.4, z, 6, { vitesse: 5, taille: 0.08 });
        break;
      case "sauve":
        eclats.gerbe("etincelle", x, 1, z, 30, { vitesse: 6, taille: 0.1, haut: 5 });
        break;
    }
  };
  let golemEclair = 0;
  let golemSursaut = 0;

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
    partie.avancer(e);
    if (fantomeSim && !fantomeSim.finie) {
      while (fantomeIndex < fantomeChangements.length && fantomeChangements[fantomeIndex]!.tick <= fantomeSim.tick) fantomeEntree = fantomeChangements[fantomeIndex++]!.e;
      fantomeSim.avancer(fantomeEntree);
    }
    pousser(sChev, partie.c.x, partie.c.y);
    if (partie.golem) pousser(sGolem, partie.golem.x, partie.golem.y);
    if (fantomeSim) pousser(sFantome, fantomeSim.c.x, fantomeSim.c.y);
    for (const m of partie.monstres) pousser(trouverBete(m).suivi, m.x, m.y);
    ticksDepuisDessin++;
    dernierTick = performance.now();
    for (const ev of partie.evenements) traiter(ev);
    partie.vider();
    if (partie.finie && finDepuis < 0) finDepuis = performance.now();
  };

  const redemarrer = (): void => {
    partie = new Partie(contenu, etat.reglages, true);
    changements = [];
    derniere = 0;
    for (const a of bêtes.values()) rendre(a);
    bêtes.clear();
    pousser(sChev, partie.c.x, partie.c.y);
    pousser(sChev, partie.c.x, partie.c.y);
    finDepuis = -1;
    gel = 0;
    rig.recommencer();
  };

  // --- Le tune ---
  const tune = essai.tune ? monterTune(ui.racine, t, etat, (r) => { etat.reglages = r; redemarrer(); }, (s) => { etat.sensations = s; eclats.quantite = s.eclats / 100; }) : null;

  // --- Le fantôme ---
  const lireFantome = (r: string | null): void => {
    fantomeSim = null;
    fantomeChangements = [];
    fantomeIndex = 0;
    fantomeEntree = 0;
    fantomeVu.racine.visible = false;
    if (!r) return;
    try {
      const d = decoderRediffusion(r);
      if (!("jour" in d.contenu) || contenu.scenario !== "jour") return;
      fantomeChangements = d.changements;
      fantomeSim = new Partie(contenu, REGLAGES_DEFAUT, false);
      while (fantomeSim.tick < partie.tick && !fantomeSim.finie) {
        while (fantomeIndex < fantomeChangements.length && fantomeChangements[fantomeIndex]!.tick <= fantomeSim.tick) fantomeEntree = fantomeChangements[fantomeIndex++]!.e;
        fantomeSim.avancer(fantomeEntree);
      }
      sFantome.x0 = sFantome.x1 = fantomeSim.c.x;
      sFantome.y0 = sFantome.y1 = fantomeSim.c.y;
      fantomeVu.racine.visible = true;
    } catch {
      fantomeSim = null;
    }
  };
  lireFantome(o.fantome);

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
  };
  const clicHaut = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && e.button === 0) controles.boutonSouris = false;
  };
  const clicPerdu = (): void => {
    controles.boutonSouris = false;
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
    if (golem) garder.push({ x: golem.x, z: golem.z, haut: 5.1, r: 3.0 }); // la tête et les épaules, les bras écartés ; le poing levé de l'annonce peut sortir par le haut
    for (const z of partie.zones) if (z.type === POING) garder.push({ x: metres(z.x), z: metres(z.y), r: metres(z.r) }); // le coup de poing ; les pierres tombent près du chevalier, l'onde part du golem
    if (figee) rig.recommencer(); // la vitrine est figée : la caméra est posée d'un coup, sans amorti
    rig.maj(dt, etat.sensations, camera.aspect, cx, cz, golem, garder, { x: sx, z: sz });
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
  const dessiner = (): void => {
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
    });
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
      eclats.gerbe("poussiere", cx + Math.cos(arriere) * 0.25, 0.1, cz + Math.sin(arriere) * 0.25, 2, { vitesse: 1.2, taille: 0.09, haut: 0.7, duree: 0.35, gravite: 3 });
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

    // Le golem.
    let gx = 0;
    let gz = 0;
    const g = partie.golem;
    if (g && golemVu) {
      gx = metres(lerp(sGolem.x0, sGolem.x1, alpha));
      gz = metres(lerp(sGolem.y0, sGolem.y1, alpha));
      golemVu.racine.position.set(gx, 0, gz);
      const dx = c.x - g.x;
      const dz = c.y - g.y;
      // La vitrine fige le golem de face (à peine tourné vers la droite) : la composition de la cible ; en partie, il se tourne vers le chevalier.
      yawGolem = figee ? 0.1 : yawVers(yawGolem, Math.atan2(dx, dz), dt, g.etat === 1 ? 2 : 4);
      golemVu.racine.rotation.y = yawGolem;
      const deplace = Math.hypot(sGolem.x1 - sGolem.x0, sGolem.y1 - sGolem.y0) > 20;
      golemSursaut = Math.max(0, golemSursaut - dtMonde * 7);
      animerGolem(golemVu, figee ? { ...g, etat: MARCHE } : g, { dt: dtMonde, temps, t: g.t, vivant: g.hp > 0, mort: finDepuis >= 0 && g.hp <= 0 ? (now - finDepuis) / PAS_MS : 0, marche: deplace, sursaut: golemSursaut });
      if (golemEclair > 0) golemEclair -= dt * 60;
      eclair(golemVu.matieres, golemEclair > 0 ? 0.85 : 0);
      ombres.poser(gx, gz, metres(RAYON_GOLEM) * 1.15);
    }

    // Les monstres.
    const vus = new Set<number>();
    for (const m of partie.monstres) {
      const a = trouverBete(m);
      vus.add(m.id);
      const mx = metres(lerp(a.suivi.x0, a.suivi.x1, alpha));
      const mz = metres(lerp(a.suivi.y0, a.suivi.y1, alpha));
      a.vue.racine.position.set(mx, 0, mz);
      const vers = m.type === GELEE && (m.cx !== 0 || m.cy !== 0) ? Math.atan2(m.cx, m.cy) : Math.atan2(c.x - m.x, c.y - m.y);
      a.yaw = yawVers(a.yaw, vers, dt, 12);
      a.vue.racine.rotation.y = a.yaw;
      if (m.type === GELEE) animerGelee(a.vue, m, temps, partie.tick, partie.durees);
      else animerChauve(a.vue, m, temps, partie.tick, partie.durees);
      if (a.ecrase < 1) {
        // L'écrasement sous un coup : la cible s'aplatit puis rebondit (un ressort amorti), en un quart de seconde.
        a.ecrase = Math.min(1, a.ecrase + dtMonde * 4.2);
        const q = Math.exp(-5.5 * a.ecrase) * Math.cos(a.ecrase * 10) * 0.42 * a.force;
        a.vue.corps.scale.multiply(a.vue.corps.scale.clone().set(1 + q * 0.55, 1 - q, 1 + q * 0.55));
      }
      if (a.eclair > 0) a.eclair -= dt * 60;
      eclair(a.vue.matieres, a.eclair > 0 ? 0.9 : 0);
      const haut = m.type === CHAUVE ? 0.9 : 0;
      ombres.poser(mx, mz, m.type === GELEE ? 0.62 : 0.38, haut);
    }
    for (const [id, a] of bêtes) {
      if (vus.has(id)) continue;
      rendre(a);
      bêtes.delete(id);
    }

    // Les cercles annoncés, les ondes, les pierres qui tombent.
    annonces.debut();
    anneaux.debut();
    let nbRochers = 0;
    for (const z of partie.zones) {
      const total = z.ti - z.t0;
      const p = 1 - (z.ti - partie.tick - (1 - alpha)) / total;
      annonces.poser(metres(z.x), metres(z.y), metres(z.r), p, temps);
      const reste = z.ti - partie.tick;
      if (z.type === PIERRES && reste <= 26 && nbRochers < rochers.length) {
        // la pierre tombe pendant les 26 derniers ticks de l'annonce
        const u = 1 - reste / 26;
        const r = rochers[nbRochers++]!;
        r.groupe.visible = true;
        r.groupe.position.set(metres(z.x), 0.7 + 13 * (1 - u * u), metres(z.y));
        r.groupe.rotation.set(u * 3, u * 2, 0);
      }
    }
    for (let i = nbRochers; i < rochers.length; i++) rochers[i]!.groupe.visible = false;
    for (const o2 of partie.ondes) anneaux.poser(metres(o2.x), metres(o2.y), metres(o2.r), metres(o2.epaisseur));
    ombres.fin();

    cratere.maj(dt);
    arc.maj(dtMonde, cx, cz);
    traits.maj(fige ? 0 : dt);
    eclats.maj(fige ? dt * 0.15 : dt * (0.4 + 0.6 * ralenti));
    placerCamera(dt, cx, cz, g ? { x: gx, z: gz } : null);
    // Le réticule : seulement à la souris, et pas dans la vitrine.
    const visee = souris && !figee ? pointSurLeSol(camera, souris.x, souris.y) : null;
    if (visee) reticule.poser(visee.x, visee.z);
    else reticule.cacher();

    // L'interface.
    ui.coeurs(c.coeurs);
    if (g) ui.boss(Math.max(0, g.hp) / g.hpMax, g.phase);
    else ui.boss(null, 1);

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
      /** Pose le curseur de la souris en coordonnées d'écran de la scène (de −1 à 1) : de quoi viser dans un test. `null` : plus de souris. */
      souris: (x: number | null, y = 0) => {
        souris = x === null ? null : { x, y };
      },
      visee: () => controles.visee(),
      camera: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z, fov: camera.fov }),
      piloter: () => pilote(partie),
      /** Joue `n` ticks au plus avec le pilote de la simulation (pas à pas, sans dessin) : de quoi finir une partie entière dans un test. */
      jouerPilote: (n: number, attente = 0) => {
        // `attente` ticks immobile d'abord : une partie différente de celle du Diamant (qui serait refusée comme une copie)
        for (let i = 0; i < attente && !partie.finie; i++) {
          controles.forcee = { e: 0, reste: 1 };
          pasDeSimulation();
        }
        for (let i = 0; i < n && !partie.finie; i++) {
          controles.forcee = { e: pilote(partie), reste: 1 };
          pasDeSimulation();
        }
      },
    };
  }

  return {
    avancer() {
      if (partie.finie || figee) return; // la vitrine est une scène figée : elle ne joue pas
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
      controles.action(id);
    },
    dessiner,
    hud() {
      const g = partie.golem;
      const principal = g ? t("hud.golem", { pct: Math.max(0, Math.ceil((g.hp * 100) / g.hpMax)) }) : t("hud.tues", { n: partie.tues });
      return { principal, secondaire: formatTemps(Math.min(partie.tick, DUREE_TICKS), o.langue) };
    },
    resultat() {
      return { score: VARIANTE.score(partie.resultat()), rediffusion: enregistrer(contenu, changements) };
    },
    fantome: lireFantome,
    detruire() {
      removeEventListener("pointerdown", geste);
      removeEventListener("keydown", geste);
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
