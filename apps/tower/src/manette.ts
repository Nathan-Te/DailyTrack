import { OPTIONS_MANETTE } from "./manetteEcrans";

export { demarrerManette } from "@cdj/ui/src/manette"; // le moteur voyage avec les déclarations : un seul `import()` à la première manette

// Lot M1 : chargé à la première manette (`activerManette`, `main.ts`). Lot T7 : Tower **lit** maintenant la manette en partie (`entrees.ts`, par `padPourLeJeu` comme Track et Jump) : le moteur
// des menus lui cache la manette tant qu'un menu est ouvert (un appui ne sert jamais deux fois), sauf Start. Les écrans et leur action principale sont dans `manetteEcrans.ts` (testé sans navigateur).
export { OPTIONS_MANETTE };
