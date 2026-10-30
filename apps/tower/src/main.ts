import { lireOptions, PRODUCTION } from "./urlOptions";

// Point d'entrée de la page `/tower/` (lot T1). Tower est `off` et sa page n'est pas publiée en production (scripts/site.mjs) ; si une construction de production la
// servait quand même, elle se tait (règle R9 : ni `?scenario` ni `?debug` ne servent à rien en production). Chaque écran est dans son propre fichier, chargé à la demande :
// la démonstration du lot T0 (`?scenario=banc`) n'embarque ni Three.js ni la boucle de jeu, le jeu n'embarque pas le moteur A.
const options = lireOptions(location.search, PRODUCTION);
if (PRODUCTION) {
  document.getElementById("tower")!.textContent = "Bientôt."; // i18n-ok: page jamais publiée en production
  document.documentElement.dataset.ready = "true";
} else if (options.scenario === "banc") void import("./banc/demo");
else void import("./jeu");
