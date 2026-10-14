# Retouche 31b — La CI redevient verte

**Pas de scénario de jeu à tester** : rien ne change dans le jeu, l'API ni `sim` (versions 14 / 15, golden inchangés). Seuls des tests e2e, leurs fixtures, la CI et deux scripts changent.

**Objet** : le verdict `e2e` était rouge sur `main` depuis la fusion du lot 31 ([#55](https://github.com/Nathan-Te/DailyTrack/pull/55), run [38585187062](https://github.com/Nathan-Te/DailyTrack/actions/runs/38585187062)) et l'est resté après le lot 0 DailyJump (run [38595927537](https://github.com/Nathan-Te/DailyTrack/actions/runs/38595927537)) ; toute PR en héritait (exemple : [#57](https://github.com/Nathan-Te/DailyTrack/pull/57), qui ne touche que DailyJump).

## Ce qui échouait, et pourquoi

Méthode : journaux et traces des runs rouges (artefacts `resultats-chromium-*`), puis reproduction locale **sur 2 cœurs** comme le runner (`taskset -c 0,1`), test par test. Aucune relance « pour voir », aucun test sauté, aucune assertion retirée.

| Test | Symptôme en CI | Vraie cause | Correction |
|---|---|---|---|
| `salon-serveur.spec.ts` (1er essai) | « bascule commune » : écart 2 094 ms puis 1 540 ms pour < 1 500 | **Mesure fausse.** L'instant de bascule était l'heure de retour, côté Node, d'un `waitForFunction` : elle compte l'attente d'un fil principal occupé par le rendu logiciel (dans la trace, un simple `evaluate` sur la page d'Alice a attendu **33 s**). Côté Node, Bob basculait à fin + 0,28 s et Alice à fin + 2,4 s. Le lot 31 avait resserré le seuil de 3 000 à 1 500 ms sur cette mesure | Mesure **dans chaque page, sur l'horloge du Salon** (celle du serveur) : chaque image note l'heure ; on garde la dernière image de l'ancienne session et la première de la nouvelle. Assertions : jamais avant l'heure pile, pas plus tard qu'une image (+ 600 ms, la règle de `salon.spec.ts`), même instant pour les deux pages à une image près. Mesuré en local (2 cœurs) : Alice + 557 ms (image de 606 ms), Bob + 137 ms (image de 373 ms), écart 420 ms |
| `salon-serveur.spec.ts` (relance) | `#finish .rank` jamais affiché (120 s) | **Test non rejouable.** La relance retrouve le même serveur (base en mémoire) où, depuis le lot 30, « Alice » appartient à l'identité du premier essai : refus « Ce pseudo est déjà utilisé » (visible dans l'instantané de la trace), course jamais classée. La relance ne pouvait que rater, sans rien dire du premier échec | Pseudos propres à chaque essai (`Alice`, `Bob` ; `Alice2`, `Bob2` à la relance) |
| `watch.spec.ts:16` (instable) et `watch.spec.ts:52` | délai de 180 s dépassé, page qui ne répond plus | **Pages laissées ouvertes.** `watch-serveur.spec.ts` (et `salon-serveur.spec.ts`) ouvrent des contextes avec `newClockedContext` sans les fermer ; Playwright ne ferme que le contexte de la fixture `page` : deux pages du Salon continuaient de dessiner en rendu logiciel pendant **tous les tests suivants du worker**. Reproduit à coup sûr : `vitesse` → `watch-serveur` → `watch:16` en série, le premier chargement de `watch:16` prend 77 s et le test échoue ; seul, il passe en 26 s | `e2e/fixtures.ts` ferme à la fin du test tout contexte ouvert par `newClockedContext` / `newContextAt` ; un spec en série qui garde ses appareils d'un test à l'autre le dit (`keepOpen`, utilisé par `profil.spec.ts` pour A et C, qu'il ferme lui-même au dernier scénario). Après correction : `watch:16` en 16 s dans la même série |
| `thumbnails.spec.ts:103` (cache), `:204` ; `profil.spec.ts:82` ; `salon.spec.ts:229` (instable) | délais dépassés, 4 images au lieu de > 5 en 2 s | **Deux tests lourds côte à côte sur 2 cœurs, choisis au hasard du découpage.** `--shard` coupe la liste des tests par **nombre**, fichier entier, dans l'ordre alphabétique. Les onze tests de `futur.spec.ts` (lot 31) ont déplacé toutes les frontières : la part 7 de Chromium est devenue **vide** (5 s), la part 8 a reçu les miniatures **et** le spectateur (16 min, chaque miniature 20 à 26 s au lieu de 3 à 5), la part 5 le planning à côté du profil et du Salon. Avant le lot 31 la part 8 durait 4,8 min et les miniatures étaient seules dans la part 7 | **Un test à la fois** dans les parts Chromium (`--workers=1`) et des parts composées **par durée mesurée** (`scripts/e2e-parts.mjs`, `apps/web/e2e/durees.json`), voir ci-dessous |

### Un test à la fois : mesuré, pas supposé
La part 8 de `main` rejouée en local sur 2 cœurs :

| | 2 workers (comme la CI) | 1 worker |
|---|---|---|
| Durée de la part | 10,9 min | 11,3 min |
| Échecs | 3 (`watch:16`, `watch:52`, `thumbnails:204`) | 1 (`watch:16`, la page laissée ouverte, corrigée depuis) |

Sur 2 cœurs, le second worker ne fait **rien gagner** : deux pages en WebGL logiciel se partagent le processeur et le processus GPU, chacune va deux à trois fois moins vite, et les délais des tests ne tiennent plus. Un seul worker rend chaque test indépendant de ses voisins.

### Des parts composées par durée
`scripts/e2e-parts.mjs <part>/<total> chromium` lit `apps/web/e2e/durees.json` (secondes par spec, mesurées en série sur 2 cœurs) et pose les specs du plus long au plus court sur la part la moins chargée ; il écrit une liste pour `playwright test --test-list` (« `[chromium] › fichier` » = tous les tests du fichier). Un spec absent du tableau pèse 60 s et le script le signale ; `apps/web/test/e2eParts.test.ts` échoue si un spec manque au tableau ou si un fichier du tableau a disparu, et vérifie que chaque spec est dans exactement une part. Firefox et WebKit (rapides, sans WebGL lourd) gardent `--shard`.

**Tenir le tableau à jour** : le résumé du run (`e2e`, onglet *Summary*) donne maintenant, repliées, les **durées Chromium par fichier** au format de `durees.json` ; un lot qui ajoute un spec y ajoute sa ligne.

## Fichiers
- `apps/web/e2e/salon-serveur.spec.ts` : bascule mesurée dans la page ; pseudos par essai.
- `apps/web/e2e/fixtures.ts` : contextes supplémentaires fermés en fin de test, `keepOpen` ; `apps/web/e2e/profil.spec.ts` : `keepOpen` pour A et C.
- `.github/workflows/ci.yml` : parts Chromium par durée, `--workers=1`.
- `scripts/e2e-parts.mjs` (+ `.d.mts`), `apps/web/e2e/durees.json`, `apps/web/test/e2eParts.test.ts`.
- `scripts/e2e-summary.mjs` : durées Chromium par fichier dans le résumé (`chromiumSeconds`, testé dans `e2eSummary.test.ts`).

## Vérifications
À compléter : runs de CI de la branche.
