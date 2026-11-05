# Lot B6 — Blocks : la musique (devenu un lot de la plateforme)

Branche `claude/funny-maxwell-e6w24n` (celle que la session impose ; le prompt disait `blocks/b6-musique`), PR brouillon **« Plateforme — musique de Blocks (boucles, couche, fondu) »**, sans étiquette `jeu:blocks`. Partie de `main` à jour (B5 fusionné). Le premier passage s'était arrêté : la musique de Tower vit dans des zones partagées. Nathan a ouvert `musique/**`, `packages/musique/**`, `packages/kit/src/jeu/**` (le fondu de fin seulement), les pages de mentions régénérées et les zones de Blocks, et décidé : un seul lot, **couche synthétisée par le lecteur (option A)**, fondu de fin, direction musicale proposée. « Pour les joueurs » : `rien` (Blocks n'est pas `on`, les autres jeux ne changent pas). **Aucun changement de barème, de rampe, de médailles, d'effets ni de simulation.**

## Vérifié, et ce qui ne l'est pas
- **Rien n'a été entendu** : ni les sept boucles, ni la couche, ni le fondu de fin, ni l'équilibre entre la musique et les effets. Aucun agent ne peut le faire ; **c'est à Nathan d'écouter** (liens en bas du message de PR). Les choix musicaux (timbres, niveaux de la couche, gains) sont des propositions écrites à l'aveugle, vérifiées seulement par des mesures et des tests (hauteurs, tempo, durée, crête, tonalité).
- **Vérifié par des tests** : les boucles (Vitest, `generateur.test.ts` : une boucle par scène, déterminisme, longueur, crête, jonction, **empreinte du rendu entier de chaque boucle de Tower et de Blocks contre `liste.json`**) ; le lecteur (`couche.test.ts` : entrée et sortie en fondu, notes sur la grille de la mesure à la milliseconde, recalage à chaque mesure, nappe quand le flux est irrégulier, réglages coupés, bus ; `baisser` avec durée ; `branche.test.ts`) ; le kit (`fondFin.test.ts`) ; Blocks (`musique.test.ts` : un morceau par scène et par thème, tonalité accordée aux effets, couche à ×3 et sortie) ; **e2e** `musique.spec.ts` (Chromium) : **aucune requête de musique ni contexte audio avant un geste**, un morceau par thème, « Couper la musique » met la sortie à zéro et la rallumer la rend, la couche se synthétise dès ×3, rien ne se synthétise musique coupée. `npm run verifier` et la CI de la PR : voir le message de PR.
- **Mesuré, Chromium de bureau seulement** : l'écart entre l'horloge du flux et celle du contexte (douze lectures) : **1,9 ms**, donc l'arpège est calé. **iPhone, Android, Safari et Firefox : non mesurés.**

## La couche livrée : arpège calé, avec repli en nappe
**Je livre les deux, choisis à chaque pas de 125 ms par une mesure faite sur l'appareil** (`couche.ts`) : un **arpège calé** quand les douze dernières lectures de « horloge du flux − horloge du contexte » varient de **20 ms au plus**, sinon (flux lu par bonds, comme certains mobiles, ou moins de douze lectures) une **nappe sans pulsation** (tonique et quinte tenues, étincelles au hasard sur la gamme du morceau), qui n'a besoin d'aucun calage. Pourquoi : je ne peux pas essayer l'iPhone, et le prompt demandait de ne pas forcer l'arpège s'il n'était pas tenable ; la décision est donc prise par l'appareil, pas par moi. Reste **non mesurable ici** : le retard fixe entre le flux et le contexte (quelques dizaines de ms, constant), que la mesure de l'écart ne voit pas. Si l'arpège sonne décalé à l'oreille sur un appareil, la parade est d'ajouter une constante de décalage dans `couche.ts` (`arpege`), ou de forcer la nappe (`calee()` rend `false`).
- **Arpège** : huit croches par mesure, **à contretemps** (une double-croche après chaque croche des notes pincées du morceau), tonique, quinte, octave seulement (elles vont avec tous les accords de la gamme), triangle, deux motifs qui alternent. Chaque mesure est **recalée sur la phase de la boucle** (`debutMesure` : l'horloge du flux relue à la mesure, avance ou retard repris), programmée au plus 0,6 s avant son début ; on rejoint une mesure en cours sans rejouer les notes passées.
- **Couche** : entrée et sortie en fondu d'environ 1 s (constante de temps 0,33 s), par le **bus du lecteur** : volume, « Couper la musique », muet et baisse du jeu s'appliquent ; rien n'est synthétisé à niveau nul ou page cachée. Niveau des notes : 0,05 au plus (≈ −26 dBFS en crête, soit environ 13 dB sous le niveau moyen d'un morceau à −18 LUFS : un calcul, pas une écoute). Au **combo ×3** (`SEUIL_COUCHE`), sortie à la perte du combo ou à la fin de la partie.
- **API** : `musique.couche(actif)` ; `musique.baisser(niveau, duree?)` (sans durée : 60 ms comme avant) ; `liste.json` porte `bpm`, `tonique`, `gamme` (facultatifs dans `musiques.json`, validés).

## Le fondu de fin (kit)
`partie.ts` + `fondFin.ts` : à la fin de la partie la musique retombe à **0,35 en 1,2 s** pendant « Plus de place ! », puis remonte à **1 en 1,5 s** sur l'écran de fin. `PartieDuJeu.finEnCours?()` (nouveau, facultatif) dit « jouée, la fin se montre encore » ; Blocks le donne. **Sans lui (Cibles), la musique retombe à l'ouverture de l'écran de fin et remonte 1,2 s plus tard** : c'est un changement audible pour Cibles (avant : saut à 1), voulu par « Blocks, Cibles ». Track, Jump et Tower ne bougent pas.

## Les boucles (famille `calme`, comme Tower)
Toutes sur **Do** (`tonique: 48`), la nuit sur **La mineur** (son relatif, 57) : les effets de B2 partent de Do₅ et montent d'un demi-ton par palier, donc ×1 et l'octave tombent justes et le palier ×3 (Ré₅) est un degré de la gamme de chaque morceau (testé). `barres` devient un paramètre de la fiche `calme` (24 par défaut) : **40 mesures** pour Blocks. La cloche ne rejoue pas le même motif au second tour (mélodie A2). Aucune reprise : tout est généré note par note par le code du dépôt.

| scène | titre | BPM | mode | durée | AAC |
|---|---|---|---|---|---|
| menu | Pièce par pièce (sans percussion) | 88 | do majeur | 109,1 s | 1,33 Mo |
| port | Brise du quai (percussions douces, écho) | 92 | do mixolydien | 104,3 s | 1,30 Mo |
| chantier | Pose à pose (petits clics) | 100 | do dorien | 96,0 s | 1,20 Mo |
| canyon | Poussière d'or (tambours doux) | 84 | do dorien | 114,3 s | 1,41 Mo |
| banquise | Givre (cristalline, sans percussion, long écho) | 88 | do lydien | 109,1 s | 1,34 Mo |
| jungle | Sous les lianes (tambours doux) | 96 | do mixolydien | 100,0 s | 1,23 Mo |
| nuit | Lumières de la ville (sans percussion) | 85 | la mineur | 112,9 s | 1,38 Mo |

**Écart au prompt** : le canyon est en **do dorien** (et non « dorien / phrygien léger ») : le phrygien met un ré♭ et un mi♭ sous les accords majeurs des effets ; Nathan n'avait pas tranché, je garde le plus proche de Do.

## Les boucles de Tower n'ont pas bougé (à l'octet)
Empreintes SHA-256 des WAV rendus (12 premiers caractères), **avant et après** le paramètre `barres` (les 64 caractères sont dans `liste.json`, et `generateur.test.ts` les compare au rendu entier) ; les AAC servis (`musique/servi/tower-*.m4a`) ne sont pas touchés non plus :
`menu ded1921150ce` · `port 34b0bda8df33` · `chantier bd0060171a16` · `canyon 7b841b024af0` · `banquise 554734a31708` · `jungle 3b900d22d1ac` · `nuit 41cfab435095`.
Track et Jump : leurs fiches et leurs AAC sont intacts (`git diff --stat` ne touche aucun `track-*`, `jump-*`).

## Le poids
- **Musique** : 7 boucles de 1,20 à 1,41 Mo, **9,2 Mo** ; `musique/servi/` passe de 17 Mo à **26 Mo** (29 morceaux, 26,6 Mo d'AAC). Servis à la demande, lus en flux, **hors du budget des jeux**.
- **Premier chargement de Blocks : +0 octet** (`blocks.jsCss` 46,75 Ko, inchangé) ; `branche.ts` pèse 332 o (≤ 0,5 ko, `poids.test.ts`). La scène et la couche sont dans le corps du jeu, à la demande.
- **Ligne `musique.lecteur` : 4 691 → 5 937 o** (+1 246 : la couche et sa logique pure, dans le lecteur chargé au premier geste). **Le plafond de 6 Ko ne tenait plus** : `budgets.test.ts` impose mesure + 10 % pour une ligne « à la demande », soit **7 Ko** (marge 1 063 o). C'est la règle des lignes, pas un relèvement de ma part ; **à confirmer par Nathan**. Le job de budgets avertit sans bloquer (+1 Ko).

## Ce que je n'ai pas fait, et ce qui reste à décider
- **Aucune zone e2e pour `packages/musique`** (`e2e/zones.json`, zone partagée non ouverte) : un changement qui ne touche que ce paquet ne relance pas `musique.spec.ts` (rattaché à `blocks-jeu` seulement : avec la zone `ui`, donc `packages/kit`, il aurait fait dépasser de 13 s le budget de 900 s d'une PR large, `ciZones.test.ts`). Un changement du kit ou du lecteur seul ne relance donc que les tests unitaires ; `main`, la nuit et la mise en production lancent tout. Les tests unitaires du paquet, eux, tournent toujours. Une zone `musique` serait un petit lot de plateforme.
- Mentions légales : les crédits des sept boucles sont écrits par `npm run musique` (« Du Jour (généré par le code) »). Les clés `blocks:*` des mentions restent à décrire avant `on` (inchangé).
- Le retard fixe du flux (voir ci-dessus), l'équilibre sonore (musique 0,6 en partie + couche + effets) et le choix des timbres : **à l'écoute de Nathan**.
