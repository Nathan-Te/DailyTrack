// Lot 38 : construit la vitrine de la scène (`dist/vitrine/`, servie sous `/track/vitrine/`) après le jeu. Jamais en production : la construction de
// production (`VITE_PRODUCTION=1`, deploy-site.yml) s'arrête ici, et `/track/vitrine/` n'existe pas sur playdujour.com (la page 404 du site répond).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "vite";

if (process.env.VITE_PRODUCTION === "1") {
  console.log("vitrine de la scène : pas construite en production (recette et aperçus seulement)");
} else {
  await build({ configFile: fileURLToPath(new URL("../vite.vitrine.config.ts", import.meta.url)), logLevel: "warn" });
  // Retouche 38b : le poids ajouté au jeu, partie par partie (paliers et pas compris), affiché par la vitrine.
  const { mesurerParties } = await import("./poids-parties.mjs");
  const parties = Object.fromEntries(await mesurerParties());
  writeFileSync(fileURLToPath(new URL("../dist/vitrine/poids-parties.json", import.meta.url)), JSON.stringify(parties, null, 2));
  console.log("vitrine de la scène : dist/vitrine/");
}
