import { msUntilNextParisDay } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import { levelNumber, type JumpMedal, type JumpMedals } from "@cdj/jump-sim";
import { medalWord, nextMedal } from "./dailyInfo";
import type { DayRecord } from "./history";
import { fDateCourte, fDecompte, fNombre, fNumero, fTicks, nomTheme, t } from "./i18n";
import { PREMIER_JOUR_ARCHIVES } from "./lancement";
import type { KeyValue } from "./memory";
import { storageKey } from "./storage";
import type { UrlChoices } from "./urlOptions";

// L'accueil, l'écran d'arrivée et les archives (lot 10), **logique pure** (testée sans DOM) : quand l'accueil s'affiche, les textes, la liste
// des archives, le compte à rebours jusqu'au prochain niveau (minuit, heure de Paris, par `@cdj/clock`). Lot I5 : tous les textes viennent des
// catalogues (`t`, formats du socle), dans la langue du joueur ; l'aide « Comment jouer » est dans `howto.ts`.

/**
 * L'accueil s'ouvre-t-il ? Sur la page du niveau du jour, oui, sauf `?accueil=0` ; jamais pour un lien direct (`seed`, `solution`, `watch`,
 * `carnage`, et bien sûr `module`, `modules`, `scenario`, qui ne sont pas le niveau du jour). `?archives` l'ouvre (sur la liste).
 */
export function wantsHome(o: Pick<UrlChoices, "daily" | "seed" | "solution" | "watchBest" | "carnageDemo" | "home" | "archives"> & Partial<Pick<UrlChoices, "watchFirst">>): boolean {
  if (!o.daily || o.seed !== null || o.solution || o.watchBest || o.watchFirst || o.carnageDemo) return false;
  return o.archives || o.home !== false;
}

/** « Prochain niveau dans 07:42:09 » à l'instant `nowMs` (minuit de Paris, heure d'été comprise ; format du socle `formatDecompte`). */
export function countdownText(nowMs: number): string {
  return t("accueil.prochain", { temps: fDecompte(msUntilNextParisDay(nowMs)) });
}

/** Le titre de l'accueil et le niveau : « JUMP », « Niveau n° 5 · Forêt » (avant le premier jour : la date à la place du numéro). */
export function homeHeading(day: number, themeCode: string): { title: string; subtitle: string } {
  const n = levelNumber(day);
  const theme = nomTheme(themeCode);
  return { title: t("jeu.jump.titre"), subtitle: n >= 1 ? t("accueil.niveau", { numero: fNumero(n), theme }) : t("accueil.niveauDate", { date: fDateCourte(day, true), theme }) };
}

/** L'état du jour pour le bouton de l'accueil : pas encore joué (« JOUER »), commencé sans arrivée (« CONTINUER »), fini (« REJOUER »). */
export type EtatDuJour = "pas_joue" | "en_cours" | "fini";
export function etatDuJour(rec: DayRecord | null): EtatDuJour {
  if (!rec || (rec.attempts === 0 && rec.deaths === 0 && rec.best === null)) return "pas_joue";
  return rec.best === null ? "en_cours" : "fini";
}

/** L'état du joueur sur l'accueil, en une ligne (lecteurs d'écran, `__jump.home`) : « Pas encore joué », sinon son meilleur temps et ses morts du jour. */
export function homeStatus(rec: DayRecord | null): { played: boolean; finished: boolean; text: string } {
  const etat = etatDuJour(rec);
  if (etat === "pas_joue") return { played: false, finished: false, text: t("accueil.etat.pasJoue") };
  if (etat === "en_cours") return { played: true, finished: false, text: t("accueil.etat.enCours", { morts: t("commun.morts", { n: rec!.deaths }), essais: t("commun.essais", { n: rec!.attempts }) }) };
  const medal = rec!.medal ? `${medalWord(rec!.medal)} · ` : "";
  return { played: true, finished: true, text: t("accueil.etat.fini", { medaille: medal, temps: fTicks(rec!.best!), morts: t("commun.morts", { n: rec!.deaths }) }) };
}

/** La tuile « Ton record » : ton meilleur temps du jour (ou « Pas encore »), et la prochaine médaille à viser (« Bronze à 47,642 s »). */
export function recordTile(best: number | null, medals: JumpMedals | null): { valeur: string; sous: string } {
  const valeur = best === null ? t("accueil.record.pasEncore") : fTicks(best);
  if (!medals) return { valeur, sous: "" };
  const next = nextMedal(best, medals);
  return { valeur, sous: next ? t("accueil.record.vise", { medaille: medalWord(next.medal), temps: fTicks(next.ticks) }) : t("accueil.record.auteurBattu") };
}

/** « 0 jour », « 1 jour », « 12 jours » (la tuile « Série Jump »). */
export function streakText(n: number): string {
  return t("accueil.serie.jours", { n });
}

/** Une archive ne compte jamais dans la série (texte de l'écran d'arrivée). */
export const archiveStreakText = (): string => t("arrivee.serie.archive");

/** Les jours des archives, du plus récent (hier) à la journée n° 1 de Du Jour (le lancement public, lot R8 : `first`) ; rien avant ce jour. */
export function archiveDays(today: number, first: number = PREMIER_JOUR_ARCHIVES): number[] {
  const out: number[] = [];
  for (let d = today - 1; d >= first; d--) out.push(d);
  return out;
}

/** Une ligne des archives : numéro, date, thème, et le résultat du joueur s'il a joué ce jour-là. */
export interface ArchiveRow {
  date: string;
  number: number;
  title: string;
  subtitle: string;
  result: string;
  medal: JumpMedal | null;
}

export function archiveRow(day: number, themeCode: string, rec: DayRecord | null): ArchiveRow {
  const date = formatDay(day);
  const n = levelNumber(day);
  const result = !rec ? "" : rec.best === null ? t("archives.pasArrivee", { morts: t("commun.morts", { n: rec.deaths }) }) : fTicks(rec.best);
  return { date, number: n, title: fNumero(n), subtitle: t("archives.sousTitre", { date: fDateCourte(day, true), theme: nomTheme(themeCode) }), result, medal: rec?.medal ?? null };
}

/** Les seuils des médailles, de l'auteur au bronze, avec leur temps ; `reached` : le temps donné les tient. */
export function medalThresholds(medals: JumpMedals, time: number | null): { medal: JumpMedal; label: string; time: string; reached: boolean }[] {
  return (["author", "gold", "silver", "bronze"] as const).map((m) => ({
    medal: m,
    label: medalWord(m),
    time: fTicks(medals[m]),
    reached: time !== null && time <= medals[m],
  }));
}

/** La médaille obtenue, en toutes lettres : « Médaille d'or », « Temps de l'auteur battu ! », « Pas de médaille ». */
export function medalText(medal: JumpMedal | null): string {
  return t(`arrivee.medaille.${medal ?? "aucune"}`);
}

/**
 * Lot I5 : la réplique de l'arrivée, **selon le nombre de morts du jour** (paliers : 0, 1 à 5, 6 à 20, 21 à 50, plus de 50 ; ton de la charte § 7,
 * drôle et un peu cruel ; adaptée en anglais). Une seule réplique par écran.
 */
export const PALIERS_MORTS: readonly { max: number; cle: string }[] = [
  { max: 0, cle: "arrivee.phrase.zero" },
  { max: 5, cle: "arrivee.phrase.peu" },
  { max: 20, cle: "arrivee.phrase.moyen" },
  { max: 50, cle: "arrivee.phrase.beaucoup" },
  { max: Number.POSITIVE_INFINITY, cle: "arrivee.phrase.carnage" },
];
export function palierMorts(morts: number): string {
  return PALIERS_MORTS.find((p) => morts <= p.max)!.cle;
}
export function arrivalLine(morts: number): string {
  return t(palierMorts(morts), { n: morts, morts: fNombre(morts) });
}

/** Clé du « déjà vu » de l'aide : « Comment jouer » ne s'ouvre de lui-même qu'à la toute première visite. */
export const HELP_SEEN_KEY = storageKey("aide");

/** L'aide a-t-elle déjà été montrée ? (Stockage absent ou qui lève : on la considère vue, pour ne pas la remontrer à chaque page.) */
export function helpSeen(store: KeyValue | null): boolean {
  if (!store) return true;
  try {
    return store.getItem(HELP_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markHelpSeen(store: KeyValue | null): void {
  try {
    store?.setItem(HELP_SEEN_KEY, "1");
  } catch {
    /* rien */
  }
}
