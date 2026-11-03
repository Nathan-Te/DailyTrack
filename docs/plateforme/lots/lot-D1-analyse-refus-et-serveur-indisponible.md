# Lot D1 — rediffusions refusées et « serveur indisponible » (analyse, sans code)

Rapport complet : `docs/plateforme/analyse-refus.md`. Reproduction locale : `scripts/analyse/reproduire-refus.ts` (à la main, jamais en CI ; commande en tête du fichier). Aucun code du serveur ni des jeux n'est changé ; aucun accès à la production.

## Les causes probables, en 5 lignes
1. **Confirmé en production** : 6 envois répondus en 200 après 8,1 à 10,9 s (Track ×1, Jump ×2, Tower ×3) alors que le jeu abandonne à 8 s : le joueur voit « indisponible », le serveur écrit son temps (H1). Pas de 5xx, base et conteneur au démarrage hors de cause ; vu dans les journaux : abandon à 8 s, renvoi 5 s après, **deux rejeux acceptés, aucun refus**. La lenteur est un **blocage de toute l'instance (≈ 8 s)**, cause inconnue ; et **chaque minuit** le premier `portail/jour` dure 5 à 10 s (génération du jour dans le fil principal, mesurée 1,9 s en local).
2. Les onglets restés ouverts pendant une mise en production : `version`, `sim_version`, `track_mismatch`, comptés « refusés » (reproduit ; 10 refus 409 en 7 jours).
3. Le renvoi d'une partie acceptée n'est **pas** un refus (H2 réfutée, reproduit) ; la grâce de minuit (`day_closed`) n'est pas comptée non plus.
4. Les 429 relevés (3) sont sur `/api/garage`, pas sur les envois ; aucun 500, 502 ou 503.
5. Déterminisme (H6) : non confirmé, non exclu — le tableau de bord ne montre qu'un total, sans le détail par code.

## Ce qui est reproduit
Coût d'un envoi (14 à 24 instructions SQL), abandon à 1 s puis résultat écrit tout seul, renvoi `200 improved=false` sans ligne au journal, un refus de chaque famille avec « compté / non compté » au journal, 429 (31ᵉ du joueur, 61ᵉ d'une adresse), 503 `busy`. Golden de `sim`, `jump-sim`, `tower-sim` : 31 tests verts.

## Vérifications pour Nathan (lecture seule, détail et filtres au § 4 du rapport)
Cloud Run › `cdj-api` › Journaux : envois en `200` de plus de 8 s ; 429 et 5xx (`jsonPayload.message="refus"`) ; 409 par heure. Métriques : latence p99, instances, démarrage des conteneurs. Région de la base Turso. Relevés faits le 3/11 : voir le § 6 du rapport. Processeur et mémoire relevés (§ 6 ter) : pics de processeur de la taille d'un calcul de 8 à 13 s à chaque minuit ; **mémoire passée de ≈ 20 % à 50-86 % depuis l'aperçu de Tower** (marge faible sur 512 Mo).

## Corrections proposées (après K2bc et K3, module commun)
**C3 délai d'envoi ≈ 20 s (S, à faire tout de suite)** · C9 niveau du lendemain calculé avant minuit (M) · C8 durées par étape et retard de la boucle d'événements (M) · C10 mémoire de Tower avant son ouverture (S à M) · C1 détail par code au tableau de bord (S) · C2 instrumentation sans donnée personnelle (M) · C4 message « Envoi en cours… » au lieu d'« indisponible » (M) · C5 renvoi déjà accepté : réponse avant le rejeu (S) · C6 limites par adresse ou `--cpu-boost`, sur preuve (décision de Nathan) · C7 `keepAliveTimeout`, sur preuve (S).

## Pour les joueurs
rien
