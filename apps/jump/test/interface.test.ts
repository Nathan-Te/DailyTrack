import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CATALOGUE_COMMUN } from "@cdj/ui";
import { CATALOGUE_JUMP } from "../src/catalogue";
import { CATALOGUE_APERCU } from "../src/catalogue.apercu";
import { surveillerAnnonce, texteDeAnnonce, type Annonce } from "@cdj/profile";
import { rankApiBase } from "../src/rankApi";
import { baseDuMessage, commanderSurveillance, ecranDuMessage, type EtatEcrans } from "../src/messageEnDirectLogic";
import "./francais";

// Lot I5 : les feuilles de Jump suivent la charte « Cartouches » (docs/plateforme/identite.md, § 5 et § 11) comme celles du socle et de Track : toute couleur et
// toute police viennent des jetons de @cdj/ui (`var(--…)`), jamais de valeur en dur ; ombres nettes (aucun flou) ; aucune transparence d'arrière-plan ni dégradé de
// fond (seuls les motifs : rayures du voile, stries de la coque). Une ombre de texte, une seule : celle des titres de Jump (`--jump-ombre-titre`, nette, papier).
const SRC = join(__dirname, "../src");
const feuilles = readdirSync(SRC).filter((f) => f.endsWith(".css"));

describe("feuilles de style de Jump", () => {
  it("les quatre feuilles du jeu existent", () => {
    expect(feuilles.sort()).toEqual(["ecrans.css", "hud.css", "interface.css", "outils.css"]);
  });

  for (const f of feuilles) {
    const texte = readFileSync(join(SRC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    it(`${f} : jetons seulement (aucune couleur ni police en dur), aucune ombre floue, aucune translucidité ni dégradé de fond`, () => {
      expect(texte).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(texte).not.toMatch(/\b(rgba?|hsla?|oklch|color-mix)\(/);
      expect(texte).not.toMatch(/font-family:(?!\s*var\()/);
      expect(texte).not.toMatch(/\bopacity\s*:/);
      expect(texte).not.toMatch(/backdrop-filter|filter:\s*blur/);
      for (const m of texte.matchAll(/text-shadow:\s*([^;]+);/g)) expect(m[1], `${f} : ${m[1]}`).toBe("var(--jump-ombre-titre)");
      expect(texte).not.toMatch(/(?<!repeating-)linear-gradient\(/);
      expect(texte).not.toMatch(/radial-gradient\(/);
      for (const m of texte.matchAll(/box-shadow:\s*([^;]+);/g)) expect(m[1], `${f} : ${m[1]}`).not.toMatch(/-?\d+px\s+-?\d+px\s+[1-9]\d*px/);
    });
    it(`${f} : aucun émoji`, () => {
      expect(texte, f).not.toMatch(/\p{Extended_Pictographic}/u);
    });
  }
});

describe("catalogues de Jump", () => {
  // Chaque clé écrite en toutes lettres dans le code (`t("…")`, `lier(…, "…")`, `data-t="…"`) existe dans le catalogue du jeu ou le catalogue commun : une clé
  // absente s'afficherait telle quelle. (La parité fr / en est vérifiée par packages/ui/test/catalogues.test.ts.)
  // Lot I6 : les balises de partage de `index.html` lisent le catalogue de l'aperçu (construction seulement).
  const cles = new Set([...Object.keys(CATALOGUE_JUMP.fr), ...Object.keys(CATALOGUE_COMMUN.fr), ...Object.keys(CATALOGUE_APERCU.fr)]);
  const sources = [...readdirSync(SRC).filter((f) => f.endsWith(".ts") && !f.startsWith("catalogue")).map((f) => join(SRC, f)), join(__dirname, "../index.html")];
  it("chaque clé appelée par le code existe", () => {
    const absentes: string[] = [];
    for (const fichier of sources) {
      const texte = readFileSync(fichier, "utf8");
      const motifs = [/\bt\(\s*"([a-z][\w.]*)"/g, /\blier\([^,]+,\s*"([a-z][\w.]*)"/g, /\sdata-t(?:-[a-z-]+)?="([a-z][\w.]*)"/g, /\bcle:\s*"([a-z][\w.]*)"/g];
      for (const re of motifs) for (const m of texte.matchAll(re)) if (!cles.has(m[1]!)) absentes.push(`${fichier.split("/").pop()} : ${m[1]}`);
    }
    expect(absentes).toEqual([]);
  });

  it("nom affiché « Jump » partout (plus « DailyJump » dans l'interface) ; titre « Jump — Du Jour »", () => {
    for (const l of ["fr", "en"] as const) {
      for (const [k, v] of Object.entries(CATALOGUE_JUMP[l])) for (const x of typeof v === "string" ? [v] : Object.values(v)) expect(x, `${l} ${k}`).not.toMatch(/DailyJump/);
      expect(CATALOGUE_JUMP[l]["page.titre"]).toBe("Jump — Du Jour");
    }
    expect(readFileSync(join(__dirname, "../index.html"), "utf8")).not.toMatch(/DailyJump/);
  });

  it("aucun émoji dans l'interface : seulement dans la ligne à partager (share.ts)", () => {
    for (const l of ["fr", "en"] as const) for (const [k, v] of Object.entries(CATALOGUE_JUMP[l])) for (const x of typeof v === "string" ? [v] : Object.values(v)) expect(x, `${l} ${k}`).not.toMatch(/\p{Extended_Pictographic}/u);
    for (const f of readdirSync(SRC).filter((x) => x.endsWith(".ts") && !["share.ts", "dailyInfo.ts", "tune.ts"].includes(x))) {
      const code = readFileSync(join(SRC, f), "utf8").replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
      expect(code, f).not.toMatch(/["'`][^"'`\n]*\p{Extended_Pictographic}/u);
    }
  });
});

// --- Lot N2 : le message en direct (déplacé ici pour ne pas ajouter un fichier de tests au budget de la CI de PR, `scripts/unit-durees.json`) ---
// Lot N2 de la plateforme — le message en direct dans Jump : la décision (quel écran, quand lire le réseau), le câblage avec la vraie surveillance de `@cdj/profile`
// (minuterie, écoute et réseau injectés), et les garde-fous de source (jamais de focus, jamais de HTML, trois emplacements seulement).

const A: Annonce = { id: 7, fr: "Maintenance ce soir.", en: "Maintenance tonight.", ou: ["jump"], ton: "information", fin: 10_000_000 };
const reponse = (annonce: unknown) => new Response(JSON.stringify({ annonce, maintenant: "1970-01-01T00:00:00.000Z" }), { status: 200 });

const RIEN: EtatEcrans = { accueil: false, pause: false, arrivee: false, carnage: false };

describe("ecranDuMessage : accueil, arrivée et pause seulement", () => {
  it("l'accueil, l'arrivée et la pause portent le bandeau", () => {
    expect(ecranDuMessage({ ...RIEN, accueil: true })).toBe("accueil");
    expect(ecranDuMessage({ ...RIEN, arrivee: true })).toBe("arrivee");
    expect(ecranDuMessage({ ...RIEN, pause: true })).toBe("pause");
  });
  it("jamais pendant un niveau (aucun écran ouvert)", () => {
    expect(ecranDuMessage(RIEN)).toBeNull();
  });
  it("jamais pendant un carnage ou une rediffusion, quel que soit l'écran qu'on croit encore ouvert", () => {
    for (const e of ["accueil", "arrivee", "pause"] as const) expect(ecranDuMessage({ ...RIEN, [e]: true, carnage: true })).toBeNull();
    expect(ecranDuMessage({ accueil: true, pause: true, arrivee: true, carnage: true })).toBeNull();
  });
  it("la pause prime (elle se pose sur tout), puis l'arrivée, puis l'accueil", () => {
    expect(ecranDuMessage({ ...RIEN, accueil: true, pause: true })).toBe("pause");
    expect(ecranDuMessage({ ...RIEN, accueil: true, arrivee: true })).toBe("arrivee");
  });
});

describe("baseDuMessage : sans serveur et en démonstration, aucun bandeau", () => {
  it("rend l'adresse du classement ; null sans serveur, vide ou en démonstration", () => {
    expect(baseDuMessage("https://playdujour.com")).toBe("https://playdujour.com");
    expect(baseDuMessage(null)).toBeNull();
    expect(baseDuMessage("")).toBeNull();
    expect(baseDuMessage("demo")).toBeNull();
  });
  it("`?api=demo` et l'absence d'adresse du jeu donnent null, `?api=/` l'origine de la page", () => {
    expect(baseDuMessage(rankApiBase("demo", undefined, "https://playdujour.com", true))).toBeNull();
    expect(baseDuMessage(rankApiBase(null, undefined, "https://playdujour.com", true))).toBeNull();
    expect(baseDuMessage(rankApiBase("/", undefined, "https://playdujour.com", true))).toBe("https://playdujour.com");
  });
});

/** La vraie surveillance de `@cdj/profile` (`ou: "jump"`), une minuterie, une page et un réseau à la main, commandée comme `messageEnDirect.ts` la commande. */
function banc(reponses: (() => Response)[] = []) {
  const etat = { rappels: [] as (() => void)[], visibilite: [] as (() => void)[], maintenant: 0 };
  const fetchImpl = vi.fn(async () => (reponses.shift() ?? (() => reponse(A)))());
  const vues: (Annonce | null)[] = [];
  const stockage = new Map<string, string>();
  const surv = surveillerAnnonce({
    base: "https://playdujour.com",
    ou: "jump",
    surChangement: (a) => vues.push(a),
    stockage: { getItem: (k) => stockage.get(k) ?? null, setItem: (k, v) => void stockage.set(k, v) },
    fetchImpl,
    maintenant: () => etat.maintenant,
    visible: () => true,
    surVisibilite: (r) => {
      etat.visibilite.push(r);
      return () => void etat.visibilite.splice(etat.visibilite.indexOf(r), 1);
    },
    minuterie: {
      demarrer: (r) => (etat.rappels.push(r), r),
      arreter: (r) => void etat.rappels.splice(etat.rappels.indexOf(r as () => void), 1),
    },
  });
  const commander = commanderSurveillance(surv);
  /** Le jeu change d'écran : la décision, puis la commande. */
  const ecran = (e: EtatEcrans) => commander(ecranDuMessage(e));
  const vider = () => new Promise((ok) => setTimeout(ok, 0));
  const minute = async () => {
    for (const r of [...etat.rappels]) r();
    await vider();
  };
  return { etat, fetchImpl, vues, surv, ecran, vider, minute };
}

describe("le câblage : aucune lecture du réseau pendant un niveau", () => {
  it("accueil → niveau → pause → reprise → arrivée → rejouer : on ne lit que sur les trois écrans, et plus rien dès qu'un niveau commence", async () => {
    const b = banc();
    b.ecran({ ...RIEN, accueil: true });
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(1);
    expect(b.vues.at(-1)).toEqual(A); // le bandeau de l'accueil

    b.ecran(RIEN); // JOUER : un niveau commence
    expect(b.etat.rappels).toHaveLength(0); // minuterie arrêtée
    expect(b.etat.visibilite).toHaveLength(0); // écoute arrêtée
    await b.minute();
    await b.minute();
    for (const r of b.etat.visibilite) r();
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(1); // pas une lecture pendant le niveau

    b.ecran({ ...RIEN, pause: true }); // ⏸ pendant le niveau : un écran où le bandeau a le droit d'être
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(2);
    await b.minute(); // la pause reste ouverte : on relit toutes les minutes
    expect(b.fetchImpl).toHaveBeenCalledTimes(3);

    b.ecran(RIEN); // REPRENDRE
    expect(b.etat.rappels).toHaveLength(0);
    await b.minute();
    expect(b.fetchImpl).toHaveBeenCalledTimes(3);

    b.ecran({ ...RIEN, arrivee: true }); // l'arrivée
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(4);

    b.ecran(RIEN); // REJOUER
    await b.minute();
    expect(b.fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("d'un écran du bandeau à un autre (accueil → pause, arrivée → accueil), rien n'est relu de plus : une seule activation", async () => {
    const b = banc();
    b.ecran({ ...RIEN, accueil: true });
    await b.vider();
    b.ecran({ ...RIEN, accueil: true, pause: true });
    b.ecran({ ...RIEN, accueil: true });
    b.ecran({ ...RIEN, accueil: true, arrivee: true });
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(1);
    expect(b.etat.rappels).toHaveLength(1);
  });

  it("un carnage qui commence suspend tout, même depuis l'arrivée ; à sa fin l'arrivée relit", async () => {
    const b = banc();
    b.ecran({ ...RIEN, arrivee: true });
    await b.vider();
    b.ecran({ ...RIEN, arrivee: true, carnage: true });
    expect(b.etat.rappels).toHaveLength(0);
    await b.minute();
    expect(b.fetchImpl).toHaveBeenCalledTimes(1);
    b.ecran({ ...RIEN, arrivee: true });
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("une réponse en vol quand le niveau commence est ignorée : le message attend l'écran suivant", async () => {
    let finir!: (r: Response) => void;
    const b = banc();
    b.fetchImpl.mockImplementationOnce(() => new Promise<Response>((ok) => (finir = ok)));
    b.ecran({ ...RIEN, accueil: true });
    b.ecran(RIEN); // JOUER avant la réponse
    finir(reponse(A));
    await b.vider();
    expect(b.vues).toEqual([null]); // rien n'a été montré pendant le niveau
    b.ecran({ ...RIEN, pause: true });
    await b.vider();
    expect(b.vues.at(-1)).toEqual(A); // il arrive à l'écran suivant
  });

  it("ce qu'on savait se montre tout de suite à l'écran suivant, sans attendre le réseau ; fermé, il ne revient pas", async () => {
    const b = banc();
    b.ecran({ ...RIEN, accueil: true });
    await b.vider();
    b.ecran(RIEN);
    b.vues.length = 0;
    b.fetchImpl.mockImplementationOnce(() => new Promise<Response>(() => {})); // le réseau ne répond pas
    b.ecran({ ...RIEN, arrivee: true });
    expect(b.vues).toEqual([A]);
    b.surv.fermer(); // la croix du bandeau
    expect(b.vues.at(-1)).toBeNull();
    b.ecran(RIEN);
    b.fetchImpl.mockImplementationOnce(async () => reponse(A));
    b.ecran({ ...RIEN, pause: true });
    await b.vider();
    expect(b.vues.at(-1)).toBeNull(); // le même message, fermé : pas de bandeau
  });

  it("un message qui n'est pas pour Jump ne s'affiche pas ; une panne du réseau ne casse rien", async () => {
    const b = banc([() => reponse({ ...A, ou: ["portail", "track"] }), () => new Response("{}", { status: 500 })]);
    b.ecran({ ...RIEN, accueil: true });
    await b.vider();
    expect(b.vues.at(-1)).toBeNull();
    b.fetchImpl.mockImplementationOnce(async () => {
      throw new Error("hors ligne");
    });
    await b.minute();
    await b.minute();
    expect(b.vues.at(-1)).toBeNull();
  });
});

describe("la langue", () => {
  it("le texte suit la langue du jeu (le français à défaut)", () => {
    expect(texteDeAnnonce(A, "fr")).toBe("Maintenance ce soir.");
    expect(texteDeAnnonce(A, "en")).toBe("Maintenance tonight.");
    expect(texteDeAnnonce({ ...A, en: "" }, "en")).toBe("Maintenance ce soir.");
  });
});

describe("garde-fous de source", () => {
  const lire = (f: string) => readFileSync(join(__dirname, "../src", f), "utf8");
  it("le bandeau ne prend jamais le focus et le texte n'est jamais du HTML", () => {
    const code = lire("messageEnDirect.ts").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\.focus\s*\(/);
    expect(code).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  });
  it("les trois écrans ont leur emplacement et main.ts commande le message sur un changement d'écran (syncPause, arrivée, carnage, nouvel essai)", () => {
    for (const f of ["home.ts", "arrival.ts", "pauseMenu.ts"]) expect(lire(f)).toContain("hoteMessage");
    const main = lire("main.ts");
    expect(main).toContain("function syncMessage");
    expect(main).toMatch(/syncPause\(\): void \{[\s\S]*?syncMessage\(\);\n\}/);
  });
  it("le bandeau est destiné à Jump", () => {
    expect(lire("messageEnDirect.ts")).toContain('ou: "jump"');
  });
});
