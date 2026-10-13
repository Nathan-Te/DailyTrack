// Carte du profil (lot 29) : pseudo modifiable, statistiques (jours joués, série, meilleure place, médailles) et code de transfert (copier mon
// code / charger un code). Montée à l'accueil et dans Réglages › Profil. Le DOM seulement : la logique est dans profile.ts et transfer.ts.
import { copyText } from "./clipboard";
import { button, el, flashLabel } from "./dom";
import { getName, getPlayerId, isValidName, normalizeName } from "./identity";
import { dayShort, listPlayedDays, loadRanks, playedFromRecords, profileStats, type ProfileStats } from "./profile";
import { MEDAL_ICON, ordinal } from "./share";
import { applyTransfer, collectTransfer, decodeTransfer, describeTransfer, encodeTransfer, type TransferData } from "./transfer";

export interface ProfileHost {
  /** Jour affiché comme « aujourd'hui » (AAAA-MM-JJ) : la série se compte jusque-là. */
  today: string;
  /** Change le pseudo (local ; et sur le serveur s'il y a déjà un joueur classé). Rend le pseudo retenu. */
  rename(name: string): Promise<string>;
  /** Recharge la page après un remplacement d'identité (injectable pour les tests unitaires). */
  reload?: () => void;
  storage?: Storage;
  /** Appelé quand le pseudo ou l'identité ont changé (l'accueil se redessine). */
  onChange?(): void;
}

export interface ProfileCard {
  root: HTMLElement;
  /** Relit le pseudo et les statistiques. */
  refresh(): void;
}

const MEDAL_ORDER = ["author", "gold", "silver", "bronze"] as const;
const MEDAL_WORD = { author: "Auteur", gold: "Or", silver: "Argent", bronze: "Bronze" } as const;

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

export function mountProfileCard(host: ProfileHost): ProfileCard {
  const storage = host.storage ?? localStorage;
  const reload = host.reload ?? (() => location.reload());
  const root = el("section", "profile");
  root.setAttribute("aria-label", "Ton profil");

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
  nameForm.append(nameLabel, input, save);
  nameLabel.append(); // l'intitulé est lu avec le champ

  const stats = el("div", "statsbox");

  // --- Code de transfert ---
  const tools = el("div", "actions");
  const copy = button("Copier mon code", "tr-copy");
  const load = button("Charger un code", "tr-load");
  tools.append(copy, load);
  const warn = el("p", "warn", "Ce code donne accès à ton profil : ne le partage pas.");
  const loadBox = el("div", "loadbox");
  loadBox.hidden = true;
  const area = el("textarea", "tr-code");
  area.rows = 3;
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

  root.append(el("h3", "", "Ton profil"), nameForm, nameMsg, stats, tools, warn, msg, loadBox);

  let pending: TransferData | null = null;
  const say = (text: string, kind: "ok" | "error" | "" = "") => {
    msg.textContent = text;
    msg.className = `msg tr-msg ${kind}`;
  };
  const sayName = (text: string, kind: "ok" | "error" | "" = "") => {
    nameMsg.textContent = text;
    nameMsg.className = `msg ${kind}`;
  };

  function refresh() {
    const name = getName();
    if (document.activeElement !== input) input.value = name ?? "";
    stats.replaceChildren(statGrid(profileStats(listPlayedDays(storage), loadRanks(storage), host.today)));
  }

  nameForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = normalizeName(input.value);
    if (!isValidName(name)) return sayName("1 à 20 caractères : lettres, chiffres, espace . _ ' -", "error");
    save.disabled = true;
    try {
      const kept = await host.rename(name);
      input.value = kept;
      sayName(`Pseudo enregistré : ${kept}`, "ok");
      host.onChange?.();
    } finally {
      save.disabled = false;
    }
  });

  copy.addEventListener("click", async () => {
    resetPreview();
    getPlayerId(); // crée l'identité si elle n'existe pas encore
    const data = collectTransfer(storage);
    if (!data) return say("Impossible de lire ton identité dans ce navigateur (stockage bloqué ?).", "error");
    const code = encodeTransfer(data);
    if (await copyText(code)) {
      area.value = ""; // le code n'est pas affiché : on ne le met pas sous les yeux de qui regarde l'écran
      say(`Code copié (${describeTransfer(data)}). Garde-le pour toi : il donne accès à ton profil. Pour jouer ailleurs sous le même nom, touche « Charger un code » sur l'autre appareil.`, "ok");
    } else {
      loadBox.hidden = false;
      area.value = code; // le navigateur refuse le presse-papiers : on le montre pour le copier à la main
      area.select();
      say("Copie automatique impossible : le code est affiché, sélectionne-le et copie-le.", "error");
    }
  });

  load.addEventListener("click", () => {
    loadBox.hidden = !loadBox.hidden;
    resetPreview();
    say("");
    if (!loadBox.hidden) area.focus();
  });

  function resetPreview() {
    pending = null;
    preview.hidden = true;
    preview.replaceChildren();
  }

  /** Lit le code collé : s'il est valide, montre le profil trouvé et demande confirmation. */
  function inspect() {
    resetPreview();
    const text = area.value.trim();
    if (!text) return say("");
    const r = decodeTransfer(text);
    if (!r.ok) return say(r.reason, "error");
    say("");
    pending = r.data;
    const found = profileStats(playedFromRecords(r.data.best), new Map(Object.entries(r.data.ranks ?? {})), host.today);
    const current = getName();
    const sameId = r.data.id === getPlayerId();
    const go = button("Remplacer mon identité", "primary tr-apply");
    const cancel = button("Annuler", "tr-cancel");
    const actions = el("div", "actions");
    actions.append(go, cancel);
    preview.replaceChildren(
      el("div", "found", `Profil trouvé : ${r.data.name ? `« ${r.data.name} »` : "sans pseudo"}`),
      statGrid(found),
      el("p", "line", sameId ? "C'est le profil de ce navigateur : seuls tes records seraient remplacés." : `Ton identité actuelle${current ? ` (« ${current} »)` : ""} et tes records locaux des circuits du jour seront remplacés. Si tu n'as pas copié ton code actuel, tu ne pourras plus retrouver ton profil actuel.`),
      actions,
    );
    preview.hidden = false;
    cancel.addEventListener("click", () => {
      resetPreview();
      area.value = "";
      say("Rien n'a changé.");
    });
    go.addEventListener("click", () => {
      if (!pending) return;
      if (!applyTransfer(pending, storage)) {
        resetPreview();
        return say("Le navigateur refuse d'écrire (navigation privée ou stockage plein) : rien n'a changé.", "error");
      }
      resetPreview();
      area.value = "";
      say("Identité remplacée. Rechargement…", "ok");
      host.onChange?.();
      setTimeout(reload, 700);
    });
  }
  area.addEventListener("input", inspect);
  pasteBtn.addEventListener("click", async () => {
    try {
      const text = ((await navigator.clipboard?.readText?.()) ?? "").trim();
      if (text) {
        area.value = text;
        return inspect();
      }
    } catch {
      /* lecture refusée : on demande de coller à la main */
    }
    area.focus();
    say("Colle le code dans la zone ci-dessus (appui long, puis Coller).", "error");
  });

  refresh();
  return { root, refresh };
}

export { flashLabel };
