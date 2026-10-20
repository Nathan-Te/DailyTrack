import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { ADRESSES, ANCIENNE_ORIGINE, RETRAIT_ANCIENNE_ORIGINE, RETRAIT_REDIRECTIONS, allowedOrigins, assertPreviewSite, previewChannel, storageIsolatedFromProduction } from "../../../scripts/domaine.mjs";

// Lot R4 : les adresses de la plateforme, les origines permises par le serveur, et la séparation du stockage par origine.

describe("origines permises (ALLOWED_ORIGINS)", () => {
  it("production : playdujour.com, et l'ancienne origine jusqu'à sa date de retrait comprise", () => {
    expect(allowedOrigins("production", { jour: "2026-10-20" })).toEqual(["https://playdujour.com", "https://nathan-te.github.io"]);
    expect(allowedOrigins("production", { jour: RETRAIT_ANCIENNE_ORIGINE })).toContain(ANCIENNE_ORIGINE);
    expect(allowedOrigins("production", { jour: "2027-01-01" })).toEqual(["https://playdujour.com"]);
  });

  it("recette : recette.playdujour.com, l'ancienne origine (même date), et l'origine du canal d'aperçu d'une PR", () => {
    expect(allowedOrigins("recette", { jour: "2026-10-20", enPlus: ["https://cdj-recette--pr-12-a1b2c3.web.app/;http://localhost:5173"] })).toEqual([
      "https://recette.playdujour.com",
      "https://nathan-te.github.io",
      "https://cdj-recette--pr-12-a1b2c3.web.app",
      "http://localhost:5173",
    ]);
  });

  it("la production refuse la recette et tout aperçu Firebase ; une origine avec un chemin est refusée", () => {
    expect(() => allowedOrigins("production", { jour: "2026-10-20", enPlus: ["https://recette.playdujour.com"] })).toThrow(/jamais/);
    expect(() => allowedOrigins("production", { jour: "2026-10-20", enPlus: ["https://x--pr-1-abc.web.app"] })).toThrow(/jamais/);
    expect(() => allowedOrigins("recette", { jour: "2026-10-20", enPlus: ["https://nathan-te.github.io/DailyTrack/"] })).toThrow(/origine invalide/);
    expect(() => allowedOrigins("staging" as never, { jour: "2026-10-20" })).toThrow(/cible inconnue/);
    expect(() => allowedOrigins("production", { jour: "20/10/2026" })).toThrow(/jour/);
  });

  it("les redirections restent au moins 6 mois après la dernière date d'origine permise", () => {
    const months = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
    expect(months("2026-11-01", RETRAIT_REDIRECTIONS)).toBeGreaterThanOrEqual(6);
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
