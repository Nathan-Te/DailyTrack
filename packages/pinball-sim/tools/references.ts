import { writeFileSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { DROITE, GAUCHE, LANCEUR, PINBALL_BOT_VERSION, themeDuJour, type ThemePinball, PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, dailyPinball, empreinteContenu, enregistrer, graineDuRobot, jouer, jouerRobot, seuilsDuRobot, type Evenement } from "../src/index";

// Le golden de Pinball : `npm run golden:pinball -w @cdj/pinball-sim`. Dix jours (le thème, les six modules, l'empreinte de la table ; **les seuils du robot pour un jour de chaque thème**, lot PB4) et des rediffusions de
// référence : une partie vide (la bille ne part jamais : elle dure les 15 minutes), le lanceur relâché puis les deux batteurs tenus, et **le robot** (`robot.ts`, lot PB4) sur quatre tables, une de chaque thème (30 secondes puis
// 2 minutes sur le volcan, 2 minutes sur l'espace, la foire et l'océan) — chaque mécanique y passe. Il ne se régénère jamais sans monter la version concernée (`PINBALL_SIM_VERSION` pour les rediffusions,
// `PINBALL_GENERATOR_VERSION` pour la table, `PINBALL_BOT_VERSION` pour les seuils et le robot).
const jours = Array.from({ length: 10 }, (_, i) => daysFromCivil(2026, 11, 2) + i * 3);
const jourRef = jours[0]!;
const tenus: Evenement[] = [
  { tick: 10, c: LANCEUR, enfonce: true },
  { tick: 300, c: LANCEUR, enfonce: false },
  { tick: 900, c: GAUCHE, enfonce: true },
  { tick: 910, c: DROITE, enfonce: true },
  { tick: 2400, c: GAUCHE, enfonce: false },
  { tick: 2400, c: DROITE, enfonce: false },
];
/** Le premier jour depuis le premier jour du jeu qui tombe sur ce thème et ce plan : les rediffusions du robot jouent chaque plan (lot PBG1). */
const jourDe = (theme: ThemePinball, plan: string): number => {
  for (let j = daysFromCivil(2026, 11, 2); ; j++) if (themeDuJour(j) === theme && dailyPinball(j).plan === plan) return j;
};
const robot = (jour: number, pas: number): Evenement[] => jouerRobot(dailyPinball(jour), graineDuRobot(0), { maxTicks: pas }).evenements;

const reds = [
  { nom: "vide", jour: jourRef, evenements: [] as Evenement[] },
  { nom: "batteurs-tenus", jour: jourRef, evenements: tenus },
  // Lot PB4 : les tables du robot portent les éléments des thèmes (volcan : geyser et coulée ; espace : trou noir, portails, astéroïde ; foire : manège ; océan : tourbillon), et leur mission est réussie par le robot
  { nom: "robot-30-secondes", jour: jours[6]!, evenements: robot(jours[6]!, 18000) },
  // Lot PBG1 : les quatre robots jouent quatre plans différents (rampes, orbite, combo, mini-batteur)
  { nom: "robot-volcan", jour: jourDe("volcan", "boucle"), evenements: robot(jourDe("volcan", "boucle"), 72000) },
  { nom: "robot-espace", jour: jourDe("espace", "bretelle"), evenements: robot(jourDe("espace", "bretelle"), 72000) },
  { nom: "robot-foire", jour: jourDe("foire", "doublette"), evenements: robot(jourDe("foire", "doublette"), 72000) },
  { nom: "robot-ocean", jour: jourDe("ocean", "tremplin"), evenements: robot(jourDe("ocean", "tremplin"), 72000) },
].map((r) => {
  const contenu = dailyPinball(r.jour);
  return { nom: r.nom, date: formatDay(r.jour), g: contenu.g, code: enregistrer(contenu, r.evenements), resultat: jouer(contenu, r.evenements) };
});

const themesVus = new Set<string>();
const sortie = {
  _: "Golden de Pinball (lots PB1 à PB4). Régénérer : npm run golden:pinball -w @cdj/pinball-sim, seulement en montant la version concernée.",
  sim: PINBALL_SIM_VERSION,
  generateur: PINBALL_GENERATOR_VERSION,
  bot: PINBALL_BOT_VERSION,
  jours: jours.map((j) => {
    const c = dailyPinball(j);
    // les seuils du robot : le premier jour de chaque thème seulement (4 secondes chacun)
    const seuils = themesVus.has(c.theme) ? undefined : seuilsDuRobot(c);
    themesVus.add(c.theme);
    return { date: formatDay(j), theme: c.theme, plan: c.plan, modules: c.modules, empreinte: empreinteContenu(c), ...(seuils ? { seuils } : {}) };
  }),
  rediffusions: reds,
};
writeFileSync(new URL("../test/fixtures/golden-pinball.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("golden écrit :", reds.map((r) => `${r.nom}=${r.resultat.score}/${r.resultat.ticks}`).join(" "));
