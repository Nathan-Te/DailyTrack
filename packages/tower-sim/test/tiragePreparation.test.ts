import { parseDay } from "@cdj/core";
import { beforeAll, describe, expect, it } from "vitest";
import { type Contenu, decoderRediffusion, lireJour, jsonJourFige, PLAFOND_DIAMANT_MM, type Rapier, type Rediffusion, REGLAGES_DEFAUT, TIRAGES_MAX, TOWER_SIM_VERSION } from "../src";
import { preparerJour } from "../src/bot";
import { chargerRapier } from "../src/rapier";

// Lot T3b — la boucle des tirages de `preparerJour` : essayer les tirages 0, 1, 2… et garder le premier dont le Diamant tombe dans [25 m ; 60 m], au plus TIRAGES_MAX, sinon le plus proche.
// Le bot (une minute par jour) est remplacé par des hauteurs données : c'est la RÈGLE qui est testée ici ; la vraie préparation est celle de tools/preparer.ts (mesurée dans le rapport).
const JOUR = parseDay("2026-11-17")!;
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

/** Un « bot » qui rend les hauteurs données, une par tirage essayé, et note les tirages demandés. */
function faux(hauteurs: number[]) {
  const appels: number[] = [];
  const essayer = (c: Contenu) => {
    const rediffusion: Rediffusion = { sim: TOWER_SIM_VERSION, g: c.g, contenu: c.tirage ? { jour: c.jour, tirage: c.tirage } : { jour: c.jour }, reglages: { ...REGLAGES_DEFAUT }, plages: [{ masque: 0, ticks: 1 }] };
    appels.push(c.tirage ?? 0);
    return { resultat: { hauteurMm: hauteurs[appels.length - 1]! } as never, rediffusion, variante: 0, compteurs: { ticks: 10 } as never, ticksTotal: 10 };
  };
  return { appels, essayer };
}

describe("preparerJour : la règle du tirage", () => {
  it("le tirage 0 dans la plage est gardé et la préparation s'arrête là", () => {
    const f = faux([40_000, 50_000]);
    const p = preparerJour(R, JOUR, 3, f.essayer);
    expect(f.appels).toEqual([0]);
    expect(p).toMatchObject({ tirage: 0, dedans: true, diamantMm: 40_000, hauteurMm: 40_000 });
    expect(p.fichier).toMatchObject({ g: 3, tirage: 0 });
    expect(p.fichier.medailles).toEqual({ auteur: 40_000, or: 20_000, argent: 12_000, bronze: 6_000 });
  });

  it("le jour qui ratait (4,1 m) est écarté : on garde le premier tirage suivant qui entre dans la plage, et la preuve est celle de CE tirage", () => {
    const f = faux([4_100, 14_700, 38_790, 50_000]);
    const p = preparerJour(R, JOUR, 3, f.essayer);
    expect(f.appels).toEqual([0, 1, 2]);
    expect(p).toMatchObject({ tirage: 2, dedans: true, diamantMm: 38_790 });
    expect(p.essais.map((e) => e.hauteurMm)).toEqual([4_100, 14_700, 38_790]);
    expect(p.fichier.tirage).toBe(2);
    expect(decoderRediffusion(p.fichier.preuve!).contenu).toEqual({ jour: JOUR, tirage: 2 });
  });

  it("aux bords de la plage : 25 000 mm est dedans, 24 999 mm non", () => {
    expect(preparerJour(R, JOUR, 3, faux([24_999, 25_000]).essayer)).toMatchObject({ tirage: 1, diamantMm: 25_000 });
    expect(preparerJour(R, JOUR, 3, faux([60_000]).essayer)).toMatchObject({ tirage: 0, diamantMm: 60_000 });
  });

  it("le plafond : un bot à 103,4 m donne un Diamant de 60 m dans la plage (tirage 0 gardé) ; la preuve reste la vraie partie du bot (hauteur non plafonnée)", () => {
    const f = faux([103_400]);
    const p = preparerJour(R, JOUR, 3, f.essayer);
    expect(f.appels).toEqual([0]);
    expect(p).toMatchObject({ tirage: 0, dedans: true, diamantMm: PLAFOND_DIAMANT_MM, hauteurMm: 103_400 });
    expect(p.fichier.medailles).toEqual({ auteur: 60_000, or: 30_000, argent: 18_000, bronze: 9_000 });
    expect(p.essais[0]).toMatchObject({ hauteurMm: 103_400, diamantMm: 60_000 });
  });

  it("aucun tirage dans la plage : TIRAGES_MAX essais au plus, puis le plus proche de la plage", () => {
    const f = faux([4_100, 14_700, 24_000, 9_000, 30_000, 30_000]);
    const p = preparerJour(R, JOUR, 3, f.essayer);
    expect(f.appels).toEqual([0, 1, 2, 3]);
    expect(f.appels).toHaveLength(TIRAGES_MAX);
    expect(p).toMatchObject({ tirage: 2, dedans: false, diamantMm: 24_000 });
    expect(p.fichier).toMatchObject({ tirage: 2 });
    expect(p.fichier.medailles!.auteur).toBe(24_000);
  });

  it("les générateurs 1 et 2 n'ont qu'un tirage et pas de plafond : un seul essai, le Diamant est la hauteur du bot", () => {
    for (const g of [1, 2]) {
      const f = faux([103_400, 40_000]);
      const p = preparerJour(R, JOUR, g, f.essayer);
      expect(f.appels).toEqual([0]);
      expect(p).toMatchObject({ tirage: 0, diamantMm: 103_400 });
      expect(Object.keys(p.fichier)).not.toContain("tirage");
    }
  });

  it("le fichier produit se relit (le tirage est lu dans le fichier) et se réécrit au même texte", () => {
    const p = preparerJour(R, JOUR, 3, faux([4_100, 33_000]).essayer);
    const texte = jsonJourFige(p.fichier);
    const lu = lireJour(JSON.parse(texte) as unknown, JOUR);
    expect(typeof lu).toBe("object");
    if (typeof lu === "string") return;
    expect(lu.contenu.tirage).toBe(1);
    expect(lu.medailles!.auteur).toBe(33_000);
  });
});
