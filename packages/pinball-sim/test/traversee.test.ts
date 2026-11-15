import { describe, expect, it } from "vitest";
import { Rng } from "@cdj/core";
import { AXE, DROITE, EV_PERDUE, EV_SAUVEE, GAUCHE, UNITE, Partie, pointeDuBatteur, racine, REGLAGES } from "../src/index";
import { contenuDe, enJeu, pleine } from "./aide";

// **La bille ne traverse jamais un mur ni un batteur, même à sa vitesse maximale** (règle du lot PB1). À 600 pas par seconde et 1 500 px/s, la bille avance de 2,5 px par pas ; son rayon est de 9 px, la capsule d'un batteur
// a au moins 5 px de rayon et sa pointe avance de 2,4 px par pas : il faudrait une avance de plus de 14 px en un pas pour sauter une paroi. Ici on le prouve sur des milliers de tirs au hasard (graine fixe) : la bille est
// lancée à 1 500 px/s dans toutes les directions, depuis tout le plateau, pendant que les batteurs montent et descendent au hasard, et à chaque pas on vérifie qu'elle est du bon côté de chaque paroi.

const VMAX = REGLAGES.vitesseMax;
const PX = (u: number): number => u / UNITE;

/** La distance (px) du centre de la bille à un segment (coordonnées en unités). */
function distanceSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax;
  const ey = by - ay;
  const l2 = ex * ex + ey * ey;
  let u = l2 === 0 ? 0 : ((x - ax) * ex + (y - ay) * ey) / l2;
  u = Math.max(0, Math.min(1, u));
  return PX(Math.hypot(x - (ax + ex * u), y - (ay + ey * u)));
}

/** Le centre de la bille est-il dans la table (mur gauche, arc du haut, mur droit) ? Tolérance en px. */
function dansLaTable(x: number, y: number, marge: number): boolean {
  const X = PX(x);
  const Y = PX(y);
  if (X < 20 + marge || X > 372.5 - marge) return false;
  if (Y < 205) return Math.hypot(X - 196.25, Y - 205) <= 176.25 - marge;
  return true;
}

function tir(graine: number, i: number): { p: Partie; vx: number; vy: number } {
  const rng = new Rng(graine + i);
  const p = new Partie(contenuDe(rng.int(3) === 0 ? pleine("bumpers") : undefined));
  // un point de départ libre dans le plateau : à 14 px au moins de tout obstacle (une bille posée dans un mur en serait chassée d'un coup, ce qui n'est pas ce qu'on mesure)
  let x = 0;
  let y = 0;
  for (;;) {
    x = 30 + rng.int(310);
    y = 40 + rng.int(640);
    if (!dansLaTable(x * UNITE, y * UNITE, 14)) continue;
    if (p.table.murs.some((s) => distanceSegment(x * UNITE, y * UNITE, s.ax, s.ay, s.bx, s.by) < 14)) continue;
    if ([...p.table.poteaux, ...p.table.bumpers, ...p.table.trous].some((c) => PX(Math.hypot(x * UNITE - c.x, y * UNITE - c.y)) < 14 + PX(c.r))) continue;
    if (y > 560) continue;
    break;
  }
  const angle = rng.int(360);
  const vx = (Math.cos((angle * Math.PI) / 180) * VMAX) | 0;
  const vy = (Math.sin((angle * Math.PI) / 180) * VMAX) | 0;
  enJeu(p, x, y, vx, vy);
  return { p, vx, vy };
}

describe("la bille ne traverse aucun mur", () => {
  it("1 500 tirs à 1 500 px/s dans toutes les directions : jamais du mauvais côté d'une paroi ni hors de la table", () => {
    let pas = 0;
    let pertes = 0;
    for (let i = 0; i < 1500; i++) {
      const { p } = tir(7, i);
      for (let k = 0; k < 1200 && !p.finie; k++) {
        const avantX = p.x;
        const avantY = p.y;
        p.avancer();
        pas++;
        // elle ne descend sous la ligne des batteurs (y = 700) que par l'ouverture entre eux : de pivot à pivot
        if (avantY <= 700 * UNITE && p.y > 700 * UNITE && PX(p.x) < 340 && !(p.ev & (EV_PERDUE | EV_SAUVEE))) {
          expect(PX(p.x), `tir ${i}, pas ${k} : la bille passe sous les batteurs en x = ${PX(p.x).toFixed(1)}`).toBeGreaterThan(112);
          expect(PX(p.x), `tir ${i}, pas ${k} : la bille passe sous les batteurs en x = ${PX(p.x).toFixed(1)}`).toBeLessThan(2 * AXE - 112);
        }
        if (p.ev & (EV_PERDUE | EV_SAUVEE)) {
          pertes++;
          break;
        }
        if (p.dansLanceur || p.captif > 0) continue;
        if (!dansLaTable(p.x, p.y, 9 - 3)) throw new Error(`tir ${i}, pas ${k} : la bille est sortie de la table en (${PX(p.x).toFixed(1)}, ${PX(p.y).toFixed(1)})`);
        // le couloir du lanceur : on ne le traverse que par l'ouverture du haut (au-dessus de y = 255)
        if (PX(p.y) > 262 && Math.abs(PX(p.x) - 348) < 1.5 && PX(p.y) < 700) throw new Error(`tir ${i}, pas ${k} : la bille a traversé le mur du couloir du lanceur en y = ${PX(p.y).toFixed(1)}`);
        for (const s of p.table.murs) {
          if (s.type === 2 && p.bas[p.table.murs.indexOf(s)]) continue; // une cible tombée n'est plus un obstacle
          const d = distanceSegment(p.x, p.y, s.ax, s.ay, s.bx, s.by);
          if (d < 9 - 3.2) throw new Error(`tir ${i}, pas ${k} : la bille est à ${d.toFixed(2)} px d'un mur (en ${PX(p.x).toFixed(1)}, ${PX(p.y).toFixed(1)})`);
        }
      }
    }
    expect(pas).toBeGreaterThan(500000);
    expect(pertes).toBeGreaterThan(50);
  });
  it("jamais plus de 2,5 px par pas, même quand tout pousse la bille", () => {
    let max = 0;
    for (let i = 0; i < 300; i++) {
      const { p } = tir(11, i);
      for (let k = 0; k < 600 && !p.finie; k++) {
        const x = p.x;
        const y = p.y;
        p.avancer();
        if (p.captif > 0 || p.dansLanceur || p.ev & (EV_PERDUE | EV_SAUVEE)) break;
        max = Math.max(max, PX(Math.hypot(p.x - x, p.y - y)));
      }
    }
    // 2,5 px de vitesse, plus la poussée d'un contact (au plus le recouvrement de 2,5 px) et la pointe d'un batteur (2,4 px)
    expect(max).toBeLessThan(2.5 + 2.5 + 2.4 + 1);
  });
});

describe("la bille ne traverse aucun batteur", () => {
  it("1 500 tirs sur les batteurs, qui montent et descendent au hasard : le centre reste hors de leur corps", () => {
    let frappes = 0;
    for (let i = 0; i < 1500; i++) {
      const rng = new Rng(5000 + i);
      const p = new Partie(contenuDe(pleine("trou")));
      const droite = rng.int(2) === 1;
      // un point au-dessus du batteur visé, et une direction qui le vise ; à la vitesse maximale (plus ou moins)
      const cx = droite ? 2 * AXE - 112 - 55 + rng.int(60) : 112 + 55 - 60 + rng.int(60) + 60;
      const x = cx + rng.int(40) - 20;
      const y = 560 + rng.int(60);
      const cible = { x: droite ? 2 * AXE - 112 - 30 : 112 + 30, y: 645 };
      const dx = cible.x + rng.int(40) - 20 - x;
      const dy = cible.y - y;
      const n = racine(dx * dx + dy * dy);
      const v = rng.int(3) === 0 ? VMAX : 300 + rng.int(VMAX - 300);
      enJeu(p, x, y, Math.trunc((dx * v) / n), Math.trunc((dy * v) / n));
      const plan = Array.from({ length: 8 }, () => ({ tick: rng.int(250), c: rng.int(2) as 0 | 1, e: rng.int(2) === 1 }));
      for (let k = 0; k < 400 && !p.finie; k++) {
        for (const e of plan) if (e.tick === k) p.regler(e.c, e.e);
        p.avancer();
        if (p.ev & (EV_PERDUE | EV_SAUVEE) || p.dansLanceur) break;
        for (const b of [GAUCHE, DROITE] as const) {
          const { px, py, tx, ty } = pointeDuBatteur(b, p.a[b]!);
          const d = distanceSegment(p.x, p.y, px, py, tx, ty);
          if (d < 5 - 0.01) throw new Error(`tir ${i}, pas ${k} : le centre de la bille est à ${d.toFixed(2)} px de l'axe du batteur ${b} (dans son corps)`);
          if (d < 9 + 8) frappes++;
        }
      }
    }
    expect(frappes).toBeGreaterThan(5000); // les tirs touchent bien les batteurs
  });
  it("un tir de plein fouet à 1 500 px/s sur un batteur qui monte à toute vitesse rebondit", () => {
    for (const b of [GAUCHE, DROITE] as const) {
      const p = new Partie(contenuDe(pleine("trou")));
      const { px, py } = pointeDuBatteur(b, p.a[b]!);
      const x = PX(px) + (b === GAUCHE ? 35 : -35);
      enJeu(p, x, 590, 0, 1500);
      p.regler(b, true);
      let dessous = false;
      for (let k = 0; k < 120 && !(p.ev & (EV_PERDUE | EV_SAUVEE)); k++) {
        p.avancer();
        if (PX(p.y) > PX(py) + 20) dessous = true;
        if (p.vy < 0) break;
      }
      expect(dessous, "la bille est passée sous le batteur").toBe(false);
      expect(p.vy).toBeLessThan(0);
    }
  });
});
