# Lot D1 — rediffusions refusées et « serveur indisponible » (analyse, sans code)

Rapport complet : `docs/plateforme/analyse-refus.md`. Reproduction locale : `scripts/analyse/reproduire-refus.ts` (à la main, jamais en CI ; commande en tête du fichier). Aucun code du serveur ni des jeux n'est changé ; aucun accès à la production.

## Les causes probables, en 5 lignes
1. Un échec passager de l'aller-retour (429 d'une adresse partagée, 502/503/504, `busy`, coupure) suivi d'un renvoi réussi : Jump et Tower affichent « indisponible » pour tout cela (déduit du code).
2. Les onglets restés ouverts pendant une mise en production : `version`, `sim_version`, `track_mismatch`, comptés « refusés » (reproduit).
3. Le jeu qui abandonne à 8 s alors que le serveur écrit quand même (H1) : mécanisme reproduit, fréquence inconnue — il faut ≈ 320 à 570 ms par instruction SQL.
4. Le renvoi d'une partie acceptée n'est **pas** un refus (H2 réfutée, reproduit) ; la grâce de minuit (`day_closed`) n'est pas comptée non plus.
5. Déterminisme (H6) : non confirmé, non exclu — le tableau de bord ne montre qu'un total, sans le détail par code.

## Ce qui est reproduit
Coût d'un envoi (14 à 24 instructions SQL), abandon à 1 s puis résultat écrit tout seul, renvoi `200 improved=false` sans ligne au journal, un refus de chaque famille avec « compté / non compté » au journal, 429 (31ᵉ du joueur, 61ᵉ d'une adresse), 503 `busy`. Golden de `sim`, `jump-sim`, `tower-sim` : 31 tests verts.

## Vérifications pour Nathan (lecture seule, détail et filtres au § 4 du rapport)
Cloud Run › `cdj-api` › Journaux : envois en `200` de plus de 8 s ; 429 et 5xx (`jsonPayload.message="refus"`) ; 409 par heure. Métriques : latence p99, instances, démarrage des conteneurs. Région de la base Turso. Rapporter les chiffres dans la conversation.

## Corrections proposées (après K2bc et K3, module commun)
C1 détail par code au tableau de bord (S) · C2 instrumentation sans donnée personnelle (M) · C3 délai d'envoi ≈ 20 s (S) · C4 message « Envoi en cours… » au lieu d'« indisponible » (M) · C5 renvoi déjà accepté : réponse avant le rejeu (S) · C6 limites par adresse ou `--cpu-boost`, sur preuve (décision de Nathan) · C7 `keepAliveTimeout`, sur preuve (S).

## Pour les joueurs
rien
