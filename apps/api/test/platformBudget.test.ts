import { describe, expect, it } from "vitest";
import { CLASSEMENT_JOUR, FREE_TIER, JUMP_PLAYER, PORTAIL_VISITOR, SALON_HALF_HOUR, TRACK_PLAYER, classementReadsPerDay, projectMonth } from "../scripts/platformBudget";

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

  it("lot I2 : le visiteur du portail compte à part (une requête par chargement, aucune ligne écrite)", () => {
    const p = projectMonth({ jump: 0, track: 0, salon: 0, portail: 1000 });
    expect(p.byGame.Portail!.requests).toBe(30 * 1000 * PORTAIL_VISITOR.requests);
    expect(PORTAIL_VISITOR.requests).toBe(3); // lot I3 : 2 chargements de l'accueil + la page du classement du jour
    expect(PORTAIL_VISITOR.written).toBe(0);
    expect(projectMonth({ jump: 1, track: 1, salon: 0 }).byGame.Portail!.requests).toBe(0);
  });

  it("le joueur type de DailyJump : au plus 13 requêtes par jour (12 au lot P4 + « Jeu suivant du jour » du lot I3), hors pré-vols", () => {
    expect(JUMP_PLAYER.requests).toBeLessThanOrEqual(13);
  });

  it("lot I3 : le classement du jour est une charge par instance (1,9 ligne lue par joueur du jour et par fenêtre de 45 s), pas par visiteur", () => {
    expect(CLASSEMENT_JOUR.windowS).toBe(45);
    // Le pire cas à 10 000 joueurs du jour : 2 instances qui le recalculent toute la journée active, soit ≈ 1,1 × 10⁹ lignes lues par mois.
    expect(classementReadsPerDay(10_000)).toBe(Math.round(10_000 * 1.9 * ((12 * 3600) / 45) * 2));
    expect(classementReadsPerDay(100)).toBeLessThan(classementReadsPerDay(10_000) / 99);
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
