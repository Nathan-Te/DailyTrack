# Relecture des traductions (anglais)

Fichier **produit** par `npm run traductions` (lot I6 de la plateforme, `scripts/traductions.ts`) : ne pas le modifier à la main, modifier les catalogues puis relancer la commande (le test `packages/ui/test/traductions.test.ts` échoue si ce fichier n'est pas à jour). Pour Nathan : toutes les chaînes anglaises, la clé et le français en face, rangées par application puis par écran (le premier mot de la clé). Commencer par les **choix discutables** listés dans `docs/plateforme/lots/lot-I6-finitions.md`.

927 clés. Les paramètres (`{n}`, `{temps}`…) sont remplacés à l'affichage ; un pluriel s'écrit `one : …` · `other : …`. Les outils internes (`?debug&tune`, administration, galerie des morceaux) restent en français et ne sont pas ici ; les mentions légales anglaises sont une page statique (`apps/portail/legal/`), la page 404 porte les deux langues (`apps/portail/404.html`).

## Catalogue commun (`@cdj/ui` : composants, noms des jeux, médailles, erreurs du serveur, répliques de Jump)

### Arrivée (`arrivee.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `arrivee.jeuSuivant` | Jeu suivant du jour : {jeu} › | Next game of the day: {jeu} › |
| `arrivee.jeuSuivant.aria` | Jeu suivant du jour : {jeu}, à jouer | Next game of the day: {jeu}, to play |
| `arrivee.parfaite` | Journée parfaite ! | Perfect day! |

### Barre des jeux (`barre.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `barre.retour` | DU JOUR | DU JOUR |
| `barre.retour.aria` | Retour au portail Du Jour | Back to Du Jour |
| `barre.jour` | {date} · {numero} | {date} · {numero} |

### Erreurs (`erreur.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `erreur.not_found` | Cette adresse n'existe pas. | This address doesn't exist. |
| `erreur.method_not_allowed` | Cette action n'est pas permise ici. | That action isn't allowed here. |
| `erreur.invalid_json` | La demande est illisible. | The request couldn't be read. |
| `erreur.too_large` | La demande est trop lourde. | The request is too big. |
| `erreur.rate_limited` | Trop de demandes d'un coup : réessaie dans quelques minutes. | Too many requests at once: try again in a few minutes. |
| `erreur.too_fast` | Doucement : attends quelques secondes avant de renvoyer. | Easy: wait a few seconds before sending again. |
| `erreur.busy` | Le serveur est très occupé : réessaie dans une minute. | The server is very busy: try again in a minute. |
| `erreur.internal` | Le serveur a eu un problème. Réessaie plus tard. | The server ran into a problem. Try again later. |
| `erreur.db_unavailable` | Le serveur ne joint pas sa base de données. Réessaie plus tard. | The server can't reach its database. Try again later. |
| `erreur.unauthorized` | Accès refusé. | Access denied. |
| `erreur.invalid_player` | Identifiant de joueur invalide. | Invalid player ID. |
| `erreur.unknown_player` | Ce profil n'a encore aucun résultat. | This profile has no results yet. |
| `erreur.code_revoked` | Ce code n'est plus valide : il a été remplacé. Charge ton nouveau code. | This code is no longer valid: it was replaced. Load your new code. |
| `erreur.invalid_code` | Ce code de transfert est invalide. | This transfer code is invalid. |
| `erreur.id_taken` | Cet identifiant est déjà pris. | This ID is already taken. |
| `erreur.invalid_name` | Ce pseudo n'est pas valide. | That name isn't valid. |
| `erreur.name_required` | Choisis un pseudo pour être classé. | Pick a name to get ranked. |
| `erreur.name_forbidden` | Ce pseudo n'est pas permis. | That name isn't allowed. |
| `erreur.name_taken` | Ce pseudo est déjà utilisé. C'est le tien ? Charge ton code. | That name is already taken. Is it yours? Load your code. |
| `erreur.invalid_date` | Date invalide. | Invalid date. |
| `erreur.unknown_day` | Ce jour n'a pas de classement. | This day has no leaderboard. |
| `erreur.day_closed` | Ce jour est terminé : son classement est figé. | This day is over: its leaderboard is final. |
| `erreur.day_started` | Ce jour a déjà commencé : il ne peut plus changer. | This day has already started: it can't change any more. |
| `erreur.not_daily` | Ce n'est pas le niveau du jour. | That's not today's level. |
| `erreur.too_far` | Ce jour est trop loin dans le futur. | That day is too far in the future. |
| `erreur.invalid_since` | Période invalide. | Invalid period. |
| `erreur.invalid_kind` | Type de demande invalide. | Invalid request type. |
| `erreur.invalid_variant` | Variante invalide. | Invalid variant. |
| `erreur.invalid_theme` | Thème invalide. | Invalid theme. |
| `erreur.invalid_level` | Niveau invalide. | Invalid level. |
| `erreur.circuit_unavailable` | Le circuit n'est pas disponible pour l'instant. Réessaie dans un moment. | The track isn't available right now. Try again in a moment. |
| `erreur.level_unavailable` | Le niveau n'est pas disponible pour l'instant. Réessaie dans un moment. | The level isn't available right now. Try again in a moment. |
| `erreur.invalid_replay` | Cette course est illisible : elle n'a pas été comptée. | This run couldn't be read: it wasn't counted. |
| `erreur.not_finished` | Cette course ne va pas jusqu'à l'arrivée. | This run doesn't reach the finish. |
| `erreur.track_mismatch` | Cette course n'est pas sur le bon circuit. | This run isn't on the right track. |
| `erreur.sim_version` | Une nouvelle version du jeu est disponible : recharge la page. | A new version of the game is out: reload the page. |
| `erreur.version` | Une nouvelle version du jeu est disponible : recharge la page. | A new version of the game is out: reload the page. |
| `erreur.no_ghost` | Pas de fantôme à montrer. | No ghost to show. |
| `erreur.invalid_session` | Session du Salon invalide. | Invalid Room session. |
| `erreur.unknown_session` | Cette session du Salon est terminée. | This Room session is over. |
| `erreur.session_future` | Cette session du Salon n'a pas encore commencé. | This Room session hasn't started yet. |
| `erreur.session_closed` | Cette session du Salon est close. | This Room session is closed. |
| `erreur.invalid_ref` | Référence invalide. | Invalid reference. |
| `erreur.too_many_refs` | Trop de références demandées. | Too many references requested. |
| `erreur.invalid_lives` | Ces essais sont illisibles. | These attempts couldn't be read. |
| `erreur.too_many_lives` | Trop d'essais envoyés d'un coup. | Too many attempts sent at once. |

### Icônes (`icone.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `icone.chevron` | Retour | Back |
| `icone.flamme` | Série | Streak |
| `icone.crane` | Morts | Deaths |
| `icone.drapeau` | Arrivée | Finish |
| `icone.horloge` | Temps | Time |
| `icone.profil` | Profil | Profile |
| `icone.camera` | Caméra | Camera |

### Langue (`langue.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `langue.groupe` | Langue | Language |
| `langue.fr.court` | FR | FR |
| `langue.en.court` | EN | EN |
| `langue.fr.nom` | Français | Français |
| `langue.en.nom` | English | English |

### Marque (`marque.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `marque.logo` | DU JOUR | DU JOUR |
| `marque.nom` | Du Jour | Du Jour |

### Médailles (`medaille.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `medaille.auteur` | Auteur | Author |
| `medaille.or` | Or | Gold |
| `medaille.argent` | Argent | Silver |
| `medaille.bronze` | Bronze | Bronze |
| `medaille.obtenue` | {medaille} : obtenue | {medaille}: earned |
| `medaille.pasEncore` | {medaille} : pas encore | {medaille}: not yet |

### Noms des jeux (`jeu.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `jeu.track.nom` | Track | Track |
| `jeu.track.titre` | TRACK | TRACK |
| `jeu.jump.nom` | Jump | Jump |
| `jeu.jump.titre` | JUMP | JUMP |

### pleinEcran (`pleinEcran.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `pleinEcran.entrer` | Plein écran | Full screen |
| `pleinEcran.quitter` | Quitter le plein écran | Exit full screen |
| `pleinEcran.iphone` | Pour jouer en plein écran : Partager › Sur l'écran d'accueil | To play full screen: Share › Add to Home Screen |
| `pleinEcran.iphone.fermer` | Fermer cette astuce | Dismiss this tip |

### Profil (`profil.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `profil.avatar` | Ton profil : {nom} | Your profile: {nom} |
| `profil.aucun` | Pas encore de profil | No profile yet |
| `profil.ouvrir` | Ton profil | Your profile |

### Répliques de Jump (portail et jeu) (`jump.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `jump.replique.foret` | Le vent souffle. Rarement dans ton sens. | The wind is blowing. Hardly ever your way. |
| `jump.replique.usine` | Les tapis roulants ne t'attendront pas. La scie non plus. | The conveyor belts won't wait for you. Neither will the saw. |
| `jump.replique.glace` | Ça glisse. Les pics, eux, ne bougent pas. | It's slippery. The spikes, sadly, aren't. |
| `jump.replique.nuit` | Les plateformes clignotent. Toi, tu ne verras rien venir. | The platforms blink. You won't see it coming. |
| `jump.replique.neon` | Une plateforme sur deux. Devine laquelle. | Every other platform is there. Guess which. |

## Portail Du Jour (accueil, profil commun, classement du jour, vitrine et démonstration de la recette)

### Aperçu de partage (quand on colle le lien) (`apercu.*`, `apps/portail/src/catalogueApercu.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `apercu.titre` | Du Jour — les jeux du jour | Du Jour — today's games |
| `apercu.description` | Chaque jour, un circuit Track et un niveau Jump, les mêmes pour tout le monde. Joue, compare, partage ta journée. | Every day, one Track circuit and one Jump level, the same for everyone. Play, compare, share your day. |
| `apercu.image` | Le logo DU JOUR et deux cartouches posées sur l'étagère : Track et Jump. | The DU JOUR logo and two cartridges on the shelf: Track and Jump. |

### Classement (`classement.*`, `apps/portail/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `classement.titre` | Classement du jour | Today's leaderboard |
| `classement.description` | Le classement du jour de Du Jour : tes points sur tous les jeux, les médailles de chaque joueur. | Today's Du Jour leaderboard: your points across every game, and each player's medals. |
| `classement.bareme` | Points par jeu : {auteur} {pa}, {or} {po}, {argent} {pg}, {bronze} {pb}, fini sans médaille {zero}. | Points per game: {auteur} {pa}, {or} {po}, {argent} {pg}, {bronze} {pb}, finished with no medal {zero}. |
| `classement.egalite` | À égalité : la somme des places dans les jeux, puis le premier arrivé. | Tie: the sum of your places in the games, then whoever got there first. |
| `classement.veille` | ‹ Veille | ‹ Previous day |
| `classement.lendemain` | Lendemain › | Next day › |
| `classement.veille.aria` | Voir le classement de la veille | See the previous day's leaderboard |
| `classement.lendemain.aria` | Voir le classement du lendemain | See the next day's leaderboard |
| `classement.classes` | one : {n} joueur classé · other : {n} joueurs classés | one : {n} player ranked · other : {n} players ranked |
| `classement.pts` | one : {n} pt · other : {n} pts | one : {n} pt · other : {n} pts |
| `classement.toi` | Toi | You |
| `classement.pasFini` | pas fini | not finished |
| `classement.vide` | Personne n'a encore fini de jeu ce jour-là. | Nobody has finished a game that day yet. |
| `classement.chargement` | Chargement du classement… | Loading the leaderboard… |
| `classement.ferme` | Jour terminé : ce classement est figé. | Day over: this leaderboard is final. |
| `classement.invite` | Finis un jeu pour entrer au classement. | Finish a game to enter the leaderboard. |

### Démonstration (recette seulement) (`demo.*`, `apps/portail/src/catalogueDemo.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `demo.titre` | Joueur de démonstration | Demo player |
| `demo.texte` | Ce lien installe sur cet appareil le joueur « {nom} » de la recette, pour voir le portail plein. Il remplacera le profil de cet appareil ({actuel}), dans tous les jeux. | This link installs the test server's player "{nom}" on this device, to see the portal full. It will replace this device's profile ({actuel}), in every game. |
| `demo.installer` | Installer le joueur de démonstration | Install the demo player |
| `demo.annuler` | Garder mon profil | Keep my profile |

### Partage de la journée (`partage.*`, `apps/portail/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `partage.titre` | Du Jour #{numero} | Du Jour #{numero} |
| `partage.titreSansNumero` | Du Jour | Du Jour |

### Portail (`portail.*`, `apps/portail/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `portail.titre` | Du Jour | Du Jour |
| `portail.description` | Du Jour : un jeu par jour, le même pour tous. Track et Jump. | Du Jour: one game a day, the same for everyone. Track and Jump. |
| `portail.jeux.titre` | Les jeux du jour | Today's games |
| `portail.track.accroche` | Un circuit par jour, le même pour tous. | One track a day, the same for everyone. |
| `portail.jump.accroche` | Un niveau de plateforme par jour, le même pour tous. | One platform level a day, the same for everyone. |
| `portail.jouer` | Jouer | Play |
| `portail.jouer.aria` | Jouer à {jeu} | Play {jeu} |
| `portail.pied` | Nouveau jour à minuit, heure de Paris. Ton profil est le même dans tous les jeux. | A new day at midnight, Paris time. Your profile is the same in every game. |
| `portail.mentions` | Mentions légales et confidentialité | Legal notice and privacy |
| `portail.compte.legende` | Prochains jeux dans | Next games in |
| `portail.avancement` | one : {n} fini sur {total} · other : {n} finis sur {total} | one : {n} of {total} done · other : {n} of {total} done |
| `portail.numeroTheme` | {numero} · {theme} | {numero} · {theme} |
| `portail.statut.pasJoue` | Pas encore joué | Not played yet |
| `portail.statut.enCours` | En cours | In progress |
| `portail.statut.enCoursMorts` | one : En cours · {n} mort · other : En cours · {n} morts | one : In progress · {n} death · other : In progress · {n} deaths |
| `portail.statut.fini` | Fini | Done |
| `portail.statut.rang` | {rang} sur {classes} | {rang} of {classes} |
| `portail.continuer` | Continuer | Continue |
| `portail.continuer.aria` | Continuer {jeu} | Continue {jeu} |
| `portail.rejouer` | Rejouer | Play again |
| `portail.rejouer.aria` | Rejouer à {jeu} | Play again: {jeu} |
| `portail.serie.legende` | Série | Streak |
| `portail.serie.valeur` | one : {n} jour · other : {n} jours | one : {n} day · other : {n} days |
| `portail.serie.parfaites` | one : {n} journée parfaite · other : {n} journées parfaites | one : {n} perfect day · other : {n} perfect days |
| `portail.serie.aProlonger` | Joue aujourd'hui pour la garder | Play today to keep it |
| `portail.serie.parfaiteAujourdhui` | Journée parfaite aujourd'hui | Perfect day today |
| `portail.accueil` | Bienvenue ! Un jeu par jour, le même pour tous : choisis ta première cartouche. | Welcome! One game a day, the same for everyone: pick your first cartridge. |
| `portail.horsLigne` | Serveur injoignable : tes statuts reviendront dès qu'il répondra. | Can't reach the server: your progress will show up once it's back. |
| `portail.delai` | Le serveur ne répond pas : tes statuts reviendront plus tard. | The server isn't answering: your progress will show up later. |
| `portail.theme.cdj.stade` | Stade | Stadium |
| `portail.theme.cdj.rallye` | Rallye | Rally |
| `portail.theme.cdj.banquise` | Banquise | Ice floe |
| `portail.theme.cdj.nuit` | Nuit | Night |
| `portail.theme.cdj.campagne` | Campagne | Countryside |
| `portail.theme.cdj.canyon` | Canyon | Canyon |
| `portail.theme.cdj.col` | Col alpin | Mountain pass |
| `portail.theme.cdj.ville` | Ville | City |
| `portail.theme.jump.foret` | Forêt | Forest |
| `portail.theme.jump.usine` | Usine | Factory |
| `portail.theme.jump.glace` | Glace | Ice |
| `portail.theme.jump.nuit` | Nuit | Night |
| `portail.theme.jump.neon` | Néon | Neon |
| `portail.journee` | Journée {numero} | Day {numero} |
| `portail.classement.legende` | Classement du jour | Today's leaderboard |
| `portail.classement.points` | one : {n} point, tous jeux · other : {n} points, tous jeux | one : {n} point, all games · other : {n} points, all games |
| `portail.classement.inviter` | Finis un jeu pour entrer au classement | Finish a game to enter the leaderboard |
| `portail.partager` | Partager ma journée | Share my day |
| `portail.partage.apercu` | Ce que tu partages | What you're sharing |
| `portail.partage.partage` | Journée partagée. | Day shared. |
| `portail.partage.copie` | Ligne copiée : colle-la où tu veux. | Line copied: paste it wherever you like. |
| `portail.partage.pasDeCopie` | Copie impossible ici : sélectionne la ligne à la main. | Can't copy here: select the line by hand. |

### Profil (`profil.*`, `apps/portail/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `profil.titre` | Ton profil | Your profile |
| `profil.retour.aria` | Retour à {jeu} | Back to {jeu} |
| `profil.description` | Ton profil Du Jour : pseudo, code de transfert, série et statistiques de chaque jeu. | Your Du Jour profile: name, transfer code, streak and stats for each game. |
| `profil.sansProfil` | Pas encore de profil sur le serveur : finis un jeu pour l'ouvrir. Tu as un code ? Charge-le ci-dessous. | No profile on the server yet: finish a game to open one. Got a code? Load it below. |
| `profil.inconnu` | Ce profil n'a encore aucun résultat : finis un jeu pour l'ouvrir. | This profile has no results yet: finish a game to open it. |
| `profil.pseudo.titre` | Pseudo | Name |
| `profil.pseudo.champ` | Nouveau pseudo | New name |
| `profil.pseudo.changer` | Changer | Change |
| `profil.pseudo.change` | Pseudo changé : {nom}. | Name changed: {nom}. |
| `profil.pseudo.libres` | Pseudos libres : | Free names: |
| `profil.pseudo.regle` | 1 à 20 lettres ou chiffres (espaces, points, tirets permis). | 1 to 20 letters or digits (spaces, dots and dashes allowed). |
| `profil.code.titre` | Code de transfert | Transfer code |
| `profil.code.aide` | Garde-le comme un mot de passe : il ouvre ton profil sur un autre appareil, dans tous les jeux. | Keep it like a password: it opens your profile on another device, in every game. |
| `profil.code.copier` | Copier mon code | Copy my code |
| `profil.code.copie` | Code copié. | Code copied. |
| `profil.code.pasDeCopie` | Copie impossible ici : sélectionne le code à la main. | Can't copy here: select the code by hand. |
| `profil.code.charger` | Charger un code | Load a code |
| `profil.code.champ` | Code reçu (CDJ2.…) | Code you received (CDJ2.…) |
| `profil.code.verifier` | Vérifier | Check |
| `profil.code.apercu` | one : Profil de {nom} : {n} jour fini. Il remplacera celui de cet appareil, dans tous les jeux. · other : Profil de {nom} : {n} jours finis. Il remplacera celui de cet appareil, dans tous les jeux. | one : {nom}'s profile: {n} day done. It will replace this device's profile, in every game. · other : {nom}'s profile: {n} days done. It will replace this device's profile, in every game. |
| `profil.code.confirmer` | Charger ce profil | Load this profile |
| `profil.code.annuler` | Annuler | Cancel |
| `profil.code.charge` | Profil chargé : {nom}. | Profile loaded: {nom}. |
| `profil.code.deja` | C'est déjà le profil de cet appareil. | That's already this device's profile. |
| `profil.code.illisible` | Ce code est illisible : copie-le en entier, sans rien ajouter. | This code can't be read: copy all of it, without adding anything. |
| `profil.serie.titre` | Tous les jeux | All games |
| `profil.parfaites.legende` | Journées parfaites | Perfect days |
| `profil.jeux.titre` | Par jeu | By game |
| `profil.jours` | one : {n} jour fini · other : {n} jours finis | one : {n} day done · other : {n} days done |
| `profil.meilleurRang` | Meilleure place : {rang} sur {classes}, {date} | Best place: {rang} of {classes}, {date} |
| `profil.pasClasse` | Pas encore classé | Not ranked yet |
| `profil.medailles` | Médailles | Medals |
| `profil.langue.titre` | Langue | Language |
| `profil.chargement` | Chargement du profil… | Loading your profile… |

### Vitrine des composants (recette seulement) (`vitrine.*`, `apps/portail/src/catalogueVitrine.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `vitrine.titre` | Vitrine du socle — Du Jour | Component showcase — Du Jour |
| `vitrine.intro` | Chaque composant de @cdj/ui dans tous ses états, en français et en anglais, sur fond crème et sur asphalte. Page de recette : elle n'existe pas en production. | Every @cdj/ui component in every state, in French and English, on cream and on asphalt. A staging page: it doesn't exist in production. |
| `vitrine.section.marque` | Logo et barres | Logo and bars |
| `vitrine.section.boutons` | Boutons | Buttons |
| `vitrine.section.pleinEcran` | Plein écran et astuce de l'iPhone | Full screen and iPhone tip |
| `vitrine.section.cartouches` | Cartouches | Cartridges |
| `vitrine.section.cadre` | Écran posé sur la scène d'un jeu | Screen on a game's scene |
| `vitrine.cadre.intro` | creerCadre : voile à rayures sur la scène, barre des jeux en plaque crème, l'étiquette du jeu, puis le pied (Track, puis Jump). | creerCadre: striped veil over the scene, game bar on a cream plate, the game's label, then the footer (Track, then Jump). |
| `vitrine.cadre.titre` | Arrivée | Finish |
| `vitrine.section.tuiles` | Tuile et afficheur | Tile and display |
| `vitrine.section.medailles` | Médailles | Medals |
| `vitrine.section.icones` | Icônes | Icons |
| `vitrine.section.couleurs` | Couleurs | Colours |
| `vitrine.section.contrastes` | Contrastes | Contrast |
| `vitrine.fond.creme` | Sur crème | On cream |
| `vitrine.fond.asphalte` | Sur asphalte | On asphalt |
| `vitrine.etat.normal` | normal | normal |
| `vitrine.etat.survol` | survol | hover |
| `vitrine.etat.appui` | appui | pressed |
| `vitrine.etat.focus` | focus | focus |
| `vitrine.etat.desactive` | désactivé | disabled |
| `vitrine.bouton.marque` | Jouer | Play |
| `vitrine.bouton.secondaire` | Rejouer | Replay |
| `vitrine.bouton.track` | Courir | Race |
| `vitrine.bouton.jump` | Jouer | Play |
| `vitrine.etiquette.track` | Circuit du jour · Canyon | Today's track · Canyon |
| `vitrine.etiquette.jump` | En cours · 37 morts | In progress · 37 deaths |
| `vitrine.tuile.legende` | Série | Streak |
| `vitrine.tuile.valeur` | one : {n} jour · other : {n} jours | one : {n} day · other : {n} days |
| `vitrine.tuile.sous` | one : {n} journée parfaite · other : {n} journées parfaites | one : {n} perfect day · other : {n} perfect days |
| `vitrine.afficheur.legende` | Prochains jeux dans | Next games in |
| `vitrine.contraste.texte` | Texte | Text |
| `vitrine.contraste.fond` | Fond | Background |
| `vitrine.contraste.rapport` | Rapport | Ratio |
| `vitrine.contraste.seuil` | Seuil | Minimum |
| `vitrine.contraste.ok` | passe | pass |
| `vitrine.contraste.ko` | échoue | fail |
| `vitrine.contraste.exemple` | Aa | Aa |

## Track

### Accueil (`accueil.*`, `apps/web/src/catalogue.accueil.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `accueil.aria` | Accueil de Track | Track home |
| `accueil.circuitDuJour` | Circuit du Jour | Track of the Day |
| `accueil.sousTitre` | Circuit du jour · {theme} | Today's track · {theme} |
| `accueil.apercu.aria` | Tracé du circuit {theme} | Layout of the {theme} track |
| `accueil.meilleur` | Meilleur temps | Best time |
| `accueil.pasCourse` | Tu n'as pas encore couru aujourd'hui. | You haven't raced yet today. |
| `accueil.rang.sur` | sur {total} | of {total} |
| `accueil.medailles` | Médailles du circuit | Track medals |
| `accueil.fantome` | Fantôme à battre | Ghost to beat |
| `accueil.fantome.aria` | Fantôme à battre : {nom}, {temps} | Ghost to beat: {nom}, {temps} |
| `accueil.courir` | Courir | Race |
| `accueil.recourir` | Recourir | Race again |
| `accueil.tactile` | Pour conduire, mets ton téléphone en paysage. | To drive, turn your phone sideways. |
| `accueil.prochain` | Prochain circuit dans {temps} (minuit, heure de Paris) | Next track in {temps} (midnight, Paris time) |
| `accueil.liens` | Autres pages | Other pages |
| `accueil.archives` | Archives | Archives |
| `accueil.reglages` | Réglages | Settings |
| `accueil.aide` | Comment jouer | How to play |
| `accueil.profil` | Mon profil Du Jour | My Du Jour profile |
| `accueil.salon.titre` | Salon | Room |
| `accueil.salon.aria` | Salon | Room |
| `accueil.salon.lead` | Un nouveau circuit toutes les 10 minutes, avec les fantômes des autres joueurs et un classement de session. | A new track every 10 minutes, with other players' ghosts and a session leaderboard. |
| `accueil.salon.rejoindre` | Rejoindre le Salon | Join the Room |
| `accueil.salon.recherche` | Recherche du Salon… | Looking for the Room… |
| `accueil.salon.etat` | one : En cours : {theme} · prochain circuit dans {temps} · {n} joueur présent · other : En cours : {theme} · prochain circuit dans {temps} · {n} joueurs présents | one : Running: {theme} · next track in {temps} · {n} player here · other : Running: {theme} · next track in {temps} · {n} players here |
| `accueil.salon.sansServeur` | Le Salon a besoin du serveur : il n'est pas relié à celui-ci. | The Room needs the server: it isn't connected to one here. |
| `accueil.salon.muet` | Le Salon ne répond pas pour l'instant. Le circuit du jour reste jouable. | The Room isn't answering right now. Today's track is still playable. |

### Aperçu de partage (quand on colle le lien) (`apercu.*`, `apps/web/src/catalogue.apercu.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `apercu.titre` | Track — Du Jour | Track — Du Jour |
| `apercu.description` | Un circuit par jour, le même pour tous. Un tour, un chrono, le fantôme du premier à battre. | One track a day, the same for everyone. One lap, one time, the leader's ghost to beat. |
| `apercu.image` | L'étiquette de Track : asphalte, bandes de livrée orange, TRACK en capitales. | The Track label: asphalt, orange livery stripes, TRACK in capitals. |

### Archives (`archives.*`, `apps/web/src/catalogue.accueil.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `archives.titre` | Archives | Archives |
| `archives.aria` | Archives | Archives |
| `archives.hasard` | Circuit au hasard | Random track |
| `archives.themeDuJour` | Thème du jour | Today's theme |
| `archives.themes` | Thème du circuit | Track theme |
| `archives.aujourdhui` | aujourd'hui | today |
| `archives.revoir` | Revoir le meilleur tour | Watch the best lap |
| `archives.revoir.titre` | Revoir le tour du premier | Watch the winner's lap |
| `archives.vignette` | Vue aérienne du circuit n° {numero} du {date} | Aerial view of track #{numero} of {date} |
| `archives.vignetteSansNumero` | Vue aérienne du circuit du {date} | Aerial view of the track of {date} |
| `archives.pilotes` | one : {n} pilote · other : {n} pilotes | one : {n} driver · other : {n} drivers |
| `archives.note` | Les jours passés, les circuits au hasard et les thèmes forcés se rejouent sans classement (touches N : au hasard, T : thème suivant). | Past days, random tracks and forced themes are replayed unranked (N key: random, T key: next theme). |

### Arrivée (`arrivee.*`, `apps/web/src/catalogue.course.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `arrivee.titre` | Arrivée | Finish |
| `arrivee.circuit` | Circuit {numero} · {theme} | Track {numero} · {theme} |
| `arrivee.circuitSansNumero` | {theme} | {theme} |
| `arrivee.recordNouveau` | Nouveau record | New record |
| `arrivee.premierTemps` | Premier temps | First time |
| `arrivee.recordActuel` | Record {temps} | Record {temps} |
| `arrivee.medaille` | Médaille {medaille} | {medaille} medal |
| `arrivee.medaille.auteur` | Meilleur que l'auteur ! | Faster than the author! |
| `arrivee.auteur` | Auteur | Author |
| `arrivee.auteurA` | à {temps} | {temps} behind |
| `arrivee.sansMedaille` | Pas de médaille · bronze à {temps} | No medal · bronze at {temps} |
| `arrivee.classement` | Classement du jour | Today's leaderboard |
| `arrivee.sur` | sur {total} | of {total} |
| `arrivee.places` | one : +{n} place · other : +{n} places | one : +{n} place · other : +{n} places |
| `arrivee.reprises` | one : {n} reprise au point de contrôle · other : {n} reprises au point de contrôle | one : {n} respawn at a checkpoint · other : {n} respawns at a checkpoint |
| `arrivee.sansReprise` | Sans reprise | No respawn |
| `arrivee.reglagesModifies` | Réglages modifiés : course non classée ni enregistrée | Modified settings: run neither ranked nor saved |
| `arrivee.recourir` | Recourir | Race again |
| `arrivee.revoir` | Revoir le tour | Watch the lap |
| `arrivee.revoir.aria` | Revoir le tour : le meilleur du jour | Watch the lap: today's best |
| `arrivee.accueil` | Accueil de Track | Track home |
| `arrivee.indice` | Entrée : rejouer · P : pause | Enter: race again · P: pause |
| `arrivee.legendeSuite` | Il te reste aujourd'hui | Still to play today |
| `arrivee.sansServeur` | Course non classée : ce jeu n'est pas relié à un serveur. Ton record reste sur cet appareil. | Run not ranked: this game isn't linked to a server. Your record stays on this device. |
| `arrivee.horsLigne` | Hors ligne : course non classée. Ton record reste sur cet appareil. | Offline: run not ranked. Your record stays on this device. |
| `arrivee.horsLigneDetail` | Hors ligne : course non classée ({detail}) | Offline: run not ranked ({detail}) |
| `arrivee.jourPasse` | Jour passé : le classement est figé, ce temps n'y entre pas. | Past day: the leaderboard is frozen, this time doesn't count. |
| `arrivee.envoi` | Envoi au classement… | Sending to the leaderboard… |
| `arrivee.chargement` | Chargement du classement… | Loading the leaderboard… |
| `arrivee.tempsServeur` | temps du serveur : {temps} | server time: {temps} |
| `arrivee.changerPseudo` | Changer de pseudo | Change name |
| `arrivee.choisirPseudo` | Choisis ton pseudo pour entrer au classement | Pick a name to enter the leaderboard |
| `arrivee.nouveauPseudo` | Nouveau pseudo | New name |
| `arrivee.pseudo.placeholder` | Ton pseudo | Your name |
| `arrivee.pseudo.invalide` | 1 à 20 caractères : lettres, chiffres, espace . _ ' - | 1 to 20 characters: letters, digits, space . _ ' - |
| `arrivee.pseudo.ok` | OK | OK |
| `arrivee.pseudo.enregistre` | Pseudo : {nom} | Name: {nom} |
| `arrivee.monProfil` | Mon profil Du Jour › | My Du Jour profile › |

### Cadre des écrans (`cadre.*`, `apps/web/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `cadre.retourTrack` | Retour à l'accueil de Track | Back to Track home |

### Commandes tactiles (`tactile.*`, `apps/web/src/catalogue.reglages.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `tactile.direction.nom` | Direction | Steering |
| `tactile.direction.aide` | Glisser le pouce, ou deux boutons ← →. | Slide your thumb, or two ← → buttons. |
| `tactile.direction.glisser` | Glisser | Slide |
| `tactile.direction.boutons` | Boutons ← → | ← → buttons |
| `tactile.taille.nom` | Taille des boutons | Button size |
| `tactile.taille.small` | Petits | Small |
| `tactile.taille.medium` | Moyens | Medium |
| `tactile.taille.large` | Grands | Large |
| `tactile.sensibilite.nom` | Sensibilité | Sensitivity |
| `tactile.sensibilite.aide` | Glisser : plus c'est haut, moins il faut de mouvement. | Sliding: the higher it is, the less you need to move. |
| `tactile.zoneMorte.nom` | Zone morte | Dead zone |
| `tactile.accelerateur.nom` | Accélérateur | Throttle |
| `tactile.accelerateur.aide` | Automatique : la voiture accélère seule, tu ne touches que le frein. | Automatic: the car accelerates by itself, you only touch the brake. |
| `tactile.accelerateur.bouton` | Bouton gaz | Gas button |
| `tactile.accelerateur.auto` | Automatique | Automatic |
| `tactile.vibration.nom` | Vibration | Vibration |
| `tactile.vibration.aide` | Au point de contrôle et aux chocs, si ton téléphone sait vibrer. | At checkpoints and on hits, if your phone can vibrate. |
| `tactile.reinit` | Réglages tactiles par défaut | Default touch settings |
| `tactile.indice` | {direction} · {pedales} | {direction} · {pedales} |
| `tactile.indice.glisser` | Glisse à gauche pour tourner | Slide on the left to steer |
| `tactile.indice.fleches` | ← → à gauche pour tourner | ← → on the left to steer |
| `tactile.indice.pedales` | frein et gaz à droite | brake and gas on the right |
| `tactile.indice.auto` | touche à droite pour freiner | touch on the right to brake |
| `tactile.frein` | Frein | Brake |
| `tactile.gaz` | Gaz | Gas |
| `tactile.pointDeControle` | Recommencer au dernier point de contrôle | Restart from the last checkpoint |
| `tactile.depart` | Recommencer depuis le départ | Restart from the start |
| `tactile.rotation` | Tourne ton téléphone : on conduit mieux en paysage. | Turn your phone: it drives better in landscape. |
| `tactile.rotation.ok` | Jouer quand même | Play anyway |

### Comment jouer (`aide.*`, `apps/web/src/catalogue.reglages.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `aide.titre` | Comment jouer | How to play |
| `aide.parti` | C'est parti | Let's go |
| `aide.zone.libre` | Libre | Clear |
| `aide.schema.legende` | En haut à gauche : pause, dernier point de contrôle, recommencer. Le centre reste libre. | Top left: pause, last checkpoint, restart. The centre stays clear. |
| `aide.point.tourner.doigts` | Tourne avec ← → en bas à gauche. | Steer with ← → at the bottom left. |
| `aide.point.pedales.doigts` | Gaz et frein en bas à droite. | Gas and brake at the bottom right. |
| `aide.point.but` | Passe tous les points de contrôle, bats ton record. | Hit every checkpoint, beat your record. |
| `aide.point.tourner.clavier` | Tourne avec ← → (ou Q D). | Steer with ← → (or A D). |
| `aide.point.pedales.clavier` | Accélère avec ↑ (ou Z), freine avec ↓ (ou S) ; Espace pour déraper. | Accelerate with ↑ (or W), brake with ↓ (or S); Space to drift. |
| `aide.zone.frein` | Frein | Brake |
| `aide.zone.gaz` | Gaz | Gas |
| `aide.touche.espace` | Espace | Space |
| `aide.touche.entree` | Entrée | Enter |
| `aide.touche.echap` | Échap | Esc |
| `aide.touche.stickGauche` | Stick gauche | Left stick |
| `aide.touche.croix` | Croix | D-pad |
| `aide.touche.vue` | Vue | View |
| `aide.clavier.deplacer` | Accélérer, tourner à gauche, freiner / reculer, tourner à droite (aussi W A S D et les flèches) | Accelerate, steer left, brake / reverse, steer right (W A S D and the arrow keys work too) |
| `aide.clavier.frein` | Freiner — en tournant, la voiture dérape | Brake — while steering, the car drifts |
| `aide.clavier.pointDeControle` | Retour au dernier point de contrôle (le chrono continue) | Back to the last checkpoint (the clock keeps running) |
| `aide.clavier.depart` | Recommencer depuis le départ | Restart from the start |
| `aide.clavier.camera` | Changer de caméra (proche, loin, capot) | Change camera (near, far, hood) |
| `aide.clavier.pause` | Pause et menu | Pause and menu |
| `aide.clavier.classement` | Montrer ou replier le classement | Show or fold the leaderboard |
| `aide.clavier.fantome` | Changer de fantôme | Change ghost |
| `aide.clavier.son` | Couper ou remettre le son | Mute or unmute |
| `aide.manette.tourner` | Tourner | Steer |
| `aide.manette.accelerer` | Accélérer | Accelerate |
| `aide.manette.freiner` | Freiner / reculer | Brake / reverse |
| `aide.manette.pointDeControle` | Retour au dernier point de contrôle | Back to the last checkpoint |
| `aide.manette.depart` | Recommencer depuis le départ | Restart from the start |
| `aide.manette.pause` | Pause et menu | Pause and menu |
| `aide.manette.camera` | Changer de caméra | Change camera |

### Course (surimpressions) (`course.*`, `apps/web/src/catalogue.course.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `course.menu.aria` | Menu du jeu | Game menu |
| `course.rang.aria` | Classement du jour : {rang}, ouvrir ou fermer | Today's leaderboard: {rang}, open or close |
| `course.rang.salon.aria` | Classement de la session : {rang}, ouvrir ou fermer | Session leaderboard: {rang}, open or close |
| `course.pause.aria` | Pause | Pause |
| `course.fige` | FIGÉ | FROZEN |
| `course.aide.puce` | Comment jouer · P : pause | How to play · P: pause |
| `course.aide.titre` | Comment jouer | How to play |
| `course.meta.jour` | Circuit {numero} · {date} · {theme} | Track {numero} · {date} · {theme} |
| `course.meta.sansNumero` | Circuit du {date} · {theme} | Track of {date} · {theme} |
| `course.notice.essaiVariante` | variante {variante} : essai, non classé | variant {variante}: trial, unranked |
| `course.notice.essaiVarianteTheme` | variante {variante}, thème forcé : essai, non classé | variant {variante}, forced theme: trial, unranked |
| `course.notice.essaiTheme` | thème forcé : essai, non classé | forced theme: trial, unranked |
| `course.notice.horsLigne` | hors ligne, non classé | offline, unranked |
| `course.notice.demo` | mode démo | demo mode |
| `course.notice.dateInvalide` | date invalide : circuit d'aujourd'hui | invalid date: today's track |
| `course.notice.reglages` | Réglages modifiés : course non classée | Modified settings: run not ranked |
| `course.notice.pasDisponible` | Ce circuit n'est pas encore disponible : voici celui du jour | This track isn't available yet: here is today's |
| `course.notice.essaisReserves` | Thème et variante forcés : réservés aux essais | Forced theme and variant: trials only |
| `course.scenario.pilotage` | Circuit de pilotage | Handling track |
| `course.scenario.surfaces` | Circuit des surfaces | Surfaces track |
| `course.scenario.largeurs` | Circuit des largeurs | Widths track |
| `course.scenario.vitesse` | Circuit de vitesse | Speed track |
| `course.scenario.glace` | Circuit de glace | Ice track |
| `course.scenario.relief` | Circuit du relief | Relief track |
| `course.scenario.cuves` | Circuit des cuves | Bowls track |
| `course.scenario.air` | Circuit de l'air | Air track |
| `course.scenario.basCotes` | Bas-côtés et vibreurs | Shoulders and kerbs |
| `course.scenario.figures` | Les figures | The figures |
| `course.scenario.figure` | Figure : {nom} | Figure: {nom} |
| `course.scenario.essai` | Circuit d'essai | Test track |
| `course.objectif.aria` | Objectif de médaille : {medaille}, {temps} | Medal target: {medaille}, {temps} |
| `course.pc` | PC {n}/{total} | CP {n}/{total} |
| `course.pc.aria` | Point de contrôle {n} sur {total}, {ecart} | Checkpoint {n} of {total}, {ecart} |
| `course.pc.sansReference` | Point de contrôle {n} sur {total} | Checkpoint {n} of {total} |
| `course.fantome.vs` | vs {nom} | vs {nom} |
| `course.fantome.vsPuis` | vs {nom} → {suivant} | vs {nom} → {suivant} |
| `course.fantome.tonRecord` | ton record | your record |
| `course.fantome.aucun` | aucun | none |
| `course.fantome.premier` | premier : {nom} | leader: {nom} |
| `course.fantome.devantToi` | devant toi : {nom} | ahead of you: {nom} |
| `course.fantome.suivant` | {nom} (au prochain départ) | {nom} (next start) |
| `course.fantome.annonce` | Fantôme : {nom} | Ghost: {nom} |
| `course.fantome.pasDePremier` | Pas encore de premier | No leader yet |
| `course.fantome.personneDevant` | Personne devant toi | Nobody ahead of you |
| `course.depart` | PARTEZ ! | GO! |
| `course.arrivee` | ARRIVÉE | FINISH |
| `course.chute` | Chute ! | Fall! |
| `course.chronoTourne.tactile` | Le chrono tourne : GAZ, en bas à droite | The clock is running: GAS, bottom right |
| `course.chronoTourne.clavier` | Le chrono tourne : ↑ ou Z pour accélérer | The clock is running: ↑ or W to accelerate |
| `course.camera.proche` | Caméra proche | Close camera |
| `course.camera.loin` | Caméra loin | Far camera |
| `course.camera.capot` | Caméra capot | Hood camera |
| `course.camera.bouton` | Caméra : {nom} | Camera: {nom} |
| `course.camera.nom.proche` | proche | close |
| `course.camera.nom.loin` | loin | far |
| `course.camera.nom.capot` | capot | hood |
| `course.camera.libre` | Caméra libre : glisse pour tourner, molette ou pincement pour zoomer | Free camera: drag to turn, wheel or pinch to zoom |
| `course.effet.moteurCoupe` | Moteur coupé | Engine cut |
| `course.effet.superTurbo` | Super turbo | Super turbo |
| `course.effet.turbo` | Turbo | Turbo |
| `course.sol.dirt` | Terre | Dirt |
| `course.sol.ice` | Glace | Ice |
| `course.sol.grass` | Herbe | Grass |
| `course.sol.sand` | Sable | Sand |
| `course.sol.gravel` | Gravier | Gravel |
| `course.sol.snow` | Neige poudreuse | Powder snow |

### Erreurs (`erreur.*`, `apps/web/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `erreur.local.network` | Serveur injoignable. | Server unreachable. |
| `erreur.local.timeout` | Le serveur ne répond pas. | The server isn't answering. |
| `erreur.local.http_error` | Le serveur a répondu par une erreur. | The server answered with an error. |
| `erreur.local.inconnue` | Quelque chose n'a pas marché. | Something went wrong. |

### Ligne à partager (`lignePartage.*`, `apps/web/src/catalogue.course.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `lignePartage.titre` | Du Jour · Track #{numero} | Du Jour · Track #{numero} |
| `lignePartage.titreSansNumero` | Du Jour · Track {date} | Du Jour · Track {date} |

### Miniatures (`miniature.*`, `apps/web/src/catalogue.course.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `miniature.alt` | Vue aérienne du circuit du {date} | Aerial view of the track of {date} |

### Mots communs (`commun.*`, `apps/web/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `commun.reessayer` | Réessayer | Try again |
| `commun.valider` | Valider | Confirm |
| `commun.toi` | Toi | You |

### Page (titre, chargement) (`page.*`, `apps/web/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `page.titre` | Track — Du Jour | Track — Du Jour |
| `page.description` | Un circuit court par jour, le même pour tout le monde : une minute dans le navigateur, un fantôme à battre, un résultat à partager. | One short track a day, the same for everyone: a minute in your browser, a ghost to beat, a result to share. |
| `page.sansJs` | Track a besoin de JavaScript. | Track needs JavaScript. |

### Palmarès (`palmares.*`, `apps/web/src/catalogue.accueil.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `palmares.titre` | Classement | Leaderboard |
| `palmares.titreJour` | Classement du jour | Today's leaderboard |
| `palmares.titreFige` | Classement figé · {date} | Frozen leaderboard · {date} |
| `palmares.court` | Classement | Leaderboard |
| `palmares.sousTitre` | one : {theme} · {n} classé · other : {theme} · {n} classés | one : {theme} · {n} ranked · other : {theme} · {n} ranked |
| `palmares.titreEtPilotes` | one : {titre} · {n} pilote · other : {titre} · {n} pilotes | one : {titre} · {n} driver · other : {titre} · {n} drivers |
| `palmares.titreSansPilote` | {titre} : personne | {titre}: nobody |
| `palmares.charge` | Chargement du classement… | Loading the leaderboard… |
| `palmares.vide` | Personne n'a encore de temps aujourd'hui : sois le premier ! | Nobody has a time yet today: be the first! |
| `palmares.sansServeur` | Pas de classement ici : ce jeu n'est pas relié à un serveur. Tu peux jouer, ton record reste sur cet appareil. | No leaderboard here: this game isn't connected to a server. You can still race, your record stays on this device. |
| `palmares.horsLigne` | Hors ligne : le serveur ne répond pas. Tu peux jouer, la course ne sera pas classée. | Offline: the server isn't answering. You can still race, but the run won't be ranked. |
| `palmares.erreur` | {erreur} Tu peux jouer quand même : la course ne sera classée que si le serveur répond. | {erreur} You can still race: the run is only ranked if the server answers. |
| `palmares.toi` | toi | you |
| `palmares.revoir` | Revoir le meilleur tour | Watch the best lap |
| `palmares.tout` | Tout le classement | Full leaderboard |
| `palmares.replier` | Replier le classement | Fold the leaderboard |
| `palmares.deplier` | Déplier le classement | Unfold the leaderboard |
| `palmares.ecran.aria` | Classement du jour | Today's leaderboard |

### Partage de la journée (`partage.*`, `apps/web/src/catalogue.course.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `partage.copier` | Copier | Copy |
| `partage.copie` | Copié | Copied |
| `partage.partager` | Partager | Share |
| `partage.champ` | Copie impossible ici : copie ce message (Ctrl+C) | Can't copy here: copy this message (Ctrl+C) |

### Pause (`pause.*`, `apps/web/src/catalogue.course.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `pause.titre` | Pause | Pause |
| `pause.info.circuit` | Circuit {numero} · {theme} | Track {numero} · {theme} |
| `pause.info.circuitSansNumero` | {theme} | {theme} |
| `pause.info.record` | record | record |
| `pause.reprendre` | Reprendre | Resume |
| `pause.recommencer` | Recommencer | Restart |
| `pause.pointDeControle` | Dernier point de contrôle | Last checkpoint |
| `pause.fantome` | Fantôme · {nom} | Ghost · {nom} |
| `pause.son.actif` | Son : activé | Sound: on |
| `pause.son.coupe` | Son : coupé | Sound: off |
| `pause.reglages` | Réglages | Settings |
| `pause.aide` | Comment jouer | How to play |
| `pause.archives` | Archives | Archives |
| `pause.accueil` | Accueil de Track | Track home |
| `pause.mentions` | Mentions légales et confidentialité | Legal notice and privacy |
| `pause.quitter` | Quitter cette course ? Le tour en cours ne sera pas enregistré. | Leave this run? The lap in progress won't be saved. |
| `pause.rester` | Rester | Stay |
| `pause.retourAccueil` | Retour à l'accueil | Back to home |

### Podium du Salon (`podium.*`, `apps/web/src/catalogue.salon.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `podium.titre` | Salon {heure} · terminé | Room {heure} · over |
| `podium.aucun` | Personne n'a terminé de tour. | Nobody finished a lap. |
| `podium.indisponible` | Classement indisponible. | Leaderboard unavailable. |
| `podium.maPlace` | Ta place : {rang} sur {total} · {temps} | Your place: {rang} of {total} · {temps} |
| `podium.sansTemps` | Tu n'as pas de temps dans cette session. | You have no time in this session. |
| `podium.suivant` | Circuit suivant dans | Next track in |
| `podium.aria` | Résultats du Salon | Room results |

### Réglages (`reglages.*`, `apps/web/src/catalogue.reglages.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `reglages.titre` | Réglages | Settings |
| `reglages.sections` | Sections des réglages | Settings sections |
| `reglages.onglet.graphics` | Graphismes | Graphics |
| `reglages.onglet.sound` | Son | Sound |
| `reglages.onglet.game` | Jeu | Game |
| `reglages.onglet.controls` | Commandes | Controls |
| `reglages.oui` | Oui | Yes |
| `reglages.non` | Non | No |
| `reglages.qualite.nom` | Qualité | Quality |
| `reglages.qualite.aide` | Automatique : le jeu baisse seul les détails s'il ramerait, et les remonte ensuite. | Automatic: the game lowers details by itself if it would lag, then raises them again. |
| `reglages.qualite.auto` | Automatique | Automatic |
| `reglages.qualite.low` | Basse | Low |
| `reglages.qualite.medium` | Moyenne | Medium |
| `reglages.qualite.high` | Haute | High |
| `reglages.qualite.niveau.0` | basse | low |
| `reglages.qualite.niveau.1` | moyenne | medium |
| `reglages.qualite.niveau.2` | haute | high |
| `reglages.qualite.actuelle` | Niveau actuel : {niveau}. | Current level: {niveau}. |
| `reglages.qualite.adresse` | La qualité est imposée par l'adresse de la page (?quality=). | Quality is set by the page address (?quality=). |
| `reglages.particules.nom` | Particules | Particles |
| `reglages.particules.aide` | Fumée, poussière, étincelles, flammes, confettis. | Smoke, dust, sparks, flames, confetti. |
| `reglages.traces.nom` | Traces de pneus | Tyre marks |
| `reglages.secousses.nom` | Secousses de caméra | Camera shake |
| `reglages.secousses.aide` | Chocs, réceptions et vibreurs. | Hits, landings and kerbs. |
| `reglages.sensation.nom` | Sensation de vitesse | Sense of speed |
| `reglages.sensation.aide` | Champ de vision qui s'ouvre, lignes de vitesse, vibration à très haute vitesse. | Widening field of view, speed lines, shaking at very high speed. |
| `reglages.sensation.off` | Aucune | None |
| `reglages.sensation.soft` | Douce | Soft |
| `reglages.sensation.normal` | Normale | Normal |
| `reglages.sensation.strong` | Forte | Strong |
| `reglages.ombres.nom` | Ombres | Shadows |
| `reglages.ombres.aide` | Ombres portées de la voiture (qualité moyenne et haute). | The car's cast shadow (medium and high quality). |
| `reglages.son.muet.nom` | Muet | Mute |
| `reglages.son.muet.aide` | La touche M fait de même. | The M key does the same. |
| `reglages.son.avec` | Son | Sound |
| `reglages.son.volume` | Volume général | Master volume |
| `reglages.son.moteur` | Moteur | Engine |
| `reglages.son.effets.nom` | Effets | Effects |
| `reglages.son.effets.aide` | Crissements, roulement, vent, bruitages. | Skids, rolling, wind, sound effects. |
| `reglages.son.ambiance.nom` | Ambiance | Ambience |
| `reglages.son.ambiance.aide` | Le fond sonore du thème du jour. | The background sound of today's theme. |
| `reglages.camera.nom` | Caméra par défaut | Default camera |
| `reglages.camera.aide` | Au départ ; la touche C ou le bouton caméra la change aussi. | At the start; the C key or the camera button changes it too. |
| `reglages.camera.proche` | Proche | Close |
| `reglages.camera.loin` | Loin | Far |
| `reglages.camera.capot` | Capot | Hood |
| `reglages.fantome.nom` | Fantôme affiché | Ghost shown |
| `reglages.fantome.aide` | Au prochain départ. Le premier et le joueur devant demandent le classement. | From the next start. The first and the driver ahead need the leaderboard. |
| `reglages.fantome.mine` | Mon record | My record |
| `reglages.fantome.first` | Le premier | The first |
| `reglages.fantome.ahead` | Le joueur devant | The driver ahead |
| `reglages.fantome.none` | Aucun | None |
| `reglages.classement.nom` | Classement en course | Leaderboard in the race |
| `reglages.classement.aide` | Affiché dans un coin ; la touche L le replie. | Shown in a corner; the L key folds it. |
| `reglages.temps.nom` | Temps intermédiaires | Split times |
| `reglages.temps.aide` | Ton temps à chaque point de contrôle, comparé au fantôme. | Your time at each checkpoint, against the ghost. |
| `reglages.unite.nom` | Unité de vitesse | Speed unit |
| `reglages.clavier` | Clavier | Keyboard |
| `reglages.manette` | Manette | Gamepad |
| `reglages.tactile.titre` | Commandes tactiles | Touch controls |
| `reglages.tactile.absent` | Sur un téléphone ou une tablette, les réglages des commandes tactiles (direction, sensibilité, taille des boutons, accélérateur automatique, vibration) apparaissent ici. | On a phone or a tablet, the touch controls settings (steering, sensitivity, button size, automatic throttle, vibration) show up here. |
| `reglages.aide` | Comment jouer | How to play |
| `reglages.langue.titre` | Langue | Language |
| `reglages.profil` | Mon profil Du Jour | My Du Jour profile |
| `reglages.mentions` | Mentions légales | Legal notice |
| `reglages.reinit` | Rétablir les réglages par défaut | Reset settings to default |

### Revoir le meilleur tour (`revoir.*`, `apps/web/src/catalogue.salon.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `revoir.titre` | Rediffusion de {nom} — {temps} | Replay of {nom} — {temps} |
| `revoir.barre` | Lecture du tour | Lap playback |
| `revoir.progression` | Progression du tour | Lap progress |
| `revoir.pause` | Pause | Pause |
| `revoir.reprendre` | Reprendre | Resume |
| `revoir.retour` | Retour de {n} secondes | Back {n} seconds |
| `revoir.retourCourt` | −{n} s | −{n} s |
| `revoir.vitesse` | Vitesse {vitesse} | Speed {vitesse} |
| `revoir.vitesses` | Vitesse de lecture | Playback speed |
| `revoir.cameraActive` | Caméra : {nom} (C) | Camera: {nom} (C) |
| `revoir.cameras.proche` | proche | close |
| `revoir.cameras.loin` | loin | far |
| `revoir.cameras.capot` | capot | hood |
| `revoir.cameras.libre` | libre | free |
| `revoir.touches` | Espace ou P : pause · ← : retour 5 s · → : avance 5 s · 1 2 3 4 : vitesse ¼ ½ 1 2 · C : caméra (libre : glisser, molette) · Entrée : depuis le début | Space or P: pause · ←: back 5 s · →: forward 5 s · 1 2 3 4: speed ¼ ½ 1 2 · C: camera (free: drag, wheel) · Enter: from the start |
| `revoir.arrivee.titre` | Rediffusion | Replay |
| `revoir.arrivee.rejouer` | Rejouer la rediffusion | Watch the replay again |
| `revoir.arrivee.courir` | Courir contre ce fantôme | Race this ghost |
| `revoir.arrivee.aide` | Entrée : rejouer la rediffusion | Enter: watch the replay again |
| `revoir.arrivee.temps` | Temps de la rediffusion | Replay time |
| `revoir.illisible` | Rediffusion illisible : course normale | Replay unreadable: normal race |
| `revoir.aucune` | Aucun tour à revoir : course normale | No lap to watch: normal race |
| `revoir.premierNom` | le premier | the leader |

### Salon (`salon.*`, `apps/web/src/catalogue.salon.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `salon.titre` | Salon | Room |
| `salon.circuit` | Salon {heure} · {theme} | Room {heure} · {theme} |
| `salon.compte.legende` | Suivant dans | Next in |
| `salon.compte.derniere` | Dernière chance | Last chance |
| `salon.compte.joueurs` | one : {n} joueur · other : {n} joueurs | one : {n} player · other : {n} players |
| `salon.finale.derniere` | Dernière chance : plus de départ | Last chance: no more starts |
| `salon.circuit.indisponible` | Circuit indisponible, nouvel essai… | Track unavailable, trying again… |
| `salon.depasse` | {nom} t'a dépassé | {nom} passed you |
| `salon.attente` | En attente du premier temps de la session… | Waiting for the first time of the session… |
| `salon.fantomes.all` | tous les fantômes | all ghosts |
| `salon.fantomes.top` | les premiers seulement | top ghosts only |
| `salon.fantomes.off` | aucun fantôme | no ghosts |
| `salon.tonTour` | Ton tour | Your lap |
| `salon.premier` | premier : {nom} | first: {nom} |
| `salon.boot.sansServeur` | Le Salon a besoin du serveur | The Room needs the server |
| `salon.boot.sansSalon` | Le Salon a besoin du serveur (cette API n'a pas de Salon) | The Room needs the server (this API has no Room) |
| `salon.boot.injoignable` | Salon injoignable : {raison} | Room unreachable: {raison} |
| `salon.boot.circuit` | Le circuit de cette session n'a pas pu être préparé | This session's track couldn't be prepared |
| `salon.boot.repli` | {raison} : circuit du jour à la place | {raison}: today's track instead |
| `salon.classement.chargement` | Salon {heure} · classement en chargement… | Room {heure} · loading the leaderboard… |
| `salon.classement.vide` | Salon {heure} · personne n'a encore de temps | Room {heure} · no time yet |
| `salon.classement.titre` | Salon {heure} · {classes} · {presents} | Room {heure} · {classes} · {presents} |
| `salon.classement.classes` | one : {n} classé · other : {n} classés | one : {n} ranked · other : {n} ranked |
| `salon.classement.presents` | one : {n} présent · other : {n} présents | one : {n} here · other : {n} here |
| `salon.partage.titre` | Salon {heure} | Room {heure} |
| `salon.arrivee.titre` | Arrivée | Finish |
| `salon.arrivee.meilleur` | Meilleur tour de la session | Best lap of the session |
| `salon.arrivee.precedent` | Ton meilleur : {temps} ({ecart}) | Your best: {temps} ({ecart}) |
| `salon.arrivee.nonClassee` | Réglages modifiés : course non classée | Settings changed: run not ranked |
| `salon.arrivee.reprises` | one : {n} reprise au point de contrôle · other : {n} reprises au point de contrôle | one : {n} respawn at a checkpoint · other : {n} respawns at a checkpoint |
| `salon.arrivee.sansReprise` | Sans reprise | No respawn |
| `salon.arrivee.rang` | {rang} sur {total} | {rang} of {total} |
| `salon.arrivee.rangLegende` | Classement de la session | Session leaderboard |
| `salon.arrivee.tempsServeur` | temps du serveur : {temps} | server time: {temps} |
| `salon.arrivee.envoi` | Envoi au classement de la session… | Sending to the session leaderboard… |
| `salon.arrivee.tropTard` | Trop tard : cette session est terminée | Too late: this session is over |
| `salon.arrivee.pseudo` | Choisis ton pseudo pour entrer au classement du Salon | Pick a name to enter the Room leaderboard |
| `salon.arrivee.pseudoChamp` | Ton pseudo | Your name |
| `salon.arrivee.pseudoInvalide` | 1 à 20 caractères : lettres, chiffres, espace . _ ' - | 1 to 20 characters: letters, digits, space . _ ' - |
| `salon.arrivee.chargerCode` | Charger un code | Load a code |
| `salon.arrivee.rejouer` | Rejouer | Race again |
| `salon.arrivee.revoir` | Revoir le meilleur tour | Watch the best lap |
| `salon.arrivee.accueil` | Accueil de Track | Track home |
| `salon.arrivee.aide` | Entrée : rejouer · Tab : classement | Enter: race again · Tab: leaderboard |
| `salon.arrivee.terminee` | Session terminée | Session over |
| `salon.arrivee.nonCompte` | Session terminée : tour non compté | Session over: lap not counted |

### Thèmes (`theme.*`, `apps/web/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `theme.stade` | Stade | Stadium |
| `theme.rallye` | Rallye | Rally |
| `theme.banquise` | Banquise | Ice floe |
| `theme.nuit` | Nuit | Night |
| `theme.campagne` | Campagne | Countryside |
| `theme.canyon` | Canyon | Canyon |
| `theme.col` | Col alpin | Mountain pass |
| `theme.ville` | Ville | City |

## Jump

### Accueil (`accueil.*`, `apps/jump/src/catalogue.accueil.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `accueil.aria` | Accueil de Jump | Jump home |
| `accueil.niveau` | Niveau {numero} · {theme} | Level {numero} · {theme} |
| `accueil.niveauDate` | Niveau du {date} · {theme} | Level of {date} · {theme} |
| `accueil.accroche` | Un niveau de plateformes par jour, le même pour tous. | One platform level a day, the same for everyone. |
| `accueil.record.legende` | Ton record | Your best |
| `accueil.record.pasEncore` | Pas encore | Not yet |
| `accueil.record.vise` | {medaille} à {temps} | {medaille} at {temps} |
| `accueil.record.auteurBattu` | Temps de l'auteur battu | Author time beaten |
| `accueil.serie.legende` | Série Jump | Jump streak |
| `accueil.serie.jours` | one : {n} jour · other : {n} jours | one : {n} day · other : {n} days |
| `accueil.serie.medailles` | one : {n} médaille · other : {n} médailles | one : {n} medal · other : {n} medals |
| `accueil.jouer` | JOUER | PLAY |
| `accueil.continuer` | CONTINUER | CONTINUE |
| `accueil.rejouer` | REJOUER | PLAY AGAIN |
| `accueil.archives` | Archives | Archives |
| `accueil.aide` | Comment jouer | How to play |
| `accueil.reglages` | Réglages | Settings |
| `accueil.carnage.morts` | one : {total} mort · other : {total} morts | one : {total} death · other : {total} deaths |
| `accueil.carnage.tous` | aujourd'hui, tous joueurs | today, all players |
| `accueil.carnage.aucun` | Personne n'est encore mort aujourd'hui. Ça ne va pas durer. | Nobody has died yet today. That won't last. |
| `accueil.carnage.voir` | Voir le carnage | Watch the carnage |
| `accueil.classement.titre` | Classement du jour | Today's leaderboard |
| `accueil.classement.tout` | Tout le classement › | Full leaderboard › |
| `accueil.classement.vide` | Personne n'est encore classé. La place est chaude. | Nobody's ranked yet. The seat is warm. |
| `accueil.prochain` | Prochain niveau dans {temps} | Next level in {temps} |
| `accueil.profil` | Mon profil Du Jour › | My Du Jour profile › |
| `accueil.etat.pasJoue` | Pas encore joué | Not played yet |
| `accueil.etat.enCours` | Pas encore d'arrivée · {morts} · {essais} | No finish yet · {morts} · {essais} |
| `accueil.etat.fini` | {medaille}Meilleur : {temps} · {morts} | {medaille}Best: {temps} · {morts} |

### Aperçu de partage (quand on colle le lien) (`apercu.*`, `apps/jump/src/catalogue.apercu.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `apercu.titre` | Jump — Du Jour | Jump — Du Jour |
| `apercu.description` | Un niveau par jour, le même pour tous. Les scies tournent déjà. Tu vas mourir. Beaucoup. | One level a day, the same for everyone. The saws are already spinning. You will die. A lot. |
| `apercu.image` | L'étiquette jaune de Jump : JUMP, le petit personnage carré et une scie. | The yellow Jump label: JUMP, the little square character and a saw. |

### Archives (`archives.*`, `apps/jump/src/catalogue.accueil.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `archives.aria` | Archives | Archives |
| `archives.titre` | ARCHIVES | ARCHIVES |
| `archives.intro` | Les niveaux des jours passés : rejouables, jamais classés. Ta série ne bouge pas. | Past days' levels: replayable, never ranked. Your streak doesn't move. |
| `archives.vide` | Pas encore d'archives : elles commencent le lendemain du niveau n° 1. | No archives yet: they start the day after level #1. |
| `archives.sousTitre` | {date} · {theme} | {date} · {theme} |
| `archives.pasJoue` | pas joué | not played |
| `archives.pasArrivee` | pas d'arrivée · {morts} | no finish · {morts} |

### Arrivée (`arrivee.*`, `apps/jump/src/catalogue.arrivee.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `arrivee.aria` | Arrivée | Finish |
| `arrivee.titre` | ARRIVÉE ! | FINISH! |
| `arrivee.mode.archive` | Archive du {date} : ne compte pas dans ta série | Archive of {date}: doesn't count for your streak |
| `arrivee.mode.futur` | À venir (aperçu) : ne compte pas dans ta série | Upcoming (preview): doesn't count for your streak |
| `arrivee.tonTemps` | Ton temps | Your time |
| `arrivee.morts` | one : mort · other : morts | one : death · other : deaths |
| `arrivee.medaille.author` | Temps de l'auteur battu ! | Author time beaten! |
| `arrivee.medaille.gold` | Médaille d'or | Gold medal |
| `arrivee.medaille.silver` | Médaille d'argent | Silver medal |
| `arrivee.medaille.bronze` | Médaille de bronze | Bronze medal |
| `arrivee.medaille.aucune` | Pas de médaille | No medal |
| `arrivee.prochaine` | {medaille} à | {medaille} at |
| `arrivee.record` | Nouveau record du jour ! | New best of the day! |
| `arrivee.meilleur` | Meilleur du jour : {temps} | Today's best: {temps} |
| `arrivee.classement` | Classement du jour | Today's leaderboard |
| `arrivee.rejouer` | REJOUER | PLAY AGAIN |
| `arrivee.carnage` | Voir le carnage | Watch the carnage |
| `arrivee.partager` | Partager | Share |
| `arrivee.toutLeMonde` | Le carnage de tout le monde | Everyone's carnage |
| `arrivee.premier` | Regarder le premier ({nom}) | Watch first place ({nom}) |
| `arrivee.accueil` | Accueil de Jump | Jump home |
| `arrivee.classementTout` | Tout le classement › | Full leaderboard › |
| `arrivee.legendeSuite` | Il te reste aujourd'hui | Still to play today |
| `arrivee.sansFaute` | Essai sans faute | Flawless run |
| `arrivee.mortsEssai` | {morts} dans cet essai | {morts} in this run |
| `arrivee.jour` | {morts} aujourd'hui · {essais} | {morts} today · {essais} |
| `arrivee.serie.jour` | Série : {jours} | Streak: {jours} |
| `arrivee.serie.archive` | Archive : ne compte pas dans ta série | Archive: doesn't count for your streak |
| `arrivee.serie.apercu` | Aperçu : ne compte pas dans ta série | Preview: doesn't count for your streak |
| `arrivee.pseudo` | Ton pseudo | Your name |
| `arrivee.pseudo.ok` | OK | OK |
| `arrivee.partage.ok` | Partagé | Shared |
| `arrivee.partage.copie` | Copié dans le presse-papiers | Copied to the clipboard |
| `arrivee.partage.echec` | Copie impossible : sélectionne le texte ci-dessous | Couldn't copy: select the text below |
| `arrivee.aideClavier` | R : rejouer | R: play again |
| `arrivee.phrase.zero` | Zéro mort. On va vérifier que tu n'as pas triché. | Zero deaths. We'll be checking for cheats. |
| `arrivee.phrase.peu` | one : Une seule mort. Les pics sont vexés. · other : {morts} morts. Presque propre. Presque. | one : One death. The spikes are offended. · other : {morts} deaths. Almost clean. Almost. |
| `arrivee.phrase.moyen` | {morts} morts. Le niveau commence à te connaître. | {morts} deaths. The level is starting to know you. |
| `arrivee.phrase.beaucoup` | {morts} morts. La scie te remercie pour ta fidélité. | {morts} deaths. The saw thanks you for your loyalty. |
| `arrivee.phrase.carnage` | {morts} morts. À ce stade, c'est toi le décor. | {morts} deaths. At this point, you're part of the scenery. |

### Bandeaux (`bandeau.*`, `apps/jump/src/catalogue.partie.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `bandeau.aria` | Arrivée | Finish |
| `bandeau.arrivee` | Arrivée ! | Finish! |
| `bandeau.rediffusion` | Rediffusion | Replay |
| `bandeau.solution` | Solution | Solution |
| `bandeau.rediffAuteur` | Rediffusion de l'auteur | Author's replay |
| `bandeau.rediffPremier` | Rediffusion du premier : {nom} | First place's replay: {nom} |
| `bandeau.essaiTitre` | Arrivée · essai {theme} | Finish · {theme} trial |
| `bandeau.essaiRef` | Essai du thème {theme} : rien n'est enregistré · Temps de l'auteur : {temps} | {theme} theme trial: nothing is saved · Author time: {temps} |
| `bandeau.sansMedaille` | Pas de médaille (bronze : {temps}) | No medal (bronze: {temps}) |
| `bandeau.medailleAuteur` | {medaille} · Temps de l'auteur : {auteur} | {medaille} · Author time: {auteur} |
| `bandeau.solutionRef` | Solution : {temps} | Solution: {temps} |
| `bandeau.solutionCouloir` | Solution : {temps} (couloir compris) | Solution: {temps} (run-up included) |
| `bandeau.solutionAucune` | Solution : — | Solution: — |
| `bandeau.meilleur` | Meilleur du jour : {temps} | Today's best: {temps} |
| `bandeau.meilleurAucun` | Meilleur du jour : — | Today's best: — |
| `bandeau.meilleurModifie` | Meilleur : — (réglages modifiés) | Best: — (tuned settings) |
| `bandeau.morts` | Morts : {n} · {essai} | Deaths: {n} · {essai} |
| `bandeau.sansFaute` | essai sans faute | flawless run |
| `bandeau.mortsEssai` | {n} dans cet essai | {n} in this run |
| `bandeau.recommencer` | Recommencer | Restart |
| `bandeau.suivant` | Morceau suivant | Next piece |
| `bandeau.aide` | R, ou touche le bandeau | R, or tap the banner |

### Cadre des écrans (`cadre.*`, `apps/jump/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `cadre.retourJump` | Retour à l'accueil de Jump | Back to Jump's home |

### Carnage (`carnage.*`, `apps/jump/src/catalogue.partie.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `carnage.titre` | CARNAGE | CARNAGE |
| `carnage.vies` | one : {n} vie · other : {n} vies | one : {n} life · other : {n} lives |
| `carnage.arrivees` | one : {n} arrivée · other : {n} arrivées | one : {n} finish · other : {n} finishes |
| `carnage.joueurs` | one : {n} joueur · other : {n} joueurs | one : {n} player · other : {n} players |
| `carnage.compteur` | {vies} · {arrivees} | {vies} · {arrivees} |
| `carnage.toutLeMonde` | {vies} de {joueurs} | {vies} from {joueurs} |
| `carnage.vague` | VAGUE | WAVE |
| `carnage.vagueValeur` | {n} / {total} | {n} / {total} |
| `carnage.vagueAria` | Vague {n} sur {total} | Wave {n} of {total} |
| `carnage.precedente` | Vague précédente | Previous wave |
| `carnage.suivante` | Vague suivante | Next wave |
| `carnage.pause` | Pause | Pause |
| `carnage.lecture` | Reprendre la lecture | Resume playback |
| `carnage.avancement` | Avancement : vague {n} sur {total} | Progress: wave {n} of {total} |
| `carnage.fermer` | Fermer | Close |
| `carnage.aide` | Une commande pour passer | Any input to skip |

### Classement (`classement.*`, `apps/jump/src/catalogue.accueil.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `classement.aria` | Classement du jour | Today's leaderboard |
| `classement.titre` | CLASSEMENT | LEADERBOARD |
| `classement.sousTitre` | {theme} · {classes} | {theme} · {classes} |
| `classement.col.rang` | # | # |
| `classement.col.pseudo` | Pseudo | Name |
| `classement.col.medaille` | Médaille | Medal |
| `classement.col.temps` | Temps | Time |
| `classement.toi` | Toi | You |
| `classement.sansMedaille` | Pas de médaille | No medal |
| `classement.vide` | Personne n'est encore classé aujourd'hui. | Nobody's ranked today yet. |
| `classement.sansServeur` | Le classement a besoin du serveur. | The leaderboard needs the server. |

### Commandes (`commandes.*`, `apps/jump/src/catalogue.reglages.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `commandes.clavier.courir` | ← → ou Q D : courir | ← → or A D: run |
| `commandes.clavier.sauter` | Espace, ↑ ou Z : sauter | Space, ↑ or W: jump |
| `commandes.clavier.recommencer` | R : recommencer | R: restart |
| `commandes.clavier.pause` | Échap ou P : pause | Esc or P: pause |
| `commandes.clavier.fantome` | G : fantôme | G: ghost |
| `commandes.manette.courir` | Stick ou croix : courir | Stick or D-pad: run |
| `commandes.manette.sauter` | A ou B : sauter | A or B: jump |
| `commandes.manette.recommencer` | Select : recommencer | Select: restart |
| `commandes.manette.pause` | Start : pause | Start: pause |
| `commandes.tactile.direction` | Gauche et droite : en bas à gauche | Left and right: bottom left |
| `commandes.tactile.saut` | SAUT : en bas à droite | JUMP: bottom right |
| `commandes.tactile.pause` | Pause en haut à gauche : recommencer, fantôme, son | Pause, top left: restart, ghost, sound |

### Commandes tactiles (`tactile.*`, `apps/jump/src/catalogue.partie.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `tactile.gauche` | Gauche | Left |
| `tactile.droite` | Droite | Right |
| `tactile.saut` | SAUT | JUMP |
| `tactile.saut.aria` | Saut | Jump |
| `tactile.zone.bande` | bande | band |

### Comment jouer (`aide.*`, `apps/jump/src/catalogue.partie.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `aide.aria` | Comment jouer | How to play |
| `aide.titre` | COMMENT JOUER | HOW TO PLAY |
| `aide.point1` | Va jusqu'au drapeau. Le chrono part à ta première commande. | Get to the flag. The clock starts with your first move. |
| `aide.point2` | Tu vas mourir. C'est gratuit : on repart aussitôt, depuis le dernier fanion. | You'll die. It's free: you're back at once, at the last checkpoint flag. |
| `aide.point3` | Tiens le saut pour monter plus haut. Contre un mur, saute : tu rebondis. | Hold jump to go higher. Against a wall, jump: you bounce off. |
| `aide.parti` | C'est parti | Let's go |
| `aide.schema.legende` | À gauche, la direction ; à droite, le saut. Le milieu de l'écran reste au jeu. | Left side: direction. Right side: jump. The middle of the screen belongs to the game. |
| `aide.zone.libre` | le jeu | the game |

### Erreurs (`erreur.*`, `apps/jump/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `erreur.local.reseau` | Classement indisponible | Leaderboard unavailable |
| `erreur.local.trop_envois` | Trop d'envois : nouvel essai dans un moment. | Too many submissions: trying again in a moment. |
| `erreur.local.version` | Une nouvelle version du jeu est disponible : recharge la page pour être classé. | A new version of the game is out: reload the page to get ranked. |
| `erreur.local.network` | Le serveur ne répond pas. | The server isn't answering. |
| `erreur.local.timeout` | Le serveur met trop de temps à répondre. | The server is taking too long to answer. |
| `erreur.local.inconnue` | Quelque chose n'a pas marché. Réessaie plus tard. | Something went wrong. Try again later. |

### Fantômes (`fantome.*`, `apps/jump/src/catalogue.partie.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `fantome.premier` | {nom} · {rang} | {nom} · {rang} |

### Jour (`jour.*`, `apps/jump/src/catalogue.partie.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `jour.titre` | Jump {numero} | Jump {numero} |
| `jour.archive` | archive du {date} | archive of {date} |
| `jour.futur` | à venir ({date}) | upcoming ({date}) |
| `jour.essai` | essai de thème ({date}) : rien n'est enregistré | theme trial ({date}): nothing is saved |
| `jour.apercu` | aperçu | preview |
| `jour.refuse` | Ce niveau n'est pas encore sorti | This level isn't out yet |
| `jour.nouveau` | Nouveau niveau disponible : recommence pour l'ouvrir | New level out: restart to open it |

### Ligne à partager (`lignePartage.*`, `apps/jump/src/catalogue.arrivee.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `lignePartage.titre` | Du Jour · Jump #{numero} | Du Jour · Jump #{numero} |
| `lignePartage.titreSansNumero` | Du Jour · Jump {date} | Du Jour · Jump {date} |
| `lignePartage.archive` | (archive) | (archive) |
| `lignePartage.futur` | (à venir) | (upcoming) |

### Messages courts (`toast.*`, `apps/jump/src/catalogue.partie.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `toast.pointDePassage` | Point de passage | Checkpoint |
| `toast.finDemo` | Fin de la démonstration | End of the demo |
| `toast.demoEssai` | Démonstration : seulement sur ?scenario=essai | Demo: only on ?scenario=essai |
| `toast.rediffAuteur` | Rediffusion de l'auteur | Author's replay |
| `toast.pasDeSolution` | Pas de solution stockée pour ce morceau | No stored solution for this piece |
| `toast.solution` | Solution du morceau | Piece solution |
| `toast.pasDeMeilleur` | Pas encore de meilleur essai aujourd'hui : à toi de jouer | No best run today yet: your turn |
| `toast.personneClasse` | Personne n'est encore classé ce jour-là : à toi de jouer | Nobody's ranked that day yet: your turn |
| `toast.premierIndisponible` | Fantôme du premier indisponible : à toi de jouer | First place's ghost unavailable: your turn |
| `toast.rediffPremier` | Rediffusion de {nom}, premier du jour | Replay of {nom}, today's first |
| `toast.rediffMeilleur` | Rediffusion de ton meilleur essai | Replay of your best run |
| `toast.fantome.oui` | Fantôme : montré | Ghost: shown |
| `toast.fantome.non` | Fantôme : caché | Ghost: hidden |

### Mots communs (`commun.*`, `apps/jump/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `commun.morts` | one : {n} mort · other : {n} morts | one : {n} death · other : {n} deaths |
| `commun.essais` | one : {n} essai · other : {n} essais | one : {n} attempt · other : {n} attempts |
| `commun.oui` | Oui | On |
| `commun.non` | Non | Off |
| `commun.montrer` | Montrer | Show |
| `commun.cacher` | Cacher | Hide |
| `commun.citation` | « {texte} » | “{texte}” |
| `commun.recharger` | Recharger | Reload |
| `commun.version` | sim v{sim} · {jour} | sim v{sim} · {jour} |
| `commun.versionDebug` | Jump · sim v{sim} · {jour} | Jump · sim v{sim} · {jour} |

### Outils (`outil.*`, `apps/jump/src/catalogue.partie.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `outil.module` | {id} · variante {variante} · {entree} | {id} · variant {variante} · {entree} |
| `outil.module.solution` | Solution · {id} · variante {variante} · {entree} | Solution · {id} · variant {variante} · {entree} |
| `outil.entree.elan` | élan | run-up |
| `outil.entree.arret` | arrêt | standing |

### Page (titre, chargement) (`page.*`, `apps/jump/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `page.titre` | Jump — Du Jour | Jump — Du Jour |
| `page.description` | Jump : un niveau de plateformes court et brutal par jour, le même pour tout le monde. Tu vas mourir. Beaucoup. | Jump: one short, brutal platform level a day, the same for everyone. You will die. A lot. |
| `page.preparation` | Préparation du niveau… | Building the level… |
| `page.sansWebgl` | WebGL n'est pas disponible dans ce navigateur : Jump ne peut pas s'afficher. | WebGL isn't available in this browser: Jump can't be shown. |

### Partie (surimpressions) (`hud.*`, `apps/jump/src/catalogue.partie.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `hud.aria` | Partie en cours | Game in progress |
| `hud.pause.aria` | Pause | Pause |
| `hud.pc.aria` | Point de passage {pc} sur {total} | Checkpoint {pc} of {total} |
| `hud.ecart.aria` | Écart avec ton record : {ecart} | Gap to your best: {ecart} |
| `hud.objectif.aria` | Médaille visée : {medaille}, {temps} | Target medal: {medaille}, {temps} |
| `hud.objectif.auteurBattu` | Auteur battu | Author beaten |
| `hud.mode.archive` | Archive | Archive |
| `hud.mode.essai` | Essai · {theme} | Trial · {theme} |
| `hud.reglagesModifies` | réglages modifiés : rien n'est enregistré | tuned settings: nothing is saved |
| `hud.gear.aria` | Réglages du personnage | Character settings |
| `hud.tourner` | Tourne ton téléphone : Jump se joue mieux en paysage | Turn your phone: Jump plays better in landscape |

### Pause (`pause.*`, `apps/jump/src/catalogue.partie.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `pause.aria` | Pause | Pause |
| `pause.titre` | PAUSE | PAUSE |
| `pause.etat` | {morts} · point {pc} | {morts} · checkpoint {pc} |
| `pause.reprendre` | REPRENDRE | RESUME |
| `pause.recommencer` | Tout recommencer | Start over |
| `pause.fantome.oui` | Fantôme : oui | Ghost: on |
| `pause.fantome.non` | Fantôme : non | Ghost: off |
| `pause.son.oui` | Son : oui | Sound: on |
| `pause.son.non` | Son : non | Sound: off |
| `pause.reglages` | Réglages | Settings |
| `pause.aide` | Comment jouer | How to play |
| `pause.accueil` | Accueil de Jump | Jump home |
| `pause.mentions` | Mentions légales | Legal notice |

### Rang (`rang.*`, `apps/jump/src/catalogue.arrivee.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `rang.sur` | {rang} sur {total} | {rang} of {total} |
| `rang.classes` | one : {total} classé · other : {total} classés | one : {total} ranked · other : {total} ranked |
| `rang.titre` | Classement du jour | Today's leaderboard |
| `rang.titreFige` | Classement figé du {date} | Final leaderboard of {date} |
| `rang.indisponible` | Classement indisponible | Leaderboard unavailable |
| `rang.chargement` | Chargement du classement… | Loading the leaderboard… |
| `rang.ceJourLa` | Ton rang ce jour-là : {rang} | Your rank that day: {rang} |
| `rang.pasClasseCeJourLa` | {classes} · tu n'as pas été classé ce jour-là | {classes} · you weren't ranked that day |
| `rang.personne` | Personne n'a été classé ce jour-là | Nobody was ranked that day |
| `rang.version` | Une nouvelle version du jeu est disponible | A new version of the game is out |
| `rang.pseudo` | Choisis ton pseudo pour entrer au classement | Pick a name to join the leaderboard |
| `rang.horsLigne` | Classement indisponible, ton temps sera envoyé. | Leaderboard unavailable, your time will be sent. |
| `rang.tropEnvois` | Trop d'envois : nouvel essai dans un moment. | Too many submissions: trying again in a moment. |
| `rang.envoi` | Envoi au classement… | Sending to the leaderboard… |
| `rang.duJour` | Ton rang du jour : {rang} | Your rank today: {rang} |

### Réglages (`reglages.*`, `apps/jump/src/catalogue.reglages.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `reglages.aria` | Réglages | Settings |
| `reglages.titre` | RÉGLAGES | SETTINGS |
| `reglages.son` | Son | Sound |
| `reglages.volume` | Volume général | Master volume |
| `reglages.effetsSonores` | Effets sonores | Sound effects |
| `reglages.ambiance` | Ambiance | Ambience |
| `reglages.valeur` | {n} % | {n}% |
| `reglages.sensations` | Sensations | Feel |
| `reglages.vibrations` | Vibrations | Vibration |
| `reglages.vibrations.non` | Cet appareil ne vibre pas (iPhone, ordinateur). | This device doesn't vibrate (iPhone, computer). |
| `reglages.tremblement` | Secousses de l'écran | Screen shake |
| `reglages.tremblement.normal` | Normales | Normal |
| `reglages.tremblement.reduit` | Réduites | Reduced |
| `reglages.tremblement.aucun` | Aucune | None |
| `reglages.mouvement` | Mouvement réduit | Reduced motion |
| `reglages.mouvement.aide` | Ni secousse, ni particules, ni traînée ; le fond ne défile plus. | No shake, no particles, no trail; the background stops scrolling. |
| `reglages.effets` | Effets visuels | Visual effects |
| `reglages.effets.normal` | Normal | Normal |
| `reglages.effets.reduit` | Réduit | Reduced |
| `reglages.effets.aucun` | Aucun | None |
| `reglages.effets.aide` | Les taches de peinture restent toujours. | Paint stains always stay. |
| `reglages.premier` | Fantôme du premier | First place's ghost |
| `reglages.premier.aide` | Le meilleur essai du jour, en mauve, avec son pseudo, à côté de ton fantôme (cyan). Ton fantôme : la pause, ou la touche G. | Today's best run, in purple, with its name, next to your own ghost (cyan). Your ghost: the pause, or the G key. |
| `reglages.taches` | Taches de tout le monde | Everyone's stains |
| `reglages.taches.aide` | Les morts des autres joueurs du jour, plus pâles et plus petites que les tiennes : on voit où le niveau tue. | Other players' deaths today, paler and smaller than yours: you can see where the level kills. |
| `reglages.commandes` | Commandes | Controls |
| `reglages.clavier` | Clavier | Keyboard |
| `reglages.manette` | Manette | Gamepad |
| `reglages.tactile` | Tactile | Touch |
| `reglages.langue` | Langue | Language |
| `reglages.profil` | Mon profil Du Jour | My Du Jour profile |
| `reglages.mentions` | Mentions légales | Legal notice |

### Thèmes (`theme.*`, `apps/jump/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `theme.foret` | Forêt | Forest |
| `theme.usine` | Usine | Factory |
| `theme.glace` | Glace | Ice |
| `theme.nuit` | Nuit | Night |
| `theme.neon` | Néon | Neon |
