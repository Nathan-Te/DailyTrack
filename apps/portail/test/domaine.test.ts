import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { ADRESSES, allowedOrigins, assertPreviewSite, previewChannel, storageIsolatedFromProduction } from "../../../scripts/domaine.mjs";

// Lot R4 : les adresses de la plateforme, les origines permises par le serveur, et la séparation du stockage par origine.

describe("origines permises (ALLOWED_ORIGINS)", () => {
  it("production : playdujour.com seulement (lot R5 : l'ancienne origine GitHub Pages n'est plus permise)", () => {
    expect(allowedOrigins("production")).toEqual(["https://playdujour.com"]);
    expect(allowedOrigins("recette")).toEqual(["https://recette.playdujour.com"]);
    for (const cible of ["production", "recette"]) expect(allowedOrigins(cible).join(";")).not.toContain("github.io");
  });

  it("recette : recette.playdujour.com et l'origine du canal d'aperçu d'une PR", () => {
    expect(allowedOrigins("recette", { enPlus: ["https://cdj-recette--pr-12-a1b2c3.web.app/;http://localhost:5173"] })).toEqual([
      "https://recette.playdujour.com",
      "https://cdj-recette--pr-12-a1b2c3.web.app",
      "http://localhost:5173",
    ]);
  });

  it("la production refuse la recette et tout aperçu Firebase ; une origine avec un chemin est refusée", () => {
    expect(() => allowedOrigins("production", { enPlus: ["https://recette.playdujour.com"] })).toThrow(/jamais/);
    expect(() => allowedOrigins("production", { enPlus: ["https://x--pr-1-abc.web.app"] })).toThrow(/jamais/);
    expect(() => allowedOrigins("recette", { enPlus: ["https://nathan-te.github.io/DailyTrack/"] })).toThrow(/origine invalide/);
    expect(() => allowedOrigins("staging" as never)).toThrow(/cible inconnue/);
  });
});

describe("stockage : un aperçu ou la recette ne lisent ni n'écrivent jamais celui de la production", () => {
  it("la recette, les canaux d'aperçu et les adresses Firebase par défaut sont d'autres origines que la production", () => {
    for (const url of [ADRESSES.recette, "https://cdj-recette--pr-12-a1b2c3d4.web.app/jump/", "https://cdj-prod.web.app/", "https://cdj-prod--pr-1-x.web.app", "https://www.playdujour.com/", "http://playdujour.com/"]) {
      expect(storageIsolatedFromProduction(url), url).toBe(true);
    }
    // Seule la production elle-même partage son stockage (DailyTrack et DailyJump, /track/ et /jump/ : même origine, même identité).
    expect(storageIsolatedFromProduction("https://playdujour.com/track/")).toBe(false);
    expect(storageIsolatedFromProduction("https://playdujour.com/jump/?seed=2026-10-20")).toBe(false);
  });

  it("les aperçus vont sur le site de recette, jamais sur celui de la production", () => {
    expect(assertPreviewSite("cdj-recette", "cdj-prod")).toBe("cdj-recette");
    expect(() => assertPreviewSite("cdj-prod", "cdj-prod")).toThrow(/jamais/);
    expect(() => assertPreviewSite("", "cdj-prod")).toThrow();
  });

  it("canal d'aperçu : un par PR", () => {
    expect(previewChannel(12)).toBe("pr-12");
    expect(previewChannel("7")).toBe("pr-7");
    expect(() => previewChannel("abc")).toThrow();
  });
});

// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { probeRefusal, verdict } from "../../../scripts/sonde-proxy.mjs";

describe("sonde de l'adresse du client derrière Firebase (TRUST_PROXY)", () => {
  it("ne vise jamais la production", () => {
    expect(probeRefusal("https://cdj-api-5qi6aa4qqa-ew.a.run.app", "https://playdujour.com")).toMatch(/recette/);
    expect(probeRefusal("https://cdj-api-recette-x-ew.a.run.app", "https://playdujour.com")).toMatch(/recette/);
    expect(probeRefusal("https://cdj-api-recette-x-ew.a.run.app", "https://recette.playdujour.com")).toBeNull();
  });

  it("verdict : juste, trop bas, trop haut, ou à relancer", () => {
    expect(verdict({ directLimited: true, firstViaFirebase429: true, viaFirebaseLimited: false }).ok).toBe(true);
    expect(verdict({ directLimited: true, firstViaFirebase429: false, viaFirebaseLimited: true }).text).toMatch(/TROP BAS/);
    expect(verdict({ directLimited: true, firstViaFirebase429: false, viaFirebaseLimited: false }).text).toMatch(/TROP HAUT/);
    expect(verdict({ directLimited: true, firstViaFirebase429: false, viaFirebaseLimited: false, trustProxy: 1 }).text).toMatch(/TROP BAS/);
    expect(verdict({ directLimited: false, firstViaFirebase429: false, viaFirebaseLimited: false }).text).toMatch(/relance/);
  });
});
