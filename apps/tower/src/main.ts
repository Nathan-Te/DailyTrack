import "./generationInit";
import { pret } from "./interrupteurInit";
import { brancherMusique } from "@cdj/musique/branche";
import { demarrerAccueil } from "./accueil";
import { gameStorage } from "./stockage";
import { lireOptions, PRODUCTION } from "./urlOptions";

// Point d'entrée de la page `/tower/` (lots T1, T4 et TP). Lot TP : l'interrupteur des jeux (`interrupteurInit.ts`, « Bientôt » si le jeu est `off`, bandeau « Aperçu ») et la génération de données
// (`generationInit.ts`) passent en tête ; les options d'essai sont fermées en production (`lireOptions(…, PRODUCTION)`, règle R9). **Le premier chargement est l'accueil** (`accueil.ts` : l'interface, l'identité, la lecture du serveur, les catalogues) :
// il n'embarque ni Three.js, ni la simulation, ni Rapier ; le jeu (`jeu.ts`) se charge à la demande, derrière lui. Les outils d'essai (`?scenario=essai|paliers`) ouvrent la partie tout de suite, sans
// accueil, et la démonstration de la physique du lot T0 (`?scenario=banc`) n'embarque ni Three.js ni la boucle de jeu.
// Lot M1 : les menus à la manette, chargés à la première manette (`manette.ts` démarre le moteur en se chargeant) ; ici, dans le premier chargement, pour que l'accueil aussi s'y pilote.
addEventListener("gamepadconnected", () => import("./manette"));
// Lot « musique » : la musique commune, branchée en une ligne, **une seule fois** pour l'accueil (scène `menu`) et le jeu (scène du thème) ; le lecteur se charge au premier geste (`docs/plateforme/musique.md`).
const musique = () => brancherMusique("tower", gameStorage);
const options = lireOptions(location.search, PRODUCTION);
if (options.scenario === "banc") void import("./banc/demo");
else if (options.scenario === "essai" || options.scenario === "paliers" || options.scenario === "alignement") void pret.then(() => import("./jeu")).then((m) => m.demarrerScenario(options, musique()));
else void pret.then(() => demarrerAccueil(options, musique()));
