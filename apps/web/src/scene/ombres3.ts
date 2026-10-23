// Lot 46 — **le pas « ombres » du palier 3 (ordinateur seulement)**, chargé à la demande (`PAS_DU_JEU.ombres`) : une carte d'ombres de 2048 (au lieu de 1024)
// sur 120 m de côté (au lieu de 84), posée 34 m devant la voiture (là où regarde la caméra) : 17 px par mètre au lieu de 12, et plus loin ; le décor
// projette aussi. Un réglage du compositeur du palier 1 (`composerP1.ts` lit `ombres`) : ce module ne porte que ses nombres (ceux de la vitrine,
// `composerPalier.ts`). Pas dans le groupe « vie et ciel » des téléphones : +12 Mo de carte, +17 000 triangles dans la passe d'ombre (38b, § 3).
import { brancherPas } from "./socle";
import type { PasScene } from "./types";

export const OMBRES: PasScene = { id: "ombres", ombres: { carte: 2048, demi: 60, avant: 34, normalBias: 0.04 } };

brancherPas("ombres", OMBRES);
