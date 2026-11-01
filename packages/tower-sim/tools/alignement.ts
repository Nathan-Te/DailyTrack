// Lot T6 — le diagnostic de l'alignement : des pièces censées être alignées sont posées par des commandes scriptées (les vraies : tourner, déplacer, descendre), puis on mesure,
// après la stabilisation, l'écart entre les bords qui devraient coïncider (millimètres), l'inclinaison (degrés) et le glissement (millimètres) entre le lâcher et le repos.
//   npm run alignement:tower -w @cdj/tower-sim [-- --version=3|4] [-- --json]
// Sans option il joue les deux versions de la simulation (3 : « avant », 4 : « après ») et imprime les tableaux du rapport du lot (`docs/tower/lots/lot-T6-grille-visee.md`).
// C'est un OUTIL de mesure : il lit la vue de la partie, jamais l'inverse ; il n'est pas scanné par le test de pureté (il utilise Math.cos / Math.sin pour les coins des pièces).
import { COMMANDE, Partie, type PieceKind, type Rapier, REGLAGES_DEFAUT, type Scenario, type VuePartie, boites } from "../src";
import { chargerRapier } from "../src/rapier";

const MM = 1000;
/** Pour essayer d'autres paramètres de contact sans toucher au code : `CONTACT='{"erreurLineaire":0.0005}' npm run alignement:tower` (outil seulement). */
const CONTACT_ESSAI = process.env.CONTACT ? (JSON.parse(process.env.CONTACT) as Record<string, number>) : undefined;
/** Le trait d'encre du dessin AVANT le lot T6 : un rectangle d'encre plus grand que le collider de `BORD_AVANT` de chaque côté (apps/tower/src/scene.ts, constante BORD). */
export const BORD_AVANT = 0.07;

export interface Placement {
  kind: PieceKind;
  /** Quarts de tour à faire. */
  rot: number;
  /** Bord gauche de la boîte englobante visé, en huitièmes de mètre (absolu, 0 = l'axe de la plateforme). */
  gauche8: number;
}

export interface Contrainte {
  /** `gauche` : le bord gauche de a = celui de b ; `droite` ; `contre` : le bord droit de a touche le bord gauche de b ; `dessus` : le bas de b repose sur le haut de a ; `cible` : le bord gauche de a est à sa cible. */
  type: "gauche" | "droite" | "contre" | "dessus" | "cible";
  a: number;
  b?: number;
  nom: string;
}

export interface Cas {
  nom: string;
  demi8: number;
  placements: Placement[];
  contraintes: Contrainte[];
}

const P = (kind: PieceKind, rot: number, gauche8: number): Placement => ({ kind, rot, gauche8 });

export const CAS: Cas[] = [
  { nom: "O sur O", demi8: 28, placements: [P("O", 0, -8), P("O", 0, -8)], contraintes: [{ type: "gauche", a: 0, b: 1, nom: "bords gauches" }, { type: "droite", a: 0, b: 1, nom: "bords droits" }, { type: "dessus", a: 0, b: 1, nom: "haut/bas" }] },
  { nom: "I sur I", demi8: 28, placements: [P("I", 0, -16), P("I", 0, -16)], contraintes: [{ type: "gauche", a: 0, b: 1, nom: "bords gauches" }, { type: "droite", a: 0, b: 1, nom: "bords droits" }, { type: "dessus", a: 0, b: 1, nom: "haut/bas" }] },
  { nom: "O contre O", demi8: 28, placements: [P("O", 0, -16), P("O", 0, 0)], contraintes: [{ type: "contre", a: 0, b: 1, nom: "O|O" }] },
  {
    nom: "J et L contre O",
    demi8: 40,
    placements: [P("O", 0, 0), P("J", 0, -24), P("L", 0, 16)],
    contraintes: [{ type: "contre", a: 1, b: 0, nom: "J|O" }, { type: "contre", a: 0, b: 2, nom: "O|L" }],
  },
  {
    // Un T couché (un quart de tour : sa queue pointe à gauche) contre un carré : sa boîte englobante fait 2 m de large, son bord droit doit toucher le bord gauche du carré. Le centre de masse du T couché est à
    // un quart de case de la grille : en version 3 aucun déplacement d'une demi-case ne l'y amène (le défaut relevé par Nathan).
    nom: "T couché contre O",
    demi8: 28,
    placements: [P("O", 0, 0), P("T", 1, -16)],
    contraintes: [{ type: "contre", a: 1, b: 0, nom: "T|O" }, { type: "cible", a: 1, nom: "T à sa place" }],
  },
  {
    nom: "T tourné dans un creux",
    demi8: 28,
    // Deux O séparés d'une case ; un T tête en bas (2 quarts de tour) : sa tête repose sur les deux O, sa queue (une case) descend dans le creux.
    placements: [P("O", 0, -16), P("O", 0, 8), P("T", 2, -8)],
    contraintes: [{ type: "dessus", a: 0, b: 2, nom: "T sur O gauche" }, { type: "dessus", a: 1, b: 2, nom: "T sur O droit" }, { type: "cible", a: 2, nom: "T à sa place" }],
  },
  {
    nom: "colonne de 8 O",
    demi8: 28,
    placements: Array.from({ length: 8 }, () => P("O", 0, -8)),
    contraintes: [...Array.from({ length: 7 }, (_, i): Contrainte => ({ type: "gauche", a: 0, b: i + 1, nom: `O${i + 2}/O1` })), ...Array.from({ length: 7 }, (_, i): Contrainte => ({ type: "dessus", a: i, b: i + 1, nom: `O${i + 2} sur O${i + 1}` }))],
  },
  {
    nom: "mur de 6 pièces (2 rangs de 3 O)",
    demi8: 28,
    placements: [P("O", 0, -24), P("O", 0, -8), P("O", 0, 8), P("O", 0, -24), P("O", 0, -8), P("O", 0, 8)],
    contraintes: [
      { type: "contre", a: 0, b: 1, nom: "rang bas 1|2" },
      { type: "contre", a: 1, b: 2, nom: "rang bas 2|3" },
      { type: "contre", a: 3, b: 4, nom: "rang haut 1|2" },
      { type: "contre", a: 4, b: 5, nom: "rang haut 2|3" },
      { type: "gauche", a: 0, b: 3, nom: "colonne 1" },
      { type: "gauche", a: 1, b: 4, nom: "colonne 2" },
      { type: "gauche", a: 2, b: 5, nom: "colonne 3" },
    ],
  },
];

interface Pose {
  x: number;
  y: number;
  angle: number;
}
export interface Rect {
  gauche: number;
  droite: number;
  bas: number;
  haut: number;
}

/** L'étendue (mètres) d'une pièce à une pose, d'après ses boîtes et son angle. */
export function etendue(kind: PieceKind, rot: number, pose: Pose, taille: "normale" | "petite" | "geante" = "normale"): Rect {
  const s = Math.sin(pose.angle);
  const c = Math.cos(pose.angle);
  let gauche = Infinity;
  let droite = -Infinity;
  let bas = Infinity;
  let haut = -Infinity;
  for (const b of boites(kind, rot, taille)) {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const xl = (b.cx + sx * b.hw) / 8;
        const yl = (b.cy + sy * b.hh) / 8;
        const x = pose.x + xl * c - yl * s;
        const y = pose.y + xl * s + yl * c;
        gauche = Math.min(gauche, x);
        droite = Math.max(droite, x);
        bas = Math.min(bas, y);
        haut = Math.max(haut, y);
      }
    }
  }
  return { gauche, droite, bas, haut };
}

export interface MesureCas {
  nom: string;
  version: number;
  /** Écart maximal des contraintes horizontales (millimètres) et verticales (le jour entre les pièces empilées, négatif : enfoncement). */
  horizontalMm: number;
  verticalMm: number;
  /** L'inclinaison maximale au repos (degrés) et le glissement maximal entre le lâcher et le repos (millimètres). */
  inclinaisonDeg: number;
  glissementMm: number;
  /** Le plus grand écart entre le bord visé et celui où la pièce a été posée au lâcher (millimètres) : ce que les commandes ne savent pas atteindre. */
  grilleMm: number;
  /** Le tassement : la hauteur de la tour au repos moins la hauteur théorique (colonne de 8 O : 16 m), en millimètres. */
  tassementMm: number | null;
  detail: { nom: string; mm: number }[];
  pieces: number;
  perdues: number;
}

/** Joue un cas : les commandes scriptées posent chaque pièce sur son bord visé (au plus près que les pas de la demi-case le permettent), puis on laisse la tour se stabiliser. */
export function jouerCas(R: Rapier, cas: Cas, version: number): MesureCas {
  const scenario: Scenario = { nom: cas.nom, pieces: cas.placements.map((p) => p.kind), plateformeDemi8: cas.demi8 };
  const partie = new Partie(R, scenario, REGLAGES_DEFAUT, { version, contact: CONTACT_ESSAI } as never);
  const lache: (Pose | null)[] = cas.placements.map(() => null);
  const posesFinales: Pose[] = [];
  let vue: VuePartie = partie.vue();
  const rotFaits = new Map<number, number>();
  for (let t = 0; t < 20000 && partie.etape !== "fini"; t++) {
    vue = partie.vue();
    let cmd = 0;
    const id = vue.active;
    if (id >= 0) {
      const pl = cas.placements[id]!;
      const pc = vue.pieces[id]!;
      cmd |= COMMANDE.DESCENDRE;
      const faits = rotFaits.get(id) ?? 0;
      if (faits < pl.rot) {
        cmd |= COMMANDE.TOURNER;
        rotFaits.set(id, faits + 1);
      } else {
        const e = etendue(pc.kind, pc.rot, pc, pc.taille);
        const ecart8 = pl.gauche8 - e.gauche * 8;
        if (ecart8 > 2) cmd |= COMMANDE.DROITE;
        else if (ecart8 < -2) cmd |= COMMANDE.GAUCHE;
      }
    }
    partie.avancer(cmd);
    const v = partie.vue();
    for (const p of v.pieces) if (p.etat === "libre" && !lache[p.id]) lache[p.id] = { x: p.x, y: p.y, angle: p.angle };
  }
  vue = partie.vue();
  for (const p of vue.pieces) posesFinales[p.id] = { x: p.x, y: p.y, angle: p.angle };
  // La forme est celle de la pièce (le quart de tour de la partie tourne dans le sens des aiguilles d'une montre : `rot` de la vue, pas le nombre d'ordres).
  const rects = cas.placements.map((pl, i) => (posesFinales[i] ? etendue(pl.kind, vue.pieces[i]!.rot, posesFinales[i]!) : null));
  const detail: { nom: string; mm: number }[] = [];
  let horizontalMm = 0;
  let verticalMm = 0;
  for (const c of cas.contraintes) {
    const a = rects[c.a];
    const b = c.b !== undefined ? rects[c.b] : null;
    if (!a || (c.type !== "cible" && !b)) continue;
    let mm: number;
    if (c.type === "gauche") mm = (b!.gauche - a.gauche) * MM;
    else if (c.type === "droite") mm = (b!.droite - a.droite) * MM;
    else if (c.type === "contre") mm = (b!.gauche - a.droite) * MM;
    else if (c.type === "dessus") mm = (b!.bas - a.haut) * MM;
    else mm = (a.gauche - cas.placements[c.a]!.gauche8 / 8) * MM;
    detail.push({ nom: c.nom, mm: Math.round(mm) });
    if (c.type === "dessus") verticalMm = Math.abs(mm) > Math.abs(verticalMm) ? mm : verticalMm;
    else horizontalMm = Math.abs(mm) > Math.abs(horizontalMm) ? mm : horizontalMm;
  }
  let inclinaisonDeg = 0;
  let glissementMm = 0;
  let grilleMm = 0;
  vue.pieces.forEach((p, i) => {
    if (p.etat !== "libre") return;
    inclinaisonDeg = Math.max(inclinaisonDeg, Math.abs((((p.angle * 180) / Math.PI + 180) % 360) - 180));
    const l = lache[i];
    if (l) {
      glissementMm = Math.max(glissementMm, Math.abs(p.x - l.x) * MM);
      const e = etendue(p.kind, p.rot, l);
      grilleMm = Math.max(grilleMm, Math.abs(e.gauche * 8 - cas.placements[i]!.gauche8) * (MM / 8));
    }
  });
  const libres = vue.pieces.filter((p) => p.etat === "libre");
  const tassementMm = cas.nom === "colonne de 8 O" && libres.length === 8 ? vue.hauteurMm - 16 * MM : null;
  const res: MesureCas = {
    nom: cas.nom,
    version,
    horizontalMm: Math.round(horizontalMm),
    verticalMm: Math.round(verticalMm),
    inclinaisonDeg: Math.round(inclinaisonDeg * 100) / 100,
    glissementMm: Math.round(glissementMm),
    grilleMm: Math.round(grilleMm),
    tassementMm,
    detail,
    pieces: libres.length,
    perdues: vue.tombees,
  };
  partie.dispose();
  return res;
}

// ---- où tombent les bords par rapport à la grille des demi-cases ----

export interface LigneGrille {
  kind: PieceKind;
  rot: number;
  /** Écart du bord gauche, puis du bord droit, à la grille de la demi-case (huitièmes de mètre, de 0 à 3) à la naissance puis après le quart de tour (la pièce active, sur sa colonne de départ). */
  gaucheNaissance: number;
  droiteNaissance: number;
  gaucheApresRotation: number;
  droiteApresRotation: number;
}
const mod4 = (v8: number): number => ((Math.round(v8) % 4) + 4) % 4;

export function tableauGrille(R: Rapier, version: number): LigneGrille[] {
  const lignes: LigneGrille[] = [];
  for (const kind of ["I", "O", "T", "L", "J", "S", "Z"] as PieceKind[]) {
    for (let rot = 0; rot < 4; rot++) {
      const p = new Partie(R, { nom: "grille", pieces: [kind], plateformeDemi8: 28 }, REGLAGES_DEFAUT, { version } as never);
      const n = p.vue().pieces[0]!;
      const e0 = etendue(n.kind, n.rot, n);
      for (let k = 0; k < rot; k++) p.avancer(COMMANDE.TOURNER);
      const q = p.vue().pieces[0]!;
      const e1 = etendue(q.kind, q.rot, q);
      lignes.push({ kind, rot, gaucheNaissance: mod4(e0.gauche * 8), droiteNaissance: mod4(e0.droite * 8), gaucheApresRotation: mod4(e1.gauche * 8), droiteApresRotation: mod4(e1.droite * 8) });
      p.dispose();
    }
  }
  return lignes;
}

function imprimer(version: number, mesures: MesureCas[], grille: LigneGrille[]): void {
  console.log(`\n### Simulation version ${version}`);
  console.log("\n| cas | bords (mm) | jour vertical (mm) | inclinaison (°) | glissement (mm) | bord visé / posé (mm) | tassement (mm) | pièces |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const m of mesures) console.log(`| ${m.nom} | ${m.horizontalMm} | ${m.verticalMm} | ${m.inclinaisonDeg} | ${m.glissementMm} | ${m.grilleMm} | ${m.tassementMm ?? "—"} | ${m.pieces}${m.perdues ? ` (${m.perdues} perdues)` : ""} |`);
  const hors = grille.filter((l) => l.gaucheApresRotation !== 0 || l.droiteApresRotation !== 0 || l.gaucheNaissance !== 0 || l.droiteNaissance !== 0);
  console.log(`\nBords hors de la grille des demi-cases (en huitièmes de mètre, 0 = sur la grille) : ${hors.length} formes/quarts de tour sur ${grille.length}.`);
  if (hors.length > 0) {
    console.log("\n| forme | quarts de tour | gauche / droite à la naissance | gauche / droite après le quart de tour |");
    console.log("|---|---|---|---|");
    for (const l of hors) console.log(`| ${l.kind} | ${l.rot} | ${l.gaucheNaissance} / ${l.droiteNaissance} | ${l.gaucheApresRotation} / ${l.droiteApresRotation} |`);
  }
}

if (process.argv[1] && /alignement(\.m?js|\.ts)?$/.test(process.argv[1])) {
  const arg = process.argv.find((a) => a.startsWith("--version="));
  const versions = arg ? [Number(arg.slice("--version=".length))] : [3, 4];
  const R = await chargerRapier();
  const json = process.argv.includes("--json");
  const sortie: unknown[] = [];
  for (const v of versions) {
    const mesures = CAS.map((c) => jouerCas(R, c, v));
    const grille = tableauGrille(R, v);
    if (json) sortie.push({ version: v, mesures, grille });
    else imprimer(v, mesures, grille);
    if (!json) for (const m of mesures) console.log(`  ${m.nom} : ${m.detail.map((d) => `${d.nom} ${d.mm}`).join(" · ")}`);
  }
  if (json) console.log(JSON.stringify(sortie, null, 1));
}
