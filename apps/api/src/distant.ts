/**
 * Lot R14 — **rien n'écrit dans Turso sans qu'on l'ait dit.** Un script qui vise une base distante (ou un serveur déployé, pour `smoke`) l'écrit en clair et exige `--distant` ;
 * les tests, les outils de mesure et tout ce qui tourne en local restent sur un fichier ou sur la mémoire (`file:`, `:memory:`, un `sqld` sur la machine).
 * Code pur, sans dépendance : testé dans `apps/api/test/distant.test.ts`.
 */

/** Hôtes qui désignent la machine elle-même (un `sqld` lancé en local, le serveur d'essai). */
const BOUCLE = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", "host.docker.internal"]);

/** L'hôte d'une adresse (`libsql://base-org.turso.io`, `https://…`, `http://127.0.0.1:8081`), ou `null` pour un fichier ou la mémoire. */
export function hoteDe(adresse: string): string | null {
  const a = adresse.trim();
  if (!a || a === ":memory:" || /^file:/i.test(a)) return null;
  const m = /^[a-z][a-z0-9+.-]*:\/\/(\[[^\]]+\]|[^/:?#]+)/i.exec(a);
  return m ? m[1]!.toLowerCase() : null;
}

/** Vrai si l'adresse reste sur la machine : fichier, mémoire ou boucle locale. Tout autre hôte est une base (ou un serveur) distant. */
export function estLocale(adresse: string): boolean {
  const hote = hoteDe(adresse);
  return hote === null || BOUCLE.has(hote);
}

/** Pour les tests : l'adresse d'une base distante ne doit jamais atteindre un client (`openLibsql`). */
export function refusDistantEnTest(adresse: string): string | null {
  if (estLocale(adresse)) return null;
  return `Une base distante (${hoteDe(adresse)}) ne s'ouvre jamais dans un test : les tests et les outils de mesure tournent sur un fichier local (file:) ou la mémoire (lot R14).`;
}

/**
 * Le refus d'un script qui vise une cible distante sans `--distant` (ou `null` si tout va bien). `quoi` : la phrase qui dit ce que le script écrit.
 * Le message ne contient que l'hôte, jamais le jeton ni le chemin.
 */
export function refusSansDistant(adresse: string, argv: readonly string[], quoi: string): string | null {
  if (estLocale(adresse)) return null;
  if (argv.includes("--distant")) return null;
  return `${quoi} Cible : ${hoteDe(adresse)} (distante). Ajoute --distant pour confirmer que c'est voulu ; sinon vise un fichier local (file:…) ou un sqld local.`;
}

/** À poser en tête d'un script : sort avec le code 1 et le message si la cible est distante sans `--distant` ; sinon, dit en clair qu'elle est distante. */
export function exigerDistant(adresse: string, argv: readonly string[], quoi: string): void {
  const refus = refusSansDistant(adresse, argv, quoi);
  if (refus) {
    console.error(refus);
    process.exit(1);
  }
  if (!estLocale(adresse)) console.log(`⚠ BASE DISTANTE : ${hoteDe(adresse)} (--distant)`);
}
