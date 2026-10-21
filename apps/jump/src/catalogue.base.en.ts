import type { Catalogues } from "@cdj/ui";
import type { fr } from "./catalogue.base.fr";

// L'anglais de la zone « base » (lot I5) : chargé seulement par un joueur qui l'utilise (i18n.ts) ; les clés sont celles du français (parité : packages/ui/test/catalogues.test.ts).
export const en: Catalogues<typeof fr>["en"] = {
  "page.titre": "Jump — Du Jour",
  "page.description": "Jump: one short, brutal platform level a day, the same for everyone. You will die. A lot.",
  "page.preparation": "Building the level…",
  "page.sansWebgl": "WebGL isn't available in this browser: Jump can't be shown.",
  "theme.foret": "Forest",
  "theme.usine": "Factory",
  "theme.glace": "Ice",
  "theme.nuit": "Night",
  "theme.neon": "Neon",
  "cadre.retourJump": "Back to Jump's home",
  "commun.morts": { one: "{n} death", other: "{n} deaths" },
  "commun.essais": { one: "{n} attempt", other: "{n} attempts" },
  "commun.fermer": "Close",
  "commun.oui": "On",
  "commun.non": "Off",
  "commun.montrer": "Show",
  "commun.cacher": "Hide",
  "commun.citation": "“{texte}”",
  "commun.recharger": "Reload",
  "commun.version": "sim v{sim} · {jour}",
  "commun.versionDebug": "Jump · sim v{sim} · {jour}",
  "erreur.local.reseau": "Leaderboard unavailable",
  "erreur.local.trop_envois": "Too many submissions: trying again in a moment.",
  "erreur.local.version": "A new version of the game is out: reload the page to get ranked.",
  "erreur.local.network": "The server isn't answering.",
  "erreur.local.timeout": "The server is taking too long to answer.",
  "erreur.local.inconnue": "Something went wrong. Try again later.",
};
