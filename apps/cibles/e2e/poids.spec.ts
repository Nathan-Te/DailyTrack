import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// « Cibles » — la **composition** du premier chargement (l'accueil seul). Les plafonds en octets sont dans `docs/plateforme/budgets.md` (ligne `cibles.jsCss`, contrôlée par le job « Budgets » sur toute PR qui touche ce que
// charge un joueur) : ce fichier ne garde que ce qui est ou n'est pas dans le premier chargement. Déterministe (la construction), sans navigateur.
const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const premier = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"]+)"/g)].map((m) => m[1]!);

test("le premier chargement est l'accueil : ni la partie, ni le classement, ni les Réglages, ni l'anglais", () => {
  expect(premier.some((f) => f.startsWith("main-") && f.endsWith(".js")), `fichiers : ${premier.join(", ")}`).toBe(true);
  expect(premier.some((f) => /^(partie|classement|reglages|retours|version|catalogue\.en|manette|commandesEcran)-/.test(f)), `fichiers : ${premier.join(", ")}`).toBe(false);
});

test("le jeu n'embarque ni Three.js ni moteur de physique (Canvas 2D, état entier)", () => {
  const dist = new URL("../dist/assets/", import.meta.url);
  const tout = readFileSync(new URL(premier.find((f) => f.startsWith("main-") && f.endsWith(".js"))!, dist), "utf8");
  expect(tout).not.toMatch(/WebGLRenderer|rapier/i);
});
