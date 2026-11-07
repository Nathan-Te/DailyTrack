import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { IMAGE_COTE_MAX, IMAGE_OCTETS_MAX, controlerImage, octetsDeBase64, ImageRefusee } from "../src/imagesAvatar";
import { refOfPlayer } from "../src/players";
import { nameKey } from "../src/pseudos";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY } from "./adminHelpers";
import { makeApi, parisDayStart, playerId, TEST_DB, type TestApi } from "./helpers";

// Lot C1, partie B — les avatars : les formats acceptés et refusés (EXIF, XMP, ICC, SVG, GIF, PNG, taille, dimensions, WebP étendu ou animé), l'envoi (un par jour), l'image servie en adresse immuable, le signalement
// et le masquage à 3, l'administration, l'effacement. Les images de test sont fabriquées octet par octet (aucun fichier). SQLite et libSQL (`file:`).

// --- Fabrication d'images ------------------------------------------------------------------------------------------------------
const le32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
function riff(chunks: number[][]): Uint8Array {
  const corps = [...ascii("WEBP"), ...chunks.flat()];
  return Uint8Array.from([...ascii("RIFF"), ...le32(corps.length), ...corps]);
}
const chunk = (type: string, data: number[]) => [...ascii(type), ...le32(data.length), ...data, ...(data.length % 2 ? [0] : [])];
/** Un VP8 (image avec perte) de `c` × `c` : la balise d'image, le code de départ 9d 01 2a, les dimensions, quelques octets de remplissage. */
function webpLossy(c: number, extra: number[][] = []): Uint8Array {
  const donnees = [0x10, 0x00, 0x00, 0x9d, 0x01, 0x2a, c & 255, (c >> 8) & 63, c & 255, (c >> 8) & 63, ...Array(40).fill(7)];
  return riff([chunk("VP8 ", donnees), ...extra]);
}
function webpLossless(c: number): Uint8Array {
  const bits = ((c - 1) & 0x3fff) | (((c - 1) & 0x3fff) << 14);
  return riff([chunk("VP8L", [0x2f, ...le32(bits), ...Array(30).fill(3)])]);
}
function jpeg(c: number, segments: number[][] = [], sof = 0xc0): Uint8Array {
  const app0 = [0xff, 0xe0, 0, 16, ...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const dqt = [0xff, 0xdb, 0, 67, 0, ...Array(64).fill(8)];
  const sofM = [0xff, sof, 0, 17, 8, c >> 8, c & 255, c >> 8, c & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  const sos = [0xff, 0xda, 0, 12, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 63, 0];
  const donnees = [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0x78];
  return Uint8Array.from([0xff, 0xd8, ...app0, ...segments.flat(), ...dqt, ...sofM, ...sos, ...donnees, 0xff, 0xd9]);
}
const b64 = (o: Uint8Array) => btoa(String.fromCharCode(...o));
const refus = (o: Uint8Array) => {
  try {
    controlerImage(o);
    return null;
  } catch (e) {
    return e instanceof ImageRefusee ? e.raison : "autre";
  }
};

describe("controlerImage : ce que le serveur accepte et refuse", () => {
  it("accepte du WebP avec perte, sans perte, et du JPEG (de 16 à 256, carrés)", () => {
    expect(controlerImage(webpLossy(128))).toEqual({ mime: "image/webp", largeur: 128, hauteur: 128 });
    expect(controlerImage(webpLossy(64)).largeur).toBe(64);
    expect(controlerImage(webpLossless(96))).toEqual({ mime: "image/webp", largeur: 96, hauteur: 96 });
    expect(controlerImage(jpeg(128))).toEqual({ mime: "image/jpeg", largeur: 128, hauteur: 128 });
    expect(controlerImage(jpeg(100, [], 0xc2)).largeur).toBe(100); // progressif
  });

  it("refuse les métadonnées : EXIF, XMP, ICC (JPEG et WebP), tout autre segment, un WebP étendu", () => {
    const exif = [0xff, 0xe1, 0, 8, ...ascii("Exif"), 0, 0];
    const icc = [0xff, 0xe2, 0, 6, ...ascii("ICC_"), 0];
    const commentaire = [0xff, 0xfe, 0, 4, 65, 66];
    const app13 = [0xff, 0xed, 0, 4, 65, 66];
    for (const s of [exif, icc, commentaire, app13]) expect(refus(jpeg(128, [s]))).toBe("metadonnees");
    expect(refus(webpLossy(128, [chunk("EXIF", [1, 2, 3, 4])]))).toBe("metadonnees");
    expect(refus(webpLossy(128, [chunk("XMP ", [1, 2])]))).toBe("metadonnees");
    expect(refus(riff([chunk("VP8X", [0, 0, 0, 0, 127, 0, 0, 127, 0, 0]), chunk("VP8 ", Array(30).fill(0))]))).toBe("metadonnees");
    expect(refus(riff([chunk("ICCP", [1, 2, 3, 4]), chunk("VP8 ", Array(30).fill(0))]))).toBe("metadonnees");
  });

  it("refuse les autres formats : SVG, PNG, GIF, texte, vide, WebP tronqué ou avec des octets en trop", () => {
    expect(refus(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBe("format");
    expect(refus(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(40).fill(0)]))).toBe("format");
    expect(refus(Uint8Array.from([...ascii("GIF89a"), ...Array(40).fill(0)]))).toBe("format");
    expect(refus(new Uint8Array(0))).toBe("taille");
    expect(refus(webpLossy(128).subarray(0, 30))).toBe("format");
    expect(refus(Uint8Array.from([...webpLossy(128), 0, 0, 0, 0]))).toBe("format"); // la taille annoncée n'est pas la taille reçue
    expect(refus(jpeg(128).subarray(0, 60))).toBe("format"); // sans fin d'image
    expect(refus(Uint8Array.from([...jpeg(128), 0]))).toBe("format"); // des octets après la fin
    expect(refus(jpeg(128, [], 0xc3))).toBe("format"); // sans perte
  });

  it("lot U4 : 256 × 256 et 40 Ko ; une image déjà envoyée en 128 × 128 reste valide", () => {
    expect([IMAGE_COTE_MAX, IMAGE_OCTETS_MAX]).toEqual([256, 40 * 1024]);
    expect(controlerImage(webpLossy(256))).toEqual({ mime: "image/webp", largeur: 256, hauteur: 256 });
    expect(controlerImage(webpLossless(256))).toEqual({ mime: "image/webp", largeur: 256, hauteur: 256 });
    expect(controlerImage(jpeg(256))).toEqual({ mime: "image/jpeg", largeur: 256, hauteur: 256 });
    expect(controlerImage(webpLossy(128)).largeur).toBe(128);
    expect(controlerImage(jpeg(128)).largeur).toBe(128);
    // Pile 40 Ko (en-têtes compris) : accepté ; deux octets de plus : refusé.
    const pleine = (total: number) => riff([chunk("VP8 ", [0x10, 0, 0, 0x9d, 1, 0x2a, 0, 1, 0, 1, ...Array(total - 20 - 10).fill(1)])]);
    expect(pleine(IMAGE_OCTETS_MAX).length).toBe(IMAGE_OCTETS_MAX);
    expect(controlerImage(pleine(IMAGE_OCTETS_MAX)).largeur).toBe(256);
    expect(refus(pleine(IMAGE_OCTETS_MAX + 2))).toBe("taille");
  });

  it("refuse la taille (40 Ko) et les dimensions (carrée, de 16 à 256)", () => {
    expect(refus(riff([chunk("VP8 ", [0x10, 0, 0, 0x9d, 1, 0x2a, 128, 0, 128, 0, ...Array(IMAGE_OCTETS_MAX).fill(1)])]))).toBe("taille");
    expect(refus(webpLossy(257))).toBe("dimensions");
    expect(refus(webpLossy(300))).toBe("dimensions");
    expect(refus(webpLossy(8))).toBe("dimensions");
    expect(refus(jpeg(512))).toBe("dimensions");
    const rect = webpLossy(128);
    rect[26] = 64; // largeur 64, hauteur 128
    expect(refus(rect)).toBe("dimensions");
  });

  it("octetsDeBase64 : seulement de la base64 de bonne longueur", () => {
    expect(octetsDeBase64("AAEC")).toEqual(Uint8Array.from([0, 1, 2]));
    for (const mauvais of ["", "AAE", "AA EC", "data:image/webp;base64,AAEC", 5, null, "A".repeat(60_000)]) expect(octetsDeBase64(mauvais)).toBeNull();
  });
});

// --- Le serveur ---------------------------------------------------------------------------------------------------------------
const TODAY = daysFromCivil(2026, 10, 20);
const MIDI = parisDayStart(TODAY) + 12 * 3_600_000;
const ORIGIN = "http://api.test";
const OPTIONS_ADMIN = { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fakeVerifier: true, releaseTag: "prod-2026-10-19-1830" };
let adresse = 0;
const ip = () => `198.52.${(adresse >> 8) & 255}.${adresse++ & 255}`;
const vu = (n: number | null): Record<string, string> => (n === null ? {} : { "X-Player-Id": playerId(n) });
const get = (t: TestApi, n: number | null, path: string) => t.call("GET", path, undefined, { headers: vu(n), clientKey: ip() });
const post = (t: TestApi, n: number | null, path: string, body: unknown = {}) => t.call("POST", path, body, { headers: vu(n), clientKey: ip() });
const envoi = (t: TestApi, n: number, image: Uint8Array = webpLossy(128)) => post(t, n, "/api/avatar", { image: b64(image) });

async function api(): Promise<TestApi> {
  const t = await makeApi({ seed: false, admin: OPTIONS_ADMIN });
  t.clock.now = MIDI;
  await t.call("GET", "/api/health");
  return t;
}
async function joueur(t: TestApi, n: number, nom: string): Promise<void> {
  const id = playerId(n);
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref) VALUES (?, ?, 0, 0, ?, ?)", [id, nom, nameKey(nom), await refOfPlayer(id)]);
}
async function connecte(t: TestApi) {
  const r = await t.call("POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGIN, "X-Cdj-Admin": "1" } });
  const cookie = /__session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![1]!;
  const headers = { Cookie: `__session=${cookie}`, Origin: ORIGIN, "X-Cdj-Admin": "1" };
  return (method: string, path: string, body?: unknown) => t.call(method, path, body, { headers });
}
/** Le statut de l'adresse d'une image (`t.call` lit du JSON : une image est lue sans lui). */
const statutImage = async (t: TestApi, hash: string) => (await t.api.handle(new Request(`${ORIGIN}/api/avatars/${hash}`), { clientKey: ip() })).status;
const lireAvatar = async (t: TestApi, n: number) => (await t.db.first<{ avatar: string | null }>("SELECT avatar FROM players WHERE id = ?", [playerId(n)]))!.avatar;

describe(`avatars : l'envoi et l'image servie (${TEST_DB})`, () => {
  it("envoyer une image : l'empreinte va sur le joueur ; l'image est servie en octets, adresse immuable, cache long ; les classements la portent", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    const r = await envoi(t, 1);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.avatar).toMatch(/^[0-9a-f]{16}$/);
    expect(await lireAvatar(t, 1)).toBe(r.body.avatar);
    const image = await t.api.handle(new Request(`${ORIGIN}/api/avatars/${r.body.avatar}`), { clientKey: ip() });
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/webp");
    expect(image.headers.get("cache-control")).toContain("immutable");
    expect(image.headers.get("cache-control")).toContain("max-age=31536000");
    expect(image.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(webpLossy(128));
    // L'identifiant secret n'est nulle part ; l'adresse ne dépend que de l'image.
    expect(JSON.stringify(r.body)).not.toContain(playerId(1));
    expect((await get(t, null, "/api/avatars/0000000000000000")).body.error).toBe("unknown_avatar");
    expect((await get(t, null, "/api/avatars/pasunhash")).body.error).toBe("unknown_avatar");
    expect((await t.call("GET", "/api/portail/jour", undefined, { headers: vu(1), clientKey: ip() })).body.joueur.avatar).toBe(r.body.avatar);
  });

  it("refuse ce qui n'est pas une image valide, avec sa raison ; rien n'est rangé", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    const exif = [0xff, 0xe1, 0, 8, ...ascii("Exif"), 0, 0];
    for (const [image, raison] of [
      [jpeg(128, [exif]), "metadonnees"],
      [webpLossy(257), "dimensions"],
      [new TextEncoder().encode("<svg/>"), "format"],
    ] as const) {
      const r = await envoi(t, 1, image);
      expect([r.status, r.body.error, r.body.raison]).toEqual([400, "invalid_image", raison]);
    }
    for (const mauvais of [undefined, "", "pas de la base64", 12]) {
      const r = await post(t, 1, "/api/avatar", { image: mauvais });
      expect([r.status, r.body.error, r.body.raison]).toEqual([400, "invalid_image", "format"]);
    }
    expect(await lireAvatar(t, 1)).toBeNull();
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM avatars"))!.n).toBe(0);
  });

  it("un seul changement par jour (le lendemain, c'est reparti), retirer la sienne rend les initiales, un joueur inconnu du serveur est refusé", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    const a = (await envoi(t, 1)).body.avatar;
    const encore = await envoi(t, 1, webpLossless(100));
    expect([encore.status, encore.body.error]).toEqual([429, "avatar_limit"]);
    expect(Number(encore.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await lireAvatar(t, 1)).toBe(a);
    t.clock.now = parisDayStart(TODAY + 1) + 3_600_000;
    const b = (await envoi(t, 1, webpLossless(100))).body.avatar;
    expect(b).not.toBe(a);
    expect(await lireAvatar(t, 1)).toBe(b);
    expect(await statutImage(t, a)).toBe(404); // l'ancienne image n'est plus servie
    expect((await t.call("DELETE", "/api/avatar", undefined, { headers: vu(1), clientKey: ip() })).body).toEqual({ avatar: null });
    expect(await lireAvatar(t, 1)).toBeNull();
    expect((await envoi(t, 9)).body.error).toBe("unknown_player");
    expect((await post(t, null, "/api/avatar", { image: b64(webpLossy(128)) })).body.error).toBe("invalid_player");
  });
});

describe(`avatars : signalement et modération (${TEST_DB})`, () => {
  it("un signalement par signalant et par image ; à 3 signalants distincts l'image est masquée (initiales) ; on ne se signale pas soi-même", async () => {
    const t = await api();
    for (const [n, nom] of [[1, "Alice"], [2, "Bob"], [3, "Chloé"], [4, "Dan"], [5, "Eve"]] as const) await joueur(t, n, nom);
    const hash = (await envoi(t, 1)).body.avatar as string;
    const ref = await refOfPlayer(playerId(1));
    expect((await post(t, 1, "/api/avatar/signaler", { ref })).body.error).toBe("invalid_report");
    expect((await post(t, 2, "/api/avatar/signaler", { ref: "pas une ref" })).body.error).toBe("invalid_report");
    expect((await post(t, 2, "/api/avatar/signaler", { ref: "0".repeat(12) })).body.error).toBe("unknown_avatar");
    for (const n of [2, 2, 3]) expect((await post(t, n, "/api/avatar/signaler", { ref })).body).toEqual({ ok: true }); // Bob deux fois = un seul signalement
    expect(await lireAvatar(t, 1)).toBe(hash);
    expect(await statutImage(t, hash)).toBe(200);
    expect((await post(t, 4, "/api/avatar/signaler", { ref })).body).toEqual({ ok: true });
    expect(await lireAvatar(t, 1)).toBeNull(); // masquée
    expect((await get(t, null, `/api/avatars/${hash}`)).body.error).toBe("unknown_avatar");
    expect((await t.db.first<{ statut: string }>("SELECT statut FROM avatars WHERE owner = ?", [playerId(1)]))!.statut).toBe("masque");
    expect((await post(t, 5, "/api/avatar/signaler", { ref })).body.error).toBe("unknown_avatar"); // plus d'image visible à signaler
  });

  it("l'administration : les signalées d'abord, puis les nouvelles ; garder, retirer, interdire, autoriser ; tout est au journal, avec les en-têtes et la confirmation", async () => {
    const t = await api();
    for (const [n, nom] of [[1, "Alice"], [2, "Bob"], [3, "Chloé"], [4, "Dan"], [5, "Eve"]] as const) await joueur(t, n, nom);
    await envoi(t, 1);
    await envoi(t, 5, webpLossless(64));
    const refA = await refOfPlayer(playerId(1));
    const refE = await refOfPlayer(playerId(5));
    for (const n of [2, 3, 4]) await post(t, n, "/api/avatar/signaler", { ref: refA });
    expect((await t.call("GET", "/api/admin/images")).status).toBe(401);
    const adm = await connecte(t);
    const liste = (await adm("GET", "/api/admin/images")).body;
    expect(liste.signalees.map((x: { ref: string; statut: string; signalements: number }) => [x.ref, x.statut, x.signalements])).toEqual([[refA, "masque", 3]]);
    expect(liste.nouvelles.map((x: { ref: string }) => x.ref)).toEqual([refE]);
    expect(JSON.stringify(liste)).not.toContain(playerId(1));
    // Les octets : même masquée, l'administration la voit (pour décider).
    const octets = await t.api.handle(new Request(`${ORIGIN}/api/admin/images/joueur/${refA}`, { headers: { Cookie: `__session=${/__session=([^;]+)/.exec((await t.call("POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGIN, "X-Cdj-Admin": "1" } })).headers.get("set-cookie") ?? "")![1]}`, "X-Cdj-Admin": "1" } }), { clientKey: ip() });
    expect(octets.status).toBe(200);
    expect(octets.headers.get("content-type")).toBe("image/webp");
    expect((await adm("POST", `/api/admin/images/joueur/${refA}/garder`, {})).status).toBe(400); // confirmation exigée
    expect((await adm("POST", `/api/admin/images/joueur/${refA}/garder`, { confirmer: true })).body).toEqual({ statut: "visible" });
    expect(await lireAvatar(t, 1)).not.toBeNull(); // gardée : visible de nouveau
    expect((await adm("POST", `/api/admin/images/joueur/${refA}/retirer`, { confirmer: true })).body).toEqual({ statut: "retire" });
    expect(await lireAvatar(t, 1)).toBeNull();
    expect((await t.db.first<{ data: string }>("SELECT data FROM avatars WHERE owner = ?", [playerId(1)]))!.data).toBe(""); // les octets sont effacés
    expect((await adm("POST", `/api/admin/images/joueur/${refE}/interdire`, { confirmer: true })).body).toEqual({ interdit: true });
    expect((await adm("POST", `/api/admin/images/joueur/${refE}/interdire`, { confirmer: true })).status).toBe(400);
    t.clock.now = parisDayStart(TODAY + 1) + 3_600_000;
    expect((await envoi(t, 5)).body.error).toBe("avatar_banned");
    const adm2 = await connecte(t); // la session d'une heure est finie
    expect((await adm2("POST", `/api/admin/images/joueur/${refE}/autoriser`, { confirmer: true })).body).toEqual({ interdit: false });
    expect((await envoi(t, 5)).status).toBe(200);
    expect((await adm2("GET", "/api/admin/images/joueur/000000000000")).body.error).toBe("unknown_avatar");
    const journal = (await adm2("GET", "/api/admin/journal")).body.lignes as { action: string; cible: string }[];
    expect(journal.map((l) => l.action)).toEqual(expect.arrayContaining(["garder une image", "retirer une image", "interdire l'envoi d'images", "lever l'interdiction d'images"]));
    expect(JSON.stringify(journal)).not.toContain(playerId(1));
  });

  it("effacer un profil emporte son avatar, ses signalements (faits et reçus) et son interdiction ; « Changer mon code » les suit", async () => {
    const t = await api();
    for (const [n, nom] of [[1, "Alice"], [2, "Bob"]] as const) await joueur(t, n, nom);
    await envoi(t, 1);
    await envoi(t, 2);
    await post(t, 2, "/api/avatar/signaler", { ref: await refOfPlayer(playerId(1)) });
    await t.db.run("INSERT INTO avatar_interdits (kind, owner, cree_le) VALUES ('joueur', ?, 0)", [playerId(1)]);
    const neuf = playerId(77);
    t.clock.now += 3_600_000;
    expect((await t.call("POST", "/api/me/code", { newId: neuf }, { headers: vu(1), clientKey: ip() })).status).toBe(200);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM avatars WHERE owner = ?", [neuf]))!.n).toBe(1);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM avatar_signalements WHERE owner = ?", [neuf]))!.n).toBe(1);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM avatar_interdits WHERE owner = ?", [neuf]))!.n).toBe(1);
    const adm = await connecte(t);
    const r = await adm("POST", `/api/admin/joueurs/${await refOfPlayer(playerId(2))}/supprimer`, { confirmer: true, pseudo: "Bob" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM avatars WHERE owner = ?", [playerId(2)]))!.n).toBe(0);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM avatar_signalements"))!.n).toBe(0); // celui que Bob avait fait part avec lui
  });
});
