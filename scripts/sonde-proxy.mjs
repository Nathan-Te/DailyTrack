// Sonde de l'adresse du client derrière Firebase Hosting (lot R4 de la plateforme) — **recette seulement**.
//
// Pourquoi : le serveur limite le débit **par adresse** (`TRUST_PROXY` = nombre de proxys de confiance, l'adresse est lue depuis la droite de
// `X-Forwarded-For`, apps/api/src/node-server.ts). Derrière Firebase Hosting, Cloud Run voit un proxy de plus : avec la valeur d'avant (1),
// tous les joueurs passés par le même relais de Firebase partageraient la même limite (des 429 pour tout le monde) ; avec une valeur trop
// haute, l'adresse lue serait celle que le client écrit lui-même (limite contournable). Aucune documentation de Firebase ne donne ce nombre :
// on le **mesure** sur la recette, avant la bascule (docs/plateforme/domaine.md, étape 8).
//
// Comment (rien de personnel n'est lu ni journalisé : on n'observe que des 429) : `GET /api/name` compte 40 vérifications par adresse et par
// fenêtre de 10 minutes (apps/api/src/identity.ts), en base.
//   1. 41 requêtes **directes** (adresse run.app, sans X-Forwarded-For inventé) : la 41ᵉ doit être refusée (429) — ton adresse a épuisé sa limite ;
//   2. 1 requête **par Firebase**, avec un X-Forwarded-For inventé : refusée (429) = le serveur y lit TON adresse → TRUST_PROXY est juste ;
//   3. sinon, 41 requêtes par Firebase avec un X-Forwarded-For inventé différent à chaque fois : un 429 = une adresse stable qui n'est pas la
//      tienne (le relais de Firebase) → TRUST_PROXY trop bas ; aucun 429 = l'adresse inventée est lue → TRUST_PROXY trop haut.
//
//   node scripts/sonde-proxy.mjs <adresse directe du service de recette> <adresse de la recette par Firebase> [--trust-proxy <valeur réglée>]
//   node scripts/sonde-proxy.mjs https://cdj-api-recette-xxxx-ew.a.run.app https://recette.playdujour.com --trust-proxy 1
// Puis régler la variable du dépôt RECETTE_TRUST_PROXY (et, la même valeur, TRUST_PROXY pour la production), redéployer, relancer la sonde
// (attendre 10 minutes entre deux essais : la fenêtre du débit).

//
// Lot R5 — deux autres mesures, toujours contre la recette seulement :
//   node scripts/sonde-proxy.mjs entetes <adresse directe> <adresse par Firebase> [--essais 20]
//        → ce que le serveur reçoit d'un appel direct et d'un appel par Firebase (route `/api/sonde/entetes`, recette seulement) : hôte,
//          noms des en-têtes, nombre d'entrées de X-Forwarded-For, adresses de connexion (combien de relais de Firebase différents) ;
//   node scripts/sonde-proxy.mjs faille <adresse directe (une révision de recette)> [--max 600]
//        → la preuve que la faille est fermée : des appels DIRECTS à `GET /api/name`, chacun avec une adresse inventée différente dans
//          X-Forwarded-For. Avant le lot R5, aucun n'était refusé (la limite de 40 par adresse était contournée) ; depuis, l'adresse de
//          connexion est comptée aussi : un refus (429) arrive au plus tard après 40 × PEER_FACTOR (= 400) appels.

export const NAME_CHECKS = 40;
/** `PEER_FACTOR` du serveur (apps/api/src/platform.ts ; le test apps/portail/test/domaine.test.ts vérifie l'accord). */
export const PEER_FACTOR = 10;

/**
 * Le verdict de la preuve « faille fermée » : `firstRefusal` = numéro du premier appel direct refusé (429), ou `null`.
 * Fermée si un refus arrive au plus tard au `NAME_CHECKS × PEER_FACTOR + 1`ᵉ appel (une fenêtre de débit qui change pendant la mesure
 * peut le retarder d'au plus une limite : on tolère le double).
 */
export function failleVerdict(firstRefusal, sent) {
  const bound = NAME_CHECKS * PEER_FACTOR + 1;
  if (firstRefusal !== null && firstRefusal <= 2 * bound) return { ok: true, text: `Faille fermée : ${sent} appels directs avec une adresse inventée différente à chaque fois, refusés (429) dès le ${firstRefusal}ᵉ (borne : ${bound}).` };
  if (firstRefusal !== null) return { ok: false, text: `Refus tardif (${firstRefusal}ᵉ appel, borne ${bound}) : plusieurs instances, ou une fenêtre qui a changé ; relancer dans 10 minutes.` };
  return { ok: false, text: `FAILLE OUVERTE : ${sent} appels directs avec une adresse inventée différente à chaque fois, aucun refusé : la limite par adresse est contournée.` };
}

/** Le résumé de la comparaison des en-têtes (réponses de `/api/sonde/entetes`). */
export function compareHeaders(direct, viaFirebase) {
  const names = (r) => new Set(r.entetes ?? []);
  const d = names(direct[0] ?? {});
  const onlyFirebase = [...new Set(viaFirebase.flatMap((r) => r.entetes ?? []))].filter((n) => !d.has(n)).sort();
  const peers = new Set(viaFirebase.map((r) => r.connexion).filter(Boolean));
  return {
    hoteDirect: direct[0]?.hote ?? null,
    hotesFirebase: [...new Set(viaFirebase.map((r) => r.hote))],
    hotesTransmisFirebase: [...new Set(viaFirebase.map((r) => r.hoteTransmis))],
    relaisDirect: direct[0]?.relais ?? null,
    relaisFirebase: [...new Set(viaFirebase.map((r) => r.relais))],
    entetesSeulementParFirebase: onlyFirebase,
    adressesDeConnexionFirebase: peers.size,
    adressesDeConnexionFirebaseListe: [...peers],
  };
}

/** La sonde ne vise jamais la production (elle consomme une limite de débit, en base). */
export function probeRefusal(direct, viaFirebase) {
  for (const u of [direct, viaFirebase]) {
    let host;
    try {
      host = new URL(u).hostname;
    } catch {
      return `adresse illisible : « ${u} »`;
    }
    if (!host.includes("recette")) return `la sonde ne tourne que contre la recette : « ${host} » ne contient pas « recette »`;
  }
  return null;
}

/**
 * Le verdict d'après ce qu'on a vu. `directLimited` : la 41ᵉ requête directe a été refusée ; `firstViaFirebase429` : la première requête par
 * Firebase (adresse inventée) a été refusée ; `viaFirebaseLimited` : une des 41 requêtes par Firebase (adresses inventées différentes) l'a été.
 */
export function verdict({ directLimited, firstViaFirebase429, viaFirebaseLimited, trustProxy = null }) {
  if (!directLimited) return { ok: false, text: "La limite directe n'a pas été atteinte : une autre fenêtre de débit a commencé pendant la sonde, ou TRUST_PROXY est déjà trop haut (adresse inventée lue). Attends 10 minutes et relance." };
  if (firstViaFirebase429) return { ok: true, text: "TRUST_PROXY est juste : par Firebase, le serveur lit ton adresse (la même que par l'accès direct), et une adresse inventée n'y change rien." };
  if (viaFirebaseLimited) return { ok: false, text: "TRUST_PROXY est TROP BAS : par Firebase, le serveur lit une adresse stable qui n'est pas la tienne (celle du relais de Firebase) : tous les joueurs partageraient la même limite. Augmente RECETTE_TRUST_PROXY de 1, redéploie la recette, attends 10 minutes, relance." };
  // Avec 1, l'adresse lue est celle que le frontal de Google a vue : jamais inventable. Aucune limite atteinte = des relais Firebase qui changent.
  if (trustProxy !== null && trustProxy <= 1) return { ok: false, text: "TRUST_PROXY est TROP BAS : par Firebase, le serveur lit l'adresse d'un relais de Firebase (plusieurs relais, qui changent d'une requête à l'autre). Augmente RECETTE_TRUST_PROXY de 1, redéploie la recette, attends 10 minutes, relance." };
  return { ok: false, text: "TRUST_PROXY est TROP HAUT : par Firebase, le serveur lit l'adresse inventée par le client (limite contournable). Diminue RECETTE_TRUST_PROXY de 1, redéploie la recette, attends 10 minutes, relance." };
}

async function status(url, headers = {}) {
  const res = await fetch(url, { headers });
  await res.arrayBuffer();
  return res.status;
}

async function entetes(argv) {
  const [direct, viaFirebase] = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
  const at = argv.indexOf("--essais");
  const n = at >= 0 ? Number(argv[at + 1]) : 20;
  const refusal = probeRefusal(direct, viaFirebase);
  if (refusal) {
    console.error(refusal);
    process.exit(2);
  }
  const get = async (base) => {
    const res = await fetch(`${base.replace(/\/+$/, "")}/api/sonde/entetes`, { headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) throw new Error(`${base} : ${res.status} (la route n'existe que sur la recette, depuis le lot R5)`);
    return res.json();
  };
  const d = [await get(direct)];
  const f = [];
  for (let i = 0; i < n; i++) f.push(await get(viaFirebase));
  console.log(JSON.stringify(compareHeaders(d, f), null, 2));
}

async function faille(argv) {
  const [direct] = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
  const at = argv.indexOf("--max");
  const max = at >= 0 ? Number(argv[at + 1]) : 2 * (NAME_CHECKS * PEER_FACTOR + 1);
  const refusal = probeRefusal(direct, direct);
  if (refusal) {
    console.error(refusal);
    process.exit(2);
  }
  const d = direct.replace(/\/+$/, "");
  const stamp = Date.now() % 200;
  let first = null;
  let sent = 0;
  for (let i = 0; i < max && first === null; i++) {
    sent++;
    // Une adresse inventée différente à chaque appel (plage de documentation 198.18.0.0/15, jamais routée).
    const forged = `198.${18 + ((i >> 16) & 1)}.${(stamp + (i >> 8)) % 256}.${i % 256}`;
    if ((await status(`${d}/api/name?name=Sonde${i}`, { "X-Forwarded-For": forged })) === 429) first = i + 1;
  }
  const v = failleVerdict(first, sent);
  console.log(v.text);
  process.exit(v.ok ? 0 : 1);
}

async function main(argv) {
  if (argv[0] === "entetes") return entetes(argv.slice(1));
  if (argv[0] === "faille") return faille(argv.slice(1));
  const [direct, viaFirebase] = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
  const trustAt = argv.indexOf("--trust-proxy");
  const trustProxy = trustAt >= 0 ? Number(argv[trustAt + 1]) : null;
  if (!direct || !viaFirebase) {
    console.error("usage : node scripts/sonde-proxy.mjs <adresse directe de la recette (run.app)> <adresse de la recette par Firebase>");
    process.exit(2);
  }
  const refusal = probeRefusal(direct, viaFirebase);
  if (refusal) {
    console.error(refusal);
    process.exit(2);
  }
  const path = (i) => `/api/name?name=Sonde${i}`;
  const d = direct.replace(/\/+$/, "");
  const f = viaFirebase.replace(/\/+$/, "");
  let directLimited = false;
  for (let i = 0; i <= NAME_CHECKS && !directLimited; i++) directLimited = (await status(`${d}${path(i)}`)) === 429;
  console.log(`1. accès direct : ${directLimited ? "limite atteinte (attendu)" : "limite NON atteinte"}`);
  const forged = (i) => ({ "X-Forwarded-For": `203.0.113.${(i % 250) + 1}` });
  const firstViaFirebase429 = (await status(`${f}${path(0)}`, forged(0))) === 429;
  console.log(`2. par Firebase, adresse inventée : ${firstViaFirebase429 ? "refusée (429) : c'est ton adresse qui compte" : "acceptée"}`);
  let viaFirebaseLimited = false;
  if (directLimited && !firstViaFirebase429) {
    for (let i = 1; i <= NAME_CHECKS + 1 && !viaFirebaseLimited; i++) viaFirebaseLimited = (await status(`${f}${path(i)}`, forged(i))) === 429;
    console.log(`3. par Firebase, adresses inventées différentes : ${viaFirebaseLimited ? "limite atteinte" : "jamais limité"}`);
  }
  const v = verdict({ directLimited, firstViaFirebase429, viaFirebaseLimited, trustProxy });
  console.log(`\n${v.text}`);
  process.exit(v.ok ? 0 : 1);
}

const { fileURLToPath } = await import("node:url");
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));
