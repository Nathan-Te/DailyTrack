// Les adresses de la plateforme sur playdujour.com (lot R4) : une seule source pour les workflows, les tests et le guide
// (docs/plateforme/domaine.md). Fonctions pures, testées (apps/portail/test/domaine.test.ts). Ligne de commande :
//   node scripts/domaine.mjs origines production|recette [--en-plus "<origine>;<origine>"]
//        → ALLOWED_ORIGINS du serveur de cette cible, séparées par « ; » (lot R5 : plus l'ancienne origine GitHub Pages)
//   node scripts/domaine.mjs canal <numéro de PR>          → identifiant du canal d'aperçu Firebase (`pr-<n>`)
//   node scripts/domaine.mjs adresse production|recette     → l'adresse publique du site

/** Le domaine (acheté chez OVH, DNS chez OVH). */
export const DOMAINE = "playdujour.com";

/** Les adresses publiques : la production sert le portail et les deux jeux ; la recette sert `main` en entier. */
export const ADRESSES = {
  production: `https://${DOMAINE}`,
  recette: `https://recette.${DOMAINE}`,
};

const ORIGIN = /^https?:\/\/[^/\s;,]+$/;

/**
 * Les origines permises (`ALLOWED_ORIGINS`) du serveur d'une cible :
 *   - production : `https://playdujour.com` ;
 *   - recette : `https://recette.playdujour.com` ;
 *   - `enPlus` : d'autres origines (variables du dépôt ; l'origine du canal d'aperçu d'une PR, pour sa révision de recette).
 * Les jeux servis par Firebase appellent `/api/` sur leur propre origine : aucune requête CORS. La liste ne sert qu'aux appels d'une autre
 * origine (aperçu d'une PR qui vise sa révision par son adresse directe, essais locaux).
 * La production ne prend **jamais** l'origine de la recette ni une adresse `*.web.app` (un aperçu ne parle jamais à la production).
 */
export function allowedOrigins(cible, { enPlus = [] } = {}) {
  if (cible !== "production" && cible !== "recette") throw new Error(`cible inconnue : « ${cible} » (production ou recette)`);
  const out = [ADRESSES[cible]];
  for (const raw of enPlus.flatMap((e) => String(e).split(/[;,\s]+/)).filter(Boolean)) {
    const o = raw.replace(/\/+$/, "").toLowerCase();
    if (!ORIGIN.test(o)) throw new Error(`origine invalide : « ${raw} » (https://hôte, sans chemin)`);
    if (cible === "production" && (o === ADRESSES.recette || o.endsWith(".web.app") || o.endsWith(".firebaseapp.com"))) {
      throw new Error(`la production refuse l'origine « ${o} » : la recette et les aperçus ne parlent jamais à la production`);
    }
    if (!out.includes(o)) out.push(o);
  }
  return out;
}

/** L'identifiant du canal d'aperçu Firebase d'une PR : `pr-<n>` (son adresse : `https://<site de recette>--pr-<n>-<empreinte>.web.app`). */
export function previewChannel(pr) {
  const n = Number(pr);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`numéro de PR attendu, reçu « ${pr} »`);
  return `pr-${n}`;
}

/** L'origine d'une adresse (`https://hôte`), ou une erreur. */
export function originOf(url) {
  const u = new URL(url);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error(`adresse web attendue : « ${url} »`);
  return u.origin;
}

/**
 * Le stockage du navigateur est propre à une **origine** (protocole, hôte, port) : une origine qui n'est pas exactement celle de la production
 * ne lit ni n'écrit jamais son stockage (`cdj:*`, `jump:*`). Vrai si `url` (la recette, un canal d'aperçu…) est une autre origine que la
 * production. Un sous-domaine (`recette.playdujour.com`) est une autre origine : `localStorage` n'est jamais partagé entre sous-domaines.
 */
export function storageIsolatedFromProduction(url) {
  return originOf(url) !== originOf(ADRESSES.production);
}

/** Les canaux d'aperçu ne vivent que sur le site de **recette** : refuse de déployer un aperçu sur le site de production. */
export function assertPreviewSite(site, productionSite) {
  if (!site) throw new Error("site de recette absent");
  if (productionSite && site === productionSite) throw new Error(`les aperçus vont sur le site de recette, jamais sur celui de la production (« ${site} »)`);
  return site;
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("/scripts/domaine.mjs");
if (isMain) {
  const [cmd, a, ...rest] = process.argv.slice(2);
  const opt = (name) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : undefined);
  try {
    if (cmd === "origines") console.log(allowedOrigins(a, { enPlus: opt("--en-plus") ? [opt("--en-plus")] : [] }).join(";"));
    else if (cmd === "canal") console.log(previewChannel(a));
    else if (cmd === "adresse") {
      if (!(a in ADRESSES)) throw new Error(`cible inconnue : « ${a} »`);
      console.log(ADRESSES[a]);
    } else {
      console.error("usage : node scripts/domaine.mjs origines <cible> [--en-plus O] · canal <PR> · adresse <cible>");
      process.exit(2);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
