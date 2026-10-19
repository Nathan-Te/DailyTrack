// Carte du profil (lot 29, refaite au lot 30) : pseudo (réservé à son propriétaire), statistiques, code de transfert (copier mon code / charger un code /
// changer mon code). Le serveur fait foi : charger un code récupère le profil depuis le serveur, et la carte dit quand le cache local est seul à répondre
// (hors ligne) ou quand le code a été remplacé ailleurs. Montée à l'accueil et dans Réglages › Profil. Le DOM seulement : la logique est dans profile.ts,
// profileSync.ts et transfer.ts.
import type { ApiResult, MeProfile } from "./api";
import { copyText } from "./clipboard";
import { button, el, flashLabel } from "./dom";
import { getName, getPlayerId, isValidName, normalizeName } from "./identity";
import type { ChangeCodeResult, RenameResult } from "./online";
import { dayShort, listPlayedDays, loadRanks, playedFromRecords, profileStats, type ProfileStats } from "./profile";
import type { ProfileSync } from "./profileSync";
import { MEDAL_ICON, ordinal } from "./share";
import { applyIdentity, decodeTransfer, encodeTransfer, legacyReplays, noteCodeLoaded, pendingTrackIds, type TransferData } from "./transfer";
import { gameStorage } from "./storage";

export interface ProfileHost {
  /** Jour affiché comme « aujourd'hui » (AAAA-MM-JJ) : la série se compte jusque-là. */
  today: string;
  /** Choisit un pseudo (le serveur dit s'il est libre). */
  rename(name: string): Promise<RenameResult>;
  /** Le profil que le serveur connaît pour un identifiant (aperçu d'un code à charger) ; `null` : pas de serveur ici. */
  fetchProfile(id: string): Promise<ApiResult<MeProfile>> | null;
  /** « Changer mon code » : le serveur remplace l'identifiant secret du profil. */
  changeCode(): Promise<ChangeCodeResult>;
  /** Synchronisation du profil (état affiché : hors ligne, code remplacé, pseudo à rechoisir). */
  sync: ProfileSync;
  /** Envoie au serveur les rediffusions d'un ancien code (CDJ1) : il les rejoue ; ce qu'il refuse est ignoré. */
  submitLegacy?(id: string, name: string | null, replays: { date: string; replay: string }[]): Promise<void>;
  /** Recharge la page après un remplacement d'identité (injectable pour les tests unitaires). */
  reload?: () => void;
  storage?: Storage;
  /** Appelé quand le pseudo ou l'identité ont changé (l'accueil se redessine). */
  onChange?(): void;
}

export interface ProfileCard {
  root: HTMLElement;
  /** Relit le pseudo, les statistiques et l'état de la synchronisation. */
  refresh(): void;
  /** Ouvre la zone « Charger un code » (depuis un message qui y mène). */
  showLoad(): void;
}

const MEDAL_ORDER = ["author", "gold", "silver", "bronze"] as const;

/** Texte des statistiques (aussi utilisé par l'aperçu d'un code trouvé). */
export function statsLines(s: ProfileStats): { label: string; value: string }[] {
  return [
    { label: "Jours joués", value: String(s.days) },
    { label: "Série", value: s.streak > 0 ? `${s.streak} jour${s.streak > 1 ? "s" : ""} de suite` : "—" },
    { label: "Meilleure place", value: s.bestRank ? `${ordinal(s.bestRank.rank)} sur ${s.bestRank.participants} (${dayShort(s.bestRank.date)})` : "—" },
    { label: "Médailles", value: MEDAL_ORDER.map((m) => `${MEDAL_ICON[m]} ${s.medals[m]}`).join("  ") },
  ];
}

function statGrid(s: ProfileStats): HTMLElement {
  const grid = el("dl", "stats");
  for (const { label, value } of statsLines(s)) {
    const cell = el("div", label === "Médailles" ? "stat wide" : "stat");
    cell.append(el("dt", "", label), el("dd", "", value));
    grid.append(cell);
  }
  return grid;
}

/** Le pseudo d'origine d'un compte renommé par la migration (« Nowy·2 » → « Nowy »). */
export const baseName = (name: string): string => name.replace(/·\d+$/u, "");
const RENAME_NOTICE = "cdj:notice:rename";

export function mountProfileCard(host: ProfileHost): ProfileCard {
  const storage = host.storage ?? gameStorage();
  const reload = host.reload ?? (() => location.reload());
  const root = el("section", "profile");
  root.setAttribute("aria-label", "Ton profil");

  // --- Messages du serveur : code remplacé, pseudo à rechoisir, hors ligne ---
  const notice = el("div", "notices");

  // --- Pseudo ---
  const nameForm = el("form", "nameform");
  const nameLabel = el("label", "label", "Pseudo");
  const input = el("input");
  input.type = "text";
  input.maxLength = 20;
  input.autocomplete = "off";
  input.placeholder = "Choisis ton pseudo";
  input.className = "name";
  input.setAttribute("aria-label", "Pseudo");
  const save = button("Enregistrer", "small");
  save.type = "submit";
  const nameMsg = el("div", "msg");
  nameMsg.setAttribute("role", "status");
  const suggestions = el("div", "suggestions");
  suggestions.hidden = true;
  nameForm.append(nameLabel, input, save);

  const stats = el("div", "statsbox");

  // --- Code de transfert ---
  const tools = el("div", "actions");
  const copy = button("Copier mon code", "tr-copy");
  const load = button("Charger un code", "tr-load");
  const change = button("Changer mon code", "tr-change");
  tools.append(copy, load, change);
  const warn = el("p", "warn", "Ce code donne accès à ton profil : ne le partage pas.");
  const changeBox = el("div", "tr-confirm");
  changeBox.hidden = true;
  const loadBox = el("div", "loadbox");
  loadBox.hidden = true;
  const area = el("textarea", "tr-code");
  area.rows = 2;
  area.placeholder = "Colle ici ton code de transfert…";
  area.setAttribute("aria-label", "Code de transfert à charger");
  area.autocomplete = "off";
  area.spellcheck = false;
  const pasteBtn = button("Coller", "small");
  const preview = el("div", "tr-preview");
  preview.hidden = true;
  const msg = el("div", "msg tr-msg");
  msg.setAttribute("role", "status");
  const loadHead = el("div", "loadhead");
  loadHead.append(el("span", "", "Code à charger"), pasteBtn);
  loadBox.append(loadHead, area, preview);

  root.append(el("h3", "", "Ton profil"), notice, nameForm, nameMsg, suggestions, stats, tools, warn, changeBox, msg, loadBox);

  let pending: { data: TransferData; name: string | null } | null = null;
  const say = (text: string, kind: "ok" | "error" | "" = "") => {
    msg.textContent = text;
    msg.className = `msg tr-msg ${kind}`;
  };
  const sayName = (text: string, kind: "ok" | "error" | "" = "") => {
    nameMsg.textContent = text;
    nameMsg.className = `msg ${kind}`;
  };

  function openLoad() {
    loadBox.hidden = false;
    resetPreview();
    say("");
    area.focus();
  }

  // --- Messages d'état ---
  function renderNotice() {
    const s = host.sync.state;
    const name = getName();
    const items: HTMLElement[] = [];
    if (s.status === "revoked") {
      const box = el("div", "notice error");
      box.setAttribute("role", "alert");
      box.append(el("p", "", "Ce code n'est plus valide : il a été remplacé depuis un autre appareil. Charge le nouveau code pour retrouver ton profil — tes temps et ton pseudo sont gardés par le serveur."));
      const a = el("div", "actions");
      a.append(button("Charger un code", "primary small notice-load", openLoad));
      box.append(a);
      items.push(box);
    } else if (s.renameRequired && name && storage.getItem(RENAME_NOTICE) !== name) {
      const box = el("div", "notice");
      box.setAttribute("role", "status");
      box.append(el("p", "", `Le pseudo « ${baseName(name)} » était déjà utilisé par un autre joueur : le tien est devenu « ${name} ». Choisis un nouveau pseudo ci-dessous — ou, si « ${baseName(name)} » est bien toi, charge ton code.`));
      const a = el("div", "actions");
      a.append(
        button("Charger un code", "small notice-load", openLoad),
        button(`Garder « ${name} »`, "link small notice-keep", () => {
          try {
            storage.setItem(RENAME_NOTICE, name);
          } catch {
            /* tant pis : le message reviendra */
          }
          renderNotice();
        }),
      );
      box.append(a);
      items.push(box);
    }
    if (s.nameProblem) {
      const box = el("div", "notice error");
      box.setAttribute("role", "alert");
      box.append(el("p", "", `${s.nameProblem.message} Ton temps du jour attend un pseudo libre pour entrer au classement.`));
      const a = el("div", "actions");
      for (const sug of s.nameProblem.suggestions)
        a.append(
          button(sug, "small suggestion", () => {
            input.value = sug;
            nameForm.requestSubmit();
          }),
        );
      a.append(button("Charger un code", "small notice-load", openLoad));
      box.append(a);
      items.push(box);
    }
    if (s.status === "offline") items.push(el("p", "notice quiet", "Hors ligne : voici le profil de cet appareil. Il se mettra à jour dès que le serveur répondra."));
    notice.replaceChildren(...items);
    notice.hidden = items.length === 0;
  }

  function refresh() {
    const name = getName();
    if (document.activeElement !== input) input.value = name ?? "";
    stats.replaceChildren(statGrid(profileStats(listPlayedDays(storage), loadRanks(storage), host.today)));
    renderNotice();
  }
  host.sync.subscribe(refresh);

  // --- Pseudo ---
  function showSuggestions(list: readonly string[] | undefined, withLoad: boolean) {
    suggestions.replaceChildren();
    for (const s of list ?? []) {
      suggestions.append(
        button(s, "small suggestion", () => {
          input.value = s;
          nameForm.requestSubmit();
        }),
      );
    }
    if (withLoad) suggestions.append(button("Charger un code", "small tr-load-from-name", openLoad));
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

  // --- Copier / charger / changer ---
  copy.addEventListener("click", async () => {
    resetPreview();
    changeBox.hidden = true;
    const code = encodeTransfer(getPlayerId()); // crée l'identité si elle n'existe pas encore
    if (await copyText(code)) {
      area.value = ""; // le code n'est pas affiché : on ne le met pas sous les yeux de qui regarde l'écran
      say("Code copié. Garde-le pour toi : il donne accès à ton profil. Pour le retrouver sur un autre appareil, touche « Charger un code » là-bas et colle-le.", "ok");
    } else {
      loadBox.hidden = false;
      area.value = code; // le navigateur refuse le presse-papiers : on le montre pour le copier à la main
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
    changeBox.hidden = !changeBox.hidden;
    if (changeBox.hidden) return;
    const yes = button("Oui, changer mon code", "primary small tr-change-yes");
    const no = button("Annuler", "small tr-change-no", () => {
      changeBox.hidden = true;
    });
    const actions = el("div", "actions");
    actions.append(yes, no);
    changeBox.replaceChildren(
      el("p", "", "Ton ancien code ne marchera plus, sur aucun appareil : les autres appareils devront charger le nouveau code. Tes temps et ton pseudo sont gardés."),
      actions,
    );
    yes.addEventListener("click", async () => {
      yes.disabled = true;
      const r = await host.changeCode();
      yes.disabled = false;
      if (!r.ok) return say(r.message, "error");
      changeBox.hidden = true;
      const code = encodeTransfer(getPlayerId());
      if (await copyText(code)) say("Code changé. Le nouveau code est copié : charge-le sur tes autres appareils (Réglages › Profil › Charger un code). L'ancien ne marche plus.", "ok");
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

  function resetPreview() {
    pending = null;
    preview.hidden = true;
    preview.replaceChildren();
  }

  let inspecting = 0;
  /** Lit le code collé : s'il est valide, demande le profil au serveur, le montre et demande confirmation. */
  async function inspect() {
    resetPreview();
    const text = area.value.trim();
    const run = ++inspecting;
    if (!text) return say("");
    const r = decodeTransfer(text);
    if (!r.ok) return say(r.reason, "error");
    const data = r.data;
    if (data.id === getPlayerId()) return say("C'est le code de cet appareil : tu es déjà ce profil.", "ok");
    const asked = host.fetchProfile(data.id);
    if (!asked) return say("Pas de serveur ici : impossible de charger un code.", "error");
    say("Recherche du profil…");
    const answer = await asked;
    if (run !== inspecting) return; // le code a changé pendant l'attente
    let found: { name: string | null; stats: ProfileStats; onServer: boolean };
    if (answer.ok) {
      found = { name: answer.data.name, stats: answer.data.stats, onServer: true };
    } else if (answer.code === "code_revoked") {
      return say("Ce code n'est plus valide : il a été remplacé. Demande le nouveau code à l'appareil qui l'a changé.", "error");
    } else if (answer.code === "unknown_player" && data.version === 1 && Object.keys(data.best).length > 0) {
      // Ancien code d'un profil que le serveur ne connaît pas encore : ses records du jour lui seront envoyés (il les rejoue), le reste est ignoré.
      found = { name: data.name, stats: profileStats(playedFromRecords(data.best), new Map(Object.entries(data.ranks ?? {})), host.today), onServer: false };
    } else if (answer.code === "unknown_player") {
      return say("Ce code ne correspond à aucun profil connu du serveur. Vérifie que tu l'as copié en entier.", "error");
    } else {
      return say(answer.status === 0 ? "Impossible de joindre le serveur : réessaie dans un moment." : answer.message, "error");
    }
    say("");
    pending = { data, name: found.name };
    const current = getName();
    const go = button("Prendre ce profil", "primary tr-apply");
    const cancel = button("Annuler", "tr-cancel");
    const actions = el("div", "actions");
    actions.append(go, cancel);
    preview.replaceChildren(
      el("div", "found", `Profil trouvé : ${found.name ? `« ${found.name} »` : "sans pseudo"}`),
      statGrid(found.stats),
      el("p", "line", `Cet appareil jouera désormais sous ce profil. Ton identité actuelle${current ? ` (« ${current} »)` : ""} et ses records gardés ici seront remplacés. Si tu n'as pas copié ton code actuel, tu ne pourras plus retrouver ton profil actuel.${found.onServer ? "" : " Ce profil n'est pas encore sur le serveur : ses temps du jour lui seront envoyés pour validation."}`),
      actions,
    );
    preview.hidden = false;
    cancel.addEventListener("click", () => {
      resetPreview();
      area.value = "";
      say("Rien n'a changé.");
    });
    go.addEventListener("click", async () => {
      if (!pending) return;
      const { data: chosen, name } = pending;
      go.disabled = true;
      // Un record d'aujourd'hui que le serveur n'a pas (fait hors ligne, ou sous un pseudo refusé) suit le joueur : il sera envoyé au nom du profil chargé.
      const keep = pendingTrackIds(storage, host.today);
      if (!applyIdentity({ id: chosen.id, name }, storage, keep)) {
        resetPreview();
        return say("Le navigateur refuse d'écrire (navigation privée ou stockage plein) : rien n'a changé.", "error");
      }
      // Lot P4 : les autres jeux de la plateforme (DailyJump) videront leur cache de l'ancienne identité à leur prochain démarrage.
      noteCodeLoaded(storage);
      if (chosen.version === 1 && host.submitLegacy) await host.submitLegacy(chosen.id, found.onServer ? null : chosen.name, legacyReplays(chosen));
      resetPreview();
      area.value = "";
      say("Profil chargé. Rechargement…", "ok");
      host.sync.reset();
      host.onChange?.();
      setTimeout(reload, 700);
    });
  }
  area.addEventListener("input", () => void inspect());
  pasteBtn.addEventListener("click", async () => {
    try {
      const text = ((await navigator.clipboard?.readText?.()) ?? "").trim();
      if (text) {
        area.value = text;
        return void inspect();
      }
    } catch {
      /* lecture refusée : on demande de coller à la main */
    }
    area.focus();
    say("Colle le code dans la zone ci-dessus (appui long, puis Coller).", "error");
  });

  refresh();
  return { root, refresh, showLoad: openLoad };
}

export { flashLabel };
