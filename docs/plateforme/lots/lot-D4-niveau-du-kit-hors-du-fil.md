# Lot D4 — Le niveau du jour des jeux du kit ne bloque plus le serveur

Branche `claude/kit-day-level-worker-thread-cb437z`, PR en brouillon. **Pour les joueurs : rien.** Niveaux, seuils et golden : inchangés (aucun fichier de jour touché). Règle : `apps/api/CLAUDE.md`, « Le niveau du jour des jeux du kit » → `docs/regles/api/le-niveau-du-jour-des-jeux-du-kit-lot-d4.md`.

## Ce qui change (serveur seulement, aucun jeu nommé)
- **Calcul dans le fil** : `definirJeuNeuf` expose `niveauDuJour` ; `niveauxFil.ts` (`DemandeKit`, `servirNiveaux`) le fait tourner dans **un second fil** du script `niveaux-fil.mjs` (`server.ts`, délai 5 min). Les **seuils** y sont calculés avec le niveau : Rush les calculait paresseusement dans `seuils` (≈ 1 s sur le fil principal, vu au profil). Jump et Track : même fil que D3, code inchangé.
- **Accueil sans attente** : `ContratJeu.jourSansNiveau` (jeu : numéro + thème du calendrier `themeDuJour`, `seuils: null`, `provisoire: true`, cache public 5 s au lieu de 60 s). Le classement et `/api/jeux` ne lisaient aucun niveau : ils étaient figés avec la boucle.
- **Gardé en base** : `meta` (`niveau:<jeu>:<jour>`, version du code `revision`), pas de table nouvelle ; seulement si ≤ 16 Ko et JSON sans perte (Rush : 300 à 417 Ko de tableaux typés, recalculé dans le fil). Une autre version du code recalcule.
- **Préparé à l'avance** : `preparerAuDemarrage` (aujourd'hui puis demain, jeux non éteints) + la demi-heure d'avance de D3.

## Mesures (`npm run measure:niveaux-kit -w @cdj/api`, Xeon 2,1 GHz)
| jeu | niveau + seuils, dans le fil (3 jours, 17 au 19/11) | gardé en base |
|---|---|---|
| Pinball | **14 à 21 s** | 0,3 Ko |
| Gravity | 0,8 à 1,5 s | 0,2 Ko |
| Rush | 0,3 à 0,6 s | non (300 à 417 Ko) |
| Vertige · Cibles · Blocks | ≤ 0,2 s | ≤ 0,7 Ko |

**Accueil, instance froide, tous les jeux du kit visibles** (local, processeur libre) : premier `GET /api/portail/jour` **6 à 34 ms** (Pinball, Gravity, Rush, Vertige, Cibles, Blocks, sans seuils ni attente), les suivants 1 à 4 ms ; `/api/jeux` 1 ms, classement 1 à 2 ms ; boucle bloquée **6 ms** pendant les 18 calculs (avant : tout l'accueil figé pendant les 14 à 21 s de Pinball). Les ≈ 100 ms de retard au démarrage d'une instance (schéma, fils) existent sans le kit (Track et Jump seuls : 93 à 111 ms). Avec Track et Jump visibles, le premier accueil attend leur niveau (fil de D3, inchangé) : 1,5 à 1,6 s, 1,9 s quand le kit calcule en même temps (le processeur se partage). Mémoire : le second fil ajoute ≈ 100 Mo (352 à 426 Mo au total contre 265 à 289 Mo).

## Tests (`apps/api/test/niveauxKit.test.ts`, SQLite et libSQL)
Jeu fictif aux seuils de 3 s dans un vrai `worker_threads` : accueil, `/api/jeux`, classement < 500 ms et boucle < 100 ms ; un témoin sur place fige la boucle ≥ 2,4 s ; garde en base, même niveau et même empreinte ; autre version du code ; valeur abîmée ; JSON sans perte de chaque jeu du registre.

## Pour Nathan / non vérifié
- **Aperçu** : à mesurer une fois la PR poussée (temps de réponse de l'accueil de l'aperçu, instance froide, Pinball et Gravity visibles) : le résultat est ajouté ci-dessous, ou dit « non mesuré » avec la raison.
- **Cloud Run (`--cpu=1`, processeur limité hors requête)** : un calcul de fond n'avance vraiment que pendant une requête ; sur 1 vCPU le fil du kit partage aussi le processeur avec le fil principal. Si l'aperçu montre des seuils tardifs, la décision (`--no-cpu-throttling`, coût) est à toi ; je ne l'ai pas prise.
- Ce lot doit être fusionné **avant** de passer Pinball ou Gravity `on` en production.
- Décision de conception : le thème du calendrier est une ligne ajoutée aux six contrats (`themeDuJour`), hors zones de jeu mais sans effet sur leurs niveaux.
