<template>
  <main class="editor-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">LOCAL TOOL · 公開画面には含まれません</p>
        <h1>やこび姫 定跡編集</h1>
        <p>先後の応手を盤上で入力し、根拠と一緒に検証可能なJSONへ保存します。</p>
      </div>
      <div class="header-actions">
        <span class="draft-save-status">{{ currentDraftSaved ? "この定跡は保存済み" : "この定跡は未保存" }}</span>
        <button type="button" class="secondary" @click="saveDraft">この定跡を保存</button>
        <button type="button" class="danger" :disabled="selectedDefinitionKey === 'new'" @click="deleteSelectedOpening">選択した定跡を削除</button>
        <button type="button" class="primary" @click="exportJson">この定跡をJSON保存</button>
        <label class="file-button">JSONを読み込む<input type="file" accept="application/json,.json" @change="importJson" /></label>
      </div>
    </header>

    <section class="editor-grid">
      <aside class="panel settings-panel">
        <h2>定跡の情報</h2>
        <label>既存データ
          <select v-model="selectedDefinitionKey" @change="loadDefinition">
            <option value="new">新規作成</option>
            <optgroup v-for="group in existingDefinitionGroups" :key="group.id" :label="group.label">
              <option v-for="item in group.items" :key="item.key" :value="item.key">{{ item.label }}{{ item.saved ? '（保存済み）' : '' }}</option>
            </optgroup>
          </select>
        </label>
        <div class="two-columns">
          <label>種類<select v-model="book.kind"><option value="strategy">戦法</option><option value="castle">囲い</option></select></label>
          <label>対象<select v-model="book.side"><option value="black">先手</option><option value="white">後手</option><option value="both">先後共通</option></select></label>
        </div>
        <div class="classification-settings">
          <strong>分類</strong>
          <template v-if="book.kind === 'strategy'">
            <label>戦法メニューの分類ID
              <input v-model.trim="book.classification.family" list="strategy-family-options" placeholder="例: ibisha" />
            </label>
            <datalist id="strategy-family-options"><option v-for="option in strategyFamilyOptions" :key="option.id" :value="option.id">{{ option.label }}</option></datalist>
          </template>
          <label v-else>囲いの系統ID<input v-model.trim="book.classification.family" list="castle-family-options" placeholder="例: mino" /></label>
          <datalist id="castle-family-options"><option v-for="family in castleFamilyOptions" :key="family" :value="family" /></datalist>
          <label>分類名
            <input v-model.trim="book.classification.name" placeholder="例: 居飛車/基本戦法" />
          </label>
          <label>飛車の分類
            <select v-model="book.classification.rookStyle">
              <option value="">選択してください</option>
              <option value="static">居飛車</option>
              <option value="ranging">振り飛車</option>
              <option value="both">どちらでも使う</option>
            </select>
          </label>
          <template v-if="book.kind === 'castle'">
            <label>囲い一覧の分類ID
              <input v-model.trim="book.classification.menuGroup" list="castle-group-options" placeholder="例: ranging-mino" />
            </label>
            <datalist id="castle-group-options"><option v-for="group in castleGroups" :key="group.id" :value="group.id">{{ group.label }}</option></datalist>
            <fieldset class="context-options">
              <legend>対応する対局分類（複数可）</legend>
              <label v-for="context in castleContextOptions" :key="context.id" class="check-label"><input v-model="book.classification.contexts" type="checkbox" :value="context.id" /> {{ context.label }}</label>
            </fieldset>
          </template>
        </div>
        <label>ID<input v-model.trim="book.id" pattern="[a-z0-9-]+" /></label>
        <label>名称<input v-model.trim="book.label" /></label>
        <label>開始局面（SFEN）<textarea v-model.trim="book.initialSfen" rows="3" @change="cursor = 0" /></label>
        <div class="guide-help">
          <strong>案内手は右側で編集します</strong>
          <p>既存データを選ぶと、現行の案内手が「案内手と実戦分岐」に表示されます。相手の指し手は固定条件ではなく、案内手が実戦でも指せるか確認するために入力します。</p>
        </div>
        <div v-if="book.kind === 'strategy'" class="completion-settings">
          <label class="check-label"><input v-model="book.completionChoices.enabled" type="checkbox" /> 完成後に次の戦法を選ばせる</label>
          <template v-if="book.completionChoices.enabled">
            <label>選択時の案内文<input v-model.trim="book.completionChoices.prompt" placeholder="次に目指す戦法を選んでね" /></label>
            <div class="completion-choice-list">
              <div v-for="strategyId in book.completionChoices.strategyIds" :key="strategyId">
                <span>{{ strategyLabel(strategyId) }} <small>{{ strategyId }}</small></span>
                <button type="button" class="icon danger" @click="removeCompletionChoice(strategyId)">削除</button>
              </div>
            </div>
            <div class="completion-choice-add">
              <select v-model="completionChoiceToAdd" aria-label="派生戦法を追加">
                <option value="">派生戦法を選択</option>
                <option v-for="strategy in availableCompletionStrategies" :key="strategy.id" :value="strategy.id">{{ strategy.label }}</option>
              </select>
              <button type="button" :disabled="!completionChoiceToAdd" @click="addCompletionChoice">追加</button>
            </div>
          </template>
        </div>
        <div v-if="book.kind === 'castle'" class="castle-completion-settings">
          <div class="castle-completion-heading">
            <div><strong>囲いの完成形</strong><small>登録した駒がすべて揃うと完成。複数形はOR判定です。</small></div>
            <button type="button" @click="addCompletionVariant">完成形 ＋</button>
          </div>
          <section v-for="(variant, variantIndex) in book.completionVariants" :key="variantIndex" class="completion-variant">
            <div class="completion-variant-heading">
              <strong>完成形 {{ variantIndex + 1 }}</strong>
              <button type="button" class="danger" @click="removeCompletionVariant(variantIndex)">完成形を削除</button>
            </div>
            <div v-for="(piece, pieceIndex) in variant" :key="pieceIndex" class="completion-piece-row">
              <select v-model="piece[0]" :aria-label="`完成形${variantIndex + 1} 駒${pieceIndex + 1}のマス`">
                <option v-for="square in conditionSquareOptions" :key="square.value" :value="square.value">{{ square.label }}</option>
              </select>
              <span>に</span>
              <select v-model="piece[1]" :aria-label="`完成形${variantIndex + 1} 駒${pieceIndex + 1}の駒種`">
                <option v-for="pieceOption in conditionPieceOptions" :key="pieceOption.value" :value="pieceOption.value">{{ pieceOption.label }}</option>
              </select>
              <button type="button" class="icon danger" :aria-label="`完成形${variantIndex + 1}の駒${pieceIndex + 1}を削除`" @click="removeCompletionPiece(variantIndex, pieceIndex)">×</button>
            </div>
            <button type="button" class="completion-piece-add" @click="addCompletionPiece(variantIndex)">必要な駒 ＋</button>
          </section>
          <p v-if="!book.completionVariants.length" class="empty">「完成形 ＋」から囲いの完成条件を追加してください。</p>
        </div>
      </aside>

      <section class="board-column">
        <div class="turn-banner"><span>{{ guideOnlyPreview ? `案内手${(selectedGuideIndex ?? 0) + 1}の確認` : turnLabel }}</span><strong>{{ guideOnlyPreview ? "相手の応手なしで表示中" : `${cursor + 1}手目を入力` }}</strong></div>
        <div class="board-wrap">
          <ShogiMatchBoard
            :sfen="boardSfen"
            :last-move="boardLastMove"
            :candidates="previewCandidates"
            :allow-move="!guideOnlyPreview"
            :flip="book.side === 'white'"
            asset-base-url="."
            layout="standard"
            @usi-move="appendMove"
          />
        </div>
        <div class="move-actions">
          <button type="button" :disabled="cursor === 0" @click="undo">1手戻す</button>
          <button type="button" :disabled="cursor >= activeBranch.moves.length" @click="cursor++">1手進む</button>
          <button type="button" class="primary" :disabled="!canInsertNextGuideMove" @click="insertNextGuideMove">次の案内手を入力<span v-if="nextGuideMove">（{{ nextGuideMove }}）</span></button>
          <button type="button" @click="branchHere">この局面から分岐</button>
          <button type="button" class="danger" :disabled="book.branches.length === 1" @click="removeBranch">分岐を削除</button>
        </div>
        <p v-if="replayError" class="message error">{{ replayError }}</p>
      </section>

      <aside class="panel branch-panel">
        <div class="panel-heading"><h2>案内手の編集</h2></div>
        <section class="guide-sequence" aria-labelledby="guide-sequence-title">
          <div class="subheading">
            <div><h3 id="guide-sequence-title">やこび姫の案内手</h3><p>先手基準。ここを編集すると、書き出す案内手が変わります。</p></div>
            <button type="button" @click="showGuideMoveAdder = !showGuideMoveAdder">マスを選んで追加</button>
          </div>
          <div v-if="showGuideMoveAdder" class="guide-move-adder">
            <strong>追加する手</strong>
            <label>移動元<select v-model="newGuideFrom"><option value="">選択</option><option v-for="square in conditionSquareOptions" :key="`from-${square.value}`" :value="square.value">{{ square.label }}</option></select></label>
            <span>から</span>
            <label>移動先<select v-model="newGuideTo"><option value="">選択</option><option v-for="square in conditionSquareOptions" :key="`to-${square.value}`" :value="square.value">{{ square.label }}</option></select></label>
            <label class="promote-check"><input v-model="newGuidePromote" type="checkbox" /> 成る</label>
            <button type="button" class="primary" :disabled="!newGuideFrom || !newGuideTo || newGuideFrom === newGuideTo" @click="addGuideMoveFromSquares">この手を追加</button>
            <small>例: 「２六」から「２五」を選ぶと、▲２五歩として追加されます。</small>
          </div>
          <ol class="guide-move-list">
            <li v-for="(_move, index) in book.guideMoves" :key="index" :class="{ selected: selectedGuideIndex === index }">
              <span>{{ index + 1 }}</span>
              <div class="guide-move-edit">
                <button type="button" class="move-preview" :aria-label="`${formattedGuideMove(index)}を盤上に表示`" @click="previewGuideMove(index)">
                  <strong>{{ formattedGuideMove(index) }}</strong><small>クリックで盤上に矢印を表示</small>
                </button>
                <div v-if="guideMoveParts(index)" class="guide-square-editor">
                  <label>移動元<select :value="guideMoveParts(index)?.from" @change="updateGuideMoveSquare(index, 'from', $event)"><option v-for="square in conditionSquareOptions" :key="square.value" :value="square.value">{{ square.label }}</option></select></label>
                  <span>→</span>
                  <label>移動先<select :value="guideMoveParts(index)?.to" @change="updateGuideMoveSquare(index, 'to', $event)"><option v-for="square in conditionSquareOptions" :key="square.value" :value="square.value">{{ square.label }}</option></select></label>
                  <label class="promote-check"><input type="checkbox" :checked="guideMoveParts(index)?.promote" @change="updateGuideMovePromotion(index, $event)" /> 成る</label>
                </div>
                <details class="usi-details"><summary>詳細（USI）</summary><input v-model.trim="book.guideMoves[index]" :aria-label="`案内手${index + 1}のUSI`" placeholder="例: 7g7f" spellcheck="false" @focus="beginGuideMoveEdit(index)" @input="clearPreview" @change="finishGuideMoveEdit(index)" /></details>
              </div>
              <button type="button" class="icon" :disabled="index === 0" aria-label="上へ移動" @click="moveGuideMove(index, -1)">↑</button>
              <button type="button" class="icon" :disabled="index === book.guideMoves.length - 1" aria-label="下へ移動" @click="moveGuideMove(index, 1)">↓</button>
              <button type="button" class="icon danger" aria-label="削除" @click="removeGuideMove(index)">×</button>
              <div class="move-conditions">
                <div class="move-condition-heading">
                  <span>この手を案内する局面条件 <small>条件グループ同士はAND、グループ内の候補はOR</small></span>
                  <button type="button" @click="addMoveConditionGroup(index)">AND条件 ＋</button>
                </div>
                <div v-for="(group, groupIndex) in moveConditionGroups(index)" :key="groupIndex" class="move-condition-group">
                  <div class="move-condition-group-heading">
                    <strong>条件 {{ groupIndex + 1 }}</strong>
                    <span v-if="groupIndex > 0">かつ（AND）</span>
                    <button type="button" class="danger" :aria-label="`条件${groupIndex + 1}を削除`" @click="removeMoveConditionGroup(index, groupIndex)">条件を削除</button>
                  </div>
                  <div v-for="(condition, alternativeIndex) in group.alternatives" :key="alternativeIndex" class="move-condition-row">
                    <strong>{{ alternativeIndex ? "または" : "候補" }}<small>{{ alternativeIndex ? " OR" : "" }}</small></strong>
                    <select v-model="condition.owner" :aria-label="`案内手${index + 1} 条件${groupIndex + 1} OR候補${alternativeIndex + 1}の駒の所有者`">
                      <option value="opponent">相手の</option>
                      <option value="player">自分の</option>
                    </select>
                    <select v-model="condition.square" :aria-label="`案内手${index + 1} 条件${groupIndex + 1} OR候補${alternativeIndex + 1}のマス`">
                      <option v-for="square in conditionSquareOptions" :key="square.value" :value="square.value">{{ square.label }}</option>
                    </select>
                    <select v-model="condition.kind" :aria-label="`案内手${index + 1} 条件${groupIndex + 1} OR候補${alternativeIndex + 1}の駒`">
                      <option v-for="piece in conditionPieceOptions" :key="piece.value" :value="piece.value">{{ piece.label }}</option>
                    </select>
                    <span>がいる</span>
                    <button type="button" class="icon danger" :aria-label="`条件${groupIndex + 1}のOR候補${alternativeIndex + 1}を削除`" @click="removeMoveConditionAlternative(index, groupIndex, alternativeIndex)">×</button>
                  </div>
                  <button type="button" class="add-or-condition" @click="addMoveConditionAlternative(index, groupIndex)">または（OR）候補 ＋</button>
                </div>
              </div>
            </li>
          </ol>
          <p v-if="!book.guideMoves.length" class="empty">案内手がありません。「マスを選んで追加」を押し、移動元と移動先を選んでください。</p>
        </section>
        <details class="branch-verification">
          <summary><strong>実戦確認（任意）</strong><span>相手の応手や複数の分岐を盤上で確認するときだけ開きます。</span></summary>
          <div class="branch-verification-body">
            <div class="optional-heading"><span>相手が別の手を指しても、次の案内手が合法なら補助は続きます。</span><button type="button" @click="branchHere">分岐 ＋</button></div>
            <label>分岐<select v-model.number="activeBranchIndex" @change="cursor = activeBranch.moves.length"><option v-for="(branch, index) in book.branches" :key="branch.id + index" :value="index">{{ branch.label || branch.id }}</option></select></label>
            <div class="two-columns"><label>分岐ID<input v-model.trim="activeBranch.id" /></label><label>表示名<input v-model.trim="activeBranch.label" /></label></div>
            <ol class="move-list">
              <li v-for="(move, index) in activeBranch.moves" :key="`${index}:${move.usi}`" :class="{ current: index + 1 === cursor }">
                <button type="button" @click="previewBranchMove(index)"><span>{{ index + 1 }}.</span><span class="move-notation"><strong>{{ formattedBranchMove(index) }}</strong><code>{{ move.usi }}</code></span><small :class="moveRole(index).className">{{ moveRole(index).label }}</small></button>
                <input v-model="move.note" aria-label="指し手メモ" placeholder="この手の意味・条件" />
              </li>
            </ol>
            <p v-if="!activeBranch.moves.length" class="empty">必要なら盤上で初手から確認手順を入力してください。</p>
          </div>
        </details>
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
import { Position } from "tsshogi";
import ShogiMatchBoard from "../ShogiMatchBoard.vue";
import { STANDARD_SFEN } from "../game-state";
import { OPENING_CASTLE_GROUPS, OPENING_CASTLES, OPENING_STRATEGIES, openingDefinitionRookStyle } from "../core/opening-guide.mjs";
import { createOpeningBookDraft, createOpeningBookLibrary, deleteOpeningDefinitionFromLibrary, normalizeMovePositionPrerequisites, OPENING_BOOK_LIBRARY_STORAGE_KEY, OPENING_BOOK_STORAGE_KEY, openingBookDraftKey, parseOpeningBook, parseOpeningBookLibrary, replayOpeningBranch, saveOpeningBookToLibrary, serializeOpeningBook, serializeOpeningBookLibrary, validateOpeningBook } from "../core/opening-book-editor.mjs";
import { formatHintMove } from "../core/match-assists.mjs";

const strategies = OPENING_STRATEGIES;
const castles = OPENING_CASTLES;
const castleGroups = OPENING_CASTLE_GROUPS;
const strategyFamilyOptions = [
  { id: "ibisha", label: "居飛車/基本戦法" }, { id: "aigakari", label: "相居飛車／相掛かり" },
  { id: "yokofudori", label: "相居飛車／横歩取り" }, { id: "yagura", label: "相居飛車／矢倉" },
  { id: "kakugawari", label: "相居飛車／角換わり" }, { id: "gangi", label: "相居飛車／雁木" },
  { id: "anti-ranging", label: "対抗型／居飛車側" }, { id: "shiken", label: "四間飛車" },
  { id: "sangen", label: "三間飛車" }, { id: "nakabisha", label: "中飛車" },
  { id: "mukai", label: "向かい飛車" }, { id: "special", label: "奇襲・特殊戦法" },
];
const castleContextOptions = [
  { id: "aibisha", label: "相居飛車" },
  { id: "anti-ranging-static", label: "対抗型・居飛車側" },
  { id: "anti-static-ranging", label: "対抗型・振り飛車側" },
  { id: "double-ranging", label: "相振り飛車" },
];
const castleFamilyOptions = [...new Set(castles.map((castle: any) => castle.family).filter(Boolean))];
const strategyFamilyLabels = new Map(strategyFamilyOptions.map((option) => [option.id, option.label]));
const castleGroupLabels = new Map(castleGroups.map((group: any) => [group.id, group.label]));
const storedLibrary = safeParseLibrary(localStorage.getItem(OPENING_BOOK_LIBRARY_STORAGE_KEY));
const stored = localStorage.getItem(OPENING_BOOK_STORAGE_KEY);
const legacyInitial = stored ? safeParse(stored) : null;
const initial = storedLibrary.activeKey ? storedLibrary.books[storedLibrary.activeKey] ?? legacyInitial : legacyInitial;
const book = reactive<any>(normalize(initial ?? createOpeningBookDraft({ initialSfen: STANDARD_SFEN })));
const selectedDefinitionKey = ref(initial && (storedLibrary.books[openingBookDraftKey(initial)] || [...strategies, ...castles].some((item: any) => item.id === initial.id)) ? openingBookDraftKey(initial) : "new");
const draftLibrary = ref<any>(storedLibrary);
const activeBranchIndex = ref(0);
const cursor = ref(book.branches?.[0]?.moves?.length ?? 0);
const toast = ref("");
const selectedGuideIndex = ref<number | null>(null);
const previewUsi = ref("");
const guideOnlyPreview = ref(false);
const completionChoiceToAdd = ref("");
const guideMoveBeforeEdit = ref<{ index: number; value: string } | null>(null);
const showGuideMoveAdder = ref(false);
const newGuideFrom = ref("");
const newGuideTo = ref("");
const newGuidePromote = ref(false);
let toastTimer = 0;

const conditionSquareOptions = Array.from({ length: 81 }, (_, index) => {
  const file = 9 - Math.floor(index / 9);
  const rankIndex = index % 9;
  return { value: `${file}${String.fromCharCode(97 + rankIndex)}`, label: `${"０１２３４５６７８９"[file]}${"一二三四五六七八九"[rankIndex]}` };
});
const conditionPieceOptions = [
  { value: "P", label: "歩" }, { value: "L", label: "香" }, { value: "N", label: "桂" },
  { value: "S", label: "銀" }, { value: "G", label: "金" }, { value: "B", label: "角" },
  { value: "R", label: "飛" }, { value: "K", label: "玉" },
];

const activeBranch = computed(() => book.branches[activeBranchIndex.value] ?? book.branches[0]);
const replay = computed(() => replayOpeningBranch(book, activeBranch.value, cursor.value));
const currentSfen = computed(() => replay.value.position?.sfen ?? STANDARD_SFEN);
const replayError = computed(() => replay.value.error);
const lastMove = computed(() => cursor.value ? activeBranch.value.moves[cursor.value - 1]?.usi ?? "" : "");
const boardSfen = computed(() => guideOnlyPreview.value && selectedGuideIndex.value !== null ? guidePreviewSfen(selectedGuideIndex.value) : currentSfen.value);
const boardLastMove = computed(() => guideOnlyPreview.value ? "" : lastMove.value);
const turnLabel = computed(() => currentSfen.value.split(" ")[1] === "w" ? "後手番" : "先手番");
const validation = computed(() => validateOpeningBook(book));
const savedClassificationNames = computed(() => {
  const names = new Map<string, string>();
  const savedBooks = Object.values(draftLibrary.value.books) as any[];
  savedBooks.sort((left, right) => String(left?.updatedAt ?? "").localeCompare(String(right?.updatedAt ?? "")));
  for (const saved of savedBooks) {
    const kind = saved?.kind === "castle" ? "castle" : "strategy";
    const rawGroup = kind === "castle"
      ? saved?.classification?.menuGroup || saved?.classification?.family
      : saved?.classification?.family;
    const name = String(saved?.classification?.name ?? "").trim();
    if (rawGroup && name) names.set(`${kind}:${rawGroup}`, name);
  }
  return names;
});
const existingDefinitionGroups = computed(() => {
  const groups = new Map<string, { id: string; label: string; items: any[] }>();
  const add = (kind: string, id: string, label: string, definition: any, saved: any) => {
    const classification = { ...(definition ? {
      family: definition.family,
      menuGroup: definition.menuGroup,
    } : {}), ...saved?.classification };
    const rawGroup = kind === "castle" ? classification.menuGroup || classification.family : classification.family;
    const groupId = `${kind}:${rawGroup || "unclassified"}`;
    const groupName = savedClassificationNames.value.get(groupId) ?? (
      String(classification.name ?? "").trim()
      || (kind === "castle" ? castleGroupLabels.get(rawGroup) : strategyFamilyLabels.get(rawGroup))
      || rawGroup
      || "未分類"
    );
    if (!groups.has(groupId)) groups.set(groupId, {
      id: groupId,
      label: `${kind === "castle" ? "囲い" : "戦法"}／${groupName}`,
      items: [],
    });
    groups.get(groupId)?.items.push({ key: `${kind}:${id}`, label: saved?.label ?? label ?? id, saved: Boolean(saved) });
  };
  const deletedKeys = new Set(draftLibrary.value.deletedKeys ?? []);
  for (const strategy of strategies) {
    if (!deletedKeys.has(`strategy:${strategy.id}`)) add("strategy", strategy.id, strategy.label, strategy, draftLibrary.value.books[`strategy:${strategy.id}`]);
  }
  for (const castle of castles) {
    if (!deletedKeys.has(`castle:${castle.id}`)) add("castle", castle.id, castle.label, castle, draftLibrary.value.books[`castle:${castle.id}`]);
  }
  for (const [key, saved] of Object.entries(draftLibrary.value.books) as [string, any][]) {
    const [kind, id] = key.split(":");
    const definitions = kind === "castle" ? castles : strategies;
    if (!definitions.some((item: any) => item.id === id)) add(kind, id, saved?.label ?? id, null, saved);
  }
  return [...groups.values()];
});
const currentDraftSaved = computed(() => {
  const saved = draftLibrary.value.books[openingBookDraftKey(book)];
  if (!saved) return false;
  const withoutTimestamp = (value: any) => { const copy = { ...value }; delete copy.updatedAt; return copy; };
  return JSON.stringify(withoutTimestamp(saved)) === JSON.stringify(withoutTimestamp(book));
});
const availableCompletionStrategies = computed(() => strategies.filter((strategy: any) => (
  strategy.id !== book.id && !book.completionChoices.strategyIds.includes(strategy.id)
)));
const previewCandidates = computed(() => {
  if (!previewUsi.value || (!guideOnlyPreview.value && replayError.value)) return [];
  const position = guideOnlyPreview.value ? Position.newBySFEN(boardSfen.value) : replay.value.position;
  const move = position?.createMoveByUSI(previewUsi.value);
  return move && (guideOnlyPreview.value || position?.isValidMove(move)) ? [{ usi: previewUsi.value }] : [];
});
const nextGuideMove = computed(() => {
  const guideIndex = guideMoveIndexAtCursor();
  return isGuideSidePly(cursor.value) ? book.guideMoves[guideIndex] ?? "" : "";
});
const canInsertNextGuideMove = computed(() => {
  if (!nextGuideMove.value || replayError.value) return false;
  const move = replay.value.position?.createMoveByUSI(nextGuideMove.value);
  return Boolean(move && replay.value.position?.isValidMove(move));
});

function safeParse(text: string) { try { return parseOpeningBook(text); } catch { return null; } }
function safeParseLibrary(text: string | null) { try { return parseOpeningBookLibrary(text ?? ""); } catch { return createOpeningBookLibrary(); } }
function definitionForEditor(definition: any, kind: string) {
  if (!definition) return definition;
  const classificationName = kind === "castle"
    ? castleGroupLabels.get(definition.menuGroup) ?? definition.menuGroup ?? definition.family ?? "未分類"
    : strategyFamilyLabels.get(definition.family) ?? definition.family ?? "未分類";
  return { ...definition, classificationName, rookStyle: openingDefinitionRookStyle(definition.id, kind) ?? "both" };
}
function normalize(value: any) {
  const definition = (value?.kind === "castle" ? castles : strategies).find((item: any) => item.id === value?.id);
  const fallback = createOpeningBookDraft({ definition: definitionForEditor(definition, value?.kind ?? "strategy"), kind: value?.kind ?? "strategy", initialSfen: STANDARD_SFEN });
  return { ...fallback, ...value, classification: { ...fallback.classification, ...value?.classification, contexts: Array.isArray(value?.classification?.contexts) ? value.classification.contexts : fallback.classification.contexts }, guideMoves: Array.isArray(value?.guideMoves) ? value.guideMoves : [], completionVariants: Array.isArray(value?.completionVariants) ? value.completionVariants : fallback.completionVariants, movePositionPrerequisites: normalizeMovePositionPrerequisites(value?.movePositionPrerequisites), sources: Array.isArray(value?.sources) ? value.sources : fallback.sources, branches: Array.isArray(value?.branches) && value.branches.length ? value.branches : fallback.branches, engineReview: { ...fallback.engineReview, ...value?.engineReview }, completionChoices: { ...fallback.completionChoices, ...value?.completionChoices, strategyIds: Array.isArray(value?.completionChoices?.strategyIds) ? value.completionChoices.strategyIds : [] } };
}
function announce(message: string) { toast.value = message; window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.value = "", 2600); }
function replaceBook(next: any) { Object.keys(book).forEach((key) => delete book[key]); Object.assign(book, normalize(next)); activeBranchIndex.value = 0; cursor.value = book.branches[0]?.moves?.length ?? 0; clearPreview(); }
function loadDefinition() {
  if (selectedDefinitionKey.value === "new") { replaceBook(createOpeningBookDraft({ initialSfen: STANDARD_SFEN })); return; }
  const [kind, id] = selectedDefinitionKey.value.split(":");
  const definition = (kind === "castle" ? castles : strategies).find((item: any) => item.id === id);
  const saved = draftLibrary.value.books[selectedDefinitionKey.value];
  const base = createOpeningBookDraft({ definition: definitionForEditor(definition, kind), kind, initialSfen: STANDARD_SFEN });
  const rawGroup = kind === "castle" ? base.classification.menuGroup || base.classification.family : base.classification.family;
  base.classification.name = savedClassificationNames.value.get(`${kind}:${rawGroup}`) ?? base.classification.name;
  replaceBook(saved ? { ...base, ...saved, classification: { ...base.classification, ...saved.classification } } : base);
  const label = saved?.label ?? definition?.label ?? id;
  announce(saved ? `${label}の保存済み下書きを読み込みました。` : `${label}の現行案内手を取り込みました。`);
}
function guideSide() { return book.side === "white" ? "w" : "b"; }
function initialTurn() { return String(book.initialSfen ?? "").trim().split(/\s+/)[1] === "w" ? "w" : "b"; }
function isGuideSidePly(index: number) {
  const mover = index % 2 === 0 ? initialTurn() : (initialTurn() === "b" ? "w" : "b");
  return mover === guideSide();
}
function guideMoveIndexAtCursor() {
  let count = 0;
  for (let index = 0; index < cursor.value; index += 1) if (isGuideSidePly(index)) count += 1;
  return count;
}
function sideMark(index: number) { return isGuideSidePly(index) ? (guideSide() === "b" ? "▲" : "△") : (guideSide() === "b" ? "△" : "▲"); }
function coordinateNotation(usi: string) {
  const ranks = "一二三四五六七八九";
  const fullWidth = "０１２３４５６７８９";
  const drop = String(usi ?? "").match(/^([PLNSGBR])\*([1-9])([a-i])$/);
  const move = String(usi ?? "").match(/^([1-9])([a-i])([1-9])([a-i])(\+)?$/);
  const square = (file: string, rank: string) => `${fullWidth[Number(file)]}${ranks[rank.charCodeAt(0) - 97]}`;
  if (drop) return `${square(drop[2], drop[3])}へ駒打ち`;
  if (move) return `${square(move[1], move[2])}→${square(move[3], move[4])}${move[5] ? "（成）" : ""}`;
  return usi || "未入力";
}
function guidePreviewSfen(index: number) {
  const parts = String(book.initialSfen || STANDARD_SFEN).trim().split(/\s+/);
  const ranks = parts[0].split("/");
  const board = new Map<string, string>();
  ranks.forEach((rank: string, rankIndex: number) => {
    let file = 9;
    let promoted = false;
    for (const symbol of rank) {
      if (/[1-9]/.test(symbol)) file -= Number(symbol);
      else if (symbol === "+") promoted = true;
      else {
        board.set(`${file}${String.fromCharCode(97 + rankIndex)}`, `${promoted ? "+" : ""}${symbol}`);
        file -= 1;
        promoted = false;
      }
    }
  });
  for (let moveIndex = 0; moveIndex < index; moveIndex += 1) {
    const usi = String(book.guideMoves[moveIndex] ?? "");
    const drop = usi.match(/^([PLNSGBR])\*([1-9][a-i])$/);
    const move = usi.match(/^([1-9][a-i])([1-9][a-i])(\+)?$/);
    if (drop) board.set(drop[2], guideSide() === "b" ? drop[1] : drop[1].toLowerCase());
    else if (move) {
      const piece = board.get(move[1]);
      if (!piece) continue;
      board.delete(move[1]);
      board.set(move[2], `${move[3] && !piece.startsWith("+") ? "+" : ""}${piece}`);
    }
  }
  const boardToken = Array.from({ length: 9 }, (_, rankIndex) => {
    let row = "";
    let empty = 0;
    for (let file = 9; file >= 1; file -= 1) {
      const piece = board.get(`${file}${String.fromCharCode(97 + rankIndex)}`);
      if (!piece) empty += 1;
      else {
        if (empty) row += String(empty);
        row += piece;
        empty = 0;
      }
    }
    return `${row}${empty || ""}`;
  }).join("/");
  return `${boardToken} ${guideSide()} ${parts[2] ?? "-"} ${parts[3] ?? "1"}`;
}
function guideJapaneseNotation(index: number) {
  const pieceNames: Record<string, string> = { P: "歩", L: "香", N: "桂", S: "銀", G: "金", B: "角", R: "飛", K: "玉" };
  const ranks = String(book.initialSfen ?? "").trim().split(/\s+/)[0]?.split("/") ?? [];
  const board = new Map<string, string>();
  ranks.forEach((rank: string, rankIndex: number) => {
    let file = 9;
    let promoted = false;
    for (const symbol of rank) {
      if (/[1-9]/.test(symbol)) file -= Number(symbol);
      else if (symbol === "+") promoted = true;
      else {
        board.set(`${file}${String.fromCharCode(97 + rankIndex)}`, `${promoted ? "+" : ""}${symbol.toUpperCase()}`);
        file -= 1;
        promoted = false;
      }
    }
  });
  for (let moveIndex = 0; moveIndex <= index; moveIndex += 1) {
    const usi = String(book.guideMoves[moveIndex] ?? "");
    const drop = usi.match(/^([PLNSGBR])\*([1-9][a-i])$/);
    const move = usi.match(/^([1-9][a-i])([1-9][a-i])(\+)?$/);
    if (drop) {
      if (moveIndex === index) return `${coordinateNotation(`1a${drop[2]}`).split("→")[1]}${pieceNames[drop[1]]}打`;
      board.set(drop[2], drop[1]);
    } else if (move) {
      const kind = (board.get(move[1]) ?? "").replace("+", "");
      if (moveIndex === index && kind) {
        const destination = coordinateNotation(usi).split("→")[1]?.replace("（成）", "") ?? usi;
        return `${destination}${pieceNames[kind] ?? kind}${move[3] ? "成" : ""}`;
      }
      board.delete(move[1]);
      board.set(move[2], `${move[3] ? "+" : ""}${kind}`);
    }
  }
  return coordinateNotation(book.guideMoves[index]);
}
function formattedBranchMove(index: number) {
  const before = replayOpeningBranch(book, activeBranch.value, index);
  const usi = activeBranch.value.moves[index]?.usi ?? "";
  try { return `${sideMark(index)}${formatHintMove(usi, before.position?.sfen ?? "")}`; }
  catch { return `${sideMark(index)}${coordinateNotation(usi)}`; }
}
function branchIndexForGuideMove(guideIndex: number) {
  let seen = 0;
  for (let index = 0; index < activeBranch.value.moves.length; index += 1) {
    if (!isGuideSidePly(index)) continue;
    if (seen === guideIndex) return index;
    seen += 1;
  }
  return -1;
}
function formattedGuideMove(index: number) {
  const branchIndex = branchIndexForGuideMove(index);
  if (branchIndex >= 0 && activeBranch.value.moves[branchIndex]?.usi === book.guideMoves[index]) return formattedBranchMove(branchIndex);
  return `${guideSide() === "b" ? "▲" : "△"}${guideJapaneseNotation(index)}`;
}
function clearPreview() { selectedGuideIndex.value = null; previewUsi.value = ""; guideOnlyPreview.value = false; }
function previewBranchMove(index: number) {
  guideOnlyPreview.value = false;
  cursor.value = index;
  selectedGuideIndex.value = isGuideSidePly(index) ? guideMoveIndexAtCursor() : null;
  previewUsi.value = activeBranch.value.moves[index]?.usi ?? "";
}
function previewGuideMove(index: number) {
  selectedGuideIndex.value = index;
  const branchIndex = branchIndexForGuideMove(index);
  if (branchIndex >= 0 && activeBranch.value.moves[branchIndex]?.usi === book.guideMoves[index]) {
    guideOnlyPreview.value = false;
    cursor.value = branchIndex;
  } else guideOnlyPreview.value = true;
  previewUsi.value = book.guideMoves[index] ?? "";
  if (!previewCandidates.value.length) announce("移動元に駒がないため、この案内手の矢印を表示できません。");
}
function moveRole(index: number) {
  if (!isGuideSidePly(index)) return { label: "相手の応手", className: "opponent" };
  let guideIndex = 0;
  for (let previous = 0; previous < index; previous += 1) if (isGuideSidePly(previous)) guideIndex += 1;
  const expected = book.guideMoves[guideIndex];
  return expected === activeBranch.value.moves[index]?.usi
    ? { label: `案内手${guideIndex + 1}`, className: "guide" }
    : { label: expected ? `案内外（予定 ${expected}）` : "案内外", className: "outside" };
}
function guideMoveParts(index: number) {
  const match = String(book.guideMoves[index] ?? "").match(/^([1-9][a-i])([1-9][a-i])(\+)?$/);
  return match ? { from: match[1], to: match[2], promote: Boolean(match[3]) } : null;
}
function replaceGuideMove(index: number, next: string, previousValue?: string) {
  const previous = previousValue ?? book.guideMoves[index] ?? "";
  if (previous && previous !== next && book.movePositionPrerequisites[previous]) {
    book.movePositionPrerequisites[next] = [
      ...(book.movePositionPrerequisites[next] ?? []),
      ...book.movePositionPrerequisites[previous],
    ];
    delete book.movePositionPrerequisites[previous];
  }
  book.guideMoves[index] = next;
  clearPreview();
}
function updateGuideMoveSquare(index: number, part: "from" | "to", event: Event) {
  const current = guideMoveParts(index);
  if (!current) return;
  const value = (event.target as HTMLSelectElement).value;
  replaceGuideMove(index, `${part === "from" ? value : current.from}${part === "to" ? value : current.to}${current.promote ? "+" : ""}`);
}
function updateGuideMovePromotion(index: number, event: Event) {
  const current = guideMoveParts(index);
  if (!current) return;
  replaceGuideMove(index, `${current.from}${current.to}${(event.target as HTMLInputElement).checked ? "+" : ""}`);
}
function addGuideMoveFromSquares() {
  if (!newGuideFrom.value || !newGuideTo.value || newGuideFrom.value === newGuideTo.value) return;
  clearPreview();
  book.guideMoves.push(`${newGuideFrom.value}${newGuideTo.value}${newGuidePromote.value ? "+" : ""}`);
  const addedIndex = book.guideMoves.length - 1;
  selectedGuideIndex.value = addedIndex;
  newGuideFrom.value = "";
  newGuideTo.value = "";
  newGuidePromote.value = false;
  showGuideMoveAdder.value = false;
  announce(`${formattedGuideMove(addedIndex)}を案内手に追加しました。`);
}
function beginGuideMoveEdit(index: number) { guideMoveBeforeEdit.value = { index, value: book.guideMoves[index] ?? "" }; }
function finishGuideMoveEdit(index: number) {
  const previous = guideMoveBeforeEdit.value?.index === index ? guideMoveBeforeEdit.value.value : "";
  const next = book.guideMoves[index] ?? "";
  if (previous !== next) replaceGuideMove(index, next, previous);
  guideMoveBeforeEdit.value = null;
}
function moveConditionGroups(index: number) { return book.movePositionPrerequisites[book.guideMoves[index]] ?? []; }
function defaultMoveCondition() { return { square: "8e", owner: "opponent", kind: "P" }; }
function addMoveConditionGroup(index: number) {
  const move = book.guideMoves[index];
  if (!move) return announce("先に案内手を入力してください。");
  if (!book.movePositionPrerequisites[move]) book.movePositionPrerequisites[move] = [];
  book.movePositionPrerequisites[move].push({ alternatives: [defaultMoveCondition()] });
}
function addMoveConditionAlternative(index: number, groupIndex: number) {
  moveConditionGroups(index)[groupIndex]?.alternatives.push(defaultMoveCondition());
}
function removeMoveConditionGroup(index: number, groupIndex: number) {
  const move = book.guideMoves[index];
  const groups = book.movePositionPrerequisites[move];
  if (!groups) return;
  groups.splice(groupIndex, 1);
  if (!groups.length) delete book.movePositionPrerequisites[move];
}
function removeMoveConditionAlternative(index: number, groupIndex: number, alternativeIndex: number) {
  const group = moveConditionGroups(index)[groupIndex];
  if (!group) return;
  group.alternatives.splice(alternativeIndex, 1);
  if (!group.alternatives.length) removeMoveConditionGroup(index, groupIndex);
}
function strategyLabel(strategyId: string) { return strategies.find((strategy: any) => strategy.id === strategyId)?.label ?? "不明な戦法"; }
function addCompletionChoice() {
  if (!completionChoiceToAdd.value || book.completionChoices.strategyIds.includes(completionChoiceToAdd.value)) return;
  book.completionChoices.strategyIds.push(completionChoiceToAdd.value);
  completionChoiceToAdd.value = "";
}
function removeCompletionChoice(strategyId: string) {
  book.completionChoices.strategyIds = book.completionChoices.strategyIds.filter((id: string) => id !== strategyId);
}
function addCompletionVariant() { book.completionVariants.push([["5i", "K"]]); }
function removeCompletionVariant(variantIndex: number) { book.completionVariants.splice(variantIndex, 1); }
function addCompletionPiece(variantIndex: number) { book.completionVariants[variantIndex].push(["5i", "K"]); }
function removeCompletionPiece(variantIndex: number, pieceIndex: number) { book.completionVariants[variantIndex].splice(pieceIndex, 1); }
function removeGuideMove(index: number) { clearPreview(); delete book.movePositionPrerequisites[book.guideMoves[index]]; book.guideMoves.splice(index, 1); }
function moveGuideMove(index: number, offset: number) {
  clearPreview();
  const target = index + offset;
  if (target < 0 || target >= book.guideMoves.length) return;
  const [move] = book.guideMoves.splice(index, 1);
  book.guideMoves.splice(target, 0, move);
}
function insertNextGuideMove() {
  if (!canInsertNextGuideMove.value) return announce("次の案内手は現在の局面では指せません。相手の応手か案内手を見直してください。");
  appendMove(nextGuideMove.value);
}
function appendMove(event: CustomEvent | string) {
  const usi = typeof event === "string" ? event : event.detail ?? event;
  if (replayError.value) return announce("不正な手順を先に修正してください。");
  const move = replay.value.position?.createMoveByUSI(String(usi));
  if (!move || !replay.value.position?.isValidMove(move)) return announce("その手は現在の局面では指せません。");
  activeBranch.value.moves.splice(cursor.value, activeBranch.value.moves.length - cursor.value, { usi: String(usi), note: "" });
  cursor.value += 1;
  clearPreview();
}
function undo() { if (cursor.value > 0) { activeBranch.value.moves.splice(cursor.value - 1, 1); cursor.value -= 1; clearPreview(); } }
function branchHere() {
  const number = book.branches.length + 1;
  book.branches.push({ id: `branch-${number}`, label: `変化${number}`, moves: activeBranch.value.moves.slice(0, cursor.value).map((move: any) => ({ ...move })) });
  activeBranchIndex.value = book.branches.length - 1;
  announce("現在局面から新しい分岐を作りました。");
}
function removeBranch() { if (book.branches.length > 1) { book.branches.splice(activeBranchIndex.value, 1); activeBranchIndex.value = 0; cursor.value = activeBranch.value.moves.length; } }
function addSource() { book.sources.push({ title: "", url: "", checkedAt: new Date().toISOString().slice(0, 10) }); }
function hasSavedDraft(kind: string, id: string) { return Boolean(draftLibrary.value.books[`${kind}:${id}`]); }
function saveDraft() {
  draftLibrary.value = saveOpeningBookToLibrary(draftLibrary.value, book);
  localStorage.setItem(OPENING_BOOK_LIBRARY_STORAGE_KEY, serializeOpeningBookLibrary(draftLibrary.value));
  // 旧版で保存した下書きも引き続き復元できるよう、現在の1件を互換キーにも残す。
  localStorage.setItem(OPENING_BOOK_STORAGE_KEY, serializeOpeningBook(book));
  announce(`${book.label}だけをこのブラウザに保存しました。`);
}
function deleteSelectedOpening() {
  const key = selectedDefinitionKey.value;
  if (key === "new") return;
  if (!window.confirm(`既存データから「${book.label}」を削除しますか？\nこのブラウザの定跡一覧に表示されなくなります。`)) return;
  draftLibrary.value = deleteOpeningDefinitionFromLibrary(draftLibrary.value, key);
  localStorage.setItem(OPENING_BOOK_LIBRARY_STORAGE_KEY, serializeOpeningBookLibrary(draftLibrary.value));
  const legacy = safeParse(localStorage.getItem(OPENING_BOOK_STORAGE_KEY) ?? "");
  if (legacy && openingBookDraftKey(legacy) === key) localStorage.removeItem(OPENING_BOOK_STORAGE_KEY);
  const deletedLabel = book.label;
  replaceBook(createOpeningBookDraft({ initialSfen: STANDARD_SFEN }));
  selectedDefinitionKey.value = "new";
  announce(`${deletedLabel}を既存データから削除しました。`);
}
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
