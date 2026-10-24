// Lot 45 — les rebords complets de B et le bord du vide de B : le profil entier de chaque thème (béton en « J », mur de pneus pile par pile, clôture de
// bois, blocs de roche, glissière en « W », congère), que le pas « géométrie » du palier 2 pose à la place des rebords légers du palier 1. Déplacés tels
// quels de `piste.ts` (retouche 38b, lot 43) : `piste.ts` est dans le premier chargement, ce module ne l'est pas (le pas « finition », `finitionJeu.ts`,
// et la vitrine l'importent ; une fonction gardée dans `piste.ts` et appelée seulement d'un morceau à la demande resterait au premier chargement).
import type { PaletteName } from "@cdj/sim";
import { shade, type Builder, type V3 } from "../meshKit";
import { boiteChanfreinee, repereSegment, type Repere } from "./outils";
import { CAOUTCHOUC, METAL, METAL_SOMBRE, REBORDS_B, extruder, jalons, rebordLegerDe, type Profil, type RebordB } from "./piste";
import { STYLE_ORIGINE, bordureVideOrigine, type StyleRoute, type TronconRebord } from "./route";
import type { Palette } from "../trackMesh";

const JERSEY: Profil = [[0, 0], [0, 0.14], [0.2, 0.42], [0.3, 1.4], [0.55, 1.4], [0.6, -0.6]];

/**
 * Options d'un rebord (retouche 38b). `leger` (palier 1) : le même profil de thème, en peu de faces — lot 43 : le palier 1 est la scène de tout le monde, ses
 * rebords ne coûtent pas plus de triangles que les murs de l'existant (`rebordLeger`) ; le profil complet revient avec le pas « géométrie » du palier 2.
 */
export interface OptionsRebordB {
  leger?: boolean;
}

/** Le rebord de B pour un thème. Le mur de la simulation reste là où il est (au bord de la route) : seul l'habillage change. */
export function rebordB(nom: PaletteName, sorte: RebordB = REBORDS_B[nom], opts: OptionsRebordB = {}) {
  return (g: Builder, t: TronconRebord, lum?: Builder) => {
    if (opts.leger && sorte !== "neige") return rebordLegerDe(sorte)(g, t, lum);
    const h = t.hauteur;
    const ox = t.dehors[0];
    const oz = t.dehors[1];
    const r = repereSegment(t.a, t.b);
    if (sorte === "beton") {
      const prof: Profil = JERSEY.map(([o, y]) => [o, y > 1 ? h : y] as [number, number]);
      // Béton peint par bandes de 4 m, joints sombres ; un catadioptre ambre tous les 8 m (la nuit, il s'allume).
      extruder(g, t, prof, 4, (n, k) => (k >= 3 ? shade(t.couleurs[n % 2]!, 0.9) : t.couleurs[n % 2]!));
      for (const { p, n } of jalons(t, 4)) {
        g.quad([p[0], p[1] + 0.02, p[2]], [p[0], p[1] + h, p[2]], [p[0] + ox * 0.32, p[1] + h, p[2] + oz * 0.32], [p[0] + ox * 0.02, p[1] + 0.14, p[2] + oz * 0.02], 0x3a3f4d);
        if (n % 2 === 0 && lum) {
          const q: V3 = [p[0] + ox * 0.28 + r.f[0] * 2, p[1] + h * 0.8, p[2] + oz * 0.28 + r.f[2] * 2];
          lum.quad([q[0] - r.f[0] * 0.15, q[1] - 0.08, q[2] - r.f[2] * 0.15], [q[0] + r.f[0] * 0.15, q[1] - 0.08, q[2] + r.f[2] * 0.15], [q[0] + r.f[0] * 0.15, q[1] + 0.08, q[2] + r.f[2] * 0.15], [q[0] - r.f[0] * 0.15, q[1] + 0.08, q[2] - r.f[2] * 0.15], 0xffb000);
        }
      }
    } else if (sorte === "pneus") {
      // Mur de pneus : une pile tous les 1,1 m (seule la moitié tournée vers la route est dessinée : trois pans, deux tons), une sur deux au haut
      // peint en blanc, et la courroie de caoutchouc devant. ≈ 15 triangles par pile.
      for (const { p, n } of jalons(t, 1.1)) {
        const c: V3 = [p[0] + ox * 0.5, p[1], p[2] + oz * 0.5];
        const pan = (k: number): V3 => {
          const a = Math.atan2(-oz, -ox) + ((k - 1.5) * Math.PI) / 3;
          return [c[0] + Math.cos(a) * 0.5, c[1], c[2] + Math.sin(a) * 0.5];
        };
        const haut = n % 2 === 0 ? t.couleurs[1] : CAOUTCHOUC;
        for (let k = 0; k < 3; k++) {
          const a0 = pan(k);
          const a1 = pan(k + 1);
          g.quad(a0, a1, [a1[0], a1[1] + 0.85, a1[2]], [a0[0], a0[1] + 0.85, a0[2]], CAOUTCHOUC);
          g.quad([a0[0], a0[1] + 0.85, a0[2]], [a1[0], a1[1] + 0.85, a1[2]], [a1[0], a1[1] + h, a1[2]], [a0[0], a0[1] + h, a0[2]], haut);
          g.tri([c[0], c[1] + h, c[2]], [a0[0], a0[1] + h, a0[2]], [a1[0], a1[1] + h, a1[2]], shade(haut, 0.85));
        }
      }
      extruder(g, t, [[0.0, 0.3], [0.0, 1.0]], 4, (n) => (n % 2 === 0 ? 0x2a2a30 : 0x222226));
    } else if (sorte === "bois") {
      // Clôture de bois : poteaux tous les 2,4 m, trois lisses, une planche basse.
      for (const { p } of jalons(t, 2.4)) g.box(p[0] + ox * 0.15 - 0.09, p[1] - 0.3, p[2] + oz * 0.15 - 0.09, p[0] + ox * 0.15 + 0.09, p[1] + h + 0.1, p[2] + oz * 0.15 + 0.09, t.couleurs[0]);
      for (const y of [0.45, 0.85, 1.25]) extruder(g, t, [[0.02, y], [0.02, y + 0.14], [0.1, y + 0.14]], 6, (n) => (n % 2 === 0 ? t.couleurs[1] : shade(t.couleurs[1], 0.92)));
      extruder(g, t, [[0.0, 0], [0.0, 0.3]], 6, () => shade(t.couleurs[0], 0.9));
    } else if (sorte === "roche") {
      // Blocs de roche empilés : hauteurs et retraits irréguliers (tirés de la distance : le même mur pour tout le monde).
      for (const { p, n } of jalons(t, 2.2)) {
        const k = ((n * 2654435761) >>> 0) / 4294967296;
        const hh = h * (0.9 + k * 0.45);
        const c = k < 0.5 ? t.couleurs[0] : t.couleurs[1];
        const rr: Repere = { o: [p[0] + ox * 0.5, p[1], p[2] + oz * 0.5], f: r.f, l: r.l };
        boiteChanfreinee(g, rr, -0.55 - k * 0.2, 0.5, -0.6, hh, -1.25, 1.25, 0.25, c, shade(c, 1.12));
      }
    } else if (sorte === "glissiere") {
      // Glissière double : poteaux tous les 2 m, deux lisses en « W », un catadioptre rouge et blanc tous les 8 m.
      for (const { p, n } of jalons(t, 2)) {
        g.box(p[0] + ox * 0.35 - 0.07, p[1] - 0.4, p[2] + oz * 0.35 - 0.07, p[0] + ox * 0.35 + 0.07, p[1] + h, p[2] + oz * 0.35 + 0.07, METAL_SOMBRE);
        if (n % 4 === 0 && lum) {
          const q: V3 = [p[0] + ox * 0.2, p[1] + h - 0.1, p[2] + oz * 0.2];
          lum.quad([q[0] - r.f[0] * 0.12, q[1] - 0.25, q[2] - r.f[2] * 0.12], [q[0] + r.f[0] * 0.12, q[1] - 0.25, q[2] + r.f[2] * 0.12], [q[0] + r.f[0] * 0.12, q[1] + 0.1, q[2] + r.f[2] * 0.12], [q[0] - r.f[0] * 0.12, q[1] + 0.1, q[2] - r.f[2] * 0.12], n % 8 === 0 ? 0xe8283a : 0xffffff);
        }
      }
      for (const y of [0.55, 1.05]) extruder(g, t, [[0.25, y - 0.18], [0.18, y - 0.1], [0.25, y], [0.18, y + 0.1], [0.25, y + 0.18]], 4, (n, k) => (k % 2 === 0 ? (n % 2 === 0 ? t.couleurs[0] : t.couleurs[1]) : shade(METAL, 1.1)));
    } else {
      // Banquise : une congère tassée (blanc bleuté) et un jalon bleu et blanc tous les 6 m.
      extruder(g, t, [[0, 0], [0.15, 0.7], [0.45, 1.25], [0.9, h], [1.6, 0.5], [2.0, -0.6]], 8, (_n, k) => (k < 2 ? 0xe9f1f8 : k < 4 ? 0xffffff : 0xdce8f2));
      for (const { p, n } of jalons(t, 6)) {
        const q: V3 = [p[0] + ox * 0.6, p[1] + 1.2, p[2] + oz * 0.6];
        g.box(q[0] - 0.06, q[1], q[2] - 0.06, q[0] + 0.06, q[1] + 1.6, q[2] + 0.06, n % 2 === 0 ? t.couleurs[0] : 0xffffff);
        g.box(q[0] - 0.07, q[1] + 1.2, q[2] - 0.07, q[0] + 0.07, q[1] + 1.6, q[2] + 0.07, 0xe8283a);
      }
    }
  };
}

/** Le bord du vide de B : la bordure de l'existant et des balises réfléchissantes tous les 8 m (plots blancs, catadioptre). */
export function bordureVideB(g: Builder, l: Builder, t: TronconRebord, pal: Palette, milieu: V3) {
  bordureVideOrigine(g, l, t, pal, milieu);
  for (const { p } of jalons(t, 8)) {
    g.box(p[0] - 0.08, p[1], p[2] - 0.08, p[0] + 0.08, p[1] + 1.0, p[2] + 0.08, 0xf4f4f4);
    g.box(p[0] - 0.09, p[1] + 0.7, p[2] - 0.09, p[0] + 0.09, p[1] + 0.85, p[2] + 0.09, CAOUTCHOUC);
    l.box(p[0] - 0.1, p[1] + 0.86, p[2] - 0.1, p[0] + 0.1, p[1] + 0.96, p[2] + 0.1, 0xffb000);
  }
}

export function routeB(nom: PaletteName, sorte: RebordB = REBORDS_B[nom], opts: OptionsRebordB = {}): StyleRoute {
  const rebord = rebordB(nom, sorte, opts);
  return { ...STYLE_ORIGINE, rebord: (g, t, _pal, lum) => rebord(g, t, lum), bordureVide: bordureVideB };
}
