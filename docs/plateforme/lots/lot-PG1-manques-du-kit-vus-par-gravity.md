# Lot PG1 (plateforme) — Les manques du kit vus par Gravity (GR1 à GR3)

Branche `claude/plateforme-kit-manques-gravity-nuzojt`, PR brouillon étiquetée `plateforme` (jamais `jeu:gravity`). **Aucun fichier de `apps/gravity/` (sauf `package.json`, point 3) ni de `packages/gravity-sim/`** : Gravity adopte les nouvelles pièces dans son propre lot (GR5). Sources : sections « zones partagées », « propositions » et « ce qui manque » des README GR1, GR2 et GR3.

## Point par point
| # | Point | État |
|---|---|---|
| 0a | Un jeu qui change ses thèmes ne sort plus de ses zones | **Déjà fait sur `main`** (lot K7) ; vérifié, rien à refaire (détail plus bas) |
| 0b | `franchissabilite-30-jours` en « Régression » | **Fait** ; l'hypothèse « jeu fictif (1/3) » **n'est pas confirmée** (plus bas) |
| 1 | Mentions légales FR + EN des clés de Gravity | **Fait** |
| 2 | Ligne « à la demande » par jeu du kit | **Fait** (`<id>.demande`, cinq jeux) |
| 3 | `three` et `@types/three` dans `apps/gravity/package.json` | **Fait**, `npm ci` passe |
| 4 | Kit : `chargerPartie` | **Fait** |
| 5 | Kit : HUD en surimpression | **Fait** |
| 6 | `@cdj/visuels` : piques, blocs qui changent, chevrons, flèches, accroche d'accessoire | **Fait** (aucune PR ouverte ne touchait au rendu de Jump : seules #312 et #314, de Rush) |

## 0. Deux corrections
- **a) Déjà sur `main`.** Le portail lit les noms de thèmes dans les fiches (`jeuxFiches`, `portail.theme.<jeu>.*`), le test des consignes découvre tous les `CLAUDE.md`, et `packages/musique/src/fiches.production.generated.ts` est dans les exceptions du job `zones`. **Vérifié** : `node scripts/jeu-fictif.mjs --sans-suite` joue « un lot de jeu qui change ses thèmes » (un thème ajouté, un renommé, deux `CLAUDE.md`) : « fichiers partagés touchés par le lot : **aucun** ». Le GR1 (PR #331) a donc rencontré un état d'avant K7.
- **b)** `packages/gravity-sim/test/franchissabilite-30-jours.test.ts` (≈ 30 s) est dans `regressionUnitaires` (`e2e/zones.json`) ; `franchissabilite.test.ts` (six jours) reste en PR. Règle écrite : **un test unitaire de plus de ~10 s va en Régression** (`tests-et-ci.md`, `docs/tests.md`, `CLAUDE.md` racine). **Hypothèse du GR2 : non confirmée, et elle ne peut pas l'être par ce classement** : la CI d'une PR ne lance déjà que les tests des zones touchées, mais le job « jeu fictif » (et `main`, la nuit, le bouton) lance **toute** la suite en trois parts, Régression comprise ; le fichier y reste donc. Mesuré en local : le déterminisme de Pinball dure 9,6 s seul ; en CI, sur 2 cœurs et à côté de 30 s de Gravity, il peut approcher les 30 s du délai d'un test (`vitest.config.ts`). Le dernier run du GR2 (PR #335) a son « jeu fictif (1/3) » vert. **Si le rouge revient : c'est le lot Pinball** (fractionner ou alléger `packages/pinball-sim/test/determinisme.test.ts`), ou une décision de Nathan sur ce que le jeu fictif lance.

## 1. Mentions légales
`gravity:records`, `:reglages`, `:aide:vu`, `:identite:vue` et la famille `gravity:…` dans les deux pages (`mentions-legales/` et `legal/`), à côté de Blocks, Rush et Pinball (même formulation). Test : `apps/portail/test/mentions.test.ts` — le test générique ne regarde Gravity que lorsque son catalogue n'a plus de « À remplacer » (GR4 / GR5 : **je n'ai pas touché `aide.point3`**) ; un test du lot (`lot PG1`) exige **dès maintenant** ses quatre clés dans les deux langues (à retirer à la livraison, le générique prend le relais).

## 2. Budgets
`<id>.demande` : `mesureJeuNeuf` mesure d'elle-même la somme gzip des JS et CSS que la fiche liste dans `budget.aLaDemande` (aucune retouche du reste de `scripts/budgets.mjs`), pour **Blocks, Rush, Vertige, Gravity et Pinball** (déclarée dans `budget.lignes` de leur fiche ; « Cibles », le témoin et le modèle du générateur, n'en a pas, `nouveau-jeu` n'écrit que `jsCss`). Plafonds (règle : mesure + 10 %, au Ko supérieur) : **Gravity 203 Ko (mesure 184 200 o, dont `scene-` ≈ 146 Ko)**, Pinball 213 Ko, Rush 307 Ko, Vertige 243 Ko, Blocks 59 Ko. Garde-fou contre la dérive, pas un blocage pour quelques octets (le job n'échoue que sur un dépassement). Les plafonds sont posés **sans relèvement** (règle B1) : Gravity grandira avec GR4 / GR5, à relever alors avec Nathan. `budgets.md`, `budgets.test.ts` (déclaration dans la fiche, tableau, mesures, `mesureJeuNeuf` sur un dossier fictif).

## 3. Lockfile
`three ^0.186.1` et `@types/three ^0.186.0` (comme Tower, Vertige, Pinball, Rush) ; `npm install` ne change que ces entrées du verrou (+3 −1), `npm ci` passe.

## 4. Kit : `chargerPartie?(contenu): Promise<void>`
Appelée **et attendue** par le kit au toucher de JOUER, avant le premier `nouvellePartie` ; l'accueil reste à l'écran avec « Chargement du jeu… » (écran d'attente du kit, après 250 ms), un refus donne « Réessaie » et réarme le bouton ; pas rappelée à « Recommencer ». **Écart au prompt** : elle reçoit le contenu du jour (un paramètre de plus : Gravity en a besoin pour son niveau ; sans paramètre elle reste valide). Sans elle, rien ne change. **Migration (pour Vertige et Gravity, dans leur lot)** : `packages/kit/CLAUDE.md`. Test : `apps/cibles/e2e/chargement-partie.spec.ts` (`?debug&chargement=1000`).

## 5. Kit : HUD en surimpression
`DefinitionJeu.hud: "surimpression"` + `OptionsPartie.zones` : quatre zones (`hautGauche`, `centre`, `hautDroite`, `annonce`) posées sur le plateau (`surimpression.ts`, `ecrans.css`, jetons seulement, marges de sécurité, `aria-hidden`, aucun toucher attrapé) ; le texte de la barre est **masqué (1 × 1 px) mais reste dans la page**. Classes du kit : `jeu-surimpression__valeur`, `__etiquette`, `__cartouche`. Test : `apps/cibles/e2e/surimpression.spec.ts` (`?debug&hud=surimpression` sur Cibles) en portrait 390 × 844 et 360 × 640 et en paysage 844 × 390 : zones dans la fenêtre, sous la barre, sans recouvrement, aucun bouton recouvert, annonce d'une seconde, « Recommencer » ; et sans le paramètre, la barre d'avant. Les 28 specs de Cibles passent.

## 6. `@cdj/visuels` (module `plateformes`)
Repris de Jump **sans changement**, branchés dans Jump : **piques avec cerne** (`trianglesDePiques`, `creerPiques`), **blocs qui changent** (`BLOC_FORME`, `BLOC_OPACITES`, `geometriesDeBloc`, `creerBloc` : Jump garde leurs états), **chevrons du tapis** (constantes, `beltTime`, `chevronAt`, `buildBeltArt`, shader ; sous-chemin `plateformes/three/tapis` sans `three`), **flèches du vent** (`ajouterFlecheDeVent`) et **`creerPersonnage(…).accessoire`** (groupe qui suit le corps, son écrasement, son penché, sa respiration et le retournement du `groupe`). Doc : `packages/visuels/CLAUDE.md` (tableau « ce qu'un jeu en grille 2D prend »). **Preuves** : (1) `test/plateformesPG1.test.ts` : empreintes des dessins **calculées sur l'ancien code avant de le déplacer**, plus l'accroche (repos, écrasement, penché, rebond, respiration, retournement) ; (2) `apps/jump/test/dessinFige.test.ts` : les piques de quatre niveaux de Jump, empreinte d'avant ; (3) **captures avant / après** : `main` et ce lot construits côte à côte, 6 scènes (nuit, néon, tapis, dangers, vent) × 4 moments, 1 280 × 720, horloge figée : **24 captures identiques au bit près** (horloge réelle : le dessin des blocs varie d'un run à l'autre, même sur `main`, donc non comparable). `jump.jsCss` : +0,55 Ko (marge restante 16 Ko).

## À adopter par Gravity (GR5, avec son GR4 en parallèle)
1. **HUD** : `hud: "surimpression"`, remplir `OptionsPartie.zones` ; retirer la règle de `hud.css` qui masque la barre.
2. **`chargerPartie`** : charger `scene` par `import()` dedans (plus par `contenuDuJour`), `nouvellePartie` synchrone.
3. **Dessins communs** : `creerPiques` / `trianglesDePiques` (attention : Gravity dessine deux pointes par case, Jump une : un choix de DA à faire), `BLOC_FORME` + `styleDeBloc` / `creerBloc` pour les blocs qui changent, `buildBeltArt` + `BELT_*` pour les chevrons, `ajouterFlecheDeVent`, au lieu de `dessins.ts`.
4. **Accessoire** : poser le bandeau dans `creerPersonnage(…).accessoire` (origine = bas-milieu de la boîte, comme `BANDEAU` aujourd'hui) et supprimer son écrasement propre.
5. **Budget** : ajuster `gravity.demande` (203 Ko) avec Nathan si le GR4 / GR5 la dépasse ; retirer le test `lot PG1` des mentions quand le catalogue n'a plus de « À remplacer ».

## Vérifié / non vérifié
**Vérifié** : `npx tsc -b` ; unitaires de `packages/visuels` (58), de `apps/jump` (51 fichiers, 881 tests), du portail (mentions, budgets, consignes), `apps/web/test/{ciZones,e2eSuite}` ; `node scripts/budgets-controle.mjs controler` (toutes les lignes) ; e2e de Cibles : 28 / 28 ; `jeu-fictif.mjs --sans-suite` ; `npm ci`. `npm run verifier` et la CI : voir la PR. **Non vérifié** : le job « jeu fictif » complet (trois parts, libSQL : en CI) ; Firefox / WebKit ; les e2e de Jump ne sont pas rejoués un à un (captures avant / après à la place) ; le job « Kit de bout en bout » (en CI : les squelettes générés reprennent Cibles, qui a gagné `?debug&chargement` et `?debug&hud`).

## Décisions laissées à Nathan
- La marge de 900 s des specs e2e d'une PR large est **épuisée** (un spec Essentiel de plus, même d'une seconde, fait échouer `ciZones.test.ts` « le budget ») : les deux specs du lot sont donc en **Régression** ; relever ce budget ou retirer du temps ailleurs est à décider.
- La passation de Gravity (`docs/gravity/passation.md`) **n'a pas été régénérée** : aucune des règles du lot n'y entre, et la régénération toucherait un fichier de la zone de Gravity (GR4 en parallèle) en changeant des lignes d'état sans rapport (classement, liste des jeux).

## Pour les joueurs
- [Du Jour] Les mentions légales décrivent aussi les données que Gravity garde dans ton navigateur. // The legal notice also describes the data Gravity keeps in your browser.
