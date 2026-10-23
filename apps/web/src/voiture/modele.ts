// Lot 40 — le constructeur commun des trois modèles proposés (A, B, C). Un modèle est un **plan** (clés de la caisse, zones vitrées, cadre de la
// livrée, pièces propres : aileron, diffuseur, passages de roue…) ; ce module en fait une voiture de **six maillages au plus** — la caisse (peinture,
// vitres, garnitures : une seule géométrie, la matière par sommet), les feux (sans éclairage, lisibles de nuit) et une roue complète par roue (elle
// tourne dans le shader et braque) — et un **fantôme simple** (≈ 400 triangles, un maillage, translucide avec un liseré : il se distingue toujours
// de ta voiture). Le palier choisit la finesse (sections, segments des roues, arrondis) et les matériaux : au palier 1 une peinture standard et des
// couleurs par sommet ; aux paliers 2 et 3 une peinture à deux couches (`clearcoat`, chargée à la demande : `materiaux2.ts`).
// **La voiture dessinée suit la simulation, elle ne la change jamais** : les roues sont aux points de contact de `@cdj/sim`, rien n'est lu en retour.
import { AXLE_FRONT, AXLE_REAR, HALF_TRACK } from "@cdj/sim";
import { BufferAttribute, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Material, type Texture } from "three";
import type { CarModel, WheelPose } from "../carMesh";
import { WHEEL_RADIUS, clampTravel } from "../carMesh";
import { caisse, interpoler, prismeX, roue, type Cle, type PlanRoue } from "./forme";
import { LIVREE, projectionLivree, textureLivree, type CadreLivree, type TextureLivree } from "./livree";
import { Pieces, finiParSommet, normalesLissees, ombreDeRoue, ombreDesFeux, projeter, srgb, type AngleRoues, type Fini } from "./pieces";

export type PalierVoiture = 1 | 2 | 3;
export type ModeleId = "A" | "B" | "C";

/** Les matières d'une voiture, à un palier donné. */
export interface Matieres {
  palier: PalierVoiture;
  peinture: Fini;
  vitre: Fini;
  garniture: Fini;
  /** Garniture claire (crème : bord d'attaque, filets) et sombre (asphalte : fonds, grilles). */
  creme: Fini;
  noir: Fini;
  metal: Fini;
}

/** Ce que reçoit un plan pour dessiner ses pièces propres. */
export interface Contexte {
  m: Matieres;
  palier: PalierVoiture;
  /** Segments d'un arc (passages de roue, échappements) : plus au palier 2. */
  arc: number;
}

/** Les feux : phares et feux stop. `stop` reçoit les feux qui s'allument au freinage. */
export interface Feux {
  phares(f: Pieces): void;
  stop(f: Pieces): void;
}

/** Le plan d'un modèle. */
export interface PlanVoiture {
  id: ModeleId;
  nom: string;
  /** Une phrase : la direction (vitrine, README). */
  resume: string;
  cles: readonly Cle[];
  /** Arrondi des tronçons du demi-profil aux paliers 2 et 3 (rang → flèche relative). */
  bombe: Readonly<Record<number, number>>;
  /** Rangs des tronçons du profil : dessous (garniture), bas de caisse (garniture), flanc vitré, dessus (toit, capot, coffre). */
  tronçons: { dessous: readonly number[]; bas: readonly number[]; vitre: readonly number[]; dessus: readonly number[] };
  /** Zones en long (z) : pare-brise et lunette (le dessus y est vitré), vitres latérales. */
  zones: { pareBrise: readonly [number, number]; lunette: readonly [number, number]; vitres: readonly [number, number] };
  cadre: CadreLivree;
  roue: Pick<PlanRoue, "branches" | "jante" | "doubles">;
  /** Pièces propres : aileron, diffuseur, passages de roue, rétroviseurs, échappements… (dans la caisse). */
  pieces(p: Pieces, c: Contexte): void;
  feux(c: Contexte): Feux;
  /** Le fantôme : rangs du profil gardés, pièces simples (aileron). */
  fantome: { profil: readonly number[]; pieces(p: Pieces, f: { caisse: Fini; sombre: Fini }): void };
}

export interface OptionsVoiture {
  palier: PalierVoiture;
  couleur: number;
  numero: string;
  /** Matériaux des paliers 2 et 3 (`materiaux2.ts`, chargé à la demande) ; sans eux, le palier 1. */
  materiaux?: FabriqueMateriaux;
}

/** Les matériaux d'un palier : la caisse (livrée comprise) et les roues. */
export interface FabriqueMateriaux {
  caisse(livree: { value: Texture | null }): Material;
  roue(angle: AngleRoues): Material;
  /** Angle (degrés) sous lequel la caisse est lissée ; 0 : facettes. */
  lisse: number;
  /** Matières (couleurs, rugosité, métal, vernis) des pièces. */
  matieres(): Matieres;
  roueFinis(): Omit<PlanRoue, "branches" | "jante" | "doubles" | "rayon" | "largeur" | "segments">;
}

/** Le palier 1 : une peinture standard, des couleurs par sommet, des facettes (comme le décor). */
export const MATERIAUX_1: FabriqueMateriaux = {
  caisse: (livree) => finiParSommet(new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide }), { livree }, "voiture-1"),
  roue: (angle) => finiParSommet(new MeshStandardMaterial({ vertexColors: true, flatShading: true }), { angle }, "voiture-1"),
  lisse: 0,
  matieres: () => ({
    palier: 1,
    peinture: { couleur: srgb(0xffffff), rugosite: 0.5, metal: 0.05, livree: true },
    vitre: { couleur: srgb(0x16283a), rugosite: 0.25, metal: 0.4 },
    garniture: { couleur: srgb(0x232326), rugosite: 0.7 },
    creme: { couleur: srgb(LIVREE.creme), rugosite: 0.6 },
    noir: { couleur: srgb(0x121214), rugosite: 0.8 },
    metal: { couleur: srgb(0xb9bec6), rugosite: 0.4, metal: 0.6 },
  }),
  roueFinis: () => ({
    pneu: { couleur: srgb(0x18191c), rugosite: 0.92 },
    flanc: { couleur: srgb(0x222327), rugosite: 0.88 },
    metal: { couleur: srgb(0xc9ced6), rugosite: 0.4, metal: 0.5 },
    fond: { couleur: srgb(0x2a2c31), rugosite: 0.8 },
    moyeu: { couleur: srgb(LIVREE.creme), rugosite: 0.6 },
    disque: { couleur: srgb(0x4a4d55), rugosite: 0.6, metal: 0.5 },
    etrier: { couleur: srgb(0xf2b544), rugosite: 0.6 },
  }),
};

/** Une voiture construite : le modèle du jeu (`CarModel`), ses chiffres, de quoi la repeindre et la libérer. */
export interface Voiture extends CarModel {
  triangles: number;
  maillages: number;
  peindre(couleur: number, numero?: string): void;
  dispose(): void;
}

const STOP_ETEINT = 0x5a0f12;
const STOP_ALLUME = 0xff2a2a;

/** Construit une voiture d'un plan à un palier, d'une couleur, avec un numéro. */
export function construireVoiture(plan: PlanVoiture, o: OptionsVoiture): Voiture {
  const mat = o.palier > 1 && o.materiaux ? o.materiaux : MATERIAUX_1;
  const palier: PalierVoiture = mat === MATERIAUX_1 ? 1 : o.palier;
  const m = mat.matieres();
  const c: Contexte = { m, palier, arc: palier === 1 ? 7 : 14 };
  const lisse = (f: Fini): Fini => (mat.lisse > 0 ? { ...f, lisse: true } : f);

  // La caisse : les sections (plus fines au palier 2), la matière de chaque face selon son tronçon et sa place en long.
  const p = new Pieces();
  const dans = (z: number, [a, b]: readonly [number, number]) => z >= a && z <= b;
  const peinture = lisse(m.peinture);
  const vitre = lisse(m.vitre);
  const fini = (seg: number, z: number): Fini => {
    const t = plan.tronçons;
    if (t.dessous.includes(seg) || t.bas.includes(seg)) return lisse(m.garniture);
    if (t.vitre.includes(seg)) return dans(z, plan.zones.vitres) ? vitre : peinture;
    if (t.dessus.includes(seg)) return dans(z, plan.zones.pareBrise) || dans(z, plan.zones.lunette) ? vitre : peinture;
    return peinture;
  };
  const sections = interpoler(plan.cles, palier === 1 ? 1 : 3);
  caisse(p, sections, fini, palier === 1 ? {} : plan.bombe, { arriere: peinture, avant: peinture });
  plan.pieces(p, c);
  projeter(p, projectionLivree(plan.cadre));
  const livree: TextureLivree = textureLivree(plan.cadre, palier === 1 ? 512 : 1024, o.couleur, o.numero);
  const tex = { value: livree.texture as Texture | null };
  const caisseMat = mat.caisse(tex);
  const group = new Group();
  const corps = new Mesh(p.construire(false, mat.lisse > 0 ? normalesLissees(p, mat.lisse) : undefined), caisseMat);
  group.add(corps);

  // Les feux : sans éclairage (lisibles de nuit), les feux stop réécrits au freinage.
  const f = new Pieces();
  const feux = plan.feux(c);
  feux.phares(f);
  const stopDebut = f.sommets;
  feux.stop(f);
  const stopFin = f.sommets;
  const feuxGeo = f.construire(false);
  const feuxMesh = new Mesh(feuxGeo, finiParSommet(new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }), { recto: true }, "feux"));
  feuxMesh.customDepthMaterial = ombreDesFeux();
  group.add(feuxMesh);
  const couleurs = feuxGeo.getAttribute("color") as BufferAttribute;
  const stopCouleurs = couleurs.array.slice(stopDebut * 3, stopFin * 3);
  const allumer = (on: boolean) => {
    const vif = srgb(STOP_ALLUME);
    for (let i = stopDebut; i < stopFin; i++) {
      const k = (i - stopDebut) * 3;
      if (on) couleurs.setXYZ(i, vif.r, vif.g, vif.b);
      else couleurs.setXYZ(i, stopCouleurs[k]!, stopCouleurs[k + 1]!, stopCouleurs[k + 2]!);
    }
    couleurs.needsUpdate = true;
  };

  // Quatre roues : une géométrie par côté, un matériau et un angle pour les quatre.
  const angle: AngleRoues = { value: 0 };
  const plRoue: PlanRoue = { ...mat.roueFinis(), ...plan.roue, rayon: WHEEL_RADIUS, largeur: 0.3, segments: palier === 1 ? 14 : 26 };
  if (mat.lisse > 0) for (const k of ["pneu", "flanc", "metal"] as const) plRoue[k] = { ...plRoue[k], lisse: true };
  const geoRoue = (cote: number) => {
    const q = new Pieces();
    roue(q, cote, plRoue);
    return { geo: q.construire(false, mat.lisse > 0 ? normalesLissees(q, 50) : undefined), triangles: q.triangles };
  };
  const roues2 = [geoRoue(1), geoRoue(-1)];
  const roueMat = mat.roue(angle);
  const roueOmbre = ombreDeRoue(angle);
  const wheels = [0, 1, 2, 3].map((i) => {
    const w = new Mesh(roues2[i % 2]!.geo, roueMat);
    w.customDepthMaterial = roueOmbre;
    w.position.set(i % 2 === 0 ? HALF_TRACK : -HALF_TRACK, WHEEL_RADIUS, i < 2 ? AXLE_FRONT : -AXLE_REAR);
    group.add(w);
    return w;
  });

  let freine = false;
  return {
    group,
    triangles: p.triangles + f.triangles + 2 * (roues2[0]!.triangles + roues2[1]!.triangles),
    maillages: 6,
    update(s: WheelPose) {
      angle.value += (s.forward / WHEEL_RADIUS) * s.dt;
      if (angle.value > 1e4) angle.value -= 1e4;
      wheels.forEach((w, i) => {
        w.position.y = WHEEL_RADIUS - clampTravel(s.droop[i]!);
        w.rotation.y = i < 2 ? s.steerAngle : 0;
      });
      if (s.braking !== freine) allumer((freine = s.braking));
    },
    peindre(couleur, numero) {
      livree.peindre(couleur, numero ?? o.numero);
    },
    dispose() {
      livree.dispose();
      for (const g of [corps.geometry, feuxGeo, roues2[0]!.geo, roues2[1]!.geo]) g.dispose();
      for (const x of [caisseMat, feuxMesh.material as Material, roueMat, roueOmbre, feuxMesh.customDepthMaterial!]) x.dispose();
    },
  };
}

// --- Le fantôme simple (Salon) ----------------------------------------------------------------------------------------------------------

const melange = (a: number, b: number, t: number): number => {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/**
 * Le fantôme d'un modèle (Salon) : la silhouette seule, ≈ 400 triangles, un seul maillage. Ce qui le distingue toujours de ta voiture, quelle que
 * soit sa couleur : **translucide** (on voit la route à travers), **sans livrée** (ni bandes ni numéro), **une teinte unie** éclaircie, et **un
 * liseré lumineux** sur son contour (les faces vues de biais s'allument : on le lit encore à 50 m sur un fond de même couleur).
 */
export function construireFantome(plan: PlanVoiture, teinte: number): CarModel & { triangles: number } {
  const p = new Pieces();
  const corps: Fini = { couleur: srgb(melange(teinte, 0xffffff, 0.15)) };
  const sombre: Fini = { couleur: srgb(melange(teinte, 0x10141c, 0.62)) };
  const vitre: Fini = { couleur: srgb(melange(teinte, 0x10141c, 0.45)) };
  const cles: Cle[] = plan.cles.map((k) => ({ z: k.z, pts: plan.fantome.profil.map((i) => k.pts[i]!) }));
  const rang = (i: number) => plan.fantome.profil[i]!;
  caisse(
    p,
    cles,
    (seg, z) => {
      // Le tronçon gardé couvre les rangs d'origine de `rang(seg)` à `rang(seg + 1)` : vitré si l'un d'eux l'est à cet endroit.
      const t = plan.tronçons;
      const couvre = (l: readonly number[]) => l.some((r) => r >= rang(seg) && r < rang(seg + 1));
      const dans = (zz: number, [a, b]: readonly [number, number]) => zz >= a && zz <= b;
      if (couvre(t.dessous)) return sombre;
      if (couvre(t.vitre) && dans(z, plan.zones.vitres)) return vitre;
      if (couvre(t.dessus) && (dans(z, plan.zones.pareBrise) || dans(z, plan.zones.lunette))) return vitre;
      return corps;
    },
    {},
    { arriere: sombre, avant: sombre },
  );
  plan.fantome.pieces(p, { caisse: corps, sombre });
  for (const x of [HALF_TRACK, -HALF_TRACK]) for (const z of [AXLE_FRONT, -AXLE_REAR]) prismeX(p, x - 0.15, x + 0.15, WHEEL_RADIUS, z, WHEEL_RADIUS, 8, sombre, Math.PI / 8);
  const mat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide, transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.6 });
  mat.forceSinglePass = true; // transparent et à double face : une seule passe
  const liseré = { value: srgb(melange(teinte, 0xffffff, 0.55)) };
  mat.onBeforeCompile = (s) => {
    s.uniforms.uLisere = liseré;
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uLisere;")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\nfloat bord = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);\ntotalEmissiveRadiance += uLisere * bord * 0.9;\ndiffuseColor.a = mix(diffuseColor.a, 0.85, bord);",
      );
  };
  mat.customProgramCacheKey = () => "fantome-lisere";
  const group = new Group();
  group.add(new Mesh(p.construire(false), mat));
  return { group, triangles: p.triangles, update() {} };
}
