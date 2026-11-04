import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/cadre.css";
import "@cdj/ui/src/polices/rubik-mono-one-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/kit/jeu.css";
import "./cibles.css";
import { brancherJeu } from "@cdj/kit/jeu";
import { gameStorage } from "@cdj/kit/stockage";
import { brancherMusique } from "@cdj/musique/branche";
import { CATALOGUE_FR } from "./catalogue.fr";
import { DEFINITION } from "./definition";
import { FICHE } from "./fiche";

// « Cibles » (lot K4f) : tout le jeu tient dans `brancherJeu` — la fiche, la définition (simulation, rendu, aide) et les catalogues. Les écrans, l'interrupteur, le serveur, les records, les amis… sont le kit.
void brancherJeu(FICHE, DEFINITION, {
  catalogues: { fr: CATALOGUE_FR, chargerEn: () => import("./catalogue.en").then((m) => ({ jeu: m.CATALOGUE_EN, commun: m.CATALOGUE_COMMUN_EN })) },
  musique: brancherMusique("cibles", gameStorage),
  racine: document.getElementById("app")!,
});
