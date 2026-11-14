import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/cadre.css";
import "@cdj/ui/src/polices/rubik-mono-one-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/kit/jeu.css";
import "./gravity.css";
import { brancherJeu } from "@cdj/kit/jeu";
import { gameStorage } from "@cdj/kit/stockage";
import { brancherMusique } from "@cdj/musique/branche";
import { CATALOGUE_FR } from "./catalogue.fr";
import { DEFINITION } from "./definition";
import { FICHE } from "./fiche";

// « Gravity » : tout le jeu tient dans `brancherJeu` — la fiche, la définition (simulation, rendu, aide) et les catalogues. Les écrans, l'interrupteur, le serveur, les records, les amis… sont le kit.
// Essais (hors production, jamais classés) : `?jour=AAAA-MM-JJ` joue ce jour (c'est le `?seed=` du kit : une archive), `?theme=<id>` commence sur ce thème, la touche T saute au thème suivant (`scene.ts`).
const adresse = new URLSearchParams(location.search);
if (adresse.has("jour") && !adresse.has("seed")) {
  adresse.set("seed", adresse.get("jour")!);
  adresse.delete("jour");
  history.replaceState(null, "", `${location.pathname}?${adresse.toString()}${location.hash}`);
}
void brancherJeu(FICHE, DEFINITION, {
  catalogues: { fr: CATALOGUE_FR, chargerEn: () => import("./catalogue.en").then((m) => ({ jeu: m.CATALOGUE_EN, commun: m.CATALOGUE_COMMUN_EN })) },
  musique: brancherMusique("gravity", gameStorage),
  racine: document.getElementById("app")!,
});
