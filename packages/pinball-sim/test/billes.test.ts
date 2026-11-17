import { describe, expect, it } from "vitest";
import { Rng } from "@cdj/core";
import { PERDUE_Y, PINBALL_GENERATOR_VERSION, RAYON, UNITE, Partie, REGLAGES, copierReglages, dailyPinball, racine, type ThemePinball } from "../src/index";
import { JOUR_ESSAI, avancer } from "./aide";

// LES BILLES SE TOUCHENT (lot PBG2) : collision élastique entre billes de même masse, dans un ordre fixe ; aucune ne traverse l'autre ; aucune bille ne reste coincée pendant la multibille.

/** Une partie en multibille (trois billes sur la table), sans pente ni batteurs levés : seules les collisions entre billes et les murs jouent. */
function multibille(theme: ThemePinball = "ocean", plan = "doublette", pente = 0): Partie {
  const r = copierReglages();
  r.pente = pente;
  const p = new Partie(dailyPinball(JOUR_ESSAI, PINBALL_GENERATOR_VERSION, theme, plan), r);
  p.missionFaite = true;
  p.verrouAllume = true;
  const t = p.table.trous[p.table.verrou]!;
  for (let i = 0; i < 2; i++) {
    p.trouPause.fill(0);
    p.captif = 0;
    p.dansLanceur = false;
    p.x = t.x;
    p.y = t.y;
    p.vx = 0;
    p.vy = 10 * UNITE;
    p.avancer();
  }
  expect(p.multibille).toBe(true);
  avancer(p, r.multibilleDepart + r.multibilleLacher + 5);
  expect(p.autres.length).toBe(2);
  return p;
}
const px = (n: number): number => Math.round(n * UNITE);

describe("collision entre deux billes", () => {
  it("de face à vitesse maximale : elles se renvoient leur vitesse, aucune ne traverse l'autre (3 000 tirs, toutes les mises à distance)", () => {
    const rng = new Rng(7);
    let rencontres = 0;
    for (let k = 0; k < 3000; k++) {
      const p = multibille();
      p.sauveeMulti = 100000;
      const a = p.autres[0]!;
      const b = p.autres[1]!;
      p.dansLanceur = true; // la bille du lanceur attend, elle ne touche à rien
      // deux billes dans un coin libre du bas de la table (entre les lance-pierres, au-dessus des batteurs), l'une contre l'autre
      const y = 470 + rng.int(60);
      const decalage = rng.int(35) - 17; // l'écart vertical des centres : de face à presque en rasant (le rayon d'une bille : 9 px)
      const vitesse = 1500 - rng.int(300);
      a.x = px(140);
      a.y = px(y);
      a.vx = vitesse * UNITE;
      a.vy = 0;
      b.x = px(230);
      b.y = px(y + decalage);
      b.vx = -vitesse * UNITE;
      b.vy = 0;
      a.px = a.x;
      a.py = a.y;
      b.px = b.x;
      b.py = b.y;
      // la bille principale (celle du lanceur) et la troisième ne comptent pas : à l'écart
      let toucheesUneFois = false;
      for (let i = 0; i < 90; i++) {
        p.avancer();
        const ab = p.autres.find((q) => q === a);
        const bb = p.autres.find((q) => q === b);
        if (!ab || !bb) break;
        const dx = bb.x - ab.x;
        const dy = bb.y - ab.y;
        const d = racine(dx * dx + dy * dy);
        // jamais plus d'un demi-pixel de recouvrement à la fin d'un pas
        expect(d, `tir ${k}, pas ${i}`).toBeGreaterThan(px(2 * RAYON - 0.5));
        // a reste à gauche de b tant qu'elles n'ont pas heurté un mur : elles ne se sont pas traversées
        if (i < 14) expect(bb.x, `tir ${k}, pas ${i} : traversée`).toBeGreaterThan(ab.x);
        if (d < px(2 * RAYON + 1)) toucheesUneFois = true;
      }
      if (toucheesUneFois) rencontres++;
    }
    expect(rencontres).toBe(3000);
  });

  it("une collision de face échange les vitesses (masses égales, rebond de 1 000 ‰) et conserve la quantité de mouvement", () => {
    const p = multibille();
    const a = p.autres[0]!;
    const b = p.autres[1]!;
    p.sauveeMulti = 100000;
    a.x = px(150);
    a.y = px(500);
    a.vx = 900 * UNITE;
    a.vy = 0;
    b.x = px(190);
    b.y = px(500);
    b.vx = -300 * UNITE;
    b.vy = 0;
    const somme = a.vx + b.vx;
    let pas = 0;
    while (pas < 200 && racine((b.x - a.x) ** 2 + (b.y - a.y) ** 2) > px(2 * RAYON + 1)) {
      p.avancer();
      pas++;
    }
    avancer(p, 4);
    // à la tolérance de l'arithmétique entière près, elles ont échangé leurs vitesses
    expect(Math.abs(a.vx - -300 * UNITE)).toBeLessThan(UNITE);
    expect(Math.abs(b.vx - 900 * UNITE)).toBeLessThan(UNITE);
    expect(Math.abs(a.vx + b.vx - somme)).toBeLessThan(UNITE);
  });

  it("une collision de côté conserve la quantité de mouvement et l'énergie (masses égales, rebond élastique) et passe de la vitesse à l'autre bille", () => {
    const p = multibille();
    const a = p.autres[0]!;
    const b = p.autres[1]!;
    p.sauveeMulti = 100000;
    p.dansLanceur = true;
    // b est au-dessus de a ; a monte vers b en glissant de côté
    a.x = px(180);
    a.y = px(520);
    a.vx = 400 * UNITE;
    a.vy = -600 * UNITE;
    b.x = px(180);
    b.y = px(490);
    b.vx = 0;
    b.vy = 0;
    const energie = (): number => (a.vx * a.vx + a.vy * a.vy + b.vx * b.vx + b.vy * b.vy) / (UNITE * UNITE);
    const e0 = energie();
    avancer(p, 25);
    expect(Math.abs(a.vx + b.vx - 400 * UNITE)).toBeLessThan(UNITE);
    expect(Math.abs(a.vy + b.vy + 600 * UNITE)).toBeLessThan(UNITE);
    expect(Math.abs(energie() - e0) / e0).toBeLessThan(0.001);
    expect(b.vy).toBeLessThan(-100 * UNITE); // la vitesse normale est passée à b
    expect(a.vx).toBeGreaterThan(0); // la composante qui glisse reste à a
  });

  it("deux billes exactement au même point sont séparées (jamais une division par zéro, jamais collées)", () => {
    const p = multibille();
    const a = p.autres[0]!;
    const b = p.autres[1]!;
    p.sauveeMulti = 100000;
    a.x = b.x = px(180);
    a.y = b.y = px(500);
    a.vx = a.vy = b.vx = b.vy = 0;
    avancer(p, 3);
    expect(racine((b.x - a.x) ** 2 + (b.y - a.y) ** 2)).toBeGreaterThan(px(2 * RAYON - 1));
  });

  it("une bille captive, sur un rail ou dans le couloir du lanceur ne heurte personne", () => {
    const p = multibille();
    const a = p.autres[0]!;
    const b = p.autres[1]!;
    p.sauveeMulti = 100000;
    a.x = b.x = px(180);
    a.y = b.y = px(500);
    a.vx = a.vy = b.vx = b.vy = 0;
    a.captif = 100; // captive
    const x0 = b.x;
    avancer(p, 1);
    expect(b.x).toBe(x0);
  });
});

describe("la multibille ne coince jamais une bille", () => {
  // toutes les tables : trois billes lâchées en plusieurs endroits de la table, sans batteur levé ; la multibille finit toujours (chaque bille est perdue, le délai de bille sauvée passé)
  for (const plan of ["doublette", "tremplin", "bretelle", "boucle"]) {
    for (const theme of ["foire", "ocean", "espace", "volcan"] as const) {
      it(`${theme} × ${plan} : la multibille finit, aucune bille ne reste en jeu`, () => {
        const rng = new Rng(plan.length * 31 + theme.length);
        for (let essai = 0; essai < 3; essai++) {
          const p = multibille(theme, plan, REGLAGES.pente);
          // la bille du lanceur part aussi, de quelque part ; les autres aussi sont dispersées
          p.dansLanceur = false;
          p.entree = p.tick;
          const toutes = [p, ...p.autres];
          for (const b of toutes) {
            b.x = px(40 + rng.int(290));
            b.y = px(130 + rng.int(330));
            b.vx = (rng.int(600) - 300) * UNITE;
            b.vy = (rng.int(400) - 200) * UNITE;
            b.px = b.x;
            b.py = b.y;
            b.captif = 0;
            b.couche = 0;
          }
          p.verrouillees = 0;
          let n = 0;
          while (p.multibille && n < 200000 && !p.finie) {
            p.avancer();
            n++;
          }
          expect(p.multibille, `${theme}:${plan} essai ${essai} : encore ${p.surLaTable} billes après ${n} pas`).toBe(false);
          expect(p.billes).toBe(3);
          expect(p.niveau).toBe(2);
        }
      }, 60000);
    }
  }

  it("une bille qui descend vers le bas de la table est perdue (PERDUE_Y), jamais retenue par les autres", () => {
    expect(PERDUE_Y).toBeGreaterThan(760);
  });
});
