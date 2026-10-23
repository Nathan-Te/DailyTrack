import { describe, expect, it } from "vitest";
import { Color, Mesh, MeshStandardMaterial, type BufferGeometry, type Object3D } from "three";
import { VOITURES } from "../src/voiture/catalogue";
import { CHOIX_DEFAUT, CLE_GARAGE, choisirVoiture, lireChoix, voitureChoisie } from "../src/voiture/choix";
import { CONTRASTE_MOTIF, LIVREE, MOTIFS, PALETTE, TEINTES_MOTIF, contraste, couleursMotif, motifLu, motifVersIndice, teinteLisible } from "../src/voiture/livree";
import { MATERIAUX_2 } from "../src/voiture/materiaux2";
import { construireFantome, construireVoiture } from "../src/voiture/modele";
import { creerLivree, atlasChiffres } from "../src/voiture/nuanceurLivree";
import { PLAN_CIVILE } from "../src/voiture/modeleCivile";
import { Pieces, normalesLissees, srgb, type Fini } from "../src/voiture/pieces";
import { arrondirProfil, boutsArrondis, etapesDesCoins, profilTole, RAYONS_TOLE } from "../src/voiture/surfaces";
import { pave } from "../src/voiture/forme";
import { MOTIFS_ESSAI } from "../src/adminLogic";

// Lot 40c — le cran de qualité des voitures : plafonds relevés, motifs dans le nuanceur (jamais de texture étirée), contraste de chaque teinte de motif, reprise des
// anciens choix du Garage, lissage de la caisse. Les roues aux points de contact, la vue capot et le fantôme de chaque modèle sont dans `voitureModeles.test.ts` et
// `hoodView.test.ts` (ils couvrent toutes les voitures du catalogue).

const maillages = (o: Object3D): Mesh[] => {
  const out: Mesh[] = [];
  o.traverse((x) => {
    if ((x as Mesh).isMesh) out.push(x as Mesh);
  });
  return out;
};
const PLANS = await Promise.all(VOITURES.map(async (f) => ({ id: f.id, plan: await f.charger() })));

describe("plafonds et maillages de chaque voiture (lot 40c)", () => {
  for (const { id, plan } of PLANS) {
    it(`${id} : ≤ 4 000 triangles au palier 1, ≤ 12 000 aux paliers 2 et 3, six maillages au plus ; fantôme ≈ 400 triangles, un maillage`, () => {
      const p1 = construireVoiture(plan, { palier: 1, couleur: LIVREE.orange, numero: "8" });
      const p2 = construireVoiture(plan, { palier: 2, couleur: LIVREE.orange, numero: "8", materiaux: MATERIAUX_2 });
      expect(p1.triangles).toBeLessThanOrEqual(4000);
      expect(p2.triangles).toBeLessThanOrEqual(12000);
      for (const v of [p1, p2]) expect(maillages(v.group).length).toBeLessThanOrEqual(6);
      const f = construireFantome(plan, 0x57b4ff);
      expect(maillages(f.group)).toHaveLength(1);
      expect(f.triangles).toBeGreaterThan(300);
      expect(f.triangles).toBeLessThan(460);
    });
  }
});

describe("motifs : dans le nuanceur, jamais de texture étirée", () => {
  it("la page d'admin propose les mêmes motifs (\"\" : la double bande de course)", () => {
    expect([...MOTIFS_ESSAI].map((m) => m || "course").sort()).toEqual([...MOTIFS].sort());
  });

  it("huit motifs, chacun son rang pour le nuanceur, tous différents", () => {
    expect(MOTIFS).toHaveLength(8);
    expect(new Set(MOTIFS).size).toBe(8);
    expect(new Set(MOTIFS.map(motifVersIndice)).size).toBe(8);
    expect(motifVersIndice("unie")).toBe(0);
  });

  for (const { id, plan } of PLANS) {
    it(`${id} : chaque motif se construit sans texture ni coordonnées d'image (aucune carte, aucun attribut uv)`, () => {
      for (const palier of [1, 2] as const) {
        for (const motif of MOTIFS) {
          const v = construireVoiture(plan, { palier, couleur: PALETTE[4]!.hex, numero: "15", motif, materiaux: palier > 1 ? MATERIAUX_2 : undefined });
          const corps = maillages(v.group)[0]!;
          const mat = corps.material as MeshStandardMaterial;
          expect(mat.map, `${id} P${palier} ${motif}`).toBeNull();
          const geo = corps.geometry as BufferGeometry;
          expect(geo.getAttribute("uv")).toBeUndefined();
          expect(geo.getAttribute("aUvL")).toBeUndefined();
          expect(geo.getAttribute("aLivree")).toBeDefined(); // la peinture est repérée par sommet : c'est le nuanceur qui dessine
          expect(mat.defines).toHaveProperty("USE_LIVREE");
          v.dispose();
        }
      }
    });
  }

  it("peindre change les uniformes (couleur, motif, numéro), pas la géométrie ni le nombre de triangles", () => {
    const v = construireVoiture(PLAN_CIVILE, { palier: 1, couleur: LIVREE.orange, numero: "8" });
    const n = v.triangles;
    const geo = maillages(v.group)[0]!.geometry as BufferGeometry;
    const pos = geo.getAttribute("position").array.slice();
    for (const m of MOTIFS) v.peindre(PALETTE[5]!.hex, "123", m, 2);
    expect(v.triangles).toBe(n);
    expect(Array.from(geo.getAttribute("position").array)).toEqual(Array.from(pos));
  });

  it("le numéro : jusqu'à trois chiffres, rien d'autre que des chiffres ; une plaque vierge sans numéro", () => {
    const u = creerLivree(PLAN_CIVILE.cadre);
    const num = () => (u.uniforms.uNum!.value as { x: number; y: number; z: number; w: number });
    u.peindre(LIVREE.orange, "15", "course");
    expect([num().x, num().y, num().z, num().w]).toEqual([1, 5, -1, 2]);
    u.peindre(LIVREE.orange, "8", "course");
    expect([num().x, num().y, num().z, num().w]).toEqual([8, -1, -1, 1]);
    u.peindre(LIVREE.orange, "1234", "course");
    expect([num().x, num().y, num().z, num().w]).toEqual([1, 2, 3, 3]);
    u.peindre(LIVREE.orange, "", "course");
    expect(num().w).toBe(0);
    u.peindre(LIVREE.orange, "n°7", "course");
    expect([num().x, num().w]).toEqual([7, 1]);
  });

  it("l'atlas des chiffres : une seule texture partagée (champ de distance, dix cases)", () => {
    const a = atlasChiffres();
    expect(atlasChiffres()).toBe(a);
    const image = a.image as { width: number; height: number };
    expect(image.width).toBe(800);
    expect(image.height).toBe(128);
  });
});

describe("la couleur du motif : toujours lisible (contraste calculé)", () => {
  it("l'automatique : un contraste suffisant sur chacune des huit couleurs de la palette", () => {
    for (const c of PALETTE) {
      const { c1, plaque, chiffres } = couleursMotif(c.hex, 0);
      expect(contraste(c.hex, c1), `motif auto sur ${c.id}`).toBeGreaterThanOrEqual(CONTRASTE_MOTIF);
      expect(contraste(plaque, chiffres), `numéro sur ${c.id}`).toBeGreaterThanOrEqual(7);
    }
  });

  it("chaque teinte proposée sur chaque couleur : lisible, ou repli sur l'automatique ; liseré distinct du motif", () => {
    expect(TEINTES_MOTIF.length).toBeGreaterThanOrEqual(3); // l'automatique et 2 ou 3 teintes
    expect(TEINTES_MOTIF[0]!.hex).toBeNull();
    for (const c of PALETTE) {
      for (const [rang, t] of TEINTES_MOTIF.entries()) {
        const { c1, c2 } = couleursMotif(c.hex, rang);
        expect(contraste(c.hex, c1), `${t.id} sur ${c.id}`).toBeGreaterThanOrEqual(CONTRASTE_MOTIF);
        expect(contraste(c1, c2), `liseré ${t.id} sur ${c.id}`).toBeGreaterThanOrEqual(1.4);
        if (t.hex !== null && teinteLisible(c.hex, rang)) expect(c1).toBe(t.hex);
        if (t.hex !== null && !teinteLisible(c.hex, rang)) expect(c1).toBe(couleursMotif(c.hex, 0).c1);
      }
    }
  });

  it("chaque teinte reste choisissable sur au moins quatre des huit couleurs ; le lagon n'est pas proposé sur le lagon", () => {
    for (const [rang, t] of TEINTES_MOTIF.entries()) {
      if (t.hex === null) continue;
      expect(PALETTE.filter((c) => teinteLisible(c.hex, rang)).length, t.id).toBeGreaterThanOrEqual(4);
    }
    const lagon = TEINTES_MOTIF.findIndex((t) => t.id === "lagon");
    expect(teinteLisible(PALETTE.find((c) => c.id === "lagon")!.hex, lagon)).toBe(false);
  });
});

describe("reprise des anciens choix du Garage (cdj:track:garage)", () => {
  const stockage = (valeur: unknown) => {
    let v = valeur === undefined ? null : JSON.stringify(valeur);
    return { getItem: () => v, setItem: (_k: string, x: string) => void (v = x) };
  };

  it("bande → double bande de course, flancs → flancs, unie → unie ; un nom inconnu reste refusé", () => {
    expect(motifLu("bande")).toBe("course");
    expect(motifLu("flancs")).toBe("flancs");
    expect(motifLu("unie")).toBe("unie");
    for (const m of MOTIFS) expect(motifLu(m)).toBe(m);
    expect(motifLu("pois")).toBeNull();
    expect(motifLu(3)).toBeNull();
  });

  it("un choix du lot 41 (sans teinte) est relu, son motif devenu son équivalent, sans rien casser", () => {
    const ancien = { id: "civile", couleur: 4, motif: "bande", debloquees: ["evolution"], vues: ["evolution"] };
    const s = stockage(ancien);
    expect(voitureChoisie(() => s)).toEqual({ id: "civile", couleur: 4, motif: "course", teinteMotif: 0 });
    expect(lireChoix({ id: "evolution", couleur: 1, motif: "flancs" })).toEqual({ id: "evolution", couleur: 1, motif: "flancs", teinteMotif: 0 });
    // La voiture et les déblocages gardés dans la clé survivent à une nouvelle écriture.
    expect(choisirVoiture({ id: "evolution", couleur: 2, motif: "unie", teinteMotif: 1 }, () => s)).toBe(true);
    const gardee = JSON.parse(s.getItem()!) as Record<string, unknown>;
    expect(gardee).toMatchObject({ id: "evolution", couleur: 2, motif: "unie", teinteMotif: 1, debloquees: ["evolution"], vues: ["evolution"] });
    expect(CLE_GARAGE).toBe("cdj:track:garage");
  });

  it("une teinte illisible retombe sur l'automatique ; un choix illisible, la civile en orange de Track avec la double bande", () => {
    expect(lireChoix({ id: "civile", couleur: 0, motif: "course", teinteMotif: 9 })?.teinteMotif).toBe(0);
    expect(lireChoix({ id: "civile", couleur: 0, motif: "course", teinteMotif: -1 })?.teinteMotif).toBe(0);
    expect(voitureChoisie(() => stockage({ id: "fusee" }))).toEqual({ ...CHOIX_DEFAUT });
    expect(CHOIX_DEFAUT).toEqual({ id: "civile", couleur: 0, motif: "course", teinteMotif: 0 });
  });
});

describe("la caisse tôle : arrondis, arêtes vives, bouts, lissage", () => {
  const sections = PLAN_CIVILE.cles.map(profilTole);

  it("le profil à onze points : les encadrements de la vitre sont glissés dans le flanc vitré", () => {
    for (const s of sections) {
      expect(s.pts).toHaveLength(11);
      expect(RAYONS_TOLE).toHaveLength(11);
    }
  });

  it("chaque coin arrondi a le même nombre de pas dans toutes les sections (mêmes sommets partout), et les arêtes vives n'en ont aucun", () => {
    const etapes = etapesDesCoins(sections, RAYONS_TOLE, 30);
    RAYONS_TOLE.forEach((r, k) => (r > 0 ? expect(etapes[k]).toBeGreaterThanOrEqual(1) : expect(etapes[k]).toBe(0)));
    const n = arrondirProfil(sections[0]!.pts, RAYONS_TOLE, etapes).pts.length;
    for (const s of sections) expect(arrondirProfil(s.pts, RAYONS_TOLE, etapes).pts).toHaveLength(n);
  });

  it("les bouts sont arrondis en plan : la largeur se resserre vers l'extrémité et le tout reste dans la silhouette", () => {
    const b = boutsArrondis(sections, 0.34, 0.4);
    const demi = (c: (typeof b)[number]) => Math.max(...c.pts.map((p) => p[0]));
    expect(demi(b[0]!)).toBeLessThan(demi(b[3]!));
    expect(demi(b[b.length - 1]!)).toBeLessThan(demi(b[b.length - 4]!));
    for (const c of b) expect(demi(c)).toBeLessThanOrEqual(1.06);
    for (let i = 1; i < b.length; i++) expect(b[i]!.z).toBeGreaterThan(b[i - 1]!.z);
  });

  it("le lissage ne moyenne que les faces d'un même groupe, et garde les arêtes plus vives que l'angle", () => {
    const p = new Pieces();
    const f: Fini = { couleur: new Color(0xffffff), groupe: 5 };
    const g: Fini = { couleur: new Color(0xffffff), groupe: 6 };
    // Deux faces à 90° (une arête vive) : chacune garde sa normale, même dans un groupe.
    p.quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], f);
    p.quad([0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0], f);
    const n = normalesLissees(p, 42);
    expect(Math.abs(n[2]!)).toBeCloseTo(1); // la première face : normale z
    expect(Math.abs(n[6 * 3 + 1]!)).toBeCloseTo(1); // la seconde : normale y
    // Deux faces à 30° dans deux groupes différents : pas de moyenne ; dans le même groupe : moyenne.
    const q = new Pieces();
    const c = Math.cos(Math.PI / 6);
    const s = Math.sin(Math.PI / 6);
    q.quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], f);
    q.quad([0, 0, 0], [0, 1, 0], [c * 0 + 0, 1, 0.0001], [0, 0, 0.0001], g);
    void s;
    const sep = normalesLissees(q, 42);
    expect(Math.abs(sep[2]!)).toBeCloseTo(1);
    const r = new Pieces();
    r.quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], f);
    r.quad([0, 0, 0], [0, 1, 0], [-c, 1, s], [-c, 0, s], f);
    if (r.nor[18 + 2]! < 0) {
      // Orientation opposée (ordre des sommets) : on réécrit la seconde face dans l'autre sens, pour qu'elle regarde du même côté que la première.
      r.pos.length = 18;
      r.nor.length = 18;
      for (const a of [r.col, r.pbr]) a.length = (a === r.col ? 4 : 3) * 6;
      r.spin.length = 6;
      r.recto.length = 6;
      r.livree.length = 6;
      r.lisses.length = 6;
      r.quad([0, 0, 0], [-c, 0, s], [-c, 1, s], [0, 1, 0], f);
    }
    const moy = normalesLissees(r, 42);
    // À l'origine, les deux faces partagent un sommet et sont à 30° : la normale de la première n'est plus z pur.
    expect(Math.abs(moy[2]!)).toBeLessThan(0.9999);
  });

  it("une boîte garde ses arêtes vives quand ses matières sont lissées (angles de 90°)", () => {
    const p = new Pieces();
    pave(p, 0, 1, 0, 1, 0, 1, { couleur: srgb(0xffffff), lisse: true });
    const n = normalesLissees(p, 42);
    for (let t = 0; t < p.triangles; t++) {
      const i = t * 9;
      for (let k = 0; k < 3; k++) expect([n[i + k * 3], n[i + k * 3 + 1], n[i + k * 3 + 2]]).toEqual([p.nor[i + k * 3], p.nor[i + k * 3 + 1], p.nor[i + k * 3 + 2]].map((x) => expect.closeTo(x!, 5)));
    }
  });
});
