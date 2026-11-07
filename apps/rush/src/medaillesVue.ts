import { formatDay } from "@cdj/core";
import { BOSS_IDS, DUREE_TICKS, STRATEGIES, VARIANTE, dailyRush, formatTemps, ligneDuJour } from "@cdj/rush-sim";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import { cleBoss } from "./bosses";

// `?scenario=medailles&jours=7` (lot BR4) : le TABLEAU DES MÉDAILLES des N prochains jours, pour juger les seuils sans jouer. Par jour : la date, le thème, le boss, les temps des trois stratégies du pilote de référence (la plus rapide,
// le Diamant, en gras), les quatre seuils (Diamant, or, argent, bronze) et les temps du pilote HUMANISÉ (réaction de 200 ms, annonces lues parfois tard, esquive imparfaite, ni le boss ni les cartes à venir : `HUMAIN`). C'est le même
// calcul que le jeu et le serveur (`ligneDuJour`) : ce qu'on lit ici est ce que le jour servira. Un essai : jamais classé, jamais en production.
export function tableauDesMedailles(jour: number, nombre: number, hote: HTMLElement, o: OptionsPartie): PartieDuJeu {
  const racine = document.createElement("div");
  racine.className = "rush-medailles";
  racine.dataset.jours = String(nombre);
  const titre = document.createElement("h2");
  titre.className = "rush-medailles__titre";
  titre.textContent = o.t("medailles.titre", { n: nombre });
  racine.append(titre);
  const table = document.createElement("table");
  table.className = "rush-medailles__table";
  const entete = table.createTHead().insertRow();
  const colonnes: [string, number][] = [["medailles.col.jour", 1], ["medailles.col.pilote", 3], ["medailles.col.seuils", 4], ["medailles.col.humain", 3]];
  for (const [cle, span] of colonnes) {
    const th = document.createElement("th");
    th.colSpan = span;
    th.scope = "colgroup";
    th.textContent = o.t(cle);
    entete.append(th);
  }
  const sous = table.createTHead().insertRow();
  const noms = ["", ...STRATEGIES.map((s) => o.t(`strategie.${s}`)), o.t("medailles.diamant"), o.t("medailles.or"), o.t("medailles.argent"), o.t("medailles.bronze"), ...STRATEGIES.map((s) => o.t(`strategie.${s}`))];
  for (const n of noms) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = n;
    sous.append(th);
  }
  const corps = table.createTBody();
  const t = (ticks: number): string => (ticks >= DUREE_TICKS ? "—" : formatTemps(ticks, o.langue));
  for (let d = 0; d < nombre; d++) {
    const c = dailyRush(jour + d);
    const l = ligneDuJour(c);
    const tr = corps.insertRow();
    tr.dataset.jour = formatDay(c.jour);
    tr.dataset.boss = BOSS_IDS[c.boss]!;
    tr.dataset.diamant = l.diamant;
    const jourTd = tr.insertCell();
    jourTd.className = "rush-medailles__jour";
    jourTd.textContent = [formatDay(c.jour), o.t(`theme.${c.theme}`), o.t(`boss.nom.${cleBoss(BOSS_IDS[c.boss]!)}`)].join(" · ");
    for (const s of STRATEGIES) {
      const td = tr.insertCell();
      td.textContent = t(l.temps[s]);
      if (s === l.diamant) td.className = "rush-medailles__diamant";
      td.dataset.strategie = s;
    }
    for (const m of ["author", "gold", "silver", "bronze"] as const) {
      const td = tr.insertCell();
      td.textContent = formatTemps(l.seuils[m], o.langue);
      td.dataset.seuil = m;
    }
    for (const s of STRATEGIES) {
      const td = tr.insertCell();
      td.textContent = t(l.humain[s]);
      td.dataset.humain = s;
      const m = VARIANTE.medaille([l.humain[s]], l.seuils);
      if (m) td.dataset.medaille = m;
    }
  }
  racine.append(table);
  // le barème de la fiche (le seul endroit où les pourcentages vivent), en pied de tableau
  const pied = document.createElement("p");
  pied.className = "rush-medailles__pied";
  pied.textContent = `${VARIANTE.fiche.bareme.join(" % · ")} %`;
  racine.append(pied);
  hote.append(racine);
  return {
    avancer() {},
    dessiner() {},
    finie: () => false,
    action() {},
    hud: () => ({ principal: "", secondaire: "" }),
    resultat: () => ({ score: [DUREE_TICKS], rediffusion: "" }),
    fantome() {},
    detruire() {
      racine.remove();
    },
  };
}
