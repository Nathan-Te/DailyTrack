import { suiteGrammaire } from "./helpers/grammaire23";

// Lot 57b : soixante circuits par thème (v23), première moitié des thèmes (un fichier par moitié : Vitest les fait tourner en parallèle).
suiteGrammaire(["stade", "rallye", "banquise", "nuit"]);
