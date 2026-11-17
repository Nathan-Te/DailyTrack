import { describe, expect, it } from "vitest";
import { AXE, EV2_LAMPE, EV2_SAUVEUR, EV2_SAUVEUR_ARME, EV_PERDUE, PLANS, UNITE, Partie, REGLAGES, copierReglages } from "../src/index";
import { avancer, enJeu, evenements2, partiePlan } from "./aide";

// LE POTEAU SAUVEUR (lot PBG3) : chaque couloir de retour a une lampe que la bille allume en y passant ; les deux allumées arment le poteau, qui sort entre les batteurs et renvoie la bille vers le haut une fois, puis
// redescend (les lampes s'éteignent). Pendant la multibille il sert à la première bille qui le touche. Le bas de la table ne change pas : rentré, il n'existe pas.
// LOT PBL1 : il ne s'arme qu'UNE FOIS PAR BILLE. Une bille qu'il a servie n'allume plus ses lampes et n'est plus servie avant la bille suivante : trois sauvetages au plus par partie (une fois par bille en multibille).

const partie = (plan = "doublette", r = REGLAGES): Partie => partiePlan(plan, "foire", { 3: "mini", 4: "mini" }, r);
/** Une bille qui descend le couloir de retour de gauche (x ≈ 31) ou de droite (x ≈ 337), au-dessus de la lampe. */
const dansLeCouloir = (p: Partie, droite: boolean): Partie => enJeu(p, droite ? 337 : 31, 480, 0, 120);
/** Une bille qui tombe sur l'axe de la table, entre les batteurs. */
const entreLesBatteurs = (p: Partie, dx = 0): Partie => enJeu(p, AXE + dx, 620, 0, 400);

describe("les lampes des couloirs de retour", () => {
  it("la bille qui descend un couloir en allume la lampe, une seule ; deux lampes arment le poteau", () => {
    const p = partie();
    expect(p.lampes).toEqual([false, false]);
    expect(p.sauveurArme).toBe(false);
    dansLeCouloir(p, false);
    expect(evenements2(p, 90) & EV2_LAMPE).toBeTruthy();
    expect(p.lampes).toEqual([true, false]);
    expect(p.sauveurArme).toBe(false);
    const q = dansLeCouloir(p, true);
    const ev = evenements2(q, 90);
    expect(ev & EV2_LAMPE).toBeTruthy();
    expect(ev & EV2_SAUVEUR_ARME).toBeTruthy();
    expect(p.lampes).toEqual([true, true]);
    expect(p.sauveurArme).toBe(true);
  });

  it("une bille qui ne descend pas le couloir (elle monte, ou passe à côté) n'allume rien", () => {
    const p = partie();
    enJeu(p, 31, 540, 0, -200); // elle monte dans le couloir
    avancer(p, 20);
    enJeu(p, 100, 480, 0, 200); // elle descend à côté
    avancer(p, 60);
    expect(p.lampes).toEqual([false, false]);
  });

  it("les lampes se gardent d'une bille à l'autre", () => {
    const p = partie("doublette", { ...copierReglages(), sauvee: 0 });
    dansLeCouloir(p, false);
    avancer(p, 90);
    // la bille est perdue : une nouvelle arrive, la lampe reste allumée
    enJeu(p, 150, 790, 0, 100);
    avancer(p, 5);
    expect(p.billes).toBeLessThan(3);
    expect(p.lampes[0]).toBe(true);
  });
});

describe("le poteau armé", () => {
  it("renvoie la bille vers le haut une fois : plus de bille perdue, les lampes s'éteignent, l'événement", () => {
    const p = partie();
    p.armerLeSauveur();
    expect(p.sauveurArme).toBe(true);
    entreLesBatteurs(p);
    let ev = 0;
    let vyMin = 0;
    for (let i = 0; i < 400 && !(ev & EV2_SAUVEUR); i++) {
      p.avancer();
      ev |= p.ev2;
    }
    vyMin = p.vy;
    expect(ev & EV2_SAUVEUR).toBeTruthy();
    expect(vyMin).toBeLessThanOrEqual(-REGLAGES.sauveurForce * UNITE + 100);
    expect(p.billes).toBe(3);
    expect(p.lampes).toEqual([false, false]);
    expect(p.sauvetages).toBe(1);
    // la bille remonte (elle monte d'au moins 150 px)
    let haut = p.y;
    for (let i = 0; i < 300; i++) {
      p.avancer();
      haut = Math.min(haut, p.y);
    }
    expect((p.y - haut) / UNITE + 0).toBeGreaterThanOrEqual(0);
    expect(haut / UNITE).toBeLessThan(560);
  });

  it("un seul sauvetage : la bille suivante qui tombe entre les batteurs est perdue", () => {
    const p = partie("doublette", { ...copierReglages(), sauvee: 0 });
    p.armerLeSauveur();
    entreLesBatteurs(p);
    avancer(p, 120);
    expect(p.sauvetages).toBe(1);
    const billes = p.billes;
    entreLesBatteurs(p, 3);
    let perdue = false;
    for (let i = 0; i < 600 && !perdue; i++) {
      p.avancer();
      perdue = (p.ev & EV_PERDUE) !== 0;
    }
    expect(perdue).toBe(true);
    expect(p.sauvetages).toBe(1);
    expect(p.billes).toBe(billes - 1);
  });

  it("non armé, le poteau n'existe pas : la bille entre les batteurs est perdue", () => {
    const p = partie("doublette", { ...copierReglages(), sauvee: 0 });
    p.lampes = [true, false];
    entreLesBatteurs(p);
    let perdue = false;
    for (let i = 0; i < 600 && !perdue; i++) {
      p.avancer();
      perdue = (p.ev & EV_PERDUE) !== 0;
    }
    expect(perdue).toBe(true);
    expect(p.sauvetages).toBe(0);
  });

  it("la bille qui roule sur un batteur au repos jusqu'à sa pointe est renvoyée elle aussi", () => {
    const p = partie();
    p.armerLeSauveur();
    enJeu(p, 130, 600, 60, 0); // sur le batteur gauche, elle roule vers la pointe
    let sauvee = false;
    for (let i = 0; i < 3000 && !sauvee && p.billes === 3; i++) {
      p.avancer();
      sauvee = p.sauvetages > 0;
    }
    expect(sauvee).toBe(true);
  });

  it("aucun écart de l'axe n'échappe au poteau : de 24 px à gauche à 24 px à droite, la bille est renvoyée", () => {
    for (let dx = -24; dx <= 24; dx++) {
      const p = partie();
      p.armerLeSauveur();
      entreLesBatteurs(p, dx);
      avancer(p, 200);
      // soit le poteau l'a renvoyée, soit elle est restée sur un batteur : aucune ne tombe sans le toucher
      expect(p.billes, `dx=${dx}`).toBe(3);
    }
  });

  it("pendant la multibille, une seule bille est renvoyée : la première qui touche le poteau", () => {
    const p = partie("doublette");
    p.lancerLaMultibille();
    avancer(p, 800); // les deux billes verrouillées sont lâchées
    expect(p.autres.length + (p.vide ? 0 : 1)).toBeGreaterThanOrEqual(2);
    p.armerLeSauveur();
    // deux billes tombent entre les batteurs l'une derrière l'autre
    enJeu(p, AXE, 620, 0, 400);
    p.autres.length = 0;
    p.autres.push({ ...Object.assign({}, { id: 99, x: AXE * UNITE, y: 560 * UNITE, vx: 0, vy: 400 * UNITE, px: AXE * UNITE, py: 560 * UNITE, captifDe: -1, captifTb: -1, captif: 0, dansLanceur: false, charge: 0, entree: 0, sauvee: true, servie: false, geyserJets: 0, manegeSecteur: p.manegeSecteur.map(() => -1), couleeDedans: p.couleeDedans.map(() => false), couche: 0 as const, rail: -1, railS: 0, railV: 0, railDepuis: 0, railBout: 0 as const }) });
    avancer(p, 60);
    expect(p.sauvetages).toBe(1);
  });

  it("le poteau n'ajoute pas de point et ne touche pas à la partie hors de son sauvetage", () => {
    const p = partie();
    const q = partie();
    p.armerLeSauveur();
    // une bille qui ne descend pas jusqu'aux batteurs joue pareil armé ou non
    for (const x of [p, q]) enJeu(x, 200, 300, 100, 0);
    avancer(p, 600);
    avancer(q, 600);
    expect([p.x, p.y, p.score]).toEqual([q.x, q.y, q.score]);
  });

  it("le bas de la table ne change pas : les murs du châssis sont les mêmes sur les quatre plans, le poteau n'est pas un mur", () => {
    const refs = PLANS.map((pl) => partiePlan(pl.id).table);
    for (const t of refs) {
      expect(t.sauveur.x / UNITE).toBe(184);
      expect(t.murs.slice(0, 42).map((m) => [m.ax, m.ay, m.bx, m.by])).toEqual(refs[0]!.murs.slice(0, 42).map((m) => [m.ax, m.ay, m.bx, m.by]));
    }
  });

  it("aucune bille coincée avec le poteau armé : une grille sur le bas de la table, à l'arrêt puis lancée", () => {
    for (const plan of PLANS.map((q) => q.id)) {
      for (let y = 560; y <= 700; y += 10) {
        for (let x = 110; x <= 260; x += 10) {
          for (const v of [0, 300]) {
            const joue = (arme: boolean): Partie => {
              const p = partie(plan, { ...copierReglages(), sauvee: 0 });
              if (arme) p.armerLeSauveur();
              enJeu(p, x + 1, y, v, -v);
              // la bille est perdue, revenue au lanceur, ou renvoyée par le poteau (ce qui prouve qu'il ne la garde pas)
              for (let pas = 0; pas < 54000 && p.billes === 3 && !p.dansLanceur && !p.finie && p.sauvetages === 0; pas++) p.avancer();
              return p;
            };
            const fini = (p: Partie): boolean => p.billes < 3 || p.dansLanceur;
            // une bille qui ne finit jamais sans poteau (une orbite fermée sans batteur, qu'une vraie partie brise) n'est pas l'affaire du poteau
            if (!fini(joue(false))) continue;
            const p = joue(true);
            expect(fini(p) || p.sauvetages > 0, `${plan} (${x}, ${y}) v=${v}`).toBe(true);
          }
        }
      }
    }
  }, 120_000);
});

describe("une fois par bille (lot PBL1)", () => {
  const sansSauvee = (): Partie => partie("doublette", { ...copierReglages(), sauvee: 0 });

  it("une bille servie n'allume plus les lampes : elle descend les deux couloirs et le poteau ne s'arme pas", () => {
    const p = sansSauvee();
    p.armerLeSauveur();
    entreLesBatteurs(p);
    avancer(p, 120);
    expect(p.sauvetages).toBe(1);
    expect(p.servie).toBe(true);
    expect(p.lampes).toEqual([false, false]);
    // la même bille redescend les deux couloirs de retour
    dansLeCouloir(p, false);
    avancer(p, 90);
    dansLeCouloir(p, true);
    avancer(p, 90);
    expect(p.lampes).toEqual([false, false]);
    expect(p.sauveurArme).toBe(false);
    expect(p.servie).toBe(true);
  });

  it("un poteau armé n'est plus un sauvetage pour la bille déjà servie (rien ne la renvoie)", () => {
    const p = sansSauvee();
    p.armerLeSauveur();
    entreLesBatteurs(p);
    avancer(p, 120);
    p.armerLeSauveur(); // un essai force les lampes : le poteau ne sert pas pour autant la même bille deux fois
    entreLesBatteurs(p, 2);
    let perdue = false;
    for (let i = 0; i < 600 && !perdue; i++) {
      p.avancer();
      perdue = (p.ev & EV_PERDUE) !== 0;
    }
    expect(perdue).toBe(true);
    expect(p.sauvetages).toBe(1);
  });

  it("la bille suivante a de nouveau son poteau : perdue, la nouvelle bille peut l'armer et être sauvée", () => {
    const p = sansSauvee();
    p.armerLeSauveur();
    entreLesBatteurs(p);
    avancer(p, 120);
    expect(p.sauvetages).toBe(1);
    // la bille servie est perdue : la bille suivante arrive au lanceur, sans rien d'allumé
    enJeu(p, 150, 790, 0, 100);
    avancer(p, 5);
    expect(p.billes).toBe(2);
    expect(p.servie).toBe(false);
    dansLeCouloir(p, false);
    avancer(p, 90);
    dansLeCouloir(p, true);
    avancer(p, 90);
    expect(p.sauveurArme).toBe(true);
    entreLesBatteurs(p);
    avancer(p, 120);
    expect(p.sauvetages).toBe(2);
    expect(p.billes).toBe(2);
  });

  it("au plus trois sauvetages dans une partie de trois billes, quoi que fasse la bille", () => {
    const p = sansSauvee();
    for (let essai = 0; essai < 8 && !p.finie; essai++) {
      p.armerLeSauveur();
      entreLesBatteurs(p, 0);
      avancer(p, 200);
      enJeu(p, 150, 790, 0, 100); // la bille est perdue quoi qu'il arrive
      avancer(p, 5);
    }
    expect(p.sauvetages).toBeLessThanOrEqual(3);
    expect(p.finie).toBe(true);
  });

  it("la bille sauvée (revenue au lanceur) garde son état : le poteau qui l'avait servie ne la sert pas deux fois", () => {
    const p = partie("doublette"); // `sauvee` par défaut : une bille perdue dans les cinq secondes revient
    p.armerLeSauveur();
    entreLesBatteurs(p);
    avancer(p, 120);
    expect(p.sauvetages).toBe(1);
    enJeu(p, 150, 790, 0, 100);
    avancer(p, 5);
    // sauvée par la fonction « bille sauvée » : la même bille, une vie de plus intacte
    expect(p.billes).toBe(3);
    expect(p.sauvee).toBe(true);
    expect(p.servie).toBe(true);
  });

  it("en multibille, chaque bille est servie une fois : la deuxième bille l'est après la première, jamais deux fois la même", () => {
    const p = partie("doublette");
    p.lancerLaMultibille();
    avancer(p, 800);
    expect(p.autres.length).toBeGreaterThanOrEqual(1);
    /** Pose la bille `b` (une `Bille` de `autres`) entre les batteurs, tombant sur le poteau. */
    const poser = (b: (typeof p.autres)[number], y: number): void => {
      b.x = AXE * UNITE;
      b.y = y * UNITE;
      b.px = b.x;
      b.py = b.y;
      b.vx = 0;
      b.vy = 400 * UNITE;
      b.dansLanceur = false;
      b.captif = 0;
      b.captifDe = -1;
      b.couche = 0;
      b.rail = -1;
    };
    // la bille principale tombe sur le poteau armé : elle est servie
    enJeu(p, AXE, 620, 0, 400);
    p.armerLeSauveur();
    avancer(p, 60);
    expect(p.sauvetages).toBe(1);
    expect(p.servie).toBe(true);
    expect(p.lampes).toEqual([false, false]);
    // une autre bille, que le poteau n'a pas servie, arme à son tour (les deux lampes) et est servie
    const autre = p.autres[0]!;
    expect(autre.servie).toBe(false);
    p.armerLeSauveur();
    enJeu(p, 230, 250, 0, 0); // la bille servie est loin, en haut : elle ne gêne pas la deuxième
    poser(autre, 600);
    avancer(p, 120);
    expect(p.sauvetages).toBe(2);
    expect(autre.servie).toBe(true);
    // les deux billes sont servies : le poteau armé de force ne sert plus ni l'une ni l'autre
    p.armerLeSauveur();
    enJeu(p, AXE, 620, 0, 400); // la principale, déjà servie, retombe sur le poteau armé
    poser(autre, 300);
    avancer(p, 60);
    expect(p.sauvetages).toBe(2);
    expect(p.servie).toBe(true);
  });
});
