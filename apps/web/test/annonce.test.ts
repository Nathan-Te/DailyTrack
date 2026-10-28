import { describe, expect, it, vi } from "vitest";
import { ANNONCE_FERMEE_KEY, surveillerAnnonce, type Annonce } from "@cdj/profile";
import { annonceAutorisee, ecranAnnonce, type EcranAnnonce } from "../src/annonceEcran";
import { creerPilote } from "../src/annonceTrack";

// Lot N2 — le message en direct dans Track : quels écrans l'affichent, quels écrans suspendent la surveillance (jamais de lecture du réseau en course), pas de bandeau sans serveur ni en démonstration.

const A: Annonce = { id: 7, fr: "Maintenance ce soir.", en: "Maintenance tonight.", ou: ["track"], ton: "information", fin: 10_000_000 };
const reponse = (annonce: unknown) => new Response(JSON.stringify({ annonce, maintenant: "1970-01-01T00:00:00.000Z" }), { status: 200 });

describe("ecranAnnonce : accueil, arrivée et pause seulement", () => {
  it("la course (décompte compris) n'a pas de bandeau", () => {
    expect(ecranAnnonce(false, false, false, false)).toBeNull();
  });
  it("l'accueil, la pause et l'arrivée en ont un", () => {
    expect(ecranAnnonce(false, true, false, false)).toBe("accueil");
    expect(ecranAnnonce(false, false, true, false)).toBe("pause");
    expect(ecranAnnonce(false, false, false, true)).toBe("arrivee");
  });
  it("tout autre écran ouvert (réglages, aide, archives, classement, Garage) l'efface, sur l'accueil, la pause comme l'arrivée", () => {
    for (const [accueil, pause, arrivee] of [[true, false, false], [false, true, false], [false, false, true], [false, false, false]] as const) expect(ecranAnnonce(true, accueil, pause, arrivee)).toBeNull();
  });
});

describe("annonceAutorisee : un serveur, une partie normale", () => {
  it("sans serveur, en démonstration, hors du circuit du jour (Salon, scénario) ou en rediffusion : jamais", () => {
    expect(annonceAutorisee("https://playdujour.com", "demo", false, false)).toBe(true);
    expect(annonceAutorisee("", "demo", false, false)).toBe(false);
    expect(annonceAutorisee(null, "demo", false, false)).toBe(false);
    expect(annonceAutorisee("demo", "demo", false, false)).toBe(false);
    expect(annonceAutorisee("https://playdujour.com", "demo", true, false)).toBe(false);
    expect(annonceAutorisee("https://playdujour.com", "demo", false, true)).toBe(false);
  });
});

/** Le pilote de Track sur la vraie surveillance de `@cdj/profile`, avec un réseau, une minuterie et une page à la main. */
function banc(reponses: (() => Response)[] = []) {
  const etat = { rappels: [] as (() => void)[], visibilite: [] as (() => void)[] };
  const fetchImpl = vi.fn(async () => (reponses.shift() ?? (() => reponse(null)))());
  const stockage = new Map<string, string>();
  const posees: { ecran: EcranAnnonce | null; a: Annonce | null }[] = [];
  let fermer: () => void = () => {};
  const pilote = creerPilote({
    surveiller: (surChangement) =>
      surveillerAnnonce({
        base: "",
        ou: "track",
        surChangement,
        stockage: { getItem: (k) => stockage.get(k) ?? null, setItem: (k, v) => void stockage.set(k, v) },
        fetchImpl,
        maintenant: () => 0,
        surVisibilite: (r) => {
          etat.visibilite.push(r);
          return () => void etat.visibilite.splice(etat.visibilite.indexOf(r), 1);
        },
        minuterie: {
          demarrer: (r) => (etat.rappels.push(r), r),
          arreter: (r) => void etat.rappels.splice(etat.rappels.indexOf(r as () => void), 1),
        },
      }),
    poser: (ecran, a, f) => {
      fermer = f;
      posees.push({ ecran, a });
    },
  });
  const vider = () => new Promise((ok) => setTimeout(ok, 0));
  const derniere = () => posees.at(-1);
  return { etat, fetchImpl, pilote, posees, derniere, vider, stockage, fermer: () => fermer() };
}

describe("le pilote : activer à l'accueil, à l'arrivée et en pause ; suspendre en course", () => {
  it("la course ne lit rien : ni au démarrage, ni minuterie, ni écoute de la visibilité", async () => {
    const b = banc();
    b.pilote.ecran(null);
    await b.vider();
    expect(b.fetchImpl).not.toHaveBeenCalled();
    expect(b.etat.rappels).toHaveLength(0);
    expect(b.etat.visibilite).toHaveLength(0);
  });

  it("l'accueil lit tout de suite et montre le message ; la course suspend (plus de minuterie, plus de lecture, bandeau retiré) ; l'arrivée relit", async () => {
    const b = banc([() => reponse(A), () => reponse(A)]);
    b.pilote.ecran("accueil");
    await b.vider();
    expect(b.derniere()).toEqual({ ecran: "accueil", a: A });
    expect(b.fetchImpl).toHaveBeenCalledTimes(1);
    expect(b.etat.rappels).toHaveLength(1);
    b.pilote.ecran(null); // « Courir »
    expect(b.derniere()).toEqual({ ecran: null, a: null });
    expect(b.etat.rappels).toHaveLength(0);
    expect(b.etat.visibilite).toHaveLength(0);
    b.etat.visibilite.forEach((r) => r());
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(1); // aucune lecture pendant la course
    b.pilote.ecran("arrivee");
    expect(b.derniere()).toEqual({ ecran: "arrivee", a: A }); // ce qu'on savait, sans attendre le réseau
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("un message qui arrive pendant la course attend l'écran suivant : la réponse en vol est ignorée", async () => {
    let finir!: (r: Response) => void;
    const b = banc();
    b.fetchImpl.mockImplementationOnce(() => new Promise<Response>((ok) => (finir = ok)));
    b.pilote.ecran("accueil");
    b.pilote.ecran(null); // la course commence avant la réponse
    finir(reponse(A));
    await b.vider();
    expect(b.posees.some((p) => p.a !== null)).toBe(false);
    b.fetchImpl.mockImplementationOnce(async () => reponse(A));
    b.pilote.ecran("pause"); // pause pendant la course : le bandeau a le droit d'y être, on relit tant qu'elle est ouverte
    await b.vider();
    expect(b.derniere()).toEqual({ ecran: "pause", a: A });
    b.pilote.ecran(null); // reprise
    expect(b.etat.rappels).toHaveLength(0);
    expect(b.derniere()).toEqual({ ecran: null, a: null });
  });

  it("d'un écran permis à un autre sans course entre les deux (accueil → pause) : le bandeau change d'hôte, sans lecture de plus", async () => {
    const b = banc([() => reponse(A)]);
    b.pilote.ecran("accueil");
    await b.vider();
    b.pilote.ecran("pause");
    expect(b.derniere()).toEqual({ ecran: "pause", a: A });
    await b.vider();
    expect(b.fetchImpl).toHaveBeenCalledTimes(1);
    expect(b.etat.rappels).toHaveLength(1);
  });

  it("répéter le même écran ne fait rien ; un autre écran (réglages…) suspend aussi", async () => {
    const b = banc([() => reponse(A)]);
    b.pilote.ecran("accueil");
    await b.vider();
    const n = b.posees.length;
    b.pilote.ecran("accueil");
    expect(b.posees).toHaveLength(n);
    b.pilote.ecran(null); // réglages ouverts : `ecranAnnonce` rend `null`
    expect(b.etat.rappels).toHaveLength(0);
  });

  it("fermer retient le message (il ne revient pas), un autre message revient ; la langue redessine sans lecture", async () => {
    const b = banc([() => reponse(A), () => reponse({ ...A, id: 8, fr: "Autre" })]);
    b.pilote.ecran("accueil");
    await b.vider();
    const n = b.posees.length;
    b.pilote.actualiser();
    expect(b.posees).toHaveLength(n + 1);
    expect(b.fetchImpl).toHaveBeenCalledTimes(1);
    b.fermer();
    expect(b.stockage.get(ANNONCE_FERMEE_KEY)).toBe("7");
    expect(b.derniere()).toEqual({ ecran: "accueil", a: null });
    b.etat.rappels[0]!(); // une minute plus tard
    await b.vider();
    expect(b.derniere()).toMatchObject({ ecran: "accueil", a: { id: 8 } });
  });

  it("hors écran permis, `actualiser` (changement de langue) ne pose rien", () => {
    const b = banc();
    b.pilote.actualiser();
    expect(b.posees).toHaveLength(0);
  });
});
