import { describe, expect, it } from "vitest";
import { Box3, Mesh, type Object3D } from "three";
import { AXLE_FRONT, AXLE_REAR, HALF_TRACK } from "@cdj/sim";
import { VOITURES_ESSAI, buildQuery, DEFAULT_ADMIN } from "../src/adminLogic";
import { WHEEL_RADIUS } from "../src/carMesh";
import { VOITURES, VOITURE_DEFAUT, ficheVoiture } from "../src/voiture/catalogue";
import { CHOIX_DEFAUT, CLE_GARAGE, choisirVoiture, choixDeLAdresse, estDebloquee, lireChoix, voitureChoisie, type ChoixVoiture, type Progres } from "../src/voiture/choix";
import { VoitureEnJeu, type OptionsVoitureEnJeu } from "../src/voiture/enJeu";
import { LIVREE, PALETTE } from "../src/voiture/livree";
import { MATERIAUX_2 } from "../src/voiture/materiaux2";
import { construireFantome, construireVoiture } from "../src/voiture/modele";
import { PLAN_CIVILE } from "../src/voiture/modeleCivile";

// Retouche 40b : le catalogue des voitures (contrat des lots 40b, 41, 42), le choix gardé dans le navigateur, et la voiture du jeu (chargée à la
// demande, jamais remplacée en course). Les voitures sont purement cosmétiques : rien ici ne touche à la simulation.

const maillages = (o: Object3D): Mesh[] => {
  const out: Mesh[] = [];
  o.traverse((x) => {
    if ((x as Mesh).isMesh) out.push(x as Mesh);
  });
  return out;
};

describe("le catalogue (contrat commun)", () => {
  it("quatre voitures ; une seule par défaut, la civile ; `abonnement` réservé (aucune voiture ne l'utilise)", () => {
    expect(VOITURES.map((v) => v.id)).toEqual(["civile", "evolution", "gt", "proto"]);
    expect(VOITURES.filter((v) => v.deblocage.type === "defaut").map((v) => v.id)).toEqual([VOITURE_DEFAUT]);
    expect(VOITURE_DEFAUT).toBe("civile");
    expect(VOITURES.some((v) => v.deblocage.type === "abonnement")).toBe(false);
    for (const v of VOITURES) {
      expect(v.nom).toBe(`voiture.${v.id}.nom`);
      expect(v.description).toBe(`voiture.${v.id}.description`);
    }
    // La page d'admin propose les mêmes voitures (elle n'importe pas le catalogue : il tire les modèles).
    expect([...VOITURES_ESSAI]).toEqual(VOITURES.map((v) => v.id));
  });

  for (const fiche of VOITURES) {
    describe(fiche.id, async () => {
      const plan = await fiche.charger();
      const p1 = construireVoiture(plan, { palier: 1, couleur: LIVREE.orange, numero: "8" });
      const p2 = construireVoiture(plan, { palier: 2, couleur: LIVREE.orange, numero: "8", materiaux: MATERIAUX_2 });

      it("se construit : six maillages au plus, ≤ 2 600 triangles au palier 1, ≤ 6 000 aux paliers 2 et 3", () => {
        for (const v of [p1, p2]) expect(maillages(v.group).length).toBeLessThanOrEqual(6);
        expect(p1.triangles).toBeLessThanOrEqual(2600);
        expect(p2.triangles).toBeLessThanOrEqual(6000);
      });

      it("son fantôme simple : un maillage, ≈ 400 triangles", () => {
        const f = construireFantome(plan, 0xff4fa3);
        expect(maillages(f.group)).toHaveLength(1);
        expect(f.triangles).toBeGreaterThan(300);
        expect(f.triangles).toBeLessThan(460);
      });

      it("ses roues sont aux points de contact de la simulation (même gabarit pour toutes les voitures)", () => {
        expect(maillages(p1.group).slice(2).map((r) => [r.position.x, r.position.y, r.position.z])).toEqual([
          [HALF_TRACK, WHEEL_RADIUS, AXLE_FRONT],
          [-HALF_TRACK, WHEEL_RADIUS, AXLE_FRONT],
          [HALF_TRACK, WHEEL_RADIUS, -AXLE_REAR],
          [-HALF_TRACK, WHEEL_RADIUS, -AXLE_REAR],
        ]);
        p2.group.updateMatrixWorld(true);
        const b = new Box3().setFromObject(p2.group, true);
        expect(Math.max(-b.min.x, b.max.x)).toBeLessThanOrEqual(1.06);
      });

      it("trois motifs de livrée, la Nuit : la géométrie ne bouge pas", () => {
        const n = p1.triangles;
        for (const m of ["bande", "flancs", "unie"] as const) p1.peindre(PALETTE[5]!.hex, "12", m);
        p1.nuit(true);
        p1.nuit(false);
        expect(p1.triangles).toBe(n);
      });
    });
  }
});

/** Un stockage en mémoire. */
function memoire(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}
const RIEN: Progres = { jours: 0, or: 0, auteur: 0 };
const TOUT: Progres = { jours: 100, or: 100, auteur: 100 };

describe("le choix (cdj:track:garage)", () => {
  it("rien d'enregistré, illisible, inconnu : la civile en orange de Track", () => {
    expect(voitureChoisie(() => TOUT, () => memoire())).toEqual(CHOIX_DEFAUT);
    expect(CHOIX_DEFAUT).toEqual({ id: "civile", couleur: 0, motif: "bande" });
    expect(PALETTE[CHOIX_DEFAUT.couleur]!.hex).toBe(LIVREE.orange);
    for (const brut of ["{", "null", "42", JSON.stringify({ id: "fusee", couleur: 0, motif: "bande" }), JSON.stringify({ id: "proto", couleur: 9, motif: "bande" }), JSON.stringify({ id: "proto", couleur: 1, motif: "pois" })]) {
      expect(voitureChoisie(() => TOUT, () => memoire({ [CLE_GARAGE]: brut })), brut).toEqual(CHOIX_DEFAUT);
    }
  });

  it("une voiture non débloquée retombe sur la civile en orange de Track ; débloquée, elle est rendue telle quelle", () => {
    const choix: ChoixVoiture = { id: "proto", couleur: 5, motif: "flancs" };
    const s = memoire({ [CLE_GARAGE]: JSON.stringify(choix) });
    expect(voitureChoisie(() => RIEN, () => s)).toEqual(CHOIX_DEFAUT);
    expect(voitureChoisie(() => ({ jours: 50, or: 50, auteur: 2 }), () => s)).toEqual(CHOIX_DEFAUT); // 3 médailles d'auteur
    expect(voitureChoisie(() => ({ jours: 0, or: 0, auteur: 3 }), () => s)).toEqual(choix);
    // La civile en une autre couleur : toujours permise.
    const civile: ChoixVoiture = { id: "civile", couleur: 3, motif: "unie" };
    expect(voitureChoisie(() => RIEN, () => memoire({ [CLE_GARAGE]: JSON.stringify(civile) }))).toEqual(civile);
  });

  it("déblocages : jours joués, médailles d'or (ou mieux), médailles d'auteur ; jamais par abonnement pour l'instant", () => {
    const f = (id: string) => ficheVoiture(id)!;
    expect(estDebloquee(f("civile"), RIEN)).toBe(true);
    expect(estDebloquee(f("evolution"), { ...RIEN, jours: 6 })).toBe(false);
    expect(estDebloquee(f("evolution"), { ...RIEN, jours: 7 })).toBe(true);
    expect(estDebloquee(f("gt"), { ...RIEN, or: 5 })).toBe(true);
    expect(estDebloquee(f("proto"), { ...RIEN, or: 50, auteur: 2 })).toBe(false);
    expect(estDebloquee({ ...f("proto"), deblocage: { type: "abonnement" } }, TOUT)).toBe(false);
  });

  it("choisirVoiture enregistre un choix lisible sous cdj:track:garage, et refuse un choix illisible", () => {
    const s = memoire();
    expect(choisirVoiture({ id: "gt", couleur: 2, motif: "unie" }, () => s)).toBe(true);
    expect(JSON.parse(s.m.get(CLE_GARAGE)!)).toEqual({ id: "gt", couleur: 2, motif: "unie" });
    expect(choisirVoiture({ id: "gt", couleur: 8, motif: "unie" }, () => s)).toBe(false);
    expect(lireChoix({ id: "gt", couleur: 2.5, motif: "unie" })).toBeNull();
  });

  it("?voiture=<id>&couleur=<n>&motif=<m> : la voiture telle quelle (sans déblocage) ; inconnue ou absente : rien", () => {
    expect(choixDeLAdresse(new URLSearchParams("voiture=proto&couleur=5&motif=flancs"))).toEqual({ id: "proto", couleur: 5, motif: "flancs" });
    expect(choixDeLAdresse(new URLSearchParams("voiture=gt"))).toEqual({ id: "gt", couleur: 0, motif: "bande" });
    expect(choixDeLAdresse(new URLSearchParams("voiture=fusee"))).toBeNull();
    expect(choixDeLAdresse(new URLSearchParams("voiture=gt&couleur=12"))).toBeNull();
    expect(choixDeLAdresse(new URLSearchParams("home=0"))).toBeNull();
    // La page d'admin l'écrit ainsi.
    expect(buildQuery({ ...DEFAULT_ADMIN, voiture: "proto", couleur: "5", motif: "flancs" })).toBe("voiture=proto&couleur=5&motif=flancs");
  });
});

describe("la voiture du jeu (chargée à la demande, jamais remplacée en course)", () => {
  const options = (o: Partial<OptionsVoitureEnJeu> & { etat: { choix: ChoixVoiture; palier: 1 | 2; libre: boolean; adoptees: number } }): OptionsVoitureEnJeu => ({
    choix: () => o.etat.choix,
    numero: () => "8",
    palier: () => o.etat.palier,
    nuit: () => false,
    peutChanger: () => o.etat.libre,
    adopter: () => void o.etat.adoptees++,
    materiaux2: () => Promise.resolve(MATERIAUX_2),
  });
  const attendre = () => new Promise((r) => setTimeout(r, 0));

  it("la civile est là tout de suite ; la voiture choisie la remplace quand elle est chargée et que le jeu le permet", async () => {
    const etat = { choix: { id: "proto", couleur: 5, motif: "flancs" } as ChoixVoiture, palier: 1 as 1 | 2, libre: false, adoptees: 0 };
    const g = new VoitureEnJeu(options({ etat }));
    expect(maillages(g.voiture.group)).toHaveLength(6);
    const civile = g.voiture;
    expect(civile.triangles).toBe(construireVoiture(PLAN_CIVILE, { palier: 1, couleur: 0, numero: "8" }).triangles);
    g.tick();
    await attendre();
    g.tick();
    // En course (le jeu ne permet pas) : on garde la civile.
    expect(g.voiture).toBe(civile);
    expect(g.aJour).toBe(false);
    etat.libre = true; // pause, accueil, décompte, arrivée
    g.tick();
    expect(g.voiture).not.toBe(civile);
    expect(etat.adoptees).toBe(1);
    expect(g.aJour).toBe(true);
    // Le palier 2 (qualité haute) : chargé à la demande, puis remplacé de même.
    etat.palier = 2;
    g.tick();
    await attendre();
    g.tick();
    expect(etat.adoptees).toBe(2);
    expect(g.aJour).toBe(true);
  });

  it("le choix de la civile au palier 1 : rien à charger, rien à remplacer", async () => {
    const etat = { choix: { ...CHOIX_DEFAUT }, palier: 1 as 1 | 2, libre: true, adoptees: 0 };
    const g = new VoitureEnJeu(options({ etat }));
    g.tick();
    await attendre();
    g.tick();
    expect(etat.adoptees).toBe(0);
    expect(g.stats.chargements).toBe(0);
    expect(g.aJour).toBe(true);
  });
});
