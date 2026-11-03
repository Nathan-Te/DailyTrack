import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { TestApi } from "../test/helpers";

// Lot K2 — le **banc de réponses** : la preuve qu'un refactor du serveur d'un jeu ne change rien pour les joueurs. Un scénario scripté appelle l'API (`appeler`), le banc garde pour chaque appel le statut,
// les en-têtes qui comptent et le corps **normalisé** (les jetons aléatoires masqués ; l'horloge est injectée, tout le reste est déterministe) ; le résultat est comparé à une **référence versée au dépôt**
// (`test/fixtures/banc-<jeu>.json`), produite par le code d'AVANT le refactor. Le même fichier sert aux bases SQLite et libSQL : elles doivent répondre pareil.
//
// **Quand le lancer** : à toute modification de `apps/api/src/jeux/**` ou du serveur d'un jeu migré (`apps/api/CLAUDE.md`, « Module des jeux »). **Régénérer la référence** (`UPDATE_BANC=1`) n'est permis que pour
// une différence voulue, listée et justifiée dans le README du lot ; jamais pour faire passer un refactor. K2b (Jump) et K2c (Track) écrivent leur scénario sur ce modèle (`banc-tower.ts`).

/** Un appel enregistré. */
export interface Trace {
  nom: string;
  status: number;
  entetes: Record<string, string>;
  corps: unknown;
}

const ENTETES_GARDES = ["cache-control", "vary", "retry-after", "content-type"];
const CLES_ALEATOIRES = new Set(["invitation", "jeton", "cle", "lien", "token", "key"]);
/** Des horodatages que le serveur lit sur l'horloge réelle (l'interrupteur n'utilise pas l'horloge injectée) : masqués. */
const CLES_HORLOGE_REELLE = new Set(["modifieLe", "creeeLe"]);

/** Masque ce qui est tiré au hasard à chaque passage (jetons, clés d'aperçu, identifiants de groupes) ; le reste est conservé tel quel. */
export function normaliser(valeur: unknown, cle = "", parent = ""): unknown {
  if (Array.isArray(valeur)) return valeur.map((v) => normaliser(v, cle, parent));
  if (valeur && typeof valeur === "object") return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, normaliser(v, k, cle)]));
  // Lot K2b : les durées mesurées sur l'horloge réelle (l'état du tableau de bord : `etat.api.ms`, `etat.base.ms`) varient d'un passage à l'autre.
  if (typeof valeur === "number" && cle === "ms" && (parent === "api" || parent === "base")) return "<durée réelle>";
  if (typeof valeur === "string") {
    if (CLES_ALEATOIRES.has(cle) && valeur.length > 0) return "<aléatoire>";
    if (CLES_HORLOGE_REELLE.has(cle) && valeur.length > 0) return "<horloge réelle>";
    if ((cle === "id" || cle === "groupe") && /^[0-9a-f]{12}$/.test(valeur)) return "<identifiant>";
    if (/^[0-9a-f]{32}$/.test(valeur) && !/^0{16}/.test(valeur)) return "<aléatoire>"; // un identifiant de joueur de test commence par des zéros ; un jeton tiré au hasard, non
  }
  return valeur;
}

export interface OptionsAppel {
  /** Le joueur qui appelle (`X-Player-Id`, `playerId(n)`). */
  id?: number | null;
  headers?: Record<string, string>;
  raw?: string;
  /** Par défaut chaque appel vient d'une adresse neuve (aucune limite par adresse n'interfère) ; à fixer pour tester une limite. */
  clientKey?: string;
}

export interface Banc {
  traces: Trace[];
  /** L'appel enregistré sous `nom` ; rend la réponse **brute** (non normalisée), pour que le scénario puisse s'en servir. */
  appeler(t: TestApi, nom: string, method: string, path: string, body?: unknown, opts?: OptionsAppel): Promise<{ status: number; body: any; headers: Headers }>;
  /** Une lecture directe de la base, enregistrée (ce que le serveur a écrit). */
  noter(nom: string, corps: unknown): void;
}

export function creerBanc(playerId: (n: number) => string): Banc {
  const traces: Trace[] = [];
  let adresse = 0;
  const ip = () => `198.51.${(adresse >> 8) & 255}.${adresse++ & 255}`;
  return {
    traces,
    async appeler(t, nom, method, path, body, opts = {}) {
      const headers = { ...(opts.id === undefined || opts.id === null ? {} : { "X-Player-Id": playerId(opts.id) }), ...opts.headers };
      const r = await t.call(method, path, body, { headers, raw: opts.raw, clientKey: opts.clientKey ?? ip() });
      const entetes: Record<string, string> = {};
      for (const h of ENTETES_GARDES) {
        const v = r.headers.get(h);
        if (v !== null) entetes[h] = v;
      }
      traces.push({ nom: `${nom} — ${method} ${path.replace(/\?.*$/, (q) => q)}`, status: r.status, entetes, corps: normaliser(r.body) });
      return r;
    },
    noter(nom, corps) {
      traces.push({ nom, status: 0, entetes: {}, corps: normaliser(corps) });
    },
  };
}

/** Compare à la référence versée ; `UPDATE_BANC=1` la réécrit (voir l'en-tête). Rend les différences (vide : identique). */
export function comparerALaReference(fichier: URL, traces: readonly Trace[]): string[] {
  const texte = JSON.stringify(traces, null, 1) + "\n";
  if (process.env.UPDATE_BANC === "1") {
    writeFileSync(fichier, texte);
    return [];
  }
  if (!existsSync(fichier)) return [`référence absente : ${fichier.pathname} (UPDATE_BANC=1 pour la produire sur le code d'avant le refactor)`];
  const reference = JSON.parse(readFileSync(fichier, "utf8")) as Trace[];
  const diffs: string[] = [];
  const n = Math.max(reference.length, traces.length);
  for (let i = 0; i < n; i++) {
    const a = JSON.stringify(reference[i]);
    const b = JSON.stringify(traces[i]);
    if (a !== b) diffs.push(`#${i} ${reference[i]?.nom ?? traces[i]?.nom}\n   avant : ${a?.slice(0, 600)}\n   après : ${b?.slice(0, 600)}`);
  }
  return diffs;
}
