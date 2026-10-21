import type { Catalogues } from "@cdj/ui";
import type { fr } from "./catalogue.base.fr";

// L'anglais de la zone « base » : chargé seulement par un joueur qui l'utilise (i18n.ts) ; les clés sont celles du français (parité : packages/ui/test/catalogues.test.ts).

export const en: Catalogues<typeof fr>["en"] = {
  "page.titre": "Track — Du Jour",
  "page.description": "One short track a day, the same for everyone: a minute in your browser, a ghost to beat, a result to share.",
  "page.sansJs": "Track needs JavaScript.",
  "theme.stade": "Stadium",
  "theme.rallye": "Rally",
  "theme.banquise": "Pack ice",
  "theme.nuit": "Night",
  "theme.campagne": "Countryside",
  "theme.canyon": "Canyon",
  "theme.col": "Mountain pass",
  "theme.ville": "City",
  "cadre.retourTrack": "Back to Track home",
  "commun.reessayer": "Try again",
  "commun.valider": "Confirm",
  "commun.toi": "You",
  "erreur.local.network": "Server unreachable.",
  "erreur.local.timeout": "The server isn't answering.",
  "erreur.local.http_error": "The server answered with an error.",
  "erreur.local.inconnue": "Something went wrong.",
};
