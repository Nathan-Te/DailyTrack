import { describe, expect, it } from "vitest";
import {
  AVION_VY_MAX,
  CASE,
  EV_BOND,
  EV_BOUCLIER,
  EV_PORTAIL,
  EV_VIRAGE,
  FACTEUR_LENT,
  FACTEUR_V1,
  FACTEUR_V2,
  FACTEUR_V3,
  MODE_AVION,
  MODE_GRAVITE,
  MODE_ONDE,
  MODE_RESSORT,
  MORT_BORD,
  MORT_PIQUE,
  MORT_VIDE,
  Partie,
  REGLES_COURANTES,
  RESSORT_ATTENTE,
  VITESSE_PLAFOND,
  VY_MAX,
  terrainDeTest,
  vitesseCamera,
  type Portail,
} from "../src/index";
import { morceau, trou } from "./aide";

// Lot GR6 — **les modes de vol et les portails**, un par un, sur des terrains écrits à la main. Un portail est une colonne du morceau (`portails` de `terrainDeTest`) ; le joueur part à la colonne 3 de ce couloir de 16 colonnes (plafond et
// sol de deux cases), à 120 pas par seconde, 7 cases/s.
const sur = (portails: (Portail & { m?: number })[], grilles: readonly (readonly string[])[] = []): Partie => new Partie(terrainDeTest(grilles, { portails }));
const pas = (p: Partie, n: number, avant?: (p: Partie) => void): Partie => {
  for (let i = 0; i < n && !p.finie; i++) {
    avant?.(p);
    p.avancer();
  }
  return p;
};
/** Avance jusqu'à ce que le mode soit `mode` (au plus 600 pas). */
const jusquau = (p: Partie, mode: number): Partie => {
  for (let i = 0; i < 600 && p.mode !== mode && !p.finie; i++) p.avancer();
  return p;
};

describe("l'entrée est l'état du bouton", () => {
  it("un appui puis un relâché sont deux changements, dans la rediffusion, un par pas", () => {
    const p = sur([]);
    p.appuyer();
    pas(p, 5);
    p.relacher();
    pas(p, 5);
    expect(p.changements).toEqual([0, 5]);
    expect(p.bouton).toBe(false);
  });
  it("un appui répété ne change rien (le bouton est déjà enfoncé), un relâché sans appui non plus", () => {
    const p = sur([]);
    p.relacher();
    p.appuyer();
    p.appuyer();
    pas(p, 3);
    expect(p.changements).toEqual([0]);
  });
  it("en gravité, seul le début d'un appui compte : maintenir ne réinverse pas, relâcher n'inverse rien", () => {
    const p = sur([]);
    p.appuyer();
    pas(p, 300); // maintenu 2,5 s : une seule inversion
    expect(p.inversions).toBe(1);
    p.relacher();
    pas(p, 100);
    expect(p.inversions).toBe(1);
    expect(p.g).toBe(-1);
  });
});

describe("les portails de mode", () => {
  it("le portail d'entrée change le mode au passage du milieu de sa colonne, et lève l'événement ; celui de retour revient à la gravité, vers le sol", () => {
    const p = sur([
      { c: 6, type: "avion" },
      { c: 12, type: "gravite" },
    ]);
    expect(p.mode).toBe(MODE_GRAVITE);
    let evenements = 0;
    let dernierPortail = "";
    let xEntree = 0;
    for (let i = 0; i < 800 && evenements < 2; i++) {
      p.avancer();
      if (p.ev & EV_PORTAIL) {
        evenements++;
        dernierPortail = p.portail!;
        if (p.mode === MODE_AVION) xEntree = p.x + 1638;
      }
    }
    expect(evenements).toBe(2);
    expect(dernierPortail).toBe("gravite");
    expect(xEntree).toBeGreaterThan(6 * CASE + CASE / 2); // le centre du joueur a dépassé le milieu de la colonne 6
    expect(xEntree).toBeLessThan(6 * CASE + CASE / 2 + 700);
    expect(p.mode).toBe(MODE_GRAVITE);
    expect(p.g).toBe(1);
    expect(p.modeLoin).toBe(MODE_AVION);
  });
  it("on est toujours remis à l'endroit en entrant dans un mode (jamais un avion la tête en bas) ; en sortant on retombe vers le sol", () => {
    for (const type of ["avion", "onde", "ressort"] as const) {
      const p = sur([
        { c: 4, type, m: 1 },
        { c: 10, type: "gravite", m: 1 },
      ]);
      p.appuyer(); // on part au plafond, la gravité vers le haut
      pas(p, 2);
      p.relacher();
      pas(p, 90);
      expect(p.g).toBe(-1);
      expect(p.mode).toBe(MODE_GRAVITE); // pas encore au portail
      jusquau(p, type === "avion" ? MODE_AVION : type === "onde" ? MODE_ONDE : MODE_RESSORT);
      expect(p.g, `entrée ${type}`).toBe(1); // remis à l'endroit
      jusquau(p, MODE_GRAVITE);
      expect(p.mode).toBe(MODE_GRAVITE);
      expect(p.g).toBe(1);
    }
  });
  it("un portail ne se franchit qu'une fois (le joueur ne recule jamais)", () => {
    const p = sur([{ c: 5, type: "ressort" }]);
    let n = 0;
    for (let i = 0; i < 400; i++) {
      p.avancer();
      if (p.ev & EV_PORTAIL) n++;
    }
    expect(n).toBe(1);
    expect(p.mode).toBe(MODE_RESSORT);
  });
});

describe("l'avion : on monte en maintenant, on descend en relâchant, avec de l'inertie", () => {
  const avion = (): Partie => jusquau(sur([{ c: 4, type: "avion" }]), MODE_AVION);
  it("maintenu on monte, relâché on descend ; la vitesse verticale grandit peu à peu (de l'inertie) et reste bornée", () => {
    const p = avion();
    const y0 = p.y;
    p.appuyer();
    pas(p, 1);
    const apresUnPas = p.vy;
    expect(apresUnPas).toBeLessThan(0);
    expect(Math.abs(apresUnPas)).toBeLessThan(AVION_VY_MAX / 10); // pas tout d'un coup
    pas(p, 20);
    expect(p.y).toBeLessThan(y0);
    expect(p.vy).toBeLessThan(apresUnPas); // plus vite vers le haut
    pas(p, 200);
    expect(p.vy).toBeGreaterThanOrEqual(-AVION_VY_MAX); // borné
    p.relacher();
    pas(p, 3);
    const hauteur = p.y;
    pas(p, 30);
    expect(p.y).toBeGreaterThan(hauteur); // on redescend
    expect(Math.abs(p.vy)).toBeLessThanOrEqual(AVION_VY_MAX);
  });
  it("le plafond et le sol se touchent sans mourir : on glisse (la boîte reste contre la surface, la partie continue)", () => {
    const p = avion();
    p.appuyer();
    pas(p, 400); // 3 s contre le plafond
    expect(p.finie).toBe(false);
    expect(p.y).toBe(2 * CASE + 1);
    const x = p.x;
    pas(p, 30);
    expect(p.x).toBeGreaterThan(x); // on avance toujours
    p.relacher();
    pas(p, 400); // 3 s contre le sol
    expect(p.finie).toBe(false);
    expect(p.y).toBe(10 * CASE - 3277 - 1);
    expect(p.sol).toBe(false); // jamais « posé » : un avion ne se pose pas
  });
  it("le rouge tue : un pique dans le couloir", () => {
    const p = sur([{ c: 5, type: "avion" }], [morceau([[10, 9, "^"], [11, 9, "^"]])]);
    pas(p, 400);
    expect(p.mort).toBe(MORT_PIQUE);
  });
  it("un mur arrête, et la caméra rattrape : le bord gauche tue", () => {
    const mur = Array.from({ length: 8 }, (_, i): [number, number, string] => [10, 2 + i, "#"]);
    const p = sur([{ c: 5, type: "avion" }], [morceau(mur)]);
    pas(p, 1200);
    expect(p.mort).toBe(MORT_BORD);
  });
});

describe("l'onde : 45°, le signe suit le bouton", () => {
  const onde = (): Partie => jusquau(sur([{ c: 4, type: "onde" }]), MODE_ONDE);
  it("maintenu on monte à 45°, relâché on descend à 45° : la vitesse verticale est celle de la course", () => {
    const p = onde();
    p.appuyer();
    pas(p, 1);
    const x1 = p.x;
    const y1 = p.y;
    pas(p, 40);
    const dx = p.x - x1;
    const dy = y1 - p.y;
    expect(dy).toBeGreaterThan(0);
    expect(Math.abs(dy - dx)).toBeLessThanOrEqual(40); // une unité par pas d'écart au plus (la division est tronquée)
    p.relacher();
    pas(p, 1);
    const y2 = p.y;
    const x2 = p.x;
    pas(p, 40);
    expect(Math.abs(p.y - y2 - (p.x - x2))).toBeLessThanOrEqual(40);
    expect(p.vy).toBeGreaterThan(0);
  });
  it("un changement de sens lève EV_VIRAGE", () => {
    const p = onde();
    p.appuyer();
    pas(p, 5);
    p.relacher();
    let virage = false;
    for (let i = 0; i < 3; i++) {
      p.avancer();
      if (p.ev & EV_VIRAGE) virage = true;
    }
    expect(virage).toBe(true);
  });
  it("le sol et le plafond se glissent sans mourir ; ce sont les piques qui tuent", () => {
    const p = onde();
    p.appuyer();
    pas(p, 300);
    expect(p.finie).toBe(false);
    expect(p.y).toBe(2 * CASE + 1);
    p.relacher();
    pas(p, 300);
    expect(p.finie).toBe(false);
    const q = sur([{ c: 5, type: "onde" }], [morceau([[11, 9, "^"]])]);
    pas(q, 300);
    expect(q.mort).toBe(MORT_PIQUE);
  });
});

describe("le ressort : un bond à chaque début d'appui, même en l'air", () => {
  const ressort = (portails: (Portail & { m?: number })[] = [{ c: 4, type: "ressort" }], g: readonly (readonly string[])[] = []): Partie => jusquau(sur(portails, g), MODE_RESSORT);
  const bonds = (p: Partie, n: number, appuis: readonly number[]): number[] => {
    const t0 = p.tick;
    const ticks: number[] = [];
    for (let i = 0; i < n && !p.finie; i++) {
      const t = p.tick - t0;
      if (appuis.includes(t)) p.appuyer();
      else if (p.bouton) p.relacher();
      p.avancer();
      if (p.ev & EV_BOND) ticks.push(t);
    }
    return ticks;
  };
  it("un appui donne un bond vers le haut, même en l'air ; la gravité est plus faible qu'en gravité", () => {
    const p = ressort();
    const y0 = p.y;
    const b = bonds(p, 30, [0]);
    expect(b).toEqual([0]);
    expect(p.y).toBeLessThan(y0); // il monte
    const vyAvant = p.vy;
    const air = bonds(p, 40, [0, 20]); // un second appui en l'air : un second bond
    expect(air.length).toBeGreaterThanOrEqual(1);
    expect(p.vy).not.toBe(vyAvant);
  });
  it("au moins 12 pas entre deux bonds : un appui qui arrive trop tôt est gardé (tampon) et bondit dès que c'est permis", () => {
    const p = ressort();
    const b = bonds(p, 60, [0, 4]);
    expect(b[0]).toBe(0);
    expect(b[1]! - b[0]!).toBeGreaterThanOrEqual(RESSORT_ATTENTE);
    expect(b[1]! - b[0]!).toBeLessThanOrEqual(RESSORT_ATTENTE + 1);
  });
  it("la gravité du ressort est réduite : en l'air il tombe moins vite qu'en mode gravité", () => {
    const a = ressort();
    const b = sur([]);
    for (const q of [a, b]) {
      q.appuyer();
      pas(q, 1);
      q.relacher();
    }
    // le ressort a bondi vers le haut ; on mesure l'accélération : la vitesse gagnée pendant 20 pas en l'air
    pas(a, 10);
    pas(b, 10);
    const va = a.vy;
    const vb = b.vy;
    pas(a, 20);
    pas(b, 20);
    expect(Math.abs(a.vy - va) / 20).toBeLessThan(Math.abs(b.vy - vb) / 20);
  });
  it("le vide tue ; un bouclier qui sauve d'une chute dans un mode remet en mode gravité", () => {
    const grille = morceau(trou(9, 16));
    const sans = ressort([{ c: 5, type: "ressort" }], [grille]);
    pas(sans, 600);
    expect(sans.mort).toBe(MORT_VIDE);
    const avec = ressort([{ c: 5, type: "ressort" }], [grille]);
    avec.bouclier = true;
    for (let i = 0; i < 600 && !(avec.ev & EV_BOUCLIER) && !avec.finie; i++) avec.avancer();
    expect(avec.finie).toBe(false);
    expect(avec.ev & EV_BOUCLIER).toBeTruthy(); // le bouclier a sauvé de la chute
    expect(avec.mode).toBe(MODE_GRAVITE); // et remet en mode gravité
    expect(avec.bouclier).toBe(false);
  });
});

describe("le bouclier, dans un mode", () => {
  it("un pique dans l'avion : le bouclier sauve (une fois), le mode reste l'avion, 0,8 s d'invulnérabilité", () => {
    const p = sur([{ c: 5, type: "avion" }], [morceau([[11, 9, "^"]])]);
    p.bouclier = true;
    pas(p, 200);
    expect(p.finie).toBe(false);
    expect(p.mode).toBe(MODE_AVION);
    expect(p.bouclier).toBe(false);
    expect(p.invuln).toBeGreaterThanOrEqual(0);
  });
});

describe("les portails de vitesse", () => {
  it("chaque portail multiplie la vitesse de la caméra jusqu'au suivant : lent ×0,8 ; › ×1,15 ; ›› ×1,3 ; ››› ×1,5", () => {
    expect([FACTEUR_LENT, FACTEUR_V1, FACTEUR_V2, FACTEUR_V3]).toEqual([80, 115, 130, 150]);
    const cam = 0;
    const base = vitesseCamera(cam, REGLES_COURANTES);
    expect(vitesseCamera(cam, REGLES_COURANTES, FACTEUR_LENT)).toBe(Math.trunc((base * 80) / 100));
    expect(vitesseCamera(cam, REGLES_COURANTES, FACTEUR_V1)).toBe(Math.trunc((base * 115) / 100));
    expect(vitesseCamera(cam, REGLES_COURANTES, FACTEUR_V3)).toBe(Math.trunc((base * 150) / 100));
  });
  it("le plafond absolu : jamais plus de 17 cases/s, même à la vitesse maximale sous ›››", () => {
    expect(VITESSE_PLAFOND).toBe(17 * CASE);
    expect(vitesseCamera(10_000_000, REGLES_COURANTES, FACTEUR_V3)).toBe(VITESSE_PLAFOND);
    // ›› à la croisière de la première boucle (12,5 cases/s) : 16,25 cases/s, sous le plafond ; à celle des boucles suivantes (14 à 15 cases/s) le plafond l'emporte.
    expect(vitesseCamera(1000 * CASE, REGLES_COURANTES, FACTEUR_V2)).toBe(Math.trunc((REGLES_COURANTES.vitesseMax * 130) / 100));
    expect(vitesseCamera(10_000_000, REGLES_COURANTES, FACTEUR_V2)).toBe(VITESSE_PLAFOND);
    expect(VITESSE_PLAFOND).toBeLessThanOrEqual(VY_MAX);
  });
  it("dans la partie : le portail change le facteur, la caméra suit la vitesse réelle, et un autre portail le remplace", () => {
    const p = sur([
      { c: 5, type: "v3" },
      { c: 12, type: "lent" },
    ]);
    const cam0 = p.cam;
    pas(p, 5);
    const vitesseNormale = p.cam - p.precCam;
    let vu3 = false;
    for (let i = 0; i < 400 && p.facteur !== FACTEUR_LENT; i++) {
      p.avancer();
      if (p.facteur === FACTEUR_V3 && (p.ev & EV_PORTAIL) === 0) {
        vu3 = true;
        expect(p.cam - p.precCam).toBeGreaterThan(vitesseNormale); // plus vite sous ›››
        expect(p.cam - p.precCam).toBeLessThanOrEqual(Math.trunc(VITESSE_PLAFOND / 120));
      }
    }
    expect(vu3).toBe(true);
    expect(p.facteur).toBe(FACTEUR_LENT);
    pas(p, 2);
    expect(p.cam - p.precCam).toBeLessThan(vitesseNormale);
    expect(p.cam).toBeGreaterThan(cam0);
  });
  it("un portail de vitesse ne change pas le mode", () => {
    const p = sur([{ c: 5, type: "v2" }]);
    pas(p, 200);
    expect(p.facteur).toBe(FACTEUR_V2);
    expect(p.mode).toBe(MODE_GRAVITE);
  });
});
