import { BRIDGE_LOOK } from "./bridge";
import { formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, SINGLE_CLOCK_VERSION, SINGLE_CLOCK_GENERATOR, VARIETY_DAYS, dailyLevel } from "@cdj/jump-sim";
import { miniKind, repeatedPieces, semaineDayOf, semaineDays, semaineFromEntry, type MiniKind, type SemaineDay, type SemaineFile } from "./semaineInfo";
import { themeByName } from "./themes";
import { semaineHref, type UrlChoices } from "./urlOptions";

// Lot 19 — l'outil de la variété (`?semaine=AAAA-MM-JJ`) : les 7 niveaux du jour à partir de la date, côte à côte ; pour chacun une miniature et la
// liste de ses morceaux de base ; un morceau présent dans plusieurs jours est surligné (et marqué sous la miniature). Outil interne, en français
// (exempté des catalogues), chargé à la demande par `boot.ts` (ni Three.js ni la boucle de jeu) ; les niveaux sont calculés ici, un par un, par le
// générateur en vigueur. `&generateur=13` : la même semaine lue dans `outils/semaine-g13.json` (le générateur d'avant le lot 19).

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Les couleurs de la miniature, lues dans les jetons de la charte (aucune couleur écrite ici). */
function palette(): Record<MiniKind | "fond" | "repete" | "plateforme", string> {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  // Le plein en gris, le vide en encre : seuls les dangers sont rouges (couleur réservée), les repères et les morceaux qui reviennent en jaune.
  // Lot 20 : les plateformes mobiles en crème (`--dj-papier`, comme leur dalle dans le jeu) : jamais le rouge des dangers.
  return { fond: v("--dj-encre"), vide: v("--dj-encre"), plein: v("--dj-encre-douce"), meca: v("--dj-creme-2"), danger: v("--jump-danger"), repere: v("--jump-jaune"), repete: v("--jump-jaune"), plateforme: v("--dj-papier") };
}

/** Taille d'une tuile dans la miniature (pixels du canevas). */
const TILE = 2;

function miniature(day: SemaineDay, repeated: ReadonlySet<string>): HTMLCanvasElement {
  const width = day.rows[0]?.length ?? 0;
  const height = day.rows.length;
  const band = 3;
  const canvas = el("canvas", "mini");
  canvas.width = width * TILE;
  canvas.height = height * TILE + band * TILE;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `Miniature du niveau du ${day.date}`);
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  const c = palette();
  g.fillStyle = c.fond;
  g.fillRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < height; r++) {
    const row = day.rows[r]!;
    for (let col = 0; col < width; col++) {
      const kind = miniKind(row[col]!);
      if (kind === "vide") continue;
      g.fillStyle = c[kind];
      g.fillRect(col * TILE, r * TILE, TILE, TILE);
    }
  }
  // Lot 20 : une plateforme mobile : son trajet (la bande qu'elle balaie) à demi, sa position de départ en plein.
  for (const p of day.platforms ?? []) {
    const c0 = Math.min(p.from[0], p.to[0]);
    const c1 = Math.max(p.from[0], p.to[0]) + p.width - 1;
    const r0 = Math.min(p.from[1], p.to[1]);
    const r1 = Math.max(p.from[1], p.to[1]);
    g.globalAlpha = 0.4;
    g.fillStyle = c.plateforme;
    g.fillRect(c0 * TILE, r0 * TILE, (c1 - c0 + 1) * TILE, (r1 - r0 + 1) * TILE);
    g.globalAlpha = 1;
    g.fillRect(p.from[0] * TILE, p.from[1] * TILE, p.width * TILE, TILE);
  }
  // Lot 22 : une presse : sa course à demi, sa position haute (le bloc de 2 rangées) en danger.
  for (const p of day.presses ?? []) {
    g.globalAlpha = 0.4;
    g.fillStyle = c.danger;
    g.fillRect(p.col * TILE, p.row * TILE, p.width * TILE, (p.travel + 2) * TILE);
    g.globalAlpha = 1;
    g.fillRect(p.col * TILE, p.row * TILE, p.width * TILE, 2 * TILE);
  }
  // Lot 24 : une stalactite : sa zone de déclenchement à peine marquée, son corps (2 tuiles) en mécanique, sa pointe d'une tuile en danger.
  for (const s of day.stalactites ?? []) {
    g.globalAlpha = 0.25;
    g.fillStyle = c.meca;
    g.fillRect((s.col - s.before) * TILE, s.row * TILE, (s.before + s.after + 1) * TILE, 2 * TILE);
    g.globalAlpha = 1;
    g.fillRect(s.col * TILE, s.row * TILE, TILE, TILE);
    g.fillStyle = c.danger;
    g.fillRect(s.col * TILE, (s.row + 1) * TILE, TILE, TILE);
  }
  // Lot 25 : un laser fixe : son rayon, fin, en danger ; une barre coulissante : son trajet en pointillé neutre (deux rails, une tuile sur deux) et sa position de départ en danger, fine.
  for (const q of day.lasers ?? []) {
    g.fillStyle = c.danger;
    if (q.axis === "h") g.fillRect(q.col * TILE, q.row * TILE + TILE / 2 - 0.5, q.length * TILE, 1);
    else g.fillRect(q.col * TILE + TILE / 2 - 0.5, q.row * TILE, 1, q.length * TILE);
  }
  for (const b of day.barres ?? []) {
    g.fillStyle = c.plateforme;
    const [c0, r0] = b.from;
    const [c1, r1] = b.to;
    if (b.axis === "h") {
      for (const x of [c0, c0 + b.length]) for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r += 2) g.fillRect(x * TILE - 0.5, r * TILE, 1, TILE);
      g.fillStyle = c.danger;
      g.fillRect(c0 * TILE, r0 * TILE + TILE / 2 - 0.5, b.length * TILE, 1);
    } else {
      for (const y of [r0, r0 + b.length]) for (let col = Math.min(c0, c1); col <= Math.max(c0, c1); col += 2) g.fillRect(col * TILE, y * TILE - 0.5, TILE, 1);
      g.fillStyle = c.danger;
      g.fillRect(c0 * TILE + TILE / 2 - 0.5, r0 * TILE, 1, b.length * TILE);
    }
  }
  // Lot 26 : un pont à interrupteur : ses tuiles en trait fin de la lumière du pont (éteintes, on ne voit que leur place), l'interrupteur en plein.
  for (const q of day.ponts ?? []) {
    g.fillStyle = `#${BRIDGE_LOOK.fill.toString(16).padStart(6, "0")}`;
    for (const [col, r] of q.tiles) g.fillRect(col * TILE + 1, r * TILE + 1, TILE - 2, 2);
    g.fillRect(q.switchAt[0] * TILE, q.switchAt[1] * TILE, TILE, TILE);
  }
  g.fillStyle = c.danger;
  for (const [col, r] of day.saws) g.fillRect(col * TILE - 1, r * TILE - 1, TILE + 2, TILE + 2);
  // Sous la miniature : les colonnes des morceaux qui reviennent dans la semaine.
  g.fillStyle = c.repete;
  for (const p of day.pieces) if (repeated.has(p.id)) g.fillRect(p.col0 * TILE, height * TILE + TILE, (p.col1 - p.col0 + 1) * TILE, (band - 1) * TILE);
  return canvas;
}

export interface SemaineView {
  from: string;
  generator: number;
  days: SemaineDay[];
  /** Les morceaux surlignés et leurs dates. */
  repeated: Record<string, string[]>;
  ready: boolean;
}

export function mountSemaine(options: UrlChoices): SemaineView {
  const from = options.semaine!;
  // Lot 20 : g13 (fichier), g14 (la référence v4 du générateur, recalculée) ou le générateur en vigueur.
  const generator = options.semaineG13 ? 13 : options.semaineG14 ? SINGLE_CLOCK_GENERATOR : JUMP_GENERATOR_VERSION;
  document.body.classList.add("semaine");
  document.title = `DailyJump · semaine du ${formatDay(from)}`;
  const root = el("div", "");
  root.id = "semaine";
  const head = el("header", "");
  head.append(el("h1", "", `Semaine du ${formatDay(from)} · générateur g${generator}`));
  head.append(
    el(
      "p",
      "lead",
      `Les 7 niveaux du jour à partir de cette date, avec leurs morceaux de base (toutes variantes confondues). En jaune : un morceau présent dans plusieurs de ces jours (la bande sous la miniature marque ses colonnes). Règle du générateur (depuis g14) : aucun morceau de base ne revient avant ${VARIETY_DAYS} jours. Depuis g15, des plateformes mobiles (en crème sur la miniature : leur trajet à demi, leur départ en plein). Depuis g16, des presses dans l'usine (en rouge : leur course à demi, leur position haute en plein). Depuis g17, des champignons dans la forêt (en crème, une tuile chacun, comme les autres mécaniques). Depuis g18, des stalactites dans la glace (leur zone de déclenchement en crème pâle, leur corps en crème, leur pointe en rouge). Depuis g19, des lasers dans le néon (un rayon fixe : un fin trait rouge ; une barre coulissante : son trajet en pointillé crème et sa position de départ en rouge). Depuis g20, des ponts à interrupteur dans la nuit (cyan : un trait fin sur chaque tuile du pont, et l'interrupteur en plein) ; et une règle d'équilibre : au plus deux morceaux à élément par jour de thème, au moins un morceau de la mécanique d'origine.`,
    ),
  );
  const status = el("p", "count", "Calcul des niveaux…");
  head.append(status);
  // Lot 20 : les liens vers les autres générateurs (g14 recalculé, g13 lu dans un fichier) et vers celui en vigueur.
  const link = (text: string, gen: false | 13 | 14) => {
    const a = el("a", "btn", text);
    a.href = semaineHref(formatDay(from), gen, options);
    head.append(a);
  };
  const current = !options.semaineG13 && !options.semaineG14;
  if (!current) link("Voir avec le générateur en vigueur", false);
  if (!options.semaineG14) link("Comparer avec le générateur g14", 14);
  if (!options.semaineG13) link("Comparer avec le générateur g13", 13);
  root.append(head);
  const list = el("ol", "jours");
  root.append(list);
  document.body.append(root);

  const view: SemaineView = { from: formatDay(from), generator, days: [], repeated: {}, ready: false };
  if (options.debug) window.__jump = { phase: "semaine", semaine: view } as unknown as Window["__jump"];

  const show = () => {
    const repeated = repeatedPieces(view.days);
    view.repeated = Object.fromEntries(repeated);
    const marked = new Set(repeated.keys());
    list.replaceChildren(
      ...view.days.map((day) => {
        const li = el("li", "jour");
        li.dataset.date = day.date;
        const title = el("h2", "", day.date);
        li.append(title, el("p", "meta", `${themeByName(day.theme)?.label ?? day.theme} · ${day.id}${day.fallback ? " · secours" : ""}`));
        li.append(miniature(day, marked));
        const pieces = el("ul", "morceaux");
        for (const p of day.pieces) {
          const item = el("li", marked.has(p.id) ? "repete" : "", `${p.id} v${p.variant}`);
          item.dataset.id = p.id;
          if (marked.has(p.id)) item.title = `aussi le ${repeated.get(p.id)!.filter((d) => d !== day.date).join(", ")}`;
          pieces.append(item);
        }
        li.append(pieces);
        const play = el("a", "btn", "Jouer ce niveau");
        play.href = `?seed=${day.date}`;
        li.append(play);
        return li;
      }),
    );
    const n = repeated.size;
    status.textContent = view.ready ? (n === 0 ? "Aucun morceau de base ne revient dans ces 7 jours." : `${n} morceau${n > 1 ? "x" : ""} de base reviennent dans ces 7 jours.`) : `Calcul des niveaux… ${view.days.length} / 7`;
  };

  const finish = () => {
    view.ready = true;
    show();
    if (options.debug) window.__jump = { phase: "ready", semaine: view } as unknown as Window["__jump"];
  };

  if (options.semaineG13) {
    void fetch("outils/semaine-g13.json")
      .then((r) => (r.ok ? (r.json() as Promise<SemaineFile>) : Promise.reject(new Error(String(r.status)))))
      .then((file) => {
        const wanted = new Set(semaineDays(from).map(formatDay));
        view.days = file.jours.filter((j) => wanted.has(j.date)).map(semaineFromEntry);
        if (view.days.length === 0) status.textContent = "Ces dates ne sont pas dans le fichier g13 (du 27/10 au 23/11/2026).";
        finish();
      })
      .catch(() => {
        status.textContent = "Fichier g13 introuvable (outils/semaine-g13.json).";
      });
    return view;
  }
  // Un niveau à la fois, en rendant la main entre deux : la page montre l'avancement. Lot 20 : g14 = la référence v4 du générateur.
  const days = semaineDays(from);
  const next = (k: number) => {
    if (k >= days.length) return finish();
    view.days.push(semaineDayOf(dailyLevel(days[k]!, null, options.semaineG14 ? SINGLE_CLOCK_VERSION : undefined)));
    show();
    setTimeout(() => next(k + 1), 0);
  };
  setTimeout(() => next(0), 0);
  return view;
}
