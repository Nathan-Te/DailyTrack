import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALTERNE_A,
  ALTERNE_B,
  CLIGNOTANT,
  CLIGNOTANT_ALLUME,
  CLIGNOTANT_CYCLE,
  GRAVITY_GENERATOR_VERSION,
  LARGEUR_MORCEAU,
  MORCEAUX_PAR_BOUCLE,
  Partie,
  solide,
  terrainDeTest,
  terrainDuJour,
  dailyGravity,
  type TypePortail,
} from "@cdj/gravity-sim";
import { THEMES, HAZARD, BLOCK_STYLE } from "@cdj/visuels/plateformes";
import { Art } from "@cdj/visuels/plateformes/three";
import { couleursGravity } from "../src/couleurs";
import { dessinAvion, dessinCadrePortail, dessinIconePortail, dessinRessort, dessinVoilePortail } from "../src/dessinsModes";
import { dessinAnneau, dessinBloc, dessinBonus, dessinChevrons, dessinDisque, dessinFleche, dessinGemme, dessinInverseur, dessinPan, dessinPiece, dessinRuban, dessinTirets, etatDuBloc, type TypeBloc, type VarianteBloc } from "../src/dessins";
import { Monde, geometrieDesColonnes } from "../src/monde3d";

// Lot GR3 — le rendu de Gravity : la DA de Jump vient de `@cdj/visuels`, le reste est propre au jeu. Ce que ces tests tiennent : le rendu ne lit que l'état de la simulation, le rouge n'est qu'aux dangers, les blocs qui changent
// s'annoncent toujours, le monde se construit et se libère sur tout un niveau.
// Lot GR6 : les fichiers des modes de vol (dessins, décisions d'annonce, vitesse) sont du rendu comme les autres.
const FICHIERS = ["scene.ts", "monde3d.ts", "heros.ts", "effets.ts", "hud.ts", "dessins.ts", "couleurs.ts", "dessinsModes.ts", "modesLogique.ts", "vitesse.ts"];
const SRC = new URL("../src/", import.meta.url);

describe("le rendu ne décide rien du jeu", () => {
  it("aucun hasard ni horloge murale dans les dessins et les sensations (tout suit les pas) ; aucun innerHTML", () => {
    for (const f of FICHIERS) {
      const s = readFileSync(new URL(f, SRC), "utf8").replace(/^\s*\/\/.*$/gm, "");
      expect(s, f).not.toMatch(/Math\.random|Date\.now|new Date\(/);
      expect(s, f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\(/);
    }
    // seule la scène mesure le temps du mur (l'interpolation entre deux pas et l'attente de la mort)
    for (const f of FICHIERS.filter((x) => x !== "scene.ts")) expect(readFileSync(new URL(f, SRC), "utf8").replace(/^\s*\/\/.*$/gm, ""), f).not.toMatch(/performance\.now/);
  });
  it("seule la scène appelle la simulation (avancer, appuyer, relacher) : les dessins la lisent", () => {
    for (const f of FICHIERS.filter((x) => x !== "scene.ts")) expect(readFileSync(new URL(f, SRC), "utf8").replace(/^\s*\/\/.*$/gm, ""), f).not.toMatch(/\.(avancer|appuyer|relacher|sauterAuThemeSuivant)\(/);
  });
  it("la DA de Jump n'est pas recopiée : aucune palette de thème, aucun rouge ni jaune en dur dans les fichiers du rendu", () => {
    for (const f of readdirSync(SRC).filter((x) => x.endsWith(".ts") && FICHIERS.includes(x))) {
      const s = readFileSync(new URL(f, SRC), "utf8").replace(/^\s*\/\/.*$/gm, "");
      expect(s, f).not.toMatch(/0xff3b3b|0xffd23f|#ff3b3b|#ffd23f/i);
    }
  });
});

/** sRGB (0 à 255) d'un sommet d'un tampon (il le range en linéaire). */
function rgbDe(a: Art, v: number): [number, number, number] {
  const s = (l: number): number => Math.round(255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055));
  return [s(a.col[v * 3]!), s(a.col[v * 3 + 1]!), s(a.col[v * 3 + 2]!)];
}
function teinte([r, g, b]: [number, number, number]): { h: number; s: number } {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  if (d === 0) return { h: 0, s: 0 };
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / mx };
}

const PORTAILS: TypePortail[] = ["avion", "onde", "ressort", "gravite", "lent", "v1", "v2", "v3"];
describe("le rouge est réservé aux dangers", () => {
  const c = couleursGravity();
  const dessins: [string, Art][] = [
    ["pièce", dessinPiece(c.encre, c.papier)],
    ["gemme", dessinGemme(c.encre, c.diamant)],
    ["bouclier", dessinBonus("bouclier", c.encre, c.papier, c.diamant)],
    ["aimant", dessinBonus("aimant", c.encre, c.papier, c.diamant)],
    ["anneau", dessinAnneau(c.diamant)],
    ["voile", dessinDisque(c.diamant)],
    ["tirets", dessinTirets(c.papier, 3.5)],
    ["ruban", dessinRuban(c.encre)],
    ["pan", dessinPan(c.encre, true)],
    ["inverseur", dessinInverseur(c.papier)],
    ["flèche", dessinFleche(0xffffff)],
    ["chevrons", dessinChevrons(3, 0xe6eef2, 1)],
    // lot GR6 : les arches (cadre, voile, icône de chacun des huit portails), l'avion en papier et le ressort — jamais de rouge
    ...(PORTAILS.flatMap((t) => [
      [`cadre ${t}`, dessinCadrePortail(t, 3.5, c.encre, c.papier)],
      [`voile ${t}`, dessinVoilePortail(t, 3.5, c.papier)],
      [`icône ${t}`, dessinIconePortail(t, c.encre, c.papier)],
    ]) as [string, Art][]),
    ["avion arrière", dessinAvion(c.encre, c.papier).arriere],
    ["avion avant", dessinAvion(c.encre, c.papier).avant],
    ["ressort", dessinRessort(c.encre, c.papier).fil],
    ["plaque du ressort", dessinRessort(c.encre, c.papier).plaque],
    ...(["plein", "alerte", "absent", "retour"] as VarianteBloc[]).flatMap((v) => ([CLIGNOTANT, ALTERNE_A, ALTERNE_B] as TypeBloc[]).map((t): [string, Art] => [`bloc ${t} ${v}`, dessinBloc(t, v)])),
  ];
  it("aucun dessin hors les piques ne prend la teinte du rouge des dangers (à 30° au moins, sauf les neutres)", () => {
    for (const [nom, a] of dessins) {
      expect(a.vertexCount, nom).toBeGreaterThan(0);
      for (let v = 0; v < a.vertexCount; v++) {
        const { h, s } = teinte(rgbDe(a, v));
        if (s < 0.25 || Math.max(...rgbDe(a, v)) < 90) continue; // encre (un brun très sombre), papier, blanc, gris : pas une teinte
        const ecart = Math.min(h, 360 - h); // la teinte du danger est 0°
        expect(ecart, `${nom} sommet ${v} : teinte ${Math.round(h)}°`).toBeGreaterThanOrEqual(30);
      }
    }
    expect(teinte([(HAZARD >> 16) & 255, (HAZARD >> 8) & 255, HAZARD & 255]).h).toBeLessThan(5);
  });
  it("les gemmes sont de la couleur Diamant (le jeton de la charte), le héros du jaune de Jump", () => {
    expect(c.diamant).toBe(0x4fc3dc);
    expect(c.jaune).toBe(0xffd23f);
  });
});

describe("les blocs qui changent s'annoncent toujours", () => {
  const solides = (t: number, dec: number): boolean => solide(t, 0, dec);
  it("l'état affiché suit la simulation : plein ou alerte = solide ; absent ou retour = pas solide (tous types, tous décalages)", () => {
    for (const type of [CLIGNOTANT, ALTERNE_A, ALTERNE_B] as TypeBloc[])
      for (const dec of [0, 37, 120, 191])
        for (let tick = 0; tick < 2 * CLIGNOTANT_CYCLE + 240; tick++) {
          const etat = etatDuBloc(type, tick, dec);
          expect(etat === "plein" || etat === "alerte", `${type} ${tick} ${dec}`).toBe(solide(type, tick, dec));
        }
    expect(solides(CLIGNOTANT, 0)).toBe(true);
  });
  it("un clignotant prévient clairement avant de s'éteindre : au moins trois battements dans les 0,7 s qui précèdent, plus rapides dans les 0,3 s dernières", () => {
    const eteint = CLIGNOTANT_ALLUME; // le premier pas où il n'est plus solide
    expect(etatDuBloc(CLIGNOTANT, eteint - 1, 0) === "plein" || etatDuBloc(CLIGNOTANT, eteint - 1, 0) === "alerte").toBe(true);
    let battements = 0;
    let avant: VarianteBloc = "plein";
    for (let t = eteint - 84; t < eteint; t++) {
      const e = etatDuBloc(CLIGNOTANT, t, 0);
      if (e === "alerte" && avant !== "alerte") battements++;
      avant = e;
    }
    expect(battements).toBeGreaterThanOrEqual(4);
    // il n'annonce rien avant : tout le début de son temps allumé est un plein stable
    for (let t = 0; t < eteint - 84; t++) expect(etatDuBloc(CLIGNOTANT, t, 0)).toBe("plein");
    // la lumière revient annoncée aussi : un contour vif juste avant de se rallumer
    expect(etatDuBloc(CLIGNOTANT, CLIGNOTANT_CYCLE - 1, 0)).toBe("retour");
  });
  it("un battement n'est jamais plus rapide que 7,5 par seconde (seuil de lisibilité de la leçon de Jump)", () => {
    let dernier: VarianteBloc = etatDuBloc(CLIGNOTANT, 0, 0);
    let depuis = 0;
    for (let t = 1; t < CLIGNOTANT_CYCLE; t++) {
      const e = etatDuBloc(CLIGNOTANT, t, 0);
      if (e === dernier) depuis++;
      else {
        if (dernier === "alerte" || e === "alerte") expect(depuis + 1, `tick ${t}`).toBeGreaterThanOrEqual(8);
        depuis = 0;
        dernier = e;
      }
    }
  });
  it("la couleur néon inactive se voit : un contour (absent), avec un repère ; jamais un vide", () => {
    for (const type of [ALTERNE_A, ALTERNE_B] as TypeBloc[]) {
      const absent = dessinBloc(type, "absent");
      const plein = dessinBloc(type, "plein");
      expect(absent.triangles).toBeGreaterThan(8);
      expect(plein.triangles).toBeGreaterThan(absent.triangles - 8);
      const couleur = type === ALTERNE_A ? BLOCK_STYLE.altA.fill : BLOCK_STYLE.altB.fill;
      const premiere = rgbDe(absent, 0);
      expect(premiere).toEqual([(couleur >> 16) & 255, (couleur >> 8) & 255, couleur & 255]);
    }
  });
});

describe("le monde se construit, se libère, et ne dessine que les colonnes de son morceau", () => {
  it("geometrieDesColonnes ne garde que les triangles centrés dans les colonnes demandées", () => {
    const a = new Art();
    a.rect(2, 0, 3, 1, 0, 0xffffff);
    a.rect(5, 0, 6, 1, 0, 0xffffff);
    a.rect(9, 0, 10, 1, 0, 0xffffff);
    const g = geometrieDesColonnes(a, 4, 8)!;
    expect(g.index!.count).toBe(6); // un seul rectangle : deux triangles
    expect(geometrieDesColonnes(a, 20, 30)).toBeNull();
  });
  it("sur trois jours, tout le niveau (190 morceaux) se construit sans erreur, et ne garde qu'une poignée de morceaux et de fonds à la fois", () => {
    for (const jour of [20_400, 20_401, 20_402]) {
      const contenu = dailyGravity(jour, GRAVITY_GENERATOR_VERSION);
      const terrain = terrainDuJour(contenu);
      const monde = new Monde(terrain, jour, couleursGravity(), false);
      const partie = new Partie(terrain);
      let pic = 0;
      for (let k = 0; k < 2 * MORCEAUX_PAR_BOUCLE; k += 2) {
        monde.maj({ cam: k * LARGEUR_MORCEAU, largeur: 24, tick: k * 7, temps: k * 0.1 }, partie);
        pic = Math.max(pic, monde.groupe.children.length);
      }
      // des morceaux de la fenêtre + au plus deux fonds : rien ne s'accumule
      expect(pic).toBeLessThan(14);
      monde.detruire();
      expect(monde.groupe.children.length).toBe(0);
    }
  });
  it("chaque thème a son fond : la bande du thème est celle des morceaux de ce thème", () => {
    const contenu = dailyGravity(20_400, GRAVITY_GENERATOR_VERSION);
    const terrain = terrainDuJour(contenu);
    const monde = new Monde(terrain, 20_400, couleursGravity(), true);
    for (let b = 0; b < 5; b++) expect(monde.themeDe(b * 19)).toBe(THEMES[contenu.ordre[b]!]);
  });
});

// Lot GR6 — les portails dans le monde : une arche par portail du niveau, construite avec son morceau, libérée avec lui ; une couleur et une icône par mode, jamais le même dessin pour deux modes.
describe("les portails se construisent avec leur morceau et se libèrent avec lui", () => {
  const c = couleursGravity();
  it("un terrain de test avec un portail par type : chaque morceau garde ses arches (cadre, voile, icône) tant qu'il est dans le champ", () => {
    const types = PORTAILS;
    const terrain = terrainDeTest([], { portails: types.map((type, i) => ({ type, c: 1 + i, m: 0 })) });
    const monde = new Monde(terrain, 1, couleursGravity(), false);
    const partie = new Partie(terrain);
    monde.maj({ cam: 0, largeur: 20, tick: 0, temps: 0 }, partie);
    const meshes = monde.groupe.children.flatMap((g) => g.children).length;
    expect(meshes).toBeGreaterThan(types.length * 3); // trois mailles par portail, plus le décor
    // loin du morceau 0 : ses arches sont libérées
    monde.maj({ cam: 20 * LARGEUR_MORCEAU, largeur: 20, tick: 0, temps: 0 }, partie);
    monde.maj({ cam: 0, largeur: 20, tick: 0, temps: 0.5 }, partie); // le battement et la reconstruction ne cassent rien
    monde.detruire();
    expect(monde.groupe.children.length).toBe(0);
  });
  it("deux modes n'ont jamais le même dessin (le cadre ou l'icône diffère) : la couleur ne porte pas seule l'information", () => {
    const empreinte = (a: Art): string => `${a.vertexCount}:${Array.from(a.pos.slice(0, 600)).map((n) => n.toFixed(3)).join(",")}:${Array.from(a.col.slice(0, 600)).map((n) => n.toFixed(3)).join(",")}`;
    const icones = PORTAILS.map((t) => empreinte(dessinIconePortail(t, c.encre, c.papier)));
    expect(new Set(icones).size).toBe(PORTAILS.length);
    // les portails de vitesse ont 1 à 3 chevrons : plus de géométrie avec chaque chevron
    const sommets = (t: TypePortail): number => dessinIconePortail(t, c.encre, c.papier).vertexCount;
    expect(sommets("v2")).toBeGreaterThan(sommets("v1"));
    expect(sommets("v3")).toBeGreaterThan(sommets("v2"));
  });
});
