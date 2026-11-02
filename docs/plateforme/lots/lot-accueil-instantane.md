# Lot « accueil instantané » : le portail s'affiche sans attendre le serveur

Zone : `apps/portail` (partagée, lot de la plateforme). Aucun changement de serveur, de jeu, de golden ni de version.

## Le constat (relevé de Nathan, 2 novembre 2026)
Sur l'accueil, Track et Jump apparaissent tout de suite ; Tower (sorti ce jour-là), la série, le classement et la ligne des nouveautés arrivent 1 à 2 s plus tard.

## Cause (lue dans le code)
- Track et Jump ont un numéro de jour **local** (`cartes()`, `jours.ts`) : `rendre()` les dessine avant tout appel réseau.
- Tower a `numero: 0` à dessein (il n'existe que si le serveur le liste, Nathan l'active depuis `/admin/`), donc il est filtré tant que la réponse n'est pas là. Série, classement, nouveautés, « Mes jeux » et le message en direct viennent tous de **la même requête**, `GET /api/portail/jour`, faite avec `cache: "no-store"`.

## Mesures (recette et production, depuis le bac à sable de l'agent, derrière un proxy : le réseau est bruité, lire les ordres de grandeur)
Temps jusqu'au premier octet moins l'établissement TLS ≈ le temps du serveur :

| requête | temps serveur |
|---|---|
| `/robots.txt` (statique, Hosting) | ≈ 0,03–0,09 s |
| `/api/portail/jour` **sans joueur** (réponse publique, `public, max-age=60`, servie par le CDN : `x-cache: HIT`) | ≈ 0,04 s |
| `/api/portail/jour` **avec un joueur connu** (recette, joueur de démonstration : `private, no-cache`, Cloud Run + base à chaque visite) | **≈ 0,4 s en régime établi**, 0,8 s sur les deux premiers essais |
| première requête après un moment sans trafic (démarrage à froid de Cloud Run) | ≈ 1,1 s (recette), ≈ 0,6 s (production) |

À cela s'ajoute l'aller-retour réseau du visiteur (TLS compris, plusieurs centaines de ms sur mobile) : on retrouve les 1 à 2 s observés. **Un joueur connu paie la requête complète à chaque visite ; un visiteur sans profil, non** (CDN).

## Ce que fait le lot
`src/cacheJour.ts` : la dernière réponse de l'accueil est gardée dans le navigateur (`cdj:portail:jour`) et **affichée tout de suite** à la visite suivante ; la réponse fraîche la remplace (le serveur reste la seule vérité). **Seulement pour un navigateur qui a un profil** (la réponse d'un visiteur est publique, le CDN la sert déjà vite ; rien n'est écrit chez lui). Une seule requête au chargement, comme avant (testé par `portail-jour.spec.ts`).

La copie n'est **jamais montrée** :
- pour un autre jour de Paris, ni après le prochain minuit ;
- pour un autre joueur : elle porte la révision d'identité (`cdj:identite:rev`) et n'est plus lue dès qu'un code est chargé ou changé ; ni sans profil dans le navigateur ;
- avec un état de jeu qui a pu changer : seuls les jeux **finis** gardent leur état (« pas joué » et « en cours » reviennent du serveur) ;
- avec le message en direct (il vient de la réponse fraîche : un message retiré ne réapparaît pas).

Serveur injoignable pendant que la copie est à l'écran : la copie reste, avec le message discret habituel. Stockage refusé : tout fonctionne comme avant.

**Donnée de jeu** : `cdj:portail:jour` n'est pas dans `CLES_GARDEES`, donc effacée au « Nouveau départ » ; nommée dans les deux pages de mentions légales (FR et EN), `mentions.test.ts` le vérifie.

## Vérifié / non vérifié
Voir la PR. Non vérifié : le gain mesuré sur un vrai téléphone (il dépend du réseau du joueur) ; la production n'est pas touchée avant « Mettre en production ».

## Décisions laissées à Nathan
- Un joueur qui vient de jouer et revient sur l'accueil voit, un instant, sa **série et son rang d'avant** (corrigés à la réponse) ; l'état des jeux « pas joué » / « en cours » n'est pas montré pour cette raison.
- Piste suivante si le temps serveur reste long : lancer la requête avant le chargement du script (`<link rel=preload>`), ou alléger le calcul pour un joueur connu (c'est lui qui coûte 0,4 s).
