// Lot N2 (plateforme) : la liste des codes de zone des nouveautés, **dans un petit module à part** : l'accueil du portail la lit (budget du premier chargement) sans embarquer les
// règles du gros module `nouveautes.ts`, qui la réexporte pour tous les autres. Les noms affichés (`NOM_DE_ZONE`) sont dans `nouveautes.ts`.

/**
 * Les zones d'une ligne de nouveauté : le code gardé en base. **La seule liste** : le serveur, le panneau, la page `/nouveautes/` et la lecture des PR en dérivent. `dujour` est
 * la plateforme ; **chaque jeu du registre a la sienne** (`apps/api/test/zonesNouveautes.test.ts` échoue sinon) : un nouveau jeu s'ajoute ici et dans `NOM_DE_ZONE`
 * (`nouveautes.ts`, typé de façon exhaustive : l'oublier ne compile pas), puis dans `admin.css` et `portail.css` (couleur de l'étiquette), et nulle part ailleurs.
 */
export const ZONES_NOUVEAUTES = ["dujour", "track", "jump", "tower"] as const;
export type ZoneNouveaute = (typeof ZONES_NOUVEAUTES)[number];

/** Vrai si la valeur est un code de zone (lecture prudente d'un texte venu du réseau ou de la base). */
export const estZone = (v: unknown): v is ZoneNouveaute => typeof v === "string" && (ZONES_NOUVEAUTES as readonly string[]).includes(v);
