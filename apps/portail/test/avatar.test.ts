import { describe, expect, it } from "vitest";
import { CADRAGE_INITIAL, ZOOM_MAX, carreDeRecadrage, deplacer, typeDeSortie, versBase64 } from "../src/avatarLogique";

// Lot C1, partie B — le recadrage de l'avatar (logique pure).
describe("carreDeRecadrage", () => {
  it("par défaut : le plus grand carré, au milieu (paysage et portrait)", () => {
    expect(carreDeRecadrage(400, 200, CADRAGE_INITIAL)).toEqual({ sx: 100, sy: 0, cote: 200 });
    expect(carreDeRecadrage(200, 400, CADRAGE_INITIAL)).toEqual({ sx: 0, sy: 100, cote: 200 });
    expect(carreDeRecadrage(300, 300, CADRAGE_INITIAL)).toEqual({ sx: 0, sy: 0, cote: 300 });
  });

  it("le zoom resserre (jusqu'à ×4) et le carré reste toujours dans l'image, même centre aberrant", () => {
    expect(carreDeRecadrage(400, 400, { zoom: 2, cx: 0.5, cy: 0.5 })).toEqual({ sx: 100, sy: 100, cote: 200 });
    expect(carreDeRecadrage(400, 400, { zoom: 99, cx: 0.5, cy: 0.5 }).cote).toBe(100);
    expect(carreDeRecadrage(400, 400, { zoom: 0.1, cx: 0.5, cy: 0.5 }).cote).toBe(400);
    for (const c of [{ zoom: 2, cx: -5, cy: 9 }, { zoom: 3, cx: NaN, cy: Infinity }, { zoom: NaN, cx: 0.5, cy: 0.5 }]) {
      const r = carreDeRecadrage(500, 300, c);
      expect(r.sx).toBeGreaterThanOrEqual(0);
      expect(r.sy).toBeGreaterThanOrEqual(0);
      expect(r.sx + r.cote).toBeLessThanOrEqual(500);
      expect(r.sy + r.cote).toBeLessThanOrEqual(300);
    }
    expect(ZOOM_MAX).toBe(4);
  });
});

describe("deplacer et sortie", () => {
  it("tirer l'image vers la droite fait aller le carré vers la gauche, et le carré ne sort pas de l'image", () => {
    const c = deplacer({ zoom: 2, cx: 0.5, cy: 0.5 }, 400, 400, 64, 0, 256);
    expect(c.cx).toBeLessThan(0.5);
    expect(c.cy).toBe(0.5);
    const loin = carreDeRecadrage(400, 400, deplacer({ zoom: 2, cx: 0.5, cy: 0.5 }, 400, 400, -100000, 100000, 256));
    expect(loin.sx + loin.cote).toBeLessThanOrEqual(400);
    expect(loin.sy).toBe(0);
  });

  it("le type de sortie : WebP ou JPEG, jamais un PNG ; la base64 se fait par morceaux", () => {
    expect(typeDeSortie("image/webp")).toBe("image/webp");
    expect(typeDeSortie("image/jpeg")).toBe("image/jpeg");
    expect(typeDeSortie("image/png")).toBeNull();
    expect(versBase64(Uint8Array.from([0, 1, 2]))).toBe("AAEC");
    expect(atob(versBase64(new Uint8Array(20_000).fill(65))).length).toBe(20_000);
  });
});

// --- L'assainissement avant l'envoi (le serveur refuse tout ce qui n'est pas une image nue) ----------------------------------------------------------------
// Un WebP réel, tel que Chromium l'encode : un conteneur étendu `VP8X` avec un profil de couleur `ICCP`.
const WEBP_CHROMIUM = "UklGRkYCAABXRUJQVlA4WAoAAAAgAAAAPwAAPwAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDggWAAAALAEAJ0BKkAAQAA+yVChS6ekoyGx6ADwGQlAGlUgBq2PAAElcyqn8LDisp8DAAAA/uzjL/kGLGqGtEuXrJ0gGF8kpn+N4pWkuvWV6Id4Kv0H9Mc2ugIAAAA=";
describe("assainirImage", () => {
  it("retire le profil de couleur d'un WebP de Chromium : le serveur accepte le résultat, refusait l'original", async () => {
    const { assainirImage } = await import("../src/avatarLogique");
    const { controlerImage, ImageRefusee, octetsDeBase64 } = await import("../../api/src/imagesAvatar");
    const brut = octetsDeBase64(WEBP_CHROMIUM);
    expect(() => controlerImage(brut)).toThrow(ImageRefusee);
    const propre = assainirImage(brut, "image/webp")!;
    expect(propre.length).toBeLessThan(brut.length);
    expect(controlerImage(propre)).toMatchObject({ mime: "image/webp", largeur: 64, hauteur: 64 });
  });
  it("retire l'EXIF, le profil et les commentaires d'un JPEG, garde le reste ; refuse une image tronquée, animée ou à transparence", async () => {
    const { assainirImage } = await import("../src/avatarLogique");
    const seg = (m: number, n: number) => [0xff, m, 0, n + 2, ...Array(n).fill(1)];
    const jpeg = Uint8Array.from([0xff, 0xd8, ...seg(0xe0, 14), ...seg(0xe1, 20), ...seg(0xe2, 10), ...seg(0xfe, 6), ...seg(0xdb, 65), 0xff, 0xda, 0, 4, 1, 2, 9, 9, 0xff, 0xd9]);
    const propre = assainirImage(jpeg, "image/jpeg")!;
    const marqueurs = [...propre].flatMap((o, i) => (o === 0xff && [0xe0, 0xe1, 0xe2, 0xfe, 0xdb, 0xda].includes(propre[i + 1]!) ? [propre[i + 1]!] : []));
    expect(marqueurs).toEqual([0xe0, 0xdb, 0xda]);
    expect(assainirImage(jpeg.subarray(0, 30), "image/jpeg")).toBeNull();
    expect(assainirImage(Uint8Array.from([1, 2, 3]), "image/webp")).toBeNull();
    const enc = (t: string, n: number) => [...[...t].map((c) => c.charCodeAt(0)), n, 0, 0, 0, ...Array(n).fill(0)];
    const riff = (...c: number[][]) => { const corps = [0x57, 0x45, 0x42, 0x50, ...c.flat()]; return Uint8Array.from([0x52, 0x49, 0x46, 0x46, corps.length, 0, 0, 0, ...corps]); };
    expect(assainirImage(riff(enc("ANIM", 6), enc("VP8 ", 10)), "image/webp")).toBeNull();
    expect(assainirImage(riff(enc("ALPH", 4), enc("VP8 ", 10)), "image/webp")).toBeNull();
  });
});
