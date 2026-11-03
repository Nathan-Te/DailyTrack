// Lot K4b — `npm run build` : construit l'application de chaque jeu, dans l'ordre des fiches (`apps/<app>` : `npm run build -w @cdj/<app>`). Aucun jeu n'est nommé ici : un jeu neuf, avec sa
// fiche, est construit sans toucher à `package.json`.
import { execFileSync } from "node:child_process";
import { FICHES_CI } from "./fiches-lecture.mjs";

for (const f of FICHES_CI) execFileSync("npm", ["run", "build", "-w", `@cdj/${f.app}`], { stdio: "inherit" });
