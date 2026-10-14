import { Rng } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  COUNTER_CAP,
  DEFAULT_JUMP_PARAMS,
  INPUT_MASK,
  MAX_SPEED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SANDBOX_LEVEL,
  SANDBOX_MARKS,
  TILE_SOLID,
  boxHits,
  initialPlayer,
  isDefaultJumpParams,
  playerMode,
  stepPlayer,
  tileAt,
  type JumpParams,
  type Level,
  type PlayerState,
} from "../src/index";
import { J, L, P, R, T, climbChimney, climbWall, floatAt, hold, level, risen, room, standAt } from "./helpers";

const TICK_S = 1 / 120;
const FLOOR = SANDBOX_MARKS.floorRow;

/** Ticks jusqu'au retour au sol, et l'état le plus haut, pour un saut joué avec `inputs(t)`. */
function jumpArc(lv: Level, s: PlayerState, inputs: (t: number) => number) {
  const start = s;
  let top = s;
  let apexTick = 0;
  let t = 0;
  for (; t < 600; t++) {
    s = stepPlayer(s, inputs(t), lv, P);
    if (s.y < top.y) {
      top = s;
      apexTick = t + 1;
    }
    if (t > 0 && s.ground) break;
  }
  return { height: risen(start, top), apexTick, airTicks: t + 1, end: s };
}

describe("course", () => {
  it("atteint la vitesse maximale en ≈ 0,18 s et s'arrête en ≈ 0,1 s", () => {
    const lv = room(60, 4);
    let s = standAt(lv, 2, 3);
    let t = 0;
    while (s.vx < P.runSpeed && t < 200) {
      s = stepPlayer(s, R, lv, P);
      t++;
    }
    expect(s.vx).toBe(P.runSpeed);
    expect(P.runSpeed * 120 / T).toBeCloseTo(11, 0); // ≈ 11 tuiles/s
    expect(t * TICK_S).toBeGreaterThanOrEqual(0.15);
    expect(t * TICK_S).toBeLessThanOrEqual(0.21);
    s = hold(s, R, 30, lv);
    expect(s.vx).toBe(P.runSpeed); // plafonnée, pas au-delà
    let stop = 0;
    while (s.vx !== 0 && stop < 200) {
      s = stepPlayer(s, 0, lv, P);
      stop++;
    }
    expect(stop * TICK_S).toBeGreaterThanOrEqual(0.08);
    expect(stop * TICK_S).toBeLessThanOrEqual(0.12);
  });

  it("gauche + droite ensemble = neutre (freine comme sans commande)", () => {
    const lv = room(60, 4);
    const running = hold(standAt(lv, 2, 3), R, 40, lv);
    expect(stepPlayer(running, L | R, lv, P)).toEqual(stepPlayer(running, 0, lv, P));
  });

  it("le demi-tour au sol prend le freinage, plus fort que l'accélération", () => {
    const lv = room(60, 4);
    const running = hold(standAt(lv, 2, 3), R, 40, lv);
    expect(stepPlayer(running, L, lv, P).vx).toBe(P.runSpeed - Math.max(P.groundAccel, P.groundDecel));
  });

  it("en l'air, le contrôle est plus faible qu'au sol", () => {
    expect(P.airAccel).toBeLessThan(P.groundAccel);
    expect(P.airDecel).toBeLessThan(P.groundDecel);
    const lv = room(60, 12);
    const a = stepPlayer(floatAt(lv, 10 * T, 4 * T), R, lv, P);
    expect(a.vx).toBe(P.airAccel);
  });
});

describe("saut", () => {
  const lv = room(30, 12);

  it("saut complet : ≈ 4 tuiles, montée ≈ 0,35 s", () => {
    const arc = jumpArc(lv, standAt(lv, 4, 11), () => J);
    expect(arc.height).toBeGreaterThan(3.9);
    expect(arc.height).toBeLessThan(4.5);
    expect(arc.apexTick * TICK_S).toBeGreaterThan(0.3);
    expect(arc.apexTick * TICK_S).toBeLessThan(0.4);
  });

  it("relâché tôt, le saut est plus bas (saut court ≈ 1 tuile) ; plus on tient, plus il monte", () => {
    const full = jumpArc(lv, standAt(lv, 4, 11), () => J).height;
    const short = jumpArc(lv, standAt(lv, 4, 11), (t) => (t === 0 ? J : 0)).height;
    expect(short).toBeLessThan(full);
    expect(short).toBeGreaterThan(0.8);
    expect(short).toBeLessThan(1.3);
    let prev = short;
    for (const heldTicks of [5, 10, 20, 30]) {
      const h = jumpArc(lv, standAt(lv, 4, 11), (t) => (t < heldTicks ? J : 0)).height;
      expect(h).toBeGreaterThanOrEqual(prev);
      prev = h;
    }
    expect(prev).toBeLessThanOrEqual(full);
  });

  it("tenir le bouton ne fait pas resauter : il faut un nouvel appui", () => {
    let s = standAt(lv, 4, 11);
    s = stepPlayer(s, J, lv, P);
    expect(s.vy).toBe(-P.jumpSpeed);
    for (let t = 0; t < 200 && !s.ground; t++) s = stepPlayer(s, J, lv, P);
    expect(s.ground).toBe(1);
    s = hold(s, J, 30, lv);
    expect(s.ground).toBe(1); // toujours posé : le bouton tenu depuis le saut précédent n'est pas un appui
    expect(stepPlayer(stepPlayer(s, 0, lv, P), J, lv, P).vy).toBe(-P.jumpSpeed);
  });

  it("la tête qui cogne un plafond arrête la montée", () => {
    // Le plafond est le bord haut du niveau (le monde est clos) : 2,25 tuiles au-dessus de la tête.
    const low = level(["#....#", "#....#", "#.S.F#", "######"]);
    let s = standAt(low, 2, 2);
    let top = s.y;
    for (let t = 0; t < 20; t++) {
      s = stepPlayer(s, J, low, P);
      top = Math.min(top, s.y);
      expect(boxHits(low, s.x, s.y, PLAYER_WIDTH, PLAYER_HEIGHT)).toBe(false);
    }
    expect(top).toBe(0);
    expect(s.jumping).toBe(0);
    expect(s.vy).toBeGreaterThan(0); // retombe aussitôt
  });
});

describe("coyote", () => {
  // Un rebord : on marche dessus vers la droite, il finit en colonne 6, puis le vide (un sol bien plus bas).
  const lv = level([
    ...Array.from({ length: 5 }, () => "#..............#"),
    "#.S............#",
    "#######........#",
    ...Array.from({ length: 5 }, () => "#..............#"),
    "#............F.#",
    "################",
  ]);

  /** Premier pas en l'air après avoir marché hors du rebord (air = 1). */
  function offTheEdge(): PlayerState {
    let s = standAt(lv, 2, 5);
    for (let t = 0; t < 300; t++) {
      const next = stepPlayer(s, R, lv, P);
      if (!next.ground) return next;
      s = next;
    }
    throw new Error("jamais quitté le rebord");
  }

  it("saut accepté à k ≤ coyote pas après le bord, refusé au-delà", () => {
    const edge = offTheEdge();
    expect(edge.air).toBe(1);
    expect(tileAt(lv, 7, 6)).not.toBe(TILE_SOLID);
    for (let k = 1; k <= P.coyote + 2; k++) {
      const before = hold(edge, R, k - 1, lv);
      expect(before.air).toBe(k);
      const after = stepPlayer(before, R | J, lv, P);
      if (k <= P.coyote) expect(after.vy, `k = ${k}`).toBe(-P.jumpSpeed);
      else expect(after.vy, `k = ${k}`).toBeGreaterThan(0);
    }
  });

  it("pas de coyote après un saut (on ne resaute pas en l'air)", () => {
    const lv2 = room(20, 12);
    let s = stepPlayer(standAt(lv2, 4, 11), J, lv2, P);
    s = hold(s, 0, 3, lv2);
    expect(s.air).toBe(COUNTER_CAP);
    expect(stepPlayer(s, J, lv2, P).vy).toBeGreaterThan(-P.jumpSpeed + 4 * P.gravity);
  });
});

describe("tampon de saut", () => {
  const lv = room(20, 12);
  const dropped = () => floatAt(lv, 8 * T + 512, 5 * T);

  it("un appui fait k ≤ tampon pas avant le premier pas posé est pris, refusé au-delà", () => {
    // Pas où la chute se pose (ground passe à 1), sans commande.
    let s = dropped();
    let land = 0;
    while (!s.ground) {
      s = stepPlayer(s, 0, lv, P);
      land++;
    }
    const firstGrounded = land + 1; // premier pas qui commence posé (1 = premier pas joué)
    for (let k = 1; k <= P.jumpBuffer + 2; k++) {
      const pressAt = firstGrounded - k;
      let st = dropped();
      for (let t = 1; t <= firstGrounded; t++) st = stepPlayer(st, t >= pressAt ? J : 0, lv, P);
      if (k <= P.jumpBuffer) expect(st.vy, `k = ${k}`).toBe(-P.jumpSpeed);
      else expect(st.vy, `k = ${k}`).toBe(0);
    }
  });

  it("un appui gardé puis relâché avant l'atterrissage donne un saut court", () => {
    let s = dropped();
    let land = 0;
    while (!s.ground) {
      s = stepPlayer(s, 0, lv, P);
      land++;
    }
    let st = dropped();
    for (let t = 1; t <= land + 1; t++) st = stepPlayer(st, t === land - 3 ? J : 0, lv, P);
    expect(st.vy).toBe(-P.jumpCut); // saut pris au premier pas posé, et coupé aussitôt : bouton relâché
  });
});

describe("mur", () => {
  const lv = room(12, 30);
  const wallX = 13 * T; // bord gauche du mur de droite (intérieur : colonnes 1 à 12)

  it("glisse plafonnée en poussant le mur ; sans pousser, chute normale", () => {
    let s = floatAt(lv, wallX - PLAYER_WIDTH, 3 * T);
    s = hold(s, R, 80, lv);
    expect(playerMode(s)).toBe("mur");
    expect(s.slide).toBe(1);
    expect(s.vy).toBe(P.slideSpeed);
    // Arrivée rapide contre le mur : la vitesse redescend vers la glisse (à la gravité), sans dépasser.
    let fast = floatAt(lv, wallX - PLAYER_WIDTH, 3 * T, 0, P.fallSpeed);
    const v: number[] = [];
    for (let t = 0; t < 40; t++) {
      fast = stepPlayer(fast, R, lv, P);
      v.push(fast.vy);
    }
    for (let i = 1; i < v.length; i++) expect(v[i]!).toBeLessThanOrEqual(v[i - 1]!);
    expect(v[v.length - 1]).toBe(P.slideSpeed);
    let free = hold(floatAt(lv, wallX - PLAYER_WIDTH, 3 * T), 0, 60, lv);
    expect(free.slide).toBe(0);
    expect(free.vy).toBeGreaterThan(P.slideSpeed);
  });

  it("saut mural : repousse du mur et remonte", () => {
    let s = hold(floatAt(lv, wallX - PLAYER_WIDTH, 3 * T), R, 30, lv);
    expect(s.slide).toBe(1);
    const y0 = s.y;
    s = stepPlayer(s, J, lv, P);
    expect(s.vx).toBe(-P.wallJumpX);
    expect(s.vy).toBe(-P.wallJumpY);
    s = hold(s, L | J, 30, lv);
    expect(wallX - (s.x + PLAYER_WIDTH)).toBeGreaterThan(2 * T); // loin du mur
    expect(y0 - s.y).toBeGreaterThan(2 * T); // et plus haut
  });

  it("saut mural accepté à `wallReach` unités du mur, pas au-delà ; à gauche comme à droite", () => {
    for (const side of [-1, 1]) {
      for (const gap of [0, P.wallReach, P.wallReach + 1]) {
        const x = side > 0 ? wallX - PLAYER_WIDTH - gap : T + gap;
        const s = stepPlayer(floatAt(lv, x, 10 * T), J, lv, P);
        if (gap <= P.wallReach) expect(s.vx, `côté ${side}, ${gap}`).toBe(-side * P.wallJumpX);
        else expect(s.vx, `côté ${side}, ${gap}`).toBe(0);
      }
    }
  });

  it("coyote mural : saut mural encore accepté k ≤ wallCoyote pas après avoir quitté le mur", () => {
    const p: JumpParams = { ...P, wallReach: 0 }; // sans portée, seul le coyote mural peut servir
    const touching = hold(floatAt(lv, wallX - PLAYER_WIDTH, 3 * T), R, 20, lv, p);
    expect(touching.wallAir).toBe(0);
    for (let k = 0; k <= p.wallCoyote + 2; k++) {
      const before = hold(touching, L, k, lv, p);
      expect(before.wallAir).toBe(k);
      const after = stepPlayer(before, L | J, lv, p);
      if (k <= p.wallCoyote) expect(after.vx, `k = ${k}`).toBe(-p.wallJumpX);
      else expect(after.vx, `k = ${k}`).toBeGreaterThan(-p.wallJumpX);
    }
  });

  it("verrou : la commande vers le mur est ignorée pendant `wallLock` pas", () => {
    const p: JumpParams = { ...P, wallLock: 8 };
    let s = hold(floatAt(lv, wallX - PLAYER_WIDTH, 3 * T), R, 30, lv, p);
    s = stepPlayer(s, R | J, lv, p);
    expect(s.lock).toBe(8);
    const vx0 = s.vx;
    for (let t = 0; t < 8; t++) {
      s = stepPlayer(s, R | J, lv, p);
      expect(s.vx).toBe(vx0 + (t + 1) * p.airDecel); // pas d'accélération vers le mur : seul le freinage sans commande
    }
    expect(s.lock).toBe(0);
    expect(stepPlayer(s, R | J, lv, p).vx).toBe(s.vx + Math.max(p.airAccel, p.airDecel)); // verrou fini : demi-tour vers le mur
  });

  it("un mur isolé se remonte seul avec les réglages par défaut, pas avec un long verrou", () => {
    const [col, top] = SANDBOX_MARKS.wall;
    const from = standAt(SANDBOX_LEVEL, col - 1, FLOOR);
    const free = climbWall(SANDBOX_LEVEL, from, 1, 900);
    expect(free.best + PLAYER_HEIGHT).toBeLessThanOrEqual(top * T); // pieds au-dessus du sommet du mur
    const locked = climbWall(SANDBOX_LEVEL, from, 1, 900, { ...P, wallLock: 40 });
    expect(locked.best + PLAYER_HEIGHT).toBeGreaterThan(top * T);
  });

  it("les deux cheminées du bac à sable (3 et 2 de large) se montent en sauts muraux", () => {
    for (const [col, width] of SANDBOX_MARKS.chimneys) {
      const from = standAt(SANDBOX_LEVEL, col + (width === 3 ? 1 : 0), FLOOR);
      const { reachedAt } = climbChimney(SANDBOX_LEVEL, from, 1, SANDBOX_MARKS.chimneyTopRow * T, 900);
      expect(reachedAt, `cheminée de ${width}`).toBeGreaterThan(0);
      expect(reachedAt * TICK_S, `cheminée de ${width}`).toBeLessThan(2);
    }
  });
});

describe("tolérance de coin", () => {
  // Dalle (rangée 3) percée d'un trou d'une tuile en colonne 5 ; le personnage saute dessous, décalé de `d` unités.
  const lv = level(["#........F#", "#.........#", "#.........#", "#.........#", "#####.#####", "#.........#", "#S........#", "###########"]);
  const holeX = 5 * T;
  const passes = (x: number, p: JumpParams = P) => {
    let s = { ...standAt(lv, 1, 6), x };
    expect(boxHits(lv, s.x, s.y, PLAYER_WIDTH, PLAYER_HEIGHT)).toBe(false);
    let best = s.y;
    for (let t = 0; t < 60; t++) {
      s = stepPlayer(s, J, lv, p);
      best = Math.min(best, s.y);
    }
    return best + PLAYER_HEIGHT <= 4 * T; // pieds au-dessus de la dalle
  };

  it("une tête qui accroche le coin d'au plus `cornerTolerance` unités passe ; au-delà, elle cogne", () => {
    expect(tileAt(lv, 5, 4)).not.toBe(TILE_SOLID);
    expect(passes(holeX + 512)).toBe(true); // bien aligné
    // à gauche du trou : la tête mord sur la colonne 4
    expect(passes(holeX - P.cornerTolerance)).toBe(true);
    expect(passes(holeX - P.cornerTolerance - 1)).toBe(false);
    // à droite : la tête mord sur la colonne 6
    const right = holeX + T - PLAYER_WIDTH;
    expect(passes(right + P.cornerTolerance)).toBe(true);
    expect(passes(right + P.cornerTolerance + 1)).toBe(false);
    // sans tolérance, le moindre chevauchement cogne
    expect(passes(holeX - 1, { ...P, cornerTolerance: 0 })).toBe(false);
  });
});

describe("collisions", () => {
  it("MAX_SPEED est sous une tuile par pas et plafonne la vitesse quels que soient les réglages", () => {
    expect(MAX_SPEED).toBeLessThan(T);
    const wild: JumpParams = { ...P, runSpeed: 100_000, groundAccel: 100_000, jumpSpeed: 100_000, gravity: 100_000, fallSpeed: 100_000 };
    const lv = room(40, 40);
    let s = stepPlayer(standAt(lv, 3, 39), R | J, lv, wild);
    expect(Math.abs(s.vx)).toBeLessThanOrEqual(MAX_SPEED);
    expect(Math.abs(s.vy)).toBeLessThanOrEqual(MAX_SPEED);
    s = hold(s, R, 10, lv, wild);
    expect(Math.abs(s.vy)).toBeLessThanOrEqual(MAX_SPEED);
  });

  it("aucune traversée d'un mur d'une tuile à vitesse maximale, dans les 8 directions", () => {
    // Une salle de 6 × 6 aux murs d'une tuile, posée au milieu du vide : sortir de la salle = traverser un mur.
    const rows: string[] = [];
    for (let r = 0; r < 16; r++) rows.push("#" + ".".repeat(16) + "#");
    for (let r = 4; r <= 11; r++) {
      const line = rows[r]!.split("");
      for (let c = 5; c <= 12; c++) if (r === 4 || r === 11 || c === 5 || c === 12) line[c] = "#";
      rows[r] = line.join("");
    }
    rows[1] = "#S" + ".".repeat(14) + "F#";
    rows.push("#".repeat(18));
    const lv = level(rows);
    const inside = (s: PlayerState) => s.x >= 6 * T && s.x + PLAYER_WIDTH <= 12 * T && s.y >= 5 * T && s.y + PLAYER_HEIGHT <= 11 * T;
    const still: JumpParams = { ...P, groundAccel: 0, groundDecel: 0, airAccel: 0, airDecel: 0, gravity: 0, fallSpeed: MAX_SPEED };
    const rng = new Rng(18);
    let checks = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      for (let trial = 0; trial < 40; trial++) {
        // Départ quelconque dans la salle (toutes les phases sous la tuile).
        let s = floatAt(lv, 6 * T + rng.int(6 * T - PLAYER_WIDTH), 5 * T + rng.int(6 * T - PLAYER_HEIGHT));
        for (let t = 0; t < 12; t++) {
          s = stepPlayer({ ...s, vx: dx * MAX_SPEED, vy: dy * MAX_SPEED }, 0, lv, still);
          expect(boxHits(lv, s.x, s.y, PLAYER_WIDTH, PLAYER_HEIGHT)).toBe(false);
          expect(inside(s), `direction (${dx}, ${dy})`).toBe(true);
          checks++;
        }
      }
    }
    expect(checks).toBe(8 * 40 * 12);
  });

  it("un couloir d'une tuile de haut se traverse en courant", () => {
    const [col, len] = SANDBOX_MARKS.corridor;
    let s = standAt(SANDBOX_LEVEL, col - 3, FLOOR);
    let jumped = false;
    for (let t = 0; t < 240; t++) {
      // Un saut au milieu du couloir : la tête cogne, on continue.
      const jump: boolean = !jumped && s.x > (col + 3) * T;
      jumped ||= jump;
      s = stepPlayer(s, R | (jump ? J : 0), SANDBOX_LEVEL, P);
      expect(boxHits(SANDBOX_LEVEL, s.x, s.y, PLAYER_WIDTH, PLAYER_HEIGHT)).toBe(false);
      if (s.x > col * T && s.x < (col + len) * T) expect(s.y).toBeGreaterThanOrEqual(FLOOR * T); // toujours dans la rangée du couloir
    }
    expect(jumped).toBe(true);
    expect(s.x).toBeGreaterThan((col + len) * T);
  });

  it("un puits d'une tuile de large se descend et se remonte", () => {
    const rows = ["#.....#", "#.....#", "##.####", "##.####", "##.####", "##.####", "#.....#", "#S...F#", "#######"];
    const lv = level(rows);
    let s = floatAt(lv, 2 * T + 512, 0);
    s = hold(s, 0, 120, lv);
    expect(s.ground).toBe(1);
    expect(s.y + PLAYER_HEIGHT).toBe(8 * T); // au fond
    // Remonter : se placer sous le puits et sauter deux fois (le puits fait 4 tuiles).
    s = { ...s, x: 2 * T + 512 };
    let best = s.y;
    for (let t = 0; t < 60; t++) {
      s = stepPlayer(s, J, lv, P);
      best = Math.min(best, s.y);
    }
    expect(best + PLAYER_HEIGHT).toBeLessThan(6 * T); // les pieds sont entrés dans le puits
    expect(boxHits(lv, s.x, s.y, PLAYER_WIDTH, PLAYER_HEIGHT)).toBe(false);
  });
});

describe("bac à sable", () => {
  const lv = SANDBOX_LEVEL;

  it("contient ce que le lot demande", () => {
    expect(lv.width).toBeGreaterThanOrEqual(150);
    const s = initialPlayer(lv);
    expect(s.ground).toBe(1);
    expect(lv.start).toEqual({ col: SANDBOX_MARKS.start, row: FLOOR });
    expect(lv.finish).toEqual({ col: SANDBOX_MARKS.finish, row: FLOOR });
    // piste d'élan d'au moins 20 tuiles de sol continu depuis le départ
    let run = 0;
    for (let c = 1; tileAt(lv, c, FLOOR + 1) === TILE_SOLID && tileAt(lv, c, FLOOR) !== TILE_SOLID; c++) run++;
    expect(run).toBeGreaterThanOrEqual(20);
    for (const [col, h] of SANDBOX_MARKS.steps) {
      for (let r = 0; r < h; r++) expect(tileAt(lv, col, FLOOR - r)).toBe(TILE_SOLID);
      expect(tileAt(lv, col, FLOOR - h)).not.toBe(TILE_SOLID);
    }
    const widths = [...SANDBOX_MARKS.gaps, ...SANDBOX_MARKS.lowGaps].map(([, w]) => w);
    for (const w of [2, 3, 4, 5, 6]) expect(widths).toContain(w);
    for (const [col, w] of [...SANDBOX_MARKS.gaps, ...SANDBOX_MARKS.lowGaps]) {
      for (let c = col; c < col + w; c++) expect(tileAt(lv, c, FLOOR + 1)).not.toBe(TILE_SOLID);
      expect(tileAt(lv, col - 1, FLOOR + 1)).toBe(TILE_SOLID);
      expect(tileAt(lv, col + w, FLOOR + 1)).toBe(TILE_SOLID);
    }
    for (const [col, w, ceil] of SANDBOX_MARKS.lowGaps) for (let c = col; c < col + w; c++) expect(tileAt(lv, c, ceil)).toBe(TILE_SOLID);
    const [cc, cl] = SANDBOX_MARKS.corridor;
    for (let c = cc; c < cc + cl; c++) {
      expect(tileAt(lv, c, FLOOR - 1)).toBe(TILE_SOLID);
      expect(tileAt(lv, c, FLOOR)).not.toBe(TILE_SOLID);
    }
    for (const [col, w] of SANDBOX_MARKS.chimneys) {
      expect(tileAt(lv, col - 1, SANDBOX_MARKS.chimneyTopRow)).toBe(TILE_SOLID);
      expect(tileAt(lv, col + w, SANDBOX_MARKS.chimneyTopRow)).toBe(TILE_SOLID);
      for (let c = col; c < col + w; c++) for (let r = SANDBOX_MARKS.chimneyTopRow; r <= FLOOR; r++) expect(tileAt(lv, c, r)).not.toBe(TILE_SOLID);
      expect(FLOOR - SANDBOX_MARKS.chimneyTopRow).toBeGreaterThanOrEqual(9);
    }
  });

  /** Saute le trou qui commence en `col` (largeur `w`) : depuis l'arrêt au bord, ou avec élan ; vrai si posé de l'autre côté. */
  function crosses(col: number, w: number, runUp: boolean): boolean {
    let s: PlayerState;
    if (runUp) {
      s = standAt(lv, col - 4, FLOOR);
      // Courir et sauter au dernier pas posé (le bord).
      for (let t = 0; t < 200 && s.ground; t++) {
        const next = stepPlayer(s, R, lv, P);
        if (!next.ground) break;
        s = next;
      }
    } else {
      s = { ...standAt(lv, col - 1, FLOOR), x: col * T - PLAYER_WIDTH + 1 }; // au bord, à l'arrêt
    }
    s = stepPlayer(s, R | J, lv, P);
    for (let t = 0; t < 300 && !s.ground; t++) s = stepPlayer(s, R | J, lv, P);
    return s.y + PLAYER_HEIGHT === (FLOOR + 1) * T && s.x + PLAYER_WIDTH > (col + w) * T;
  }

  it("les trous de 2 à 6 se sautent à l'arrêt ; sous le plafond bas, il faut de l'élan", () => {
    for (const [col, w] of SANDBOX_MARKS.gaps) expect(crosses(col, w, false), `trou de ${w}`).toBe(true);
    for (const [col, w] of SANDBOX_MARKS.lowGaps) {
      expect(crosses(col, w, false), `trou bas de ${w}, à l'arrêt`).toBe(false);
      expect(crosses(col, w, true), `trou bas de ${w}, avec élan`).toBe(true);
    }
  });

  it("les marches de 1 à 4 tuiles se montent d'un saut", () => {
    for (const [col, h] of SANDBOX_MARKS.steps) {
      let s = standAt(lv, col - 2, FLOOR);
      // Saut tenu, en visant le milieu de la marche (2 tuiles de large).
      const aim = (st: PlayerState) => (st.x + PLAYER_WIDTH / 2 < (col + 1) * T ? R : L) | J;
      s = stepPlayer(s, aim(s), lv, P);
      for (let t = 0; t < 120 && !(s.ground && t > 2); t++) s = stepPlayer(s, aim(s), lv, P);
      expect(s.y + PLAYER_HEIGHT, `marche de ${h}`).toBe((FLOOR + 1 - h) * T);
    }
  });
});

describe("intégrité (fuzz)", () => {
  function assertSound(s: PlayerState, lv: Level, where: string) {
    for (const [k, v] of Object.entries(s)) {
      if (!Number.isInteger(v) || Object.is(v, -0)) throw new Error(`${where} : ${k} = ${String(v)} (entier sans −0 attendu)`);
    }
    if (Math.abs(s.vx) > MAX_SPEED || Math.abs(s.vy) > MAX_SPEED) throw new Error(`${where} : vitesse ${s.vx}, ${s.vy}`);
    if (boxHits(lv, s.x, s.y, PLAYER_WIDTH, PLAYER_HEIGHT)) throw new Error(`${where} : la boîte est dans un mur (${s.x}, ${s.y})`);
    for (const k of ["ground", "held", "jumping"] as const) if (s[k] !== 0 && s[k] !== 1) throw new Error(`${where} : ${k} = ${s[k]}`);
    for (const k of ["wallSide", "slide", "lockDir"] as const) if (s[k] < -1 || s[k] > 1) throw new Error(`${where} : ${k} = ${s[k]}`);
  }

  /** Des commandes aléatoires tenues un temps aléatoire (comme un joueur), depuis des endroits variés du bac à sable. */
  function fuzz(seed: number, runs: number, ticks: number, params: (rng: Rng) => JumpParams) {
    const rng = new Rng(seed);
    const lv = SANDBOX_LEVEL;
    let total = 0;
    for (let run = 0; run < runs; run++) {
      const p = params(rng);
      // Un départ au hasard : une colonne, posé sur la première surface en partant du haut.
      const col = 1 + rng.int(lv.width - 2);
      let row = 0;
      while (row < lv.height - 1 && tileAt(lv, col, row + 1) !== TILE_SOLID) row++;
      let s = tileAt(lv, col, row) === TILE_SOLID ? initialPlayer(lv) : standAt(lv, col, row);
      if (boxHits(lv, s.x, s.y, PLAYER_WIDTH, PLAYER_HEIGHT)) s = initialPlayer(lv);
      let input = 0;
      let left = 0;
      for (let t = 0; t < ticks; t++) {
        if (left-- <= 0) {
          input = rng.int(INPUT_MASK + 1);
          left = rng.int(40);
        }
        s = stepPlayer(s, input, lv, p);
        assertSound(s, lv, `graine ${seed}, essai ${run}, pas ${t}`);
        total++;
      }
    }
    return total;
  }

  it("réglages par défaut : des milliers de pas, tout reste entier, sans −0, sous MAX_SPEED, hors des murs", () => {
    expect(fuzz(20261014, 40, 2000, () => ({ ...P }))).toBe(80_000);
  });

  it("réglages au hasard (de 0 à 3 fois le défaut, et des extrêmes) : même intégrité", () => {
    const keys = Object.keys(DEFAULT_JUMP_PARAMS) as (keyof JumpParams)[];
    const total = fuzz(7, 60, 1000, (rng) => {
      const p = { ...P };
      for (const k of keys) p[k] = rng.chance(10) ? rng.int(5000) : rng.int(3 * P[k] + 2);
      return p;
    });
    expect(total).toBe(60_000);
  });
});

describe("déterminisme", () => {
  it("mêmes commandes ⇒ même état, deux fois (au bit près)", () => {
    const rng = new Rng(99);
    const inputs = Array.from({ length: 5000 }, () => rng.int(INPUT_MASK + 1));
    const play = () => {
      let s = initialPlayer(SANDBOX_LEVEL);
      const trace: PlayerState[] = [];
      for (const i of inputs) {
        s = stepPlayer(s, i, SANDBOX_LEVEL, P);
        trace.push(s);
      }
      return trace;
    };
    const a = play();
    const b = play();
    expect(b).toEqual(a);
    for (const [k, v] of Object.entries(a[a.length - 1]!)) expect(Object.is(v, b[b.length - 1]![k as keyof PlayerState])).toBe(true);
  });

  it("stepPlayer est pur : l'état et les réglages donnés ne bougent pas", () => {
    const s = initialPlayer(SANDBOX_LEVEL);
    const copy = { ...s };
    const params = { ...P };
    stepPlayer(s, R | J, SANDBOX_LEVEL, params);
    expect(s).toEqual(copy);
    expect(params).toEqual(P);
  });

  it("refuse une commande hors des 3 bits", () => {
    const s = initialPlayer(SANDBOX_LEVEL);
    for (const bad of [-1, 8, 1.5, Number.NaN]) expect(() => stepPlayer(s, bad, SANDBOX_LEVEL, P)).toThrow(RangeError);
  });

  it("isDefaultJumpParams repère un réglage modifié", () => {
    expect(isDefaultJumpParams({ ...DEFAULT_JUMP_PARAMS })).toBe(true);
    expect(isDefaultJumpParams({ ...DEFAULT_JUMP_PARAMS, gravity: DEFAULT_JUMP_PARAMS.gravity + 1 })).toBe(false);
    for (const v of Object.values(DEFAULT_JUMP_PARAMS)) expect(Number.isInteger(v) && v >= 0).toBe(true);
  });
});
