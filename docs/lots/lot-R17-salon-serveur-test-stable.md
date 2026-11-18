# Lot R17 (Track, CI) — le test du Salon serveur ne dépend plus de l'heure

**Cause** : `salon-serveur.spec.ts` jouait la session suivante du serveur, dont le circuit dépend de l'heure de l'horloge de test. Certains circuits n'ont pas de pilote lent qui finit (adhérence 0,7 à 0,5) : « aucun pilote ne finit ce circuit ».

**Fait** (ni le serveur ni la simulation ne changent)
- `apps/web/outils/salonSessionJouable.ts` : `choisirSessionJouable(courante)` prend, parmi les 3 sessions suivantes au plus, la première où des pilotes d'adhérence 0,95 à 0,5 finissent avec des temps différents ; rapide = le plus rapide qui finit, lent = le plus lent qui finit. Échec explicite (sessions essayées) sinon.
- `e2e/salon-serveur.spec.ts` l'utilise, attend le début de **cette** session (horloge du serveur) et règle son délai : `test.setTimeout(420 s + attente mesurée)` au lieu de 600 s fixes. Journal : `session choisie : N (courante + k, s sautée(s)), début dans X s`.
- Consigne : `docs/regles/racine/tests-et-ci.md`, « Écrire un test stable ».

**Preuve** (`salonSessionJouable-200.test.ts`, Régression, ≈ 105 s en local, ajouté à `regressionUnitaires` de `e2e/zones.json` et à `scripts/unit-durees.json` ; version courte `salonSessionJouable.test.ts`, ≈ 3 s, dans l'Essentiel)
- Sur 200 sessions consécutives depuis l'horloge des tests (20/10/2026 12 h) : **6 sessions injouables sur 203**, jamais deux de suite, donc **1 session sautée au plus** (la fenêtre de 3 en laisse 2 de marge).
- Les deux premières sessions de l'horloge (celles du run 44328803658) sont jouables avec la liste complète d'adhérences.

**Durée du spec** (Chromium, local) : avant, 341 s (`durees.json`, mesure de la nuit en CI) ; après, 368 s dont 173 s d'attente du début de session, soit ≈ 195 s de travail. L'attente (0 à 180 s) fait toute la variation, le travail n'a pas changé : en moyenne +3 % × 180 s ≈ +6 s (une session sautée ajoute 180 s). Pire cas : ≈ 195 + 180 + 180 s, sous le délai (420 s + attente). `durees.json` inchangé.

**Non vérifié** : l'ancienne version du spec n'a pas été relancée ici ; Firefox et WebKit (le spec est Chromium seul). Hors périmètre : `fantomes.spec.ts`.

**Pour Nathan** : relancer « Mettre en production ». Pour les joueurs : rien.
