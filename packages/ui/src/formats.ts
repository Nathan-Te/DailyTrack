import type { Langue } from "./i18n";

// Formats par langue (lot I1, charte § 7) avec `Intl` : nombres et temps (`31,402 s` / `31.402 s`), rangs (`14e` / `14th`), dates
// (« mardi 20 octobre » / « Tuesday, October 20 »), numéro du jour (`n° 12` / `#12`). Purs, testés (`packages/ui/test/formats.test.ts`).
// Un jour est un numéro de jour civil (jours depuis le 1er janvier 1970, comme `parisDay` de `@cdj/clock`) : il est écrit tel quel, en UTC,
// sans fuseau du navigateur. L'espace entre un nombre et son unité est insécable (U+00A0) : un temps ne se coupe jamais en fin de ligne.

const LOCALES: Record<Langue, string> = { fr: "fr-FR", en: "en-US" };
const JOUR_MS = 86_400_000;
const INSECABLE = " ";

const cache = new Map<string, Intl.NumberFormat>();
function nombres(langue: Langue, decimales: number): Intl.NumberFormat {
  const k = `${langue}:${decimales}`;
  let f = cache.get(k);
  if (!f) cache.set(k, (f = new Intl.NumberFormat(LOCALES[langue], { minimumFractionDigits: decimales, maximumFractionDigits: decimales })));
  return f;
}

/**
 * Un nombre au format de la langue (`1 284` / `1,284` ; `decimales` chiffres après la virgule, 0 par défaut). L'espace fine insécable
 * (U+202F) qu'`Intl` met entre les milliers en français devient une espace insécable (U+00A0) : aucune police de la charte n'a la première
 * (test `polices.test.ts`).
 */
export function formatNombre(n: number, langue: Langue, decimales = 0): string {
  return nombres(langue, decimales).format(n).replace(/\u202f/g, INSECABLE);
}

/**
 * Un temps en millisecondes : `31,402 s` / `31.402 s` sous la minute ; `1:02,345` / `1:02.345` au-delà (minutes, secondes sur deux
 * chiffres). Toujours trois décimales (le chronométrage des jeux est à la milliseconde) ; jamais de séparateur de milliers.
 */
export function formatTemps(ms: number, langue: Langue): string {
  const total = Math.max(0, Math.round(ms));
  const virgule = langue === "fr" ? "," : ".";
  const sec = Math.floor(total / 1000);
  const millis = String(total % 1000).padStart(3, "0");
  if (sec < 60) return `${sec}${virgule}${millis}${INSECABLE}s`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}${virgule}${millis}`;
}

const ordinaux = new Intl.PluralRules("en-US", { type: "ordinal" });
const SUFFIXES_EN: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "st", two: "nd", few: "rd", other: "th" };

/** Un rang : `1er`, `2e`, `14e` / `1st`, `2nd`, `3rd`, `14th`, `21st`. */
export function formatRang(rang: number, langue: Langue): string {
  if (langue === "fr") return `${rang}${rang === 1 ? "er" : "e"}`;
  return `${rang}${SUFFIXES_EN[ordinaux.select(rang)] ?? "th"}`;
}

const dates = new Map<string, Intl.DateTimeFormat>();
function dateFormat(langue: Langue, style: "longue" | "courte"): Intl.DateTimeFormat {
  const k = `${langue}:${style}`;
  let f = dates.get(k);
  if (!f) {
    const options: Intl.DateTimeFormatOptions =
      style === "longue" ? { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" } : { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" };
    dates.set(k, (f = new Intl.DateTimeFormat(LOCALES[langue], options)));
  }
  return f;
}

/** La première lettre en capitale, selon la langue (« mardi 20 octobre » → « Mardi 20 octobre »). */
export function majuscule(texte: string, langue: Langue): string {
  return texte.charAt(0).toLocaleUpperCase(LOCALES[langue]) + texte.slice(1);
}

/** Une date : « mardi 20 octobre » / « Tuesday, October 20 » (`capitale` : « Mardi 20 octobre », en tête de ligne). */
export function formatDate(jour: number, langue: Langue, { capitale = false } = {}): string {
  const texte = dateFormat(langue, "longue").format(new Date(jour * JOUR_MS));
  return capitale ? majuscule(texte, langue) : texte;
}

/** Une date courte, pour la barre des jeux : « mar. 20 oct. » / « Tue, Oct 20 » (`capitale` comme `formatDate`). */
export function formatDateCourte(jour: number, langue: Langue, { capitale = false } = {}): string {
  const texte = dateFormat(langue, "courte").format(new Date(jour * JOUR_MS));
  return capitale ? majuscule(texte, langue) : texte;
}

/**
 * Lot TP : une hauteur de Tower en millimètres entiers, arrondie au dixième de mètre : `42,7 m` / `42.7 m` (la même arrondie que la ligne à partager du jeu). Négatif ramené à zéro.
 * L'espace avant l'unité est insécable.
 */
export function formatHauteur(mm: number, langue: Langue): string {
  const dixiemes = Math.max(0, Math.round(mm / 100));
  return `${nombres(langue, 1).format(dixiemes / 10).replace(/\u202f/g, INSECABLE)}${INSECABLE}m`;
}

/** Le numéro du jour d'un jeu : `n° 12` / `#12`. */
export function formatNumeroJour(n: number, langue: Langue): string {
  return langue === "fr" ? `n°${INSECABLE}${n}` : `#${n}`;
}

/**
 * Lot I5 : une durée de décompte (« Prochain niveau dans 07:42:09 », le Salon de Track « 07:42 »), sur des chiffres à chasse fixe : heures,
 * minutes et secondes sur deux chiffres (`heures: false` : minutes et secondes seulement, les minutes peuvent alors dépasser 59). Arrondi à la
 * seconde **supérieure** (le décompte n'affiche jamais 00:00:00 tant qu'il reste du temps) ; les heures peuvent valoir 24 (le jour du retour à
 * l'heure d'hiver dure 25 h). La même forme dans les deux langues.
 */
export function formatDecompte(ms: number, { heures = true }: { heures?: boolean } = {}): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const deux = (n: number) => String(n).padStart(2, "0");
  if (!heures) return `${deux(Math.floor(total / 60))}:${deux(total % 60)}`;
  return `${deux(Math.floor(total / 3600))}:${deux(Math.floor(total / 60) % 60)}:${deux(total % 60)}`;
}
