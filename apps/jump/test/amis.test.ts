import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ECRAN_MANETTE_FEUILLE } from "@cdj/ui/src/amis";
import { FauxEvenement, installerFauxDom, type FauxDocument, type FauxElement } from "../../../packages/ui/test/fauxDom";
import { MEDAL_TYPE } from "../src/dailyInfo";
import { MEDAILLES, adresseDuFiltre, lireClassementAmis, ligneDeAmis, lignesAmis, ouvrable, sansSelecteur } from "../src/amisLogique";
import { brancherAmis } from "../src/classementAmis";
import { ECRANS_MANETTE } from "../src/manette";
import { rowsOf } from "../src/rankView";
import type { JumpBoard } from "../src/rankApi";
import type { BoardHote, BoardUi, BoardView } from "../src/screensUi";
import { URL_OPTIONS, readUrlOptions } from "../src/urlOptions";
import "./francais";

const REF_A = "a1b2c3d4e5f6";
const REF_B = "0123456789ab";
const REF_C = "ffffffffffff";
const REF_MOI = "abcdefabcdef";

const ligne = (rang: number, name: string, ticks: number, ref: string, plus: Record<string, unknown> = {}) => ({ rank: rang, rang, rangGeneral: rang + 6, ref, name, ticks, deaths: 3, medal: "gold", ...plus });
const corpsAmis = (plus: Record<string, unknown> = {}) => ({
  filtre: "amis",
  date: "2026-11-04",
  classes: 3,
  amis: 4,
  absents: [{ ref: REF_C, pseudo: "Gaston" }],
  open: true,
  participants: 412,
  top: [ligne(1, "Lilou", 3000, REF_A), ligne(2, "Nathan", 3500, REF_MOI, { moi: true, medal: "silver" }), ligne(3, "Pépito", 5000, REF_B, { medal: null })],
  me: null,
  ...plus,
});

describe("lire le classement « Amis » (lot F2)", () => {
  it("lit les lignes (rang entre amis), toi, les absents et les nombres", () => {
    const c = lireClassementAmis(corpsAmis())!;
    expect(c.lignes.map((l) => [l.rang, l.rangGeneral, l.name, l.moi])).toEqual([
      [1, 7, "Lilou", false],
      [2, 8, "Nathan", true],
      [3, 9, "Pépito", false],
    ]);
    expect(c.absents).toEqual([{ ref: REF_C, pseudo: "Gaston" }]);
    expect([c.classes, c.amis, c.participants, c.date]).toEqual([3, 4, 412, "2026-11-04"]);
    expect(c.lignes[2]!.medal).toBeNull();
  });

  it("refuse la réponse d'un serveur plus ancien, qui ignore le filtre et rend le classement « Tous »", () => {
    expect(lireClassementAmis({ date: "2026-11-04", open: true, participants: 3, levelId: "x", top: [ligne(1, "A", 1, REF_A)], me: null })).toBeNull();
    expect(lireClassementAmis({ ...corpsAmis(), filtre: "tous" })).toBeNull();
    expect(lireClassementAmis(null)).toBeNull();
    expect(lireClassementAmis("amis")).toBeNull();
    expect(lireClassementAmis({ ...corpsAmis(), top: "x" })).toBeNull();
  });

  it("écarte seulement les lignes mal formées (référence, temps, médaille, pseudo)", () => {
    const c = lireClassementAmis(
      corpsAmis({
        top: [
          ligne(1, "Bon", 1000, REF_A),
          ligne(2, "Sans référence", 1000, "pas-une-ref"),
          ligne(3, "Temps NaN", Number.NaN, REF_B),
          ligne(4, "Médaille inconnue", 1000, REF_B, { medal: "constructor" }),
          ligne(5, "", 1000, REF_B),
          { rank: 6, name: "Rang absent", ticks: 1, deaths: 0, medal: null, ref: REF_B, rang: undefined },
          "n'importe quoi",
        ],
        absents: [{ ref: "x", pseudo: "Mauvaise ref" }, { ref: REF_C, pseudo: "" }, { ref: REF_C, pseudo: "Gaston" }, 4],
      }),
    )!;
    expect(c.lignes.map((l) => l.name)).toEqual(["Bon", "Rang absent"]);
    expect(c.absents).toEqual([{ ref: REF_C, pseudo: "Gaston" }]);
  });

  it("les médailles reconnues sont celles du jeu", () => {
    expect([...MEDAILLES].sort()).toEqual(Object.keys(MEDAL_TYPE).sort());
  });

  it("garde le rang entre amis (`rang`, sinon `rank`) et sans `rangGeneral` la ligne reste lisible", () => {
    const c = lireClassementAmis(corpsAmis({ top: [{ rank: 4, name: "Z", ticks: 10, deaths: 0, medal: null, ref: REF_A }] }))!;
    expect(c.lignes[0]).toMatchObject({ rang: 4, rangGeneral: null });
  });

  it("des nombres absents se déduisent des lignes", () => {
    const c = lireClassementAmis({ filtre: "amis", date: "2026-11-04", top: [ligne(1, "A", 1, REF_A, { moi: true }), ligne(2, "B", 2, REF_B)], absents: [{ ref: REF_C, pseudo: "C" }] })!;
    expect([c.classes, c.amis, c.participants]).toEqual([2, 2, 2]);
  });
});

describe("les lignes d'« Amis » (lot F2)", () => {
  it("une ligne porte le rang entre amis, le temps, la médaille, les morts, ta marque et sa référence", () => {
    const c = lireClassementAmis(corpsAmis())!;
    const { classes, absents } = lignesAmis(c);
    expect(classes.map((r) => [r.rank, r.name, r.mine, r.ref])).toEqual([
      ["1", "Lilou", false, REF_A],
      ["2", "Nathan", true, REF_MOI],
      ["3", "Pépito", false, REF_B],
    ]);
    expect(classes[0]).toMatchObject({ medal: "gold", deaths: "3 morts" });
    expect(classes[0]!.time.replace(/\s/g, " ")).toBe("25,000 s"); // 3 000 pas à 120 par seconde ; l'espace avant « s » est insécable
    expect(absents.map((a) => a.pseudo)).toEqual(["Gaston"]);
    expect(ligneDeAmis(c.lignes[1]!).mine).toBe(true);
  });

  it("toucher une ligne ouvre la feuille, sauf la tienne et sauf sans référence", () => {
    const c = lireClassementAmis(corpsAmis())!;
    expect(lignesAmis(c).classes.map(ouvrable)).toEqual([true, false, true]);
    expect(ouvrable({ mine: false })).toBe(false);
  });

  it("le classement « Tous » porte aussi la référence (la feuille s'ouvre depuis lui)", () => {
    const board: JumpBoard = {
      date: "2026-11-04",
      open: true,
      participants: 412,
      levelId: "x",
      top: [{ rank: 1, name: "Brindille", ticks: 3000, deaths: 1, medal: "gold", ref: REF_A }, { rank: 2, name: "Ancien serveur", ticks: 3100, deaths: 0, medal: null }],
      me: { rank: 30, name: "Moi", ticks: 9000, deaths: 5, medal: null, ref: REF_MOI },
    };
    const { rows } = rowsOf(board);
    expect(rows.map((r) => r.ref)).toEqual([REF_A, undefined, REF_MOI]);
    expect(rows.map(ouvrable)).toEqual([true, false, false]); // la dernière est toi (rang 30 = `me`)
    expect("ref" in rows[1]!).toBe(false); // un serveur d'avant n'ajoute pas de clé vide
  });
});

describe("le filtre dans l'adresse (lot F2)", () => {
  const page = { pathname: "/jump/", search: "?seed=2026-11-03&debug", hash: "" };
  it("?filtre=amis pour Amis, rien pour Tous, le reste de l'adresse gardé", () => {
    expect(adresseDuFiltre(page, "amis")).toBe("/jump/?seed=2026-11-03&debug=&filtre=amis".replace("debug=&", "debug=&"));
    expect(adresseDuFiltre({ ...page, search: "?seed=2026-11-03&debug=&filtre=amis" }, "tous")).toBe("/jump/?seed=2026-11-03&debug=");
    expect(adresseDuFiltre({ pathname: "/jump/", search: "", hash: "#x" }, "amis")).toBe("/jump/?filtre=amis#x");
    expect(adresseDuFiltre({ pathname: "/jump/", search: "?filtre=amis", hash: "" }, "tous")).toBe("/jump/");
  });
  it("le paramètre est dans la liste des options d'adresse, et seule la valeur « amis » compte", () => {
    expect(URL_OPTIONS.some((o) => o.name === "filtre" && o.values.includes("amis"))).toBe(true);
    expect(readUrlOptions("?filtre=amis").filtre).toBe("amis");
    expect(readUrlOptions("?filtre=n-importe-quoi").filtre).toBe("tous");
    expect(readUrlOptions("").filtre).toBe("tous");
  });
});

describe("quand le sélecteur existe (lot F2)", () => {
  it("un profil inconnu du serveur n'a pas de sélecteur, un réseau coupé en garde un", () => {
    expect(sansSelecteur("unknown_player")).toBe(true);
    expect(sansSelecteur("invalid_player")).toBe(true);
    expect(sansSelecteur("code_revoked")).toBe(true);
    expect(sansSelecteur("network")).toBe(false);
    expect(sansSelecteur("rate_limited")).toBe(false);
  });
});

describe("la manette (lot M1)", () => {
  it("la feuille d'un joueur est déclarée telle que le socle la nomme, sans importer ses composants", () => {
    const ligneFeuille = ECRANS_MANETTE.find((e) => e.ecran === ECRAN_MANETTE_FEUILLE.ecran);
    expect(ligneFeuille).toEqual(ECRAN_MANETTE_FEUILLE);
  });
});

// --- Le module à la demande, sur le petit DOM de test ---------------------------------------------------------------------------------------------------------------------------

const faux = <T>(x: T) => x as unknown as FauxElement;
let doc: FauxDocument;

interface Reponse {
  status?: number;
  corps: unknown;
}
function reseau(routes: Record<string, Reponse | ((init: RequestInit) => Reponse)>) {
  const appels: { url: string; methode: string; joueur: string | null }[] = [];
  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    const chemin = url.replace("https://x.test", "");
    const entete = (init.headers ?? {}) as Record<string, string>;
    appels.push({ url: chemin, methode: init.method ?? "GET", joueur: entete["X-Player-Id"] ?? null });
    const cle = Object.keys(routes).find((k) => chemin === k || chemin.startsWith(`${k}?`));
    if (!cle) return { ok: false, status: 404, json: async () => ({ error: "not_found" }) } as Response;
    const r0 = routes[cle]!;
    const r = typeof r0 === "function" ? r0(init) : r0;
    const status = r.status ?? 200;
    return { ok: status < 400, status, json: async () => r.corps } as Response;
  };
  return { fetch, appels };
}

function faireEcran() {
  const hote = {
    amis: document.createElement("div") as unknown as HTMLElement,
    liste: document.createElement("ol") as unknown as HTMLElement,
    message: document.createElement("p") as unknown as HTMLElement,
    tete: document.createElement("div") as unknown as HTMLElement,
    course: document.createElement("button") as unknown as HTMLElement,
    pied: document.createElement("div") as unknown as HTMLElement,
    apres: null as BoardHote["apres"],
    echap: null as BoardHote["echap"],
  };
  const rendus: string[] = [];
  const ui = {
    isOpen: true,
    hote,
    open() {},
    close() {},
    // Le dessin du classement « Tous » du jeu : une ligne par rang, comme `ligneClassement`.
    update(v: BoardView) {
      rendus.push(v.rows.map((r) => r.name).join(","));
      const f = faux(hote.liste);
      f.replaceChildren(...v.rows.map((r) => ligneDuJeu(r.name, r.mine)));
      hote.message.textContent = v.message;
      hote.course.hidden = v.course === null;
      hote.apres?.(v);
    },
  };
  return { ui: ui as unknown as BoardUi & { isOpen: boolean }, hote, rendus };
}

/** Une ligne de la forme de `ligneClassement` (home.ts), que `main.ts` passe au module : `.ligne` > `.ligne__qui` > `.ligne__nom`, le rang et le temps. Le vrai pose `dataset` et des composants du socle, que le petit DOM de test ne connaît pas. */
function ligneDeTest(r: { rank: string; name: string; time: string; mine: boolean }): HTMLElement {
  const faux = (tag: string, classe: string, texte = "") => {
    const e = document.createElement(tag);
    e.setAttribute("class", classe);
    if (texte) e.textContent = texte;
    return e;
  };
  const nom = faux("span", "ligne__nom", r.name);
  const qui = faux("span", "ligne__qui");
  qui.append(nom);
  const li = faux("li", r.mine ? "ligne ligne--moi" : "ligne");
  li.append(faux("span", "ligne__rang", r.rank), qui, faux("span", "ligne__temps", r.time));
  return li as unknown as HTMLElement;
}

function ligneDuJeu(nom: string, moi = false) {
  const li = document.createElement("li") as unknown as FauxElement;
  li.setAttribute("class", moi ? "ligne ligne--moi" : "ligne");
  const qui = document.createElement("span") as unknown as FauxElement;
  qui.setAttribute("class", "ligne__qui");
  const n = document.createElement("span") as unknown as FauxElement;
  n.setAttribute("class", "ligne__nom");
  n.textContent = nom;
  qui.append(n);
  li.append(qui);
  return li;
}

const vueTous = (participants: number | null = 412): BoardView => ({
  subtitle: "Forêt",
  rows: [
    { rank: "1", name: "Brindille", time: "25,000 s", medal: "gold", deaths: "1 mort", mine: false, ref: REF_A },
    { rank: "2", name: "Moi", time: "3,500 s", medal: null, deaths: "2 morts", mine: true, ref: REF_MOI },
    { rank: "3", name: "Vieux serveur", time: "4,000 s", medal: null, deaths: "0 mort", mine: false },
  ],
  gap: false,
  message: "",
  course: "Brindille",
  participants,
});

const attendre = async (cond: () => boolean) => {
  for (let i = 0; i < 100 && !cond(); i++) await new Promise((r) => setTimeout(r, 0));
  expect(cond()).toBe(true);
};
const boutons = (e: HTMLElement, filtre: string) => faux(e).querySelectorAll(`[data-filtre=${filtre}]`)[0]!;

describe("le module des amis du classement (lot F2)", () => {
  beforeEach(() => {
    doc = installerFauxDom(vi);
    vi.stubGlobal("history", { state: null, replaceState: vi.fn() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const options = (r: ReturnType<typeof reseau>, ecran: ReturnType<typeof faireEcran>, plus: Record<string, unknown> = {}) => {
    const adresses: string[] = [];
    const o = {
      ui: ecran.ui,
      base: "https://x.test",
      playerId: () => "secret-du-joueur",
      date: () => "2026-11-04",
      filtre: "tous" as "tous" | "amis",
      href: "../amis/",
      ligne: ligneDeTest,
      fetch: r.fetch,
      page: { lire: () => ({ pathname: "/jump/", search: "?seed=2026-11-04", hash: "" }), remplacer: (a: string) => void adresses.push(a) },
      ...plus,
    };
    return { o, adresses };
  };
  const amis = { amis: [], total: 4, max: 100, invitation: { active: false } };

  it("pose « Tous · 412 » / « Amis · 4 » après un seul GET /api/amis et rend les lignes de « Tous » tactiles (sauf la tienne et sans référence)", async () => {
    const r = reseau({ "/api/amis": { corps: amis } });
    const e = faireEcran();
    const c = brancherAmis(options(r, e).o);
    e.ui.update(vueTous());
    c.ouvrir(vueTous());
    await attendre(() => faux(e.hote.amis).querySelectorAll("[role=radio]").length === 2);
    expect(faux(e.hote.amis).querySelectorAll("[role=radio]").map((b) => b.textContent)).toEqual(["Tous · 412", "Amis · 4"]);
    expect(r.appels).toEqual([{ url: "/api/amis", methode: "GET", joueur: "secret-du-joueur" }]);
    const lis = faux(e.hote.liste).children;
    expect(lis.map((l) => l.classList.contains("ligne--ouvrable"))).toEqual([true, false, false]);
    expect(faux(lis[0]!).querySelector("button")!.textContent).toBe("Brindille");
  });

  it("« Amis » fait une requête séparée, montre toi et tes amis puis les absents sans temps, et écrit ?filtre=amis", async () => {
    const r = reseau({ "/api/amis": { corps: amis }, "/api/jump/day/2026-11-04/board": { corps: corpsAmis() } });
    const e = faireEcran();
    const { o, adresses } = options(r, e);
    brancherAmis(o).ouvrir(vueTous());
    e.ui.update(vueTous());
    await attendre(() => faux(e.hote.amis).querySelectorAll("[role=radio]").length === 2);
    expect(r.appels.filter((a) => a.url.includes("filtre=amis"))).toHaveLength(0); // pas de requête tant qu'on reste sur « Tous »
    boutons(e.hote.amis, "amis").click();
    await attendre(() => faux(e.hote.liste).children.length === 4);
    expect(adresses).toEqual(["/jump/?seed=2026-11-04&filtre=amis"]);
    expect(r.appels.at(-1)).toEqual({ url: "/api/jump/day/2026-11-04/board?filtre=amis", methode: "GET", joueur: "secret-du-joueur" });
    const lis = faux(e.hote.liste).children;
    expect(lis.map((l) => l.querySelector(".ligne__nom")!.textContent)).toEqual(["Lilou", "Nathan", "Pépito", "Gaston"]);
    expect(lis.map((l) => l.querySelector(".ligne__rang")!.textContent)).toEqual(["1", "2", "3", "—"]);
    expect(lis[3]!.querySelector(".ligne__temps")!.textContent).toBe("pas encore joué");
    expect(lis.map((l) => l.classList.contains("ligne--ouvrable"))).toEqual([true, false, true, true]); // tout sauf toi
    expect(faux(e.hote.course).hidden).toBe(true);
    expect(faux(e.hote.pied).children).toHaveLength(0); // des amis : pas d'invitation
    // Revenir à « Tous » retire le paramètre et rend les lignes du jeu.
    boutons(e.hote.amis, "tous").click();
    expect(adresses.at(-1)).toBe("/jump/?seed=2026-11-04");
    expect(faux(e.hote.liste).children.map((l) => l.querySelector(".ligne__nom")?.textContent)).toEqual(["Brindille", "Moi", "Vieux serveur"]);
  });

  it("sans ami, « Amis » propose d'en inviter un", async () => {
    const r = reseau({ "/api/amis": { corps: { ...amis, total: 0 } }, "/api/jump/day/2026-11-04/board": { corps: corpsAmis({ amis: 0, absents: [], classes: 1, top: [ligne(1, "Nathan", 3500, REF_MOI, { moi: true })] }) } });
    const e = faireEcran();
    brancherAmis(options(r, e, { filtre: "amis" }).o).ouvrir(vueTous());
    e.ui.update(vueTous());
    await attendre(() => faux(e.hote.pied).children.length === 1);
    expect(faux(e.hote.pied).querySelector("a")!.getAttribute("href")).toBe("../amis/");
    expect(faux(e.hote.liste).children).toHaveLength(1);
  });

  it("une erreur retombe sur « Tous » avec une phrase discrète, et retire le paramètre de l'adresse", async () => {
    const r = reseau({ "/api/amis": { corps: amis }, "/api/jump/day/2026-11-04/board": { status: 429, corps: { error: "rate_limited" } } });
    const e = faireEcran();
    const { o, adresses } = options(r, e, { filtre: "amis" });
    brancherAmis(o).ouvrir(vueTous());
    e.ui.update(vueTous());
    await attendre(() => adresses.length > 0);
    expect(adresses.at(-1)).toBe("/jump/?seed=2026-11-04");
    await attendre(() => faux(e.hote.liste).children.some((l) => l.classList.contains("ligne--ouvrable")));
    expect(boutons(e.hote.amis, "tous").getAttribute("aria-checked")).toBe("true");
    expect(faux(e.hote.amis).querySelector(".dj-amis-message")!.textContent).not.toBe("");
  });

  it("une réponse « Tous » d'un serveur plus ancien n'est jamais montrée comme des amis", async () => {
    const tous = { date: "2026-11-04", open: true, participants: 2, levelId: "x", top: [ligne(1, "Inconnu", 100, REF_A)], me: null };
    const r = reseau({ "/api/amis": { corps: amis }, "/api/jump/day/2026-11-04/board": { corps: tous } });
    const e = faireEcran();
    brancherAmis(options(r, e, { filtre: "amis" }).o).ouvrir(vueTous());
    e.ui.update(vueTous());
    await attendre(() => faux(e.hote.amis).querySelectorAll("[role=radio]").length === 2 && boutons(e.hote.amis, "tous").getAttribute("aria-checked") === "true" && r.appels.some((a) => a.url.includes("filtre=amis")));
    await attendre(() => faux(e.hote.amis).querySelector(".dj-amis-message")!.textContent !== "");
    expect(faux(e.hote.liste).children.map((l) => l.querySelector(".ligne__nom")?.textContent)).toEqual(["Brindille", "Moi", "Vieux serveur"]);
  });

  it("un profil inconnu du serveur n'a pas de sélecteur", async () => {
    const r = reseau({ "/api/amis": { status: 404, corps: { error: "unknown_player" } } });
    const e = faireEcran();
    brancherAmis(options(r, e).o).ouvrir(vueTous());
    e.ui.update(vueTous());
    await attendre(() => r.appels.length === 1);
    await new Promise((x) => setTimeout(x, 0));
    expect(faux(e.hote.amis).querySelectorAll("[role=radio]")).toHaveLength(0);
    expect(faux(e.hote.liste).children.some((l) => l.classList.contains("ligne--ouvrable"))).toBe(false);
  });

  it("sans identité : aucune requête, aucun sélecteur, aucune ligne tactile", async () => {
    const r = reseau({ "/api/amis": { corps: amis } });
    const e = faireEcran();
    brancherAmis(options(r, e, { playerId: () => null }).o).ouvrir(vueTous());
    e.ui.update(vueTous());
    await new Promise((x) => setTimeout(x, 5));
    expect(r.appels).toHaveLength(0);
    expect(faux(e.hote.amis).querySelectorAll("[role=radio]")).toHaveLength(0);
    expect(faux(e.hote.liste).children.some((l) => l.classList.contains("ligne--ouvrable"))).toBe(false);
  });

  it("un réseau coupé garde le sélecteur, sans compteur d'amis", async () => {
    const r = reseau({});
    const coupe = async () => {
      throw new TypeError("Failed to fetch");
    };
    const e = faireEcran();
    const { o } = options(r, e, { fetch: coupe });
    brancherAmis(o).ouvrir(vueTous());
    e.ui.update(vueTous());
    await attendre(() => faux(e.hote.amis).querySelectorAll("[role=radio]").length === 2);
    expect(faux(e.hote.amis).querySelectorAll("[role=radio]").map((b) => b.textContent)).toEqual(["Tous · 412", "Amis"]);
  });

  it("toucher une ligne ouvre la feuille du joueur (fiche du jour), « Ajouter en ami » met le compteur à jour ; Échap reste à la feuille", async () => {
    const fiche = { ref: REF_A, pseudo: "Brindille", ami: false, reciproque: false, rang: 1, classes: 412, jeux: [{ jeu: "jump", site: "jump", nom: "Jump", unite: "temps", valeur: 3000, medaille: "or", rang: 1 }] };
    const r = reseau({
      "/api/amis": { corps: amis },
      [`/api/amis/fiche/${REF_A}`]: { corps: fiche },
      "/api/amis/": { corps: {} },
    });
    // POST /api/amis (ajout) : un chemin exact, donc une route à part.
    const base = r.fetch;
    const fetch = async (url: string, init: RequestInit) => {
      if (url === "https://x.test/api/amis" && init.method === "POST") {
        r.appels.push({ url: "/api/amis", methode: "POST", joueur: ((init.headers ?? {}) as Record<string, string>)["X-Player-Id"] ?? null });
        return { ok: true, status: 200, json: async () => ({ ami: { ref: REF_A, pseudo: "Brindille", reciproque: false, origine: "ajout" }, total: 5 }) } as Response;
      }
      return base(url, init);
    };
    const e = faireEcran();
    const { o } = options(r, e, { fetch });
    brancherAmis(o).ouvrir(vueTous());
    e.ui.update(vueTous());
    await attendre(() => faux(e.hote.amis).querySelectorAll("[role=radio]").length === 2);
    expect(e.hote.echap!()).toBe(false);
    faux(e.hote.liste).children[0]!.querySelector("button")!.click();
    await attendre(() => doc.querySelectorAll(".dj-feuille__principal").length === 1);
    expect(e.hote.echap!()).toBe(true); // Échap ne ferme que la feuille
    expect(r.appels.at(-1)).toEqual({ url: `/api/amis/fiche/${REF_A}?date=2026-11-04`, methode: "GET", joueur: "secret-du-joueur" });
    expect(doc.querySelector(".dj-feuille__titre")!.textContent).toBe("Brindille");
    expect(doc.querySelector(".dj-feuille__principal")!.textContent).toBe("Ajouter en ami");
    doc.querySelector(".dj-feuille__principal")!.click();
    await attendre(() => boutons(e.hote.amis, "amis").textContent === "Amis · 5");
    expect(r.appels.at(-1)).toEqual({ url: "/api/amis", methode: "POST", joueur: "secret-du-joueur" });
    // Échap ferme la feuille.
    doc.dispatchEvent(new FauxEvenement("keydown", { key: "Escape" }));
    expect(doc.querySelectorAll(".dj-feuille")).toHaveLength(0);
    expect(e.hote.echap!()).toBe(false);
  });

  it("un pseudo piégé reste du texte (lignes, absents et feuille)", async () => {
    const PIEGE = "<img src=x onerror=alert(1)>";
    const r = reseau({
      "/api/amis": { corps: amis },
      "/api/jump/day/2026-11-04/board": { corps: corpsAmis({ top: [ligne(1, PIEGE, 100, REF_A)], absents: [{ ref: REF_C, pseudo: PIEGE }] }) },
      [`/api/amis/fiche/${REF_A}`]: { corps: { ref: REF_A, pseudo: PIEGE, ami: true, reciproque: true, rang: 1, classes: 3, jeux: [] } },
    });
    const e = faireEcran();
    brancherAmis(options(r, e, { filtre: "amis" }).o).ouvrir(vueTous());
    e.ui.update(vueTous());
    await attendre(() => faux(e.hote.liste).children.length === 2);
    const lis = faux(e.hote.liste).children;
    expect(lis.map((l) => l.querySelector(".ligne__nom")!.textContent)).toEqual([PIEGE, PIEGE]);
    expect(faux(e.hote.liste).querySelectorAll("img")).toHaveLength(0);
    lis[0]!.querySelector("button")!.click();
    await attendre(() => doc.querySelectorAll(".dj-feuille__principal").length === 1);
    expect(doc.querySelectorAll("img")).toHaveLength(0);
    expect(doc.querySelector(".dj-feuille__titre")!.textContent).toBe(PIEGE);
  });

  it("fermer le classement ferme la feuille et ignore une réponse en retard", async () => {
    let rendre: (() => void) | null = null;
    const r = reseau({ "/api/amis": { corps: amis }, "/api/jump/day/2026-11-04/board": { corps: corpsAmis() } });
    const e = faireEcran();
    // Le classement « Amis » ne répond qu'à la main du test : on le ferme avant.
    const lent = async (url: string, init: RequestInit) => {
      if (!url.includes("filtre=amis")) return r.fetch(url, init);
      await new Promise<void>((fin) => (rendre = fin));
      return r.fetch(url, init);
    };
    const { o } = options(r, e, { fetch: lent });
    const c = brancherAmis(o);
    c.ouvrir(vueTous());
    e.ui.update(vueTous());
    await attendre(() => faux(e.hote.amis).querySelectorAll("[role=radio]").length === 2);
    boutons(e.hote.amis, "amis").click();
    c.fermer();
    rendre!();
    await new Promise((x) => setTimeout(x, 0));
    expect(faux(e.hote.liste).children.some((l) => l.querySelector(".ligne__nom")?.textContent === "Lilou")).toBe(false);
  });
});
