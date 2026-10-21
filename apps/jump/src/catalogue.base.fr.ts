// Catalogue de base de Jump (lot I5) : ce que tous les écrans partagent — titre de la page, noms des thèmes, mots courants, pluriels (morts, essais),
// erreurs d'ordre local (réseau, délai), le cadre crème. Les autres zones (partie, accueil, arrivée, réglages) ont leur fichier ; `catalogue.fr.ts`
// les réunit. Ton (charte § 7) : Jump est drôle et un peu cruel, une seule réplique par écran au plus ; tutoiement en français, « you » direct en
// anglais (adapté, pas traduit mot à mot). Les répliques des thèmes sont dans le catalogue commun de @cdj/ui (`jump.replique.<thème>`, une seule
// source avec le portail). Parité : packages/ui/test/catalogues.test.ts.

// Le français : chargé avec le jeu. L'anglais est dans `catalogue.base.en.ts` (un autre fichier, chargé à la demande : voir i18n.ts).

export const fr = {
  "page.titre": "Jump — Du Jour",
  "page.description": "Jump : un niveau de plateformes court et brutal par jour, le même pour tout le monde. Tu vas mourir. Beaucoup.",
  "page.preparation": "Préparation du niveau…",
  "page.sansWebgl": "WebGL n'est pas disponible dans ce navigateur : Jump ne peut pas s'afficher.",
  // Thèmes du jour (codes de @cdj/jump-sim : JUMP_THEME_NAMES) ; les mêmes noms que le portail (`portail.theme.jump.*`)
  "theme.foret": "Forêt",
  "theme.usine": "Usine",
  "theme.glace": "Glace",
  "theme.nuit": "Nuit",
  "theme.neon": "Néon",
  // Le cadre crème de Du Jour (barre des jeux)
  "cadre.retourJump": "Retour à l'accueil de Jump",
  // Mots courants et pluriels
  "commun.morts": { one: "{n} mort", other: "{n} morts" },
  "commun.essais": { one: "{n} essai", other: "{n} essais" },
  "commun.oui": "Oui",
  "commun.non": "Non",
  "commun.montrer": "Montrer",
  "commun.cacher": "Cacher",
  "commun.citation": "« {texte} »",
  "commun.recharger": "Recharger",
  "commun.version": "sim v{sim} · {jour}",
  "commun.versionDebug": "Jump · sim v{sim} · {jour}",
  // Erreurs d'ordre local (celles du serveur sont dans le catalogue commun : erreur.<code>)
  "erreur.local.reseau": "Classement indisponible",
  "erreur.local.trop_envois": "Trop d'envois : nouvel essai dans un moment.",
  "erreur.local.version": "Une nouvelle version du jeu est disponible : recharge la page pour être classé.",
  "erreur.local.network": "Le serveur ne répond pas.",
  "erreur.local.timeout": "Le serveur met trop de temps à répondre.",
  "erreur.local.inconnue": "Quelque chose n'a pas marché. Réessaie plus tard.",
} as const;
