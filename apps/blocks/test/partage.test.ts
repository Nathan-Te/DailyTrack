import { describe, expect, it } from "vitest";
import { dailyBlocks, medailleDe, numeroBlocks, Partie, PREMIER_JOUR_BLOCKS, seuilsDepuis } from "@cdj/blocks-sim";
import { jouerDiamant } from "@cdj/blocks-sim/diamant";
import { adresseDePartage, ligneParDefaut, textePartage } from "@cdj/kit/partage";
import { CATALOGUE_EN } from "../src/catalogue.en";
import { CATALOGUE_FR } from "../src/catalogue.fr";
import { DEFINITION } from "../src/definition";
import { exempleDePartage } from "../src/exemple";
import { MEDAILLES_EXEMPLE } from "../src/essai";

// Lot B4 — la ligne à partager (seed § 5) : `Du Jour · Blocks #5 — 4 582 pts — 🥈 — combo ×7`, assemblée par le gabarit du kit (`ligneParDefaut`, le même que celui que le kit applique à l'écran de fin). On l'essaie en
// français et en anglais, avec et sans médaille, avec de grands nombres. Les émojis sont ceux du kit (par leur code, charte § 6).
const ARGENT = "\u{1F948}";
const OR = "\u{1F947}";
const DIAMANT = "\u{1F48E}";
const NBSP = "\u00a0";

/** Le traducteur que le kit donne à la définition : le catalogue de la langue (lot « manques de Blocks » : plus de traducteur global). */
const traducteur = (l: "fr" | "en") => {
  const cat = (l === "fr" ? CATALOGUE_FR : CATALOGUE_EN) as Readonly<Record<string, string>>;
  return (cle: string, params?: Readonly<Record<string, string | number>>): string => (cat[cle] ?? cle).replace(/\{(\w+)\}/g, (tout, nom: string) => (params?.[nom] === undefined ? tout : String(params[nom])));
};
/** La ligne que le kit écrit pour ce résultat : le titre, `scorePartage` du jeu, la médaille, `extrasPartage` du jeu, le rang — le gabarit même de `partie.ts`. */
function ligne(l: "fr" | "en", score: number[], medaille: string | null, rang: string | null = null, jour = PREMIER_JOUR_BLOCKS + 4): string {
  const t = traducteur(l);
  return ligneParDefaut({ nom: "Blocks", numero: numeroBlocks(jour), date: "2026-11-06", score: DEFINITION.scorePartage(score, l, t), extras: DEFINITION.extrasPartage!(score, l, t), medaille, rang });
}

describe("la ligne à partager de Blocks", () => {
  it("le titre suit la convention du kit : `Du Jour · Blocks #n`, n = le numéro du jour depuis `premierJour` (le premier jour est le n° 1)", () => {
    expect(numeroBlocks(PREMIER_JOUR_BLOCKS)).toBe(1);
    expect(numeroBlocks(PREMIER_JOUR_BLOCKS + 4)).toBe(5);
    expect(ligne("fr", [4582, 7], ARGENT)).toMatch(/^Du Jour · Blocks #5 — /);
  });

  it("français avec médaille : le score, la médaille, puis le combo maximal (les extras du kit : l'ordre du seed)", () => {
    expect(ligne("fr", [4582, 7], ARGENT)).toBe(`Du Jour · Blocks #5 — 4${NBSP}582 pts — ${ARGENT} — combo ×7`);
  });

  it("français sans médaille : aucune pastille, pas de tiret en trop", () => {
    const l = ligne("fr", [182, 2], null);
    expect(l).toBe(`Du Jour · Blocks #5 — 182 pts — combo ×2`);
    expect(l).not.toMatch(/—\s*$|— —/u);
    expect(l).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it("anglais : séparateur de milliers anglais, « pts » et « combo » gardés", () => {
    expect(ligne("en", [4582, 7], ARGENT)).toBe(`Du Jour · Blocks #5 — 4,582 pts — ${ARGENT} — combo ×7`);
    expect(ligne("en", [182, 2], null)).toBe("Du Jour · Blocks #5 — 182 pts — combo ×2");
  });

  it("de grands nombres : six chiffres et plus, espace insécable en français, virgule en anglais", () => {
    expect(ligne("fr", [136_409, 31], DIAMANT)).toBe(`Du Jour · Blocks #5 — 136${NBSP}409 pts — ${DIAMANT} — combo ×31`);
    expect(ligne("fr", [1_234_567, 12], OR)).toContain(`1${NBSP}234${NBSP}567 pts`);
    expect(ligne("en", [1_234_567, 12], OR)).toContain("1,234,567 pts");
  });

  it("pas de combo (aucun effacement dans la partie) : le combo n'est pas écrit, jamais « combo ×0 »", () => {
    expect(ligne("fr", [57, 0], null)).toBe("Du Jour · Blocks #5 — 57 pts");
  });

  it("avec le rang du classement, il arrive en dernier ; le texte à coller est la ligne puis l'adresse du jeu, sans paramètre", () => {
    const l = ligne("fr", [4582, 7], ARGENT, "3e/128");
    expect(l.endsWith(` — combo ×7 — 3e/128`)).toBe(true);
    expect(l).toBe(`Du Jour · Blocks #5 — 4${NBSP}582 pts — ${ARGENT} — combo ×7 — 3e/128`);
    const adresse = adresseDePartage({ origin: "https://playdujour.com", pathname: "/blocks/" });
    expect(adresse).toBe("https://playdujour.com/blocks/");
    expect(textePartage(l, adresse)).toBe(`${l}\nhttps://playdujour.com/blocks/`);
  });

  it("un jour avant le premier : la date à la place du numéro (convention du kit)", () => {
    const l = ligneParDefaut({ nom: "Blocks", numero: numeroBlocks(PREMIER_JOUR_BLOCKS - 3), date: "2026-10-30", score: DEFINITION.scorePartage([10, 0], "fr", traducteur("fr")) });
    expect(l).toBe("Du Jour · Blocks (2026-10-30) — 10 pts");
  });

  it("le score écrit à l'écran de fin (`formatScore`) est le même nombre, au format de la langue", () => {
    expect(DEFINITION.formatScore([4582, 7], "fr", traducteur("fr"))).toBe(`4${NBSP}582 pts`);
    expect(DEFINITION.formatScore([4582, 7], "en", traducteur("en"))).toBe("4,582 pts");
  });
});

describe("le résultat d'exemple de `?scenario=partage`", () => {
  const contenu = dailyBlocks(PREMIER_JOUR_BLOCKS + 4);
  const diamant = jouerDiamant(contenu);
  const seuils = seuilsDepuis(diamant.resultat.score);
  it("chaque médaille voulue tombe dans sa bande (ou, faute de bande, au-dessus) ; « aucune » reste sous le bronze", () => {
    const de = (poses: number[]): number => {
      const p = new Partie(contenu);
      for (const a of poses) p.jouerAction(a);
      return p.score;
    };
    expect(MEDAILLES_EXEMPLE).toEqual(["aucune", "bronze", "argent", "or", "diamant"]);
    const aucune = exempleDePartage(contenu, "aucune");
    expect(aucune.length).toBeGreaterThanOrEqual(1);
    expect(medailleDe([de(aucune)], seuils)).toBeNull();
    for (const [nom, code] of [["bronze", "bronze"], ["argent", "silver"], ["or", "gold"]] as const) {
      const poses = exempleDePartage(contenu, nom);
      expect(poses, nom).toEqual(diamant.actions.slice(0, poses.length)); // le début de la partie du bot
      const m = medailleDe([de(poses)], seuils);
      expect(["bronze", "silver", "gold", "author"].indexOf(m!), nom).toBeGreaterThanOrEqual(["bronze", "silver", "gold", "author"].indexOf(code));
    }
    expect(exempleDePartage(contenu, "diamant")).toEqual(diamant.actions);
  });
  it("déterministe : le même jour donne le même exemple", () => {
    expect(exempleDePartage(contenu, "argent")).toEqual(exempleDePartage(contenu, "argent"));
  });
});
