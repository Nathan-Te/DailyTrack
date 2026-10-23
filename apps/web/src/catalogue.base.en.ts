import type { Catalogues } from "@cdj/ui";
import type { fr } from "./catalogue.base.fr";

// L'anglais de la zone « base » : chargé seulement par un joueur qui l'utilise (i18n.ts) ; les clés sont celles du français (parité : packages/ui/test/catalogues.test.ts).

export const en: Catalogues<typeof fr>["en"] = {
  "page.titre": "Track — Du Jour",
  "page.description": "One short track a day, the same for everyone: a minute in your browser, a ghost to beat, a result to share.",
  "page.sansJs": "Track needs JavaScript.",
  "theme.stade": "Stadium",
  "theme.rallye": "Rally",
  "theme.banquise": "Ice floe",
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
  "voiture.civile.nom": "Hatch",
  "voiture.civile.description": "The game's road car: five doors, a hatchback, a small spoiler. Yours from day one.",
  "voiture.evolution.nom": "Evolution",
  "voiture.evolution.description": "A stocky race coupé: wide wheel arches, a wing on two legs, four round headlights.",
  "voiture.gt.nom": "GT",
  "voiture.gt.description": "A low, wide GT: long bonnet, big swan-neck wing, a light bar from edge to edge.",
  "voiture.proto.nom": "Proto",
  "voiture.proto.description": "An endurance prototype: separate wings, a narrow bubble, a fin, a roof scoop.",
};
