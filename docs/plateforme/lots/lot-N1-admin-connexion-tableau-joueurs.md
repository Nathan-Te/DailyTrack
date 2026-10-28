# Lot N1 — Le panneau d'administration : connexion Google, tableau de bord, joueurs, journal

Branche `claude/zen-fermat-oces8s`, PR brouillon. Consignes : `apps/api/CLAUDE.md` et `apps/portail/CLAUDE.md` (rubriques « Administration / Le panneau d'administration (lot N1) »). **Les étapes de Nathan, clic par clic : `docs/plateforme/admin.md`** (≈ 25 min, une seule fois ; sans elles le panneau « n'existe pas » et le déploiement réussit quand même).

## Ce qui est fait
`/admin/` (production et recette) : connexion avec le compte Google de l'éditeur, **tableau de bord** (joueurs du jour, nouveaux profils, Track et Jump finis, courbe de 14 jours, état du site, dernières actions), **joueurs** (recherche, fiche, cinq actions), **journal** (200 dernières actions). Menu : Tableau de bord · Joueurs · Nouveautés et Message en direct (éteints, « bientôt » : lot N2) · Journal · Track (mène à `/track/admin/`) · Jump (éteint : pas d'outil). Français seulement. Le jeton `ADMIN_TOKEN` ne sert plus qu'aux outils de Track, qui acceptent aussi la session (en transition).
Captures (`docs/plateforme/lots/img/lot-N1-{tableau,fiche}-{ordinateur,telephone}.png`, outil `captures-lot-n1.spec.ts`).

## La connexion, pas à pas
1. La page `/admin/` charge le script de Google (`accounts.google.com/gsi/client`, **autorisé par la CSP de cette page seulement**) et montre son bouton.
2. Google rend un jeton d'identité ; la page l'envoie à `POST /api/admin/session` (en-tête `X-Cdj-Admin: 1`, `Origin` du site).
3. Le serveur le vérifie **sans dépendance** (Web Crypto) : signature RS256 sur les clés publiques de Google (en cache selon leur `Cache-Control`), `iss`, `aud` = notre identifiant client, `exp`, `email_verified`, puis l'adresse dans la liste du secret `cdj-admin-emails` (comparée par empreinte).
4. Il pose le cookie **`__session`** : `HttpOnly; Secure; SameSite=Strict`, 1 heure, signé HMAC (`cdj-admin-session-key`), sans adresse (une empreinte), **révocable** (ligne de `admin_sessions`).
5. Chaque requête relit la session ; chaque écriture exige `X-Cdj-Admin: 1` et une `Origin` permise ; toutes les réponses sont `no-store`.

## Ce qu'un attaquant ne peut pas faire, et pourquoi
- **Entrer avec un jeton forgé, périmé ou d'une autre application** : signature, `aud`, `exp` vérifiés ; `alg` autre que RS256 refusé ; une clé inconnue ne provoque qu'une relecture des clés par minute.
- **Entrer avec un autre compte Google** : l'adresse doit être dans le secret. Le refus n'a **qu'un visage** (401, sans cookie) : on ne distingue ni « mauvaise adresse » ni « mauvais jeton » (la raison technique n'est que dans le journal du serveur, sans l'adresse). 10 essais par fenêtre.
- **Forger ou rejouer une session** : sans la clé de session on ne signe rien ; la déconnexion la révoque côté serveur ; une heure de vie ; changer la clé les invalide toutes.
- **Faire agir le navigateur de l'éditeur depuis un autre site (CSRF)** : cookie `SameSite=Strict`, en-tête `X-Cdj-Admin` + `Origin` exigés, `confirmer: true` dans chaque action.
- **Lire le cookie par un script** : `HttpOnly` ; la page n'écrit jamais de HTML (`textContent`), la CSP interdit script et style en ligne.
- **Obtenir l'identifiant secret d'un joueur** : il ne sort jamais (une référence publique de 12 caractères le nomme).
- **Activer le vérificateur factice en ligne** : `readConfig` lève une `ConfigError` en production, en recette et sur Cloud Run (le serveur s'arrête) ; testé.
- **Trouver l'adresse de l'éditeur** : ni dans le dépôt, ni dans une réponse, un journal ou ce rapport.
- **Un aperçu de PR ne donne pas accès** : son adresse n'est pas chez Google et il n'a jamais le factice.

## Tables ajoutées (migrations additives, retour arrière en commentaire de `db.ts`)
`admin_sessions` (gardée), `journal_admin` (**vidée** à la remise à zéro ; 365 jours), `journal_erreurs` (gardée ; 14 jours ; code, route, heure ; écriture bornée à 60 par minute), `resultats_retires` (**vidée**, effacée avec le joueur ; rediffusion gardée 30 jours). Colonnes `players.hidden` / `players.ref`, `results.hidden`, `jump_results.hidden`, `salon_runs.hidden` ; index `results_by_visible`, `jump_results_by_visible`, `players_by_ref`, `players_by_created`, `players_masques`. Trois codes d'erreur : `forbidden`, `invalid_action`, `unknown_result`. Mentions légales FR et EN mises à jour (rubrique « L'administration du site », 4 constantes).

## Les cinq actions (confirmées, journalisées **dans la même transaction**)
Renommer · masquer / démasquer (tous les classements écartent `hidden = 1` ; **le joueur ne voit aucune différence**) · retirer un résultat (motif, rediffusion gardée 30 jours puis effacée, la même ne revient pas : `replay_copy`) · supprimer le profil (retaper le pseudo ; le journal ne garde que le pseudo) · voir une rediffusion (lien du lecteur du jeu s'il existe : Jump pour le premier du jour ; Track n'en a pas).

## Définitions des chiffres
**Joueur du jour** = un joueur distinct avec **au moins un résultat classé (rejoué par le serveur)** ce jour de Paris, dans Track ou Jump (les deux jeux = une fois ; masqués et fictifs de la recette comptés ; ni Salon ni vies seules). **Nouveaux profils** = `players.created_at` dans le jour. **Track / Jump finis** = résultats classés du jour (Jump : et les morts envoyées). **Erreurs serveur** = statuts ≥ 500 ; **rediffusions refusées** = refus d'une rediffusion sur une route d'envoi ; 24 h. **PR depuis la dernière mise en production** : place réservée, sans chiffre (lot N2).

## Coûts (`docs/plateforme/couts.md` § 8)
Tableau de bord : ≤ 1 calcul par minute et par instance (jours fermés gardés en mémoire). Aucune requête ne lit une table entière (test `EXPLAIN QUERY PLAN`). Les masqués s'écartent par index. **Les « lignes lues » sont des estimations d'après les plans, pas le compteur de Turso** (pas de Docker ici). Poste cher : la fiche d'un joueur (≈ 14 lignes par jour joué et par millier de classés).
Poids : portail premier chargement **26 400 o** (+ 1 123 o ; plafond 30 720), page d'admin de Track 11 668 o (plafond 12 500) : `budgets.md` à jour.

## Pour les joueurs : rien
Aucun écran, texte ni route publics ne change ; un joueur masqué ne voit aucune différence ; golden et jours servis inchangés (`SIM_VERSION` / `GENERATOR_VERSION` intactes).

## Vérifié / non vérifié
**Vérifié** : tests unitaires (vérification du jeton : signature, `aud`, expiration, hors liste ; session : signature, expiration, révocation ; refus du factice en production et en recette ; les cinq actions et leur effet sur les classements ; migration sur une base « d'avant » synthétique) sur SQLite **et** libSQL ; **un seul test dans le navigateur** (connexion › joueur › renommer › journal, sous la CSP réelle de `/admin/`, axe, téléphone) ; `node scripts/securite-workflows.mjs` : 10 workflows, 0 écart ; budgets ; traductions régénérées.
**Non vérifié** : la connexion Google **réelle** (écran de consentement et identifiant client à créer par Nathan : recette, 2 clics, `admin.md` § 4) ; la migration sur une **copie réelle de la recette** (testée sur une base synthétique) ; les coûts sur Turso ; le déploiement des secrets (workflow modifié, jamais lancé : un agent ne lance rien).
**Écarts** : la maquette du panneau et la charte rév. 11 § 9 n'étaient pas fournies : la charte existante est appliquée ; l'index `results_by_time` devient redondant (laissé : retirer un index = autre lot). Nouveaux ports e2e réservés : 4190, 8810 (4191, 8811 pour les captures).

## Décisions laissées à Nathan
Retirer le jeton des outils de Track (autre lot) · ajouter une seconde adresse à la liste (`admin.md` § 5) · relire les deux pages de mentions légales (rubrique ajoutée).

## Runs de CI
_(à compléter après la poussée)_
