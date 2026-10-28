import type { Catalogues } from "./i18n";

// Lot 53 (plateforme) : les textes de l'aide du bouton « Plein écran » sur iPhone et de « Retrouver mon profil » (`aideIphone.ts`, `retrouver.ts`). **Un catalogue à part, chargé
// à la demande avec ces deux écrans** (jamais dans le premier chargement d'un jeu ni du portail : le catalogue commun y est, et chaque clé de plus y pèse). La langue est celle
// de la page (`<html lang>`, que chaque application tient à jour). Parité des deux langues : packages/ui/test/catalogues.test.ts.
const fr = {
  "pleinEcran.aide.titre": "Jouer en plein écran",
  "pleinEcran.aide.avant": "Pour jouer en plein écran : touche",
  "pleinEcran.aide.partager": "Partager",
  "pleinEcran.aide.apres": "puis « Sur l'écran d'accueil ».",
  "pleinEcran.aide.profil": "Ton profil se retrouve avec ton code de transfert.",
  "pleinEcran.aide.copier": "Copier mon code",
  "pleinEcran.aide.copie": "Code copié : colle-le dans l'application.",
  "pleinEcran.aide.pasDeCopie": "Copie impossible ici : ouvre ton profil pour copier ton code.",
  "pleinEcran.aide.lien": "Voir mon code de transfert",
  "pleinEcran.aide.fermer": "Fermer",
  "retrouver.titre": "Retrouver mon profil",
  "retrouver.aide": "Cette application a son propre stockage : elle ne connaît pas encore ton profil. Dans Safari, copie ton code de transfert (Du Jour › Profil › Copier mon code), puis colle-le ici.",
  "retrouver.coller": "Coller mon code",
  "retrouver.champ": "Ou colle ton code ici",
  "retrouver.verifier": "Vérifier",
  "retrouver.verification": "Vérification…",
  "retrouver.vide": "Colle d'abord ton code de transfert.",
  "retrouver.illisible": "Ce n'est pas un code de transfert valide : copie-le de nouveau, en entier.",
  "retrouver.deja": "C'est déjà le profil de cet appareil.",
  "retrouver.presseVide": "Le presse-papiers est vide ou refusé : colle ton code dans le champ.",
  "retrouver.horsLigne": "Le serveur est injoignable : réessaie dans un instant.",
  "retrouver.trouve": { one: "Profil trouvé : {nom}, {n} jour fini.", other: "Profil trouvé : {nom}, {n} jours finis." },
  "retrouver.confirmer": "Reprendre ce profil",
  "retrouver.annuler": "Ce n'est pas le mien",
  "retrouver.echec": "Impossible d'enregistrer le profil sur cet appareil.",
  "retrouver.passer": "Commencer sans profil",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "pleinEcran.aide.titre": "Play full screen",
  "pleinEcran.aide.avant": "To play full screen: tap",
  "pleinEcran.aide.partager": "Share",
  "pleinEcran.aide.apres": "then “Add to Home Screen”.",
  "pleinEcran.aide.profil": "You get your profile back with your transfer code.",
  "pleinEcran.aide.copier": "Copy my code",
  "pleinEcran.aide.copie": "Code copied: paste it in the app.",
  "pleinEcran.aide.pasDeCopie": "Can't copy here: open your profile to copy your code.",
  "pleinEcran.aide.lien": "See my transfer code",
  "pleinEcran.aide.fermer": "Close",
  "retrouver.titre": "Get my profile back",
  "retrouver.aide": "This app has its own storage: it doesn't know your profile yet. In Safari, copy your transfer code (Du Jour › Profile › Copy my code), then paste it here.",
  "retrouver.coller": "Paste my code",
  "retrouver.champ": "Or paste your code here",
  "retrouver.verifier": "Check",
  "retrouver.verification": "Checking…",
  "retrouver.vide": "Paste your transfer code first.",
  "retrouver.illisible": "That isn't a valid transfer code: copy it again, in full.",
  "retrouver.deja": "That is already this device's profile.",
  "retrouver.presseVide": "The clipboard is empty or was refused: paste your code in the field.",
  "retrouver.horsLigne": "The server can't be reached: try again in a moment.",
  "retrouver.trouve": { one: "Profile found: {nom}, {n} day done.", other: "Profile found: {nom}, {n} days done." },
  "retrouver.confirmer": "Use this profile",
  "retrouver.annuler": "That's not mine",
  "retrouver.echec": "Couldn't save the profile on this device.",
  "retrouver.passer": "Start without a profile",
};

export const CATALOGUE_IPHONE = { fr, en };
