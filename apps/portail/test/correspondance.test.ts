import { describe, expect, it } from "vitest";
import { correspondance } from "../src/correspondance";

// Lot R4 : la correspondance des chemins de l'ancienne adresse (GitHub Pages) vers playdujour.com, paramètres compris.
const C = "https://playdujour.com";
const url = (path: string, search = "") => correspondance(path, search, C);

describe("redirections : ancienne adresse → playdujour.com", () => {
  it("DailyTrack : /DailyTrack/ → /track/, avec ses paramètres", () => {
    expect(url("/DailyTrack/")).toEqual({ kind: "jeu", url: "https://playdujour.com/track/" });
    expect(url("/DailyTrack")).toEqual({ kind: "jeu", url: "https://playdujour.com/track/" });
    expect(url("/DailyTrack/index.html")).toEqual({ kind: "jeu", url: "https://playdujour.com/track/index.html" });
    expect(url("/DailyTrack/", "?seed=2026-10-19")).toEqual({ kind: "jeu", url: "https://playdujour.com/track/?seed=2026-10-19" });
    expect(url("/DailyTrack/", "?watch=best&day=2026-10-19&mode=salon").url).toBe("https://playdujour.com/track/?watch=best&day=2026-10-19&mode=salon");
    expect(url("/DailyTrack/admin/", "?api=demo").url).toBe("https://playdujour.com/track/admin/?api=demo");
    expect(url("/DailyTrack/verify.html").url).toBe("https://playdujour.com/track/verify.html");
  });

  it("DailyJump : /DailyTrack/jump/ → /jump/, avec ses paramètres", () => {
    expect(url("/DailyTrack/jump/")).toEqual({ kind: "jeu", url: "https://playdujour.com/jump/" });
    expect(url("/DailyTrack/jump")).toEqual({ kind: "jeu", url: "https://playdujour.com/jump/" });
    expect(url("/DailyTrack/jump/", "?seed=2026-10-18&watch=first").url).toBe("https://playdujour.com/jump/?seed=2026-10-18&watch=first");
    expect(url("/DailyTrack/jump/index.html", "?debug").url).toBe("https://playdujour.com/jump/index.html?debug");
    // « jumpx » n'est pas DailyJump
    expect(url("/DailyTrack/jumpx/").url).toBe("https://playdujour.com/track/jumpx/");
  });

  it("les anciens aperçus de branche (/b/…) : une page qui explique, aucune redirection vers un jeu", () => {
    expect(url("/DailyTrack/b/claude-lot-5/").kind).toBe("apercu");
    expect(url("/DailyTrack/b/claude-lot-5/jump/", "?seed=2026-10-20").kind).toBe("apercu");
    expect(url("/DailyTrack/b").kind).toBe("apercu");
    expect(url("/DailyTrack/bonus/").kind).toBe("jeu");
  });

  it("hors de l'ancien site : le portail", () => {
    expect(url("/")).toEqual({ kind: "portail", url: "https://playdujour.com/" });
    expect(url("/AutreDepot/")).toEqual({ kind: "portail", url: "https://playdujour.com/" });
    expect(url("/DailyTrackX/").kind).toBe("portail");
  });

  it("une cible avec « / » final et un « ? » vide ne doublent rien", () => {
    expect(correspondance("/DailyTrack/jump/", "?", "https://playdujour.com/").url).toBe("https://playdujour.com/jump/");
    expect(correspondance("/DailyTrack/", "seed=2026-10-19", "http://localhost:4177").url).toBe("http://localhost:4177/track/?seed=2026-10-19");
  });
});
