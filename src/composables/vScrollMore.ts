import type { Directive } from "vue";

/*
 * 枠の中だけを動かす一覧に付ける印(docs/player-world-note-design.mdの8-3の「共通」)。
 * 下にまだ続きがあるあいだ、要素にdata-more="true"を付ける。見た目(下の端の影)はCSSで付ける。
 * 説明の文で「スクロールできます」と言わず、続きがあることを形で見せる(UD:6-1)。
 */
type Watched = HTMLElement & { __scrollMore?: { check: () => void; observer: ResizeObserver | null } };

function check(el: HTMLElement) {
  const more = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
  if ((el.dataset.more === "true") !== more) el.dataset.more = String(more);
}

export const vScrollMore: Directive<Watched> = {
  mounted(el) {
    const run = () => check(el);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(run);
    observer?.observe(el);
    for (const child of Array.from(el.children)) observer?.observe(child);
    el.addEventListener("scroll", run, { passive: true });
    el.__scrollMore = { check: run, observer };
    run();
  },
  updated(el) {
    const state = el.__scrollMore;
    if (!state) return;
    for (const child of Array.from(el.children)) state.observer?.observe(child);
    state.check();
  },
  unmounted(el) {
    const state = el.__scrollMore;
    if (!state) return;
    state.observer?.disconnect();
    el.removeEventListener("scroll", state.check);
    delete el.__scrollMore;
  },
};
