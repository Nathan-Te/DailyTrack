import { readUrlOptions } from "./urlOptions";

// Point d'entrée de la page : la galerie des morceaux (`?modules`, lot 4) ou le jeu. Chacun dans son propre fichier chargé à la demande :
// la galerie n'embarque ni Three.js ni la boucle de jeu.
const options = readUrlOptions(location.search);
if (options.gallery) void import("./gallery").then((g) => g.mountGallery(options));
else void import("./main");
