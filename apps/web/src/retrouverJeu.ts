import { encodeTransfer, readPlayerId } from "@cdj/profile";
import { marquerRetrouverVu, retrouverAPropos, verifierRetrouver } from "@cdj/profile/src/retrouver";
import { retrouverMonProfil } from "@cdj/ui/src/retrouver";

// Lot 53 : l'application ajoutée à l'écran d'accueil (iPhone) a son propre stockage, séparé de Safari. **À la demande** (`import()` de `main.ts`, seulement en mode
// application) : rien de tout cela n'est dans le premier chargement. **Ce module n'importe rien du jeu** (ni `api`, ni `i18n`, ni `storage` : `main.ts` lui passe ce qu'il
// faut) : un module à la demande qui importe un module du premier chargement le fait éclater en plusieurs fichiers, et la compression par fichier se perd (mesuré, budgets.md).
// `proposerRetrouver` : au premier lancement, sans profil, « Retrouver mon profil » (le code de transfert, copié dans Safari, collé ici) ; `codeDeTransfert` : ce que l'aide du
// plein écran peut copier (`reglerAideIphone`, `main.ts`).

/** Le code de transfert de ce navigateur, ou `null` s'il n'a pas encore de profil. */
export function codeDeTransfert(stockage: Pick<Storage, "getItem"> | null): string | null {
  const id = stockage ? readPlayerId(stockage) : null;
  return id ? encodeTransfer(id) : null;
}

/** « Retrouver mon profil », si c'est le premier lancement de l'application sans profil. `base` : le serveur (jamais la démonstration, jamais hors ligne : l'appelant l'a vérifié). */
export function proposerRetrouver(base: string, stockage: Storage, erreur: (code: string) => string | null): void {
  if (!retrouverAPropos(stockage, true)) return;
  retrouverMonProfil({
    erreur,
    verifier: (saisi) => verifierRetrouver({ saisi, base, stockage }),
    onPasser: () => marquerRetrouverVu(stockage),
    onRetrouve: () => location.reload(),
  });
}
