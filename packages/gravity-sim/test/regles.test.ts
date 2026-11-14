import { describe, expect, it } from "vitest";
import { CASE, DUREE_MAX_TICKS, solide, EV_BOUCLIER, GRACE, INVULNERABILITE, MORT_BORD, MORT_PIQUE, MORT_TEMPS, MORT_VIDE, TAMPON, TAILLE, Partie, terrainDeTest } from "../src/index";
import { avancer, bonus, centreDe, couloirs, jusqua, morceau, partieSur, trou } from "./aide";

// Les règles de la simulation, une par une, sur des terrains écrits à la main (`aide.ts`). Les morceaux sont des couloirs de 16 colonnes, plafond et sol de deux cases ; le joueur part à la colonne 3, au sol (rangée 9),
// à 120 pas par seconde.

const jouer = (p: Partie, appuis: number[], pas: number): Partie => {
  for (let i = 0; i < pas && !p.finie; i++) {
    if (appuis.includes(p.tick)) p.appuyer();
    p.avancer();
  }
  return p;
};

describe("l'inversion de la gravité", () => {
  it("un appui au sol inverse la gravité : le joueur monte au plafond et s'y pose", () => {
    const p = jouer(partieSur([]), [5], 140);
    expect(p.inversions).toBe(1);
    expect(p.g).toBe(-1);
    expect(p.sol).toBe(true);
    expect(p.y).toBe(2 * CASE + 1); // sous le plafond (rangée 1), à une unité
  });

  it("aucune inversion en l'air : un appui trop tôt expire avant le contact (tampon de 14 pas), un appui juste avant est gardé", () => {
    // Le pas où le joueur se pose au plafond après un premier appui au pas 5.
    const ref = partieSur([]);
    let pose = -1;
    for (let i = 0; i < 400 && pose < 0; i++) {
      if (ref.tick === 5) ref.appuyer();
      ref.avancer();
      if (ref.sol && ref.g === -1) pose = ref.tick;
    }
    expect(pose).toBeGreaterThan(50);
    const vol = (appuiRelatif: number): Partie => jouer(partieSur([]), [5, pose + appuiRelatif], pose + 12);
    expect(vol(-40).inversions).toBe(1); // 40 pas avant le contact : l'appui est périmé
    expect(vol(-6).inversions).toBe(2); // 6 pas avant : gardé, inversion au contact
    expect(vol(-6).g).toBe(1);
    expect(vol(-20).inversions).toBe(1); // 20 pas : encore trop tôt (le tampon dure 14 pas)
    expect(TAMPON).toBe(14);
  });

  it("le temps de grâce : un appui juste après avoir quitté un bord passe encore, pas plus tard", () => {
    const grille = morceau(trou(6, 16));
    const quitte = (): number => {
      const p = partieSur([grille]);
      return jusqua(p, (q) => !q.sol && q.tick > 5);
    };
    const t = quitte();
    expect(t).toBeGreaterThan(0);
    expect(jouer(partieSur([grille]), [t + GRACE - 3], t + 40).inversions).toBe(1);
    expect(jouer(partieSur([grille]), [t + GRACE + 6], t + 40).inversions).toBe(0);
  });

  it("jamais sur la glace", () => {
    const grille = morceau(Array.from({ length: 12 }, (_, i) => [3 + i, 10, "~"] as [number, number, string]));
    const p = jouer(partieSur([grille]), [20, 40, 60], 100);
    expect(p.surface).toBe(4);
    expect(p.inversions).toBe(0);
    expect(p.g).toBe(1);
  });

  it("l'inverseur inverse la gravité au contact, sans appui", () => {
    const grille = morceau([[6, 10, "i"], [7, 10, "i"], [8, 10, "i"]]);
    const p = partieSur([grille]);
    jusqua(p, (q) => q.g === -1);
    expect(p.g).toBe(-1);
    expect(p.inversions).toBe(0); // un appui du joueur, pas l'inverseur, compte comme inversion
    jusqua(p, (q) => q.sol);
    expect(p.y).toBe(2 * CASE + 1);
  });

  it("le sol, le plafond et un pas d'élan nul : l'inversion repart de vy = 0 (défaut a de la maquette)", () => {
    const p = partieSur([]);
    avancer(p, 4);
    p.appuyer();
    p.avancer();
    expect(p.g).toBe(-1);
    expect(p.vy).toBeLessThan(0); // la gravité seule : vers le haut dès le premier pas
    expect(p.vy).toBeGreaterThan(-3000);
  });
});

describe("les morts", () => {
  it("le vide : on tombe par un trou du sol", () => {
    const p = jouer(partieSur([morceau(trou(6, 12))]), [], 600);
    expect(p.mort).toBe(MORT_VIDE);
    expect(p.resultat().cause).toBe(MORT_VIDE);
  });
  it("le vide en haut : on tombe vers le plafond troué", () => {
    const p = jouer(partieSur([morceau(trou(6, 12, true))]), [5], 600);
    expect(p.mort).toBe(MORT_VIDE);
    expect(p.g).toBe(-1);
  });
  it("le pique : sa boîte réduite tue", () => {
    const p = jouer(partieSur([morceau([[8, 9, "^"], [9, 9, "^"]])]), [], 600);
    expect(p.mort).toBe(MORT_PIQUE);
  });
  it("le pique n'est pas solide : on ne se pose pas dessus", () => {
    const p = partieSur([morceau([[8, 9, "^"]])]);
    jusqua(p, (q) => q.finie);
    expect(p.mort).toBe(MORT_PIQUE);
    expect(p.surface).not.toBe(2);
  });
  it("le bord gauche : un mur qui bloque la course, la caméra rattrape le joueur", () => {
    const mur = Array.from({ length: 8 }, (_, i) => [8, 2 + i, "#"] as [number, number, string]);
    const p = partieSur([morceau(mur)]);
    jusqua(p, (q) => q.finie, 3000);
    expect(p.mort).toBe(MORT_BORD);
  });
  it("le temps écoulé : dix minutes, puis la fin", () => {
    const p = new Partie(couloirs());
    // Une partie de 72 000 pas dans un couloir sans fin : elle va au bout.
    jusqua(p, (q) => q.finie, DUREE_MAX_TICKS + 10);
    expect(p.mort).toBe(MORT_TEMPS);
    expect(p.tick).toBe(DUREE_MAX_TICKS);
    expect(p.resultat().ticks).toBe(DUREE_MAX_TICKS);
  });
  it("une partie finie ne bouge plus", () => {
    const p = jouer(partieSur([morceau(trou(6, 12))]), [], 600);
    const avant = JSON.stringify(p.resultat());
    p.appuyer();
    avancer(p, 50);
    expect(JSON.stringify(p.resultat())).toBe(avant);
  });
});

describe("le bouclier", () => {
  const terrainDePiques = (): Partie => partieSur([morceau([[9, 9, "^"]]), morceau([[4, 9, "^"]])], { bonus: [bonus(5, 9, "bouclier")] });

  it("sauve une fois d'un pique, puis laisse 0,8 s d'invulnérabilité ; le second pique tue", () => {
    const p = terrainDePiques();
    jusqua(p, (q) => q.bouclier);
    expect(p.bouclier).toBe(true);
    jusqua(p, (q) => (q.ev & EV_BOUCLIER) !== 0);
    expect(p.mort).toBe(0);
    expect(p.bouclier).toBe(false);
    expect(p.invuln).toBeGreaterThan(INVULNERABILITE - 4);
    jusqua(p, (q) => q.finie);
    expect(p.mort).toBe(MORT_PIQUE);
    expect(p.distance).toBeGreaterThan(12); // passé le premier pique (colonne 9), mort au second (colonne 20)
  });

  it("sans bouclier, le premier pique tue", () => {
    const p = partieSur([morceau([[9, 9, "^"]])]);
    jusqua(p, (q) => q.finie);
    expect(p.mort).toBe(MORT_PIQUE);
    expect(p.distance).toBeLessThan(10);
  });

  it("rattrape une chute dans le vide : la gravité s'inverse et le joueur repart", () => {
    const p = partieSur([morceau(trou(6, 12)), morceau()], { bonus: [bonus(5, 9, "bouclier")] });
    jusqua(p, (q) => (q.ev & EV_BOUCLIER) !== 0);
    expect(p.mort).toBe(0);
    expect(p.g).toBe(-1);
    avancer(p, 300);
    expect(p.mort).toBe(0);
  });

  it("rattrape le bord de l'écran sans jamais replacer le joueur dans un mur (défaut b de la maquette)", () => {
    const mur = Array.from({ length: 8 }, (_, i) => [8, 2 + i, "#"] as [number, number, string]);
    const terrain = terrainDeTest([morceau(mur)], { bonus: [bonus(5, 9, "bouclier")] });
    const p = new Partie(terrain);
    const dansUnMur = (q: Partie): boolean => {
      for (let cx = Math.floor(q.x / CASE); cx <= Math.floor((q.x + TAILLE - 1) / CASE); cx++) {
        for (let cy = Math.floor(q.y / CASE); cy <= Math.floor((q.y + TAILLE - 1) / CASE); cy++) {
          const k = Math.floor(cx / 16);
          const type = terrain.morceau(k).cases[(cx - k * 16) * 12 + cy] ?? 0;
          if (type === 1) return true;
        }
      }
      return false;
    };
    jusqua(p, (q) => (q.ev & EV_BOUCLIER) !== 0, 3000);
    expect(p.mort).toBe(0);
    expect(p.invuln).toBeGreaterThan(0);
    expect(dansUnMur(p)).toBe(false);
    expect(p.x).toBeGreaterThanOrEqual(9 * CASE); // de l'autre côté du mur
  });
});

describe("les pièces, le multiplicateur, les gemmes", () => {
  const ligne = (de: number, n: number) => Array.from({ length: n }, (_, i) => centreDe(de + i, 9));

  it("dix pièces d'affilée : +1 au multiplicateur ; chaque pièce vaut 10 × le multiplicateur", () => {
    const p = partieSur([morceau()], { pieces: ligne(4, 12) });
    jusqua(p, (q) => q.pieces >= 12);
    expect(p.pieces).toBe(12);
    expect(p.multMax).toBe(2);
    // 9 pièces à ×1, puis la 10ᵉ (qui passe à ×2) et les suivantes à ×2.
    expect(p.points).toBe(9 * 10 + 3 * 20);
  });

  it("une pièce ratée, sortie de l'écran, remet le multiplicateur à ×1", () => {
    const p = partieSur([morceau()], { pieces: [...ligne(4, 11), centreDe(15, 3)] });
    jusqua(p, (q) => q.pieces >= 11);
    expect(p.mult).toBe(2);
    jusqua(p, (q) => q.mult === 1);
    expect(p.mult).toBe(1);
    expect(p.chaine).toBe(0);
    expect(p.multMax).toBe(2);
  });

  it("le multiplicateur plafonne à ×5", () => {
    const p = partieSur([morceau(), morceau(), morceau(), morceau()], { pieces: ligne(4, 12) });
    for (let cx = 16; cx < 64; cx++) p.charge(Math.floor(cx / 16)).pieces.push({ x: cx * CASE + CASE / 2, y: 9 * CASE + CASE / 2, etat: 0 });
    jusqua(p, (q) => q.pieces >= 55, 4000);
    expect(p.pieces).toBeGreaterThanOrEqual(55);
    expect(p.multMax).toBe(5);
    expect(p.mult).toBe(5);
  });

  it("une gemme vaut 100 × le multiplicateur", () => {
    const p = partieSur([morceau()], { gemmes: [centreDe(6, 9)] });
    jusqua(p, (q) => q.gemmes >= 1);
    expect(p.gemmes).toBe(1);
    expect(p.points).toBe(100);
  });

  it("le score est la distance plus les points", () => {
    const p = partieSur([morceau(), morceau()], { gemmes: [centreDe(6, 9)] });
    jusqua(p, (q) => q.distance >= 20);
    expect(p.score).toBe(p.distance + 100);
  });
});

describe("l'aimant", () => {
  it("attire les pièces proches pendant 8 s : leur position fait partie de l'état", () => {
    const piece = centreDe(11, 6); // trois rangées au-dessus du joueur : hors de portée sans aimant
    const sans = partieSur([morceau()], { pieces: [piece] });
    jusqua(sans, (q) => q.x > 13 * CASE);
    expect(sans.pieces).toBe(0);

    const avec = partieSur([morceau()], { pieces: [piece], bonus: [bonus(5, 9, "aimant")] });
    jusqua(avec, (q) => q.aimant > 0);
    expect(avec.aimant).toBeGreaterThan(900);
    let deplacee = false;
    jusqua(avec, (q) => {
      const p0 = q.charge(0).pieces[0]!;
      if (p0.y !== piece.y) deplacee = true;
      return q.pieces >= 1;
    });
    expect(deplacee).toBe(true);
    expect(avec.pieces).toBe(1);
  });

  it("s'éteint au bout de 8 secondes", () => {
    const p = partieSur([morceau()], { bonus: [bonus(5, 9, "aimant")] });
    jusqua(p, (q) => q.aimant > 0);
    avancer(p, 961);
    expect(p.aimant).toBe(0);
  });
});

describe("les cases", () => {
  it("le tapis pousse plus vite", () => {
    const tapis = Array.from({ length: 13 }, (_, i) => [3 + i, 10, ">"] as [number, number, string]);
    const a = avancer(partieSur([morceau(tapis)]), 150);
    const b = avancer(partieSur([morceau()]), 150);
    expect(a.x).toBeGreaterThan(b.x);
  });
  it("le vent porte vers le haut et allège la gravité", () => {
    const vent: [number, number, string][] = [];
    for (let c = 5; c < 11; c++) for (let r = 3; r < 10; r++) vent.push([c, r, "v"]);
    const avecVent = partieSur([morceau([...trou(4, 12), ...vent])]);
    const sansVent = partieSur([morceau(trou(4, 12))]);
    jusqua(avecVent, (q) => q.x > 8 * CASE);
    jusqua(sansVent, (q) => q.x > 8 * CASE);
    expect(avecVent.y).toBeLessThan(sansVent.y);
  });
  it("les cases qui battent : clignotant allumé 119 pas sur 192, alternées A / B au battement de 120 pas, décalage de leur morceau", () => {
    expect([0, 118, 119, 191, 192].map((t) => solide(5, t))).toEqual([true, true, false, false, true]);
    expect([0, 119, 120, 239, 240].map((t) => solide(6, t))).toEqual([true, true, false, false, true]);
    expect([0, 119, 120, 239, 240].map((t) => solide(7, t))).toEqual([false, false, true, true, false]);
    expect(solide(6, 0, 120)).toBe(false); // le décalage du morceau
    expect(solide(5, 0, 119)).toBe(false);
    expect([1, 3, 4, 8].every((t) => solide(t, 12345))).toBe(true); // bloc, tapis, glace, inverseur : toujours solides
    expect([0, 2, 9].some((t) => solide(t, 0))).toBe(false); // vide, pique, vent : jamais
  });
});
