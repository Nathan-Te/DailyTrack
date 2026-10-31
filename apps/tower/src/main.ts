import { demarrerAccueil } from "./accueil";
import { lireOptions, PRODUCTION } from "./urlOptions";

// Point d'entrée de la page `/tower/` (lots T1 et T4). Tower est `off` et sa page n'est pas publiée en production (scripts/site.mjs) ; si une construction de production la servait quand même, elle se
// tait (règle R9 : ni `?scenario` ni `?debug` ne servent à rien en production). **Le premier chargement est l'accueil** (`accueil.ts` : l'interface, l'identité, la lecture du serveur, les catalogues) :
// il n'embarque ni Three.js, ni la simulation, ni Rapier ; le jeu (`jeu.ts`) se charge à la demande, derrière lui. Les outils d'essai (`?scenario=essai|paliers`) ouvrent la partie tout de suite, sans
// accueil, et la démonstration de la physique du lot T0 (`?scenario=banc`) n'embarque ni Three.js ni la boucle de jeu.
const options = lireOptions(location.search, PRODUCTION);
if (PRODUCTION) {
  document.getElementById("tower")!.textContent = "Bientôt."; // i18n-ok: page jamais publiée en production
  document.documentElement.dataset.ready = "true";
} else if (options.scenario === "banc") void import("./banc/demo");
else if (options.scenario === "essai" || options.scenario === "paliers") void import("./jeu").then((m) => m.demarrerScenario(options));
else void demarrerAccueil(options);
