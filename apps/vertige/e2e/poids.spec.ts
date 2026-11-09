import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// « Vertige » — la **composition** du premier chargement (l'accueil seul). Les plafonds en octets sont dans `docs/plateforme/budgets.md` (ligne `vertige.jsCss`, contrôlée par le job « Budgets » sur toute PR qui touche ce
// jeu) : ce fichier ne garde que ce qui est ou n'est pas dans le premier chargement. Déterministe (la construction), sans navigateur. Three.js (le `corps` du jeu : le monde, les mains, les commandes) est à la
// demande, chargé pendant que l'accueil s'affiche.
const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const premier = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"]+)"/g)].map((m) => m[1]!);
const dist = new URL("../dist/assets/", import.meta.url);

test("le premier chargement est l'accueil : ni la partie, ni le classement, ni les Réglages, ni l'anglais, ni le corps du jeu", () => {
  expect(premier.some((f) => f.startsWith("main-") && f.endsWith(".js")), `fichiers : ${premier.join(", ")}`).toBe(true);
  expect(premier.some((f) => /^(partie|classement|reglages|retours|version|catalogue\.en|manette|commandesEcran|corps|tune)-/.test(f)), `fichiers : ${premier.join(", ")}`).toBe(false);
});

test("Three.js n'est pas dans le premier chargement : il est dans le corps du jeu, à la demande", () => {
  const principal = readFileSync(new URL(premier.find((f) => f.startsWith("main-") && f.endsWith(".js"))!, dist), "utf8");
  expect(principal).not.toMatch(/WebGLRenderer|EffectComposer|UnrealBloom/);
  const corps = readdirSync(dist).find((f) => /^corps-.*\.js$/.test(f));
  expect(corps, "un morceau `corps-*.js` à la demande").toBeDefined();
  expect(readFileSync(new URL(corps!, dist), "utf8")).toMatch(/WebGLRenderer/);
});
