<template>
  <main class="editor-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">LOCAL TOOL · 公開画面には含まれません</p>
        <h1>やこび姫 定跡編集</h1>
        <p>先後の応手を盤上で入力し、根拠と一緒に検証可能なJSONへ保存します。</p>
      </div>
      <div class="header-actions">
        <button type="button" class="secondary" @click="saveDraft">下書き保存</button>
        <button type="button" class="primary" @click="exportJson">JSONを書き出す</button>
        <label class="file-button">JSONを読み込む<input type="file" accept="application/json,.json" @change="importJson" /></label>
      </div>
    </header>

    <section class="editor-grid">
      <aside class="panel settings-panel">
        <h2>定跡の情報</h2>
        <label>既存データ
          <select v-model="selectedDefinitionKey" @change="loadDefinition">
            <option value="new">新規作成</option>
            <optgroup label="戦法">
              <option v-for="item in strategies" :key="`strategy:${item.id}`" :value="`strategy:${item.id}`">{{ item.label }}</option>
            </optgroup>
            <optgroup label="囲い">
              <option v-for="item in castles" :key="`castle:${item.id}`" :value="`castle:${item.id}`">{{ item.label }}</option>
            </optgroup>
          </select>
        </label>
        <div class="two-columns">
          <label>種類<select v-model="book.kind"><option value="strategy">戦法</option><option value="castle">囲い</option></select></label>
          <label>対象<select v-model="book.side"><option value="black">先手</option><option value="white">後手</option><option value="both">先後共通</option></select></label>
        </div>
        <label>ID<input v-model.trim="book.id" pattern="[a-z0-9-]+" /></label>
        <label>名称<input v-model.trim="book.label" /></label>
        <label>開始局面（SFEN）<textarea v-model.trim="book.initialSfen" rows="3" @change="cursor = 0" /></label>
        <label>既存の案内手（先手基準・1行1手）
          <textarea :value="guideMovesText" rows="7" spellcheck="false" @input="setGuideMoves" />
        </label>
        <p class="hint">ここは現行のやこび姫が使う手順です。右の実戦分岐は相手の応手も含めて交互に入力します。</p>
      </aside>

      <section class="board-column">
        <div class="turn-banner"><span>{{ turnLabel }}</span><strong>{{ cursor + 1 }}手目を入力</strong></div>
        <div class="board-wrap">
          <ShogiMatchBoard
            :sfen="currentSfen"
            :last-move="lastMove"
            :flip="book.side === 'white'"
            asset-base-url="."
            layout="standard"
            @usi-move="appendMove"
          />
        </div>
        <div class="move-actions">
          <button type="button" :disabled="cursor === 0" @click="undo">1手戻す</button>
          <button type="button" :disabled="cursor >= activeBranch.moves.length" @click="cursor++">1手進む</button>
          <button type="button" @click="branchHere">この局面から分岐</button>
          <button type="button" class="danger" :disabled="book.branches.length === 1" @click="removeBranch">分岐を削除</button>
        </div>
        <p v-if="replayError" class="message error">{{ replayError }}</p>
      </section>

      <aside class="panel branch-panel">
        <div class="panel-heading"><h2>実戦分岐</h2><button type="button" @click="branchHere">＋</button></div>
        <label>分岐<select v-model.number="activeBranchIndex" @change="cursor = activeBranch.moves.length"><option v-for="(branch, index) in book.branches" :key="branch.id + index" :value="index">{{ branch.label || branch.id }}</option></select></label>
        <div class="two-columns"><label>分岐ID<input v-model.trim="activeBranch.id" /></label><label>表示名<input v-model.trim="activeBranch.label" /></label></div>
        <ol class="move-list">
          <li v-for="(move, index) in activeBranch.moves" :key="`${index}:${move.usi}`" :class="{ current: index + 1 === cursor }">
            <button type="button" @click="cursor = index + 1"><span>{{ index + 1 }}.</span><strong>{{ move.usi }}</strong><small>{{ index % 2 ? '後手' : '先手' }}</small></button>
            <input v-model="move.note" aria-label="指し手メモ" placeholder="この手の意味・条件" />
          </li>
        </ol>
        <p v-if="!activeBranch.moves.length" class="empty">盤上で初手を指してください。</p>
      </aside>
    </section>

    <section class="bottom-grid">
      <div class="panel">
        <div class="panel-heading"><h2>出典</h2><button type="button" @click="addSource">＋ 追加</button></div>
        <div v-for="(source, index) in book.sources" :key="index" class="source-row">
          <input v-model.trim="source.title" placeholder="ページ名（例: 将棋の戦法一覧）" aria-label="出典ページ名" />
          <input v-model.trim="source.url" type="url" placeholder="https://..." aria-label="出典URL" />
          <input v-model="source.checkedAt" type="date" aria-label="確認日" />
          <button type="button" class="icon danger" @click="book.sources.splice(index, 1)">削除</button>
        </div>
        <label>検証メモ<textarea v-model="book.notes" rows="4" placeholder="採用した形、相手の応手条件、未確認事項など" /></label>
        <div class="engine-review">
          <label class="check-label"><input v-model="book.engineReview.checked" type="checkbox" /> 評価値を確認済み</label>
          <input v-model="book.engineReview.note" placeholder="探索条件・評価値・危険な分岐のメモ" aria-label="エンジン確認メモ" />
        </div>
      </div>
      <div class="panel validation-panel">
        <h2>自動検査</h2>
        <p :class="validation.valid ? 'status ok' : 'status ng'">{{ validation.valid ? 'JSONとして保存できます' : `${validation.errors.length}件の修正が必要です` }}</p>
        <ul v-if="validation.errors.length" class="issues errors"><li v-for="item in validation.errors" :key="item">{{ item }}</li></ul>
        <ul v-if="validation.warnings.length" class="issues warnings"><li v-for="item in validation.warnings" :key="item">{{ item }}</li></ul>
        <p v-if="!validation.errors.length && !validation.warnings.length" class="all-clear">合法手・手番・分岐・出典の検査を通過しました。</p>
      </div>
    </section>
    <p v-if="toast" class="toast" role="status">{{ toast }}</p>
  </main>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import ShogiMatchBoard from "../ShogiMatchBoard.vue";
import { STANDARD_SFEN } from "../game-state";
import { OPENING_CASTLES, OPENING_STRATEGIES } from "../core/opening-guide.mjs";
import { createOpeningBookDraft, OPENING_BOOK_STORAGE_KEY, parseOpeningBook, replayOpeningBranch, serializeOpeningBook, validateOpeningBook } from "../core/opening-book-editor.mjs";

const strategies = OPENING_STRATEGIES;
const castles = OPENING_CASTLES;
const stored = localStorage.getItem(OPENING_BOOK_STORAGE_KEY);
const initial = stored ? safeParse(stored) : null;
const book = reactive<any>(normalize(initial ?? createOpeningBookDraft({ initialSfen: STANDARD_SFEN })));
const selectedDefinitionKey = ref("new");
const activeBranchIndex = ref(0);
const cursor = ref(book.branches?.[0]?.moves?.length ?? 0);
const toast = ref("");
let toastTimer = 0;

const activeBranch = computed(() => book.branches[activeBranchIndex.value] ?? book.branches[0]);
const replay = computed(() => replayOpeningBranch(book, activeBranch.value, cursor.value));
const currentSfen = computed(() => replay.value.position?.sfen ?? STANDARD_SFEN);
const replayError = computed(() => replay.value.error);
const lastMove = computed(() => cursor.value ? activeBranch.value.moves[cursor.value - 1]?.usi ?? "" : "");
const turnLabel = computed(() => currentSfen.value.split(" ")[1] === "w" ? "後手番" : "先手番");
const validation = computed(() => validateOpeningBook(book));
const guideMovesText = computed(() => (book.guideMoves ?? []).join("\n"));

function safeParse(text: string) { try { return parseOpeningBook(text); } catch { return null; } }
function normalize(value: any) {
  const fallback = createOpeningBookDraft({ initialSfen: STANDARD_SFEN });
  return { ...fallback, ...value, guideMoves: Array.isArray(value?.guideMoves) ? value.guideMoves : [], sources: Array.isArray(value?.sources) ? value.sources : fallback.sources, branches: Array.isArray(value?.branches) && value.branches.length ? value.branches : fallback.branches, engineReview: { ...fallback.engineReview, ...value?.engineReview } };
}
function announce(message: string) { toast.value = message; window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.value = "", 2600); }
function replaceBook(next: any) { Object.keys(book).forEach((key) => delete book[key]); Object.assign(book, normalize(next)); activeBranchIndex.value = 0; cursor.value = book.branches[0]?.moves?.length ?? 0; }
function loadDefinition() {
  if (selectedDefinitionKey.value === "new") { replaceBook(createOpeningBookDraft({ initialSfen: STANDARD_SFEN })); return; }
  const [kind, id] = selectedDefinitionKey.value.split(":");
  const definition = (kind === "castle" ? castles : strategies).find((item: any) => item.id === id);
  replaceBook(createOpeningBookDraft({ definition, kind, initialSfen: STANDARD_SFEN }));
  announce(`${definition.label}の現行案内手を取り込みました。`);
}
function setGuideMoves(event: Event) { book.guideMoves = (event.target as HTMLTextAreaElement).value.split(/\s+/).filter(Boolean); }
function appendMove(event: CustomEvent | string) {
  const usi = typeof event === "string" ? event : event.detail ?? event;
  if (replayError.value) return announce("不正な手順を先に修正してください。");
  const move = replay.value.position?.createMoveByUSI(String(usi));
  if (!move || !replay.value.position?.isValidMove(move)) return announce("その手は現在の局面では指せません。");
  activeBranch.value.moves.splice(cursor.value, activeBranch.value.moves.length - cursor.value, { usi: String(usi), note: "" });
  cursor.value += 1;
}
function undo() { if (cursor.value > 0) { activeBranch.value.moves.splice(cursor.value - 1, 1); cursor.value -= 1; } }
function branchHere() {
  const number = book.branches.length + 1;
  book.branches.push({ id: `branch-${number}`, label: `変化${number}`, moves: activeBranch.value.moves.slice(0, cursor.value).map((move: any) => ({ ...move })) });
  activeBranchIndex.value = book.branches.length - 1;
  announce("現在局面から新しい分岐を作りました。");
}
function removeBranch() { if (book.branches.length > 1) { book.branches.splice(activeBranchIndex.value, 1); activeBranchIndex.value = 0; cursor.value = activeBranch.value.moves.length; } }
function addSource() { book.sources.push({ title: "", url: "", checkedAt: new Date().toISOString().slice(0, 10) }); }
function saveDraft() { localStorage.setItem(OPENING_BOOK_STORAGE_KEY, serializeOpeningBook(book)); announce("このブラウザに下書きを保存しました。"); }
function exportJson() {
  if (!validation.value.valid) return announce("赤い検査項目を修正してから書き出してください。");
  const blob = new Blob([serializeOpeningBook(book)], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${book.id}.opening.json`; link.click(); URL.revokeObjectURL(link.href);
  announce("JSONを書き出しました。");
}
async function importJson(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
  try { const next = parseOpeningBook(await file.text()); replaceBook(next); selectedDefinitionKey.value = "new"; announce("JSONを読み込みました。"); }
  catch (error) { announce(`読み込み失敗: ${error instanceof Error ? error.message : error}`); }
  input.value = "";
}
</script>
