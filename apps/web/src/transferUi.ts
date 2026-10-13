// Fenêtre « Réglages » : le code de transfert (copier mon code / coller un code). Le DOM seulement ; la logique est dans transfer.ts.
import { copyText } from "./clipboard";
import { getName, getPlayerId } from "./identity";
import { applyTransfer, collectTransfer, decodeTransfer, describeTransfer, encodeTransfer, type TransferData } from "./transfer";

export interface TransferUiOptions {
  /** Recharge la page après un remplacement d'identité (injectable pour les tests unitaires). */
  reload?: () => void;
  storage?: Storage;
}

export interface TransferUi {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export function mountTransferUi(root: HTMLElement, options: TransferUiOptions = {}): TransferUi {
  const storage = options.storage ?? localStorage;
  const reload = options.reload ?? (() => location.reload());

  const panel = el("div", "panel");
  const head = el("div", "head");
  const close = el("button", "close", "✕");
  close.type = "button";
  close.setAttribute("aria-label", "Fermer");
  head.append(el("div", "title", "Réglages"), close);

  const who = el("div", "who");
  const intro = el("p", "intro", "Ton identité (pseudo et identifiant) et tes records restent dans ce navigateur. Pour jouer ailleurs sous le même nom, copie ton code ici et colle-le sur l'autre appareil. Rien n'est envoyé au serveur.");
  const copy = el("button", "primary", "Copier mon code");
  copy.type = "button";
  copy.id = "tr-copy";
  const warn = el("p", "warn", "Ce code contient ton identifiant secret : garde-le pour toi, comme un mot de passe.");
  const area = el("textarea");
  area.id = "tr-code";
  area.rows = 3;
  area.placeholder = "Colle ici un code de transfert…";
  area.setAttribute("aria-label", "Code de transfert à coller");
  area.autocomplete = "off";
  area.spellcheck = false;
  const paste = el("button", "", "Coller un code");
  paste.type = "button";
  paste.id = "tr-paste";
  const msg = el("div", "msg");
  msg.id = "tr-msg";
  msg.setAttribute("role", "status");
  const confirm = el("div", "confirm");
  confirm.id = "tr-confirm";
  confirm.hidden = true;
  panel.append(
    head,
    who,
    el("h3", "", "Code de transfert"),
    intro,
    copy,
    warn,
    area,
    paste,
    msg,
    confirm,
  );
  root.replaceChildren(panel);

  let pending: TransferData | null = null;

  const say = (text: string, kind: "ok" | "error" | "" = "") => {
    msg.textContent = text;
    msg.className = `msg ${kind}`;
  };
  const refresh = () => {
    const name = getName();
    who.textContent = name ? `Tu joues sous le pseudo « ${name} ».` : "Tu n'as pas encore choisi de pseudo (il se choisit à ton premier temps classé).";
  };
  const resetConfirm = () => {
    pending = null;
    confirm.hidden = true;
    confirm.replaceChildren();
  };

  copy.addEventListener("click", async () => {
    resetConfirm();
    getPlayerId(); // crée l'identité si elle n'existe pas encore
    const data = collectTransfer(storage);
    if (!data) return say("Impossible de lire ton identité dans ce navigateur (stockage bloqué ?).", "error");
    const code = encodeTransfer(data);
    area.value = ""; // le code n'est pas affiché : on ne le met pas sous les yeux de qui regarde l'écran
    const ok = await copyText(code);
    if (ok) say(`Code copié (${describeTransfer(data)}). Colle-le dans « Coller un code » sur l'autre appareil.`, "ok");
    else {
      area.value = code; // le navigateur refuse le presse-papiers : on le montre pour le copier à la main
      area.select();
      say("Copie automatique impossible : le code est affiché, sélectionne-le et copie-le.", "error");
    }
  });

  paste.addEventListener("click", async () => {
    resetConfirm();
    let text = area.value.trim();
    if (!text) {
      try {
        text = ((await navigator.clipboard?.readText?.()) ?? "").trim();
      } catch {
        /* lecture refusée : on demande de coller à la main */
      }
      if (!text) {
        area.focus();
        return say("Colle le code dans la zone ci-dessus, puis touche « Coller un code ».", "error");
      }
      area.value = text;
    }
    const r = decodeTransfer(text);
    if (!r.ok) return say(r.reason, "error");
    pending = r.data;
    const sameId = r.data.id === getPlayerId();
    say("");
    const current = getName();
    const lines = [
      el("div", "line", sameId ? "Ce code est celui de ce navigateur : rien ne changerait d'identité, seuls les records seraient remplacés." : `Ce navigateur va devenir l'appareil de ${r.data.name ? `« ${r.data.name} »` : "ce joueur"} (${describeTransfer(r.data)}).`),
      el("div", "line", `Ton identité actuelle${current ? ` (« ${current} »)` : ""} et tes records locaux des circuits du jour seront remplacés. Si tu n'as pas copié ton code actuel, tu ne pourras plus retrouver ta place au classement.`),
    ];
    const go = el("button", "primary", "Remplacer mon identité");
    go.type = "button";
    go.id = "tr-apply";
    const cancel = el("button", "", "Annuler");
    cancel.type = "button";
    cancel.id = "tr-cancel";
    const row = el("div", "actions");
    row.append(go, cancel);
    confirm.replaceChildren(...lines, row);
    confirm.hidden = false;
    cancel.addEventListener("click", () => {
      resetConfirm();
      say("Rien n'a changé.");
    });
    go.addEventListener("click", () => {
      if (!pending) return;
      if (!applyTransfer(pending, storage)) {
        resetConfirm();
        return say("Le navigateur refuse d'écrire (navigation privée ou stockage plein) : rien n'a changé.", "error");
      }
      resetConfirm();
      area.value = "";
      say("Identité remplacée. Rechargement…", "ok");
      setTimeout(reload, 700);
    });
  });

  const hide = () => {
    root.hidden = true;
    resetConfirm();
    area.value = "";
    say("");
  };
  close.addEventListener("click", hide);
  root.addEventListener("click", (e) => {
    if (e.target === root) hide();
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });
  return {
    open() {
      refresh();
      root.hidden = false;
      close.focus();
    },
    close: hide,
    isOpen: () => !root.hidden,
  };
}
