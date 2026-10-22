// Lot 38 — la vitrine de la scène (`/track/vitrine/`, recette et aperçus seulement : jamais construite en production). Une section par élément et
// par thème ; dans chaque section, les mêmes éléments vus par l'existant, les directions A, B, C et le mélange recommandé, côte à côte, dans la
// même scène et le même cadrage, avec leur coût. Outil interne de Nathan : en français, exempté des catalogues (comme l'admin).
import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/barlow-condensed-800-italique.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "../../vitrine/vitrine.css";
import { PerspectiveCamera } from "three";
import { parseTrack, type PaletteName, type Track } from "@cdj/sim";
import { createCarMesh, createShadow, placeShadow } from "../carMesh";
import { createCircuitEngine } from "../circuitEngine";
import type { TrackScene } from "../trackMesh";
import { ELEMENTS, THEMES_VITRINE, poseTheme, type PointDeVue, type Pose, type Sujet } from "./sujets";
import { VARIANTES, type Variante, type VarianteId } from "./variantes";
import { dessiner, mesurerImage, moteurPartage, orbiteDepuis, suivreOrbite, type Chiffres, type Dessin, type Orbite } from "./vues";
import { MESURES } from "./mesures";

/** Une vue vivante : sa scène, sa voiture, sa caméra, son canvas, ses chiffres. */
interface Vue {
  sujet: Sujet;
  variante: Variante;
  figure: HTMLElement;
  canvas: HTMLCanvasElement;
  legende: HTMLElement;
  scene: TrackScene | null;
  dessin: Dessin | null;
  orbite: Orbite | null;
  pose: Pose | null;
  camera: PerspectiveCamera;
  constructionMs: number;
  chiffres: Chiffres | null;
  image: { moyenneMs: number; pireMs: number; envoiMs: number } | null;
  /** Construction en cours (une seule à la fois) ou faite. */
  etat: "attente" | "construction" | "prete" | "erreur";
  /** La construction en cours : l'attendre plutôt que d'en lancer une seconde. */
  travail: Promise<void> | null;
}

const erreurs: string[] = [];
window.addEventListener("error", (e) => erreurs.push(String(e.message)));
window.addEventListener("unhandledrejection", (e) => erreurs.push(String(e.reason)));

const vues: Vue[] = [];
const fabriques = new Map<VarianteId, Promise<(t: Track, p: PaletteName) => TrackScene>>();
const fabrique = (v: Variante) => {
  let f = fabriques.get(v.id);
  if (!f) fabriques.set(v.id, (f = v.charger()));
  return f;
};

/** Les bandeaux (DÉPART, ARRIVÉE) se dessinent avec la police des chiffres du HUD : on l'attend avant toute construction. */
const policesPretes = Promise.all(["italic 800 84px 'Barlow Condensed'", "400 40px 'Archivo Black'", "800 40px 'Archivo'", "700 40px 'JetBrains Mono'"].map((f) => document.fonts.load(f))).catch(() => []);

/** Thème des sections d'éléments (sélecteur en tête de page). */
let paletteElements: PaletteName = "stade";
/** Point de vue de chaque section de thème. */
const pointsDeVue = new Map<string, PointDeVue>();
/** Circuits des thèmes, calculés par le fil de travail des circuits (le même que le jeu). */
const moteurCircuits = createCircuitEngine();
const circuits = new Map<string, Promise<{ track: Track; palette: PaletteName; date: string }>>();

function circuitDe(s: Sujet): Promise<{ track: Track; palette: PaletteName; date: string }> {
  const cle = s.type === "element" ? `${s.id}:${paletteElements}` : s.id;
  let c = circuits.get(cle);
  if (!c) {
    c =
      s.type === "element"
        ? Promise.resolve({ track: parseTrack(`vitrine-${s.id}`, s.spec), palette: paletteElements, date: "" })
        : moteurCircuits.daily(s.jour, null, 0).then((d) => ({ track: d.track, palette: d.palette, date: d.date }));
    circuits.set(cle, c);
  }
  return c;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, texte?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texte !== undefined) e.textContent = texte;
  return e;
};

const fmt = (n: number, d = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });
const ko = (o: number) => `${fmt(o / 1024, 1)} ko`;

function legendeDe(v: Vue): string {
  if (v.etat === "erreur") return "erreur de construction (voir la console)";
  if (v.etat !== "prete") return "construction…";
  const parts = [`construction ${fmt(v.constructionMs)} ms`];
  if (v.chiffres) parts.push(`${fmt(v.chiffres.appels)} appels`, `${fmt(v.chiffres.triangles / 1000, 1)} k triangles`);
  if (v.image) parts.push(`image ${fmt(v.image.moyenneMs, 1)} ms`);
  return parts.join(" · ");
}

/** Pose de la section (le cadrage commun à toutes ses vues). */
function poseDe(s: Sujet, track: Track): Pose {
  return s.type === "element" ? s.pose(track) : poseTheme(track, pointsDeVue.get(s.id) ?? "virage");
}

/** Construit la scène d'une vue (si elle ne l'est pas), y pose la voiture, puis la dessine. */
function construire(v: Vue): Promise<void> {
  if (v.etat === "prete") return Promise.resolve();
  if (v.etat === "construction" && v.travail) return v.travail;
  v.travail = construireMaintenant(v).finally(() => (v.travail = null));
  return v.travail;
}

async function construireMaintenant(v: Vue): Promise<void> {
  v.etat = "construction";
  v.legende.textContent = legendeDe(v);
  try {
    const [{ track, palette }, f] = await Promise.all([circuitDe(v.sujet), fabrique(v.variante), policesPretes]);
    const t0 = performance.now();
    const ts = f(track, palette);
    v.constructionMs = performance.now() - t0;
    const pose = poseDe(v.sujet, track);
    const voiture = createCarMesh();
    voiture.group.position.set(pose.voiture.x, pose.voiture.y, pose.voiture.z);
    voiture.group.rotation.set(0, pose.voiture.yaw, 0, "YXZ");
    voiture.group.traverse((o) => (o.castShadow = true));
    const ombre = createShadow();
    placeShadow(ombre, pose.voiture.x, pose.voiture.z, pose.voiture.yaw, pose.voiture.y, 0);
    ts.scene.add(voiture.group, ombre);
    v.scene = ts;
    v.pose = pose;
    v.orbite ??= orbiteDepuis(pose.camera, pose.cible, pose.fov);
    v.dessin = {
      scene: ts.scene,
      exposition: ts.look.exposure,
      avant: (h, fov) => {
        ts.setView(h, fov);
        ts.followCar(pose.voiture.x, pose.voiture.y, pose.voiture.z, pose.voiture.yaw);
        ts.followGround(pose.voiture.x, pose.voiture.z);
      },
    };
    v.etat = "prete";
    redessiner(v);
  } catch (e) {
    v.etat = "erreur";
    erreurs.push(`${v.sujet.id} / ${v.variante.id} : ${String(e)}`);
    console.error(e);
  }
  v.legende.textContent = legendeDe(v);
}

/** Libère la scène d'une vue (les pixels restent dans son canvas). */
function liberer(v: Vue) {
  if (v.etat !== "prete") return;
  v.scene?.dispose();
  v.scene = null;
  v.dessin = null;
  v.etat = "attente";
}

function redessiner(v: Vue) {
  if (!v.dessin || !v.orbite) return;
  const r = v.canvas.getBoundingClientRect();
  if (r.width < 2) return;
  v.chiffres = dessiner(v.dessin, v.orbite, v.canvas, r.width, r.height, Math.min(window.devicePixelRatio || 1, 1.5), v.camera) ?? v.chiffres;
  v.legende.textContent = legendeDe(v);
  majResume();
}

// --- File de construction : une vue à la fois, au repos du navigateur (la page reste fluide pendant qu'on fait défiler) ------------------

const file: Vue[] = [];
let enCours = false;
async function pomper() {
  if (enCours) return;
  enCours = true;
  while (file.length) {
    const v = file.shift()!;
    await construire(v);
    await new Promise((r) => setTimeout(r, 0));
  }
  enCours = false;
}
function demander(v: Vue) {
  if (v.etat === "attente" && !file.includes(v)) file.push(v);
  void pomper();
}

/** Au plus ce nombre de scènes vivantes : au-delà, les plus loin de l'écran sont libérées (mémoire de la carte graphique d'un téléphone). */
const VIVANTES_MAX = 20;
function limiterVivantes() {
  const vivantes = vues.filter((v) => v.etat === "prete");
  if (vivantes.length <= VIVANTES_MAX) return;
  const milieu = window.innerHeight / 2;
  vivantes.sort((a, b) => Math.abs(b.figure.getBoundingClientRect().top - milieu) - Math.abs(a.figure.getBoundingClientRect().top - milieu));
  for (const v of vivantes.slice(0, vivantes.length - VIVANTES_MAX)) liberer(v);
}

// --- La page --------------------------------------------------------------------------------------------------------------------------

const racine = document.getElementById("vitrine")!;
const sommaire = document.getElementById("sommaire")!;
const sections = document.getElementById("sections")!;

function sectionDe(s: Sujet): HTMLElement {
  const sec = el("section", "sujet");
  sec.id = s.id;
  const tete = el("div", "sujet__tete");
  tete.append(el("h2", undefined, s.type === "theme" ? `Thème : ${s.titre}` : s.titre), el("p", "sujet__texte", s.texte));
  if (s.type === "theme") {
    const choix = el("div", "segments");
    choix.setAttribute("role", "group");
    choix.setAttribute("aria-label", "Point de vue");
    const libelles: Record<PointDeVue, string> = { virage: "Poursuite (avant le premier virage)", depart: "Départ", ensemble: "Vue d'ensemble" };
    for (const pdv of ["virage", "depart", "ensemble"] as const) {
      const b = el("button", "segment", libelles[pdv]);
      b.type = "button";
      b.setAttribute("aria-pressed", String(pdv === "virage"));
      b.addEventListener("click", () => {
        pointsDeVue.set(s.id, pdv);
        for (const x of choix.querySelectorAll("button")) x.setAttribute("aria-pressed", String(x === b));
        for (const v of vues.filter((x) => x.sujet === s)) {
          v.orbite = null;
          liberer(v);
          demander(v);
        }
      });
      choix.append(b);
    }
    const date = el("p", "sujet__date");
    void circuitDe(s).then((c) => (date.textContent = `Circuit du jour du ${c.date} (vrai générateur, variante 0).`));
    tete.append(choix, date);
  }
  sec.append(tete);
  const grille = el("div", "grille");
  for (const variante of VARIANTES) {
    const figure = el("figure", `vue vue--${variante.id}`);
    const cadre = el("div", "vue__cadre");
    const canvas = el("canvas", "vue__canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${s.titre} — ${variante.titre}`);
    cadre.append(canvas);
    const titre = el("figcaption", "vue__titre", variante.titre);
    const legende = el("p", "vue__chiffres", "en attente");
    const agrandir = el("button", "vue__agrandir", "Agrandir et mesurer");
    agrandir.type = "button";
    figure.append(cadre, titre, legende, agrandir);
    grille.append(figure);
    const v: Vue = { sujet: s, variante, figure, canvas, legende, scene: null, dessin: null, orbite: null, pose: null, camera: new PerspectiveCamera(60, 1, 0.1, 700), constructionMs: 0, chiffres: null, image: null, etat: "attente", travail: null };
    vues.push(v);
    suivreOrbite(cadre, () => v.orbite!, () => (v.etat === "prete" ? redessiner(v) : demander(v)), { molette: false, hauteur: false });
    agrandir.addEventListener("click", () => ouvrirAgrandi(v));
  }
  sec.append(grille);
  return sec;
}

// Vue agrandie (dialogue) : on tourne autour librement, on zoome, on mesure le temps d'image à cette taille.
const dialogue = document.getElementById("agrandi") as HTMLDialogElement;
const grand = dialogue.querySelector("canvas")!;
const grandTitre = dialogue.querySelector("h2")!;
const grandChiffres = dialogue.querySelector(".agrandi__chiffres")!;
let vueAgrandie: Vue | null = null;
const cameraGrande = new PerspectiveCamera(60, 1, 0.1, 700);
function dessinerGrand() {
  const v = vueAgrandie;
  if (!v?.dessin || !v.orbite) return;
  const r = grand.getBoundingClientRect();
  const c = dessiner(v.dessin, v.orbite, grand, r.width, r.height, Math.min(window.devicePixelRatio || 1, 2), cameraGrande);
  grandChiffres.textContent = c ? `${fmt(c.appels)} appels · ${fmt(c.triangles / 1000, 1)} k triangles · envoi ${fmt(c.envoiMs, 1)} ms` : "";
}
suivreOrbite(grand.parentElement!, () => vueAgrandie!.orbite!, dessinerGrand, { molette: true, hauteur: true });
async function ouvrirAgrandi(v: Vue) {
  vueAgrandie = v;
  grandTitre.textContent = `${v.sujet.titre} — ${v.variante.titre}`;
  dialogue.showModal();
  await construire(v);
  dessinerGrand();
}
dialogue.querySelector(".agrandi__fermer")!.addEventListener("click", () => {
  dialogue.close();
  if (vueAgrandie) redessiner(vueAgrandie);
});
dialogue.querySelector(".agrandi__mesurer")!.addEventListener("click", () => {
  const v = vueAgrandie;
  if (!v?.dessin || !v.orbite) return;
  const r = grand.getBoundingClientRect();
  v.image = mesurerImage(v.dessin, v.orbite, r.width, r.height, Math.min(window.devicePixelRatio || 1, 2), 60);
  dessinerGrand();
  if (v.image) grandChiffres.textContent += ` · image ${fmt(v.image.moyenneMs, 1)} ms (pire ${fmt(v.image.pireMs, 1)} ms ; envoi ${fmt(v.image.envoiMs, 1)} ms), 60 images à cette taille sur cet appareil`;
  v.legende.textContent = legendeDe(v);
  majResume();
});

// --- Le résumé des coûts --------------------------------------------------------------------------------------------------------------

interface Poids {
  poids: Record<string, { fichier: string; octets: number }>;
  three: number;
}
let poids: Poids | null = null;
const resume = document.getElementById("resume-corps")!;

function majResume() {
  resume.textContent = "";
  for (const variante of VARIANTES) {
    const tr = el("tr");
    const mes = vues.filter((v) => v.variante === variante && v.sujet.type === "theme" && v.chiffres);
    const max = (f: (v: Vue) => number) => (mes.length ? Math.max(...mes.map(f)) : NaN);
    const moy = (f: (v: Vue) => number) => (mes.length ? mes.reduce((n, v) => n + f(v), 0) / mes.length : NaN);
    const octets = variante.morceaux.reduce((n, m) => n + (poids?.poids[m]?.octets ?? 0), 0);
    const ref = MESURES.variantes[variante.id];
    const cell = (t: string) => el("td", undefined, t);
    tr.append(
      el("th", undefined, variante.titre),
      cell(variante.id === "existant" ? "—" : poids ? `+${ko(octets)}` : "…"),
      cell(mes.length ? `${fmt(moy((v) => v.chiffres!.appels))} (max ${fmt(max((v) => v.chiffres!.appels))})` : "…"),
      cell(mes.length ? `${fmt(moy((v) => v.chiffres!.triangles) / 1000, 1)} k (max ${fmt(max((v) => v.chiffres!.triangles) / 1000, 1)} k)` : "…"),
      cell(mes.length ? `${fmt(moy((v) => v.constructionMs))} ms (max ${fmt(max((v) => v.constructionMs))})` : "…"),
      cell(ref?.imageMs !== undefined ? `${fmt(ref.imageMs, 1)} ms` : "à mesurer"),
      cell(ref?.constructionMs !== undefined ? `${fmt(ref.constructionMs)} ms` : "à mesurer"),
    );
    resume.append(tr);
  }
  const n = vues.filter((v) => v.sujet.type === "theme" && v.chiffres).length;
  document.getElementById("resume-etat")!.textContent = `Moyennes sur les vues de thème déjà dessinées (${n} sur ${THEMES_VITRINE.length * VARIANTES.length}), sur cet appareil.`;
}

// --- Démarrage ------------------------------------------------------------------------------------------------------------------------

const choixTheme = document.getElementById("theme-elements") as HTMLSelectElement;
for (const s of THEMES_VITRINE) {
  const o = el("option", undefined, s.titre);
  o.value = s.palette;
  choixTheme.append(o);
}
choixTheme.value = paletteElements;
choixTheme.addEventListener("change", () => {
  paletteElements = choixTheme.value as PaletteName;
  for (const v of vues.filter((x) => x.sujet.type === "element")) {
    liberer(v);
    v.orbite = null;
    demander(v);
  }
});

for (const s of [...ELEMENTS, ...THEMES_VITRINE]) {
  const a = el("a", undefined, s.type === "theme" ? s.titre : s.titre.replace(/^(Le |La |L'|Les )/, ""));
  a.href = `#${s.id}`;
  const li = el("li");
  li.append(a);
  sommaire.append(li);
  sections.append(sectionDe(s));
}

if (!moteurPartage()) {
  racine.prepend(el("p", "alerte", "WebGL n'est pas disponible sur cet appareil : la vitrine ne peut rien dessiner."));
}

// Une section approche de l'écran : ses vues se construisent ; elle s'en éloigne : elles peuvent être libérées.
const proches = new IntersectionObserver(
  (entrees) => {
    for (const e of entrees) {
      if (!e.isIntersecting) continue;
      for (const v of vues.filter((x) => x.sujet.id === e.target.id)) demander(v);
    }
    limiterVivantes();
  },
  { rootMargin: "600px 0px" },
);
for (const sec of sections.querySelectorAll("section.sujet")) proches.observe(sec);

fetch("./poids.json")
  .then((r) => (r.ok ? (r.json() as Promise<Poids>) : null))
  .then((p) => {
    poids = p;
    const socle = p?.poids.socle?.octets;
    if (socle) document.getElementById("poids-socle")!.textContent = ` : ${ko(socle)}`;
    majResume();
  })
  .catch(() => majResume());
majResume();

// Outils des tests (e2e/vitrine.spec.ts) et de la mesure (e2e/mesure-lot38.spec.ts).
declare global {
  interface Window {
    __vitrine?: {
      erreurs: string[];
      vues(): { sujet: string; variante: string; etat: string; constructionMs: number; appels: number; triangles: number }[];
      /** Construit et dessine toutes les vues d'une section (ou de toutes), une à une, en libérant au fur et à mesure. */
      construireTout(sujet?: string): Promise<void>;
      /** Image d'une vue (PNG en data URL) à la taille donnée, densité 1 : captures du README (e2e/captures-lot38.spec.ts). */
      capture(sujet: string, variante: string, largeur: number, hauteur: number): Promise<string | null>;
      /** Temps d'image d'une vue (à la taille donnée, densité 1). */
      mesurer(sujet: string, variante: string, largeur: number, hauteur: number, images: number): Promise<{ constructionMs: number; moyenneMs: number; pireMs: number; envoiMs: number; appels: number; triangles: number } | null>;
    };
  }
}

window.__vitrine = {
  erreurs,
  vues: () => vues.map((v) => ({ sujet: v.sujet.id, variante: v.variante.id, etat: v.etat, constructionMs: v.constructionMs, appels: v.chiffres?.appels ?? 0, triangles: v.chiffres?.triangles ?? 0 })),
  async construireTout(sujet) {
    for (const v of vues.filter((x) => !sujet || x.sujet.id === sujet)) {
      v.figure.scrollIntoView({ block: "center" });
      await construire(v);
      redessiner(v);
      if (!sujet) liberer(v);
    }
  },
  async capture(sujet, varianteId, largeur, hauteur) {
    const v = vues.find((x) => x.sujet.id === sujet && x.variante.id === varianteId);
    if (!v) return null;
    await construire(v);
    if (!v.dessin || !v.orbite) return null;
    const c = document.createElement("canvas");
    dessiner(v.dessin, v.orbite, c, largeur, hauteur, 1, v.camera);
    return c.toDataURL("image/png");
  },
  async mesurer(sujet, varianteId, largeur, hauteur, images) {
    const v = vues.find((x) => x.sujet.id === sujet && x.variante.id === varianteId);
    if (!v) return null;
    liberer(v);
    await construire(v);
    if (!v.dessin || !v.orbite) return null;
    const m = mesurerImage(v.dessin, v.orbite, largeur, hauteur, 1, images);
    const c = dessiner(v.dessin, v.orbite, v.canvas, largeur, hauteur, 1, v.camera);
    return m && c ? { constructionMs: v.constructionMs, ...m, appels: c.appels, triangles: c.triangles } : null;
  },
};
