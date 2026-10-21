import type { Langue } from "@cdj/ui";
import { choixLangue, el, icone } from "@cdj/ui";
import { creerCadre } from "./cadre";
import { COMMANDES, listeCommandes } from "./howtoUi";
import { langueCourante, lier, onLangue, setLangue, t, traducteurDuSocle } from "./i18n";
import type { EffectsLevel, PlayerSettings } from "./settings";

// Les Réglages de Jump (lot 8 dans le menu ⏸ ; **lot I5 : un écran du cadre crème**, maquette `jump-reglages.html`) : « ‹ JUMP » ferme l'écran (retour à la
// pause ou à l'accueil), l'étiquette jaune porte le son (trois curseurs), les sensations (vibrations, tremblement, mouvement réduit, effets visuels), le
// fantôme du premier et les taches de tout le monde (montrer / cacher), les commandes (clavier, manette, tactile), **la langue** (`choixLangue` du
// socle : écrite pour toute la plateforme, l'écran change sans recharger) et les liens « Mon profil Du Jour › » (le profil commun du portail,
// `/profil/?retour=<chemin du jeu>` : **plus de profil dans le jeu**) et « Mentions légales ». Les réglages s'appliquent tout de suite et se mémorisent
// (`settings.ts`) ; ils ne touchent jamais à la simulation. Cibles de 44 px au moins.

export interface SettingsUiOptions {
  settings: PlayerSettings;
  onChange(s: PlayerSettings, changed: keyof PlayerSettings): void;
  /** Le téléphone sait vibrer (`navigator.vibrate`) : sinon le réglage le dit. */
  canVibrate: boolean;
  /** `../profil/?retour=/jump/` : le profil commun du portail, avec le retour au jeu. */
  profilHref: string;
  /** L'écran est ouvert ou fermé (la pause du jeu suit). */
  onToggle?(open: boolean): void;
}

export interface SettingsUi {
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  /** Les réglages ont changé ailleurs (la pause : fantôme, son) : l'écran se remet à jour. */
  set(s: PlayerSettings): void;
}

const EFFECTS: readonly EffectsLevel[] = ["normal", "reduit", "aucun"];

export function mountSettings(opts: SettingsUiOptions): SettingsUi {
  let s = { ...opts.settings };
  let open = false;
  const cadre = creerCadre({ id: "settings", titreAria: "reglages.aria", retour: "jeu", haut: true, scene: true, onRetour: () => self.close() });
  const change = (key: keyof PlayerSettings) => opts.onChange({ ...s }, key);
  const shows: (() => void)[] = [];

  const section = (cle: string, ...enfants: (Node | null)[]) => el("section", { classe: "reglages__section" }, lier(el("h2", { classe: "reglages__titre" }), cle), ...enfants);
  const aide = (cle: string) => lier(el("p", { classe: "reglages__aide" }), cle);

  // Un curseur (volume) : sa ligne est un vrai `label`, la valeur à droite en mono.
  const curseur = (key: "volume" | "sfx" | "ambience", cle: string) => {
    const input = el("input", { attrs: { type: "range", min: 0, max: 100, step: 5 } });
    const out = el("output", { classe: "curseur__valeur" });
    const row = el("label", { classe: "curseur", attrs: { "data-setting": key } }, lier(el("span", { classe: "curseur__nom" }), cle), input, out);
    const show = () => {
      input.value = String(Math.round(s[key] * 100));
      out.textContent = t("reglages.valeur", { n: Math.round(s[key] * 100) });
    };
    input.addEventListener("input", () => {
      s = { ...s, [key]: Number(input.value) / 100 };
      out.textContent = t("reglages.valeur", { n: Number(input.value) });
      change(key);
    });
    shows.push(show);
    return row;
  };
  // Un choix exclusif (segment) : deux ou trois boutons `aria-pressed`, le groupe porte `data-setting`.
  const segment = <V extends string | boolean>(key: keyof PlayerSettings, aria: string, choix: readonly { valeur: V; cle: string }[], id?: string) => {
    const groupe = el("div", { classe: "segment", attrs: { role: "group", "data-setting": key, id } });
    lier(groupe, aria, undefined, "aria-label");
    const boutons = choix.map((c) => {
      const b = lier(el("button", { classe: "segment__bouton", attrs: { type: "button", "data-value": String(c.valeur) } }), c.cle);
      b.addEventListener("click", () => {
        if (s[key] === c.valeur) return;
        s = { ...s, [key]: c.valeur };
        shows.forEach((f) => f());
        change(key);
      });
      groupe.append(b);
      return b;
    });
    shows.push(() => boutons.forEach((b, i) => b.setAttribute("aria-pressed", s[key] === choix[i]!.valeur ? "true" : "false")));
    return groupe;
  };
  const ouiNon = (key: "vibration" | "shake" | "reducedMotion", cle: string) =>
    el("div", { classe: "reglages__ligne" }, lier(el("span", { classe: "reglages__nom" }), cle), segment(key, cle, [{ valeur: true, cle: "commun.oui" }, { valeur: false, cle: "commun.non" }]));

  const lienFleche = (id: string, cle: string, href: string, classe: string) => el("a", { classe: ["reglages__lien", classe], attrs: { id, href } }, lier(el("span"), cle), icone("chevron", { taille: 16 }));

  const langue = el("div", { classe: "reglages__langue" });
  const majLangue = () => langue.replaceChildren(choixLangue(traducteurDuSocle(), { langue: langueCourante(), onChange: (l: Langue) => void setLangue(l) }));
  majLangue();
  onLangue(majLangue);

  cadre.corps.append(
    lier(el("h1", { classe: "etiquette__titre" }), "reglages.titre"),
    section("reglages.son", curseur("volume", "reglages.volume"), curseur("sfx", "reglages.effetsSonores"), curseur("ambience", "reglages.ambiance")),
    section(
      "reglages.sensations",
      ouiNon("vibration", "reglages.vibrations"),
      opts.canVibrate ? null : aide("reglages.vibrations.non"),
      ouiNon("shake", "reglages.tremblement"),
      ouiNon("reducedMotion", "reglages.mouvement"),
      aide("reglages.mouvement.aide"),
      el("div", { classe: "reglages__ligne" }, lier(el("span", { classe: "reglages__nom" }), "reglages.effets"), segment("effects", "reglages.effets", EFFECTS.map((e) => ({ valeur: e, cle: `reglages.effets.${e}` })))),
      aide("reglages.effets.aide"),
    ),
    section("reglages.premier", segment("firstGhost", "reglages.premier", [{ valeur: true, cle: "commun.montrer" }, { valeur: false, cle: "commun.cacher" }], "reglages-premier"), aide("reglages.premier.aide")),
    section("reglages.taches", segment("othersStains", "reglages.taches", [{ valeur: true, cle: "commun.montrer" }, { valeur: false, cle: "commun.cacher" }], "reglages-taches"), aide("reglages.taches.aide")),
    section(
      "reglages.commandes",
      el(
        "div",
        { classe: "reglages__commandes" },
        el("div", {}, lier(el("h3", { classe: "reglages__appareil" }), "reglages.clavier"), listeCommandes(COMMANDES.clavier)),
        el("div", {}, lier(el("h3", { classe: "reglages__appareil" }), "reglages.manette"), listeCommandes(COMMANDES.manette)),
        el("div", {}, lier(el("h3", { classe: "reglages__appareil" }), "reglages.tactile"), listeCommandes(COMMANDES.tactile)),
      ),
    ),
    el("section", { classe: "reglages__section reglages__section--ligne" }, lier(el("h2", { classe: "reglages__titre" }), "reglages.langue"), langue),
    // Lot I5 : plus de profil dans le jeu — le profil commun du portail ; lot R5 : les mentions légales du site.
    el("div", { classe: "reglages__liens" }, lienFleche("settings-profil", "reglages.profil", opts.profilHref, "reglages__lien--profil"), lienFleche("settings-mentions", "reglages.mentions", "../mentions-legales/", "reglages__lien--mentions")),
  );
  shows.forEach((f) => f());
  onLangue(() => shows.forEach((f) => f()));

  // Échap ferme l'écran (il est au-dessus de la pause et de l'accueil).
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code !== "Escape" || !open) return;
      self.close();
      e.stopImmediatePropagation();
    },
    { capture: true },
  );
  const self: SettingsUi = {
    get isOpen() {
      return open;
    },
    open() {
      if (open) return;
      open = true;
      cadre.racine.hidden = false;
      cadre.corps.scrollTop = 0;
      cadre.racine.querySelector<HTMLElement>(".dj-barre-jeu__retour")?.focus({ preventScroll: true });
      opts.onToggle?.(true);
    },
    close() {
      if (!open) return;
      open = false;
      cadre.racine.hidden = true;
      opts.onToggle?.(false);
    },
    set(next) {
      s = { ...next };
      shows.forEach((f) => f());
    },
  };
  return self;
}
