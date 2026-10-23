// Lot 40 — la planche « Voiture » de la vitrine (`/track/vitrine/?planche=voiture`, chargée à la demande) : la voiture d'aujourd'hui (en six
// maillages depuis la partie 1 du lot) et les trois modèles proposés, A, B et C, aux paliers 1, 2 et 3 de la scène, à l'arrêt (on tourne autour),
// (lot 42 : les dix voitures — la civile, A à C, et les six du lot, D à I — aux paliers 1 et 2, le palier 3 restant dans la vue en mouvement)
// en fantôme du Salon à 50 m, puis en mouvement (Stade, Nuit, Canyon) ; un sélecteur de couleur (la palette de 8) appliqué partout ; le coût de
// chaque modèle sous sa colonne ; la planche des couleurs (chaque couleur sur chaque thème). Nathan choisit ici ; la retouche 40b met en jeu.
// Outil interne, en français, exempté des catalogues (comme l'admin et le reste de la vitrine).
import { PerspectiveCamera, Vector3, type Group, type Mesh } from "three";
import { CELL, parseTrack, type PaletteName, type Track } from "@cdj/sim";
import { createCarMesh, createShadow, placeShadow, type CarModel } from "../carMesh";
import { createCircuitEngine } from "../circuitEngine";
import { GHOST_COLORS } from "../salon";
import { reglagesDuPalier, type Palier } from "../scene/paliers";
import type { ScenePalier } from "../scene/composerPalier";
import { LOOKS } from "../trackMesh";
import { LIVREE, MOTIFS, MOTIF_DEFAUT, PALETTE, TEINTES_MOTIF, type MotifLivree } from "../voiture/livree";
import { construireFantome, construireVoiture, type FabriqueMateriaux, type ModeleId, type PlanVoiture, type Voiture } from "../voiture/modele";
import { chargerMateriaux2, chargerPlan } from "../voiture/modeles";
import { MESURES_VOITURE } from "./mesuresVoiture";
import { poseTheme, poursuite, THEMES_VITRINE, voitureSurBloc, type Pose } from "./sujets";
import { dessiner, mesurerImage, moteurPartage, orbiteDepuis, suivreOrbite, type Dessin, type Orbite } from "./vues";
import type { Fabrique } from "./variantes";
import type { VueMouvement } from "./mouvement";

type Colonne = "existant" | ModeleId;
const COLONNES: readonly Colonne[] = ["existant", "civile", "A", "B", "C", "D", "E", "F", "G", "H", "I"];
/** Les modèles (toutes les colonnes sauf l'existant). */
const MODELES_VUS = COLONNES.filter((c): c is ModeleId => c !== "existant");
/** Lot 42 : les paliers 1 et 2 à l'arrêt (onze colonnes : le palier 3, la même voiture que le palier 2 dans une autre scène, est dans la vue en mouvement). */
const PALIERS: readonly Palier[] = [1, 2];
/** Les thèmes de la vue en mouvement (consigne du lot) ; la planche à l'arrêt les offre tous. */
const THEMES_MOUVEMENT = ["theme-stade", "theme-nuit", "theme-canyon"];
/** La couleur des fantômes montrés (la première du Salon). */
const TEINTE_FANTOME = GHOST_COLORS[0];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, texte?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texte !== undefined) e.textContent = texte;
  return e;
};
const fmt = (n: number, d = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });
const ko = (o: number) => `${fmt(o / 1024, 1)} ko`;
const css = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** Ce que la page partage avec la planche (outils de vitrine.ts). */
export interface Hote {
  erreurs: string[];
  polices: Promise<unknown>;
  /** La vue en mouvement (le même dialogue que la planche des paliers). */
  mouvement(): Promise<VueMouvement>;
  dialogueMouvement: HTMLDialogElement;
  /** Le poids ajouté au jeu, partie par partie (`poids-parties.json`). */
  parties(): Record<string, number> | null;
  /** Les réglages de la scène de la vue en mouvement : ceux d'un palier. */
  reglerPalier(p: Palier): void;
}

/** L'état de la planche (couleur, numéro, thème des vues à l'arrêt). */
const etat = { couleur: LIVREE.orange as number, numero: "8", theme: "theme-stade", motif: MOTIF_DEFAUT as MotifLivree, teinte: 0 };
/** La Nuit d'un thème (retouche 40b : rayures, numéro et feux légèrement lumineux). */
const nuitDe = (theme: string) => LOOKS[paletteDe(theme)].headlights > 0;
const NOMS_MOTIFS: Record<MotifLivree, string> = { course: "Double bande", flancs: "Flancs à 115°", filet: "Filet", bicolore: "Bicolore", chevrons: "Chevrons", damier: "Damier", rond: "Numéro en rond", unie: "Unie" };

// --- Chargements -------------------------------------------------------------------------------------------------------------------------

const plans = new Map<ModeleId, Promise<PlanVoiture>>();
const plan = (id: ModeleId) => {
  let p = plans.get(id);
  if (!p) plans.set(id, (p = chargerPlan(id)));
  return p;
};
let materiaux2: Promise<FabriqueMateriaux> | null = null;
const materiaux = (palier: Palier) => (palier === 1 ? Promise.resolve(undefined) : (materiaux2 ??= chargerMateriaux2()));

/** Une voiture d'une colonne à un palier (le palier 3 reprend celle du palier 2 : même modèle, autre scène). */
async function voiture(col: Colonne, palier: Palier): Promise<CarModel & { triangles?: number; peindre?: Voiture["peindre"]; nuit?: Voiture["nuit"] }> {
  if (col === "existant") return createCarMesh();
  const [pl, mat] = await Promise.all([plan(col), materiaux(palier)]);
  return construireVoiture(pl, { palier, couleur: etat.couleur, numero: etat.numero, motif: etat.motif, teinteMotif: etat.teinte, materiaux: mat });
}
const voitures = new Map<string, Promise<CarModel & { triangles?: number; peindre?: Voiture["peindre"]; nuit?: Voiture["nuit"] }>>();
const voitureDe = (col: Colonne, palier: Palier) => {
  const k = `${col}:${Math.min(palier, 2)}`;
  let v = voitures.get(k);
  if (!v) voitures.set(k, (v = voiture(col, palier)));
  return v;
};
const fantomes = new Map<string, Promise<CarModel & { triangles: number }>>();
/** Un fantôme d'une colonne (`k` : le premier ou le second, posés ensemble). */
const fantomeDe = (col: Colonne, k: number) => {
  let f = fantomes.get(`${col}:${k}`);
  if (!f) {
    f = col === "existant" ? Promise.resolve(createCarMesh(true, TEINTE_FANTOME, true)).then((m) => Object.assign(m, { triangles: trianglesDe(m.group) })) : plan(col).then((p) => construireFantome(p, TEINTE_FANTOME));
    fantomes.set(`${col}:${k}`, f);
  }
  return f;
};

function trianglesDe(g: Group): number {
  let n = 0;
  g.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) n += (m.geometry.index?.count ?? m.geometry.getAttribute("position").count) / 3;
  });
  return n;
}
function maillagesDe(g: Group): number {
  let n = 0;
  g.traverse((o) => void ((o as Mesh).isMesh && n++));
  return n;
}

/** Les scènes des paliers (une par thème et par palier, partagée par les quatre colonnes : la voiture y entre le temps d'une image). */
let fabriques: Promise<typeof import("./scenesPaliers")> | null = null;
const scenesMod = () => (fabriques ??= import("./scenesPaliers"));
const scenes = new Map<string, Promise<ScenePalier>>();
const moteurCircuits = createCircuitEngine();
const circuits = new Map<string, Promise<Track>>();
function circuitDe(theme: string): Promise<Track> {
  let c = circuits.get(theme);
  if (!c) {
    const s = THEMES_VITRINE.find((t) => t.id === theme)!;
    circuits.set(theme, (c = moteurCircuits.daily(s.jour, null, 0).then((d) => d.track)));
  }
  return c;
}
/** La route droite des fantômes (le fantôme à 50 m devant, sur la même ligne). */
const DROITE = parseTrack("vitrine-fantomes", "S/n@start S S S S S S S@finish");
const paletteDe = (theme: string): PaletteName => THEMES_VITRINE.find((t) => t.id === theme)!.palette;

function sceneDe(cle: string, track: () => Promise<Track>, palette: PaletteName, palier: Palier): Promise<ScenePalier> {
  let s = scenes.get(cle);
  if (!s) {
    s = Promise.all([scenesMod(), track()]).then(async ([m, t]) => (await m.fabriquePalier(() => reglagesDuPalier(palier)))(t, palette));
    scenes.set(cle, s);
  }
  return s;
}
/** Libère les scènes d'un autre thème (mémoire de la carte graphique d'un téléphone). */
function libererScenes(garder: (cle: string) => boolean) {
  for (const [k, s] of scenes) {
    if (garder(k)) continue;
    scenes.delete(k);
    void s.then((x) => x.dispose());
  }
}

// --- Une vue : une scène, une voiture posée, une caméra qui tourne autour -----------------------------------------------------------------

interface Vue {
  col: Colonne;
  palier: Palier;
  sorte: "arret" | "fantome";
  canvas: HTMLCanvasElement;
  legende: HTMLElement;
  orbite: Orbite | null;
  camera: PerspectiveCamera;
  chiffres: { appels: number; triangles: number } | null;
  voitureTriangles: number;
  voitureMaillages: number;
  imageMs: number | null;
}

const vues: Vue[] = [];
const ombre = createShadow();
const ombrePlanche = createShadow();

function poser(g: Group, v: Pose["voiture"]) {
  g.position.set(v.x, v.y, v.z);
  g.rotation.set(0, v.yaw, 0, "YXZ");
  g.updateMatrixWorld(true);
}

/** La pose de la vue à l'arrêt d'un thème : la voiture avant le premier virage, la caméra de trois quarts arrière, à 7 m. */
function poseArret(t: Track): { pose: Pose; orbite: Orbite } {
  const pose = poseTheme(t, "virage");
  const v = pose.voiture;
  const cible = new Vector3(v.x, v.y + 0.62, v.z);
  const az = v.yaw + Math.PI + 0.62;
  const cam = new Vector3(cible.x + Math.sin(az) * 6.4, cible.y + 1.55, cible.z + Math.cos(az) * 6.4);
  return { pose, orbite: orbiteDepuis(cam, cible, 42) };
}
/** La pose des fantômes : le joueur sur la route droite, vu par la caméra de poursuite ; un fantôme à 50 m devant, un autre à 20 m, décalé. */
function poseFantomes(): { joueur: Pose["voiture"]; loin: Pose["voiture"]; pres: Pose["voiture"]; orbite: Orbite } {
  const joueur = voitureSurBloc(DROITE.blocks[1]!, 6);
  const avance = (d: number, lat: number) => {
    const q = 6 + d;
    return voitureSurBloc(DROITE.blocks[1 + Math.floor(q / CELL)]!, q % CELL, lat);
  };
  const p = poursuite(joueur);
  return { joueur, loin: avance(50, 1.2), pres: avance(20, -2.4), orbite: orbiteDepuis(p.camera, p.cible, p.fov) };
}

/** Où et comment dessiner une vue : par défaut dans son canvas, à sa taille ; une capture donne sa toile et sa taille. */
interface Sortie {
  mesurer?: boolean;
  cible?: HTMLCanvasElement;
  largeur?: number;
  hauteur?: number;
}

let travail: Promise<void> = Promise.resolve();
/** Dessine une vue (une à la fois : les voitures et l'ombre passent d'une scène à l'autre). */
function dessinerVue(v: Vue, s: Sortie = {}): Promise<void> {
  travail = travail.then(() => dessinerMaintenant(v, s)).catch((e) => {
    hote?.erreurs.push(`voiture ${v.col} P${v.palier} : ${String(e)}`);
    console.error(e);
  });
  return travail;
}

async function dessinerMaintenant(v: Vue, s: Sortie) {
  const r = v.canvas.getBoundingClientRect();
  const largeur = s.largeur ?? r.width;
  const hauteur = s.hauteur ?? r.height;
  if (largeur < 2) return;
  await hote!.polices;
  const fantome = v.sorte === "fantome";
  const palette = paletteDe(etat.theme);
  const [ts, car] = await Promise.all([
    fantome ? sceneDe(`droite:${etat.theme}:2`, () => Promise.resolve(DROITE), palette, 2) : sceneDe(`${etat.theme}:${v.palier}`, () => circuitDe(etat.theme), palette, v.palier),
    voitureDe(v.col, fantome ? 2 : v.palier),
  ]);
  const ajoutes: Group[] = [car.group];
  car.nuit?.(nuitDe(etat.theme));
  let cible: Pose["voiture"];
  if (fantome) {
    const [loin, pres] = await Promise.all([fantomeDe(v.col, 0), fantomeDe(v.col, 1)]);
    const p = poseFantomes();
    poser(car.group, p.joueur);
    poser(loin.group, p.loin);
    poser(pres.group, p.pres);
    ajoutes.push(loin.group, pres.group);
    v.voitureTriangles = loin.triangles;
    v.voitureMaillages = maillagesDe(loin.group);
    v.orbite ??= p.orbite;
    cible = p.joueur;
  } else {
    const { pose, orbite } = poseArret(await circuitDe(etat.theme));
    poser(car.group, pose.voiture);
    v.voitureTriangles = car.triangles ?? trianglesDe(car.group);
    v.voitureMaillages = maillagesDe(car.group);
    v.orbite ??= orbite;
    cible = pose.voiture;
  }
  placeShadow(ombre, cible.x, cible.z, cible.yaw, cible.y, 0);
  car.group.traverse((o) => (o.castShadow = true));
  ts.scene.add(...ajoutes, ombre);
  try {
    const m = await scenesMod();
    const d: Dessin = {
      scene: ts.scene,
      exposition: ts.look.exposure,
      avant: (h, fov) => {
        ts.setView(h, fov);
        ts.followCar(cible.x, cible.y, cible.z, cible.yaw);
        ts.followGround(cible.x, cible.z);
      },
      rendre: (rr, cam, w, h) => m.rendrePalier(ts, rr, cam, w, h, 2),
      preparer: (rr) => ts.preparer(rr),
    };
    const chiffres = dessiner(d, v.orbite!, s.cible ?? v.canvas, largeur, hauteur, s.cible ? 1 : Math.min(window.devicePixelRatio || 1, 1.5), v.camera);
    if (!s.cible) v.chiffres = chiffres;
    if (s.mesurer) v.imageMs = mesurerImage(d, v.orbite!, largeur, hauteur, 1, 40)?.moyenneMs ?? null;
  } finally {
    ts.scene.remove(...ajoutes, ombre);
  }
  legende(v);
}

function legende(v: Vue) {
  const parts = [`${fmt(v.voitureTriangles)} triangles`, `${v.voitureMaillages} maillage${v.voitureMaillages > 1 ? "s" : ""}`];
  if (v.chiffres) parts.push(`image : ${fmt(v.chiffres.appels)} appels`);
  if (v.imageMs !== null) parts.push(`${fmt(v.imageMs, 1)} ms ici`);
  v.legende.textContent = parts.join(" · ");
}

// --- La page -----------------------------------------------------------------------------------------------------------------------------

let hote: Hote | null = null;

const TEXTES: Record<Colonne, { titre: string; resume: string }> = {
  existant: { titre: "Existant (lots 9b et 40, six maillages)", resume: "La voiture du jeu jusqu'à la retouche 40b (la civile l'a remplacée), pour comparer. Sa couleur ne change pas." },
  A: { titre: "A — Évolution", resume: "" },
  B: { titre: "B — GT basse", resume: "" },
  C: { titre: "C — Proto à bulle", resume: "" },
  civile: { titre: "Civile — Compacte sportive", resume: "" },
  D: { titre: "D", resume: "" },
  E: { titre: "E", resume: "" },
  F: { titre: "F", resume: "" },
  G: { titre: "G", resume: "" },
  H: { titre: "H", resume: "" },
  I: { titre: "I", resume: "" },
};

/** Monte la planche dans `racine`. */
export async function monter(racine: HTMLElement, h: Hote): Promise<void> {
  hote = h;
  for (const id of MODELES_VUS) void plan(id).then((p) => (TEXTES[id] = { titre: p.nom, resume: p.resume }));
  await Promise.all(MODELES_VUS.map(plan));

  // Les réglages : la couleur (palette de 8), le numéro, le thème des vues à l'arrêt.
  const reglages = el("section", "voiture-reglages");
  reglages.setAttribute("aria-labelledby", "voiture-reglages-titre");
  reglages.append(el("h2", undefined, "Couleur, numéro, thème"));
  reglages.querySelector("h2")!.id = "voiture-reglages-titre";
  const nuancier = el("div", "nuancier");
  nuancier.setAttribute("role", "group");
  nuancier.setAttribute("aria-label", "Couleur de la caisse");
  for (const c of PALETTE) {
    const b = el("button", "pastille");
    b.type = "button";
    b.dataset.couleur = c.id;
    b.style.setProperty("--pastille", css(c.hex));
    b.setAttribute("aria-pressed", String(c.hex === etat.couleur));
    b.append(el("span", "pastille__rond"), el("span", "pastille__nom", c.nom));
    b.addEventListener("click", () => void choisirCouleur(c.hex));
    nuancier.append(b);
  }
  const numero = el("input", "numero");
  numero.type = "text";
  numero.inputMode = "numeric";
  numero.maxLength = 3;
  numero.value = etat.numero;
  numero.addEventListener("change", () => {
    etat.numero = numero.value.replace(/\D/g, "").slice(0, 3) || "8";
    numero.value = etat.numero;
    void choisirCouleur(etat.couleur);
  });
  // Retouche 40b : le motif de la livrée (bande centrale, flancs, unie ; le numéro reste).
  const motifs = el("div", "segments");
  motifs.setAttribute("role", "group");
  motifs.setAttribute("aria-label", "Motif de la livrée");
  for (const m of MOTIFS) {
    const b = el("button", "segment", NOMS_MOTIFS[m]);
    b.type = "button";
    b.dataset.motif = m;
    b.setAttribute("aria-pressed", String(m === etat.motif));
    b.addEventListener("click", () => void choisirMotif(m));
    motifs.append(b);
  }
  // Lot 40c : la teinte du motif (automatique, crème, asphalte, lagon) ; une teinte trop proche de la caisse retombe sur l'automatique.
  const teintes = el("div", "segments");
  teintes.setAttribute("role", "group");
  teintes.setAttribute("aria-label", "Teinte du motif");
  for (const [i, t] of TEINTES_MOTIF.entries()) {
    const b = el("button", "segment", { auto: "Auto", creme: "Crème", asphalte: "Asphalte", lagon: "Lagon" }[t.id] ?? t.id);
    b.type = "button";
    b.dataset.teinte = String(i);
    b.setAttribute("aria-pressed", String(i === etat.teinte));
    b.addEventListener("click", () => void choisirTeinte(i));
    teintes.append(b);
  }
  const labelNumero = el("label", "choix", "Numéro ");
  labelNumero.append(numero);
  const theme = el("select");
  for (const s of THEMES_VITRINE) {
    const o = el("option", undefined, s.titre);
    o.value = s.id;
    theme.append(o);
  }
  theme.value = etat.theme;
  theme.addEventListener("change", () => {
    etat.theme = theme.value;
    libererScenes((k) => k.includes(etat.theme));
    for (const v of vues) {
      if (v.sorte === "arret") v.orbite = null;
      void dessinerVue(v);
    }
  });
  const labelTheme = el("label", "choix", "Thème des vues ");
  labelTheme.append(theme);
  reglages.append(nuancier, el("div", "voiture-reglages__ligne"));
  reglages.lastElementChild!.append(motifs, teintes, labelNumero, labelTheme);
  racine.append(reglages);

  // Les colonnes : titre, résumé, coût ; puis une rangée par palier (à l'arrêt), puis les fantômes.
  const grille = el("section", "voiture-grille");
  grille.style.setProperty("--colonnes", String(COLONNES.length));
  grille.setAttribute("aria-label", "Les modèles côte à côte");
  const tete = el("div", "voiture-ligne voiture-ligne--tete");
  tete.append(el("div", "voiture-ligne__nom"));
  for (const col of COLONNES) {
    const t = el("div", "voiture-colonne");
    t.append(el("h3", undefined, TEXTES[col].titre), el("p", "note", TEXTES[col].resume));
    const bouger = el("button", "segment segment--action", "Vue en mouvement");
    bouger.type = "button";
    bouger.addEventListener("click", () => void ouvrirMouvement(col, 2));
    t.append(bouger);
    tete.append(t);
  }
  grille.append(tete);
  const rangee = (titre: string, texte: string, sorte: Vue["sorte"], palier: Palier) => {
    const l = el("div", "voiture-ligne");
    const nom = el("div", "voiture-ligne__nom");
    nom.append(el("h3", undefined, titre), el("p", "note", texte));
    l.append(nom);
    for (const col of COLONNES) {
      const fig = el("figure", "vue");
      const cadre = el("div", "vue__cadre");
      const canvas = el("canvas", "vue__canvas");
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `${TEXTES[col].titre} — ${titre}`);
      cadre.append(canvas);
      const leg = el("p", "vue__chiffres", "en attente");
      fig.append(cadre, leg);
      l.append(fig);
      const v: Vue = { col, palier, sorte, canvas, legende: leg, orbite: null, camera: new PerspectiveCamera(42, 1, 0.1, 700), chiffres: null, voitureTriangles: 0, voitureMaillages: 0, imageMs: null };
      vues.push(v);
      suivreOrbite(cadre, () => v.orbite!, () => void dessinerVue(v), { molette: false, hauteur: true });
    }
    grille.append(l);
  };
  for (const p of PALIERS) {
    const textes: Record<Palier, string> = {
      1: "Peinture standard, couleurs par sommet, ombrage lissé ; ≤ 4 000 triangles (lot 40c). La scène du palier 1.",
      2: "Peinture à deux couches qui reflète le ciel du thème, vitres sombres réfléchissantes, jantes en métal clair ; ≤ 12 000 triangles. La scène du palier 2.",
      3: "La même voiture qu'au palier 2, dans la scène du palier 3 (ombres nettes, brume, post-traitement).",
    };
    rangee(`Palier ${p}, à l'arrêt`, `${textes[p]} On tourne autour en glissant.`, "arret", p);
  }
  rangee("Fantômes du Salon", "Version simple (≈ 400 triangles, un maillage), à 50 m et à 20 m devant ta voiture, dans la scène du palier 2 : translucide, sans livrée, avec un liseré.", "fantome", 2);
  racine.append(grille);

  // Le coût de chaque modèle, sous sa colonne.
  const couts = el("section", "couts");
  couts.setAttribute("aria-labelledby", "voiture-couts-titre");
  const h2 = el("h2", undefined, "Ce que coûte chaque modèle");
  h2.id = "voiture-couts-titre";
  const table = el("table");
  const thead = el("thead");
  const tr = el("tr");
  tr.append(el("th"));
  for (const col of COLONNES) tr.append(Object.assign(el("th", undefined, TEXTES[col].titre), { scope: "col" }));
  thead.append(tr);
  const corps = el("tbody");
  corps.id = "voiture-couts";
  table.append(thead, corps);
  const tableau = el("div", "tableau");
  // Le tableau défile en largeur sur un téléphone : on doit pouvoir l'atteindre au clavier.
  tableau.tabIndex = 0;
  tableau.setAttribute("role", "region");
  tableau.setAttribute("aria-label", "Coûts des modèles (défile en largeur)");
  tableau.append(table);
  const mesurerIci = el("button", "action", "Mesurer le temps d'image ici (palier 2, chaque colonne)");
  mesurerIci.type = "button";
  mesurerIci.addEventListener("click", () => {
    for (const v of vues.filter((x) => x.palier === 2 && x.sorte === "arret")) void dessinerVue(v, { mesurer: true }).then(() => majCouts());
  });
  couts.append(h2, tableau, mesurerIci, el("p", "note", "Poids : ce que le modèle ajouterait au jeu (esbuild, minifié, gzip ; poids-parties.mjs). Image, téléphone (processeur ×4) : MESURE=1 npx playwright test mesure-lot40-vitrine (rendu logiciel : la carte graphique d'un vrai téléphone n'y est pas). Sur ton téléphone, le compteur de la vue en mouvement donne le vrai chiffre."));
  racine.append(couts);

  // La planche des couleurs : chaque couleur sur chaque thème.
  const planche = el("section", "voiture-planche");
  planche.setAttribute("aria-labelledby", "voiture-planche-titre");
  const h2b = el("h2", undefined, "Planche des couleurs : chaque couleur sur chaque thème");
  h2b.id = "voiture-planche-titre";
  const choixModele = el("select");
  for (const col of MODELES_VUS) choixModele.append(Object.assign(el("option", undefined, TEXTES[col].titre), { value: col }));
  const lancer = el("button", "action", "Dessiner la planche (8 couleurs × 8 thèmes, palier 2, poursuite)");
  lancer.type = "button";
  const toile = el("canvas", "voiture-planche__toile");
  toile.setAttribute("role", "img");
  toile.setAttribute("aria-label", "Planche des couleurs");
  lancer.addEventListener("click", () => void planchesCouleurs(choixModele.value as ModeleId, toile));
  const lm = el("label", "choix", "Modèle ");
  lm.append(choixModele);
  planche.append(h2b, el("p", "note", "Chaque thème sous sa lumière, la voiture en poursuite sur le vrai circuit du jour (avant le premier virage). Une couleur gardée doit se détacher de la route, des rebords, des portiques et du décor partout, la Nuit et le Canyon compris."), lm, lancer, toile);
  racine.append(planche);

  majCouts();
  // Les vues se dessinent quand elles approchent de l'écran.
  const proches = new IntersectionObserver(
    (entrees) => {
      for (const e of entrees) {
        if (!e.isIntersecting) continue;
        const v = vues.find((x) => x.canvas === e.target);
        if (v && !v.chiffres) void dessinerVue(v);
      }
    },
    { rootMargin: "1000px 0px" }, // lot 40c : huit motifs et la teinte allongent les réglages (sur un téléphone, la première vue serait sinon trop loin pour être dessinée)
  );
  for (const v of vues) proches.observe(v.canvas);
}

/** Change la teinte du motif (rang dans `TEINTES_MOTIF` ; outil des captures). */
export async function choisirTeinte(rang: number) {
  etat.teinte = rang;
  for (const x of document.querySelectorAll<HTMLButtonElement>("[data-teinte]")) x.setAttribute("aria-pressed", String(x.dataset.teinte === String(rang)));
  await choisirCouleur(etat.couleur);
}

/** Les motifs de la livrée proposés (outil des captures). */
export const motifsDisponibles = (): readonly MotifLivree[] => MOTIFS;

/** Retouche 40b : change le motif de la livrée (les pastilles de motif ; outil des captures). */
export async function choisirMotif(m: MotifLivree) {
  etat.motif = m;
  for (const x of document.querySelectorAll<HTMLButtonElement>("[data-motif]")) x.setAttribute("aria-pressed", String(x.dataset.motif === m));
  await choisirCouleur(etat.couleur);
}

/** Change la couleur de la caisse (les pastilles ; outil des captures). */
export async function choisirCouleur(hex: number) {
  etat.couleur = hex;
  for (const b of document.querySelectorAll<HTMLButtonElement>(".nuancier .pastille")) b.setAttribute("aria-pressed", String(PALETTE.find((c) => c.id === b.dataset.couleur)?.hex === hex));
  for (const v of voitures.values()) (await v).peindre?.(hex, etat.numero, etat.motif, etat.teinte);
  for (const v of vues) void dessinerVue(v);
  void hote?.mouvement().then((vm) => vm.repeindre(hex, etat.numero, etat.motif, etat.teinte));
}

function majCouts() {
  const corps = document.getElementById("voiture-couts");
  if (!corps) return;
  const parties = hote?.parties() ?? null;
  const partie = (debut: string) => (parties ? (Object.entries(parties).find(([n]) => n.startsWith(debut))?.[1] ?? 0) : 0);
  corps.textContent = "";
  const ligne = (titre: string, f: (col: Colonne) => string) => {
    const tr = el("tr");
    tr.append(Object.assign(el("th", undefined, titre), { scope: "row" }));
    for (const col of COLONNES) tr.append(el("td", undefined, f(col)));
    corps.append(tr);
  };
  ligne("Poids ajouté au jeu (JS compressé)", (col) => {
    if (!parties) return "…";
    if (col === "existant") return `${ko(partie("Existant : carMesh"))} (aujourd'hui)`;
    const p1 = partie("Voiture : socle commun") + partie(`Voiture : modèle ${col}`);
    return `${ko(p1)} au premier chargement (palier 1) + ${ko(partie("Voiture : matériaux des paliers 2 et 3"))} à la demande`;
  });
  const vue = (col: Colonne, palier: Palier, sorte: Vue["sorte"] = "arret") => vues.find((v) => v.col === col && v.palier === palier && v.sorte === sorte);
  ligne("Triangles (palier 1 / paliers 2 et 3)", (col) => {
    const a = vue(col, 1)?.voitureTriangles;
    const b = vue(col, 2)?.voitureTriangles;
    return a && b ? `${fmt(a)} / ${fmt(b)}` : "…";
  });
  ligne("Maillages (appels de rendu, ombre comprise)", (col) => {
    const m = vue(col, 2)?.voitureMaillages;
    return m ? `${m} (${m * 2})` : "…";
  });
  ligne("Fantôme du Salon (triangles, maillages)", (col) => {
    const v = vue(col, 2, "fantome");
    return v?.voitureTriangles ? `${fmt(v.voitureTriangles)}, ${v.voitureMaillages}` : "…";
  });
  ligne("Ce que la voiture ajoute à une image, téléphone (×4, rendu logiciel, vue de près) : palier 1 / palier 2", (col) => {
    const m = MESURES_VOITURE.colonnes[col];
    const d = (x: { avecMs: number; sansMs: number }) => `+${fmt(x.avecMs - x.sansMs, 0)} ms`;
    return m ? `${d(m.p1)} / ${d(m.p2)}` : "à mesurer";
  });
  ligne("Image sur cet appareil (palier 2, vue à l'arrêt)", (col) => {
    const ms = vue(col, 2)?.imageMs;
    return ms !== null && ms !== undefined ? `${fmt(ms, 1)} ms` : "—";
  });
}

// --- La vue en mouvement (le dialogue de la vitrine, avec le choix du modèle, du palier, de la couleur) ------------------------------------

let mouvementCol: Colonne = "A";
let mouvementPalier: Palier = 2;

async function ouvrirMouvement(col: Colonne, palier: Palier) {
  const h = hote!;
  mouvementCol = col;
  mouvementPalier = palier;
  const d = h.dialogueMouvement;
  for (const b of d.querySelectorAll<HTMLButtonElement>("[data-modele]")) b.setAttribute("aria-pressed", String(b.dataset.modele === col));
  for (const b of d.querySelectorAll<HTMLButtonElement>("[data-palier]")) b.setAttribute("aria-pressed", String(Number(b.dataset.palier) === palier));
  if (!d.open) d.showModal();
  const vm = await h.mouvement();
  h.reglerPalier(palier);
  await vm.changerVoiture(await voitureMouvement(col, palier));
  await vm.changerScene("paliers");
  const select = d.querySelector<HTMLSelectElement>("#mouvement-theme")!;
  const theme = THEMES_MOUVEMENT.includes(select.value) ? select.value : THEMES_MOUVEMENT[0]!;
  select.value = theme;
  await ouvrirTheme(theme);
}

/** Une voiture à elle pour la vue en mouvement (elle passe d'une scène à l'autre). */
async function voitureMouvement(col: Colonne, palier: Palier): Promise<CarModel> {
  if (col === "existant") return createCarMesh();
  const [pl, mat] = await Promise.all([plan(col), materiaux(palier)]);
  return construireVoiture(pl, { palier, couleur: etat.couleur, numero: etat.numero, motif: etat.motif, teinteMotif: etat.teinte, materiaux: mat });
}

async function ouvrirTheme(theme: string) {
  const s = THEMES_VITRINE.find((t) => t.id === theme)!;
  const [vm, t, c] = await Promise.all([hote!.mouvement(), circuitDe(theme), moteurCircuits.daily(s.jour, null, 0), hote!.polices]);
  await vm.ouvrir({ id: s.id, titre: s.titre, track: t, palette: s.palette, spec: c.spec });
}

/** Branche les contrôles « voiture » du dialogue de la vue en mouvement. */
export function brancherMouvement(d: HTMLDialogElement) {
  for (const b of d.querySelectorAll<HTMLButtonElement>("[data-modele]")) b.addEventListener("click", () => void ouvrirMouvement(b.dataset.modele as Colonne, mouvementPalier));
  for (const b of d.querySelectorAll<HTMLButtonElement>("[data-palier]")) b.addEventListener("click", () => void ouvrirMouvement(mouvementCol, Number(b.dataset.palier) as Palier));
  const select = d.querySelector<HTMLSelectElement>("#mouvement-theme")!;
  select.addEventListener("change", () => void ouvrirTheme(select.value));
}

// --- La planche des couleurs -------------------------------------------------------------------------------------------------------------

/** Dessine chaque couleur sur chaque thème (palier 2, poursuite) dans une seule toile ; rend son image (PNG, data URL). */
export async function planchesCouleurs(col: ModeleId, toile: HTMLCanvasElement, largeur = 220, hauteur = 124): Promise<string> {
  await hote!.polices;
  const pl = await plan(col);
  const mat = await materiaux(2);
  const m = await scenesMod();
  const car = construireVoiture(pl, { palier: 2, couleur: etat.couleur, numero: etat.numero, motif: etat.motif, teinteMotif: etat.teinte, materiaux: mat });
  car.group.traverse((o) => (o.castShadow = true));
  const marge = 96;
  const tete = 28;
  toile.width = marge + PALETTE.length * largeur;
  toile.height = tete + THEMES_VITRINE.length * hauteur;
  const x = toile.getContext("2d")!;
  x.fillStyle = "#1e1b19";
  x.fillRect(0, 0, toile.width, toile.height);
  x.fillStyle = "#f4efe6";
  x.font = "700 14px Archivo, sans-serif";
  x.textBaseline = "middle";
  PALETTE.forEach((c, i) => x.fillText(c.nom, marge + i * largeur + 8, tete / 2));
  const tmp = el("canvas");
  const camera = new PerspectiveCamera(68, 1, 0.1, 700);
  for (const [j, s] of THEMES_VITRINE.entries()) {
    x.fillStyle = "#f4efe6";
    x.fillText(s.titre, 8, tete + j * hauteur + hauteur / 2);
    const t = await circuitDe(s.id);
    const ts = (await m.fabriquePalier(() => reglagesDuPalier(2)))(t, s.palette);
    const pose = poseTheme(t, "virage");
    poser(car.group, pose.voiture);
    car.nuit(nuitDe(s.id));
    placeShadow(ombrePlanche, pose.voiture.x, pose.voiture.z, pose.voiture.yaw, pose.voiture.y, 0);
    ts.scene.add(car.group, ombrePlanche);
    const orbite = orbiteDepuis(pose.camera, pose.cible, pose.fov);
    const v = pose.voiture;
    const d: Dessin = {
      scene: ts.scene,
      exposition: ts.look.exposure,
      avant: (h, fov) => {
        ts.setView(h, fov);
        ts.followCar(v.x, v.y, v.z, v.yaw);
        ts.followGround(v.x, v.z);
      },
      rendre: (rr, cam, w, h) => m.rendrePalier(ts, rr, cam, w, h, 2),
      preparer: (rr) => ts.preparer(rr),
    };
    for (const [i, c] of PALETTE.entries()) {
      car.peindre(c.hex, etat.numero, etat.motif, etat.teinte);
      dessiner(d, orbite, tmp, largeur, hauteur, 1, camera);
      x.drawImage(tmp, marge + i * largeur, tete + j * hauteur, largeur, hauteur);
      await new Promise((r) => setTimeout(r, 0));
    }
    ts.scene.remove(car.group, ombrePlanche);
    ts.dispose();
  }
  car.dispose();
  return toile.toDataURL("image/jpeg", 0.88);
}

// --- Outils des tests et des captures ----------------------------------------------------------------------------------------------------

/** Règle le thème des vues à l'arrêt sans rien dessiner (outil des captures : `apercu` dessine une seule vue, `toutDessiner` les vingt). */
export function reglerTheme(theme: string) {
  if (theme === etat.theme) return;
  etat.theme = theme;
  libererScenes((k) => k.includes(theme));
  for (const v of vues) if (v.sorte === "arret") v.orbite = null;
}

/** Dessine toutes les vues (le thème donné), une à une ; rend leurs chiffres. */
export async function toutDessiner(theme?: string) {
  if (theme && theme !== etat.theme) {
    etat.theme = theme;
    libererScenes((k) => k.includes(theme));
    for (const v of vues) if (v.sorte === "arret") v.orbite = null;
  }
  for (const v of vues) {
    v.canvas.scrollIntoView({ block: "center" });
    await dessinerVue(v);
  }
  majCouts();
  return vues.map((v) => ({ col: v.col, palier: v.palier, sorte: v.sorte, triangles: v.voitureTriangles, maillages: v.voitureMaillages, appels: v.chiffres?.appels ?? 0 }));
}

/** Une image composée (les colonnes côte à côte, une rangée par palier, puis les fantômes) : captures du README. */
export async function planche(theme: string, largeur = 400, hauteur = 260): Promise<string> {
  await toutDessiner(theme);
  const lignes = [...PALIERS.map((p) => vues.filter((v) => v.sorte === "arret" && v.palier === p)), vues.filter((v) => v.sorte === "fantome")];
  const marge = 110;
  const tete = 30;
  const toile = el("canvas");
  toile.width = marge + COLONNES.length * largeur;
  toile.height = tete + lignes.length * hauteur;
  const x = toile.getContext("2d")!;
  x.fillStyle = "#1e1b19";
  x.fillRect(0, 0, toile.width, toile.height);
  x.fillStyle = "#f4efe6";
  x.font = "700 15px Archivo, sans-serif";
  x.textBaseline = "middle";
  COLONNES.forEach((c, i) => x.fillText(TEXTES[c].titre, marge + i * largeur + 8, tete / 2));
  const noms = [...PALIERS.map((p) => `Palier ${p}`), "Fantômes"];
  const tmp = el("canvas");
  for (const [j, l] of lignes.entries()) {
    x.fillText(noms[j]!, 8, tete + j * hauteur + hauteur / 2);
    for (const [i, v] of l.entries()) {
      await dessinerVue(v, { cible: tmp, largeur, hauteur });
      x.drawImage(tmp, marge + i * largeur, tete + j * hauteur, largeur, hauteur);
    }
  }
  return toile.toDataURL("image/jpeg", 0.88);
}

/**
 * Une vue à l'arrêt d'une colonne, vue d'où l'on veut (angle autour de la voiture depuis l'arrière, en degrés ; hauteur en degrés ; distance en
 * mètres) : captures du README (trois quarts arrière, profil, avant) et réglage des formes.
 */
export async function apercu(col: Colonne, palier: Palier, azimut: number, elevation: number, distance: number, largeur: number, hauteur: number, cible?: readonly [number, number, number]): Promise<string> {
  const v = vues.find((x) => x.col === col && x.palier === palier && x.sorte === "arret")!;
  const garde = v.orbite;
  const { pose, orbite } = poseArret(await circuitDe(etat.theme));
  // `cible` : le point regardé, dans le repère de la voiture (+z devant, +x à gauche) : un gros plan (portière, museau, roue).
  if (cible) orbite.cible.set(pose.voiture.x, pose.voiture.y, pose.voiture.z).add(new Vector3(...cible).applyAxisAngle(new Vector3(0, 1, 0), pose.voiture.yaw));
  orbite.azimut = pose.voiture.yaw + Math.PI + (azimut * Math.PI) / 180;
  orbite.elevation = (elevation * Math.PI) / 180;
  orbite.distance = distance;
  v.orbite = orbite;
  const toile = el("canvas");
  await dessinerVue(v, { cible: toile, largeur, hauteur });
  v.orbite = garde;
  return toile.toDataURL("image/jpeg", 0.9);
}

/**
 * Mesure (outil de `mesure-lot40.spec.ts`) : le temps d'une image de la vue à l'arrêt d'une colonne, à un palier, à la taille donnée, avec la
 * voiture puis sans elle (la scène seule) ; et les appels de rendu des deux images.
 */
export function mesurerColonne(col: Colonne, palier: Palier, largeur: number, hauteur: number, images: number): Promise<{ imageMs: number; sceneSeuleMs: number; appels: number; appelsScene: number }> {
  // Dans la file des dessins : aucune autre vue ne pose sa voiture dans la scène pendant la mesure.
  const r = travail.then(() => mesurerMaintenant(col, palier, largeur, hauteur, images));
  travail = r.then(
    () => undefined,
    () => undefined,
  );
  return r;
}

async function mesurerMaintenant(col: Colonne, palier: Palier, largeur: number, hauteur: number, images: number) {
  await hote!.polices;
  const palette = paletteDe(etat.theme);
  const [ts, car, m] = await Promise.all([sceneDe(`${etat.theme}:${palier}`, () => circuitDe(etat.theme), palette, palier), voitureDe(col, palier), scenesMod()]);
  const { pose, orbite } = poseArret(await circuitDe(etat.theme));
  const v = pose.voiture;
  const d: Dessin = {
    scene: ts.scene,
    exposition: ts.look.exposure,
    avant: (h, fov) => {
      ts.setView(h, fov);
      ts.followCar(v.x, v.y, v.z, v.yaw);
      ts.followGround(v.x, v.z);
    },
    rendre: (rr, cam, w, h) => m.rendrePalier(ts, rr, cam, w, h, 2),
    preparer: (rr) => ts.preparer(rr),
  };
  const toile = el("canvas");
  const camera = new PerspectiveCamera(42, 1, 0.1, 700);
  const sans = mesurerImage(d, orbite, largeur, hauteur, 1, images)!;
  const appelsScene = dessiner(d, orbite, toile, largeur, hauteur, 1, camera)!.appels;
  poser(car.group, v);
  car.group.traverse((o) => (o.castShadow = true));
  placeShadow(ombre, v.x, v.z, v.yaw, v.y, 0);
  ts.scene.add(car.group, ombre);
  try {
    const avec = mesurerImage(d, orbite, largeur, hauteur, 1, images)!;
    const appels = dessiner(d, orbite, toile, largeur, hauteur, 1, camera)!.appels;
    return { imageMs: avec.moyenneMs, sceneSeuleMs: sans.moyenneMs, appels, appelsScene };
  } finally {
    ts.scene.remove(car.group, ombre);
  }
}
