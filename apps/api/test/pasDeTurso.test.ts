import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Lot R14 — rien d'automatique n'écrit dans Turso sans raison. Les tests (unitaires, libSQL compris) et les outils de mesure tournent sur un fichier local ou la mémoire.
// Trois couches : (1) `openLibsql` refuse une base distante tant que Vitest tourne (test/distant.test.ts) ; (2) ce contrôle : l'environnement du test ne désigne pas Turso, et aucun fichier de
// test ou de e2e ne contient une adresse `libsql://` / `*.turso.io` sans être sur la liste des fichiers qui ne l'ouvrent pas ; (3) les workflows : un `libsql://` n'y figure que dans les essais
// de démarrage refusé de l'image (`docker run --rm` : la configuration est rejetée avant toute connexion).
const RACINE = join(__dirname, "..", "..", "..");

/** Les fichiers qui citent une adresse `libsql://` **comme texte** (la configuration est lue et validée, jamais ouverte). Ajouter un fichier ici se justifie dans la PR. */
const TEXTE_SEULEMENT = new Map([
  ["apps/api/test/adminConfig.test.ts", "`readConfig` : refus de configurations (aucune ouverture)"],
  ["apps/api/test/copies.test.ts", "`readConfig` : `allowCopies` n'est pas une option de la production"],
  ["apps/api/test/jumpBoard.test.ts", "`readConfig` : `demoPlayers` n'est pas une option de la production"],
  ["apps/api/test/production.test.ts", "`readConfig` : règles d'une configuration de production"],
  ["apps/api/test/recette.test.ts", "`databaseName`, `assertDatabaseMatches`, `readConfig` : règle des noms de base"],
  ["apps/api/test/distant.test.ts", "le contrôle lui-même : adresses d'exemple"],
  ["apps/api/test/pasDeTurso.test.ts", "ce fichier"],
  ["apps/portail/test/lancement.test.ts", "essais du script bash de garde du workflow (variables d'environnement d'exemple)"],
]);

function fichiers(dossier: string, accepte: (chemin: string) => boolean, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom === "dist" || nom === ".git" || nom === "site") continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) fichiers(chemin, accepte, sortie);
    else if (accepte(chemin)) sortie.push(chemin);
  }
  return sortie;
}

const ADRESSE_DISTANTE = /(libsql|wss?):\/\/|https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.turso\.io/i;

describe("pas de Turso dans les tests", () => {
  it("l'environnement du test ne désigne aucune base distante", () => {
    for (const v of ["TURSO_DATABASE_URL", "RECETTE_TURSO_DATABASE_URL", "RECETTE_DB", "PROD_DB"]) {
      const valeur = process.env[v] ?? "";
      expect(ADRESSE_DISTANTE.test(valeur), `${v} ne doit pas désigner une base distante dans un test`).toBe(false);
    }
    expect(process.env.TURSO_AUTH_TOKEN ?? "").toBe(""); // aucun jeton non plus
  });

  it("aucun fichier de test ne contient une adresse distante, hors la liste des textes de configuration", () => {
    const tests = [
      ...fichiers(join(RACINE, "apps"), (c) => /[\\/](test|e2e)[\\/].*\.(ts|mjs|js)$/.test(c)),
      ...fichiers(join(RACINE, "packages"), (c) => /[\\/]test[\\/].*\.(ts|mjs|js)$/.test(c)),
    ];
    const trouves = tests.filter((f) => ADRESSE_DISTANTE.test(readFileSync(f, "utf8"))).map((f) => relative(RACINE, f).split(sep).join("/"));
    const inattendus = trouves.filter((f) => !TEXTE_SEULEMENT.has(f));
    expect(inattendus, "ces fichiers de test citent une adresse libsql:// : un test ne touche jamais Turso (lot R14)").toEqual([]);
    // Les fichiers « texte seulement » ne l'ouvrent pas : aucun n'utilise le client Turso ni ne passe l'adresse à un client.
    for (const f of TEXTE_SEULEMENT.keys()) {
      if (!existsSync(join(RACINE, f))) continue;
      const code = readFileSync(join(RACINE, f), "utf8").replace(/\/\/.*$/gm, "");
      if (f.endsWith("pasDeTurso.test.ts") || f.endsWith("distant.test.ts")) continue;
      expect(/openLibsql\(|createClient\(|@libsql\/client/.test(code), `${f} ouvre un client`).toBe(false);
    }
  });

  it("les workflows ne citent libsql:// que pour un démarrage d'image refusé", () => {
    const yml = readFileSync(join(RACINE, ".github/workflows/ci.yml"), "utf8").split("\n");
    for (const [i, ligne] of yml.entries()) {
      if (!/libsql:\/\//.test(ligne) || ligne.trim().startsWith("#")) continue;
      expect(ligne, `ci.yml:${i + 1} : une adresse libsql:// hors d'un \`docker run --rm\` (démarrage refusé)`).toMatch(/docker run --rm/);
    }
    // Aucun autre workflow de test ne passe d'adresse distante à une commande de test.
    for (const w of ["stabilite.yml", "apercu.yml"]) {
      expect(readFileSync(join(RACINE, ".github/workflows", w), "utf8"), w).not.toMatch(/libsql:\/\//);
    }
  });
});
