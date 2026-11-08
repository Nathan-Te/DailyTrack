import { AMELIORATIONS, BOSS_IDS, COMPETENCES, Fantome, diamantDuJour, enregistrer, formatTemps, type Contenu, type Strategie } from "@cdj/rush-sim";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import { cleBoss } from "./bosses";

// L'ÉCRAN DE FIN (lot BR4). **C'est celui du kit** (`packages/kit/src/jeu/partie.ts` : le temps, la médaille, le rang, « encore … », la liste des médailles, « Rejouer », le classement, le partage) : Rush ne le remplace pas. Le kit n'a pas
// (encore) d'emplacement propre au jeu sur cet écran ; ce module y POSE donc deux choses, depuis le jeu, sans toucher au kit :
//   · un bloc « Boss du jour » + « Cartes choisies » (+ « le Diamant ») sous la tuile du résultat ;
//   · le TEMPS là où le kit écrit un nombre : le kit affiche les seuils et « encore … » tels qu'il les a, c'est-à-dire en ticks (« encore 1203 ») ; pour un jeu qui se classe au temps, le jeu les réécrit en `m:ss,cc`.
// Le kit refait l'écran à chaque changement de l'envoi (`replaceChildren`) : le jeu le complète à chaque image tant que la partie est finie (`completerEcranDeFin` est idempotent). **Proposition à Nathan** : un crochet du kit
// (`DefinitionJeu.resumeFin` et `formatSeuil`) rendrait ce module inutile (README du lot BR4).

export interface ResumeFin {
  /** L'indice du boss du jour (`Contenu.boss`). */
  boss: number;
  /** Les paliers pris de chaque amélioration (dans l'ordre du catalogue). */
  paliers: readonly number[];
  /** Le temps du Diamant du jour, en ticks (le seuil `author` du jour servi), et — quand le pilote vient de le calculer — sa stratégie. Facultatif : la ligne « le Diamant » n'est pas posée sans lui. */
  diamant?: { ticks: number; strategie?: Strategie };
  /** Lot BR5 : la compétence choisie au départ (indice de `COMPETENCES`), ou −1 : la ligne n'est pas posée. */
  competence?: number;
}

type Traduire = OptionsPartie["t"];

/** « Lame lourde ×2, Tourbillon » : les cartes prises, dans l'ordre du catalogue ; vide : aucune. */
export function cartesPrises(paliers: readonly number[], t: Traduire): string[] {
  const out: string[] = [];
  paliers.forEach((n, i) => {
    if (n <= 0) return;
    const a = AMELIORATIONS[i];
    if (!a) return;
    out.push(t(`carte.${a.id.replace(/-/g, "_")}.nom`) + (n > 1 ? ` ×${n}` : ""));
  });
  return out;
}

/** Les lignes que le jeu ajoute à l'écran de fin (textes déjà traduits). */
export function lignesDeFin(r: ResumeFin, o: Pick<OptionsPartie, "t" | "langue">): { boss: string; competence: string | null; cartes: string; diamant: string | null } {
  const cartes = cartesPrises(r.paliers, o.t);
  return {
    boss: o.t("fin.boss", { boss: o.t(`boss.nom.${cleBoss(BOSS_IDS[r.boss] ?? "golem")}`) }),
    competence: r.competence !== undefined && COMPETENCES[r.competence] ? o.t("fin.competence", { nom: o.t(`comp.${COMPETENCES[r.competence]!}.nom`) }) : null,
    cartes: cartes.length > 0 ? o.t("fin.cartes", { liste: cartes.join(", ") }) : o.t("fin.aucuneCarte"),
    diamant: r.diamant ? o.t("fin.diamant", { temps: formatTemps(r.diamant.ticks, o.langue), strategie: r.diamant.strategie ? ` (${o.t(`strategie.${r.diamant.strategie}`)})` : "" }) : null,
  };
}

/** Un nombre (des ticks) écrit par le kit → le même temps en `m:ss,cc` ; un texte qui n'est pas un nombre seul est rendu tel quel. */
export const tempsDuKit = (brut: string, langue: "fr" | "en"): string => (/^\d+$/.test(brut.trim()) ? formatTemps(Number(brut), langue) : brut);

/** Complète l'écran de fin du kit (idempotent : à appeler à chaque image tant que la partie est finie). Rend vrai quand l'écran de fin est là. */
export function completerEcranDeFin(r: ResumeFin, o: Pick<OptionsPartie, "t" | "langue">): boolean {
  const score = document.getElementById("jeu-fin-score");
  if (!score) return false;
  const tuile = score.closest(".jeu-resume") ?? score.parentElement;
  if (tuile && tuile.parentElement && !tuile.parentElement.querySelector(".rush-fin")) {
    const l = lignesDeFin(r, o);
    const bloc = document.createElement("section");
    bloc.className = "jeu-tuile rush-fin";
    for (const [role, texte] of [["boss", l.boss], ["competence", l.competence], ["cartes", l.cartes], ["diamant", l.diamant]] as const) {
      if (texte === null) continue;
      const p = document.createElement("p");
      p.className = "rush-fin__ligne";
      p.dataset.role = role;
      p.textContent = texte;
      bloc.append(p);
    }
    tuile.after(bloc);
  }
  // Les nombres du kit, en temps : les seuils de la liste des médailles et « encore … ».
  for (const v of document.querySelectorAll<HTMLElement>("#jeu-fin .dj-medaille__valeur")) {
    const a = v.textContent ?? "";
    if (/^\d+$/.test(a.trim())) v.textContent = tempsDuKit(a, o.langue);
  }
  const encore = document.getElementById("jeu-fin-encore");
  if (encore && /\d/.test(encore.textContent ?? "") && !encore.dataset.rush) {
    encore.textContent = (encore.textContent ?? "").replace(/\d+/, (n) => formatTemps(Number(n), o.langue));
    encore.dataset.rush = "1";
  }
  return true;
}

/**
 * `?scenario=fin&temps=65000` : l'écran de fin tout de suite, à `ticks` ticks, sur le niveau du jour — pour le juger (disposition, médaille, écart) sans jouer. La partie est déjà finie : le kit passe aussitôt à son écran de fin avec
 * les médailles du jour ; les cartes montrées sont celles du Diamant. Jamais classée (c'est un essai).
 */
export function partieDeFin(contenu: Contenu, ticks: number, o: OptionsPartie): PartieDuJeu {
  const d = diamantDuJour(contenu);
  const diamant = d.parties[d.strategie];
  const f = new Fantome(contenu, enregistrer(contenu, diamant.changements, diamant.choix, diamant.competence));
  while (f.avancer()) if (f.partie.tick > 40000) break;
  const resume: ResumeFin = { boss: contenu.boss, competence: diamant.competence, paliers: f.partie.paliers, diamant: { ticks: diamant.score, strategie: d.strategie } };
  return {
    avancer() {},
    dessiner() {
      completerEcranDeFin(resume, o);
    },
    finie: () => true,
    action() {},
    hud: () => ({ principal: "", secondaire: formatTemps(ticks, o.langue) }),
    resultat: () => ({ score: [ticks], rediffusion: "" }),
    fantome() {},
    detruire() {},
  };
}
