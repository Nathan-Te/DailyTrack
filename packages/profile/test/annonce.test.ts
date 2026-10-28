import { describe, expect, it, vi } from "vitest";
import { ANNONCE_FERMEE_KEY, annonceAffichable, annonceDe, ecrireAnnonceFermee, lireAnnonce, lireAnnonceFermee, surveillerAnnonce, texteDeAnnonce, type Annonce } from "../src/index";

// Lot N2 — le message en direct côté client : forme, affichage (où, fin, fermé), relecture toutes les 60 s seulement visible, **aucune lecture réseau tant que l'écran est suspendu**.

const A: Annonce = { id: 7, fr: "Maintenance ce soir.", en: "Maintenance tonight.", ou: ["portail", "track"], ton: "information", fin: 10_000_000 };
const reponse = (annonce: unknown, maintenant = "1970-01-01T00:00:00.000Z") => new Response(JSON.stringify({ annonce, maintenant }), { status: 200 });

describe("annonceDe : ce que le serveur rend", () => {
  it("lit un message bien formé, ignore un endroit inconnu, refuse tout le reste", () => {
    expect(annonceDe(A)).toEqual(A);
    expect(annonceDe({ ...A, ou: ["portail", "ailleurs", 3] })!.ou).toEqual(["portail"]);
    expect(annonceDe(null)).toBeNull();
    expect(annonceDe({ ...A, ton: "alerte" })).toBeNull();
    expect(annonceDe({ ...A, fr: 12 })).toBeNull();
    expect(annonceDe({ ...A, fin: "demain" })).toBeNull();
    expect(annonceDe({ ...A, ou: "portail" })).toBeNull();
  });
  it("le texte suit la langue (le français à défaut)", () => {
    expect(texteDeAnnonce(A, "fr")).toBe("Maintenance ce soir.");
    expect(texteDeAnnonce(A, "en")).toBe("Maintenance tonight.");
    expect(texteDeAnnonce({ ...A, en: "" }, "en")).toBe("Maintenance ce soir.");
  });
});

describe("annonceAffichable : où, jusqu'à quand, fermé ou non", () => {
  it("seulement là où il est destiné", () => {
    expect(annonceAffichable(A, "portail", 0, null)).toBe(A);
    expect(annonceAffichable(A, "track", 0, null)).toBe(A);
    expect(annonceAffichable(A, "jump", 0, null)).toBeNull();
    expect(annonceAffichable(null, "portail", 0, null)).toBeNull();
  });
  it("s'éteint à l'heure de fin, même si le cache la rend encore ; l'horloge de l'appareil est corrigée par celle du serveur", () => {
    expect(annonceAffichable(A, "portail", A.fin - 1, null)).toBe(A);
    expect(annonceAffichable(A, "portail", A.fin, null)).toBeNull();
    // Un téléphone en retard de 5 min : l'heure du serveur fait foi.
    expect(annonceAffichable(A, "portail", A.fin - 60_000, null, 120_000)).toBeNull();
  });
  it("fermé sur cet appareil, il ne revient que s'il change (un autre identifiant)", () => {
    expect(annonceAffichable(A, "portail", 0, 7)).toBeNull();
    expect(annonceAffichable({ ...A, id: 8 }, "portail", 0, 7)).not.toBeNull();
  });
});

describe("le message fermé : stockage injecté, jamais d'exception", () => {
  it("s'écrit et se relit ; sans stockage, ou stockage qui lève, rien ne casse", () => {
    const m = new Map<string, string>();
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(lireAnnonceFermee(s)).toBeNull();
    ecrireAnnonceFermee(s, 12);
    expect(m.get(ANNONCE_FERMEE_KEY)).toBe("12");
    expect(lireAnnonceFermee(s)).toBe(12);
    m.set(ANNONCE_FERMEE_KEY, "n'importe quoi");
    expect(lireAnnonceFermee(s)).toBeNull();
    const casse = { getItem: () => { throw new Error("refusé"); }, setItem: () => { throw new Error("refusé"); } };
    expect(lireAnnonceFermee(casse)).toBeNull();
    expect(() => ecrireAnnonceFermee(casse, 1)).not.toThrow();
    expect(lireAnnonceFermee(null)).toBeNull();
    expect(() => ecrireAnnonceFermee(undefined, 1)).not.toThrow();
  });
});

describe("lireAnnonce : `GET /api/annonce`", () => {
  it("rend le message et le décalage d'horloge ; une panne est `null`", async () => {
    const f = vi.fn(async () => reponse(A, "1970-01-01T00:10:00.000Z"));
    const lu = await lireAnnonce("", f, () => 0);
    expect(lu).toEqual({ annonce: A, decalage: 600_000 });
    expect(f).toHaveBeenCalledWith("/api/annonce", expect.objectContaining({ method: "GET" }));
    expect((await lireAnnonce("", async () => reponse(null)))!.annonce).toBeNull();
    expect(await lireAnnonce("", async () => { throw new Error("réseau"); })).toBeNull();
    expect(await lireAnnonce("", async () => new Response("pas du json", { status: 200 }))).toBeNull();
    expect(await lireAnnonce("", async () => new Response("{}", { status: 500 }))).toBeNull();
  });
});

/** Une minuterie et une page à la main. */
function banc(reponses: (() => Response)[]) {
  const etat = { maintenant: 0, visible: true, rappels: [] as (() => void)[], visibilite: [] as (() => void)[], demarrees: 0, arretees: 0 };
  const fetchImpl = vi.fn(async () => (reponses.shift() ?? (() => reponse(null)))());
  const vues: (Annonce | null)[] = [];
  const stockage = new Map<string, string>();
  const surv = surveillerAnnonce({
    base: "",
    ou: "track",
    surChangement: (a) => vues.push(a),
    stockage: { getItem: (k) => stockage.get(k) ?? null, setItem: (k, v) => void stockage.set(k, v) },
    fetchImpl,
    maintenant: () => etat.maintenant,
    visible: () => etat.visible,
    surVisibilite: (r) => {
      etat.visibilite.push(r);
      return () => void etat.visibilite.splice(etat.visibilite.indexOf(r), 1);
    },
    minuterie: {
      demarrer: (r) => {
        etat.rappels.push(r);
        etat.demarrees++;
        return r;
      },
      arreter: (r) => {
        etat.rappels.splice(etat.rappels.indexOf(r as () => void), 1);
        etat.arretees++;
      },
    },
  });
  const vider = () => new Promise((ok) => setTimeout(ok, 0));
  return { etat, fetchImpl, vues, surv, stockage, vider };
}

describe("surveillerAnnonce : relire toutes les 60 s, seulement visible, jamais pendant une course", () => {
  it("à l'activation il lit tout de suite, montre le message, puis relit à chaque minute tant que la page est visible", async () => {
    const b = banc([() => reponse(A), () => reponse(A), () => reponse(null)]);
    b.surv.activer();
    await b.vider();
    expect(b.vues).toEqual([null, A]); // d'abord « rien », puis le message arrive
    expect(b.fetchImpl).toHaveBeenCalledTimes(1);
    b.etat.rappels[0]!(); // une minute passe
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(2);
    b.etat.visible = false;
    b.etat.rappels[0]!(); // onglet caché : la minute ne lit rien
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(2);
    b.etat.visible = true;
    b.etat.rappels[0]!();
    await b.vider();
    expect(b.vues.at(-1)).toBeNull(); // le message a été retiré : le bandeau disparaît
  });

  it("un onglet qui redevient visible relit tout de suite s'il n'a rien lu depuis une minute, pas avant", async () => {
    const b = banc([() => reponse(A), () => reponse(A)]);
    b.surv.activer();
    await b.vider();
    b.etat.maintenant = 30_000;
    b.etat.visibilite[0]!();
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(1);
    b.etat.maintenant = 61_000;
    b.etat.visibilite[0]!();
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("suspendu (une course, un niveau) : plus de minuterie, plus d'écoute, plus aucune lecture ; une réponse en vol est ignorée ; le message arrive à l'écran suivant", async () => {
    let finir!: (r: Response) => void;
    const b = banc([]);
    b.fetchImpl.mockImplementationOnce(() => new Promise<Response>((ok) => (finir = ok)));
    b.surv.activer();
    b.surv.suspendre(); // la course commence avant la réponse
    expect(b.etat.rappels).toHaveLength(0);
    expect(b.etat.visibilite).toHaveLength(0);
    finir(reponse(A));
    await b.vider();
    expect(b.vues).toEqual([null]); // rien n'a été montré
    expect(b.surv.courant()).toBeNull();
    const lecturesAvant = b.fetchImpl.mock.calls.length;
    b.etat.visible = true;
    b.etat.visibilite.forEach((r) => r());
    await b.vider();
    expect(b.fetchImpl.mock.calls.length).toBe(lecturesAvant); // aucune lecture pendant la course
    // L'écran suivant : il lit et montre.
    b.fetchImpl.mockImplementationOnce(async () => reponse(A));
    b.surv.activer();
    await b.vider();
    expect(b.vues.at(-1)).toEqual(A);
    expect(b.etat.demarrees).toBe(2);
  });

  it("ce qu'on savait déjà se montre tout de suite à l'écran suivant, sans attendre le réseau", async () => {
    const b = banc([() => reponse(A)]);
    b.surv.activer();
    await b.vider();
    b.surv.suspendre();
    b.vues.length = 0;
    b.fetchImpl.mockImplementationOnce(() => new Promise<Response>(() => {})); // le réseau ne répond pas
    b.surv.activer();
    expect(b.vues).toEqual([A]);
  });

  it("une panne du réseau garde le message d'avant ; fermer le retient et fait disparaître le bandeau ; un autre message revient", async () => {
    const b = banc([() => reponse(A), () => new Response("{}", { status: 500 }), () => reponse({ ...A, id: 8, fr: "Autre" })]);
    b.surv.activer();
    await b.vider();
    b.etat.rappels[0]!();
    await b.vider();
    expect(b.surv.courant()).toEqual(A); // la panne n'efface rien
    b.surv.fermer();
    expect(b.vues.at(-1)).toBeNull();
    expect(b.stockage.get(ANNONCE_FERMEE_KEY)).toBe("7");
    b.etat.rappels[0]!();
    await b.vider();
    expect(b.vues.at(-1)).toMatchObject({ id: 8, fr: "Autre" });
  });

  it("semée par la réponse de l'accueil, elle n'ajoute aucune lecture au chargement : la première relecture est dans 60 s", async () => {
    const b = banc([() => reponse(null)]);
    b.surv.semer(A, 0);
    b.surv.activer();
    await b.vider();
    expect(b.fetchImpl).not.toHaveBeenCalled();
    expect(b.vues).toEqual([A]);
    b.etat.rappels[0]!(); // la minute
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(1);
    expect(b.vues.at(-1)).toBeNull();
  });

  it("l'heure de fin éteint le bandeau sans nouvelle lecture", async () => {
    const b = banc([() => reponse(A)]);
    b.surv.activer();
    await b.vider();
    expect(b.surv.courant()).toEqual(A);
    b.etat.maintenant = A.fin;
    expect(b.surv.courant()).toBeNull();
  });
});
