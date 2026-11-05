import { expect, test } from "@playwright/test";
import { API, JOUR } from "./appareil";

// « Blocks » — jeu d'ARCADE (lot A3), lu sur le VRAI serveur d'essai, en LECTURE SEULE : ce fichier n'envoie aucune partie et ne lit que la journée (`/api/portail/jour`, que `classement.spec.ts` réchauffe de même). Il ne lit pas le
// cumul : le portail garde le classement par fenêtre de 45 s, et une lecture ici, avant les joueurs de `classement.spec.ts` (qui partage ce serveur), le figerait sans eux. Le cumul, la série et la journée parfaite avec de vraies
// parties : `apps/api/test/blocksArcade.test.ts`. La journée marque Blocks `arcade` et `compte: false` : ni journée parfaite, ni « n fini sur m », ni série, ni ligne de partage du portail. La logique des onglets et de la
// section « Arcade » est celle du portail (`classementVues.ts`, `mesJeux.ts`, testées avec Tower et Blocks) ; ses pages appartiennent à la plateforme.
interface Entree {
  jeu: string;
  site: string;
  nom: string;
  categorie?: "arcade";
  compte?: boolean;
}

test("la journée liste Blocks en arcade, hors de la journée ; son onglet de classement vient après Track et Jump, dans la section Arcade", async () => {
  const jour = await (await fetch(`${API}/api/portail/jour`)).json();
  const jeux = jour.jeux as Entree[];
  const blocks = jeux.find((j) => j.jeu === "blocks")!;
  expect(blocks, "Blocks est ouvert sur le serveur d'essai").toBeTruthy();
  expect(blocks).toMatchObject({ categorie: "arcade", compte: false });
  for (const j of jeux.filter((x) => x.jeu !== "blocks" && x.categorie === undefined)) expect(j.compte).not.toBe(false); // les jeux du jour, eux, comptent

  // Ce qui range son onglet de classement après le séparateur « Arcade » et sa cartouche dans la section Arcade de l'accueil est cette catégorie (le portail ne lit rien d'autre : aucun code ne nomme un jeu) :
  // tout jeu `arcade` de la liste ne compte pas, tout jeu qui compte n'est pas d'arcade.
  for (const j of jeux) expect(j.categorie === "arcade", `${j.jeu} : arcade ⇔ ne compte pas`).toBe(j.compte === false);
});

test("le serveur d'essai est au jour de l'appareil (le 06/11/2026) : la partie du jour de Blocks existe et ne montre jamais de preuve", async () => {
  const j = await (await fetch(`${API}/api/blocks/day/${JOUR}`)).json();
  expect(j).toHaveProperty("medals");
  expect(JSON.stringify(j)).not.toMatch(/replay|preuve/);
});
