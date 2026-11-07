import { describe, expect, it } from "vitest";
import { SESSION_AUDIO, audioDisponible, ouvrirContexteAudio, poserSessionAmbiante, type EnvAudio } from "../src/audio";

// Lot S2 : le contexte audio de tous les jeux s'ouvre par `ouvrirContexteAudio`, dans la session `ambient` (le son du jeu se mêle à celui du téléphone, il ne le coupe pas).

class FauxContexte {
  /** Ce que valait la session audio quand le contexte a été créé. */
  readonly sessionALaCreation: string | undefined;
  constructor(env: EnvAudio) {
    this.sessionALaCreation = env.navigator?.audioSession?.type;
  }
}

/** Un navigateur factice : `AudioContext` (ou son ancien nom) et, ou non, `navigator.audioSession`. */
function navigateur(o: { ancien?: boolean; session?: boolean; refuse?: boolean } = {}): EnvAudio & { session?: { type: string } } {
  const env: EnvAudio & { session?: { type: string } } = {};
  if (o.session !== false) env.navigator = { audioSession: (env.session = { type: "auto" }) };
  else env.navigator = {};
  const Ctor = o.refuse
    ? class {
        constructor() {
          throw new Error("refusé");
        }
      }
    : class extends FauxContexte {
        constructor() {
          super(env);
        }
      };
  if (o.ancien) env.webkitAudioContext = Ctor as never;
  else env.AudioContext = Ctor as never;
  return env;
}

describe("le contexte audio commun (lot S2)", () => {
  it("la session audio est `ambient`, et jamais `playback` (qui coupe la musique et la vidéo du joueur)", () => {
    expect(SESSION_AUDIO).toBe("ambient");
    const env = navigateur();
    const ctx = ouvrirContexteAudio<FauxContexte>(env);
    expect(ctx).toBeInstanceOf(FauxContexte);
    expect(env.session!.type).toBe("ambient");
  });

  it("la session est posée avant la création du contexte (c'est elle qui décide de ce que fait le téléphone des autres sons)", () => {
    const ctx = ouvrirContexteAudio<FauxContexte>(navigateur())!;
    expect(ctx.sessionALaCreation).toBe("ambient");
  });

  it("sans l'API `audioSession` (la plupart des navigateurs), le contexte s'ouvre quand même", () => {
    const env = navigateur({ session: false });
    expect(ouvrirContexteAudio(env)).toBeInstanceOf(FauxContexte);
    expect(poserSessionAmbiante(env)).toBe(false);
  });

  it("une session qui refuse d'être changée ne casse rien", () => {
    const env = navigateur();
    Object.defineProperty(env.navigator!.audioSession!, "type", {
      get: () => "auto",
      set: () => {
        throw new Error("refusé");
      },
    });
    expect(ouvrirContexteAudio(env)).toBeInstanceOf(FauxContexte);
  });

  it("l'ancien nom `webkitAudioContext` (Safari avant 14.1) est reconnu", () => {
    const env = navigateur({ ancien: true });
    expect(audioDisponible(env)).toBe(true);
    expect(ouvrirContexteAudio(env)).toBeInstanceOf(FauxContexte);
  });

  it("sans Web Audio : `null`, et la session n'est pas touchée", () => {
    const env: EnvAudio = { navigator: { audioSession: { type: "auto" } } };
    expect(audioDisponible(env)).toBe(false);
    expect(ouvrirContexteAudio(env)).toBeNull();
    expect(env.navigator!.audioSession!.type).toBe("auto");
    expect(ouvrirContexteAudio({})).toBeNull();
  });

  it("un navigateur qui refuse de créer le contexte : `null`, sans lever", () => {
    expect(ouvrirContexteAudio(navigateur({ refuse: true }))).toBeNull();
  });

  it("sous Node (aucun `AudioContext` global) : `null`", () => {
    expect(audioDisponible()).toBe(false);
    expect(ouvrirContexteAudio()).toBeNull();
  });
});
