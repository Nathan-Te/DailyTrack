import { formatDelta, formatTime } from "./format";
import type { SalonBoard, SalonRow } from "./salonApi";
import { podiumRows } from "./salon";

// DOM du Salon (lot 26) : classement de la session, podium, résumé d'arrivée. Aucune logique de jeu ici (voir `salon.ts`).

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** Lignes à montrer : les premières, puis ton entourage, avec « … » là où des places manquent. */
export function visibleRows(board: Pick<SalonBoard, "rows">): (SalonRow | "gap")[] {
  const out: (SalonRow | "gap")[] = [];
  let last = 0;
  for (const r of [...board.rows].sort((a, b) => a.rank - b.rank)) {
    if (last > 0 && r.rank > last + 1) out.push("gap");
    out.push(r);
    last = r.rank;
  }
  return out;
}

/** Remplit le panneau de classement de la session (`#board`). */
export function renderSalonBoard(box: HTMLElement, board: SalonBoard | null, label: string): void {
  const title = el("div", "title");
  box.classList.add("salon");
  if (!board) {
    title.textContent = `Salon ${label} · classement en chargement…`;
    box.replaceChildren(title);
    return;
  }
  title.textContent = board.participants === 0 ? `Salon ${label} · personne n'a encore de temps` : `Salon ${label} · ${board.participants} classé${board.participants > 1 ? "s" : ""} · ${board.players} présent${board.players > 1 ? "s" : ""}`;
  const rows = visibleRows(board).map((r) => {
    if (r === "gap") return el("div", "gap", "…");
    const d = el("div", r.mine ? "row me" : "row");
    d.append(el("span", "rank", String(r.rank)), el("span", "who", r.name), el("span", "time", formatTime(r.ms)), el("span", "icon", r.rank === 1 ? "" : formatDelta(r.gap)));
    return d;
  });
  box.replaceChildren(title, ...rows);
}

export interface PodiumView {
  label: string;
  board: SalonBoard | null;
  /** Ton meilleur temps de la session et ta place (si tu en as une). */
  mine: { ms: number; rank: number; participants: number } | null;
  shareLine: string | null;
  secondsLeft: number;
  onCopy?: (b: HTMLButtonElement) => void;
}

const MEDALS = ["🥇", "🥈", "🥉"];

/** Remplit le podium de fin de session (`#podium`). */
export function renderPodium(box: HTMLElement, v: PodiumView): void {
  const title = el("div", "title", `Salon ${v.label} · terminé`);
  const list = el("div", "places");
  const top = v.board ? podiumRows(v.board) : [];
  if (top.length === 0) list.append(el("div", "none", v.board ? "Personne n'a terminé de tour." : "Classement indisponible."));
  top.forEach((r, i) => {
    const d = el("div", r.mine ? "place me" : "place");
    d.append(el("span", "medal", MEDALS[i]!), el("span", "who", r.name), el("span", "time", formatTime(r.ms)));
    list.append(d);
  });
  const children: HTMLElement[] = [title, list];
  if (v.mine) children.push(el("div", "mine", `Ta place : ${v.mine.rank}${v.mine.rank === 1 ? "er" : "e"} sur ${v.mine.participants} · ${formatTime(v.mine.ms)}`));
  else children.push(el("div", "mine", "Tu n'as pas de temps dans cette session."));
  if (v.shareLine) {
    const share = el("div", "share", v.shareLine);
    children.push(share);
    if (v.onCopy) {
      const b = el("button", "", "Copier le résultat");
      b.type = "button";
      b.addEventListener("click", () => v.onCopy!(b));
      children.push(b);
    }
  }
  children.push(el("div", "next", `Circuit suivant dans ${Math.max(0, Math.ceil(v.secondsLeft))} s…`));
  box.replaceChildren(...children);
}
