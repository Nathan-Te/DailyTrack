# Relecture des traductions (anglais)

Fichier **produit** par `npm run traductions` (lot I6 de la plateforme, `scripts/traductions.ts`) : ne pas le modifier à la main, modifier les catalogues puis relancer la commande (le test `packages/ui/test/traductions.test.ts` échoue si ce fichier n'est pas à jour). Pour Nathan : toutes les chaînes anglaises, la clé et le français en face, rangées par application puis par écran (le premier mot de la clé). Commencer par les **choix discutables** listés dans `docs/plateforme/lots/lot-I6-finitions.md`.

1315 clés. Les paramètres (`{n}`, `{temps}`…) sont remplacés à l'affichage ; un pluriel s'écrit `one : …` · `other : …`. Les outils internes (`?debug&tune`, administration, galerie des morceaux) restent en français et ne sont pas ici ; les mentions légales anglaises sont une page statique (`apps/portail/legal/`), la page 404 porte les deux langues (`apps/portail/404.html`).

## Catalogue commun (`@cdj/ui` : composants, noms des jeux, médailles, erreurs du serveur, répliques de Jump)

### annonce (`annonce.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `annonce.fermer` | Fermer le message | Dismiss the message |
| `annonce.important` | Important | Important |

### Aperçu de partage (quand on colle le lien) (`apercu.*`, `packages/ui/src/catalogue.interrupteur.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `apercu.bandeau` | Aperçu — pas encore public | Preview — not public yet |
| `apercu.brouillon` | Brouillon | Draft |

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

### bientot (`bientot.*`, `packages/ui/src/catalogue.interrupteur.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `bientot.titre` | Bientôt | Coming soon |
| `bientot.texte` | {nom} n'est pas encore ouvert. Reviens bientôt ! | {nom} isn't open yet. Come back soon! |
| `bientot.retour` | ‹ Du Jour | ‹ Du Jour |

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
| `erreur.forbidden` | Action refusée. | Action refused. |
| `erreur.invalid_action` | Cette action n'est pas valide. | That action isn't valid. |
| `erreur.unknown_result` | Aucun résultat à ce jour-là. | No result on that day. |
| `erreur.invalid_news` | Cette nouveauté n'est pas complète. | That update isn't complete. |
| `erreur.unknown_news` | Cette nouveauté n'existe pas. | That update doesn't exist. |
| `erreur.invalid_message` | Ce message n'est pas valide. | That message isn't valid. |
| `erreur.invalid_cursor` | Cette page des nouveautés n'existe pas. | That page of updates doesn't exist. |
| `erreur.game_unavailable` | Ce jeu n'est pas encore ouvert. Reviens bientôt ! | This game isn't open yet. Come back soon! |
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
| `erreur.invalid_view` | Cette vue du classement n'existe pas. | This leaderboard view does not exist. |
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
| `erreur.invalid_replay` | Cette partie est illisible : elle n'a pas été comptée. | This game couldn't be read: it wasn't counted. |
| `erreur.not_finished` | Cette partie n'est pas allée jusqu'au bout. | This game wasn't played to the end. |
| `erreur.replay_copy` | Cette partie est la copie d'une autre. | This game is a copy of another one. |
| `erreur.track_mismatch` | Cette partie n'est pas celle du bon jour. | This game isn't the right one for this day. |
| `erreur.sim_version` | Une nouvelle version du jeu est disponible : recharge la page. | A new version of the game is out: reload the page. |
| `erreur.version` | Une nouvelle version du jeu est disponible : recharge la page. | A new version of the game is out: reload the page. |
| `erreur.no_ghost` | Pas de fantôme à montrer. | No ghost to show. |
| `erreur.not_ranked` | Ce fantôme se débloque quand tu es classé ce jour-là. | This ghost unlocks once you are ranked that day. |
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

### manette (`manette.*`, `packages/ui/src/catalogue.manette.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `manette.valider` | Valider | Confirm |
| `manette.retour` | Retour | Back |
| `manette.onglets` | Onglets | Tabs |
| `manette.aide.aria` | Aide de la manette : A valide, B revient, LB et RB changent d'onglet. | Gamepad help: A confirms, B goes back, LB and RB switch tabs. |
| `manette.aide.aria.sans` | Aide de la manette : A valide, B revient. | Gamepad help: A confirms, B goes back. |

### Marque (`marque.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `marque.logo` | DU JOUR | DU JOUR |
| `marque.nom` | Du Jour | Du Jour |

### Médailles (`medaille.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `medaille.diamant` | Diamant | Diamond |
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
| `jeu.tower.nom` | Tower | Tower |

### nouveauDepart (`nouveauDepart.*`, `packages/ui/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `nouveauDepart.message` | Nouveau départ : tout le monde repart de zéro. Bonne chance ! | Fresh start: everyone begins from zero. Good luck! |
| `nouveauDepart.fermer` | Fermer ce message | Dismiss this message |

### pleinEcran (`pleinEcran.*`, `packages/ui/src/catalogue.ts`, `packages/ui/src/catalogue.iphone.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `pleinEcran.entrer` | Plein écran | Full screen |
| `pleinEcran.quitter` | Quitter le plein écran | Exit full screen |
| `pleinEcran.iphone` | Pour jouer en plein écran : Partager › Sur l'écran d'accueil | To play full screen: Share › Add to Home Screen |
| `pleinEcran.iphone.fermer` | Fermer cette astuce | Dismiss this tip |
| `pleinEcran.aide.titre` | Jouer en plein écran | Play full screen |
| `pleinEcran.aide.avant` | Pour jouer en plein écran : touche | To play full screen: tap |
| `pleinEcran.aide.partager` | Partager | Share |
| `pleinEcran.aide.apres` | puis « Sur l'écran d'accueil ». | then “Add to Home Screen”. |
| `pleinEcran.aide.profil` | Ton profil se retrouve avec ton code de transfert. | You get your profile back with your transfer code. |
| `pleinEcran.aide.copier` | Copier mon code | Copy my code |
| `pleinEcran.aide.copie` | Code copié : colle-le dans l'application. | Code copied: paste it in the app. |
| `pleinEcran.aide.pasDeCopie` | Copie impossible ici : ouvre ton profil pour copier ton code. | Can't copy here: open your profile to copy your code. |
| `pleinEcran.aide.lien` | Voir mon code de transfert | See my transfer code |
| `pleinEcran.aide.fermer` | Fermer | Close |

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

### retrouver (`retrouver.*`, `packages/ui/src/catalogue.iphone.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `retrouver.titre` | Retrouver mon profil | Get my profile back |
| `retrouver.aide` | Cette application a son propre stockage : elle ne connaît pas encore ton profil. Dans Safari, copie ton code de transfert (Du Jour › Profil › Copier mon code), puis colle-le ici. | This app has its own storage: it doesn't know your profile yet. In Safari, copy your transfer code (Du Jour › Profile › Copy my code), then paste it here. |
| `retrouver.coller` | Coller mon code | Paste my code |
| `retrouver.champ` | Ou colle ton code ici | Or paste your code here |
| `retrouver.verifier` | Vérifier | Check |
| `retrouver.verification` | Vérification… | Checking… |
| `retrouver.vide` | Colle d'abord ton code de transfert. | Paste your transfer code first. |
| `retrouver.illisible` | Ce n'est pas un code de transfert valide : copie-le de nouveau, en entier. | That isn't a valid transfer code: copy it again, in full. |
| `retrouver.deja` | C'est déjà le profil de cet appareil. | That is already this device's profile. |
| `retrouver.presseVide` | Le presse-papiers est vide ou refusé : colle ton code dans le champ. | The clipboard is empty or was refused: paste your code in the field. |
| `retrouver.horsLigne` | Le serveur est injoignable : réessaie dans un instant. | The server can't be reached: try again in a moment. |
| `retrouver.trouve` | one : Profil trouvé : {nom}, {n} jour fini. · other : Profil trouvé : {nom}, {n} jours finis. | one : Profile found: {nom}, {n} day done. · other : Profile found: {nom}, {n} days done. |
| `retrouver.confirmer` | Reprendre ce profil | Use this profile |
| `retrouver.annuler` | Ce n'est pas le mien | That's not mine |
| `retrouver.echec` | Impossible d'enregistrer le profil sur cet appareil. | Couldn't save the profile on this device. |
| `retrouver.passer` | Commencer sans profil | Start without a profile |

## Portail Du Jour (accueil, profil commun, classement du jour, vitrine et démonstration de la recette)

### Aperçu de partage (quand on colle le lien) (`apercu.*`, `apps/portail/src/catalogueApercu.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `apercu.titre` | Du Jour — les jeux du jour | Du Jour — today's games |
| `apercu.description` | Chaque jour, un circuit Track et un niveau Jump, les mêmes pour tout le monde. Joue, compare, partage ta journée. | Every day, one Track circuit and one Jump level, the same for everyone. Play, compare, share your day. |
| `apercu.image` | Le logo DU JOUR et deux cartouches posées sur l'étagère : Track et Jump. | The DU JOUR logo and two cartridges on the shelf: Track and Jump. |
| `apercu.nouveautes.titre` | Nouveautés — Du Jour | What's new — Du Jour |
| `apercu.nouveautes.description` | Ce qui change dans Du Jour, Track et Jump : les nouveautés, mise à jour par mise à jour, en français et en anglais. | What changes in Du Jour, Track and Jump: updates one by one, in French and in English. |

### Classement (`classement.*`, `apps/portail/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `classement.titre` | Classement du jour | Today's leaderboard |
| `classement.description` | Le classement du jour de Du Jour au chrono : le temps cumulé de tous les jeux, ou jeu par jeu, avec la médaille de chaque joueur. | Today's Du Jour leaderboard, against the clock: the combined time across every game, or game by game, with each player's medal. |
| `classement.egalite` | Au chrono. À égalité : le premier arrivé à ce temps. | Against the clock. Tie: whoever got there first. |
| `classement.egaliteHauteur` | À la hauteur. À égalité : plus de vies, puis plus vite. | By height. Tie: more lives, then faster. |
| `classement.vues.aria` | Vues du classement | Leaderboard views |
| `classement.vue.cumul` | Cumulé | Combined |
| `classement.separation` | Un jeu sur deux | One game out of two |
| `classement.veille` | ‹ Veille | ‹ Previous day |
| `classement.lendemain` | Lendemain › | Next day › |
| `classement.veille.aria` | Voir le classement de la veille | See the previous day's leaderboard |
| `classement.lendemain.aria` | Voir le classement du lendemain | See the next day's leaderboard |
| `classement.classes` | one : {n} joueur classé · other : {n} joueurs classés | one : {n} player ranked · other : {n} players ranked |
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

### nouveautes (`nouveautes.*`, `apps/portail/src/catalogue.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `nouveautes.titre` | Nouveautés | What's new |
| `nouveautes.description` | Les nouveautés de Du Jour, de Track et de Jump : ce qui change, mise à jour par mise à jour. | What's new in Du Jour, Track and Jump: what changes, update by update. |
| `nouveautes.zone.dujour` | Du Jour | Du Jour |
| `nouveautes.zone.track` | Track | Track |
| `nouveautes.zone.jump` | Jump | Jump |
| `nouveautes.plusAnciennes` | Plus anciennes | Older |
| `nouveautes.plusAnciennes.aria` | Voir les nouveautés plus anciennes | Show older updates |
| `nouveautes.vide` | Rien à lire pour l'instant : les prochaines mises à jour s'afficheront ici. | Nothing to read yet: the next updates will show up here. |
| `nouveautes.chargement` | Chargement des nouveautés… | Loading updates… |
| `nouveautes.erreur` | Les nouveautés ne se chargent pas : réessaie dans un instant. | Updates won't load: try again in a moment. |
| `nouveautes.lignes.aria` | Ce qui change | What changes |

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
| `portail.brouillon` | Brouillon | Draft |
| `portail.track.accroche` | Un circuit par jour, le même pour tous. | One track a day, the same for everyone. |
| `portail.jump.accroche` | Un niveau de plateforme par jour, le même pour tous. | One platform level a day, the same for everyone. |
| `portail.tower.accroche` | Une tour par jour, les mêmes pièces pour tous. | One tower a day, the same pieces for everyone. |
| `portail.jouer` | Jouer | Play |
| `portail.jouer.aria` | Jouer à {jeu} | Play {jeu} |
| `portail.pied` | Nouveau jour à minuit, heure de Paris. Ton profil est le même dans tous les jeux. | A new day at midnight, Paris time. Your profile is the same in every game. |
| `portail.mentions` | Mentions légales et confidentialité | Legal notice and privacy |
| `portail.discord` | Rejoindre le Discord | Join the Discord |
| `portail.kofi` | Me soutenir sur Ko-fi | Support me on Ko-fi |
| `portail.compte.legende` | Prochains niveaux dans | Next levels in |
| `portail.avancement` | one : {n} fini sur {total} · other : {n} finis sur {total} | one : {n} of {total} done · other : {n} of {total} done |
| `portail.numeroTheme` | {numero} · {theme} | {numero} · {theme} |
| `portail.statut.pasJoue` | Pas encore joué | Not played yet |
| `portail.statut.enCours` | En cours | In progress |
| `portail.statut.enCoursMorts` | one : En cours · {n} mort · other : En cours · {n} morts | one : In progress · {n} death · other : In progress · {n} deaths |
| `portail.statut.fini` | Fini | Done |
| `portail.statut.vies` | one : {n} vie · other : {n} vies | one : {n} life · other : {n} lives |
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
| `portail.theme.tower.port` | Port | Harbour |
| `portail.theme.tower.chantier` | Chantier | Building site |
| `portail.theme.tower.canyon` | Canyon | Canyon |
| `portail.theme.tower.banquise` | Banquise | Ice floe |
| `portail.theme.tower.jungle` | Jungle | Jungle |
| `portail.theme.tower.nuit` | Nuit | Night |
| `portail.journee` | Journée {numero} | Day {numero} |
| `portail.classement.legende` | Classement du jour | Today's leaderboard |
| `portail.classement.cumul` | {temps} cumulés | {temps} combined |
| `portail.classement.manque` | Finis {jeu} pour le cumul | Finish {jeu} for the combined time |
| `portail.classement.inviter` | Finis un jeu pour entrer au classement | Finish a game to enter the leaderboard |
| `portail.partager` | Partager ma journée | Share my day |
| `portail.partage.apercu` | Ce que tu partages | What you're sharing |
| `portail.partage.partage` | Journée partagée. | Day shared. |
| `portail.partage.copie` | Ligne copiée : colle-la où tu veux. | Line copied: paste it wherever you like. |
| `portail.partage.pasDeCopie` | Copie impossible ici : sélectionne la ligne à la main. | Can't copy here: select the line by hand. |
| `portail.nouveautes.legende` | Nouveautés · {date} | What's new · {date} |
| `portail.nouveautes.nonLue` | Nouveau | New |

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
| `vitrine.pleinEcran.aide` | Ouvrir l'aide du plein écran | Open the full screen help |
| `vitrine.pleinEcran.retrouver` | Ouvrir « Retrouver mon profil » | Open “Get my profile back” |
| `vitrine.fantome` | Fantôme suivant | Next ghost |
| `vitrine.section.bandeau` | Message en direct | Live message |
| `vitrine.bandeau.information` | Maintenance ce soir à 22 h : le classement sera figé dix minutes. | Maintenance tonight at 10 pm: the leaderboard will freeze for ten minutes. |
| `vitrine.bandeau.important` | Le serveur redémarre dans quelques instants. | The server restarts in a few moments. |
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
| `vitrine.afficheur.legende` | Prochains niveaux dans | Next levels in |
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
| `arrivee.voitureEssai` | Voiture d'essai : course non classée ni enregistrée | Trial car: run neither ranked nor saved |
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
| `tactile.direction.aide` | Boutons, glissière, volant ou gyroscope. | Buttons, slider, wheel or gyroscope. |
| `tactile.direction.boutons` | Boutons | Buttons |
| `tactile.direction.glissiere` | Glissière | Slider |
| `tactile.direction.volant` | Volant | Wheel |
| `tactile.direction.gyro` | Gyroscope | Gyroscope |
| `tactile.inverse.nom` | Disposition inversée | Mirrored layout |
| `tactile.inverse.aide` | Pédales à gauche, direction à droite. | Pedals on the left, steering on the right. |
| `tactile.cote.gauche` | à gauche | on the left |
| `tactile.cote.droite` | à droite | on the right |
| `tactile.taille.nom` | Taille des commandes | Controls size |
| `tactile.taille.small` | Petits | Small |
| `tactile.taille.medium` | Moyens | Medium |
| `tactile.taille.large` | Grands | Large |
| `tactile.sensibilite.nom` | Sensibilité | Sensitivity |
| `tactile.sensibilite.aide` | Plus c'est haut, moins il faut de mouvement. | The higher, the less movement it takes. |
| `tactile.zoneMorte.nom` | Zone morte | Dead zone |
| `tactile.accelerateur.nom` | Accélérateur | Throttle |
| `tactile.accelerateur.aide` | Automatique : la voiture accélère seule, tu ne touches que le frein. | Automatic: the car accelerates by itself, you only touch the brake. |
| `tactile.accelerateur.bouton` | Bouton gaz | Gas button |
| `tactile.accelerateur.auto` | Automatique | Automatic |
| `tactile.vibration.nom` | Vibration | Vibration |
| `tactile.vibration.aide` | Au point de contrôle et aux chocs, si ton téléphone sait vibrer. | At checkpoints and on hits, if your phone can vibrate. |
| `tactile.reinit` | Réglages tactiles par défaut | Default touch settings |
| `tactile.indice` | {direction} · {pedales} | {direction} · {pedales} |
| `tactile.indice.fleches` | ← → {cote} pour tourner | ← → {cote} to steer |
| `tactile.indice.pedales` | frein et gaz {cote} | brake and gas {cote} |
| `tactile.indice.auto` | touche {cote} pour freiner | touch {cote} to brake |
| `tactile.frein` | Frein | Brake |
| `tactile.gaz` | Gaz | Gas |
| `tactile.pointDeControle` | Recommencer au dernier point de contrôle | Restart from the last checkpoint |
| `tactile.depart` | Recommencer depuis le départ | Restart from the start |
| `tactile.rotation` | Tourne ton téléphone : on conduit mieux en paysage. | Turn your phone: it drives better in landscape. |
| `tactile.rotation.ok` | Jouer quand même | Play anyway |
| `tactile.indice.glissiere` | Glisse la glissière {cote} pour tourner | Slide the slider {cote} to steer |
| `tactile.indice.volant` | Tourne le volant au doigt, {cote} | Turn the wheel with your finger, {cote} |
| `tactile.angle.nom` | Angle maximal | Maximum angle |
| `tactile.angle.aide` | Le volant s'arrête là : 90° ou 135°. C'est aussi sa sensibilité. | The wheel stops there: 90° or 135°. It is also its sensitivity. |
| `tactile.indice.gyro` | Incline le téléphone pour tourner | Tilt the phone to steer |
| `tactile.indice.gyroPedales` | frein {frein}, gaz {gaz} | brake {frein}, gas {gaz} |
| `tactile.gyro.calage` | Gyroscope : tiens le téléphone droit… | Gyroscope: hold the phone upright… |
| `tactile.gyro.jauge.calage` | Calage | Setting |
| `tactile.gyro.jauge.pret` | Prêt | Ready |
| `tactile.gyro.jauge.reglage` | Jauge d'inclinaison en course | Tilt gauge in a race |
| `tactile.gyro.carte.attente` | Pour tourner en inclinant le téléphone, Track a besoin du capteur de mouvement. | To steer by tilting your phone, Track needs the motion sensor. |
| `tactile.gyro.carte.attentePetit` | Rien n'est enregistré ni envoyé : le capteur ne sert qu'à tourner. | Nothing is stored or sent: the sensor is only used to steer. |
| `tactile.gyro.carte.autoriser` | Autoriser le gyroscope | Allow the gyroscope |
| `tactile.gyro.carte.demande` | En attente de ton autorisation… | Waiting for your permission… |
| `tactile.gyro.carte.ok` | Gyroscope actif. Tiens le téléphone droit pendant le décompte : c'est ta position neutre. | Gyroscope on. Hold the phone upright during the countdown: that is your neutral position. |
| `tactile.gyro.carte.okPetit` | Le neutre est repris à chaque course. Essaie ci-dessous. | The neutral is taken again each race. Try it below. |
| `tactile.gyro.carte.refus` | Gyroscope refusé. Retour au mode {mode}. | Gyroscope refused. Back to {mode} mode. |
| `tactile.gyro.carte.refusPetit` | Pour l'autoriser plus tard : réglages du téléphone, accès au mouvement et à l'orientation du navigateur, puis recharge la page. | To allow it later: phone settings, the browser's motion and orientation access, then reload the page. |
| `tactile.gyro.carte.absent` | Ce téléphone n'a pas de capteur d'inclinaison utilisable. Retour au mode {mode}. | This phone has no usable tilt sensor. Back to {mode} mode. |
| `tactile.gyro.carte.absentPetit` | Aucun mouvement reçu : le gyroscope est désactivé sur cet appareil ou absent. | No motion received: the gyroscope is disabled on this device or missing. |
| `tactile.gyro.essai.nom` | Essai | Test |
| `tactile.gyro.essai.aide` | Incline le téléphone : le curseur doit bouger. | Tilt the phone: the cursor should move. |
| `tactile.gyro.sensibilite.aide` | Inclinaison pour braquer à fond : {deg}° | Tilt for full lock: {deg}° |
| `tactile.gyro.filtre.nom` | Filtrage des tremblements | Tremor filtering |
| `tactile.gyro.filtre.aide` | Léger : aucun retard perceptible. | Light: no perceptible lag. |
| `tactile.gyro.recentrer` | Recentrer le gyroscope | Recentre the gyroscope |
| `tactile.gyro.recentrer.aide` | Aussi dans la pause. Tiens le téléphone droit. | Also in the pause menu. Hold the phone upright. |
| `tactile.gyro.recentrage` | Recentrage… tiens droit | Recentring… hold upright |
| `tactile.gyro.recentre` | Gyroscope recentré | Gyroscope recentred |

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

### couleur (`couleur.*`, `apps/web/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `couleur.orange` | Orange Track | Track orange |
| `couleur.grenat` | Grenat | Garnet |
| `couleur.fuchsia` | Fuchsia | Fuchsia |
| `couleur.glycine` | Glycine | Wisteria |
| `couleur.petrole` | Pétrole | Petrol |
| `couleur.lagon` | Lagon | Lagoon |
| `couleur.olive` | Olive | Olive |
| `couleur.poudre` | Rose poudré | Powder pink |

### Course (surimpressions) (`course.*`, `apps/web/src/catalogue.course.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `course.menu.aria` | Menu du jeu | Game menu |
| `course.rang.aria` | Classement du jour : {rang}, ouvrir ou fermer | Today's leaderboard: {rang}, open or close |
| `course.rang.salon.aria` | Classement de la session : {rang}, ouvrir ou fermer | Session leaderboard: {rang}, open or close |
| `course.pause.aria` | Pause | Pause |
| `course.fige` | FIGÉ | FROZEN |
| `course.aide.puce` | Comment jouer · R : point de contrôle · Entrée : recommencer · C : caméra · G : fantôme · P : pause | How to play · R: checkpoint · Enter: restart · C: camera · G: ghost · P: pause |
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
| `course.notice.voitureEssai` | Voiture d'essai ({nom}) : course non classée | Trial car ({nom}): run not ranked |
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
| `course.scenario.herbe` | Circuit de l'herbe de course | Racing turf circuit |
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
| `course.depart` | PARTEZ ! | GO! |
| `course.arrivee` | ARRIVÉE | FINISH |
| `course.portique.depart` | DÉPART | START |
| `course.portique.arrivee` | ARRIVÉE | FINISH |
| `course.chute` | Chute ! | Fall! |
| `course.chronoTourne.tactile` | Le chrono tourne : GAZ, en bas à droite | The clock is running: GAS, bottom right |
| `course.chronoTourne.clavier` | Le chrono tourne : ↑ ou Z pour accélérer | The clock is running: ↑ or W to accelerate |
| `course.camera.proche` | Caméra : proche | Camera: close |
| `course.camera.loin` | Caméra : loin | Camera: far |
| `course.camera.capot` | Caméra : capot | Camera: hood |
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
| `course.sol.turf` | Herbe de course | Racing turf |

### Erreurs (`erreur.*`, `apps/web/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `erreur.local.network` | Serveur injoignable. | Server unreachable. |
| `erreur.local.timeout` | Le serveur ne répond pas. | The server isn't answering. |
| `erreur.local.http_error` | Le serveur a répondu par une erreur. | The server answered with an error. |
| `erreur.local.inconnue` | Quelque chose n'a pas marché. | Something went wrong. |

### fantomes (`fantomes.*`, `apps/web/src/catalogue.course.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `fantomes.compteur` | one : {n} fantôme sur {max} · other : {n} fantômes sur {max} | one : {n} ghost of {max} · other : {n} ghosts of {max} |
| `fantomes.compteur.aria` | one : {n} fantôme choisi sur {max} · other : {n} fantômes choisis sur {max} | one : {n} ghost chosen of {max} · other : {n} ghosts chosen of {max} |
| `fantomes.propose` | proposé | suggested |
| `fantomes.toutDecocher` | Tout décocher | Untick all |
| `fantomes.max` | 5 fantômes au maximum : décoches-en un pour en choisir un autre. | 5 ghosts at most: untick one to pick another. |
| `fantomes.case.aria` | Fantôme de {nom} | {nom}'s ghost |
| `fantomes.choisir` | Choisir mes fantômes ({n}) | Choose my ghosts ({n}) |
| `fantomes.libelle` | ma sélection · {n} | my selection · {n} |
| `fantomes.saute.mine` | Pas encore de record | No record yet |
| `fantomes.saute.selection` | Aucun fantôme choisi | No ghost chosen |
| `fantomes.manque` | Un fantôme n'a pas pu être chargé | A ghost could not be loaded |

### Fantômes (`fantome.*`, `apps/web/src/catalogue.course.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `fantome.bouton` | Fantôme : {nom} | Ghost: {nom} |

### figures (`figures.*`, `apps/web/src/catalogue.course.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `figures.index.aria` | Les nouvelles figures | The new figures |
| `figures.index.titre` | Nouvelles figures | New figures |
| `figures.index.intro` | Chaque figure se joue seule, en boucle. Garde, écarte ou retouche : dis-le à l'agent. | Each figure plays on its own, in a loop. Keep, drop or tweak: tell the agent. |
| `figures.index.essayer` | Essayer | Try |
| `figures.index.variante` | Variante 2 | Variant 2 |
| `figures.index.tour` | Rouler le tour des figures | Drive the figures tour |
| `figures.index.themes` | Thèmes : {liste} | Themes: {liste} |
| `figures.index.tous` | Tous les thèmes | All themes |
| `figures.sautSortieVirage.titre` | Saut à l'élan | Momentum jump |
| `figures.sautSortieVirage.quoi` | Pas de plaque : la vitesse gardée dans le virage d'avant fait passer le vide. | No boost pad: the speed you kept through the corner clears the gap. |
| `figures.tremplinReleve.titre` | Tremplin en sortie de relevé | Ramp out of a banked turn |
| `figures.tremplinReleve.quoi` | On décolle en train de tourner : se redresser avant la rampe, ou figer la caisse au frein. | You take off still turning: straighten up before the ramp, or freeze the car with the brake. |
| `figures.chicaneTremplin.titre` | Chicane avant le tremplin | Chicane before the ramp |
| `figures.chicaneTremplin.quoi` | Assez vite pour le vide, assez propre pour arriver droit sur la rampe. | Fast enough for the gap, clean enough to hit the ramp straight. |
| `figures.receptionVirage.titre` | Réception dans un virage | Landing in a corner |
| `figures.receptionVirage.quoi` | On retombe au début d'un grand virage : pas trop vite, et tourner dès que les roues touchent. | You land at the start of a big corner: not too fast, and turn as soon as the wheels touch. |
| `figures.sautGlace.titre` | Saut vers la glace | Jump onto ice |
| `figures.sautGlace.quoi` | On retombe sur la glace : la réception glisse, le virage se prépare en roue libre. | You land on ice: the landing slides, the corner is set up off the throttle. |
| `figures.sautFalaise.titre` | Saut de la falaise | Cliff jump |
| `figures.sautFalaise.quoi` | Deux cellules de vide, réception deux niveaux plus bas. | Two cells of void, landing two levels lower. |
| `figures.bossesTerre.titre` | Bosses en série | Dirt bumps |
| `figures.bossesTerre.quoi` | Trois bosses de terre : garder la voiture droite pour tourner à la sortie. | Three dirt bumps in a row: keep the car straight to turn at the end. |
| `figures.demiTourMixte.titre` | Demi-tour route et terre | Road and dirt hairpin |
| `figures.demiTourMixte.quoi` | L'adhérence change au milieu du demi-tour. | Grip changes halfway through the hairpin. |
| `figures.demiTourGlace.titre` | Demi-tour route et glace | Road and ice hairpin |
| `figures.demiTourGlace.quoi` | Lâcher les gaz sur la glace, les reprendre quand les pneus mordent. | Lift on the ice, get back on the throttle when the tyres bite. |
| `figures.ruesEnEscalier.titre` | Rues en escalier | Stepped streets |
| `figures.ruesEnEscalier.quoi` | Un angle, une pente, un angle : freiner dans la pente, relancer à plat. | A corner, a slope, a corner: brake on the slope, accelerate on the flat. |
| `figures.filDuRasoir.titre` | Fil du rasoir | Razor's edge |
| `figures.filDuRasoir.quoi` | Route de 14 m sans rebords, un virage au milieu : la précision d'abord. | A 14 m road with no barriers and a corner halfway: precision first. |
| `figures.deversDescente.titre` | Relevés en descente | Banked turns downhill |
| `figures.deversDescente.quoi` | La pente pousse, le dévers retient : on passe vite si l'on vise bien. | The slope pushes, the banking holds: aim well and you stay fast. |

### garage (`garage.*`, `apps/web/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `garage.ouvrir` | Garage | Garage |
| `garage.nouveau` | Nouveau | New |
| `garage.arrivee.nouvelle` | one : Nouvelle voiture : · other : Nouvelles voitures : | one : New car: · other : New cars: |
| `garage.arrivee.voir` | Voir au Garage | See it in the Garage |
| `garage.aria` | Garage de Track | Track Garage |
| `garage.titre` | Garage | Garage |
| `garage.sousTitre` | one : {n} voiture sur {total} · other : {n} voitures sur {total} | one : {n} of {total} cars · other : {n} of {total} cars |
| `garage.voitures` | Les voitures | The cars |
| `garage.tienne` | Ta voiture | Your car |
| `garage.debloquee` | Débloquée | Unlocked |
| `garage.verrouillee` | Verrouillée | Locked |
| `garage.couleur` | Couleur | Colour |
| `garage.motif` | Motif | Livery |
| `garage.teinte` | Couleur du motif | Livery colour |
| `garage.teinte.grisee` | Hachurée : trop proche de la couleur de ta voiture, le motif resterait illisible. | Hatched: too close to your car's colour, the livery would not stand out. |
| `garage.tourner` | Glisse pour tourner autour | Drag to turn it around |
| `garage.equitable` | Toutes les voitures roulent pareil : seul le style change. | Every car drives the same: only the look changes. |
| `garage.horsLigne` | Hors connexion : tes voitures débloquées restent là ; la progression reviendra avec le réseau. | Offline: your unlocked cars stay here; progress comes back with the network. |
| `garage.condition.or` | one : Décroche l'or (ou le Diamant) sur un circuit du jour. · other : Décroche l'or (ou le Diamant) sur {n} circuits du jour. | one : Get gold (or Diamond) on a daily track. · other : Get gold (or Diamond) on {n} daily tracks. |
| `garage.condition.jours` | one : Termine un circuit du jour. · other : Termine {n} circuits du jour. | one : Finish a daily track. · other : Finish {n} daily tracks. |
| `garage.condition.auteur` | one : Bats le temps de l'auteur sur un circuit du jour. · other : Bats le temps de l'auteur sur {n} circuits du jour. | one : Beat the Author time on a daily track. · other : Beat the Author time on {n} daily tracks. |
| `garage.progres.or` | one : {fait}/{n} médaille d'or · other : {fait}/{n} médailles d'or | one : {fait}/{n} gold medal · other : {fait}/{n} gold medals |
| `garage.progres.jours` | one : {fait}/{n} jour · other : {fait}/{n} jours | one : {fait}/{n} day · other : {fait}/{n} days |
| `garage.progres.auteur` | one : {fait}/{n} médaille Diamant · other : {fait}/{n} médailles Diamant | one : {fait}/{n} Diamond medal · other : {fait}/{n} Diamond medals |

### Ligne à partager (`lignePartage.*`, `apps/web/src/catalogue.course.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `lignePartage.titre` | Du Jour · Track #{numero} | Du Jour · Track #{numero} |
| `lignePartage.titreSansNumero` | Du Jour · Track {date} | Du Jour · Track {date} |

### Miniatures (`miniature.*`, `apps/web/src/catalogue.course.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `miniature.alt` | Vue aérienne du circuit du {date} | Aerial view of the track of {date} |

### motif (`motif.*`, `apps/web/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `motif.course` | Double bande | Racing stripes |
| `motif.flancs` | Flancs | Sides |
| `motif.filet` | Filet | Pinstripe |
| `motif.bicolore` | Bicolore | Two-tone |
| `motif.chevrons` | Chevrons | Chevrons |
| `motif.damier` | Damier | Checkers |
| `motif.rond` | Rond | Roundel |
| `motif.unie` | Unie | Plain |

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
| `reglages.graphismes.nom` | Qualité graphique | Graphics quality |
| `reglages.graphismes.aide` | Ne change rien à la course : seulement l'image. En Auto, le jeu allège seul l'image si ça ralentit. | Never changes the race: only the picture. On Auto, the game lightens the picture by itself if it starts to lag. |
| `reglages.graphismes.auto` | Auto | Auto |
| `reglages.graphismes.economie` | Économie | Battery saver |
| `reglages.graphismes.equilibree` | Équilibrée | Balanced |
| `reglages.graphismes.maximale` | Maximale | Maximum |
| `reglages.graphismes.actuel` | Choisie pour cet appareil : {niveau}. | Picked for this device: {niveau}. |
| `reglages.graphismes.attente` | Appliqué à la fin de la course. | Applied when the race ends. |
| `reglages.graphismes.tropLourd` | Trop lourd pour cet appareil : Auto allégerait l'image. | Too heavy for this device: Auto would lighten the picture. |
| `reglages.graphismes.detail.economie` | Décor simple, le plus fluide : pour les appareils modestes ou pour économiser la batterie. | Simple scenery, the smoothest: for modest devices or to save battery. |
| `reglages.graphismes.detail.equilibree` | Décor soigné et vivant : drapeaux, foule, nuages, reflets. | Polished, lively scenery: flags, crowd, clouds, reflections. |
| `reglages.graphismes.detail.maximale` | Tout ce que ton appareil supporte : ombres, brume, finitions. | Everything your device can handle: shadows, haze, finishing touches. |
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
| `reglages.ombres.aide` | Ombres portées de la voiture (le jeu les retire seul si ça ralentit). | The car's cast shadow (the game drops it by itself if it starts to lag). |
| `reglages.son.muet.nom` | Muet | Mute |
| `reglages.son.muet.aide` | La touche M fait de même. | The M key does the same. |
| `reglages.son.avec` | Son | Sound |
| `reglages.son.volume` | Volume général | Master volume |
| `reglages.son.moteur` | Moteur | Engine |
| `reglages.son.effets.nom` | Effets | Effects |
| `reglages.son.effets.aide` | Crissements, roulement, vent, bruitages. | Skids, rolling, wind, sound effects. |
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
| `reglages.tactile.absent` | Sur un téléphone ou une tablette, les réglages des commandes tactiles (direction, taille, disposition, accélérateur automatique, vibration) apparaissent ici. | On a phone or a tablet, the touch controls settings (steering, size, layout, automatic throttle, vibration) show up here. |
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

### teinte (`teinte.*`, `apps/web/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `teinte.auto` | Auto | Auto |
| `teinte.creme` | Crème | Cream |
| `teinte.asphalte` | Asphalte | Asphalt |
| `teinte.lagon` | Lagon | Lagoon |

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

### voiture (`voiture.*`, `apps/web/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `voiture.civile.nom` | Sparrow | Sparrow |
| `voiture.evolution.nom` | Weasel | Weasel |
| `voiture.gt.nom` | Moray | Moray |
| `voiture.proto.nom` | Dragonfly | Dragonfly |
| `voiture.fourgon.nom` | Pelican | Pelican |
| `voiture.rallye.nom` | Badger | Badger |
| `voiture.roadster.nom` | Gecko | Gecko |
| `voiture.pickup.nom` | Armadillo | Armadillo |
| `voiture.muscle.nom` | Boar | Boar |
| `voiture.monoplace.nom` | Sailfish | Sailfish |
| `voiture.civile.description` | Compacte cinq portes, hayon, petit becquet. À toi dès le premier jour. | Five-door hatchback with a small spoiler. Yours from day one. |
| `voiture.evolution.description` | Coupé trapu : passages de roue larges, aileron sur deux jambes, quatre phares ronds. | Stocky coupé: wide arches, a wing on two legs, four round headlights. |
| `voiture.gt.description` | GT basse et large : capot long, grand aileron sur cols de cygne. | Low, wide GT: long bonnet, big swan-neck wing. |
| `voiture.proto.description` | Prototype d'endurance : bulle étroite, ailes détachées, dérive. | Endurance prototype: narrow bubble, separate wings, a fin. |
| `voiture.fourgon.description` | Fourgonnette de livraison d'autrefois : ailes séparées, gros phares ronds, flanc plein pour la livrée. | Old-style delivery van: separate wings, big round headlights, a whole side for the livery. |
| `voiture.rallye.description` | Compacte de rallye : haute, élargie, bavettes, rampe de quatre phares, grand becquet. | Rally hatchback: tall, widened, mud flaps, four-light pod, big spoiler. |
| `voiture.roadster.description` | Roadster deux places, découvert : sièges crème, pare-brise bas, arceau. | Open two-seater roadster: cream seats, low windscreen, roll hoop. |
| `voiture.pickup.description` | Pick-up tout-terrain : benne ouverte, caisse haute, pare-buffle, arceau. | Off-road pickup: open bed, high body, bull bar, roll bar. |
| `voiture.muscle.description` | Muscle car : capot très long à écope, arrière court en queue de canard. | Muscle car: very long bonnet with a scoop, short ducktail rear. |
| `voiture.monoplace.description` | Monoplace carénée : nez pointu, roues à demi apparentes, grande dérive dorsale. | Streamlined single-seater: pointed nose, half-exposed wheels, tall dorsal fin. |

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
| `arrivee.aideClavier` | Entrée : rejouer | Enter: play again |
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
| `commandes.clavier.reprendre` | R : dernier point de passage | R: last checkpoint |
| `commandes.clavier.recommencer` | Entrée : recommencer à zéro | Enter: start over from zero |
| `commandes.clavier.pause` | Échap ou P : pause | Esc or P: pause |
| `commandes.clavier.fantome` | G : fantôme | G: ghost |
| `commandes.manette.courir` | Stick ou croix : courir | Stick or D-pad: run |
| `commandes.manette.sauter` | A ou B : sauter | A or B: jump |
| `commandes.manette.reprendre` | Y : dernier point de passage | Y: last checkpoint |
| `commandes.manette.recommencer` | X : recommencer à zéro | X: start over from zero |
| `commandes.manette.pause` | Start : pause | Start: pause |
| `commandes.tactile.direction` | Gauche et droite : en bas à gauche | Left and right: bottom left |
| `commandes.tactile.saut` | SAUT : en bas à droite | JUMP: bottom right |
| `commandes.tactile.pause` | En haut à gauche : pause, dernier point de passage, recommencer | Top left: pause, last checkpoint, start over |

### Commandes tactiles (`tactile.*`, `apps/jump/src/catalogue.partie.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `tactile.gauche` | Gauche | Left |
| `tactile.droite` | Droite | Right |
| `tactile.saut` | SAUT | JUMP |
| `tactile.saut.aria` | Saut | Jump |
| `tactile.pointDePassage` | Reprendre au dernier point de passage | Back to the last checkpoint |
| `tactile.depart` | Recommencer à zéro | Start over from zero |
| `tactile.zone.bande` | bande | band |

### Comment jouer (`aide.*`, `apps/jump/src/catalogue.partie.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `aide.aria` | Comment jouer | How to play |
| `aide.titre` | COMMENT JOUER | HOW TO PLAY |
| `aide.point1` | Va jusqu'au drapeau. Le chrono part à ta première commande. | Get to the flag. The clock starts with your first move. |
| `aide.point2` | Tu vas mourir. C'est gratuit : on repart aussitôt, depuis le dernier fanion — ou de zéro avant le premier. | You'll die. It's free: you're back at once, at the last checkpoint flag — or from zero before the first one. |
| `aide.point3` | Tiens le saut pour monter plus haut. Contre un mur, saute : tu rebondis. | Hold jump to go higher. Against a wall, jump: you bounce off. |
| `aide.parti` | C'est parti | Let's go |
| `aide.schema.legende` | À gauche, la direction ; à droite, le saut. Le milieu de l'écran reste au jeu. | Left side: direction. Right side: jump. The middle of the screen belongs to the game. |
| `aide.zone.libre` | le jeu | the game |

### decompte (`decompte.*`, `apps/jump/src/catalogue.partie.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `decompte.partez` | Partez ! | Go! |

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
| `fantome.bouton` | Fantôme : {nom} | Ghost: {nom} |
| `fantome.nom.mien` | le tien | yours |
| `fantome.nom.premier` | le premier | first place |
| `fantome.nom.aucun` | aucun | none |
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
| `toast.demoEssai` | Démonstration : seulement sur ?scenario=essai ou sur un niveau du jour | Demo: only on ?scenario=essai or on a daily level |
| `toast.rediffAuteur` | Rediffusion de l'auteur | Author's replay |
| `toast.pasDeSolution` | Pas de solution stockée pour ce morceau | No stored solution for this piece |
| `toast.solution` | Solution du morceau | Piece solution |
| `toast.pasDeMeilleur` | Pas encore de meilleur essai aujourd'hui : à toi de jouer | No best run today yet: your turn |
| `toast.personneClasse` | Personne n'est encore classé ce jour-là : à toi de jouer | Nobody's ranked that day yet: your turn |
| `toast.premierIndisponible` | Fantôme du premier indisponible : à toi de jouer | First place's ghost unavailable: your turn |
| `toast.rediffPremier` | Rediffusion de {nom}, premier du jour | Replay of {nom}, today's first |
| `toast.rediffMeilleur` | Rediffusion de ton meilleur essai | Replay of your best run |

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
| `hud.astuces` | R : point de passage · Entrée : recommencer · G : fantôme · P : pause | R: checkpoint · Enter: restart · G: ghost · P: pause |
| `hud.pc.aria` | Point de passage {pc} sur {total} | Checkpoint {pc} of {total} |
| `hud.ecart.aria` | Écart avec ton record : {ecart} | Gap to your best: {ecart} |
| `hud.objectif.aria` | Médaille visée : {medaille}, {temps} | Target medal: {medaille}, {temps} |
| `hud.objectif.auteurBattu` | Diamant obtenu | Diamond earned |
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
| `pause.recommencer` | Recommencer à zéro | Start over from zero |
| `pause.pointDePassage` | Depuis le point de passage | From the checkpoint |
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
| `reglages.premier.aide` | Le meilleur essai du jour, en mauve, avec son pseudo, à côté de ton fantôme (cyan). Le fantôme (le tien, le premier, aucun) : le bouton en haut à gauche, la pause, ou la touche G. | Today's best run, in purple, with its name, next to your own ghost (cyan). The ghost (yours, first place, none): the button at the top left, the pause, or the G key. |
| `reglages.taches` | Taches de tout le monde | Everyone's stains |
| `reglages.taches.aide` | Les morts des autres joueurs du jour, plus pâles et plus petites que les tiennes : on voit où le niveau tue. | Other players' deaths today, paler and smaller than yours: you can see where the level kills. |
| `reglages.commandes` | Commandes | Controls |
| `reglages.clavier` | Clavier | Keyboard |
| `reglages.manette` | Manette | Gamepad |
| `reglages.tactile` | Tactile | Touch |
| `reglages.taille` | Taille des boutons | Button size |
| `reglages.taille.small` | Petits | Small |
| `reglages.taille.medium` | Moyens | Medium |
| `reglages.taille.large` | Grands | Large |
| `reglages.langue` | Langue | Language |
| `reglages.profil` | Mon profil Du Jour | My Du Jour profile |
| `reglages.mentions` | Mentions légales | Legal notice |

### resultat (`resultat.*`, `apps/jump/src/catalogue.arrivee.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `resultat.aria` | Résultat de ton essai | Your result |
| `resultat.classement` | Classement | Leaderboard |
| `resultat.suite` | Suite : {jeu} › | Next: {jeu} › |
| `resultat.record` | Nouveau record ! | New record! |
| `resultat.premier` | Premier temps du jour | First time of the day |
| `resultat.ecart` | {ecart} vs ton record | {ecart} vs your record |

### Thèmes (`theme.*`, `apps/jump/src/catalogue.base.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `theme.foret` | Forêt | Forest |
| `theme.usine` | Usine | Factory |
| `theme.glace` | Glace | Ice |
| `theme.nuit` | Nuit | Night |
| `theme.neon` | Néon | Neon |

## Tower

### Accueil (`accueil.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `accueil.aria` | Accueil de Tower | Tower home |
| `accueil.titre` | Tower | Tower |
| `accueil.tour` | Tour n° {numero} · {theme} | Tower no. {numero} · {theme} |
| `accueil.tourSansNumero` | Tour du jour · {theme} | Today's tower · {theme} |
| `accueil.phrase.port` | « Au large, le vent se lève. Les pièces le savent. Elles ont peur. » | “Out at sea, the wind is rising. The pieces know. They're scared.” |
| `accueil.phrase.chantier` | « Le contremaître est parti déjeuner. Les pièces te font confiance. Un peu. » | “The foreman went to lunch. The pieces trust you. A little.” |
| `accueil.phrase.canyon` | « Le canyon retient son souffle. Les pièces aussi. » | “The canyon holds its breath. So do the pieces.” |
| `accueil.phrase.banquise` | « La glace est lisse et les pièces glissent. Elles aimeraient que tu y penses. » | “The ice is smooth and the pieces slide. They'd like you to remember that.” |
| `accueil.phrase.jungle` | « La jungle grimpe plus vite que toi. Les pièces s'y accrochent. » | “The jungle climbs faster than you do. The pieces cling on.” |
| `accueil.phrase.nuit` | « Il fait nuit. Les pièces ne voient rien, mais elles sentent la tour penser à tomber. » | “It's night. The pieces can't see, but they can feel the tower thinking about falling.” |
| `accueil.record` | Ton record | Your record |
| `accueil.record.aucun` | Pas encore joué | Not played yet |
| `accueil.record.sous` | {medaille} · {suivante} à {seuil} | {medaille} · {suivante} at {seuil} |
| `accueil.record.sansMedaille` | {suivante} à {seuil} | {suivante} at {seuil} |
| `accueil.serie` | Série Tower | Tower streak |
| `accueil.serie.jours` | one : {n} jour · other : {n} jours | one : {n} day · other : {n} days |
| `accueil.serie.medailles` | one : {n} médaille · other : {n} médailles | one : {n} medal · other : {n} medals |
| `accueil.jouer` | Jouer | Play |
| `accueil.attente` | Chargement de la tour… | Loading the tower… |
| `accueil.aide` | Comment jouer | How to play |
| `accueil.paliers` | Aujourd'hui · {pieces} pièces · plateforme {plateforme} | Today · {pieces} pieces · {plateforme} platform |
| `accueil.paliers.aria` | Les paliers du jour | Today's milestones |
| `accueil.plateforme.5` | très étroite | very narrow |
| `accueil.plateforme.6` | étroite | narrow |
| `accueil.plateforme.7` | moyenne | medium |
| `accueil.plateforme.8` | large | wide |
| `accueil.classement` | Classement du jour | Today's leaderboard |
| `accueil.toutLeClassement` | Tout le classement › | Full leaderboard › |
| `accueil.prochaine` | Prochaine tour dans | Next tower in |
| `accueil.profil` | Mon profil Du Jour › | My Du Jour profile › |

### annonce (`annonce.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `annonce.palier` | Palier {metres} · {effet} sur la pièce suivante | Checkpoint {metres} · {effet} on the next piece |
| `annonce.palier.trois` | Palier {metres} · {effet} sur les trois pièces suivantes | Checkpoint {metres} · {effet} on the next three pieces |

### bot (`bot.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `bot.reflechit` | Le bot réfléchit… | The bot is thinking… |
| `bot.diamant` | Diamant du jour : {hauteur} | Today's Diamond: {hauteur} |

### Chargement (`chargement.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `chargement.texte` | Chargement de la physique… | Loading the physics… |
| `chargement.echec` | La physique n'a pas pu se charger. Recharge la page. | The physics couldn't load. Reload the page. |

### Classement (`classement.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `classement.titre` | Classement | Leaderboard |
| `classement.classes` | one : {total} classé · other : {total} classés | one : {total} ranked · other : {total} ranked |
| `classement.toi` | Toi | You |
| `classement.vies` | one : {n} vie · other : {n} vies | one : {n} life · other : {n} lives |
| `classement.chargement` | Chargement du classement… | Loading the leaderboard… |
| `classement.indisponible` | Classement indisponible : hors ligne. | Leaderboard unavailable: you're offline. |
| `classement.vide` | Personne n'est encore classé. Sois le premier. | Nobody is ranked yet. Be the first. |
| `classement.fermer` | Fermer | Close |
| `classement.refuse` | Ta partie n'a pas pu être classée. | Your game couldn't be ranked. |

### Commandes tactiles (`commande.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `commande.gauche` | Gauche | Left |
| `commande.droite` | Droite | Right |
| `commande.tourner` | Tourner | Rotate |
| `commande.descendre` | Descendre vite (maintenir) | Drop fast (hold) |

### Comment jouer (`aide.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `aide.titre` | Comment jouer | How to play |
| `aide.point1` | Pose les pièces une à une, le plus haut possible : la hauteur finale de la tour est ton score. | Stack the pieces one by one, as high as you can: the final height of the tower is your score. |
| `aide.point2` | Une pièce qui tombe sous la plateforme te coûte une vie. Tu en as trois. | A piece that falls below the platform costs you a life. You have three. |
| `aide.point3` | Tous les 8 mètres, un bonus ou un malus du jour s'applique à la pièce suivante. | Every 8 metres, a bonus or a penalty of the day applies to the next piece. |
| `aide.commandes` | Commandes | Controls |
| `aide.deplacer` | Déplacer | Move |
| `aide.tourner` | Tourner | Rotate |
| `aide.descendre` | Descendre vite | Drop fast |
| `aide.espace` | Espace | Space |
| `aide.ok` | C'est parti | Let's go |

### effet (`effet.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `effet.lierre` | Lierre | Ivy |
| `effet.figee` | Pièce figée | Frozen piece |
| `effet.petite` | Petite pièce | Small piece |
| `effet.geante` | Pièce géante | Giant piece |
| `effet.vent` | Coup de vent | Gust of wind |
| `effet.glissante` | Pièce glissante | Slippery piece |

### Fantômes (`fantome.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `fantome.bouton` | Fantôme : {nom} | Ghost: {nom} |
| `fantome.aucun` | Aucun | None |
| `fantome.meilleure` | Ma meilleure | My best |
| `fantome.diamant` | Diamant | Diamond |

### Fin de partie (`fin.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `fin.medailles` | Médailles du jour | Today's medals |
| `fin.medaille` | Médaille | Medal |
| `fin.medaille.aucune` | Aucune | None |
| `fin.medailles.encore` | {medaille} : encore {reste} | {medaille}: {reste} to go |
| `fin.medailles.toutes` | Tu as le Diamant. | You got the Diamond. |
| `fin.medailles.calcul` | Médailles en calcul… | Working out the medals… |
| `fin.medailles.session` | Meilleure médaille du jour : {medaille} | Best medal of the day: {medaille} |
| `fin.aria` | Fin de la partie | End of the game |
| `fin.eyebrow` | TOWER · Suite d'essai | TOWER · Practice run |
| `fin.eyebrow.jour` | TOWER · {date} | TOWER · {date} |
| `fin.eyebrow.paliers` | TOWER · Paliers | TOWER · Checkpoints |
| `fin.hauteurStable` | Hauteur stable | Stable height |
| `fin.plusHaute` | Plus haute atteinte : {hauteur} (ne compte pas) | Highest reached: {hauteur} (doesn't count) |
| `fin.vies` | Vies | Lives |
| `fin.partie` | Ta partie | Your game |
| `fin.posees` | Pièces posées | Pieces placed |
| `fin.tombees` | Pièces tombées | Pieces fallen |
| `fin.temps` | Temps | Time |
| `fin.rejouer` | Rejouer | Play again |
| `fin.phrase.pieces` | Les pièces respirent enfin. | The pieces can finally breathe. |
| `fin.phrase.vies` | Les pièces ne t'en veulent pas. Presque pas. | The pieces don't hold it against you. Not much. |
| `fin.eyebrow.tour` | TOWER · Tour n° {numero} · {theme} | TOWER · Tower no. {numero} · {theme} |
| `fin.classement` | Classement | Leaderboard |
| `fin.voirClassement` | Classement | Leaderboard |
| `fin.partager` | Partager | Share |
| `fin.rang.sur` | sur {total} | of {total} |
| `fin.rang.record` | sur {total} · nouveau record | of {total} · new record |
| `fin.rang.pasMieux` | Pas mieux que ton record du jour. | Not better than your record of the day. |
| `fin.rang.envoi` | Envoi de ta partie… | Sending your game… |
| `fin.rang.horsLigne` | Hors ligne, non classé : ta partie sera envoyée. | Offline, not ranked: your game will be sent. |
| `fin.rang.tropEnvois` | Trop d'envois : ta partie sera envoyée plus tard. | Too many sends: your game will be sent later. |
| `fin.rang.version` | Une nouvelle version du jeu est disponible. | A new version of the game is out. |
| `fin.rang.pseudo` | Choisis un pseudo pour entrer au classement. | Pick a name to join the leaderboard. |
| `fin.recharger` | Recharger | Reload |
| `fin.pseudo` | Ton pseudo | Your name |
| `fin.pseudo.ok` | Valider | Confirm |
| `fin.paliers` | Paliers franchis | Milestones passed |
| `fin.paliers.aucun` | Aucun | None |
| `fin.partage.copie` | Copié dans le presse-papiers. | Copied to the clipboard. |
| `fin.partage.partage` | Partagé. | Shared. |
| `fin.partage.echec` | Copie impossible : sélectionne le texte ci-dessous. | Couldn't copy: select the text below. |

### Jour (`jour.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `jour.pasEncore` | Ce jour n'est pas encore sorti : voici celui d'aujourd'hui. | That day isn't out yet: here is today's. |

### medailles (`medailles.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `medailles.provisoire` | Médailles provisoires | Provisional medals |

### Page (titre, chargement) (`page.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `page.titre` | Tower — Du Jour | Tower — Du Jour |
| `page.sansWebgl` | Ton navigateur ne peut pas afficher Tower : WebGL est nécessaire. | Your browser can't show Tower: WebGL is required. |

### palier (`palier.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `palier.bonus` | bonus | bonus |
| `palier.malus` | malus | penalty |

### Partage de la journée (`partage.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `partage.titre` | Du Jour · Tower #{numero} | Du Jour · Tower #{numero} |
| `partage.titreSansNumero` | Du Jour · Tower · {date} | Du Jour · Tower · {date} |

### Partie (surimpressions) (`hud.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `hud.aria` | Interface de la partie | Game interface |
| `hud.pause` | Pause | Pause |
| `hud.hauteur.aria` | Hauteur de la tour : {hauteur} | Tower height: {hauteur} |
| `hud.pieces.aria` | Pièce {n} sur {total} | Piece {n} of {total} |
| `hud.vies.aria` | one : {n} vie sur {total} · other : {n} vies sur {total} | one : {n} life out of {total} · other : {n} lives out of {total} |
| `hud.suivante` | Suivante | Next |
| `hud.suivante.aria` | Pièce suivante : {forme} | Next piece: {forme} |
| `hud.commandes` | Commandes | Controls |
| `hud.palier.aria` | Prochain palier à {metres} : {effet} ({type}) | Next checkpoint at {metres}: {effet} ({type}) |
| `hud.objectif.aria` | Prochaine médaille : {medaille}, à {hauteur} | Next medal: {medaille}, at {hauteur} |
| `hud.objectif.calcul` | Médailles en calcul… | Working out the medals… |
| `hud.objectif.diamant` | Diamant battu | Diamond beaten |

### Pause (`pause.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `pause.aria` | Pause | Pause |
| `pause.titre` | Pause | Pause |
| `pause.etat` | Pièce {n} sur {total} · {hauteur} | Piece {n} of {total} · {hauteur} |
| `pause.phrase` | Les pièces retiennent leur souffle. | The pieces are holding their breath. |
| `pause.reprendre` | Reprendre | Resume |
| `pause.recommencer` | Recommencer | Restart |

### suite (`suite.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `suite.legende` | Il te reste aujourd'hui | Still to play today |

### Thèmes (`theme.*`, `apps/tower/src/catalogue.*.ts`)

| Clé | Français | Anglais |
|---|---|---|
| `theme.port` | Port | Harbour |
| `theme.chantier` | Chantier | Building site |
| `theme.canyon` | Canyon | Canyon |
| `theme.banquise` | Banquise | Ice floe |
| `theme.jungle` | Jungle | Jungle |
| `theme.nuit` | Nuit | Night |
