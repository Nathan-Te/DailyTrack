import { describe, expect, it } from "vitest";
import { INVITATION_KEY, NAME_KEY, PLAYER_KEY, type ApiResult, type Ami } from "@cdj/profile";
import { accepterEtEcrire, etatDeLInvitation, ouvrirInvitation, oublieLInvitation, pseudoAEcrire, type AcceptationDeps } from "../src/amisDonnees";

// Lot F2 : la logique de la page « Mes amis » — l'ouverture d'un lien d'invitation (le jeton rangé puis retiré de l'adresse), l'état d'une invitation, l'acceptation sans profil (l'identité locale n'est
// écrite qu'une fois l'amitié faite). Le stockage est un faux, le serveur aussi.
class Stockage {
  private donnees = new Map<string, string>();
  get length() {
    return this.donnees.size;
  }
  key(i: number) {
    return [...this.donnees.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.donnees.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.donnees.set(k, v);
  }
  removeItem(k: string) {
    this.donnees.delete(k);
  }
}
const TOKEN = "Zm9vYmFyYmF6cXV4MTIzNDU2";
const ID = "cd".repeat(16);
const ami: Ami = { ref: "aaaaaaaaaaa1", pseudo: "Nathan", reciproque: true, origine: "invitation" };
const ok: ApiResult<{ ami: Ami; total: number }> = { ok: true, data: { ami, total: 1 } };
const ko = (code: string): ApiResult<{ ami: Ami; total: number }> => ({ ok: false, code, message: code, status: 409 });

describe("l'ouverture d'un lien d'invitation", () => {
  const ouvrir = (href: string, session = new Stockage()) => {
    const adresses: string[] = [];
    const r = ouvrirInvitation({ href, session: session as unknown as Storage, remplacer: (a) => adresses.push(a) });
    return { ...r, adresses, session };
  };

  it("le jeton est rangé dans l'onglet et retiré de l'adresse tout de suite (une adresse finit dans les journaux)", () => {
    const o = ouvrir(`https://playdujour.com/amis/?invitation=${TOKEN}`);
    expect(o.jeton).toBe(TOKEN);
    expect(o.initial).toEqual({ etat: "lecture", jeton: TOKEN });
    expect(o.adresses).toEqual(["/amis/"]); // plus de ?invitation=
    expect(o.session.getItem(INVITATION_KEY)).toBe(TOKEN);
    expect(o.adresses.join()).not.toContain(TOKEN);
  });

  it("les autres paramètres de l'adresse restent", () => {
    expect(ouvrir(`https://playdujour.com/amis/?lang=en&invitation=${TOKEN}#haut`).adresses).toEqual(["/amis/?lang=en#haut"]);
  });

  it("un lien illisible est refusé d'emblée : l'adresse est nettoyée, rien n'est gardé, même si un autre jeton attendait dans l'onglet", () => {
    const session = new Stockage();
    session.setItem(INVITATION_KEY, TOKEN);
    const o = ouvrir("https://playdujour.com/amis/?invitation=<script>", session);
    expect(o.jeton).toBeNull();
    expect(o.initial).toEqual({ etat: "invalide", code: "invalid_invitation" });
    expect(o.adresses).toHaveLength(1);
  });

  it("sans paramètre : le jeton déjà rangé dans cet onglet sert encore (on a rechargé la page) ; sinon rien", () => {
    const session = new Stockage();
    expect(ouvrir("https://playdujour.com/amis/", session)).toMatchObject({ jeton: null, initial: null, adresses: [] });
    session.setItem(INVITATION_KEY, TOKEN);
    expect(ouvrir("https://playdujour.com/amis/", session)).toMatchObject({ jeton: TOKEN, initial: { etat: "lecture", jeton: TOKEN }, adresses: [] });
  });
});

describe("l'état d'une invitation", () => {
  it("un lien inconnu ou renouvelé est définitif ; le réseau, le débit ou un délai se réessaient", () => {
    expect(etatDeLInvitation("invalid_invitation")).toEqual({ etat: "invalide", code: "invalid_invitation" });
    for (const code of ["network", "timeout", "rate_limited"]) expect(etatDeLInvitation(code)).toEqual({ etat: "erreur", code });
  });

  it("le jeton de l'onglet est oublié pour un refus qui ne changera pas (lien inconnu, déjà amis, son propre lien), pas pour les autres", () => {
    for (const code of ["invalid_invitation", "friend_exists", "friend_self"]) expect(oublieLInvitation(code), code).toBe(true);
    for (const code of ["name_taken", "friends_full", "their_friends_full", "network"]) expect(oublieLInvitation(code), code).toBe(false);
  });

  it("le pseudo écrit sur l'appareil est celui qu'on a choisi, nettoyé comme par le serveur ; rien quand on n'en a pas demandé ou s'il est illisible", () => {
    expect(pseudoAEcrire("  Kiwi   Vert ")).toBe("Kiwi Vert");
    expect(pseudoAEcrire(undefined)).toBeNull();
    expect(pseudoAEcrire("")).toBeNull();
    expect(pseudoAEcrire("<b>")).toBeNull();
  });
});

describe("accepter une invitation", () => {
  function monter(o: { identifiant?: string | null; reponse?: ApiResult<{ ami: Ami; total: number }> } = {}) {
    const stockage = new Stockage();
    const session = new Stockage();
    session.setItem(INVITATION_KEY, TOKEN);
    let id: string | null = o.identifiant === undefined ? null : o.identifiant;
    if (id) stockage.setItem(PLAYER_KEY, id);
    const appels: { jeton: string; pseudo?: string; identifiantPendantAppel: string | null }[] = [];
    const deps: AcceptationDeps = {
      accepter: async (jeton, pseudo) => {
        appels.push({ jeton, pseudo, identifiantPendantAppel: id });
        return o.reponse ?? ok;
      },
      identifiant: () => id,
      fixer: (x) => (id = x),
      stockage: stockage as never,
      session: session as never,
      nouvelIdentifiant: () => ID,
    };
    return { deps, stockage, session, appels, identifiant: () => id };
  }

  it("sans profil : l'identifiant tiré sert à l'appel, le serveur crée le profil avec le pseudo, puis l'identité locale est écrite et le jeton oublié", async () => {
    const m = monter();
    const r = await accepterEtEcrire(m.deps, TOKEN, "Kiwi");
    expect(r.ok).toBe(true);
    expect(m.appels).toEqual([{ jeton: TOKEN, pseudo: "Kiwi", identifiantPendantAppel: ID }]);
    expect(m.stockage.getItem(PLAYER_KEY)).toBe(ID);
    expect(m.stockage.getItem(NAME_KEY)).toBe("Kiwi");
    expect(m.session.getItem(INVITATION_KEY)).toBeNull();
    expect(m.identifiant()).toBe(ID);
  });

  it("un pseudo déjà pris : rien n'est écrit, aucun identifiant ne reste, le jeton reste pour un nouvel essai", async () => {
    const m = monter({ reponse: ko("name_taken") });
    const r = await accepterEtEcrire(m.deps, TOKEN, "Kiwi");
    expect(r).toMatchObject({ ok: false, code: "name_taken" });
    expect(m.stockage.length).toBe(0);
    expect(m.identifiant()).toBeNull();
    expect(m.session.getItem(INVITATION_KEY)).toBe(TOKEN);
  });

  it("un lien révoqué, ou « vous êtes déjà amis » : le jeton de l'onglet est oublié, l'identité ne change pas", async () => {
    for (const code of ["invalid_invitation", "friend_exists"]) {
      const m = monter({ reponse: ko(code) });
      await accepterEtEcrire(m.deps, TOKEN, "Kiwi");
      expect(m.session.getItem(INVITATION_KEY), code).toBeNull();
      expect(m.stockage.length, code).toBe(0);
    }
  });

  it("une liste pleine (la tienne ou la sienne) ne crée rien : ni profil local, ni oubli du jeton", async () => {
    for (const code of ["friends_full", "their_friends_full"]) {
      const m = monter({ reponse: ko(code) });
      await accepterEtEcrire(m.deps, TOKEN, "Kiwi");
      expect(m.stockage.length, code).toBe(0);
      expect(m.session.getItem(INVITATION_KEY), code).toBe(TOKEN);
    }
  });

  it("avec un profil connu du serveur : l'identifiant ne change pas, aucun pseudo n'est écrit", async () => {
    const m = monter({ identifiant: ID });
    await accepterEtEcrire(m.deps, TOKEN);
    expect(m.appels).toEqual([{ jeton: TOKEN, pseudo: undefined, identifiantPendantAppel: ID }]);
    expect(m.stockage.getItem(PLAYER_KEY)).toBe(ID);
    expect(m.stockage.getItem(NAME_KEY)).toBeNull();
  });

  it("un identifiant local que le serveur ne connaissait pas : le pseudo choisi est écrit, l'identifiant garde sa valeur", async () => {
    const m = monter({ identifiant: ID });
    await accepterEtEcrire(m.deps, TOKEN, "Kiwi");
    expect(m.stockage.getItem(PLAYER_KEY)).toBe(ID);
    expect(m.stockage.getItem(NAME_KEY)).toBe("Kiwi");
  });

  it("un stockage qui refuse d'écrire n'empêche pas l'amitié", async () => {
    const m = monter();
    m.deps.stockage = { length: 0, key: () => null, getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => undefined } as never;
    expect((await accepterEtEcrire(m.deps, TOKEN, "Kiwi")).ok).toBe(true);
    expect(m.identifiant()).toBe(ID); // l'identité vit en mémoire le temps de la page
  });
});
