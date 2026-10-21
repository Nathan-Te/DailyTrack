# Lot 14 — Caméra calme (DailyJump)

Retour de Nathan : « trop de secousses de la caméra, un simple saut fait trembler tout l'écran ». Affichage seulement : `packages/jump-sim`, golden et rediffusions inchangés.

## État des lieux (avant)
| Déclencheur | Effet | Amplitude | Durée |
|---|---|---|---|
| Mort (partie du joueur) | secousse | 0,35 tuile | ≈ 0,22 s (décroissance 1,6 tuile/s) |
| Atterrissage de grosse chute (≥ 85 % de la chute maximale) | secousse | 0,12 à 0,32 tuile | ≈ 0,08 à 0,20 s |
| Saut, saut mural, ressort, tapis, glace, vent | aucune secousse | — | — |
| Suivi vertical | zone morte de 2,5 tuiles, mais recalage au sol à 6 /s à chaque atterrissage | — | — |
| Carnage | zoom arrière ×1,3 (mode, pas une secousse) | — | inchangé |

**Cause probable du tremblement ressenti : le suivi vertical.** Un saut complet monte de ≈ 4,2 tuiles ; l'image étant posée 1,5 tuile au-dessus du personnage au sol, il dépassait la zone morte (2,5) et tirait l'image vers le haut, puis chaque atterrissage la ramenait vite (6 /s). Chaque saut faisait donc bouger tout l'écran.

## Après
| Déclencheur | Amplitude | Durée |
|---|---|---|
| Mort | 0,1 tuile (Réduites : 0,05) | 0,12 s |
| Atterrissage de grosse chute | 0 (réglable dans `?debug&tune`) | 0,12 s si réglé |
| Toute autre action | aucune secousse | — |

| Caméra verticale | Avant | Après |
|---|---|---|
| Zone morte (demi-hauteur) | 2,5 tuiles | 3,2 tuiles (un saut complet reste dans la zone) |
| Recalage au sol, dans la zone | 6 /s | 1,5 /s |
| Suivi hors de la zone (chutes, longues montées) | 6 /s | 6 /s |

## Réglages
- `?debug&tune` : section « Caméra et secousses » en tête du panneau (amplitude et durée par déclencheur, zone morte, recalage, suivi). Gardée dans `jump:camera`, sans effet sur `tuned`.
- Réglages du joueur : « Secousses de l'écran » (Normales / Réduites / Aucune), défaut Réduites si `prefers-reduced-motion`. Catalogues fr + en, `npm run traductions` fait.

## Vérifié
- Vitest `apps/jump` : aucune secousse pour saut, saut mural, atterrissage (même grosse chute), ressort, tapis, glace, vent ; secousse courte et légère (≤ 0,15 s) à la mort ; Aucune → zéro ; Réduites → moitié ; saut complet depuis le sol sans mouvement de l'image ; recalage doux ; suivi d'une chute ; anciens réglages relus ; parité des catalogues (tests du socle).
- e2e Chromium : `sensations`, `themes`, `poids`.
- Budget de premier chargement : 376 242 o / 378 490 (marge 2 248 o, était 3 146 o).
- Non vérifié : la sensation à la main (c'est à Nathan de régler, avec les liens ci-dessous). Avec le mouvement réduit du système, « Mouvement réduit » (actif par défaut) coupe déjà les secousses : « Réduites » ne se voit qu'une fois celui-ci désactivé.

## Scénario en 2 clics
Liens d'aperçu : voir le commentaire de la PR (adresse `…/jump/`) ; avec réglage : ajouter `?debug&tune` (la section Caméra est en tête) ; sans debug : l'adresse seule.
