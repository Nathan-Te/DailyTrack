import { demarrerManette } from "@cdj/ui/src/manette";
import { OPTIONS_MANETTE } from "./manetteEcrans";

// Lot M1 : chargé par `jeu.ts` à la première manette. Le moteur démarre en se chargeant (Tower ne lit pas la manette en partie : aucun filtre à brancher, et le moindre octet
// compte dans son budget). Les écrans et leur action principale sont dans `manetteEcrans.ts` (testé sans navigateur).
demarrerManette(OPTIONS_MANETTE);
