// Lot P (plateforme) — l'**interrupteur des jeux** : la logique pure, sans réseau ni base, partagée par le serveur et les sites.
// Un jeu a trois états (`off`, `preview`, `on`) que Nathan change depuis l'administration. **Un jeu inconnu vaut `off`** : un nouveau jeu naît caché.
// Séparément de l'état, la **journée** (série, journée parfaite, classement du jour, ligne de partage) ne compte un jeu qu'à partir du premier jour
// entier où il est `on` : le jour qui suit l'activation. Le désactiver le retire de la journée à partir du lendemain, sans toucher aux jours déjà
// passés. Tout ceci se dit en **périodes** `[du, au)` de jours de Paris (`au` absent = encore ouverte).
// Consignes : CLAUDE.md racine, « Publication des jeux ».

export type EtatJeu = "off" | "preview" | "on";
export const ETATS_JEU: readonly EtatJeu[] = ["off", "preview", "on"];

/** Un jeu qui compte dans la journée du jour `du` (compris) au jour `au` (exclu) ; `au = null` : sans fin. */
export type PeriodeJeu = readonly [du: number, au: number | null];

/** L'état d'une valeur lue (réponse du serveur, base) : tout ce qui n'est pas un état connu vaut `off`. */
export const etatDe = (brut: unknown): EtatJeu => (brut === "on" || brut === "preview" ? brut : "off");

/**
 * Les jeux **déjà publics** quand l'interrupteur est arrivé : Track et Jump (leur dossier sur le site). Ils naissent `on` dans la base, et c'est la liste du
 * site quand l'API ne répond pas. **Un jeu en développement n'y est jamais** : il n'apparaît donc pas par défaut.
 */
export const JEUX_PUBLICS: readonly string[] = ["track", "jump"];

/** Les états à utiliser sans réseau ou quand l'API ne répond pas : seuls les jeux déjà publics sont `on`. */
export const etatsParDefaut = (): Record<string, EtatJeu> => Object.fromEntries(JEUX_PUBLICS.map((j) => [j, "on" as EtatJeu]));

/** L'état d'un jeu dans une liste d'états : absent = `off`. */
export const etatDansListe = (etats: Readonly<Record<string, unknown>> | null | undefined, jeu: string): EtatJeu => (etats && Object.hasOwn(etats, jeu) ? etatDe(etats[jeu]) : "off");

/** Lit la liste d'états d'une réponse de `GET /api/jeux` (illisible : `null`, le site prend alors `etatsParDefaut`). */
export function etatsDeReponse(brut: unknown): Record<string, EtatJeu> | null {
  const j = (brut as { jeux?: unknown } | null)?.jeux;
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  return Object.fromEntries(Object.entries(j as Record<string, unknown>).map(([k, v]) => [k, etatDe(v)]));
}

/** Les périodes gardées (JSON), relues avec prudence : une valeur abîmée donne aucune période (le jeu ne compte pas), jamais une erreur. */
export function lirePeriodes(brut: string | null | undefined): PeriodeJeu[] {
  try {
    const l = JSON.parse(brut ?? "[]") as unknown;
    if (!Array.isArray(l)) return [];
    return l.flatMap((p): PeriodeJeu[] => (Array.isArray(p) && Number.isInteger(p[0]) && (p[1] === null || Number.isInteger(p[1])) ? [[p[0] as number, (p[1] ?? null) as number | null]] : []));
  } catch {
    return [];
  }
}

/** Le jeu compte-t-il dans la journée de ce jour ? (`du` ≤ jour < `au`.) */
export const compteLe = (periodes: readonly PeriodeJeu[], jour: number): boolean => periodes.some(([du, au]) => jour >= du && (au === null || jour < au));

/**
 * Les périodes d'après un changement d'état, à `aujourdhui` (jour de Paris). Règles :
 *   - passer à `on` : une période s'ouvre **le lendemain** (le premier jour entier) ; si le jeu venait d'être désactivé aujourd'hui (sa dernière période se
 *     termine demain), elle se rouvre simplement (aucun trou) ;
 *   - quitter `on` (vers `off` ou `preview`) : la période ouverte se ferme **demain** (le jeu sort de la journée dès le lendemain) ; une période qui n'a pas encore
 *     commencé (activée aujourd'hui) disparaît ;
 *   - un changement qui ne touche pas `on` (off ↔ preview) ne change rien.
 * Les jours déjà passés ne sont jamais touchés : les séries acquises restent entières.
 */
export function periodesApres(periodes: readonly PeriodeJeu[], avant: EtatJeu, apres: EtatJeu, aujourdhui: number): PeriodeJeu[] {
  const l = periodes.map((p): PeriodeJeu => [p[0], p[1]]);
  if (avant === apres || (avant !== "on" && apres !== "on")) return l;
  if (apres === "on") {
    const derniere = l.at(-1);
    if (derniere && derniere[1] !== null && derniere[1] > aujourdhui) l[l.length - 1] = [derniere[0], null]; // désactivé aujourd'hui, réactivé aujourd'hui : aucun trou
    else l.push([aujourdhui + 1, null]);
    return l;
  }
  const derniere = l.at(-1);
  if (derniere && derniere[1] === null) {
    if (derniere[0] > aujourdhui) l.pop(); // activé aujourd'hui, pas encore compté : rien à garder
    else l[l.length - 1] = [derniere[0], aujourdhui + 1];
  }
  return l;
}

/** `live_from` : le premier jour de la dernière période (le jour où le jeu a commencé, ou commencera, à compter), ou `null` s'il n'a jamais été `on`. */
export const liveFromDe = (periodes: readonly PeriodeJeu[]): number | null => periodes.at(-1)?.[0] ?? null;
