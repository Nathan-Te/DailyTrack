import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/cadre.css";
import "@cdj/ui/src/polices/rubik-mono-one-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/kit/jeu.css";
import "./blocks.css";
import { parisDay } from "@cdj/clock";
import { brancherJeu } from "@cdj/kit/jeu";
import { BUILD_RESTRICTED, gameStorage } from "@cdj/kit/stockage";
import { brancherMusique } from "@cdj/musique/branche";
import { CATALOGUE_FR } from "./catalogue.fr";
import { DEFINITION } from "./definition";
import { lireEssai } from "./essai";
import { FICHE } from "./fiche";
import { fournirMusique } from "./kitSon";
import { fournirTraduction } from "./textes";

// « Blocks » : tout le jeu tient dans `brancherJeu` — la fiche, la définition (simulation, rendu, aide) et les catalogues. Les écrans, l'interrupteur, le serveur, les records, les amis… sont le kit.
// Un scénario ou une rampe réglée (`?scenario=`, `?debug&tune`) met la page en archive AVANT que le kit lise l'adresse : une partie d'essai n'est jamais classée ni envoyée (`essai.ts`).
const essai = lireEssai(location.search, BUILD_RESTRICTED, parisDay(Date.now()));
if (essai.adresse !== null) history.replaceState(null, "", `${location.pathname}${essai.adresse}${location.hash}`);
const musique = brancherMusique("blocks", gameStorage);
fournirMusique(musique);
void brancherJeu(FICHE, DEFINITION, {
  catalogues: { fr: CATALOGUE_FR, chargerEn: () => import("./catalogue.en").then((m) => ({ jeu: m.CATALOGUE_EN, commun: m.CATALOGUE_COMMUN_EN })) },
  musique,
  racine: document.getElementById("app")!,
}).then((b) => fournirTraduction({ get langue() { return b.i18n.langue; }, t: (cle, params) => b.i18n.t(cle, params) }));
