// La vitrine de la scène (`/track/vitrine/`, recette et aperçus seulement : jamais construite en production). Deux planches :
//   - **les paliers** (retouche 38b, par défaut) : au-dessus du mélange recommandé du lot 38, les paliers de qualité 1, 2 et 3 et une colonne « à la
//     carte » (un palier et des pas cochés), avec la vue en mouvement par thème et le coût de chaque palier et de chaque pas ;
//   - **la voiture** (lot 40, `?planche=voiture`). Lot 44 : la planche des directions du lot 38 est partie avec les directions (capture dans le README du lot 44).
// Une section par élément et par thème ; dans chaque section, les mêmes éléments vus par chaque colonne, côte à côte, dans la même scène et le même
// cadrage, avec leur coût. Outil interne de Nathan : en français, exempté des catalogues (comme l'admin).
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
import { memoireScene, type MemoireScene } from "../scene/memoire";
import { PAS, lireReglages, reglagesDuPalier, texteReglages, type PasId } from "../scene/paliers";
import { ELEMENTS, THEMES_VITRINE, poseTheme, type PointDeVue, type Pose, type Sujet, type SujetTheme } from "./sujets";
import { variantesPaliers, type Fabrique, type Variante, type VarianteId } from "./variantes";
import { dessiner, mesurerImage, moteurPartage, orbiteDepuis, suivreOrbite, type Chiffres, type Dessin, type Orbite } from "./vues";
import { EtatReglages, panneauReglages } from "./reglagesUi";
import { TEXTES_PAS } from "./textesPaliers";
import { MESURES_PALIERS } from "./mesuresPaliers";
import type { Bout } from "./parcours";
import type { VueMouvement } from "./mouvement";

type Planche = "paliers" | "voiture";
const params = new URLSearchParams(location.search);
const planche: Planche = params.get("planche") === "voiture" ? "voiture" : "paliers";
document.body.dataset.planche = planche;

/** Les réglages de la colonne « à la carte » et de la vue en mouvement (`?reglages=2+halo`, par défaut le palier 2). */
const reglagesCarte = new EtatReglages(lireReglages(params.get("reglages") ?? "2"));
const COLONNES: Variante[] = variantesPaliers(() => reglagesCarte.get());

/** Le temps (s) auquel sont dessinées les vues fixes des paliers (drapeaux, nuages, particules à cet instant). */
const T_FIXE = 2;

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
  memoire: MemoireScene | null;
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
const fabriques = new Map<VarianteId, Promise<Fabrique>>();
const fabrique = (v: Variante) => {
  let f = fabriques.get(v.id);
  if (!f) fabriques.set(v.id, (f = v.charger()));
  return f;
};

/** Les bandeaux (DÉPART, ARRIVÉE) se dessinent avec la police des chiffres du HUD : on l'attend avant toute construction. */
const policesPretes = Promise.all(["italic 800 84px 'Barlow Condensed'", "italic 800 44px 'Barlow Condensed'", "400 40px 'Archivo Black'", "800 40px 'Archivo'", "700 40px 'JetBrains Mono'", "700 64px 'JetBrains Mono'"].map((f) => document.fonts.load(f))).catch(() => []);

/** Thème des sections d'éléments (sélecteur en tête de page). */
let paletteElements: PaletteName = "stade";
/** Point de vue de chaque section de thème. */
const pointsDeVue = new Map<string, PointDeVue>();
/** Circuits des thèmes, calculés par le fil de travail des circuits (le même que le jeu). */
const moteurCircuits = createCircuitEngine();
const circuits = new Map<string, Promise<{ track: Track; palette: PaletteName; date: string; spec: string }>>();

function circuitDe(s: Sujet): Promise<{ track: Track; palette: PaletteName; date: string; spec: string }> {
  const cle = s.type === "element" ? `${s.id}:${paletteElements}` : s.id;
  let c = circuits.get(cle);
  if (!c) {
    c =
      s.type === "element"
        ? Promise.resolve({ track: parseTrack(`vitrine-${s.id}`, s.spec), palette: paletteElements, date: "", spec: s.spec })
        : moteurCircuits.daily(s.jour, null, 0).then((d) => ({ track: d.track, palette: d.palette, date: d.date, spec: d.spec }));
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
const mo = (o: number) => `${fmt(o / 1048576, 1)} Mo`;

function legendeDe(v: Vue): string {
  if (v.etat === "erreur") return "erreur de construction (voir la console)";
  if (v.etat !== "prete") return "construction…";
  const parts = [`construction ${fmt(v.constructionMs)} ms`];
  if (v.chiffres) parts.push(`${fmt(v.chiffres.appels)} appels`, `${fmt(v.chiffres.triangles / 1000, 1)} k triangles`);
  if (planche === "paliers" && v.memoire) parts.push(`textures ${mo(v.memoire.generees)}`, `cibles ${mo(v.memoire.cibles + (v.chiffres?.postOctets ?? 0))}`);
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
    const ts = f.construire(track, palette);
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
      ...(f.rendre ? { rendre: (r, camera, w, h) => f.rendre!(ts, r, camera, w, h, T_FIXE) } : {}),
      ...(f.preparer ? { preparer: (r) => f.preparer!(ts, r) } : {}),
    };
    v.etat = "prete";
    redessiner(v);
    v.memoire = memoireScene(ts.scene);
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
    const libelles: Record<PointDeVue, string> = { virage: "Poursuite (avant le premier virage)", depart: "Départ", ensemble: "Vue d'ensemble", asphalte: "L'asphalte de près" };
    for (const pdv of ["virage", "depart", "ensemble", "asphalte"] as const) {
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
    if (planche === "paliers") {
      const enMouvement = el("button", "segment segment--action", "Vue en mouvement");
      enMouvement.type = "button";
      enMouvement.addEventListener("click", () => void ouvrirMouvement(s.id));
      choix.append(enMouvement);
    }
    const date = el("p", "sujet__date");
    void circuitDe(s).then((c) => (date.textContent = `Circuit du jour du ${c.date} (vrai générateur, variante 0).`));
    tete.append(choix, date);
  }
  sec.append(tete);
  const grille = el("div", "grille");
  for (const variante of COLONNES) {
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
    const v: Vue = { sujet: s, variante, figure, canvas, legende, scene: null, dessin: null, orbite: null, pose: null, camera: new PerspectiveCamera(60, 1, 0.1, 700), constructionMs: 0, chiffres: null, memoire: null, image: null, etat: "attente", travail: null };
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

// --- La vue en mouvement (planche des paliers) ------------------------------------------------------------------------------------------

const dialogueMouvement = document.getElementById("mouvement") as HTMLDialogElement;
const choixThemeMouvement = document.getElementById("mouvement-theme") as HTMLSelectElement;
const choixBout = document.getElementById("mouvement-bout") as HTMLSelectElement;
let vueMouvement: Promise<VueMouvement> | null = null;
function mouvement(): Promise<VueMouvement> {
  vueMouvement ??= import("./mouvement").then(
    ({ VueMouvement }) =>
      new VueMouvement(
        dialogueMouvement.querySelector("canvas")!,
        dialogueMouvement.querySelector(".mouvement__ips")!,
        dialogueMouvement.querySelector(".mouvement__compteur")!,
        () => fabrique(COLONNES.find((c) => c.id === "carte")!),
        () => reglagesCarte.get(),
        erreurs,
      ),
  );
  return vueMouvement;
}
async function ouvrirMouvement(sujet: string) {
  const s = THEMES_VITRINE.find((t) => t.id === sujet) ?? THEMES_VITRINE[0]!;
  choixThemeMouvement.value = s.id;
  if (!dialogueMouvement.open) dialogueMouvement.showModal();
  const [vm, c] = await Promise.all([mouvement(), circuitDe(s), policesPretes]);
  await vm.ouvrir({ id: s.id, titre: s.titre, track: c.track, palette: c.palette, spec: c.spec });
}
{
  for (const s of THEMES_VITRINE) {
    const o = el("option", undefined, s.titre);
    o.value = s.id;
    choixThemeMouvement.append(o);
  }
  // Planche « Voiture » (lot 40) : elle branche ses propres choix (modèle, palier, thème) sur ce dialogue.
  if (planche === "paliers") choixThemeMouvement.addEventListener("change", () => void ouvrirMouvement(choixThemeMouvement.value));
  choixBout.addEventListener("change", () => void mouvement().then((vm) => vm.changerBout(choixBout.value as Bout)));
  const scenes = dialogueMouvement.querySelectorAll<HTMLButtonElement>("[data-scene]");
  for (const b of scenes) {
    b.addEventListener("click", () => {
      for (const x of scenes) x.setAttribute("aria-pressed", String(x === b));
      void mouvement().then((vm) => vm.changerScene(b.dataset.scene as "existant" | "paliers"));
    });
  }
  dialogueMouvement.querySelector(".mouvement__fermer")!.addEventListener("click", () => dialogueMouvement.close());
  dialogueMouvement.addEventListener("close", () => void vueMouvement?.then((vm) => vm.fermer()));
  document.getElementById("ouvrir-mouvement")!.addEventListener("click", () => void ouvrirMouvement(THEMES_VITRINE[0]!.id));
  panneauReglages(document.getElementById("reglages-page")!, reglagesCarte, "page");
  panneauReglages(document.getElementById("mouvement-reglages")!, reglagesCarte, "mouvement");
  // Les réglages changent : la colonne « à la carte » se reconstruit (même cadrage), la vue en mouvement aussi (même instant du tour), l'adresse
  // les garde (on peut l'envoyer).
  reglagesCarte.ecouter((r) => {
    const u = new URL(location.href);
    u.searchParams.set("reglages", texteReglages(r));
    history.replaceState(null, "", u);
    if (planche === "paliers")
      for (const v of vues.filter((x) => x.variante.id === "carte")) {
        liberer(v);
        demander(v);
      }
    if (dialogueMouvement.open) void mouvement().then((vm) => vm.reconstruire());
  });
}

// --- Le résumé des coûts --------------------------------------------------------------------------------------------------------------

interface Poids {
  poids: Record<string, { fichier: string; octets: number }>;
  three: number;
}
let poids: Poids | null = null;
/** Le poids ajouté au jeu, partie par partie (`poids-parties.json`, écrit à la construction par `poids-parties.mjs`). */
let parties: Record<string, number> | null = null;
const resume = document.getElementById("resume-corps")!;
// Les têtes du tableau des coûts, selon la planche.
for (const t of ["Colonne", "Poids ajouté au jeu (JS compressé)", "Appels de rendu par image", "Triangles par image", "Construction de la scène", "Mémoire : textures dessinées + cibles de rendu", "Image, téléphone (processeur ×4)", "Construction, téléphone (×4)"]) {
  const th = el("th", undefined, t);
  th.scope = "col";
  document.getElementById("resume-tete")!.append(th);
}

/** Une partie de `poids-parties.json` par le début de son nom. */
const partie = (debut: string) => (parties ? (Object.entries(parties).find(([n]) => n.startsWith(debut))?.[1] ?? 0) : 0);
/** Les modules d'un pas (pour le poids « à la demande » de la colonne « à la carte »). */
const MODULE_DU_PAS: Record<PasId, string> = { geometrie: "Palier 2 — géométrie", variete: "Palier 2 — géométrie", matiere: "Palier 2 — matière", traces: "Palier 2 — matière", reflets: "Palier 2 — reflets", ombres: "", occlusion: "Palier 3 — post-traitement", brume: "Palier 3 — lumière", nuages: "Palier 3 — lumière", drapeaux: "Palier 3 — vie", foule: "Palier 3 — vie", ecrans: "Palier 3 — vie", particules: "Palier 3 — vie", etalonnage: "Palier 3 — post-traitement", anticrenelage: "Palier 3 — post-traitement", halo: "Palier 3 — post-traitement" };

/** Le poids d'une colonne de palier : le palier 1 (net, à la place de trackMesh.ts et trackProps.ts) et les modules des pas, à la demande. */
function poidsPalier(id: VarianteId): string {
  if (!parties) return "…";
  const p1 = partie("Palier 1 : tout");
  const existant = partie("Existant : trackMesh");
  const net = `${ko(p1)} (net +${ko(p1 - existant)})`;
  if (id === "P1") return net;
  const r = id === "P2" ? reglagesDuPalier(2) : id === "P3" ? reglagesDuPalier(3) : reglagesCarte.get();
  const ids = PAS.filter((p) => r[p.id]).map((p) => p.id);
  const modules = new Set(ids.map((x) => MODULE_DU_PAS[x]).filter(Boolean));
  const demande = [...modules].reduce((n, m) => n + partie(m), 0);
  return `${net} + ${ko(demande)} à la demande`;
}

function majResume() {
  resume.textContent = "";
  for (const variante of COLONNES) {
    const tr = el("tr");
    const mes = vues.filter((v) => v.variante === variante && v.sujet.type === "theme" && v.chiffres);
    const max = (f: (v: Vue) => number) => (mes.length ? Math.max(...mes.map(f)) : NaN);
    const moy = (f: (v: Vue) => number) => (mes.length ? mes.reduce((n, v) => n + f(v), 0) / mes.length : NaN);
    const octets = variante.morceaux.reduce((n, m) => n + (poids?.poids[m]?.octets ?? 0), 0);
    const cell = (t: string) => el("td", undefined, t);
    tr.append(el("th", undefined, variante.titre));
    {
      const ref = variante.id === "carte" ? undefined : MESURES_PALIERS.colonnes[variante.id];
      const mem = mes.filter((v) => v.memoire);
      tr.append(cell(variante.id === "existant" ? (parties ? `${ko(partie("Existant : trackMesh"))} (à la demande depuis le lot 43)` : "…") : poidsPalier(variante.id)));
      tr.append(
        cell(mes.length ? `${fmt(moy((v) => v.chiffres!.appels))} (max ${fmt(max((v) => v.chiffres!.appels))})` : "…"),
        cell(mes.length ? `${fmt(moy((v) => v.chiffres!.triangles) / 1000, 1)} k (max ${fmt(max((v) => v.chiffres!.triangles) / 1000, 1)} k)` : "…"),
        cell(mes.length ? `${fmt(moy((v) => v.constructionMs))} ms (max ${fmt(max((v) => v.constructionMs))})` : "…"),
        cell(mem.length ? `${mo(mem.reduce((n, v) => n + v.memoire!.generees, 0) / mem.length)} + ${mo(mem.reduce((n, v) => n + v.memoire!.cibles + (v.chiffres?.postOctets ?? 0), 0) / mem.length)}` : "…"),
        cell(ref?.imageMs !== undefined ? `${fmt(ref.imageMs, 1)} ms (pire ${fmt(ref.imageMaxMs ?? NaN, 0)})` : variante.id === "carte" ? "—" : "à mesurer"),
        cell(ref?.constructionMs !== undefined ? `${fmt(ref.constructionMs)} ms (pire ${fmt(ref.constructionMaxMs ?? NaN, 0)})` : variante.id === "carte" ? "—" : "à mesurer"),
      );
    }
    resume.append(tr);
  }
  const n = vues.filter((v) => v.sujet.type === "theme" && v.chiffres).length;
  document.getElementById("resume-etat")!.textContent = `Moyennes sur les vues de thème déjà dessinées (${n} sur ${THEMES_VITRINE.length * COLONNES.length}), sur cet appareil.`;
}

/** Le coût de chaque pas, seul, au-dessus du palier 1 (mesures de référence : `mesure-lot38b`). */
function tableauDesPas() {
  const corps = document.getElementById("pas-corps");
  if (!corps) return;
  corps.textContent = "";
  for (const p of PAS) {
    const m = MESURES_PALIERS.pas[p.id];
    const tr = el("tr");
    const signe = (x: number | undefined, d: number, u: string) => (x === undefined ? "à mesurer" : `${x >= 0 ? "+" : "−"}${fmt(Math.abs(x), d)} ${u}`);
    tr.append(
      el("th", undefined, `${TEXTES_PAS[p.id].titre} (palier ${p.palier})`),
      el("td", undefined, parties ? (MODULE_DU_PAS[p.id] ? ko(partie(MODULE_DU_PAS[p.id])) : "0 (un réglage)") : "…"),
      el("td", undefined, signe(m?.imageMs, 1, "ms")),
      el("td", undefined, signe(m?.constructionMs, 0, "ms")),
      el("td", undefined, signe(m?.triangles === undefined ? undefined : m.triangles / 1000, 1, "k")),
      el("td", undefined, signe(m?.appels, 0, "")),
      el("td", undefined, signe(m?.memoire === undefined ? undefined : m.memoire / 1048576, 1, "Mo")),
    );
    corps.append(tr);
  }
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
    majResume();
  })
  .catch(() => majResume());
fetch("./poids-parties.json")
  .then((r) => (r.ok ? (r.json() as Promise<Record<string, number>>) : null))
  .then((p) => {
    parties = p;
    majResume();
    tableauDesPas();
  })
  .catch(() => tableauDesPas());
majResume();
tableauDesPas();

// --- La planche « Voiture » (lot 40, chargée à la demande) ------------------------------------------------------------------------------

const planVoiture =
  planche === "voiture"
    ? import("./voiture").then(async (m) => {
        m.brancherMouvement(dialogueMouvement);
        await m.monter(document.getElementById("voiture")!, {
          erreurs,
          polices: policesPretes,
          mouvement,
          dialogueMouvement,
          parties: () => parties,
          reglerPalier: (p) => reglagesCarte.set(reglagesDuPalier(p)),
        });
        return m;
      })
    : null;
planVoiture?.catch((e) => erreurs.push(`planche voiture : ${String(e)}`));

// Outils des tests (e2e/vitrine.spec.ts, e2e/voiture.spec.ts) et des mesures (e2e/mesure-lot38b.spec.ts, mesure-lot40-vitrine).
declare global {
  interface Window {
    __vitrine?: {
      planche: Planche;
      erreurs: string[];
      vues(): { sujet: string; variante: string; etat: string; constructionMs: number; appels: number; triangles: number; textures: number; cibles: number }[];
      /** Construit et dessine toutes les vues d'une section (ou de toutes), une à une, en libérant au fur et à mesure. */
      construireTout(sujet?: string): Promise<void>;
      /** Image d'une vue (PNG en data URL) à la taille donnée, densité 1 : captures des README (e2e/captures-lot38b.spec.ts). */
      capture(sujet: string, variante: string, largeur: number, hauteur: number): Promise<string | null>;
      /** Temps d'image d'une vue (à la taille donnée, densité 1). */
      mesurer(sujet: string, variante: string, largeur: number, hauteur: number, images: number): Promise<{ constructionMs: number; moyenneMs: number; pireMs: number; envoiMs: number; appels: number; triangles: number; textures: number; cibles: number } | null>;
      /** Les réglages de la colonne « à la carte » et de la vue en mouvement (texte de `texteReglages` : « 2 », « 1+halo »…). */
      reglages(texte?: string): string;
      /** La vue en mouvement (planche des paliers) : l'ouvrir sur un thème, lire son état, la fermer. */
      mouvement: {
        ouvrir(sujet: string, scene?: "existant" | "paliers"): Promise<void>;
        etat(): Promise<import("./mouvement").EtatMouvement | null>;
        fermer(): void;
      };
      /** Lot 40 : la planche « Voiture » (`?planche=voiture`), une fois montée. */
      voiture(): Promise<typeof import("./voiture") | null>;
    };
  }
}

const sujetDe = (id: string): SujetTheme | undefined => THEMES_VITRINE.find((t) => t.id === id);

window.__vitrine = {
  planche,
  erreurs,
  vues: () => vues.map((v) => ({ sujet: v.sujet.id, variante: v.variante.id, etat: v.etat, constructionMs: v.constructionMs, appels: v.chiffres?.appels ?? 0, triangles: v.chiffres?.triangles ?? 0, textures: v.memoire?.generees ?? 0, cibles: (v.memoire?.cibles ?? 0) + (v.chiffres?.postOctets ?? 0) })),
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
    const mem = v.scene ? memoireScene(v.scene.scene) : null;
    return m && c ? { constructionMs: v.constructionMs, ...m, appels: c.appels, triangles: c.triangles, textures: mem?.generees ?? 0, cibles: (mem?.cibles ?? 0) + c.postOctets } : null;
  },
  reglages(texte) {
    if (texte !== undefined) reglagesCarte.set(lireReglages(texte));
    return texteReglages(reglagesCarte.get());
  },
  mouvement: {
    async ouvrir(sujet, scene = "paliers") {
      const s = sujetDe(sujet);
      if (!s) throw new Error(`thème inconnu : ${sujet}`);
      const vm = await mouvement();
      for (const b of dialogueMouvement.querySelectorAll<HTMLButtonElement>("[data-scene]")) b.setAttribute("aria-pressed", String(b.dataset.scene === scene));
      await vm.changerScene(scene);
      await ouvrirMouvement(s.id);
    },
    async etat() {
      return vueMouvement ? (await vueMouvement).etat : null;
    },
    fermer() {
      dialogueMouvement.close();
    },
  },
  voiture: () => planVoiture ?? Promise.resolve(null),
};
