import type { ApiResult, ChangeCodeResult, RenameResult, SyncState } from "@cdj/profile";
import { decodeTransfer, encodeTransfer, isValidName, normalizeName } from "@cdj/profile";
import type { JumpMe, JumpStats } from "./jumpProfile";

// Réglages › Profil de DailyJump (lot P2 de la plateforme), DOM seulement, sur le modèle de la carte du profil de DailyTrack (lots 29 et 30) :
// le pseudo et **Renommer** (un pseudo appartient à son premier propriétaire : refus, pseudos libres à toucher, « Charger un code »), **Copier
// mon code**, **Charger un code** (le profil est lu sur le serveur, montré, puis confirmé), **Changer mon code** (rotation, l'ancien code est
// révoqué partout). Tout passe par `@cdj/profile` : c'est **le même profil que DailyTrack** (mêmes clés `cdj:*`, même code `CDJ2`), et le
// texte le dit. La logique (fusion, statistiques, identité chargée) est dans `jumpProfile.ts`, pure et testée. Cibles d'au moins 44 px.

/** Le texte qui dit que le profil est commun à tous les jeux de la plateforme. */
export const SHARED_PROFILE_TEXT = "Ton profil est le même dans tous les jeux de la plateforme : ton pseudo et ton code valent aussi pour DailyTrack.";
/** Ce qu'on voit quand le code de cet appareil a été remplacé ailleurs (410). */
export const REVOKED_TEXT =
  "Ce code n'est plus valide : il a été remplacé depuis un autre appareil. Charge le nouveau code pour retrouver ton profil — rien n'est perdu ici, ton historique de cet appareil est gardé.";

export interface ProfileUiHost {
  /** Un serveur répond-il ici (pas la démonstration, une adresse d'API) ? Sans lui : pseudo local seulement, pas de code. */
  readonly online: boolean;
  /** Le pseudo de la plateforme (`cdj:name`), ou `null`. */
  name(): string | null;
  /** L'identifiant de cet appareil s'il existe déjà (sans le créer). */
  playerId(): string | null;
  /** L'identifiant de cet appareil, créé s'il n'existe pas (« Copier mon code » d'un nouveau joueur). */
  ensurePlayerId(): string;
  /** Jours joués, médailles, série (historique fusionné). */
  stats(): JumpStats;
  /** L'état de la synchronisation (hors ligne, code remplacé…). */
  sync(): Pick<SyncState<JumpMe>, "status" | "known" | "renameRequired">;
  /** Choisit un pseudo (le serveur dit s'il est libre). */
  rename(name: string): Promise<RenameResult>;
  changeCode(): Promise<ChangeCodeResult>;
  /** Le profil DailyJump que le serveur connaît pour un identifiant (aperçu d'un code à charger). */
  fetchProfile(id: string): Promise<ApiResult<JumpMe>>;
  /** Adopte l'identité du code chargé (identifiant, pseudo du serveur) ; faux si le stockage refuse. */
  applyIdentity(identity: { id: string; name: string | null }): boolean;
  copy(text: string): Promise<boolean>;
  /** Recharge la page après un changement d'identité (le jeu repart sur le profil chargé et se synchronise). */
  reload(): void;
  /** Le pseudo ou l'identité ont changé (l'accueil se redessine). */
  onChange?(): void;
}

export interface ProfileUi {
  readonly root: HTMLElement;
  refresh(): void;
  /** Le dernier message affiché (tests). */
  readonly message: string;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

const button = (cls: string, text: string, id?: string): HTMLButtonElement => {
  const b = el("button", cls, text);
  b.type = "button";
  if (id) b.id = id;
  return b;
};

const MEDALS = [
  ["author", "🏆"],
  ["gold", "🥇"],
  ["silver", "🥈"],
  ["bronze", "🥉"],
] as const;

/** « 🏆 1  🥇 2  🥈 0  🥉 3 » */
export function medalsText(m: JumpStats["medals"]): string {
  return MEDALS.map(([k, icon]) => `${icon} ${m[k]}`).join("  ");
}

/** « 3 jours de suite », « — ». */
export function streakShort(n: number): string {
  return n > 0 ? `${n} jour${n > 1 ? "s" : ""} de suite` : "—";
}

export function mountProfileUi(host: ProfileUiHost): ProfileUi {
  const root = el("section", "msection mprofile");
  root.id = "profile";
  root.setAttribute("aria-label", "Profil");
  root.append(el("h3", undefined, "Profil"));
  root.append(el("p", "mhint pshared", SHARED_PROFILE_TEXT));

  const notice = el("div", "pnotice");
  notice.id = "profile-notice";
  notice.setAttribute("role", "status");

  // ——— Pseudo ———
  const nameForm = el("form", "pname");
  const input = el("input", "pinput");
  input.id = "profile-name";
  input.type = "text";
  input.maxLength = 20;
  input.autocomplete = "off";
  input.placeholder = "Choisis ton pseudo";
  input.setAttribute("aria-label", "Pseudo");
  const save = el("button", "mbtn", "Renommer");
  save.type = "submit";
  save.id = "profile-rename";
  nameForm.append(input, save);
  const nameMsg = el("div", "pmsg");
  nameMsg.id = "profile-name-msg";
  nameMsg.setAttribute("role", "status");
  const suggestions = el("div", "psugg");
  suggestions.hidden = true;
  // Taper son pseudo ne commande pas le personnage (et Échap reste au menu).
  for (const type of ["keydown", "keyup"] as const) input.addEventListener(type, (e) => e.stopPropagation());

  const stats = el("dl", "pstats");
  stats.id = "profile-stats";

  // ——— Code ———
  const tools = el("div", "pactions");
  const copy = button("mbtn", "Copier mon code", "profile-copy");
  const load = button("mbtn", "Charger un code", "profile-load");
  const change = button("mbtn", "Changer mon code", "profile-change");
  tools.append(copy, load, change);
  const warn = el("p", "mhint", "Ce code donne accès à ton profil : ne le partage pas.");
  const changeBox = el("div", "pconfirm");
  changeBox.hidden = true;
  const loadBox = el("div", "pload");
  loadBox.hidden = true;
  const area = el("textarea", "pcode");
  area.id = "profile-code";
  area.rows = 2;
  area.placeholder = "Colle ici ton code de transfert…";
  area.setAttribute("aria-label", "Code de transfert à charger");
  area.autocomplete = "off";
  area.spellcheck = false;
  for (const type of ["keydown", "keyup"] as const) area.addEventListener(type, (e) => e.stopPropagation());
  const preview = el("div", "ppreview");
  preview.hidden = true;
  loadBox.append(area, preview);
  const msg = el("div", "pmsg");
  msg.id = "profile-msg";
  msg.setAttribute("role", "status");

  root.append(notice, nameForm, nameMsg, suggestions, stats, tools, warn, changeBox, msg, loadBox);

  let said = "";
  const say = (text: string, kind: "ok" | "error" | "" = "") => {
    said = text;
    msg.textContent = text;
    msg.dataset.tone = kind;
  };
  const sayName = (text: string, kind: "ok" | "error" | "" = "") => {
    nameMsg.textContent = text;
    nameMsg.dataset.tone = kind;
  };

  const openLoad = () => {
    loadBox.hidden = false;
    changeBox.hidden = true;
    resetPreview();
    say("");
    area.focus({ preventScroll: true });
  };

  function refresh(): void {
    const s = host.sync();
    if (document.activeElement !== input) input.value = host.name() ?? "";
    const st = host.stats();
    stats.replaceChildren(
      ...[
        ["Jours joués", String(st.days)],
        ["Série", streakShort(st.streak)],
        ["Médailles", medalsText(st.medals)],
      ].map(([k, v]) => {
        const cell = el("div", "pstat");
        cell.append(el("dt", undefined, k), el("dd", undefined, v));
        return cell;
      }),
    );
    const items: HTMLElement[] = [];
    if (s.status === "revoked") {
      const box = el("div", "pwarn");
      box.append(el("p", undefined, REVOKED_TEXT), button("mbtn primary", "Charger un code", "profile-notice-load"));
      box.querySelector("button")!.addEventListener("click", openLoad);
      items.push(box);
    } else if (s.status === "offline") {
      items.push(el("p", "mhint", "Hors ligne : voici le profil de cet appareil. Il se mettra à jour dès que le serveur répondra."));
    } else if (!host.online) {
      items.push(el("p", "mhint", "Pas de serveur ici (démonstration ou aperçu sans serveur) : ton pseudo reste sur cet appareil, le code ne sert à rien."));
    }
    if (s.renameRequired) items.push(el("p", "mhint", "Ton pseudo a été changé parce qu'un autre joueur l'avait avant toi : choisis-en un nouveau, ou charge ton code."));
    notice.replaceChildren(...items);
    notice.hidden = items.length === 0;
    copy.disabled = !host.online;
    load.disabled = !host.online;
    change.disabled = !host.online;
  }

  // ——— Renommer ———
  function showSuggestions(list: readonly string[] | undefined, withLoad: boolean): void {
    suggestions.replaceChildren();
    for (const s of list ?? []) {
      const b = button("mbtn psuggestion", s);
      b.addEventListener("click", () => {
        input.value = s;
        nameForm.requestSubmit();
      });
      suggestions.append(b);
    }
    if (withLoad && host.online) {
      const b = button("mbtn", "Charger un code");
      b.addEventListener("click", openLoad);
      suggestions.append(b);
    }
    suggestions.hidden = suggestions.childElementCount === 0;
  }
  nameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = normalizeName(input.value);
    showSuggestions([], false);
    if (!isValidName(name)) return sayName("1 à 20 caractères : lettres, chiffres, espace . _ ' -", "error");
    save.disabled = true;
    try {
      const r = await host.rename(name);
      if (!r.ok) {
        sayName(r.message, "error");
        showSuggestions(r.suggestions, r.code === "name_taken");
        return;
      }
      input.value = r.name;
      sayName(`Pseudo enregistré : ${r.name}`, "ok");
      host.onChange?.();
      refresh();
    } finally {
      save.disabled = false;
    }
  });

  // ——— Copier / charger / changer ———
  copy.addEventListener("click", async () => {
    resetPreview();
    changeBox.hidden = true;
    const code = encodeTransfer(host.ensurePlayerId());
    if (await host.copy(code)) {
      area.value = "";
      say("Code copié. Garde-le pour toi : il donne accès à ton profil (DailyJump et DailyTrack). Sur un autre appareil : Réglages › Profil › Charger un code, et colle-le.", "ok");
    } else {
      loadBox.hidden = false;
      area.value = code;
      area.select();
      say("Copie automatique impossible : le code est affiché, sélectionne-le et copie-le.", "error");
    }
  });

  load.addEventListener("click", () => {
    if (loadBox.hidden) return openLoad();
    loadBox.hidden = true;
    resetPreview();
    say("");
  });

  change.addEventListener("click", () => {
    resetPreview();
    say("");
    loadBox.hidden = true;
    changeBox.hidden = !changeBox.hidden;
    if (changeBox.hidden) return;
    const yes = button("mbtn primary", "Oui, changer mon code", "profile-change-yes");
    const no = button("mbtn", "Annuler", "profile-change-no");
    no.addEventListener("click", () => (changeBox.hidden = true));
    const row = el("div", "pactions");
    row.append(yes, no);
    changeBox.replaceChildren(el("p", undefined, "Ton ancien code ne marchera plus, sur aucun appareil ni dans aucun jeu : les autres appareils devront charger le nouveau. Ton pseudo et tes temps sont gardés."), row);
    yes.addEventListener("click", async () => {
      yes.disabled = true;
      const r = await host.changeCode();
      yes.disabled = false;
      if (!r.ok) return say(r.message, "error");
      changeBox.hidden = true;
      const code = encodeTransfer(host.ensurePlayerId());
      if (await host.copy(code)) say("Code changé. Le nouveau code est copié : charge-le sur tes autres appareils (Réglages › Profil › Charger un code). L'ancien ne marche plus.", "ok");
      else {
        loadBox.hidden = false;
        area.value = code;
        area.select();
        say("Code changé. Copie le nouveau code affiché ci-dessous pour tes autres appareils : l'ancien ne marche plus.", "ok");
      }
      host.onChange?.();
      refresh();
    });
  });

  function resetPreview(): void {
    preview.hidden = true;
    preview.replaceChildren();
  }

  let inspecting = 0;
  /** Lit le code collé : s'il est valide, demande le profil au serveur, le montre et demande confirmation. */
  async function inspect(): Promise<void> {
    resetPreview();
    const text = area.value.trim();
    const run = ++inspecting;
    if (!text) return say("");
    const r = decodeTransfer(text);
    if (!r.ok) return say(r.reason, "error");
    const id = r.data.id;
    if (id === host.playerId()) return say("C'est le code de cet appareil : tu es déjà ce profil.", "ok");
    say("Recherche du profil…");
    const answer = await host.fetchProfile(id);
    if (run !== inspecting) return;
    if (!answer.ok) {
      if (answer.code === "code_revoked") return say("Ce code n'est plus valide : il a été remplacé. Demande le nouveau code à l'appareil qui l'a changé.", "error");
      if (answer.code === "unknown_player") return say("Ce code ne correspond à aucun profil connu du serveur. Vérifie que tu l'as copié en entier.", "error");
      return say(answer.status === 0 ? "Impossible de joindre le serveur : réessaie dans un moment." : answer.message, "error");
    }
    say("");
    const found = answer.data;
    const current = host.name();
    const go = button("mbtn primary", "Prendre ce profil", "profile-apply");
    const cancel = button("mbtn", "Annuler", "profile-cancel");
    const row = el("div", "pactions");
    row.append(go, cancel);
    preview.replaceChildren(
      el("p", "pfound", `Profil trouvé : « ${found.name} » · ${found.stats.days} jour${found.stats.days > 1 ? "s" : ""} · série ${streakShort(found.stats.streak)} · ${medalsText(found.stats.medals)}`),
      el("p", "mhint", `Cet appareil jouera désormais sous ce profil, dans DailyJump et dans DailyTrack. Ton identité actuelle${current ? ` (« ${current} »)` : ""} sera remplacée : si tu n'as pas copié ton code actuel, tu ne pourras plus la retrouver.`),
      row,
    );
    preview.hidden = false;
    cancel.addEventListener("click", () => {
      resetPreview();
      area.value = "";
      say("Rien n'a changé.");
    });
    go.addEventListener("click", () => {
      go.disabled = true;
      if (!host.applyIdentity({ id, name: found.name })) {
        resetPreview();
        return say("Le navigateur refuse d'écrire (navigation privée ou stockage plein) : rien n'a changé.", "error");
      }
      resetPreview();
      area.value = "";
      say("Profil chargé. Rechargement…", "ok");
      host.onChange?.();
      setTimeout(() => host.reload(), 500);
    });
  }
  area.addEventListener("input", () => void inspect());

  refresh();
  return {
    root,
    refresh,
    get message() {
      return said;
    },
  };
}
