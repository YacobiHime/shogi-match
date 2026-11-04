<template>
  <!--
    ノベルの台本の試し読み(開発用。配布物には入らない)。左に台本、右に検査の結果と演出の早見表。
    「再生」で本物のNovelScene.vueで読む。台本はファイルに保存しない(ブラウザに下書きだけ残す)。
  -->
  <div class="ne">
    <header class="ne__head">
      <h1 class="ne__title">ノベルの台本 試し読み</h1>
      <div class="ne__actions">
        <label class="ne__load">
          <span>読み込む</span>
          <select v-model="loadId" data-ne-load @change="loadLibrary">
            <option value="">台本のファイルを選ぶ</option>
            <option v-for="id in libraryIds" :key="id" :value="id">{{ id }}.md</option>
          </select>
        </label>
        <button type="button" class="ne__button" data-ne-copy @click="copy">{{ copied ? "コピーした" : "コピー" }}</button>
        <button type="button" class="ne__button" :disabled="!playable" data-ne-play-here @click="play(true)">この行から</button>
        <button type="button" class="ne__button ne__button--go" :disabled="!playable" data-ne-play @click="play(false)">再生</button>
      </div>
    </header>
    <main class="ne__body">
      <section class="ne__editor" aria-label="台本">
        <textarea
          ref="area"
          v-model="text"
          class="ne__area"
          spellcheck="false"
          data-ne-text
          @keyup="trackCursor"
          @click="trackCursor"
        />
        <p class="ne__status">{{ cursorLine }}行目 ・ 本文{{ result.scene.lines.length }}行 ・ {{ counts }}</p>
      </section>
      <aside class="ne__side">
        <section class="ne__panel" aria-label="検査の結果" data-ne-problems>
          <h2>検査</h2>
          <p v-if="!result.problems.length" class="ne__ok">まちがいも注意もありません。</p>
          <ul v-else class="ne__problems">
            <li v-for="(problem, at) in result.problems" :key="at" :class="`ne__problem--${problem.level}`">
              <button type="button" class="ne__jump" :disabled="!problem.line" @click="jump(problem.line)">
                <b>{{ problem.line ?? "―" }}</b>
                <span>{{ problem.level === "error" ? "まちがい" : "注意" }}</span>
                {{ problem.message }}
              </button>
            </li>
          </ul>
        </section>
        <section class="ne__panel" aria-label="演出の早見表">
          <h2>早見表 <small>(くわしくは docs/novel-authoring-guide.md)</small></h2>
          <dl class="ne__sheet">
            <template v-for="group in cheatSheet" :key="group.title">
              <dt>{{ group.title }}</dt>
              <dd>
                <code v-for="item in group.items" :key="item.code" :title="item.note">{{ item.code }}</code>
              </dd>
            </template>
          </dl>
        </section>
      </aside>
    </main>
    <NovelScene
      v-if="playing"
      ref="novel"
      :key="playKey"
      :scene="playing.scene"
      :start-at="playing.startAt"
      asset-base-url=""
      @done="stop"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import NovelScene from "../NovelScene.vue";
import { parseNovelScript } from "../core/novel-script.mjs";
import {
  BACKGROUND_LABELS, NOVEL_ACTS, NOVEL_CHARACTERS, NOVEL_EMOTES, NOVEL_SCREEN, NOVEL_TEXT_STYLES, NOVEL_TONES, fillScene,
} from "../core/novel-direction.mjs";
import { SFX } from "../core/novel-sound.mjs";
import { SAMPLE_SCENE_ID, librarySceneIds, libraryScript } from "../core/novel-library.mjs";

/** 下書きの保存(このページだけ。ゲームの保存とは別)。 */
const DRAFT = "novel-editor-draft";
const readDraft = () => {
  try {
    return localStorage.getItem(DRAFT);
  } catch {
    return null;
  }
};

const libraryIds = librarySceneIds();
const text = ref(readDraft() ?? libraryScript(SAMPLE_SCENE_ID));
const loadId = ref("");
const area = ref<HTMLTextAreaElement | null>(null);
const novel = ref<{ goBack: () => boolean } | null>(null);
const cursorLine = ref(1);
const copied = ref(false);
const playKey = ref(0);
const playing = ref<{ scene: any; startAt: number } | null>(null);

const result = computed(() => parseNovelScript(text.value));
const errorCount = computed(() => result.value.problems.filter((problem) => problem.level === "error").length);
const counts = computed(() => `まちがい${errorCount.value}件・注意${result.value.problems.length - errorCount.value}件`);
/** まちがいがあっても、行があれば読める(どこがおかしいか見るため)。 */
const playable = computed(() => result.value.scene.lines.length > 0);

watch(text, (value) => {
  try {
    localStorage.setItem(DRAFT, value);
  } catch {
    // 残せなくても書ける。
  }
  copied.value = false;
});

/** 早見表(語彙の表から作るので、いつもエンジンとそろう)。 */
const cheatSheet = computed(() => {
  const named = (table: Record<string, { label: string; use?: string; aliases?: readonly string[] }>) =>
    Object.entries(table).map(([id, entry]) => ({ code: `[${entry.aliases?.[0] ?? entry.label}]`, note: `${id}${entry.use ? `：${entry.use}` : ""}` }));
  return [
    {
      title: "人物と表情",
      items: Object.values(NOVEL_CHARACTERS).filter((person) => person.id !== "narration").map((person) => ({
        code: `${person.label}(${person.faces.join("|")}):`,
        note: person.note,
      })),
    },
    { title: "動き", items: named(NOVEL_ACTS) },
    { title: "漫符", items: named(NOVEL_EMOTES) },
    { title: "画面", items: named(NOVEL_SCREEN) },
    { title: "色", items: named(NOVEL_TONES) },
    { title: "文", items: named(NOVEL_TEXT_STYLES) },
    { title: "背景", items: Object.entries(BACKGROUND_LABELS).map(([id, label]) => ({ code: `[bg:${id}]`, note: label })) },
    { title: "効果音", items: Object.entries(SFX).map(([id, entry]) => ({ code: `[sfx:${id}]`, note: `${entry.label}：${entry.use}` })) },
    {
      title: "そのほか",
      items: [
        { code: "[enter:right]", note: "話す人が右から登場(left・fadeも)" },
        { code: "[exit]", note: "言い終えてから退場" },
        { code: "[百花:うなずく]", note: "ほかの人の動き・漫符・表情" },
        { code: "[間:600]", note: "文が出るまで待つ(ミリ秒)" },
        { code: "- 答え {値}", note: "選択肢。返しは2つ下げて書く" },
      ],
    },
  ];
});

function trackCursor() {
  const el = area.value;
  if (!el) return;
  cursorLine.value = el.value.slice(0, el.selectionStart).split("\n").length;
}

function jump(line: number | null) {
  const el = area.value;
  if (!el || !line) return;
  const rows = el.value.split("\n");
  const start = rows.slice(0, line - 1).reduce((sum, row) => sum + row.length + 1, 0);
  el.focus();
  el.setSelectionRange(start, start + (rows[line - 1]?.length ?? 0));
  cursorLine.value = line;
}

function play(fromCursor: boolean) {
  const scene = fillScene(result.value.scene, { playerName: "やこび", vars: Object.fromEntries((result.value.scene.vars ?? []).map((name: string) => [name, `【${name}】`])) });
  if (!scene?.lines.length) return;
  let startAt = 0;
  if (fromCursor) {
    const at = scene.lines.findIndex((line: any) => (line.src ?? 0) >= cursorLine.value);
    startAt = at < 0 ? scene.lines.length - 1 : at;
  }
  playKey.value += 1;
  playing.value = { scene: { ...scene, id: scene.id || "draft", title: scene.title || "（題名なし）" }, startAt };
}

function stop() {
  playing.value = null;
  area.value?.focus();
}

function loadLibrary() {
  if (!loadId.value) return;
  text.value = libraryScript(loadId.value);
  loadId.value = "";
}

async function copy() {
  try {
    await navigator.clipboard.writeText(text.value);
    copied.value = true;
  } catch {
    area.value?.select();
  }
}

/** 再生中のEsc: 場面のシートを先に閉じ、なければ試し読みを止める。 */
function onKey(event: KeyboardEvent) {
  if (event.key !== "Escape" || !playing.value) return;
  if (!novel.value?.goBack()) stop();
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<style>
body { margin: 0; background: #1d303f; color: #fffcf4; font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; }
.ne { display: grid; grid-template-rows: auto minmax(0, 1fr); height: 100vh; }
.ne__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.6rem; padding: 0.6rem 1rem; border-bottom: 1px solid rgba(255, 252, 244, 0.2); }
.ne__title { margin: 0; font-size: 1.1rem; }
.ne__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.ne__load { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; }
.ne__load select { min-height: 36px; border-radius: 8px; font: inherit; }
.ne__button { min-height: 40px; padding: 0 1rem; border: 2px solid rgba(255, 252, 244, 0.4); border-radius: 999px; color: inherit; background: transparent; font: inherit; font-weight: 800; cursor: pointer; }
.ne__button--go { border-color: #f1a54c; background: #f1a54c; color: #1f2a33; }
.ne__button:disabled { opacity: 0.45; cursor: default; }
.ne__button:focus-visible, .ne__jump:focus-visible { outline: 3px solid #f1a54c; outline-offset: 2px; }
.ne__body { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 0.8rem; min-height: 0; padding: 0.8rem 1rem; }
.ne__editor { display: grid; grid-template-rows: minmax(0, 1fr) auto; min-height: 0; }
.ne__area { width: 100%; height: 100%; box-sizing: border-box; padding: 0.8rem; border: 0; border-radius: 10px; color: #1f2a33; background: #fbf7ee; font: 15px/1.7 "Courier New", "Hiragino Kaku Gothic ProN", monospace; resize: none; tab-size: 2; }
.ne__status { margin: 0.3rem 0 0; color: #b9c6d0; font-size: 0.8rem; }
.ne__side { display: grid; grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); gap: 0.8rem; min-height: 0; }
.ne__panel { overflow: auto; padding: 0.6rem 0.8rem; border-radius: 10px; background: #243746; }
.ne__panel h2 { margin: 0 0 0.4rem; font-size: 0.95rem; }
.ne__panel h2 small { color: #b9c6d0; font-weight: 400; }
.ne__ok { margin: 0; color: #9fe0b4; font-weight: 800; }
.ne__problems { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.ne__jump { display: block; width: 100%; padding: 0.35rem 0.5rem; border: 0; border-left: 4px solid; border-radius: 6px; color: inherit; background: rgba(255, 252, 244, 0.06); font: inherit; font-size: 0.85rem; line-height: 1.5; text-align: left; cursor: pointer; }
.ne__jump b { margin-right: 0.4rem; }
.ne__jump span { margin-right: 0.4rem; font-weight: 800; }
.ne__problem--error .ne__jump { border-color: #ff8a73; }
.ne__problem--error .ne__jump span { color: #ff8a73; }
.ne__problem--warn .ne__jump { border-color: #f1a54c; }
.ne__problem--warn .ne__jump span { color: #f1a54c; }
.ne__sheet { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 0.35rem 0.6rem; margin: 0; font-size: 0.82rem; }
.ne__sheet dt { color: #f1a54c; font-weight: 800; }
.ne__sheet dd { display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0; }
.ne__sheet code { padding: 0.05rem 0.35rem; border-radius: 4px; background: rgba(255, 252, 244, 0.1); font-size: 0.8rem; }
@media (max-width: 860px) {
  .ne { height: auto; min-height: 100vh; }
  .ne__body { grid-template-columns: minmax(0, 1fr); }
  .ne__area { height: 60vh; }
  .ne__side { grid-template-rows: auto auto; }
}
</style>
