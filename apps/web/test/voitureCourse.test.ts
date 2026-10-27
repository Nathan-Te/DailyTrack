import { beforeAll, describe, expect, it } from "vitest";
import { Mesh, type Object3D } from "three";
import { COULEURS_VOITURE, MOTIFS_VOITURE, TEINTES_VOITURE, VOITURE_PAR_DEFAUT, VOITURES_GARAGE, dailyCircuit, daysFromCivil, encodeReplay, runPilot } from "@cdj/sim";
import type { ApiResult } from "@cdj/profile";
import type { ReponseChoix } from "../src/api";
import { MATERIAUX_2 } from "../src/voiture/materiaux2";
import { GhostField, type GhostEntry } from "../src/salonGhosts";
import { mergeProfile } from "../src/profileSync";
import { CHOIX_DEFAUT, CLE_GARAGE, choisirVoiture, lireChoix, noterDeblocages, voitureChoisie, voituresDebloquees, type ChoixVoiture } from "../src/voiture/choix";
import { VoitureEnJeu, type OptionsVoitureEnJeu } from "../src/voiture/enJeu";
import { MOTIFS, PALETTE, TEINTES_MOTIF } from "../src/voiture/livree";
import { choixDuServeur, choixEnAttente, envoyerChoix, minuteDe, noterChoixLocal, recaler, synchroniserChoix, type ApiChoix } from "../src/voiture/synchro";
import { planDe } from "../src/voiture/fantomes";

// Lot 51 : la voiture de chaque course (jointe à l'envoi, montrée au fantôme et à la rediffusion), et le choix du Garage gardé par le serveur (un seul profil sur tous
// les appareils). Sans carte graphique ni navigateur : le stockage, le réseau et l'horloge sont injectés.

class Memoire {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
const GT: ChoixVoiture = { id: "gt", couleur: 3, motif: "chevrons", teinteMotif: 2 };
const FOURGON: ChoixVoiture = { id: "fourgon", couleur: 5, motif: "damier", teinteMotif: 1 };
const lu = (s: Memoire) => JSON.parse(s.getItem(CLE_GARAGE) ?? "{}") as Record<string, unknown>;
const T0 = Date.parse("2026-10-28T10:00:00Z");

describe("les listes de la simulation sont celles du jeu (le serveur valide avec elles)", () => {
  it("les couleurs, les motifs et les teintes de la livrée ; les voitures du catalogue", () => {
    expect(COULEURS_VOITURE).toBe(PALETTE.length);
    expect([...MOTIFS_VOITURE]).toEqual([...MOTIFS]);
    expect(TEINTES_VOITURE).toBe(TEINTES_MOTIF.length);
    expect(VOITURE_PAR_DEFAUT).toEqual(CHOIX_DEFAUT);
    expect(VOITURE_PAR_DEFAUT.id).toBe(VOITURES_GARAGE[0]);
  });
});

describe("la voiture du record et du profil", () => {
  const profil = (extra: Record<string, unknown>) => ({
    name: "Alice",
    renameRequired: false,
    today: "2026-10-28",
    simVersion: 0,
    stats: { days: 1, medals: { author: 0, gold: 0, silver: 0, bronze: 0 }, bestRank: null, streak: 1 },
    past: [],
    ...extra,
  });
  const record = (voiture?: unknown, ms = 40_000) => ({ date: "2026-10-28", trackId: "jour-2026-10-28-g20", ms, medal: null, splits: [1], replay: "x", simVersion: 0, ...(voiture ? { voiture } : {}) });

  it("le record du serveur arrive avec la voiture de sa course ; un record local de même temps l'apprend ; une voiture illisible ne l'écrit pas", async () => {
    const { SIM_VERSION } = await import("@cdj/sim");
    const m = new Memoire();
    const r = mergeProfile(profil({ best: { ...record(GT), simVersion: SIM_VERSION }, garage: { voiture: FOURGON, minute: 5 } }) as never, m as never);
    expect(r.todayChanged).toBe(true);
    expect(r.garage, "le choix du serveur est rendu tel quel, pour la synchronisation à la demande").toEqual({ voiture: FOURGON, minute: 5 });
    const cle = "cdj:best:jour-2026-10-28-g20";
    expect(JSON.parse(m.getItem(cle)!).voiture).toEqual(GT);
    // Un record local de même temps, sans voiture : il l'apprend.
    const m2 = new Memoire();
    m2.setItem(cle, JSON.stringify({ ms: 40_000, splits: [1], replay: "x", simVersion: SIM_VERSION, medal: null }));
    expect(mergeProfile(profil({ best: { ...record(GT), simVersion: SIM_VERSION } }) as never, m2 as never).todayChanged).toBe(true);
    expect(JSON.parse(m2.getItem(cle)!).voiture).toEqual(GT);
    // Illisible : rien.
    const m3 = new Memoire();
    mergeProfile(profil({ best: { ...record({ id: "tank", couleur: 0, motif: "course", teinteMotif: 0 }), simVersion: SIM_VERSION } }) as never, m3 as never);
    expect(JSON.parse(m3.getItem(cle)!)).not.toHaveProperty("voiture");
    // Un serveur plus ancien ne parle pas du choix : `undefined`, rien à recaler.
    expect(mergeProfile(profil({ best: null }) as never, new Memoire() as never).garage).toBeUndefined();
  });
});

describe("le choix de voiture sur tous les appareils (voiture/synchro)", () => {
  /** Un faux serveur du choix : garde `{ voiture, minute }`, refuse ce que `refuse` dit. */
  function serveur(etat: { voiture: ChoixVoiture | null; minute: number | null }, o: { refuse?: (v: ChoixVoiture) => boolean; indisponible?: boolean; inconnu?: boolean } = {}) {
    const appels: { voiture: ChoixVoiture; minute: number }[] = [];
    const api: ApiChoix = {
      async choisirVoiture(_id, voiture, minute): Promise<ApiResult<ReponseChoix>> {
        appels.push({ voiture, minute });
        if (o.indisponible) return { ok: false, status: 0, code: "network", message: "hors ligne" };
        if (o.inconnu) return { ok: false, status: 404, code: "unknown_player", message: "inconnu" };
        if ((o.refuse?.(voiture) ?? false) || (etat.minute !== null && etat.minute > minute)) return { ok: true, data: { enregistre: false, voiture: etat.voiture, minute: etat.minute } };
        etat.voiture = voiture;
        etat.minute = minute;
        return { ok: true, data: { enregistre: true, voiture, minute } };
      },
    };
    return { api, appels, etat };
  }
  /** Un appareil : son stockage, qui choisit au Garage (`choisirVoiture` + `noterChoixLocal`, comme `garage.ts`). */
  function appareil(debloquees: string[] = ["fourgon", "gt"]) {
    const s = new Memoire();
    noterDeblocages(debloquees, () => s);
    return {
      s,
      choisit(c: ChoixVoiture, quand: number) {
        expect(choisirVoiture(c, () => s)).toBe(true);
        noterChoixLocal(quand, s);
      },
      voiture: () => voitureChoisie(() => s),
    };
  }

  it("choisi sur un appareil, enregistré, relu sur un second appareil au même profil (la voiture y est, même sans l'avoir débloquée là)", async () => {
    const srv = serveur({ voiture: null, minute: null });
    const pc = appareil();
    pc.choisit(GT, T0);
    expect(choixEnAttente(pc.s)).toEqual({ voiture: GT, minute: minuteDe(T0) });
    expect(await envoyerChoix(srv.api, "id", pc.s)).toBe(false);
    expect(srv.etat).toEqual({ voiture: GT, minute: minuteDe(T0) });
    expect(choixEnAttente(pc.s), "envoyé : plus rien n'attend").toBeNull();
    // Le téléphone : jamais rien choisi, aucune voiture débloquée connue. Le profil lu rend le choix du serveur.
    const tel = appareil([]);
    expect(await synchroniserChoix({ voiture: srv.etat.voiture, minute: srv.etat.minute }, srv.api, "id", tel.s, T0)).toBe(true);
    expect(tel.voiture()).toEqual(GT);
    expect(voituresDebloquees(() => tel.s).has("gt"), "la voiture reçue est forcément débloquée").toBe(true);
    expect(srv.appels, "rien à envoyer en retour").toHaveLength(1);
    // Relu une seconde fois : rien ne change.
    expect(await synchroniserChoix({ voiture: GT, minute: minuteDe(T0) }, srv.api, "id", tel.s, T0)).toBe(false);
  });

  it("le dernier choix l'emporte, à la minute près : le plus récent est appliqué ici, ou envoyé là", async () => {
    const srv = serveur({ voiture: null, minute: null });
    const pc = appareil();
    const tel = appareil();
    pc.choisit(GT, T0);
    await envoyerChoix(srv.api, "id", pc.s);
    // Le téléphone choisit plus tard : il lit le serveur (plus ancien) et envoie son choix.
    tel.choisit(FOURGON, T0 + 5 * 60_000);
    expect(await synchroniserChoix({ voiture: srv.etat.voiture, minute: srv.etat.minute }, srv.api, "id", tel.s, T0 + 6 * 60_000)).toBe(false);
    expect(srv.etat).toEqual({ voiture: FOURGON, minute: minuteDe(T0) + 5 });
    expect(tel.voiture()).toEqual(FOURGON);
    // Le PC relit : le choix du téléphone est plus récent, il l'applique.
    expect(await synchroniserChoix({ voiture: srv.etat.voiture, minute: srv.etat.minute }, srv.api, "id", pc.s, T0 + 7 * 60_000)).toBe(true);
    expect(pc.voiture()).toEqual(FOURGON);
    // Un choix plus ancien que celui du serveur n'écrase rien : recalé sur le serveur.
    const vieux = appareil();
    vieux.choisit(GT, T0 - 60 * 60_000);
    expect(recaler({ voiture: FOURGON, minute: minuteDe(T0) + 5 }, vieux.s, T0)).toBe("change");
    expect(vieux.voiture()).toEqual(FOURGON);
  });

  it("deux choix dans la même minute : celui de cet appareil, pas encore parti, l'emporte sur la lecture du serveur ; un choix fait pendant l'envoi attend toujours", async () => {
    const srv = serveur({ voiture: GT, minute: minuteDe(T0) });
    const pc = appareil();
    pc.choisit(FOURGON, T0); // la même minute que le choix du serveur
    expect(recaler({ voiture: GT, minute: minuteDe(T0) }, pc.s, T0), "le choix local attend : il l'emporte").toBe("envoyer");
    expect(pc.voiture()).toEqual(FOURGON);
    expect(await synchroniserChoix({ voiture: GT, minute: minuteDe(T0) }, srv.api, "id", pc.s, T0)).toBe(false);
    expect(srv.etat.voiture).toEqual(FOURGON);
    expect(choixEnAttente(pc.s)).toBeNull();
    // Parti, puis relu : le serveur a le même choix, rien ne change ; un autre appareil qui lit la même minute le prend.
    expect(recaler({ voiture: FOURGON, minute: minuteDe(T0) }, pc.s, T0)).toBe("rien");
    const tel = appareil([]);
    expect(recaler({ voiture: FOURGON, minute: minuteDe(T0) }, tel.s, T0)).toBe("change");
    // Un choix fait pendant que le précédent partait reste en attente.
    const lent = serveur({ voiture: null, minute: null });
    const api: ApiChoix = {
      async choisirVoiture(id, v, m) {
        pc.choisit(GT, T0); // le joueur rechoisit pendant l'aller-retour
        return lent.api!.choisirVoiture!(id, v, m);
      },
    };
    pc.choisit(FOURGON, T0);
    await envoyerChoix(api, "id", pc.s);
    expect(choixEnAttente(pc.s), "le dernier choix (la GT) n'est pas parti").toEqual({ voiture: GT, minute: minuteDe(T0) });
  });

  it("hors connexion : le choix reste là et part à la reconnexion (jamais perdu) ; un joueur pas encore classé le garde chez lui", async () => {
    const srv = serveur({ voiture: null, minute: null }, { indisponible: true });
    const pc = appareil();
    pc.choisit(GT, T0);
    expect(await envoyerChoix(srv.api, "id", pc.s)).toBe(false);
    expect(choixEnAttente(pc.s), "toujours en attente").not.toBeNull();
    expect(pc.voiture(), "ici, il est déjà utilisé").toEqual(GT);
    const inconnu = serveur({ voiture: null, minute: null }, { inconnu: true });
    await envoyerChoix(inconnu.api, "id", pc.s);
    expect(choixEnAttente(pc.s), "404 : le joueur n'a pas encore été classé").not.toBeNull();
    // Le réseau revient (et le joueur est classé) : il part.
    const bon = serveur({ voiture: null, minute: null });
    await synchroniserChoix(null, bon.api, "id", pc.s, T0 + 60_000);
    expect(bon.etat.voiture).toEqual(GT);
    expect(choixEnAttente(pc.s)).toBeNull();
  });

  it("le serveur refuse une voiture qu'il ne croit pas débloquée : l'appareil reprend ce que le serveur garde (la Sparrow en orange sans rien)", async () => {
    const srv = serveur({ voiture: FOURGON, minute: minuteDe(T0) - 10 }, { refuse: (v) => v.id === "gt" });
    const pc = appareil(["gt", "fourgon"]); // l'appareil croyait la GT débloquée
    pc.choisit(GT, T0);
    expect(await envoyerChoix(srv.api, "id", pc.s)).toBe(true);
    expect(pc.voiture()).toEqual(FOURGON);
    expect(choixEnAttente(pc.s)).toBeNull();
    const vide = serveur({ voiture: null, minute: null }, { refuse: () => true });
    const autre = appareil(["gt"]);
    autre.choisit(GT, T0);
    expect(await envoyerChoix(vide.api, "id", autre.s)).toBe(true);
    expect(autre.voiture()).toEqual({ ...CHOIX_DEFAUT });
  });

  it("un choix d'avant le lot 51 (sans minute) : le serveur le reçoit à la première lecture s'il n'a rien, le serveur gagne s'il a un choix", async () => {
    const vieux = new Memoire();
    noterDeblocages(["gt"], () => vieux);
    vieux.setItem(CLE_GARAGE, JSON.stringify({ ...lu(vieux), id: "gt", couleur: 3, motif: "chevrons", teinteMotif: 2 }));
    const srv = serveur({ voiture: null, minute: null });
    expect(await synchroniserChoix(null, srv.api, "id", vieux, T0)).toBe(false);
    expect(srv.etat).toEqual({ voiture: GT, minute: minuteDe(T0) });
    const vieux2 = new Memoire();
    noterDeblocages(["gt"], () => vieux2);
    vieux2.setItem(CLE_GARAGE, JSON.stringify({ ...lu(vieux2), id: "gt", couleur: 0, motif: "course", teinteMotif: 0 }));
    expect(recaler({ voiture: FOURGON, minute: 12 }, vieux2, T0)).toBe("change");
    expect(voitureChoisie(() => vieux2)).toEqual(FOURGON);
    // Rien de choisi, rien du serveur : rien à faire (et rien d'envoyé).
    expect(recaler(null, new Memoire(), T0)).toBe("rien");
    expect(recaler(undefined, new Memoire(), T0)).toBe("rien");
  });

  it("le choix du serveur est lu avec méfiance : voiture inconnue, minute folle ou forme inattendue = pas de choix", () => {
    expect(choixDuServeur({ voiture: GT, minute: 5 })).toEqual({ voiture: GT, minute: 5 });
    for (const mauvais of [null, {}, { voiture: GT }, { voiture: GT, minute: -1 }, { voiture: GT, minute: 1.5 }, { voiture: { ...GT, id: "tank" }, minute: 1 }, { voiture: "gt", minute: 1 }]) expect(choixDuServeur(mauvais), JSON.stringify(mauvais)).toBeNull();
    const m = new Memoire();
    expect(recaler({ voiture: { ...GT, couleur: 99 }, minute: 5 }, m, T0)).toBe("rien");
    expect(m.getItem(CLE_GARAGE)).toBeNull();
  });
});

describe("la voiture qu'on voit, et celle d'un autre qu'on revoit", () => {
  const options = (etat: { choix: ChoixVoiture; libre: boolean; adoptees: number }): OptionsVoitureEnJeu => ({
    choix: () => etat.choix,
    numero: () => "8",
    palier: () => 1,
    nuit: () => false,
    peutChanger: () => etat.libre,
    adopter: () => void etat.adoptees++,
    materiaux2: () => Promise.resolve(MATERIAUX_2),
  });
  /** Fait tourner le jeu (une image à la fois) jusqu'à ce que `ok` soit vrai : le chargement d'un modèle est un `import()`. */
  const jusqua = async (g: VoitureEnJeu, ok: () => boolean) => {
    for (let i = 0; i < 400 && !ok(); i++) {
      g.tick();
      await new Promise((r) => setTimeout(r, 5));
    }
    g.tick();
    expect(ok()).toBe(true);
  };

  it("`affichee` : la voiture qu'on voit — la civile tant que la choisie n'est pas là, puis elle ; c'est elle qui part avec le temps", async () => {
    const etat = { choix: { ...GT }, libre: false, adoptees: 0 };
    const g = new VoitureEnJeu(options(etat));
    expect(g.affichee, "la civile, dans les couleurs choisies").toEqual({ ...GT, id: "civile" });
    for (let i = 0; i < 40; i++) {
      g.tick();
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(g.affichee.id, "en course, la voiture choisie est chargée mais pas posée").toBe("civile");
    etat.libre = true;
    await jusqua(g, () => g.affichee.id === "gt");
    expect(g.affichee).toEqual(GT);
  });

  it("revoir la course d'un autre : sa voiture, en version complète (modèle, couleur, motif, teinte), puis la tienne ; la Sparrow en orange sans voiture", async () => {
    const etat = { choix: { ...CHOIX_DEFAUT } as ChoixVoiture, libre: true, adoptees: 0 };
    const g = new VoitureEnJeu(options(etat));
    g.regarder(FOURGON);
    await jusqua(g, () => g.affichee.id === "fourgon");
    expect(g.affichee).toEqual(FOURGON);
    expect(etat.adoptees).toBe(1);
    g.regarder({ ...CHOIX_DEFAUT }); // une course d'avant : la Sparrow en orange
    await jusqua(g, () => g.affichee.id === "civile");
    expect(g.affichee).toEqual({ ...CHOIX_DEFAUT });
    g.regarder(null);
    g.tick();
    expect(g.affichee, "la tienne revient").toEqual({ ...CHOIX_DEFAUT });
    expect(g.choix, "rien n'a été enregistré").toEqual({ ...CHOIX_DEFAUT });
  });
});

describe("la voiture des fantômes du Salon (une place, un modèle, à la demande)", () => {
  beforeAll(() => {
    // Pas de navigateur : de quoi dessiner une étiquette (les canevas de test n'ont pas de contexte).
    (globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
  });
  const maillages = (o: Object3D): Mesh[] => {
    const out: Mesh[] = [];
    o.traverse((x) => {
      if ((x as Mesh).isMesh) out.push(x as Mesh);
    });
    return out;
  };
  const jour = daysFromCivil(2026, 10, 14);
  const circuit = dailyCircuit(jour);
  const run = runPilot(circuit.track, { grip: 0.8 });
  const entree = (n: number, voiture?: ChoixVoiture): GhostEntry => ({ key: `r${n}:${n}`, rank: n, name: `Joueur ${n}`, ms: 40_000 + n, replay: encodeReplay(run.replay), ...(voiture ? { voiture } : {}) });
  const attendre = async (f: () => boolean) => {
    for (let i = 0; i < 400 && !f(); i++) await new Promise((r) => setTimeout(r, 5));
    expect(f()).toBe(true);
  };
  const ids = (f: GhostField) => (f as unknown as { slots: { carId: string }[] }).slots.map((s) => s.carId);

  it("chaque fantôme prend le modèle de sa voiture ; la Sparrow en orange sans voiture ; six places, six maillages, comme avant", async () => {
    const f = new GhostField();
    expect(maillages(f.group), "six places : un maillage chacune").toHaveLength(6);
    // Cinq autres joueurs de cinq modèles différents (dont une course sans voiture), plus ton tour.
    f.setEntries([entree(1, { ...GT }), entree(2, { ...FOURGON }), entree(3), entree(4, { ...GT, id: "monoplace" }), entree(5, { ...GT, id: "muscle" }), { ...entree(6, { ...GT, id: "proto" }), rank: null, key: "mine:1" }]);
    f.restart(circuit.track);
    expect(f.stats.rejected).toBe(0);
    await attendre(() => f.stats.models === 5);
    expect(ids(f)).toEqual(["gt", "fourgon", "civile", "monoplace", "muscle", "proto"]);
    expect(maillages(f.group), "toujours six maillages : pas un appel de rendu de plus").toHaveLength(6);
    // Un autre tour : les places reprennent la civile si la voiture manque.
    f.setEntries([entree(1)]);
    f.restart(circuit.track);
    await attendre(() => ids(f)[0] === "civile");
    expect(maillages(f.group)).toHaveLength(6);
  });

  it("un modèle n'est chargé qu'une fois (le plan est gardé), quel que soit le nombre de fantômes qui l'ont", async () => {
    expect(planDe("evolution")).toBe(planDe("evolution"));
    expect(await planDe("inconnue"), "une voiture inconnue retombe sur la civile").toBe(await planDe("civile"));
  });
});

describe("le choix du Garage ne touche ni la rediffusion ni la simulation", () => {
  it("la voiture est une donnée à part : le format de la rediffusion n'a pas de champ de voiture ; lireChoix la valide comme le serveur", () => {
    expect(Object.keys(runPilot(dailyCircuit(daysFromCivil(2026, 10, 14)).track, { grip: 0.8 }).replay).sort()).not.toContain("voiture");
    expect(lireChoix({ ...GT })).toEqual(GT);
    for (const [id, couleur, motif, teinte] of [["tank", 0, "course", 0], ["gt", 8, "course", 0], ["gt", 0, "zèbre", 0]]as const) expect(lireChoix({ id, couleur, motif, teinteMotif: teinte })).toBeNull();
    // (la teinte du motif, facultative, retombe sur l'automatique côté jeu ; le serveur, lui, ne garde que les teintes qu'il connaît.)
  });
});
