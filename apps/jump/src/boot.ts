// Lot I5 : le socle de l'interface (`@cdj/ui` : jetons, base, composants) et les six faces de polices de Jump — Lilita One (la voix de Jump), Archivo
// Black (le logo « DU JOUR » des barres), Archivo 400, 600 et 700 (le texte), JetBrains Mono 700 (dates, rangs) —, puis les feuilles du jeu. Importés ici,
// à l'entrée de la page, pour qu'ils arrivent avec le HTML (aucun écran sans ses styles). Les polices sont servies par `/assets/…`, les mêmes fichiers que
// le portail et Track (vite.config.ts). L'outil `?debug&tune` et la galerie `?modules` ont leur habillage dans outils.css.
import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/cadre.css";
import "@cdj/ui/src/polices/lilita-one-400.css";
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "./interface.css";
import "./hud.css";
import "./ecrans.css";
import "./outils.css";
import { BUILD_RESTRICTED } from "./storage";
import { readUrlOptions } from "./urlOptions";

// Point d'entrée de la page : la galerie des morceaux (`?modules`, lot 4), l'outil de la variété (`?semaine=`, lot 19) ou le jeu. Chacun dans son propre fichier chargé à la demande :
// la galerie n'embarque ni Three.js ni la boucle de jeu.
const options = readUrlOptions(location.search, BUILD_RESTRICTED); // lot R9 : la production ferme `&solution`, `?carnage=demo` et `?semaine=`
if (options.semaine !== null) void import("./semaine").then((s) => s.mountSemaine(options));
else if (options.gallery) void import("./gallery").then((g) => g.mountGallery(options));
else void import("./main");
