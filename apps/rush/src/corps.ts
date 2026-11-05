import { AmbientLight, CanvasTexture, CircleGeometry, Color, DirectionalLight, Group, Mesh, MeshToonMaterial, NearestFilter, PerspectiveCamera, RepeatWrapping, Scene, SRGBColorSpace, TorusGeometry, WebGLRenderer, CylinderGeometry, DoubleSide, type Object3D } from "three";
import { formatDay } from "@cdj/core";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  CHAUVE,
  DUREE_TICKS,
  GELEE,
  MAX_CHANGEMENTS,
  ONDE,
  PIERRES,
  POING,
  RAYON_ARENE,
  RAYON_CHEVALIER,
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
import { eclair, piece, plat } from "./cel";
import { FICHE } from "./fiche";
import { Controles } from "./controles";
import { Annonces, Anneaux, ArcCoup, Eclats, Ombres } from "./effets";
import { lireEssai } from "./essai";
import { monterInterface } from "./interface";
import { PALETTES, ENCRE, type PaletteMonde } from "./palette";
import { SENSATIONS_DEFAUT, sensationsDe, type Sensations } from "./sensations";
import { musiqueDuKit as musique } from "./kitSon";
import { Sons, niveauEffets, type SonNom } from "./sons";
import { monterTune } from "./tune";

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
}

function textureSol(a: PaletteMonde): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const css = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
  g.fillStyle = css(a.sol);
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = css(a.sol2);
  g.fillRect(0, 0, 128, 128);
  g.fillRect(128, 128, 128, 128);
  g.strokeStyle = css(a.mur);
  g.globalAlpha = 0.18;
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 253, 253);
  g.beginPath();
  g.moveTo(128, 0);
  g.lineTo(128, 256);
  g.moveTo(0, 128);
  g.lineTo(256, 128);
  g.stroke();
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(6, 6);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
  return t;
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
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, o.tactile ? 1.5 : 2));
  renderer.setClearColor(new Color(palette.fond));
  renderer.domElement.setAttribute("aria-hidden", "true");
  ui.zone3d.append(renderer.domElement);
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 2, 1, 120);
  scene.add(new AmbientLight(palette.ambiance, palette.intensiteAmbiance));
  const soleil = new DirectionalLight(palette.lumiere, palette.intensiteLumiere);
  soleil.position.set(-6, 14, 8);
  scene.add(soleil);

  const R = metres(RAYON_ARENE);
  const sol = new Mesh(new CircleGeometry(R, 72).rotateX(-Math.PI / 2), new MeshToonMaterial({ map: textureSol(palette), color: 0xffffff }));
  scene.add(sol);
  const mur = new Mesh(new CylinderGeometry(R + 0.45, R + 0.45, 0.9, 72, 1, true), new MeshToonMaterial({ color: palette.mur, side: DoubleSide }));
  mur.position.y = 0.45;
  scene.add(mur);
  const bord = new Mesh(new TorusGeometry(R + 0.45, 0.2, 8, 72).rotateX(Math.PI / 2), plat(palette.murHaut));
  bord.position.y = 0.9;
  scene.add(bord);
  const piliers = new Group();
  for (let i = 0; i < 10; i++) {
    const p = piece(new RoundedBoxGeometry(0.95, 1.9, 0.95, 2, 0.12), palette.murHaut);
    const a = (i / 10) * Math.PI * 2 + 0.2;
    p.groupe.position.set(Math.cos(a) * (R + 0.55), 0.95, Math.sin(a) * (R + 0.55));
    p.groupe.rotation.y = -a;
    piliers.add(p.groupe);
  }
  scene.add(piliers);

  const ombres = new Ombres();
  scene.add(ombres.maillage);
  const eclats = new Eclats();
  eclats.quantite = etat.sensations.eclats / 100;
  scene.add(eclats.maillage);
  const annonces = new Annonces();
  scene.add(annonces.groupe);
  const anneaux = new Anneaux();
  scene.add(anneaux.groupe);
  const arc = new ArcCoup();
  scene.add(arc.maillage);

  const chevalier: ChevalierVu = creerChevalier();
  scene.add(chevalier.racine);
  const sChev = suivi(partie.c.x, partie.c.y);
  let yawChev = Math.PI / 2;
  const golemVu: GolemVu | null = partie.golem ? creerGolem() : null;
  if (golemVu) scene.add(golemVu.racine);
  const sGolem = suivi(partie.golem?.x ?? 0, partie.golem?.y ?? 0);
  let yawGolem = Math.PI / 2;
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
  let camX = 0;
  let camZ = 0;
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
      a = { vue, suivi: suivi(m.x, m.y), eclair: 0, yaw: 0 };
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
        son(e.a === 0 ? "coup1" : e.a === 1 ? "coup2" : "coup3");
        arc.lancer(metres(partie.c.x), metres(partie.c.y), (e.b * Math.PI * 2) / 128, metres((etat.reglages.portee * M) / 100) * (e.a === 2 ? 1.25 : 1), (Math.min(90, etat.reglages.arc + (e.a === 2 ? 30 : 0)) * Math.PI) / 180, e.a);
        break;
      case "touche": {
        const fort = e.a >= 2;
        const golem = e.b === 2;
        const base = etat.sensations.arretImage * (fort ? 1.7 : 1) * (golem ? 1.35 : 1);
        arreter(base);
        eclats.gerbe("etincelle", x, 0.9, z, golem ? 14 : 9, { vitesse: 6.5, dx: ax, dz: az, eventail: 1.1, taille: 0.1, haut: 3 });
        if (golem) eclats.gerbe("pierre", x, 1.6, z, 5, { vitesse: 4, taille: 0.14, dx: ax, dz: az });
        secouer(golem ? 0.34 : 0.2 * (fort ? 1.6 : 1), ax, az);
        son(golem ? "toucheGolem" : fort ? "toucheFort" : "touche", 1 + Math.random() * 0.15);
        for (const m of partie.monstres) if (m.flash === 7) trouverBete(m).eclair = etat.sensations.eclair;
        if (partie.golem && partie.golem.flash === 7) golemEclair = etat.sensations.eclair;
        break;
      }
      case "mort": {
        arreter(etat.sensations.arretImage * 0.8);
        const g = e.a === GELEE ? "gelee" : "chauve";
        eclats.gerbe(g, x, 0.6, z, 22, { vitesse: 6, taille: 0.16, haut: 5 });
        eclats.gerbe("etincelle", x, 0.7, z, 8, { vitesse: 7, taille: 0.09, haut: 4 });
        secouer(0.2);
        son("mort", 0.9 + Math.random() * 0.3);
        break;
      }
      case "esquive":
        son("esquive");
        eclats.gerbe("poussiere", x, 0.15, z, 8, { vitesse: 3, taille: 0.12, haut: 1.4, duree: 0.4, gravite: 5 });
        break;
      case "frole":
        son("frole");
        ralentir(0.45, 260);
        eclats.gerbe("etincelle", x, 0.9, z, 14, { vitesse: 5, taille: 0.08, haut: 2.5 });
        break;
      case "degats":
        arreter(100);
        secouer(0.75, ax, az);
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
        eclats.gerbe("poussiere", x, 0.2, z, poing ? 26 : 16, { vitesse: poing ? 7 : 5, taille: poing ? 0.22 : 0.18, haut: 3, duree: 0.7, gravite: 7 });
        eclats.gerbe("pierre", x, 0.3, z, poing ? 12 : 8, { vitesse: 6, taille: 0.15, haut: 6 });
        secouer(poing ? 0.7 : 0.45);
        son(poing ? "impact" : "pierre");
        arreter(poing ? 60 : 35);
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
        arreter(220);
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
    camera.aspect = l / h;
    camera.updateProjectionMatrix();
  };
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(ui.zone3d);
  redimensionner();

  const ELEVATION = (60 * Math.PI) / 180; // la caméra regarde le sol depuis 60° : haute, comme la maquette
  const facteurHauteur = Math.sin(ELEVATION);
  const placerCamera = (dt: number, cx: number, cz: number, golemX: number, golemZ: number): void => {
    // Le cadre suit le chevalier en regardant un peu vers le golem ; l'arène reste dans l'image.
    const but = { x: cx + (golemX - cx) * 0.45, z: cz + (golemZ - cz) * 0.45 - 0.9 };
    const reste = R - 2.5;
    const n = Math.hypot(but.x, but.z);
    if (n > reste) {
      but.x *= reste / n;
      but.z *= reste / n;
    }
    const k = 1 - Math.exp(-dt * 7);
    camX = lerp(camX, but.x, k);
    camZ = lerp(camZ, but.z, k);
    const aspect = camera.aspect;
    const vue = Math.max(etat.sensations.vue, 13 / aspect);
    const dist = (vue * facteurHauteur) / 2 / Math.tan((camera.fov * Math.PI) / 360);
    const el = ELEVATION;
    let sx = 0;
    let sz = 0;
    if (trauma > 0) {
      const a = trauma * trauma * 0.55;
      sx = (Math.sin(temps * 91.7) + Math.sin(temps * 53.3)) * 0.5 * a + kickX;
      sz = (Math.sin(temps * 77.1 + 1) + Math.sin(temps * 61.9)) * 0.5 * a + kickZ;
    }
    camera.position.set(camX + sx, Math.sin(el) * dist, camZ + Math.cos(el) * dist + sz);
    camera.lookAt(camX + sx * 0.4, 0, camZ + sz * 0.4);
  };

  const yawVers = (actuel: number, but: number, dt: number, vitesse: number): number => {
    let d = mod(but - actuel + Math.PI, Math.PI * 2) - Math.PI;
    d *= 1 - Math.exp(-dt * vitesse);
    return actuel + d;
  };

  let msDessin = 0;
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

    // Le fantôme.
    if (fantomeSim) {
      const fx = metres(lerp(sFantome.x0, sFantome.x1, alpha));
      const fz = metres(lerp(sFantome.y0, sFantome.y1, alpha));
      fantomeVu.racine.position.set(fx, 0, fz);
      fantomeVu.racine.rotation.y = Math.atan2(Math.cos((fantomeSim.c.dir * Math.PI * 2) / 128), Math.sin((fantomeSim.c.dir * Math.PI * 2) / 128));
      animerChevalier(fantomeVu, fantomeSim.c, { dt: dtMonde, temps, duree: fantomeSim.dureeCoup(fantomeSim.c.combo), impact: fantomeSim.impactCoup(fantomeSim.c.combo), cache: false });
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
      yawGolem = yawVers(yawGolem, Math.atan2(dx, dz), dt, g.etat === 1 ? 2 : 4);
      golemVu.racine.rotation.y = yawGolem;
      const deplace = Math.hypot(sGolem.x1 - sGolem.x0, sGolem.y1 - sGolem.y0) > 20;
      animerGolem(golemVu, g, { dt: dtMonde, temps, t: g.t, vivant: g.hp > 0, mort: finDepuis >= 0 && g.hp <= 0 ? (now - finDepuis) / PAS_MS : 0, marche: deplace });
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
      if (m.type === GELEE) animerGelee(a.vue, m, temps, partie.tick);
      else animerChauve(a.vue, m, temps, partie.tick);
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

    arc.maj(dtMonde, cx, cz);
    eclats.maj(fige ? dt * 0.15 : dt * (0.4 + 0.6 * ralenti));
    placerCamera(dt, cx, cz, g ? gx : cx, g ? gz : cz);

    // L'interface.
    ui.coeurs(c.coeurs);
    if (g) ui.boss(Math.max(0, g.hp) / g.hpMax, g.phase === 2);
    else ui.boss(null, false);

    renderer.render(scene, camera);
    if (essai.fps) {
      fpsMoy = lerp(fpsMoy, 1 / Math.max(dt, 0.001), 0.05);
      msDessin = lerp(msDessin, performance.now() - now, 0.05);
      ui.fps(`${fpsMoy.toFixed(0)} i/s · ${msDessin.toFixed(1)} ms de dessin · ${renderer.info.render.calls} appels · ${renderer.info.render.triangles} triangles · ${partie.monstres.length} monstres`);
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
      redemarrer,
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
      if (partie.finie) return;
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
