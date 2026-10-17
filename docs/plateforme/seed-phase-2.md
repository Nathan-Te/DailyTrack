# Seed — Phase 2 : le socle serveur commun (DailyTrack + DailyJump)

Source de vérité de la phase 2 du portail de jeux quotidiens. Vit dans `docs/plateforme/seed-phase-2.md` du dépôt DailyTrack, n'est modifié que par Nathan. S'appuie sur le guide technique de DailyTrack (§§ 3.8 à 3.12, 5) et sur le seed de DailyJump (§ 10).

---

## 1. La phase en une phrase
Un seul serveur, une seule identité et un seul pseudo pour tous les jeux du portail ; DailyJump y gagne un classement du jour prouvé par rejeu, le fantôme du premier, et surtout les morts de tous les joueurs : leurs taches dans le niveau et leur carnage à l'arrivée.

## 2. Les principes
1. **DailyTrack ne change pas de comportement.** Ses routes, ses tables, ses réponses et ses tests restent tels quels ; tout ce qui est ajouté l'est à côté. Ses golden et sa suite de l'API sont le garde-fou de chaque lot.
2. **Le serveur ne croit jamais un temps, ni une mort.** Tout ce qui est classé ou montré aux autres joueurs a été rejoué par le serveur avec le code de `jump-sim`.
3. **Une identité pour tous les jeux.** Le même identifiant secret, le même pseudo (propriété du premier, lot 30 de DailyTrack), le même code de transfert, le même profil synchronisé.
4. **Les jeux marchent sans serveur.** Sans réseau, DailyJump se joue exactement comme aujourd'hui ; le serveur ajoute, il n'est jamais nécessaire pour jouer.
5. **Pas de tâche de fond, budget maîtrisé.** Tout est calculé et nettoyé à la demande (Cloud Run éteint le conteneur) ; chaque nouvelle route a son coût mesuré en requêtes et en lignes Turso lues et écrites.
6. **Données minimales.** Pas de compte, pas d'e-mail, adresses hachées pour la limitation de débit seulement, journaux sans rediffusion, pseudo ni identifiant (règles de DailyTrack).

## 3. Ce que le joueur de DailyJump y gagne
- **Le classement du jour** : son rang parmi tous les joueurs, le top 10 et sa position à l'écran d'arrivée ; le rang entre dans la ligne à partager : `DailyJump #12 — 31,402 s — 🥇 — 47 💀 — 3ᵉ/128`.
- **Le fantôme du premier** : la rediffusion du meilleur essai du jour, à côté de son propre fantôme.
- **Les taches de tout le monde** : en jouant, les taches des morts de tous les joueurs du jour, en plus pâle que les siennes ; on voit où le niveau tue.
- **Le carnage du jour** : à l'arrivée, après son propre carnage, « le carnage de tout le monde » : un échantillon des vies des autres joueurs, rejouées avec son essai en héros, par vagues comme aujourd'hui.
- **Le profil commun** : historique et série gardés par le serveur (le meilleur gagne, comme DailyTrack), le même pseudo et le même code de transfert dans les deux jeux.

## 4. L'identité commune
- Les deux jeux sont servis par la **même origine** (`nathan-te.github.io`, sous `/DailyTrack/` et `/DailyTrack/jump/`) : ils partagent le stockage local. DailyJump lit donc directement l'identité de DailyTrack (clés `cdj:*`, inchangées) ; un joueur de DailyTrack arrive dans DailyJump avec son pseudo, sans rien faire.
- Le code d'identité côté client devient un **module commun** (lecture, création, pseudo, code de transfert, profil), utilisé par les deux jeux ; les clés et le format du code de transfert de DailyTrack ne changent pas.
- Côté serveur, la table `players` reste celle de DailyTrack ; un joueur n'existe toujours qu'après une course ou un essai valide, dans l'un ou l'autre jeu.
- **Au passage au nom de domaine (phase 3)**, l'origine changera : le code de transfert servira de pont ; la migration est un sujet de la phase 3.

## 5. Le serveur
- **La même API** (`createApi`, Cloud Run, Turso) : un rejeu de DailyJump coûte ≈ 7 ms, Cloud Run l'absorbe. Les routes de DailyJump vivent sous `/api/jump/…` ; celles de DailyTrack ne bougent pas.
- **Le niveau que le serveur valide** : celui que le jeu joue, par la même règle que le client — le **fichier figé** du jour s'il existe, sinon `dailyLevel(jour)` du même code, mis en cache en base (un seul calcul même si deux requêtes arrivent ensemble, comme les circuits de DailyTrack). Les fichiers figés font partie de l'image de l'API.
- **Versions** : un envoi déclare `JUMP_SIM_VERSION`, `JUMP_GENERATOR_VERSION` et l'identifiant du niveau ; toute différence avec le serveur est refusée avec un message clair (« une nouvelle version du jeu est disponible »), jamais un rejeu faux.
- **Seul le jour en cours** accepte des envois (minuit de Paris, avec la même grâce que DailyTrack) ; les archives, les thèmes forcés, les essais aux réglages modifiés et les aperçus de branche n'envoient jamais rien.
- **Ce qui est envoyé** :
  - à chaque nouvel essai réussi meilleur que le précédent : sa rediffusion ; le serveur la rejoue et garde **son** temps (morts et reprises comprises, comme décidé au lot 2) ;
  - les **vies** de la journée, par lots (à l'arrivée et à intervalles), plafonnées par joueur et par jour ; le serveur les rejoue et en tire les morts (position, cause) : seules les morts rejouées comptent.
- **Ce que le serveur rend** : le classement du jour (top et rang du joueur), la rediffusion du premier, un échantillon de vies pour le carnage du jour (≈ 150, réparties entre les joueurs et le long du niveau), la carte des morts du jour (comptes agrégés par tuile).
- **Limitation de débit avant tout rejeu**, plafonds de taille, SQL paramétré, requêtes testées sur SQLite **et** libSQL, schéma versionné par empreinte : les règles de DailyTrack s'appliquent telles quelles.
- **Budget** : mesurer les requêtes d'un joueur type (une partie, une arrivée, un partage) et les lignes Turso lues et écrites par table ; les morts s'agrègent sans écrire une ligne par mort.

## 6. Le client de DailyJump
- **En ligne quand c'est possible, hors ligne sinon** : file d'envois gardée en local et rejouée au retour du réseau ; le jeu ne bloque jamais sur une requête.
- **`VITE_API_URL` seulement dans la construction de `main`** : un aperçu de branche n'écrit jamais dans la vraie base.
- **Mode démo** (`?api=demo`) comme DailyTrack : des joueurs fictifs déterministes, calculés par le vrai code de l'API en mémoire, pour tester le classement, le fantôme du premier, les taches et le carnage de tout le monde sur un aperçu, en deux clics.
- Écran d'arrivée : rang et top 10, bouton « Fantôme du premier », bouton « Le carnage de tout le monde » ; en jeu : interrupteur « taches de tout le monde » dans le menu.

## 7. Méthode
- Les règles des deux jeux s'appliquent (un lot = une session = une branche = une PR brouillon ; prompt au gabarit habituel ; scénario lançable en deux clics ; rapport honnête).
- **Zone partagée par nature** : la phase 2 touche `apps/api`, le module d'identité commun et parfois `packages/core`. **Aucun lot de DailyTrack ne touche ces zones pendant un lot de la phase 2** : Nathan coordonne entre ses conversations.
- Chaque lot laisse **inchangés** les golden des deux jeux et la suite de tests de l'API de DailyTrack (aucun test modifié pour passer).
- Consignes de la plateforme : `docs/plateforme/consignes.md` (importé par le `CLAUDE.md` racine), sur le modèle de `docs/jump/consignes.md`.
- Mise en production : l'agent prépare, Nathan déploie (secrets, Cloud Run, Turso) en suivant un guide pas à pas, comme au lot 28 de DailyTrack.
- **Rien ne part en production sans recette** (lot R1) : un lot qui touche le serveur est vérifié sur sa version de recette, avec l'aperçu de sa branche, avant la fusion ; la production attend la validation de Nathan.

## 8. Plan en lots
- **Lot R1 — L'environnement de recette.** Un serveur et une base de recette ; chaque PR y déploie sa version et son aperçu lui parle ; le déploiement en production attend la validation de Nathan ; les aperçus ont leur propre stockage local. Guide pas à pas pour Nathan.
- **Lot R2 — L'hygiène du dépôt.** Consignes par zone (un `CLAUDE.md` par dossier, racine réduite à la carte et aux règles communes), filtres de CI par chemin, une synthèse à jour par jeu.
- **Lot P0 — Le socle commun, invisible.** Module de profil commun côté client (DailyTrack l'utilise sans changement de comportement), registre des jeux côté serveur, espace `/api/jump/` avec une route de lecture qui prouve que le serveur calcule le même niveau que le jeu, image de l'API qui contient `jump-sim` et les jours figés, consignes de la plateforme. **À tester** : DailyTrack joue et se synchronise comme avant ; `/api/health` complet.
- **Lot P1 — Le classement prouvé.** Envoi du meilleur essai, rejeu serveur, classement du jour, rang à l'arrivée et dans la ligne à partager, file d'envois hors ligne, mode démo, mesure du budget. **À tester** : `?api=demo`, finir, voir son rang parmi les joueurs fictifs.
- **Lot P2 — Le fantôme du premier et le profil commun.** Rediffusion du premier, historique et série synchronisés (`/api/me` par jeu), pseudo et code de transfert communs. **À tester** : jouer sur deux appareils avec le même code.
- **Lot P3 — Les morts de tout le monde.** Envoi des vies, rejeu, carte des morts agrégée, taches de tout le monde, carnage du jour ; budget mesuré. **À tester** : `?api=demo`, voir les taches des autres puis leur carnage.
- **Lot P4 — Mise en ligne.** Guide pas à pas, essai de bout en bout contre le vrai déploiement (jamais la vraie base), surveillance des coûts.
- **Ensuite : phase 3** (portail commun, série tous jeux confondus, nom de domaine, publicité et consentement).

## 9. Décisions
- **Le but est une plateforme** : plusieurs jeux quotidiens, un **profil partagé par tous les jeux**. Tout ce qui est commun (identité, pseudo, code de transfert, profil, limitation de débit, configuration) est écrit une fois pour la plateforme ; chaque jeu s'y branche par un **registre des jeux** côté serveur. Ajouter le jeu n° 3 = l'inscrire au registre et écrire sa validation, sans toucher aux autres.
- **Tout le reste suit DailyTrack** :
  - pseudos : la règle de DailyTrack (propriété du premier, normalisation, refus et suggestions), la même pour tous les jeux ;
  - classement d'un jour passé : figé, consultable, jamais modifié ; meilleur essai et rediffusion de chaque joueur gardés comme les résultats de DailyTrack (le fantôme du premier reste disponible dans les archives) ;
  - vies brutes d'un jour : oubliées à la première requête qui voit le jour terminé, comme les sessions du Salon ; seules restent la carte des morts agrégée et l'échantillon du carnage du jour.
- Le jeu n° 3 n'est pas décidé ; le registre doit le rendre simple.
