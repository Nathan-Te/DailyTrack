# Lot S2 (plateforme) — le son des jeux se mêle à celui du téléphone

Décision de Nathan : un jeu du jour **se mêle** au son du joueur (vidéo, Spotify), il ne le coupe pas. Contrepartie : sur iPhone, l'interrupteur « silence » coupe aussi le jeu.

## Ce qui change
- **Une fonction commune** : `ouvrirContexteAudio` (`@cdj/core/audio`) pose `navigator.audioSession.type = "ambient"` (quand l'API existe) **puis** ouvre le contexte. Track (`audio.ts`, planche son de la vitrine), Jump, Tower, Blocks, Rush et `@cdj/musique` passent par elle. Cibles n'a aucun son. Plus aucun `"playback"`.
- **La musique sans élément média** : `@cdj/musique` télécharge le morceau, le décode (`decodeAudioData`) et le joue par un `AudioBufferSourceNode` dans le bus existant. Fondus, enchaînements, scènes, reprise d'une page à l'autre, baisse, sourdine, couche de Blocks : inchangés. Plus de `new Audio()` ni de `createMediaElementSource`. Pas de Media Session.
- **Au plus deux morceaux décodés** (`TAMPONS_MAX`, `etat().tampons`) : celui qui joue et le suivant, préchargé pendant que le premier joue ; un échec n'est pas gardé et se retente après 10 s.
- **Position lue sur l'horloge du contexte** (elle s'arrête avec `suspend()` en arrière-plan). Effet de bord voulu : la couche de Blocks est toujours un arpège calé (la nappe n'est plus que le repli d'une horloge qui saute).
- **Test qui garde la règle** : `packages/core/test/sonMelange.test.ts` (échoue si `new Audio(`, `createMediaElementSource`, `"playback"`, élément média, Media Session, `audioSession` ou `AudioContext` hors de la fonction commune apparaissent dans un `src`). Tests du lecteur réécrits sur des tampons ; `apps/blocks/e2e/musique.spec.ts` adapté (aucune nouvelle spec) : il vérifie un décodage, une lecture Web Audio et aucune lecture d'élément média.

## Mémoire mesurée (Mo décodés, stéréo flottant 32 bits, 44,1 kHz / 48 kHz — `ffmpeg -f f32le` sur chaque fichier de `musique/servi/`)
| jeu | morceaux (id : 44,1 / 48) | deux à la fois, au pire |
|---|---|---|
| Track | campagne 24,6/26,8 · menu 24,2/26,3 · banquise, ville 23,0/25,0 · canyon 21,9/23,8 · col 21,5/23,4 · nuit 21,2/23,0 · stade 20,5/22,3 · rallye 19,4/21,1 | 53 |
| Jump | glace 24,2/26,3 · nuit 21,9/23,8 · menu 21,2/23,0 · foret 19,4/21,1 · neon, usine 18,1/19,7 | 50 |
| Tower | **nuit 29,0/31,6** · banquise 26,7/29,1 · canyon 25,4/27,6 · menu 23,1/25,1 · port 22,1/24,0 · jungle 21,2/23,0 · chantier 20,3/22,1 | 61 |
| Blocks | **canyon 40,3/43,9** · nuit 39,8/43,4 · banquise, menu 38,5/41,9 · port 36,8/40,1 · jungle 35,3/38,4 · chantier 33,9/36,9 | **87** |

**Dépassent 30 Mo : les 7 morceaux de Blocks (36,9 à 43,9 Mo à 48 kHz) et `tower-nuit` à 48 kHz (31,6).** Rien n'est réencodé. Propositions, à choisir par Nathan :
1. **Contexte musical à 24 kHz** (`new AudioContext({ sampleRate: 24000 })`, Safari ≥ 14.5) : la moitié, soit 18 à 22 Mo pour Blocks ; coupe au-dessus de 12 kHz (des boucles chip/calmes, à écouter).
2. **Mono** (`-ac 1` dans la préparation `npm run musique`, donc de nouveaux fichiers : accord de Nathan) : la moitié aussi ; perd la largeur stéréo. Les deux ensemble : le quart (≈ 10 Mo).
3. **Boucles de Blocks plus courtes** (40 mesures = 96 à 114 s ; 24 mesures = 58 à 68 s, comme Tower) : −40 %.
4. Garder en l'état : ≈ 90 Mo de tampons sur Blocks, risque de rappel de l'onglet sur un vieil iPhone — **non mesuré sur appareil**.

## Vérifié / non vérifié
- **Vérifié** : typecheck, tests du lecteur (152 dans `packages/musique`), de la fonction commune, du garde-fou, de Blocks/Tower/Track/Rush ; spec e2e Blocks de la musique (10 tests, Chromium : décodage AAC et lecture par Web Audio réels) ; budgets (toutes les lignes tiennent ; `musique.lecteur` +0,41 Ko, 6,34 pour 7).
- **Non vérifié, faute de téléphone** : que la vidéo/musique du joueur continue sur **iPhone et Android** (le comportement de Web Audio avec le focus audio d'Android, et l'effet de `ambient` sur iOS < 16.4, où l'API n'existe pas) ; la durée de téléchargement + décodage du premier morceau (le premier son attend le fichier entier, 0,7 à 1,4 Mo, et son décodage, là où le flux démarrait aux premiers octets) ; la mémoire réelle sur téléphone.
- Limite connue : un décodage en cours d'un morceau abandonné (changement de scène) existe en mémoire jusqu'à sa fin.

## Scénario pour Nathan (aperçu de la PR, au téléphone)
1. Lancer une vidéo YouTube ou Spotify, ouvrir `/jump/` et jouer : elle continue, le son du jeu s'y mêle (iPhone puis Android).
2. `/tower/` : la musique joue, s'enchaîne et baisse comme avant.

## Pour les joueurs
- [Du Jour] Le son des jeux ne coupe plus ta musique ou ta vidéo : il s'y mêle. Sur iPhone, l'interrupteur silence coupe aussi le jeu. // Game sounds no longer stop your music or video: they mix in. On iPhone, the silent switch now mutes the game too.
