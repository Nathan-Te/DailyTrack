import { marquerRetrouverVu, retrouverAPropos, verifierRetrouver } from "@cdj/profile/src/retrouver";
import { retrouverMonProfil } from "@cdj/ui/src/retrouver";

// Lot 53 : l'application ajoutée à l'écran d'accueil (iPhone) a son propre stockage, séparé de Safari : au premier lancement, sans profil, « Retrouver mon profil » (le code
// de transfert copié dans Safari, collé ici). **À la demande** (`import()` de `portail.ts`, seulement en mode application) : le premier chargement du portail n'en porte rien.
// Le même écran et la même vérification (`@cdj/ui`, `@cdj/profile`) que Track et Jump ; rien sans serveur (la vérification demande le profil au serveur). **Il n'importe rien de la page** : un module à la demande qui importe un module du premier chargement le fait éclater en plusieurs fichiers (la compression par fichier se perd).

/** `base` : le serveur (passé par le portail : ce module n'importe rien de la page, voir ci-dessus) ; `erreur` : le texte d'un code d'erreur du serveur dans la langue du portail, ou `null`. */
export function proposerRetrouver(base: string, stockage: Storage, erreur: (code: string) => string | null): void {
  if (!retrouverAPropos(stockage, true)) return;
  retrouverMonProfil({
    erreur,
    verifier: (saisi) => verifierRetrouver({ saisi, base, stockage }),
    onPasser: () => marquerRetrouverVu(stockage),
    onRetrouve: () => location.reload(),
  });
}
