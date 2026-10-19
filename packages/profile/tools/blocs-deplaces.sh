#!/usr/bin/env bash
# Lot P0 (plateforme) : preuve que les tests d'identité ont été DÉPLACÉS d'apps/web vers packages/profile sans changer une assertion.
# Compare les blocs `describe(` de premier niveau (entiers, octet pour octet) des fichiers d'apps/web avant le lot (révision BASE) avec ceux
# des mêmes fichiers et des nouveaux fichiers de packages/profile/test. Usage, depuis la racine : bash packages/profile/tools/blocs-deplaces.sh [BASE]
set -euo pipefail
BASE="${1:-2e51804}" # main juste avant le lot P0
OLD="apps/web/test/transfer.test.ts apps/web/test/api.test.ts apps/web/test/online.test.ts"
NEW="packages/profile/test/transfer.test.ts packages/profile/test/client.test.ts packages/profile/test/identity.test.ts packages/profile/test/profile.test.ts"
blocks() { awk '/^describe\(/ { inb = 1 } inb { print } inb && /^\}\);$/ { inb = 0; print "" }'; }
sorted() { python3 -c "import sys; b=sys.stdin.read().split('\n\n'); print('\n\n'.join(sorted(x.strip('\n') for x in b if x.strip())))"; }
before=$(for f in $OLD; do git show "$BASE:$f" | blocks; done | sorted)
after=$(for f in $OLD $NEW; do blocks < "$f"; done | sorted)
if diff <(echo "$before") <(echo "$after"); then
  echo "Blocs identiques : $(grep -c '^describe(' <<< "$before") blocs, $(grep -cE '^\s*expect' <<< "$before") lignes expect — diff vide."
else
  echo "Les blocs diffèrent (ci-dessus)." >&2
  exit 1
fi
