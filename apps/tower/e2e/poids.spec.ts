import { expect, test } from "@playwright/test";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { mesureTower } from "../../../scripts/budgets.mjs";

// Lot R15 (plateforme) : le budget de Tower est gardé comme ceux de Track et de Jump. **Lot R17 : les plafonds ne sont plus lus ici** — ils sont dans `docs/plateforme/budgets.md` (la seule source :
// lignes `tower.*`) et contrôlés par le job « Budgets » de la CI (`scripts/budgets-controle.mjs`) sur toute PR qui touche ce que charge un joueur, qu'un spec de Tower tourne ou non. Ce fichier ne garde
// que la **composition** : ce qui est dans le premier chargement (l'accueil seul), dans le jeu, à la demande. Déterministe (la construction), sans navigateur.
// Lot T4 : **le premier chargement est l'accueil seul** (`tower.jsCss`) et le jeu — la scène (Three.js), la partie, le HUD, l'arrivée — se charge à la demande (`tower.jeu`). La mesure est celle de `mesureTower`
// (`scripts/budgets.mjs`, d'après le graphe de `apps/tower/tools/mesure.mjs` : le graphe statique de `index.html`, plus le contenu du jour que l'accueil charge dès qu'il est dessiné).
interface Morceau {
  js: number;
  css: number;
  total: number;
  fichiers: string[];
}
const mesureComplete = mesureTower() as { polices: number; detail: Record<string, unknown> };
const mesure = { ...mesureComplete.detail, polices: mesureComplete.polices } as { accueil: Morceau; jeu: Morceau; physique: number; physiqueWasm: number; anglais: number; polices: number; decors: number; decorsParTheme: Record<string, number>; habits: number };

test("le premier chargement est l'accueil seul : ni Three.js, ni la partie, ni la physique, ni l'anglais", () => {
  const a = mesure.accueil;
  test.info().annotations.push({ type: "mesure", description: `accueil JS ${a.js} + CSS ${a.css} = ${a.total} o — ${a.fichiers.join(", ")}` });
  expect(a.js, `fichiers mesurés : ${a.fichiers.join(", ")}`).toBeGreaterThan(5_000);
  expect(a.fichiers.some((f) => /^(jeu|partie|rapier|empreinte|catalogue\.en)-/.test(f)), "ni le jeu, ni la partie, ni la physique, ni l'anglais dans le premier chargement").toBe(false);
  expect(a.total, "l'accueil seul est bien plus léger que le jeu").toBeLessThan(mesure.jeu.total / 2);
});

test("le jeu (la scène avec Three.js, la partie, le HUD, l'arrivée) est à la demande, sans la physique ni l'anglais", () => {
  const j = mesure.jeu;
  test.info().annotations.push({ type: "mesure", description: `jeu JS ${j.js} + CSS ${j.css} = ${j.total} o — ${j.fichiers.join(", ")}` });
  expect(j.js, `fichiers mesurés : ${j.fichiers.join(", ")}`).toBeGreaterThan(100_000); // Three.js est le gros du jeu : la mesure l'a bien trouvé
  expect(j.fichiers.some((f) => f.startsWith("rapier-") || f.startsWith("catalogue.en-")), "ni la physique ni l'anglais dans le jeu").toBe(false);
});

// Lot T9 : les décors (un module par thème, le port compris) et l'habillage des effets et du taquet sont à la demande — ni dans l'accueil, ni dans `tower.jeu`.
test("les décors (le plus gros thème) et l'habillage des effets sont à la demande, hors de l'accueil et du jeu", () => {
  test.info().annotations.push({ type: "mesure", description: `décors ${mesure.decors} o ${JSON.stringify(mesure.decorsParTheme)} ; habits ${mesure.habits} o` });
  expect(Object.keys(mesure.decorsParTheme).sort(), "un module de décor par thème, le port compris").toEqual(["banquise", "canyon", "chantier", "jungle", "nuit", "port"]);
  expect(mesure.decors, "le plus gros thème").toBeGreaterThan(1_000);
  expect(mesure.habits).toBeGreaterThan(1_000);
  for (const [nom, m] of [["l'accueil", mesure.accueil], ["le jeu", mesure.jeu]] as const) expect(m.fichiers.some((f) => /^(decor|habits|taquetFx|polygones)/.test(f)), `ni décor ni habillage dans ${nom}`).toBe(false);
});

test("la physique (Rapier et son .wasm) est à la demande, le .wasm servi comme un fichier", () => {
  test.info().annotations.push({ type: "mesure", description: `physique ${mesure.physique} o dont .wasm ${mesure.physiqueWasm} o` });
  expect(mesure.physiqueWasm, "le .wasm est servi comme un fichier, à part du JavaScript").toBeGreaterThan(500_000);
});

test("le catalogue anglais est à part (à la demande)", () => {
  expect(mesure.anglais, "le catalogue anglais existe, à part").toBeGreaterThan(1_000);
});
