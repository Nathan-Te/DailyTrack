import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lireFichesBrutes } from "../../../scripts/fiches-brutes.mjs";

// Lot K4e — **le Dockerfile ne boucle pas, mais il ne peut plus oublier un jeu.** L'image du serveur est construite par `docker build` : un `COPY` ne se calcule pas, donc l'image nomme, jeu par jeu, ce dont le serveur a
// besoin (le `package.json` de l'application et de la simulation, pour que le verrou npm s'applique ; la simulation, que le serveur importe ; les jours figés, que `build-node.mjs` embarque ; le fil de calcul).
// Choix justifié (rapport du lot K4e) : un seul `COPY apps apps` perdrait la couche des dépendances et l'exclusion de `apps/web` (`.dockerignore`), et je ne peux pas construire d'image ici ; le bloc de chaque jeu
// est donc **écrit par le générateur d'un jeu neuf** (lot K4f), et ce test échoue le jour où une fiche existe sans lui. Chaque fiche, jeu témoin compris (la recette sert son image).
const ROOT = join(__dirname, "../../..");
const dockerfile = readFileSync(join(ROOT, "apps/api/Dockerfile"), "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("#"))
  .join("\n");
type Fiche = { dossiers?: { app: string; sim: string }; jours: { dossier?: string }; rejeu: { fil?: boolean } };
const fiches = (lireFichesBrutes(ROOT) as { id: string; brut: Fiche }[]).map((f) => ({ id: f.id, ...f.brut }));

describe("le Dockerfile de l'image du serveur nomme chaque jeu des fiches (lot K4e)", () => {
  it("il y a au moins les trois jeux livrés", () => {
    expect(fiches.map((f) => f.id)).toEqual(expect.arrayContaining(["track", "jump", "tower"]));
  });
  for (const f of fiches) {
    it(`${f.id} : le package.json de son application et de sa simulation, sa simulation, ses jours figés et son fil de calcul`, () => {
      const app = f.dossiers?.app ?? f.id;
      const sim = f.dossiers?.sim ?? `${f.id}-sim`;
      const manques: string[] = [];
      const exige = (ligne: string, pourquoi: string) => {
        if (!dockerfile.includes(ligne)) manques.push(`${ligne}   (${pourquoi})`);
      };
      exige(`COPY apps/${app}/package.json apps/${app}/`, "le verrou npm liste l'espace de travail de l'application");
      exige(`COPY packages/${sim}/package.json packages/${sim}/`, "le verrou npm liste l'espace de travail de la simulation");
      exige(`COPY packages/${sim} packages/${sim}`, "le serveur importe la simulation");
      if (f.jours.dossier) exige(`COPY ${f.jours.dossier} ${f.jours.dossier}`, "les jours figés entrent dans le paquet");
      if (f.rejeu.fil) exige(`/app/apps/api/dist/${f.id}-fil.mjs`, "le fil de calcul des rejeux");
      expect(manques, `apps/api/Dockerfile ne nomme pas le jeu « ${f.id} » : ajoute son bloc (le générateur d'un jeu neuf l'écrit)`).toEqual([]);
    });
  }
});
