import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { LIMITES, claudeMd, fichiersDuDepot, phrases, problemesDeLimites, sansRenvoisDeLots } from "../../../scripts/consignes-controle.mjs";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { SESSIONS, fichiersCharges, importsDe } from "../../../scripts/mesure-jetons.mjs";

// Lot T1 (plateforme, économie de jetons) — ce que Claude Code charge tout seul reste court. Un CLAUDE.md est lu en entier à chaque session qui touche son
// dossier (le racine : toujours) ; chaque ligne coûte des jetons à chaque fois. Les règles qui ne servent qu'à un sujet vivent dans docs/regles/<zone>/,
// lues à la demande (docs/regles/deplacements.md dit où est chaque règle déplacée). Mesure : `npm run mesure-jetons` ; contrôle : `npm run consignes`.
const RACINE = join(import.meta.dirname, "../../..");
// Lot K7 : les CLAUDE.md se découvrent tout seuls (tous ceux du dépôt, hors node_modules : `claudeMd()`), un jeu neuf n'ajoute plus rien à une liste. Ce test n'en cite donc aucun : c'est
// `scripts/ci-zones.mjs` (`TEST_DES_CONSIGNES`) qui le lance dès qu'un CLAUDE.md change (apps/web/test/ciZones.test.ts le prouve).
const CLAUDE_MD: string[] = claudeMd();
const DOCUMENTS_DEPLACES = "docs/regles/deplacements.md";
const REGLAGES = ".claude/settings.json";
/** Plafond, en jetons estimés, de ce qu'une session charge toute seule (mesure du lot T1 + 25 %). */
const PLAFOND_SESSION: Record<string, number> = { portail: 30_000, track: 54_000, "jeu neuf": 38_000, api: 19_000 };

const globVersRegExp = (glob: string) =>
  new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "\u0001").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0001/g, "(?:.*/)?").replace(/\u0000/g, ".*")}$`);

describe("les CLAUDE.md que Claude Code charge", () => {
  it("la liste est découverte dans le dépôt : le racine, les zones partagées et les jeux y sont, aucun fichier d'un node_modules", () => {
    expect(CLAUDE_MD).toEqual(expect.arrayContaining(["CLAUDE.md", "apps/api/CLAUDE.md", "apps/portail/CLAUDE.md", "packages/core/CLAUDE.md", "packages/ui/CLAUDE.md"]));
    expect(CLAUDE_MD.filter((f) => f.includes("node_modules"))).toEqual([]);
  });
  it("aucun ne dépasse sa taille (racine : 200 lignes, zone : 300), aucun n'importe un fichier (@…), ne renvoie à un README de lot, et tous leurs liens vivent", () => {
    expect(problemesDeLimites()).toEqual([]);
    expect(LIMITES.racine.lignes).toBe(200);
    expect(LIMITES.zone.lignes).toBe(300);
  });
  it("le racine n'importe plus aucun fichier : un @import est chargé au lancement et ne réduit rien (Tower avait ses 33 000 jetons dans chaque session)", () => {
    expect(importsDe("CLAUDE.md")).toEqual([]);
    for (const f of CLAUDE_MD) expect(importsDe(f), f).toEqual([]);
  });
  it("une session ne charge que les CLAUDE.md de ses dossiers, dans la limite de son plafond", () => {
    for (const [nom, dossiers] of Object.entries(SESSIONS) as [string, string[]][]) {
      const fichiers: string[] = fichiersCharges(dossiers);
      expect(fichiers.every((f) => f.endsWith("CLAUDE.md")), nom).toBe(true);
      const jetons = fichiers.reduce((s, f) => s + Math.ceil([...readFileSync(join(RACINE, f), "utf8")].length / 4), 0);
      expect(jetons, `${nom} : ${jetons} jetons chargés tout seuls`).toBeLessThan(PLAFOND_SESSION[nom]!);
    }
  });
  it("le travail dans Track ne charge ni Jump ni Tower", () => {
    const track: string[] = fichiersCharges(SESSIONS.track);
    expect(track.filter((f) => /jump|tower/.test(f))).toEqual([]);
  });
});

describe("les règles déplacées (docs/regles/)", () => {
  it("l'index des déplacements existe, et chaque ligne nomme un document qui existe", () => {
    expect(existsSync(join(RACINE, DOCUMENTS_DEPLACES))).toBe(true);
    const lignes = readFileSync(join(RACINE, DOCUMENTS_DEPLACES), "utf8").split("\n").filter((l) => l.startsWith("| `"));
    expect(lignes.length).toBeGreaterThan(150);
    for (const l of lignes) {
      const cible = /`(docs\/[^`]+|[^`]+CLAUDE\.md)`[^|]*\|?\s*$/.exec(l)?.[1];
      if (cible) expect(existsSync(join(RACINE, cible)), l).toBe(true);
    }
  });
  it("`phrases` et `sansRenvoisDeLots` : le contrôle ne compare que des règles", () => {
    expect(phrases("court.\n- **Une règle assez longue pour compter** : voilà ; et la suite de la phrase.")).toHaveLength(1);
    expect(sansRenvoisDeLots("Règle. README : `docs/lots/lot-1-x.md` ; suite.")).toBe("Règle. suite.");
  });
});

describe("le réglage de lecture (.claude/settings.json)", () => {
  const reglages = JSON.parse(readFileSync(join(RACINE, REGLAGES), "utf8")) as { permissions: { deny: string[] } };
  const suivis: string[] = fichiersDuDepot();
  const motifs = reglages.permissions.deny.map((r) => ({ regle: r, re: globVersRegExp(/^Read\(\.\/(.+)\)$/.exec(r)![1]!) }));
  it("ne refuse que la lecture (jamais Edit, Write ni Bash : les scripts et les tests lisent ces fichiers sans gêne)", () => {
    for (const r of reglages.permissions.deny) expect(r, r).toMatch(/^Read\(\.\/.+\)$/);
  });
  it("chaque règle vise au moins un fichier du dépôt (une règle périmée se voit)", () => {
    for (const m of motifs) expect(suivis.some((f) => m.re.test(f)), m.regle).toBe(true);
  });
  it("ne touche aucun code, aucun test ni aucun CLAUDE.md : seulement des données, des fichiers produits et des documents", () => {
    for (const f of suivis) {
      const visee = motifs.find((m) => m.re.test(f));
      if (!visee) continue;
      expect(/(\.generated\.(ts|css)|\.json|\.md|\.html)$/.test(f), `${f} (règle ${visee.regle})`).toBe(true);
      expect(/CLAUDE\.md$|\.test\.ts$/.test(f), f).toBe(false);
    }
  });
});
