import { en } from "./catalogue.en";

// Le catalogue commun de `packages/ui` (lot I1) : les textes des composants et la traduction de **chaque code d'erreur du serveur**
// (`erreur.<code>`, liste unique : `apps/api/src/codesErreur.ts`, décrite dans docs/plateforme/codes-erreur.md). Tutoiement en français ;
// en anglais, un ton direct équivalent (charte § 7). Parité et couverture des codes : `packages/ui/test/catalogues.test.ts`.

const fr = {
  // Marque et noms des jeux (noms d'affichage provisoires, charte § 2 : s'ils changent, seuls les catalogues changent).
  "marque.logo": "DU JOUR",
  "marque.nom": "Du Jour",
  "jeu.track.nom": "Track",
  "jeu.track.titre": "TRACK",
  "jeu.jump.nom": "Jump",
  "jeu.jump.titre": "JUMP",
  // Barres
  "barre.retour": "DU JOUR",
  "barre.retour.aria": "Retour au portail Du Jour",
  "barre.jour": "{date} · {numero}",
  // Lot I3 : l'écran d'arrivée d'un jeu propose le jeu suivant du jour (ou fête la journée parfaite). Clés prêtes pour les lots I4 et I5.
  "arrivee.jeuSuivant": "Jeu suivant du jour : {jeu} ›",
  "arrivee.jeuSuivant.aria": "Jeu suivant du jour : {jeu}, à jouer",
  "arrivee.parfaite": "Journée parfaite !",
  // Lot I5 : les répliques de Jump, une par thème (charte § 7 : drôle et un peu cruel, liée à la mécanique du jour ; adaptée en anglais, pas
  // traduite mot à mot). **Une seule source** : le portail (cartouche Jump) et le jeu (accueil, pause) les lisent ici (test catalogues.test.ts).
  "jump.replique.foret": "Le vent souffle. Rarement dans ton sens.",
  "jump.replique.usine": "Les tapis roulants ne t'attendront pas. La scie non plus.",
  "jump.replique.glace": "Ça glisse. Les pics, eux, ne bougent pas.",
  "jump.replique.nuit": "Les plateformes clignotent. Toi, tu ne verras rien venir.",
  "jump.replique.neon": "Une plateforme sur deux. Devine laquelle.",
  // Choix de la langue
  "langue.groupe": "Langue",
  "langue.fr.court": "FR",
  "langue.en.court": "EN",
  "langue.fr.nom": "Français",
  "langue.en.nom": "English",
  // Profil
  "profil.avatar": "Ton profil : {nom}",
  "profil.aucun": "Pas encore de profil",
  "profil.ouvrir": "Ton profil",
  // Médailles (le nom est toujours écrit : la couleur seule ne porte pas l'information)
  "medaille.diamant": "Diamant",
  "medaille.or": "Or",
  "medaille.argent": "Argent",
  "medaille.bronze": "Bronze",
  "medaille.obtenue": "{medaille} : obtenue",
  "medaille.pasEncore": "{medaille} : pas encore",
  // Icônes seules
  "icone.chevron": "Retour",
  "icone.flamme": "Série",
  "icone.crane": "Morts",
  "icone.drapeau": "Arrivée",
  "icone.horloge": "Temps",
  "icone.profil": "Profil",
  "icone.camera": "Caméra",
  // Lot I7 : le plein écran (nom lu du bouton, deux états) et l'astuce de l'iPhone, qui n'a pas de plein écran de page.
  "pleinEcran.entrer": "Plein écran",
  "pleinEcran.quitter": "Quitter le plein écran",
  "pleinEcran.iphone": "Pour jouer en plein écran : Partager › Sur l'écran d'accueil",
  "pleinEcran.iphone.fermer": "Fermer cette astuce",
  // Lot R8 : le message montré une fois quand la remise à zéro du lancement a effacé les données de jeu de ce navigateur.
  "annonce.fermer": "Fermer le message",
  "annonce.important": "Important",
  "nouveauDepart.message": "Nouveau départ : tout le monde repart de zéro. Bonne chance !",
  "nouveauDepart.fermer": "Fermer ce message",
  // Codes d'erreur du serveur (apps/api/src/codesErreur.ts)
  "erreur.not_found": "Cette adresse n'existe pas.",
  "erreur.method_not_allowed": "Cette action n'est pas permise ici.",
  "erreur.invalid_json": "La demande est illisible.",
  "erreur.too_large": "La demande est trop lourde.",
  "erreur.rate_limited": "Trop de demandes d'un coup : réessaie dans quelques minutes.",
  "erreur.too_fast": "Doucement : attends quelques secondes avant de renvoyer.",
  "erreur.busy": "Le serveur est très occupé : réessaie dans une minute.",
  "erreur.internal": "Le serveur a eu un problème. Réessaie plus tard.",
  "erreur.db_unavailable": "Le serveur ne joint pas sa base de données. Réessaie plus tard.",
  "erreur.unauthorized": "Accès refusé.",
  "erreur.forbidden": "Action refusée.",
  "erreur.invalid_action": "Cette action n'est pas valide.",
  "erreur.unknown_result": "Aucun résultat à ce jour-là.",
  "erreur.invalid_news": "Cette nouveauté n'est pas complète.",
  "erreur.unknown_news": "Cette nouveauté n'existe pas.",
  "erreur.invalid_message": "Ce message n'est pas valide.",
  "erreur.invalid_cursor": "Cette page des nouveautés n'existe pas.",
  "erreur.game_unavailable": "Ce jeu n'est pas encore ouvert. Reviens bientôt !",
  "erreur.invalid_player": "Identifiant de joueur invalide.",
  "erreur.unknown_player": "Ce profil n'a encore aucun résultat.",
  "erreur.code_revoked": "Ce code n'est plus valide : il a été remplacé. Charge ton nouveau code.",
  "erreur.invalid_code": "Ce code de transfert est invalide.",
  "erreur.id_taken": "Cet identifiant est déjà pris.",
  "erreur.invalid_name": "Ce pseudo n'est pas valide.",
  "erreur.name_required": "Choisis un pseudo pour être classé.",
  "erreur.name_forbidden": "Ce pseudo n'est pas permis.",
  "erreur.name_taken": "Ce pseudo est déjà utilisé. C'est le tien ? Charge ton code.",
  "erreur.invalid_date": "Date invalide.",
  "erreur.invalid_view": "Cette vue du classement n'existe pas.",
  "erreur.unknown_day": "Ce jour n'a pas de classement.",
  "erreur.day_closed": "Ce jour est terminé : son classement est figé.",
  "erreur.day_started": "Ce jour a déjà commencé : il ne peut plus changer.",
  "erreur.not_daily": "Ce n'est pas le niveau du jour.",
  "erreur.too_far": "Ce jour est trop loin dans le futur.",
  "erreur.invalid_since": "Période invalide.",
  "erreur.invalid_kind": "Type de demande invalide.",
  "erreur.invalid_variant": "Variante invalide.",
  "erreur.invalid_theme": "Thème invalide.",
  "erreur.invalid_level": "Niveau invalide.",
  "erreur.circuit_unavailable": "Le circuit n'est pas disponible pour l'instant. Réessaie dans un moment.",
  "erreur.level_unavailable": "Le niveau n'est pas disponible pour l'instant. Réessaie dans un moment.",
  "erreur.invalid_replay": "Cette course est illisible : elle n'a pas été comptée.",
  "erreur.not_finished": "Cette course ne va pas jusqu'à l'arrivée.",
  "erreur.replay_copy": "Cette course est la copie d'une autre.",
  "erreur.track_mismatch": "Cette course n'est pas sur le bon circuit.",
  "erreur.sim_version": "Une nouvelle version du jeu est disponible : recharge la page.",
  "erreur.version": "Une nouvelle version du jeu est disponible : recharge la page.",
  "erreur.no_ghost": "Pas de fantôme à montrer.",
  "erreur.not_ranked": "Ce fantôme se débloque quand tu es classé ce jour-là.",
  "erreur.invalid_session": "Session du Salon invalide.",
  "erreur.unknown_session": "Cette session du Salon est terminée.",
  "erreur.session_future": "Cette session du Salon n'a pas encore commencé.",
  "erreur.session_closed": "Cette session du Salon est close.",
  "erreur.invalid_ref": "Référence invalide.",
  "erreur.too_many_refs": "Trop de références demandées.",
  "erreur.invalid_lives": "Ces essais sont illisibles.",
  "erreur.too_many_lives": "Trop d'essais envoyés d'un coup.",
} as const;


export const CATALOGUE_COMMUN = { fr, en } as const;
/**
 * Lot I6 : le français seul, pour les jeux. L'anglais est un module à part (`catalogue.en.ts`, `CATALOGUE_COMMUN_EN`) que chaque jeu charge avec son
 * propre anglais (`import()`, à la demande) : ≈ 1 ko compressé de moins au premier chargement d'un joueur en français. Le portail garde les deux.
 */
export const CATALOGUE_COMMUN_FR = fr;
export type CleCommune = keyof typeof fr;
