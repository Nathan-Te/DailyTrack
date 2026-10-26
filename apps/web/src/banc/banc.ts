// Lot 50 — **le banc d'essai du rendu** (`/track/?banc`, recette et aperçus seulement : `main.ts` ne le charge jamais en production). Chargé à la demande, il prend
// la page : le jeu ne démarre pas (aucune course, rien d'enregistré, rien envoyé). La voiture roule au pilote automatique sur le même bout de circuit (le circuit
// du `BANC_JOUR`, de 2 s à 5,2 s de course) sur trois thèmes (Stade, Nuit, Ville), en caméra de poursuite, et chaque configuration est mesurée quelques secondes
// (`bancLogique.ts` : la liste, les statistiques, le rapport). Deux moteurs de rendu l'un après l'autre : avec le multi-échantillonnage de l'écran (le jeu
// jusqu'ici), puis sans (la chaîne du lot 50). Le temps de chaque passe sur la carte graphique vient de `EXT_disjoint_timer_query_webgl2` quand le navigateur
// l'offre. Outil interne en français, exempté du test des chaînes en dur (`packages/ui/test/applications.ts`).
import { NeutralToneMapping, PerspectiveCamera, Vector2, WebGLRenderer, type Object3D } from "three";
import { TICK_RATE, bestPilotRun, createRace, dailyCircuit, parseDay, stepRace, ReplayPlayer, type PaletteName, type Track } from "@cdj/sim";
import type { Appareil } from "../qualite";
import { ChainePost, type ChronoPasses } from "../scene/post";
import { ChainePost as ChainePost47, parcourirMateriaux } from "../scene/post47";
import { POST_3 } from "../scene/themesPost";
import type { TrackScene } from "../trackMesh";
import { BANC_DEBUT_S, BANC_JOUR, DUREES, VERSION_RAPPORT, configurations, plan, rapportValide, resumer, type ConfigBanc, type EnteteBanc, type MesureBanc, type ModeBanc, type RapportBanc, type ThemeBanc } from "./bancLogique";

/**
 * Ce que le jeu prête au banc : les modules du premier chargement (`main.ts` les a déjà). Les importer d'ici les ferait sortir du morceau principal en petits
 * morceaux partagés (mesuré : +1,3 ko au premier chargement d'un joueur) ; le banc n'importe que ce qui est à la demande.
 */
export interface OutilsBanc {
  cameras: typeof import("../cameras").CAMERAS;
  t: typeof import("../i18n").t;
  lireQualite(): string | null;
  flatRatio: typeof import("../speedFeel").flatRatio;
  qualite: Pick<typeof import("../qualite"), "lireMemoire" | "palierAuChargement" | "passesPermises">;
  socle: Pick<typeof import("../scene/socle"), "PAS_DU_JEU" | "chargerPas" | "composer" | "pasVoulus">;
  decor: Pick<typeof import("../scene/decor"), "chargerDecor" | "decorPret">;
  /** La voiture du jeu (la civile, couleur et motif par défaut). */
  voiture(): Object3D;
}

/** Ce que le banc montre aux essais (`window.__banc`) : son état et son rapport. */
interface EtatBanc {
  etat: "attente" | "preparation" | "mesure" | "fini" | "erreur";
  pas: number;
  total: number;
  rapport: RapportBanc | null;
  valide: boolean;
  erreur: string | null;
}

type Ext = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };

/** Le minuteur de la carte graphique : une requête par passe et par image ; les résultats arrivent quelques images plus tard. */
class Chrono implements ChronoPasses {
  private readonly gl: WebGL2RenderingContext;
  private readonly ext: Ext | null;
  private image: { nom: string; q: WebGLQuery }[] = [];
  private enAttente: { nom: string; q: WebGLQuery }[][] = [];
  private libres: WebGLQuery[] = [];
  private active = false;
  /** Les images dont toutes les passes sont revenues : durée (ms) par passe. */
  resultats: Record<string, number>[] = [];
  enregistrer = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as Ext | null;
  }
  get disponible(): boolean {
    return !!this.ext;
  }
  debut(nom: string) {
    if (!this.ext || this.active) return;
    const q = this.libres.pop() ?? this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = true;
    this.image.push({ nom, q });
  }
  fin() {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.active = false;
  }
  /** Fin d'une image : ses requêtes partent en attente ; on relève celles qui sont revenues. */
  finImage() {
    if (!this.ext) return;
    if (this.image.length) this.enAttente.push(this.image);
    this.image = [];
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    while (this.enAttente.length) {
      const img = this.enAttente[0]!;
      if (!gl.getQueryParameter(img[img.length - 1]!.q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.enAttente.shift();
      const r: Record<string, number> = {};
      for (const { nom, q } of img) {
        r[nom] = (r[nom] ?? 0) + (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6;
        this.libres.push(q);
      }
      if (this.enregistrer && !disjoint) this.resultats.push(r);
    }
  }
  vider() {
    this.resultats = [];
  }
}

/** La trajectoire de la voiture sur le bout de circuit : un état par pas de simulation. */
interface Trajectoire {
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  yaw: Float64Array;
  v: Float64Array;
}

function trajectoire(track: Track, secondes: number): Trajectoire {
  const run = bestPilotRun(track, { cut: false });
  if (!run) throw new Error("le pilote automatique ne finit pas le circuit du banc");
  const p = new ReplayPlayer(run.replay);
  const race = createRace(track);
  const debut = Math.round(BANC_DEBUT_S * TICK_RATE);
  const n = Math.ceil(secondes * TICK_RATE) + 2;
  const tr: Trajectoire = { x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n), yaw: new Float64Array(n), v: new Float64Array(n) };
  for (let i = 0; i < debut + n; i++) {
    stepRace(race, p.done ? { steer: 0, throttle: 0, brake: 0, respawn: 0 } : p.next());
    const k = i - debut;
    if (k < 0) continue;
    const c = race.car;
    tr.x[k] = c.x;
    tr.y[k] = c.y;
    tr.z[k] = c.z;
    tr.yaw[k] = c.yaw;
    tr.v[k] = Math.hypot(c.vx, c.vz);
  }
  return tr;
}

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function ajouter<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, texte = ""): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (texte) el.textContent = texte;
  parent.append(el);
  return el;
}

function styleBouton(b: HTMLButtonElement) {
  Object.assign(b.style, { font: "600 16px/1 system-ui, sans-serif", padding: "10px 16px", margin: "8px 0", color: "#2a1e16", background: "#fff6e0", border: "0", borderRadius: "6px", cursor: "pointer" });
}

/** Ce que la règle de qualité sait de l'appareil (comme `main.ts`). */
function appareilDe(gl: WebGL2RenderingContext, nom: string): Appareil {
  return {
    ordinateur: matchMedia("(pointer: fine)").matches && Math.max(screen.width, screen.height) >= 1024,
    logiciel: navigator.webdriver || /swiftshader|llvmpipe|softpipe|lavapipe|software/i.test(nom),
    demiFlottants: !!(gl.getExtension("EXT_color_buffer_half_float") || gl.getExtension("EXT_color_buffer_float")),
    memoire: (navigator as { deviceMemory?: number }).deviceMemory,
  };
}

function nomCarte(gl: WebGL2RenderingContext): string {
  let nom = String(gl.getParameter(gl.RENDERER));
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  if (info) nom = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  return nom;
}

/** Lance le banc dans `racine` (la page du jeu, vidée de son interface). `mode` : `court` pour les essais (e2e, rendu logiciel). */
export async function lancerBanc(racine: HTMLElement, mode: ModeBanc, o: OutilsBanc): Promise<void> {
  const etat: EtatBanc = { etat: "attente", pas: 0, total: 0, rapport: null, valide: false, erreur: null };
  (window as unknown as { __banc: EtatBanc }).__banc = etat;
  for (const el of Array.from(racine.children)) (el as HTMLElement).hidden = true;
  const page = ajouter(racine, "div");
  page.id = "banc";
  Object.assign(page.style, { position: "fixed", inset: "0", overflow: "auto", padding: "16px", background: "#2a1e16", color: "#fff6e0", font: "14px/1.4 system-ui, sans-serif", zIndex: "60" });
  ajouter(page, "h1", "Banc d'essai du rendu (lot 50)");
  ajouter(
    page,
    "p",
    "La voiture roule au pilote automatique sur le même bout de circuit, sur trois thèmes, et chaque configuration est mesurée quelques secondes (≈ 2 min en tout). Mettez le navigateur en plein écran, branchez le portable et ne touchez à rien pendant la mesure. Aucune course n'est classée, rien n'est enregistré.",
  );
  const bouton = ajouter(page, "button", "Lancer le banc (plein écran)");
  bouton.type = "button";
  styleBouton(bouton);
  const sortie = ajouter(page, "div");

  const demarrer = async () => {
    bouton.hidden = true;
    if (mode === "normal") await document.documentElement.requestFullscreen?.().catch(() => undefined);
    try {
      await executer(racine, page, sortie, etat, mode, o);
    } catch (e) {
      etat.etat = "erreur";
      etat.erreur = String((e as Error)?.message ?? e);
      page.hidden = false;
      ajouter(sortie, "p", `Erreur : ${etat.erreur}`);
    }
  };
  bouton.addEventListener("click", () => void demarrer());
  if (mode === "court") void demarrer();
}

async function executer(racine: HTMLElement, page: HTMLElement, sortie: HTMLElement, etat: EtatBanc, mode: ModeBanc, o: OutilsBanc) {
  const { PAS_DU_JEU, chargerPas, composer, pasVoulus } = o.socle;
  const { chargerDecor, decorPret } = o.decor;
  const { frequenceEcran } = await import("../qualiteMesure");
  const debutBanc = performance.now();
  const durees = DUREES[mode];
  etat.etat = "preparation";
  // Les modules des paliers (comme `main.ts`) et le circuit du banc.
  PAS_DU_JEU.finition = () => import("../scene/finitionJeu");
  PAS_DU_JEU.vie = () => import("../scene/vieJeu");
  PAS_DU_JEU.ciel = () => import("../scene/cielJeu");
  PAS_DU_JEU.ombres = () => import("../scene/ombres3");
  await chargerPas(pasVoulus("P3", ["vie", "ciel"]));
  const jour = parseDay(BANC_JOUR)!;
  const circuit = dailyCircuit(jour);
  const track = circuit.track;
  const tr = trajectoire(track, (durees.chauffe + durees.mesure) / 1000 + 0.5);
  for (const th of ["stade", "nuit", "ville"] as const) await chargerDecor(th).catch(() => undefined);

  const dpr = window.devicePixelRatio || 1;
  const configs = configurations(dpr, mode, Math.round(innerWidth * innerHeight * Math.min(dpr, 2) ** 2));
  const passages = plan(configs);
  etat.total = passages.length;
  const mesures: MesureBanc[] = [];
  let entete: EnteteBanc | null = null;
  const toutesIntervalles: number[] = [];

  const progres = ajouter(racine, "div");
  Object.assign(progres.style, { position: "fixed", left: "8px", bottom: "8px", zIndex: "61", padding: "2px 6px", background: "rgba(42,30,22,.72)", color: "#fff6e0", font: "600 12px/1.3 monospace", pointerEvents: "none" });

  page.hidden = true;
  for (const ecran of ["msaa", "sans"] as const) {
    const aFaire = passages.filter((p) => p.config.ecran === ecran);
    if (aFaire.length === 0) continue;
    const renderer = new WebGLRenderer({ antialias: ecran === "msaa", powerPreference: "high-performance" });
    renderer.toneMapping = NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    racine.append(renderer.domElement);
    Object.assign(renderer.domElement.style, { position: "fixed", inset: "0", zIndex: "59" });
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const chrono = new Chrono(gl);
    if (!entete) {
      const nom = nomCarte(gl);
      const app = appareilDe(gl, nom);
      let memoire = null;
      try {
        memoire = o.qualite.lireMemoire(o.lireQualite());
      } catch {
        /* rien */
      }
      entete = {
        carteGraphique: nom,
        navigateur: navigator.userAgent,
        canevas: [innerWidth, innerHeight],
        densite: dpr,
        pleinEcran: !!document.fullscreenElement,
        frequence: 60,
        palierAuto: o.qualite.palierAuChargement(app, memoire, Date.now(), Math.round(innerWidth * innerHeight * Math.min(dpr, 2) ** 2)).palier,
        passesPermises: o.qualite.passesPermises(app),
        minuteurGpu: chrono.disponible,
      };
    }
    const camera = new PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 700);
    const car = o.voiture();
    car.traverse((x) => (x.castShadow = true));
    let vue = null as { cle: string; scene: TrackScene } | null;
    for (const { config, theme } of aFaire) {
      const cle = `${theme}|${config.palier}|${config.plus.join("+")}`;
      if (vue?.cle !== cle) {
        vue?.scene.scene.remove(car);
        vue?.scene.dispose();
        const s = composer(track, theme as PaletteName, config.palier, { textes: { depart: o.t("course.portique.depart"), arrivee: o.t("course.portique.arrivee") }, decor: decorPret(theme) }, config.plus);
        s.setQuality(2, true);
        s.scene.add(car);
        s.reflets?.(renderer, car);
        vue = { cle, scene: s };
      }
      etat.pas++;
      progres.textContent = `${etat.pas}/${etat.total} · ${config.libelle} · ${theme}`;
      etat.etat = "mesure";
      const m = await mesurer({ renderer, camera, view: vue.scene, car, tr, config, theme, chrono, durees, o });
      if (config.id === "p1") toutesIntervalles.push(...m.intervalles);
      mesures.push(m.mesure);
    }
    vue?.scene.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }
  progres.remove();
  entete!.frequence = frequenceEcran(toutesIntervalles);
  const rapport: RapportBanc = {
    version: VERSION_RAPPORT,
    date: new Date().toISOString(),
    mode,
    circuit: { jour: BANC_JOUR, id: track.id, debut: BANC_DEBUT_S },
    durees: { ...durees },
    entete: entete!,
    mesures,
    dureeS: Math.round((performance.now() - debutBanc) / 100) / 10,
  };
  etat.rapport = rapport;
  etat.valide = rapportValide(rapport);
  etat.etat = "fini";
  page.hidden = false;
  afficher(sortie, rapport);
}

interface Contexte {
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  view: TrackScene;
  car: Object3D;
  tr: Trajectoire;
  config: ConfigBanc;
  theme: ThemeBanc;
  chrono: Chrono;
  durees: { chauffe: number; mesure: number };
  o: OutilsBanc;
}

/** Une configuration sur un thème : la mise en route (écartée), puis la mesure. */
async function mesurer(c: Contexte): Promise<{ mesure: MesureBanc; intervalles: number[] }> {
  const { renderer, camera, view, car, tr, config, theme, chrono, durees, o } = c;
  const { flatRatio } = o;
  const densite = config.densite === "native" ? Math.min(devicePixelRatio || 1, 2) : Math.min(devicePixelRatio || 1, config.densite);
  renderer.setPixelRatio(densite);
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  const post = POST_3[theme];
  let echec: string | undefined;
  let rendre: () => void;
  let liberer = () => undefined as void;
  /** L'échelle de la scène de la chaîne (plafond de pixels) : les halos en points et les particules s'y règlent, comme en jeu. */
  let echelle = () => 1;
  const d = renderer.getDrawingBufferSize(new Vector2());
  const direct = () => {
    renderer.toneMappingExposure = view.look.exposure;
    chrono.debut("scene");
    renderer.render(view.scene, camera);
    chrono.fin();
  };
  const ch = config.chaine;
  if (!ch) rendre = direct;
  else if (ch.version === 47) {
    const chaine = new ChainePost47(renderer, ch.echantillons);
    chaine.chrono = chrono;
    chaine.sansSortie = !ch.sortie;
    const r = { halo: ch.halo, etalonnage: ch.etalonnage, anticrenelage: ch.anticrenelage, theme: post, exposition: view.look.exposure };
    rendre = () => {
      parcourirMateriaux(view.scene); // le lot 47 adaptait les nuanceurs d'écran à chaque image (`lineaire.adapter`)
      if (!chaine.rendre(view.scene, camera, d.x, d.y, r)) {
        echec = "cible refusée : dessin direct";
        direct();
      }
    };
    liberer = () => chaine.dispose();
  } else {
    const chaine = new ChainePost(renderer, ch.forme);
    chaine.chrono = chrono;
    echelle = () => chaine.echelle;
    const r = { halo: ch.halo, etalonnage: ch.etalonnage, anticrenelage: ch.anticrenelage, theme: post, exposition: view.look.exposure };
    await chaine.preparer(view.scene, camera, d.x, d.y, r);
    rendre = () => {
      if (!chaine.rendre(view.scene, camera, d.x, d.y, r)) {
        echec = "cible refusée : dessin direct";
        direct();
      }
    };
    liberer = () => chaine.dispose();
  }

  const rig = o.cameras[0]!;
  const intervalles: number[] = [];
  const fil: number[] = [];
  const appels: number[] = [];
  let taches = 0;
  let observateur: PerformanceObserver | null = null;
  let enMesure = false;
  try {
    observateur = new PerformanceObserver((l) => {
      if (enMesure) taches += l.getEntries().length;
    });
    observateur.observe({ type: "longtask", buffered: false });
  } catch {
    observateur = null;
  }
  const programmes = () => (renderer.info.programs?.length ?? 0);
  let programmesAvant = 0;
  let camYaw = tr.yaw[0]!;
  const cam = { x: 0, y: 0, z: 0 };
  let premier = true;
  await new Promise<void>((fini) => {
    let t0 = -1;
    let derniere = -1;
    let vues = 0;
    const image = (now: number) => {
      if (t0 < 0) t0 = now;
      const ecoule = now - t0;
      // Au moins deux images de mise en route et trois mesurées (un rendu très lent : le logiciel des essais).
      const mesure = ecoule >= durees.chauffe && ++vues > 2;
      if (mesure && !enMesure) {
        enMesure = true;
        chrono.vider();
        chrono.enregistrer = true;
        programmesAvant = programmes();
      }
      if (enMesure && derniere >= 0) intervalles.push(now - derniere);
      derniere = now;
      if (ecoule >= durees.chauffe + durees.mesure && intervalles.length >= 3) {
        chrono.enregistrer = false;
        enMesure = false;
        fini();
        return;
      }
      const debut = performance.now();
      // La voiture : la trajectoire du pilote, au temps de l'image (même bout de circuit pour chaque configuration).
      const s = (ecoule / 1000) * TICK_RATE;
      const k = Math.min(tr.x.length - 2, Math.floor(s));
      const f = Math.min(1, s - k);
      const x = lerp(tr.x[k]!, tr.x[k + 1]!, f);
      const y = lerp(tr.y[k]!, tr.y[k + 1]!, f);
      const z = lerp(tr.z[k]!, tr.z[k + 1]!, f);
      const yaw = tr.yaw[k]! + angle(tr.yaw[k + 1]! - tr.yaw[k]!) * f;
      const v = lerp(tr.v[k]!, tr.v[k + 1]!, f);
      car.position.set(x, y, z);
      car.rotation.set(0, yaw, 0);
      // La caméra de poursuite (la proche du jeu, sans secousse) : elle suit le cap et la position avec un léger retard.
      const dt = premier ? 1 : 1 / 60;
      camYaw += angle(yaw - camYaw) * (premier ? 1 : 1 - Math.exp(-rig.yawLag * dt));
      const back = rig.back + flatRatio(v) * rig.backAtSpeed;
      const tx = x - Math.sin(camYaw) * back;
      const ty = y + rig.height;
      const tz = z - Math.cos(camYaw) * back;
      const suivre = premier ? 1 : 1 - Math.exp(-rig.posLag * dt);
      cam.x += (tx - cam.x) * suivre;
      cam.y += (ty - cam.y) * suivre;
      cam.z += (tz - cam.z) * suivre;
      premier = false;
      camera.position.set(cam.x, cam.y, cam.z);
      camera.lookAt(x + Math.sin(camYaw) * rig.ahead, y + rig.lookHeight, z + Math.cos(camYaw) * rig.ahead);
      const fov = rig.fov + flatRatio(v) * rig.fovAtSpeed;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      const h = innerHeight * renderer.getPixelRatio() * echelle();
      view.followGround(x, z);
      view.followCar(x, y, z, yaw, false);
      view.setView(h, camera.fov);
      view.animer?.(now / 1000, camera, h);
      rendre();
      chrono.finImage();
      if (enMesure) {
        fil.push(performance.now() - debut);
        appels.push(renderer.info.render.calls);
      }
      requestAnimationFrame(image);
    };
    requestAnimationFrame(image);
  });
  // Les dernières requêtes du minuteur : quelques images pour qu'elles reviennent.
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    chrono.enregistrer = i < 3;
    chrono.finImage();
  }
  observateur?.disconnect();
  const compilations = programmes() - programmesAvant;
  liberer();
  const r = resumer({ intervalles, fil, appels, gpu: chrono.disponible ? chrono.resultats : null });
  return {
    intervalles,
    mesure: {
      config: config.id,
      libelle: config.libelle,
      theme,
      ...r,
      programmes: programmes(),
      compilations,
      tachesLongues: taches,
      tampon: [d.x, d.y],
      densite,
      ...(echec ? { echec } : {}),
    },
  };
}

const fmt = (x: number | undefined, n = 1) => (x === undefined ? "–" : x.toFixed(n));

/** Le tableau du rapport et « Copier le rapport ». */
function afficher(sortie: HTMLElement, r: RapportBanc) {
  sortie.textContent = "";
  const e = r.entete;
  ajouter(
    sortie,
    "p",
    `${e.carteGraphique} · canevas ${e.canevas[0]} × ${e.canevas[1]} · densité ${e.densite} · ${e.pleinEcran ? "plein écran" : "pas en plein écran"} · écran ${e.frequence} Hz · Auto : palier ${e.palierAuto}${e.passesPermises ? " (chaîne permise)" : " (chaîne non permise)"} · minuteur de la carte graphique : ${e.minuteurGpu ? "oui" : "non (temps par passe indisponible)"} · ${r.dureeS} s`,
  );
  const copier = ajouter(sortie, "button", "Copier le rapport");
  copier.type = "button";
  styleBouton(copier);
  const json = JSON.stringify(r, null, 1);
  const zone = ajouter(sortie, "textarea");
  zone.value = json;
  zone.readOnly = true;
  zone.rows = 4;
  zone.style.width = "100%";
  copier.addEventListener("click", () => {
    void navigator.clipboard?.writeText(json).then(
      () => (copier.textContent = "Rapport copié"),
      () => {
        zone.select();
        document.execCommand("copy");
        copier.textContent = "Rapport sélectionné : Ctrl+C";
      },
    );
  });
  const table = ajouter(sortie, "table");
  table.style.borderCollapse = "collapse";
  const tete = ajouter(table, "tr");
  for (const h of ["Configuration", "Thème", "Médiane (ms)", "95ᵉ", "99ᵉ", "Pire", "Images/s", "Carte graphique (ms)", "Par passe (ms)", "Fil principal (ms)", "Appels", "Compilations", "Tâches longues"]) ajouter(tete, "th", h);
  for (const m of r.mesures) {
    const l = ajouter(table, "tr");
    const cellules = m.echec && !m.images
      ? [m.libelle, m.theme, m.echec]
      : [
          m.libelle + (m.echec ? ` (${m.echec})` : ""),
          m.theme,
          fmt(m.image.mediane),
          fmt(m.image.p95),
          fmt(m.image.p99),
          fmt(m.image.pire),
          fmt(m.ips),
          m.gpu ? fmt(m.gpu.total, 2) : "–",
          m.gpu ? Object.entries(m.gpu.passes).map(([n, v]) => `${n} ${v.toFixed(2)}`).join(" · ") : "–",
          `${fmt(m.filPrincipal.mediane, 2)} / ${fmt(m.filPrincipal.p95, 2)}`,
          String(m.appels),
          String(m.compilations),
          String(m.tachesLongues),
        ];
    for (const c of cellules) {
      const td = ajouter(l, "td", c);
      td.style.padding = "2px 8px";
      td.style.borderTop = "1px solid rgba(255,246,224,.2)";
    }
  }
}
