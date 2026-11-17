import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CASE, FACTEUR_V3, VITESSE_MAX, VITESSE_PLAFOND, vitesseCamera, REGLES_COURANTES } from "@cdj/gravity-sim";
import { NB_LIGNES, RECUL_MAX, SEUIL_LIGNES, VITESSE_PLEINE, departDuTrait, intensiteLignes, lisser, reculVoulu, tirerLesTraits } from "../src/vitesse";

// Lot GR6 — les lignes de vitesse et le recul de la caméra : un seuil nommé, une intensité et un recul proportionnels à (vitesse − seuil), bornés, lissés ; rien de tout cela ne touche la simulation.
describe("le seuil, l'intensité et le recul", () => {
  it("le seuil est juste au-dessus de la montée normale (12,5 cases/s) : seul un portail de vitesse le franchit", () => {
    expect(VITESSE_MAX / CASE).toBe(12.5);
    expect(SEUIL_LIGNES).toBeGreaterThan(VITESSE_MAX / CASE);
    expect(vitesseCamera(10 ** 9, REGLES_COURANTES, 100) / CASE).toBeLessThan(SEUIL_LIGNES); // sans portail : jamais de lignes
    expect(vitesseCamera(10 ** 9, REGLES_COURANTES, FACTEUR_V3) / CASE).toBeGreaterThan(SEUIL_LIGNES); // ››› : des lignes
    expect(VITESSE_PLEINE).toBe(VITESSE_PLAFOND / CASE);
  });
  it("nul sous le seuil, croissant au-dessus, borné au plafond de la simulation", () => {
    expect(intensiteLignes(7)).toBe(0);
    expect(intensiteLignes(SEUIL_LIGNES)).toBe(0);
    expect(reculVoulu(SEUIL_LIGNES)).toBe(0);
    let avant = 0;
    for (let v = SEUIL_LIGNES; v <= VITESSE_PLEINE; v += 0.25) {
      expect(intensiteLignes(v)).toBeGreaterThanOrEqual(avant);
      avant = intensiteLignes(v);
    }
    expect(intensiteLignes(VITESSE_PLEINE)).toBe(1);
    expect(intensiteLignes(40)).toBe(1);
    expect(reculVoulu(VITESSE_PLEINE)).toBe(RECUL_MAX);
    expect(reculVoulu(100)).toBe(RECUL_MAX);
    expect(reculVoulu((SEUIL_LIGNES + VITESSE_PLEINE) / 2)).toBeCloseTo(RECUL_MAX / 2, 10); // proportionnel
    expect(RECUL_MAX).toBeLessThan(2); // léger : le héros reste à plus de deux cases du bord
  });
  it("le lissage ne bouge pas quand le temps ne passe pas (la pause) et se rapproche sans dépasser", () => {
    expect(lisser(0.4, 1, 0, 3)).toBe(0.4);
    const un = lisser(0, 1, 0.1, 3);
    expect(un).toBeGreaterThan(0);
    expect(un).toBeLessThan(1);
    expect(lisser(un, 1, 0.1, 3)).toBeGreaterThan(un);
    expect(lisser(0, 1, 100, 3)).toBeCloseTo(1, 6);
  });
});

describe("les lignes", () => {
  it("les traits sont tirés par un générateur entier : les mêmes à chaque appel, dans la vue", () => {
    const a = tirerLesTraits();
    expect(a).toHaveLength(NB_LIGNES);
    expect(tirerLesTraits()).toEqual(a);
    for (const t of a) {
      expect(t.y).toBeGreaterThanOrEqual(-0.5);
      expect(t.y).toBeLessThanOrEqual(0.5);
      expect(t.longueur).toBeGreaterThan(2);
      expect(t.phase).toBeGreaterThanOrEqual(0);
      expect(t.phase).toBeLessThan(1);
    }
  });
  it("un trait file vers la gauche avec le temps, plus vite avec la vitesse, et reparaît à droite ; le temps figé les fige", () => {
    const t = tirerLesTraits()[3]!;
    const x0 = departDuTrait(t, 0, 14, 20);
    expect(departDuTrait(t, 0, 14, 20)).toBe(x0);
    const x1 = departDuTrait(t, 0.05, 14, 20);
    const dx = (x0 - x1 + 20 + t.longueur) % (20 + t.longueur);
    expect(dx).toBeGreaterThan(0);
    const y1 = departDuTrait(t, 0.05, 28, 20);
    expect(((x0 - y1 + 20 + t.longueur) % (20 + t.longueur)) > dx).toBe(true);
    for (let temps = 0; temps < 60; temps += 0.7) {
      const x = departDuTrait(t, temps, 16, 20);
      expect(x).toBeGreaterThanOrEqual(-t.longueur);
      expect(x).toBeLessThan(20);
    }
  });
  it("aucun hasard ni horloge murale dans le fichier (tout suit les pas)", () => {
    const code = readFileSync(new URL("../src/vitesse.ts", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/Math\.random|Date\.now|new Date\(|performance\.now/);
  });
});
