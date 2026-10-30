import { describe, expect, it } from "vitest";
import { moteurA } from "../lab/a/moteurA";
import { chargerMoteurB } from "../lab/b/moteurB";
import { DEFAULT_CONFIG, type Engine, type PieceSpec } from "../lab/interface";

// Lot T0 — les deux moteurs obéissent à la même physique élémentaire (mêmes tests, mêmes bornes) : ce que fait une pièce seule, le frottement, le rebond, le sommeil.
async function moteurs(): Promise<Engine[]> {
  return [moteurA(), await chargerMoteurB()];
}

function simuler(e: Engine, specs: PieceSpec[], pas: number, config = DEFAULT_CONFIG) {
  const w = e.createWorld(config);
  for (const s of specs) e.addPiece(w, s);
  for (let i = 0; i < pas; i++) e.step(w);
  return { w, snap: e.snapshot(w) };
}

describe("physique élémentaire des deux moteurs", () => {
  it("un carré lâché de 3 m se pose à plat sur la plateforme (à 2 cm près) et s'endort", async () => {
    for (const e of await moteurs()) {
      const { snap } = simuler(e, [{ kind: "O", rot: 0, x8: 0, y8: 8 * 4, vx8: 0, vy8: 0 }], 300);
      const p = snap.pieces[0]!;
      expect(p.y, e.name).toBeGreaterThan(0.97);
      expect(p.y, e.name).toBeLessThan(1.02);
      expect(Math.abs(p.x), e.name).toBeLessThan(0.02);
      expect(Math.abs(p.angle), e.name).toBeLessThan(0.01);
      expect(p.asleep, e.name).toBe(true);
    }
  });

  it("une pièce lancée sur la plateforme glisse puis s'arrête par frottement ; sans frottement elle glisse bien plus loin", async () => {
    for (const e of await moteurs()) {
      const lance: PieceSpec = { kind: "I", rot: 0, x8: -16, y8: 4, vx8: 40, vy8: 0 }; // 5 m/s, posée à plat
      const avec = simuler(e, [lance], 240).snap.pieces[0]!;
      const sans = simuler(e, [lance], 240, { ...DEFAULT_CONFIG, frictionPct: 0, platformHalf8: 400 }).snap.pieces[0]!;
      expect(avec.x, e.name).toBeLessThan(0.5 + 1.5); // v²/(2µg) = 25/(2 × 0,6 × 9,81) ≈ 2,1 m, départ −2 m
      expect(avec.x, e.name).toBeGreaterThan(-2);
      expect(sans.x, e.name).toBeGreaterThan(8); // 5 m/s pendant 4 s ≈ 20 m, la plateforme est élargie : elle n'a pas freiné
    }
  });

  it("le rebond : un carré lâché rebondit avec du rebond, pas sans", async () => {
    for (const e of await moteurs()) {
      const haut = (pct: number): number => {
        const w = e.createWorld({ ...DEFAULT_CONFIG, restitutionPct: pct, sleep: false });
        e.addPiece(w, { kind: "O", rot: 0, x8: 0, y8: 8 * 6, vx8: 0, vy8: 0 });
        let max = 0;
        let touche = false;
        for (let i = 0; i < 240; i++) {
          e.step(w);
          const y = e.snapshot(w).pieces[0]!.y;
          if (!touche && y < 1.1) touche = true;
          else if (touche && y > max) max = y;
        }
        return max;
      };
      expect(haut(0), e.name).toBeLessThan(1.2);
      expect(haut(60), e.name).toBeGreaterThan(1.8);
    }
  });

  it("deux carrés empilés restent empilés ; un carré trop décalé bascule et tombe", async () => {
    for (const e of await moteurs()) {
      const base: PieceSpec = { kind: "O", rot: 0, x8: 0, y8: 8, vx8: 0, vy8: 0 };
      const ok = simuler(e, [base, { kind: "O", rot: 0, x8: 4, y8: 24, vx8: 0, vy8: 0 }], 360).snap;
      expect(ok.pieces.every((p) => !p.lost), e.name).toBe(true);
      const pire = simuler(e, [{ ...base, x8: 16 }, { kind: "O", rot: 0, x8: 16 + 20, y8: 24, vx8: 0, vy8: 0 }], 480).snap;
      expect(pire.pieces[1]!.lost, e.name).toBe(true);
    }
  });

  it("une pièce qui tombe de la plateforme est déclarée perdue et son état est gelé", async () => {
    for (const e of await moteurs()) {
      const { w, snap } = simuler(e, [{ kind: "I", rot: 0, x8: 8 * 6, y8: 8 * 3, vx8: 0, vy8: 0 }], 200);
      expect(snap.pieces[0]!.lost, e.name).toBe(true);
      for (let i = 0; i < 60; i++) e.step(w);
      expect(e.snapshot(w).pieces[0], e.name).toEqual(snap.pieces[0]);
    }
  });

  it("une pièce qui tombe sur une tour endormie la réveille", async () => {
    for (const e of await moteurs()) {
      const w = e.createWorld(DEFAULT_CONFIG);
      e.addPiece(w, { kind: "O", rot: 0, x8: 0, y8: 8, vx8: 0, vy8: 0 });
      for (let i = 0; i < 400; i++) e.step(w);
      expect(e.awake(w), e.name).toBe(0);
      e.addPiece(w, { kind: "I", rot: 0, x8: 0, y8: 8 * 5, vx8: 0, vy8: -24 });
      let eveil = 0;
      for (let i = 0; i < 90; i++) {
        e.step(w);
        eveil = Math.max(eveil, e.awake(w));
      }
      expect(eveil, e.name).toBe(2);
    }
  });
});
