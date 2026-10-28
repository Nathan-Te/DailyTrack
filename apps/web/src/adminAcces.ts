import { DEMO_BASE } from "./api";

// L'accès à la page /track/admin/ : **la connexion du panneau d'administration de la plateforme (compte Google de l'éditeur, cookie `__session`)** ou rien. Plus de jeton à
// saisir (le jeton `ADMIN_TOKEN` reste une affaire de scripts, côté serveur). La page est statique : elle ne montre **aucun outil et ne lit rien** tant que le serveur n'a
// pas répondu « oui » à `GET /api/admin/session` ; sinon elle affiche la raison et un lien vers la connexion (`/admin/?retour=/track/admin/`). Une démonstration locale
// (`?api=demo`) et l'absence d'API (poste de développement) ouvrent les outils **hors production seulement** : la construction de production n'a ni l'un ni l'autre.

export type RaisonRefus = "session" | "autre-origine" | "demo-fermee" | "non-configure" | "indisponible";
export type Acces = { ouvert: true; mode: "session" | "demo" | "local" } | { ouvert: false; raison: RaisonRefus };

export interface ContexteAcces {
  /** Construction de production (`VITE_PRODUCTION=1`) : ni démonstration ni poste sans serveur. */
  production: boolean;
  /** L'API est sur la même origine que la page (seule la session du panneau, un cookie, vaut pour elle). */
  memeOrigine: boolean;
}

/** Ce que l'adresse seule permet de décider, sans réseau : `null` quand il faut demander au serveur. */
export function accesSansReseau(base: string, c: ContexteAcces): Acces | null {
  if (base === DEMO_BASE) return c.production ? { ouvert: false, raison: "demo-fermee" } : { ouvert: true, mode: "demo" };
  if (base === "") return c.production ? { ouvert: false, raison: "non-configure" } : { ouvert: true, mode: "local" };
  if (!c.memeOrigine) return { ouvert: false, raison: "autre-origine" };
  return null;
}

/** La réponse de `GET /api/admin/session` : 200 = connecté ; 401 = pas de session ; 404 = le panneau n'existe pas sur ce serveur ; autre chose = injoignable. */
export function accesDeLaSession(status: number): Acces {
  if (status === 200) return { ouvert: true, mode: "session" };
  if (status === 401) return { ouvert: false, raison: "session" };
  if (status === 404) return { ouvert: false, raison: "non-configure" };
  return { ouvert: false, raison: "indisponible" };
}

/** La décision complète. `fetchImpl` : injectable (tests). Ne lève jamais. */
export async function verifierAcces(base: string, c: ContexteAcces, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<Acces> {
  const direct = accesSansReseau(base, c);
  if (direct) return direct;
  try {
    const r = await fetchImpl(`${base}/api/admin/session`, { method: "GET", credentials: "same-origin", cache: "no-store" });
    return accesDeLaSession(r.status);
  } catch {
    return { ouvert: false, raison: "indisponible" };
  }
}

export const TEXTES_ACCES: Record<RaisonRefus, { titre: string; texte: string; connexion: boolean }> = {
  session: { titre: "Connexion requise", texte: "Cette page est réservée à l'éditeur. Connecte-toi avec ton compte Google dans le panneau d'administration : tu reviens ici ensuite.", connexion: true },
  "autre-origine": { titre: "Connexion impossible ici", texte: "La connexion du panneau ne vaut que pour le serveur du site lui-même, jamais pour une autre adresse d'API.", connexion: false },
  "demo-fermee": { titre: "Connexion requise", texte: "La démonstration n'existe pas sur le site publié : connecte-toi avec ton compte Google dans le panneau d'administration.", connexion: true },
  "non-configure": { titre: "Administration indisponible", texte: "Le serveur n'a pas de panneau d'administration configuré (connexion Google).", connexion: false },
  indisponible: { titre: "Serveur injoignable", texte: "Impossible de vérifier ta connexion pour le moment. Réessaie dans un instant.", connexion: false },
};

/** Le lien de connexion : le panneau de la plateforme (`/admin/`), qui ramène ici (`retour`) une fois connecté. Relatif à la page (`/track/admin/` → `/admin/`). */
export const LIEN_CONNEXION = "../../admin/?retour=%2Ftrack%2Fadmin%2F";
