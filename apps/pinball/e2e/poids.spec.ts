import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// « Pinball » — la **composition** du premier chargement (l'accueil seul). Les plafonds en octets sont dans `docs/plateforme/budgets.md` (ligne `pinball.jsCss`, contrôlée par le job « Budgets » sur toute PR qui touche ce que
// charge un joueur) : ce fichier ne garde que ce qui est ou n'est pas dans le premier chargement. Déterministe (la construction), sans navigateur.
const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const premier = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"]+)"/g)].map((m) => m[1]!);

test("le premier chargement est l'accueil : ni la partie, ni le classement, ni les Réglages, ni l'anglais, ni la table du jour, ni la scène, ni le rendu three.js, ni le panneau « Aujourd'hui » (et son aperçu de la table), ni le panneau d'essai", () => {
  expect(premier.some((f) => f.startsWith("main-") && f.endsWith(".js")), `fichiers : ${premier.join(", ")}`).toBe(true);
  expect(premier.some((f) => /^(partie|classement|reglages|retours|version|catalogue\.en|manette|commandesEcran|scene|niveau|corps|dessin|panneau|tune)-/.test(f)), `fichiers : ${premier.join(", ")}`).toBe(false);
});

test("le premier chargement n'embarque ni Three.js ni moteur de physique (la simulation entière est à la demande)", () => {
  const dist = new URL("../dist/assets/", import.meta.url);
  const tout = readFileSync(new URL(premier.find((f) => f.startsWith("main-") && f.endsWith(".js"))!, dist), "utf8");
  expect(tout).not.toMatch(/WebGLRenderer|rapier/i);
});
