<template>
  <!--
    数字キー(docs/brain-training-design.mdの11-4)。0〜9・消す・決定を3×4に並べる。どのボタンも52px以上。
    キーボードの数字・Backspace・Enterでも押せる(パソコン)。
  -->
  <div class="brain-pad" role="group" aria-label="数字のキー" data-brain-pad>
    <button
      v-for="key in KEYS"
      :key="key.id"
      type="button"
      class="brain-pad__key"
      :class="{ 'brain-pad__key--sub': key.kind !== 'digit', 'brain-pad__key--submit': key.kind === 'submit' }"
      :disabled="disabled || (key.kind === 'submit' && !showSubmit)"
      :aria-label="key.aria"
      :data-pad-key="key.id"
      @click="press(key)"
    >{{ key.label }}</button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

type Key = { id: string; label: string; aria: string; kind: "digit" | "erase" | "submit" };

const props = defineProps({
  disabled: { type: Boolean, default: false },
  /** 決定のボタンを使うか(答えのけた数で自動で採点する種目でも、早く決めたいときに押せる)。 */
  showSubmit: { type: Boolean, default: true },
});
const emit = defineEmits<{
  (event: "digit", digit: string): void;
  (event: "erase"): void;
  (event: "submit"): void;
}>();

const digit = (value: string): Key => ({ id: value, label: value, aria: value, kind: "digit" });
const KEYS: Key[] = [
  digit("7"), digit("8"), digit("9"),
  digit("4"), digit("5"), digit("6"),
  digit("1"), digit("2"), digit("3"),
  { id: "erase", label: "消す", aria: "1文字消す", kind: "erase" },
  digit("0"),
  { id: "submit", label: "決定", aria: "決定", kind: "submit" },
];

function press(key: Key) {
  if (props.disabled) return;
  if (key.kind === "digit") emit("digit", key.id);
  else if (key.kind === "erase") emit("erase");
  else if (props.showSubmit) emit("submit");
}

function onKey(event: KeyboardEvent) {
  if (props.disabled || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
  if (/^[0-9]$/.test(event.key)) emit("digit", event.key);
  else if (event.key === "Backspace") emit("erase");
  else if (event.key === "Enter" && props.showSubmit) emit("submit");
  else return;
  event.preventDefault();
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<style>
.shogi-game .brain-pad {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  width: min(100%, 20rem);
}
.shogi-game .brain-pad__key {
  min-height: 56px;
  border: 2px solid #c9c2b0;
  border-radius: 0.8rem;
  color: #172632;
  background: #ffffff;
  box-shadow: 0 3px 0 #c9c2b0;
  font: inherit;
  font-size: 1.6rem;
  font-weight: 900;
  cursor: pointer;
  touch-action: manipulation;
}
.shogi-game .brain-pad__key--sub { font-size: 1rem; background: #f1ece0; }
.shogi-game .brain-pad__key--submit { color: #fffcf4; border-color: #2b465b; background: #2b465b; box-shadow: 0 3px 0 #172632; }
.shogi-game .brain-pad__key:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #c9c2b0; }
/* 押せないあいだも白いまま薄くする(全体のボタンの書式で暗くなると、1問ごとに点滅して見えるため)。 */
.shogi-game .brain-pad__key:disabled { color: #172632; border-color: #c9c2b0; background: #ffffff; box-shadow: 0 3px 0 #c9c2b0; opacity: 0.45; cursor: default; }
.shogi-game .brain-pad__key--sub:disabled { background: #f1ece0; }
.shogi-game .brain-pad__key--submit:disabled { color: #fffcf4; border-color: #2b465b; background: #2b465b; }
@media (hover: hover) {
  .shogi-game .brain-pad__key:not(:disabled):hover { border-color: #d9822b; background-color: #fff3dc; }
  .shogi-game .brain-pad__key--submit:not(:disabled):hover { background-color: #3c5f78; }
}
.shogi-game .brain-pad__key:focus-visible { outline: 3px solid #3c6dd1; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .brain-pad__key:active:not(:disabled) { transform: none; }
}
</style>
