import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Le module de profil est commun à tous les jeux : aucune logique de jeu (il n'importe aucun paquet), aucun accès direct au stockage du
// navigateur (injecté : chaque jeu passe son `gameStorage`, avec son préfixe d'aperçu), aucun document.
describe("module de profil : commun, injecté", () => {
  const dir = join(__dirname, "..", "src");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  const code = (f: string) => readFileSync(join(dir, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("n'importe aucun jeu ni aucun paquet", () => {
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) for (const m of code(f).matchAll(/from\s+"([^"]+)"/g)) expect(m[1], f).toMatch(/^\.\//);
  });

  it("ne touche ni localStorage, ni sessionStorage, ni document, ni location", () => {
    for (const f of files) expect(code(f), f).not.toMatch(/\b(localStorage|sessionStorage|document|location|window)\b/);
  });
});
