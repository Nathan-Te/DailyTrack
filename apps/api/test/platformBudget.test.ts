import { describe, expect, it } from "vitest";
import { FREE_TIER, JUMP_PLAYER, SALON_HALF_HOUR, TRACK_PLAYER, projectMonth } from "../scripts/platformBudget";

// Lot P4 (plateforme) : `npm run measure:platform -w @cdj/api` projette le coût d'un mois à partir des joueurs par jour de chaque jeu. Calcul pur :
// proportionnel aux joueurs, chaque jeu compté à part, l'offre gratuite et ce qui la dépasse.

describe("projection du mois (measure:platform)", () => {
  it("sans joueur : rien ; marge infinie", () => {
    const p = projectMonth({ jump: 0, track: 0, salon: 0 });
    expect(p.resources.every((r) => r.used === 0 && r.share === 0)).toBe(true);
    expect(p.firstLimit).toBeNull();
    expect(p.headroom).toBe(Number.POSITIVE_INFINITY);
  });

  it("lot R5 : plus de pré-vols CORS (l'API est servie sous la même adresse) ; chaque jeu à part ; 30 jours", () => {
    const p = projectMonth({ jump: 100, track: 10, salon: 1 });
    for (const unit of [JUMP_PLAYER, TRACK_PLAYER, SALON_HALF_HOUR]) expect(Object.keys(unit)).not.toContain("preflights");
    expect(p.resources[0]!.name).not.toMatch(/pré-vol/);
    expect(p.byGame.DailyJump!.requests).toBe(30 * 100 * JUMP_PLAYER.requests);
    expect(p.byGame.DailyTrack!.requests).toBe(30 * 10 * TRACK_PLAYER.requests);
    expect(p.byGame.Salon!.requests).toBe(30 * SALON_HALF_HOUR.requests);
    expect(p.resources[0]!.used).toBe(p.byGame.DailyJump!.requests + p.byGame.DailyTrack!.requests + p.byGame.Salon!.requests);
  });

  it("le joueur type de DailyJump du lot P4 : au plus 12 requêtes par jour (hors pré-vols)", () => {
    expect(JUMP_PLAYER.requests).toBeLessThanOrEqual(12);
  });

  it("au-delà de l'offre gratuite : le premier plafond est nommé, Cloud Run chiffré, Turso renvoyé à son offre payante", () => {
    const p = projectMonth({ jump: 0, track: 0, salon: 200 });
    expect(p.firstLimit).not.toBeNull();
    const vcpu = p.resources.find((r) => r.name.startsWith("calcul"))!;
    expect(vcpu.used).toBeGreaterThan(FREE_TIER.vcpuS);
    expect(vcpu.overUsd).toBeCloseTo((vcpu.used - FREE_TIER.vcpuS) * 0.000024, 6);
    expect(p.resources.find((r) => r.name.includes("Turso"))!.overUsd).toBeNull();
    expect(p.headroom).toBeLessThan(1);
  });

  it("la marge est l'inverse de la part la plus haute (tout est proportionnel aux joueurs)", () => {
    const p = projectMonth({ jump: 500, track: 100, salon: 5 });
    const worst = Math.max(...p.resources.map((r) => r.share));
    expect(p.headroom).toBeCloseTo(1 / worst, 9);
  });
});
