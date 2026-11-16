import { TICKS_PAR_SECONDE, UNITE, type Partie, type ThemePinball } from "@cdj/pinball-sim";
import { MODELES } from "./index";
import { placements } from "./placements";
import { ENCRE, MOUTARDE, meler, rond } from "./types";

// Lot PBV4 : les modules communs du rendu à plat (le rendu de secours), une icône vue de dessus par thème (`MODELES[theme].plat`). **Le retour au contact est ici, le même dans tous les thèmes**, comme en volume
// (`trois.ts`) : un bumper touché s'enfonce (son haut rapetisse) et son socle s'allume, avec une onde ; une cible touchée tombe (il n'en reste qu'une trace pointillée) ; un spinner tourne au passage ; un trou
// s'allume quand il garde la bille. Rien d'autre ne passe par `dessin.ts` qu'un appel par famille.

export interface ModulesAPlat {
  /** Les trous (sous les rails et la bille). */
  trous(c: CanvasRenderingContext2D, tick: number): void;
  /** Les spinners, les cibles et les bumpers (par-dessus les rails). */
  dessus(c: CanvasRenderingContext2D): void;
}

const ombre = (c: CanvasRenderingContext2D, f: () => void): void => {
  c.save();
  c.translate(3.5, 4.5);
  c.globalAlpha = 0.22;
  f();
  c.restore();
};

export function modulesAPlat(theme: ThemePinball, partie: Partie): ModulesAPlat {
  const M = MODELES[theme];
  const P = placements(partie.table);
  const angles = P.spinner.map(() => 0);
  const t = partie.table;
  const bumper = (ins: (typeof P.bumper)[number], m: Pick<typeof M.plat, "socle" | "haut">, c: CanvasRenderingContext2D): void => {
    const b = t.bumpers[ins.i]!;
    const e = partie.choc[ins.i]! / 40;
    const r = b.r / UNITE;
    c.save();
    c.translate(b.x / UNITE, b.y / UNITE);
    ombre(c, () => rond(c, 0, 0, r * 1.22, ENCRE, 0));
    m.socle(c, r, meler(M.lumieres.bumper[0], M.lumieres.bumper[1], Math.min(1, e * 1.5)), ins.k);
    const k = 1 - e * 0.12;
    c.save();
    c.scale(k, k);
    m.haut(c, r, ins.k);
    c.restore();
    if (e > 0) {
      c.beginPath();
      c.arc(0, 0, r * (1.3 + (1 - e) * 0.9), 0, Math.PI * 2);
      c.strokeStyle = `rgba(232,178,58,${e})`;
      c.lineWidth = 3;
      c.stroke();
    }
    c.restore();
  };
  return {
    trous(c, tick) {
      const sec = tick / TICKS_PAR_SECONDE;
      for (const ins of P.trou) {
        const garde = partie.captif > 0 && partie.captifDe === ins.i ? 0.75 + 0.25 * Math.sin(sec * 14) : 0;
        c.save();
        c.translate(ins.x, ins.y);
        c.scale(ins.s, ins.s);
        ombre(c, () => rond(c, 0, 0, 13 * 1.5, ENCRE, 0));
        M.plat.trou(c, 13, meler(M.lumieres.trou[0], M.lumieres.trou[1], garde), sec);
        if (garde > 0) rond(c, 0, 0, 13 * 1.75, null, 3, MOUTARDE);
        c.restore();
      }
    },
    dessus(c) {
      P.spinner.forEach((ins, n) => {
        angles[n] = (angles[n]! + (partie.spin[ins.i]! / 1000) * 0.016) % (Math.PI * 2);
        c.save();
        c.translate(ins.x, ins.y);
        c.scale(ins.s, ins.s);
        M.plat.spinnerFixe(c, 22);
        c.rotate(angles[n]!);
        M.plat.spinnerTourne(c, 22);
        c.restore();
      });
      for (const ins of P.cible) {
        const m = t.murs[ins.i]!;
        if (partie.bas[ins.i]) {
          c.beginPath();
          c.moveTo(m.ax / UNITE, m.ay / UNITE);
          c.lineTo(m.bx / UNITE, m.by / UNITE);
          c.setLineDash([3, 4]);
          c.strokeStyle = "rgba(42,30,22,.45)";
          c.lineWidth = 3;
          c.stroke();
          c.setLineDash([]);
          continue;
        }
        c.save();
        c.translate(ins.x, ins.y);
        c.rotate(-ins.a);
        c.scale(ins.s, ins.s);
        M.plat.cible(c, 20, ins.k);
        c.restore();
      }
      for (const ins of P.bumper) bumper(ins, M.plat, c);
      for (const ins of P.asteroide) bumper(ins, M.plat.asteroide ?? M.plat, c);
    },
  };
}
