# Lot N2 — Nouveautés et message en direct

Branche `claude/relaxed-goodall-3oxnrk`, PR brouillon. Consignes : `apps/api/CLAUDE.md` et `apps/portail/CLAUDE.md` (« Nouveautés et message en direct (lot N2) »), `apps/web/CLAUDE.md` et `apps/jump/CLAUDE.md` (« Message en direct »). Coûts : `docs/plateforme/couts.md` § 9.
**La maquette `docs/plateforme/maquettes/admin-et-nouveautes.html` (planches 1, 4 et 5) et la charte rév. 11 § 9 (« Nouveautés », « Message en direct ») n'étaient pas dans le dépôt** (comme au lot N1) : la charte existante est appliquée (jetons, composants du socle) ; à comparer avec la maquette à la relecture.

## Le format « Pour les joueurs » (dans toute PR de lot)
Le modèle de PR (`.github/pull_request_template.md`, nouveau) a la section `## Pour les joueurs` : `- [Track] Français. // English.` (zones `Du Jour`, `Track`, `Jump`, sans casse ni accents ; une ligne par changement visible), ou `rien` seul. Règle dans le `CLAUDE.md` racine et `docs/orchestration.md` § 11. Lecture : `lirePourLesJoueurs` (`packages/core/src/nouveautes.ts`) — ligne mal formée gardée **telle quelle, à retoucher** (zone inconnue, rien après la zone, pas de puce), anglais manquant lu mais bloquant à la publication, commentaires du modèle ignorés, section absente signalée.

## La lecture des PR et ses limites
Faite **par le navigateur de l'éditeur** sur l'API publique de GitHub (aucun secret, rien pour le serveur ; `connect-src https://api.github.com` dans la CSP de `/admin/` seulement, test). `adminGithub.ts` : l'étiquette `prod-AAAA-MM-JJ-HHMM` est une **heure de Paris** ; la fenêtre va de l'**étiquette d'avant** à maintenant (les PR de la mise en production en cours, puis celles « pas encore en production »), sans les PR « robot » (« Jours figés — … »). Limites : **60 requêtes par heure et par adresse, 10 recherches par minute** ; une visite de Nouveautés en coûte 3, le tableau de bord 1 ; résultats gardés en mémoire de la page, délai de 10 s, message qui donne l'heure de reprise et laisse écrire à la main ; au plus 200 PR. Écart assumé à la lettre du prompt : la fenêtre part de l'étiquette **précédente** (sinon « pas encore en production » ne désignerait que des PR par définition toutes concernées) ; le tableau de bord, lui, compte les PR **après l'étiquette en cours**.

## Les tables (migration réversible : `DROP TABLE nouveautes`, `DROP TABLE annonces`)
`nouveautes` (titres FR / EN, date affichée, lignes JSON avec la PR d'origine, statut, dates) et `annonces` (textes FR / EN, où, ton, début, fin, retrait). Aucune donnée de joueur : **gardées** à la remise à zéro. Chaque action de l'éditeur est au journal du lot N1 **dans la même transaction**. Test d'une base « d'avant » et du retour arrière.

## La livraison du message et son coût
Le message actif est dans `GET /api/portail/jour` (portail : **toujours une requête au chargement**) ; `GET /api/annonce` le rend seul, `public, max-age=0, s-maxage=30` ; chaque page ouverte et visible le relit toutes les 60 s (`surveillerAnnonce` de `@cdj/profile` : visibilité, minuterie et réseau injectés ; `suspendre()` = plus rien). **Délai : 45 s en moyenne, 90 s au pire.** Il s'éteint à l'heure de fin même servi par un cache (le client compare `fin` à l'heure du serveur). **Mesuré** (`npm run measure:annonce -w @cdj/api`) : 1 ligne lue, ≈ 0,8 ms, ≈ 711 octets par requête qui arrive à Cloud Run ; avec le cache de Hosting (modèle) Cloud Run voit ≤ 120 requêtes/heure par point de présence ; **100 / 1 000 / 10 000 pages : 6 000 / 60 000 / 600 000 requêtes Hosting par heure, 3,7 / 37 / 372 Mo — à 10 000 pages une heure dépasse le transfert gratuit de Hosting (360 Mo par jour)** : décision de Nathan notée dans `couts.md` (relecture plus lente, ou retirer les en-têtes de sécurité de cette réponse).

## Où le bandeau apparaît
- **Portail** : en tête de l'accueil, fermable, revient si le message change (`cdj:annonce:fermee`), « Important » ne se ferme qu'après 10 s ; `role="status"`, sans focus.
- **Track** : accueil, arrivée, pause ; **jamais en course ni sur un autre écran, ni au Salon**, ni sans serveur ou en démo ; `suspendre()` dès qu'une course commence (aucune lecture ni minuterie). Chargé à la demande ; +754 o au premier chargement.
- **Jump** : accueil, arrivée, pause ; jamais pendant un niveau ni un carnage ; +1 890 o au premier chargement (import statique : la mesure compte tout le JS).
- Un message qui arrive pendant une course attend l'écran suivant.

## Ce que voient les joueurs
Ligne « Nouveautés · date » sous les tuiles (point terre tant que non lue, `cdj:nouveautes:lu`, jamais de point sans stockage) et page `/nouveautes/` (par date, 20 par page, « Plus anciennes », FR / EN, étiquette de zone, axe). Textes en français et en anglais (`npm run traductions`, mentions légales FR et EN mises à jour : deux tables, deux clés, lecture de GitHub par le panneau).

## Pour les joueurs (cette PR)
- [Du Jour] Un message en direct peut s'afficher en haut du portail. // A live message can appear at the top of the portal.
- [Du Jour] Une ligne « Nouveautés » sur l'accueil et une page Nouveautés racontent ce qui change. // A "What's new" line on the home page and a What's new page tell you what changes.
- [Track] Le message en direct s'affiche à l'accueil, à l'arrivée et en pause, jamais pendant une course. // The live message shows on the home screen, the finish screen and the pause menu, never during a race.
- [Jump] Le message en direct s'affiche à l'accueil, à l'arrivée et en pause, jamais pendant un niveau. // The live message shows on the home screen, the finish screen and the pause menu, never during a level.

## Vérifié / non vérifié
À compléter en fin de lot (voir ci-dessous).
