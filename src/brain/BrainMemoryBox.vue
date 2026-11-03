<template>
  <!--
    思い出しの箱(docs/brain-training-design.mdの14-4の柱7・14-6の8と9・14-9)。
    長く覚えておきたい組を宝物用の宮殿に置き、1日・3日・1週間・2週間・1か月あとに思い出す。
    入れた日はテストしない(B22)。思い出すときは札から選ばず、頭の中で思い出してから札をめくり、自分で○×をつける(B24)。
    8割に届かなければ、出なかった絵をその場で見直して1段戻す(責めない。D:7-1)。1か月あとも思い出せたら宝物の棚へ(D:5-1 使い道)。
  -->
  <div class="brain-box" :class="`brain-box--${phase}`" data-brain-box>
    <!-- 箱の一覧 -->
    <template v-if="phase === 'list'">
      <div class="shogi-dex__speech shogi-tutorial__intro">
        <img class="shogi-dex__chara" :src="charaUrl" alt="" aria-hidden="true">
        <p>{{ listMessage }}</p>
      </div>
      <ol class="brain-box__spacing" aria-label="思い出す間隔">
        <li v-for="(days, index) in REVIEW_DAYS" :key="days"><b>{{ intervalText(days) }}</b>{{ index === REVIEW_DAYS.length - 1 ? "で宝物" : "あと" }}</li>
      </ol>
      <p v-if="treasure" class="brain-box__where">宝物用の宮殿：{{ palaceName }}（毎日の練習には使わない）</p>
      <ul v-if="store.boxes.length" class="brain-box__list">
        <li v-for="box in store.boxes" :key="box.id">
          <button
            type="button"
            class="brain-box__card"
            :class="{ 'brain-box__card--due': box.next <= day }"
            :data-box-card="box.id"
            @click="openCard(box.id)"
          >
            <span class="brain-box__icon" aria-hidden="true">{{ box.emoji }}</span>
            <strong>{{ box.title }}</strong>
            <span class="brain-box__due">{{ dueText(box, day) }}</span>
            <small>{{ rangeText(box) }}・{{ intervalText(REVIEW_DAYS[box.stage]) }}目</small>
            <span class="brain-box__ladder" :aria-label="`${box.stage}段目`"><i v-for="step in SHELF_STAGE" :key="step" :class="{ 'brain-box__ladder--on': step <= box.stage }"></i></span>
          </button>
        </li>
      </ul>
      <p v-else class="brain-box__empty">まだ箱は空っぽ。格言や作戦の手順を入れてみよう。</p>
      <template v-if="blocker === 'palace'">
        <p class="brain-box__note">箱には、毎日の練習とは別の宮殿がいるよ。自分の宮殿を作ろう。</p>
        <button type="button" class="brain-cta brain-box__add" data-box-build @click="emit('build')">＋ 宮殿を作る</button>
      </template>
      <template v-else>
        <button type="button" class="brain-cta brain-box__add" :disabled="store.boxes.length >= BOX_MAX" data-box-add @click="phase = 'catalog'">＋ 覚えるものを入れる</button>
        <p v-if="store.boxes.length >= BOX_MAX" class="brain-box__note">箱は{{ BOX_MAX }}つまで。どれかが宝物の棚に入ると、また入れられるよ。</p>
      </template>
      <template v-if="store.shelf.length">
        <p class="brain-section-title"><span>宝物の棚（1か月たっても思い出せた）</span></p>
        <ul class="brain-box__shelf" data-box-shelf>
          <li v-for="(entry, index) in store.shelf" :key="index"><span aria-hidden="true">{{ entry.emoji }}</span> {{ entry.title }}<small>{{ entry.count }}個</small></li>
        </ul>
      </template>
      <p v-if="undo" class="brain-box__toast" role="status">
        <span>「{{ undo.box.title }}」を外したよ</span>
        <button type="button" data-box-undo @click="undoRemove">取り消す</button>
      </p>
    </template>

    <!-- まだ時期の来ていない組 -->
    <template v-else-if="phase === 'detail' && selected">
      <section class="brain-box__paper brain-box__detail" :aria-label="selected.title">
        <p class="brain-box__detail-head"><span aria-hidden="true">{{ selected.emoji }}</span> {{ selected.title }}</p>
        <p>次に思い出すのは<strong>{{ dateText(selected.next) }}</strong>（{{ dueText(selected, day) }}）。</p>
        <p class="brain-box__muted">日をあけてから思い出すほうが、長く残るよ。それまでは、この場所をたどるだけにしておこう。</p>
        <ol class="brain-box__loci">
          <li v-for="(locus, index) in selectedLoci" :key="index"><span aria-hidden="true">{{ locus.emoji }}</span>{{ selected.start + index + 1 }}. {{ locus.name }}</li>
        </ol>
      </section>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__secondary" data-box-remove @click="removeSelected">箱から外す</button>
        <button type="button" class="brain-game__primary" @click="phase = 'list'">箱へ戻る</button>
      </div>
    </template>

    <!-- 目録 -->
    <template v-else-if="phase === 'catalog'">
      <p class="brain-game__prompt">何を箱に入れる？</p>
      <p v-if="treasure" class="brain-box__where">{{ palaceName }}の空いた場所に続けて置くよ（あと{{ freeCount }}か所）</p>
      <ul class="brain-box__catalog">
        <li v-for="set in sets" :key="set.id">
          <button type="button" class="shogi-brain__card brain-box__set" :disabled="setBlocked(set)" :data-box-set="set.id" @click="choose(set)">
            <strong><span aria-hidden="true">{{ set.emoji }}</span> {{ set.title }}</strong>
            <small>{{ set.desc }}・{{ set.items.length }}個</small>
            <span v-if="setNote(set)" class="brain-box__set-note">{{ setNote(set) }}</span>
          </button>
        </li>
        <li>
          <button type="button" class="shogi-brain__card brain-box__set" :disabled="freeCount < BOX_ITEM_MIN" data-box-set="custom" @click="openWrite">
            <strong><span aria-hidden="true">✏️</span> 自分で書く</strong>
            <small>覚えたいものを{{ BOX_ITEM_MIN }}〜{{ BOX_ITEM_MAX }}個、順番に</small>
          </button>
        </li>
      </ul>
    </template>

    <!-- 自分で書く -->
    <template v-else-if="phase === 'write'">
      <p class="brain-game__prompt">覚えたいものを、順番に書いてね</p>
      <section class="brain-box__paper brain-box__write">
        <label class="brain-box__title-input">組の名前<input v-model="customTitle" type="text" maxlength="16" placeholder="自分の組" data-box-title></label>
        <ol>
          <li v-for="(_, index) in customRows" :key="index">
            <span aria-hidden="true">{{ index + 1 }}</span>
            <input v-model="customRows[index]" type="text" maxlength="24" :aria-label="`${index + 1}番目`" :data-box-row="index">
          </li>
        </ol>
        <button v-if="customRows.length < Math.min(BOX_ITEM_MAX, freeCount)" type="button" class="brain-box__add-row" data-box-add-row @click="customRows.push('')">＋ 行を足す</button>
      </section>
      <p class="brain-box__muted">{{ customItems.length }}個（{{ BOX_ITEM_MIN }}個から）</p>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__secondary" @click="phase = 'catalog'">戻る</button>
        <button type="button" class="brain-game__primary" :disabled="customItems.length < BOX_ITEM_MIN || customItems.length > freeCount" data-box-write-done @click="chooseCustom">宮殿に置く</button>
      </div>
    </template>

    <!-- 宮殿に置く(からむ絵のヒントは出しておく。14-11)。入れた日はテストしない。 -->
    <template v-else-if="(phase === 'place' || phase === 'relearn') && current">
      <p class="brain-game__status"><span>{{ stepIndex + 1 }} / {{ stepList.length }}</span><span>{{ phase === 'relearn' ? "出なかった絵を見直す" : `${draft?.title}を置く` }}</span></p>
      <ol class="brain-palace__route" aria-hidden="true">
        <li v-for="(_, index) in stepList" :key="index" :class="{ 'brain-palace__route--done': index < stepIndex, 'brain-palace__route--now': index === stepIndex }"></li>
      </ol>
      <div class="brain-palace__scene" data-box-scene>
        <span class="brain-palace__locus"><b aria-hidden="true">{{ current.locus.emoji }}</b><span>{{ locusNumber(current.index) }}. {{ current.locus.name }}</span></span>
        <span class="brain-palace__plus" aria-hidden="true">＋</span>
        <strong class="brain-palace__item" :class="{ 'brain-box__item--long': current.item.word.length > 7 }"><span aria-hidden="true">{{ current.item.emoji }}</span>{{ current.item.word }}</strong>
        <small v-if="current.ask" class="brain-box__ask-note">{{ current.ask.replace("は？", "") }}</small>
        <p class="brain-palace__image" data-palace-hint><small>からむ絵のヒント</small>{{ current.image }}</p>
        <div v-if="phase === 'place' && current.count > 1" class="brain-palace__hint-tools">
          <button type="button" class="brain-palace__hint-button" data-palace-other @click="otherPicture"><span aria-hidden="true">⟳</span> ほかの絵</button>
        </div>
        <small v-if="stepIndex === 0" class="brain-palace__tip">{{ phase === 'relearn' ? "段には数えないよ。絵をもう一度、場所といっしょに思いうかべよう。" : "絵を思いうかべたら次へ。今日はテストしないよ。" }}</small>
      </div>
      <div class="brain-game__actions">
        <button v-if="stepIndex > 0" type="button" class="brain-game__secondary" @click="stepIndex -= 1">もどる</button>
        <button type="button" class="brain-game__primary" data-box-next @click="nextStep">{{ stepLabel }}</button>
      </div>
    </template>

    <!-- 入れた日 -->
    <template v-else-if="phase === 'placed' && placedBox">
      <section class="brain-box__paper brain-box__done" data-box-placed>
        <p class="brain-box__done-icon" aria-hidden="true">🗃️</p>
        <h2>「{{ placedBox.title }}」を箱に入れたよ</h2>
        <p>思い出すのは、あした（{{ dateText(placedBox.next) }}）から。</p>
        <p class="brain-box__muted">今日はテストしないよ。少し間をあけてから思い出すほうが、長く残るんだ。</p>
        <ol class="brain-box__steps" aria-label="思い出す日">
          <li v-for="days in REVIEW_DAYS" :key="days">{{ intervalText(days) }}</li>
          <li class="brain-box__steps-shelf">宝物</li>
        </ol>
      </section>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-box-back-list @click="phase = 'list'">箱へ戻る</button>
      </div>
    </template>

    <!-- 箱で思い出す(めくり札) -->
    <template v-else-if="phase === 'review' && reviewBox && reviewScene">
      <p class="brain-game__status"><span>{{ reviewIndex + 1 }} / {{ reviewScenes.length }}</span><span>{{ reviewBox.title }}・{{ sinceText(reviewBox, day) }}</span></p>
      <ol class="brain-box__trail" aria-hidden="true">
        <li
          v-for="(_, index) in reviewScenes"
          :key="index"
          :class="{
            'brain-box__trail--ok': grades[index] === true,
            'brain-box__trail--miss': grades[index] === false,
            'brain-box__trail--now': index === reviewIndex,
          }"
        >{{ index + 1 }}</li>
      </ol>
      <section class="brain-box__paper brain-box__flip" :class="{ 'brain-box__flip--open': flipped }" data-box-flip>
        <div class="brain-box__locus"><b aria-hidden="true">{{ reviewScene.locus.emoji }}</b><span>{{ locusNumber(reviewIndex) }}. {{ reviewScene.locus.name }}</span></div>
        <p v-if="reviewScene.ask" class="brain-box__ask">{{ reviewScene.ask }}</p>
        <template v-if="!flipped">
          <p class="brain-box__question">この場所に、何を置いたかな？<br>頭の中で思い出してから、めくってね。</p>
          <div class="brain-box__back" aria-hidden="true"><span>？</span></div>
        </template>
        <template v-else>
          <p class="brain-box__answer" data-box-answer>{{ reviewScene.item.word }}</p>
          <p class="brain-box__cue"><small>置いた絵</small>{{ reviewScene.image }}</p>
        </template>
      </section>
      <div class="brain-game__actions">
        <button v-if="!flipped" type="button" class="brain-cta brain-box__flip-button" data-box-flip-open @click="flipCard">めくる</button>
        <div v-else class="brain-box__grade">
          <button type="button" class="brain-box__yes" data-box-yes @click="grade(true)">○ 思い出せた</button>
          <button type="button" class="brain-box__no" data-box-no @click="grade(false)">× 出なかった</button>
        </div>
      </div>
      <p v-if="flipped && reviewIndex === 0" class="brain-box__hint">言葉がだいたい合っていれば「思い出せた」でいいよ。</p>
    </template>

    <!-- 思い出した結果 -->
    <template v-else-if="phase === 'result' && outcome && resultBox">
      <section class="brain-box__paper brain-box__result" data-box-result>
        <p class="brain-box__detail-head"><span aria-hidden="true">{{ resultBox.emoji }}</span> {{ resultBox.title }}</p>
        <p class="brain-box__score"><b>{{ outcome.correct }}</b> / {{ outcome.total }} 思い出せた</p>
        <ol class="brain-box__steps brain-box__steps--result" aria-label="箱の段">
          <li
            v-for="(days, index) in REVIEW_DAYS"
            :key="days"
            :class="{ 'brain-box__steps--on': index < outcome.stage, 'brain-box__steps--new': outcome.passed && index === outcome.stage - 1 }"
          >{{ intervalText(days) }}</li>
          <li class="brain-box__steps-shelf" :class="{ 'brain-box__steps--on brain-box__steps--new': outcome.shelved }">宝物</li>
        </ol>
        <p class="brain-box__result-text">{{ resultText }}</p>
      </section>
      <div class="brain-game__actions">
        <button type="button" class="brain-game__primary" data-box-result-next @click="afterResult">{{ nextLabel || "箱へ戻る" }}</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type PropType } from "vue";
import {
  BOX_ITEM_MAX,
  BOX_ITEM_MIN,
  BOX_MAX,
  REVIEW_DAYS,
  SHELF_STAGE,
  boxRange,
  daysBetween,
  dueText,
  freeStart,
  intervalText,
  removeBox,
  restoreBox,
  sinceText,
} from "../core/memory-box.mjs";
import {
  addTreasureBox,
  boxBlocker,
  boxLoci,
  loadMemoryStore,
  reviewTreasureBox,
  treasurePalaceOf,
  treasureScenes,
  treasureSets,
} from "../core/memory-palace.mjs";

type Store = ReturnType<typeof loadMemoryStore>;
type Box = Store["boxes"][number];
type SetItem = { word: string; ask?: string; cue?: string; picture?: string; emoji?: string };
type TreasureSet = { id: string; title: string; emoji: string; desc: string; items: SetItem[] };
type Locus = { name: string; emoji: string; kind?: string };
type Scene = { locus: Locus; item: { word: string; emoji: string }; ask: string; image: string; imageOptions: string[] };
type Outcome = NonNullable<ReturnType<typeof reviewTreasureBox>["outcome"]>;

const props = defineProps({
  store: { type: Object as PropType<Store>, required: true },
  day: { type: String, required: true },
  charaUrl: { type: String, required: true },
  /** list(箱の一覧)・catalog(講9から、目録を開く)・review(今日の稽古から、時期の来た組を思い出す)。 */
  start: { type: String as PropType<"list" | "catalog" | "review">, default: "list" },
  reviewId: { type: String, default: "" },
  /** 結果のあとのボタンの言葉(今日の稽古の続きがあるとき「つぎへ（毎日の練習）」)。空なら箱へ戻る。 */
  nextLabel: { type: String, default: "" },
});
const emit = defineEmits<{
  (event: "save", patch: Partial<Store>): void;
  (event: "sound", kind: "correct" | "miss" | "place" | "finish" | "best"): void;
  (event: "added", box: Box): void;
  (event: "reviewed", outcome: Outcome): void;
  (event: "next"): void;
  (event: "build"): void;
}>();

const UNDO_MS = 5000;
const phase = ref<"list" | "detail" | "catalog" | "write" | "place" | "placed" | "review" | "relearn" | "result">("list");
const sets = treasureSets() as TreasureSet[];
// 一覧
const selectedId = ref("");
const undo = ref<{ box: Box; index: number } | null>(null);
let undoTimer: ReturnType<typeof setTimeout> | null = null;
// 入れる
const draft = ref<{ set: string; title: string; emoji: string; items: SetItem[] } | null>(null);
const pics = ref<number[]>([]);
const stepIndex = ref(0);
const placedBox = ref<Box | null>(null);
const customTitle = ref("");
const customRows = ref<string[]>(["", "", "", "", ""]);
// 思い出す
const reviewBoxId = ref("");
const reviewIndex = ref(0);
const flipped = ref(false);
const grades = ref<(boolean | undefined)[]>([]);
const outcome = ref<Outcome | null>(null);
const resultBox = ref<Box | null>(null);
const relearnIndexes = ref<number[]>([]);

onBeforeUnmount(() => {
  if (undoTimer) clearTimeout(undoTimer);
});

const treasure = computed(() => treasurePalaceOf(props.store) as { id: string; name: string; loci: Locus[] } | null);
/** 宝物用の宮殿の短い名前(見本の宮殿は「見本のお城」)。 */
const palaceName = computed(() => (treasure.value?.id === "castle" ? "見本のお城" : treasure.value?.name ?? "宮殿"));
const blocker = computed(() => boxBlocker(props.store, BOX_ITEM_MIN));
const freeCount = computed(() => {
  const loci = treasure.value?.loci.length ?? 0;
  const used = new Set<number>();
  for (const box of props.store.boxes) {
    const [from, to] = boxRange(box);
    for (let index = from; index < to; index += 1) used.add(index);
  }
  let best = 0;
  let run = 0;
  for (let index = 0; index < loci; index += 1) {
    run = used.has(index) ? 0 : run + 1;
    best = Math.max(best, run);
  }
  return best;
});
const listMessage = computed(() => {
  const due = props.store.boxes.find((box) => box.next <= props.day);
  if (due) return `「${due.title}」を思い出す日だよ。場所を見て、頭の中で思い出してから札をめくってね。`;
  const next = [...props.store.boxes].sort((a, b) => (a.next < b.next ? -1 : 1))[0];
  if (next) return `次は${dateText(next.next)}に「${next.title}」。日をあけてから思い出すほうが、長く残るよ。`;
  if (props.store.shelf.length) return "宝物の棚がふえてきたね。また長く覚えておきたいものを入れてみよう。";
  return "長く覚えておきたいものは、間をあけて何度か思い出すと残りやすいよ。";
});
const selected = computed(() => props.store.boxes.find((box) => box.id === selectedId.value) ?? null);
const selectedLoci = computed(() => (selected.value ? boxLoci(props.store, selected.value) : []));

// ===== 入れる =====
const customItems = computed(() => customRows.value.map((row) => row.trim()).filter(Boolean));
/** 置く場所(空いた場所の最初から)。 */
const placeLoci = computed<Locus[]>(() => {
  const loci = treasure.value?.loci ?? [];
  const start = draft.value ? freeStart(props.store.boxes, loci.length, draft.value.items.length) : -1;
  return start < 0 || !draft.value ? [] : loci.slice(start, start + draft.value.items.length);
});
const placeStart = computed(() => {
  const loci = treasure.value?.loci ?? [];
  return draft.value ? freeStart(props.store.boxes, loci.length, draft.value.items.length) : 0;
});
const placeScenes = computed(() => (draft.value && placeLoci.value.length ? treasureScenes(placeLoci.value, draft.value.items, pics.value) as Scene[] : []));

function setInBox(set: TreasureSet) {
  return props.store.boxes.some((box) => box.set === set.id);
}
function setBlocked(set: TreasureSet) {
  return setInBox(set) || boxBlocker(props.store, set.items.length) !== "";
}
function setNote(set: TreasureSet) {
  if (setInBox(set)) return "箱に入っている";
  if (boxBlocker(props.store, set.items.length) === "room") return `場所があと${set.items.length - freeCount.value}か所たりない`;
  if (props.store.shelf.some((entry) => entry.set === set.id)) return "宝物の棚にある";
  return "";
}
function choose(set: TreasureSet) {
  startPlace({ set: set.id, title: set.title, emoji: set.emoji, items: set.items.map((item) => ({ ...item })) });
}
function openWrite() {
  customTitle.value = "";
  customRows.value = ["", "", "", "", ""];
  phase.value = "write";
}
function chooseCustom() {
  startPlace({ set: "custom", title: customTitle.value.trim() || "自分の組", emoji: "✏️", items: customItems.value.map((word) => ({ word, emoji: "📝" })) });
}
function startPlace(next: { set: string; title: string; emoji: string; items: SetItem[] }) {
  draft.value = next;
  pics.value = next.items.map(() => 0);
  stepIndex.value = 0;
  phase.value = "place";
}
function otherPicture() {
  const index = currentIndex.value;
  pics.value = pics.value.map((pic, at) => (at === index ? pic + 1 : pic));
}

// ===== 置く・覚え直す(同じ画面) =====
const stepList = computed<number[]>(() => (phase.value === "relearn" ? relearnIndexes.value : placeScenes.value.map((_, index) => index)));
const currentIndex = computed(() => stepList.value[stepIndex.value] ?? 0);
const current = computed(() => {
  const list = phase.value === "relearn" ? reviewScenes.value : placeScenes.value;
  const sceneItem = list[currentIndex.value];
  if (!sceneItem) return null;
  return { ...sceneItem, index: currentIndex.value, count: sceneItem.imageOptions.length };
});
const stepLabel = computed(() => {
  const last = stepIndex.value + 1 >= stepList.value.length;
  if (phase.value === "relearn") return last ? "見直した" : "見直した → 次へ";
  return last ? "箱に入れる" : "思いうかべた → 次へ";
});
function locusNumber(index: number) {
  if (phase.value === "place") return placeStart.value + index + 1;
  const box = phase.value === "relearn" || phase.value === "review" ? reviewBox.value : null;
  return (box?.start ?? 0) + index + 1;
}
function nextStep() {
  emit("sound", "place");
  if (stepIndex.value + 1 < stepList.value.length) {
    stepIndex.value += 1;
    return;
  }
  if (phase.value === "relearn") {
    phase.value = "result";
    return;
  }
  commitPlace();
}
function commitPlace() {
  if (!draft.value) return;
  const result = addTreasureBox(props.store, { ...draft.value, pics: pics.value }, props.day);
  if (!result.box) {
    phase.value = "list";
    return;
  }
  emit("save", { boxes: result.store.boxes, treasurePalace: result.store.treasurePalace });
  emit("added", result.box as Box);
  placedBox.value = result.box as Box;
  phase.value = "placed";
}

// ===== 思い出す =====
const reviewBox = computed(() => props.store.boxes.find((box) => box.id === reviewBoxId.value) ?? resultBox.value);
const reviewScenes = computed<Scene[]>(() => {
  const box = reviewBox.value;
  return box ? treasureScenes(boxLoci(props.store, box), box.items, box.pics) as Scene[] : [];
});
const reviewScene = computed(() => reviewScenes.value[reviewIndex.value] ?? null);
function openCard(id: string) {
  const box = props.store.boxes.find((item) => item.id === id);
  if (!box) return;
  if (box.next <= props.day) startReview(id);
  else {
    selectedId.value = id;
    phase.value = "detail";
  }
}
function startReview(id: string) {
  reviewBoxId.value = id;
  reviewIndex.value = 0;
  flipped.value = false;
  grades.value = [];
  outcome.value = null;
  resultBox.value = null;
  phase.value = "review";
}
function flipCard() {
  flipped.value = true;
  emit("sound", "place");
}
function grade(ok: boolean) {
  grades.value = [...grades.value.slice(0, reviewIndex.value), ok];
  emit("sound", ok ? "correct" : "miss");
  if (reviewIndex.value + 1 < reviewScenes.value.length) {
    reviewIndex.value += 1;
    flipped.value = false;
    return;
  }
  finishReview();
}
function finishReview() {
  const box = reviewBox.value;
  if (!box) return;
  const results = reviewScenes.value.map((_, index) => grades.value[index] === true);
  resultBox.value = box;
  sinceDays.value = Math.max(1, daysBetween(box.last || box.added, props.day));
  const reviewed = reviewTreasureBox(props.store, box.id, results, props.day);
  if (!reviewed.outcome) return;
  outcome.value = reviewed.outcome;
  emit("save", { boxes: reviewed.store.boxes, shelf: reviewed.store.shelf });
  emit("reviewed", reviewed.outcome);
  emit("sound", reviewed.outcome.shelved ? "best" : reviewed.outcome.passed ? "finish" : "place");
  if (!reviewed.outcome.passed) {
    relearnIndexes.value = reviewed.outcome.missed.map((missed, index) => (missed ? index : -1)).filter((index) => index >= 0);
    if (relearnIndexes.value.length) {
      stepIndex.value = 0;
      phase.value = "relearn";
      return;
    }
  }
  phase.value = "result";
}
const sinceDays = ref(1);
const resultText = computed(() => {
  const result = outcome.value;
  if (!result) return "";
  const since = intervalText(sinceDays.value);
  if (result.shelved) return `${since}たっても${result.correct}個思い出せた。もう宝物だね！ 宝物の棚に入れたよ。`;
  const next = `次は${intervalText(REVIEW_DAYS[result.stage])}あと（${dateText(result.next)}）`;
  if (result.passed) return `${since}たっても${result.correct}個思い出せた！ ${next}。`;
  return `今日は${result.total}個中${result.correct}個。出なかった絵を見直したから大丈夫。${next}に、もう一度思い出そう。`;
});
function afterResult() {
  if (props.nextLabel) {
    emit("next");
    return;
  }
  phase.value = "list";
}
// ===== 外す(5秒の取り消す。14-6) =====
function removeSelected() {
  const { boxes, removed, index } = removeBox(props.store.boxes, selectedId.value);
  if (!removed) return;
  emit("save", { boxes });
  if (undoTimer) clearTimeout(undoTimer);
  undo.value = { box: removed, index };
  undoTimer = setTimeout(() => {
    undo.value = null;
  }, UNDO_MS);
  phase.value = "list";
}
function undoRemove() {
  if (!undo.value) return;
  emit("save", { boxes: restoreBox(props.store.boxes, undo.value.box, undo.value.index) });
  undo.value = null;
  if (undoTimer) clearTimeout(undoTimer);
}

// ===== 言い方 =====
function dateText(day: string) {
  return day ? `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日` : "";
}
function rangeText(box: Box) {
  const [from, to] = boxRange(box);
  return `${palaceName.value} ${from + 1}〜${to}か所目`;
}

// 始め方
if (props.start === "catalog") phase.value = "catalog";
else if (props.start === "review" && props.reviewId && props.store.boxes.some((box) => box.id === props.reviewId)) startReview(props.reviewId);

/** 戻る操作。箱の中の画面なら一覧へ戻り、一覧(と今日の稽古から始めた思い出し)は道場の画面に任せる。 */
function goBack() {
  if (phase.value === "list") return false;
  if (props.start === "review" && (phase.value === "review" || phase.value === "relearn" || phase.value === "result")) return false;
  if (phase.value === "write") phase.value = "catalog";
  else if (phase.value === "place") phase.value = draft.value?.set === "custom" ? "write" : "catalog";
  else phase.value = "list";
  return true;
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .brain-box { display: grid; gap: 0.75rem; align-content: start; width: min(100%, 36rem); margin: 0 auto; }
.shogi-game .brain-box__paper {
  display: grid;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: var(--dojo-radius, 14px);
  color: var(--dojo-ink, #1f2a33);
  background: repeating-linear-gradient(0deg, transparent 0 27px, rgba(160, 130, 80, 0.06) 27px 28px), var(--dojo-paper, #fbf7ee);
  box-shadow: var(--dojo-shadow, none);
}
.shogi-game .brain-box__paper p { margin: 0; }
.shogi-game .brain-box__muted { margin: 0; color: var(--dojo-ink-2, #56636d); font-size: 0.86rem; font-weight: 700; line-height: 1.6; }
.shogi-game .brain-box > .brain-box__muted { color: var(--dojo-light-2, #b9c6d0); text-align: center; }
/* 間隔の5段(14-6の8)。 */
.shogi-game .brain-box__spacing { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; margin: 0; padding: 0; list-style: none; text-align: center; }
.shogi-game .brain-box__spacing li { padding: 0.35rem 0; border-radius: 8px; color: var(--dojo-light-2, #b9c6d0); background: var(--dojo-desk-2, #243746); font-size: 0.72rem; font-weight: 800; }
.shogi-game .brain-box__spacing b { display: block; color: var(--dojo-light, #fffcf4); font-size: 0.92rem; }
.shogi-game .brain-box__where { margin: 0; color: var(--dojo-light-2, #b9c6d0); font-size: 0.8rem; font-weight: 700; text-align: center; }
.shogi-game .brain-box__list { display: grid; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-box__card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.2rem 0.7rem;
  align-items: center;
  width: 100%;
  min-height: 64px;
  padding: 0.65rem 0.8rem;
  border: 2px solid transparent;
  border-radius: var(--dojo-radius, 14px);
  color: var(--dojo-ink, #1f2a33);
  background: var(--dojo-paper, #fbf7ee);
  box-shadow: var(--dojo-shadow, none);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.shogi-game .brain-box__card--due { border-color: var(--dojo-ai, #34488f); }
.shogi-game .brain-box__icon { grid-row: 1 / 4; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 10px; background: var(--dojo-ai-soft, #dde3f4); font-size: 1.35rem; }
.shogi-game .brain-box__card strong { grid-column: 2; font-size: 1rem; }
.shogi-game .brain-box__card small { grid-column: 2; color: var(--dojo-ink-2, #56636d); font-size: 0.76rem; font-weight: 700; }
.shogi-game .brain-box__due { grid-column: 3; grid-row: 1 / 4; padding: 0.25rem 0.7rem; border-radius: 999px; color: var(--dojo-ink-2, #56636d); background: var(--dojo-paper-2, #f3ecdc); font-size: 0.8rem; font-weight: 900; white-space: nowrap; }
.shogi-game .brain-box__card--due .brain-box__due { color: #fff; background: var(--dojo-ai, #34488f); }
.shogi-game .brain-box__ladder { grid-column: 2; display: flex; gap: 3px; }
.shogi-game .brain-box__ladder i { width: 16px; height: 6px; border-radius: 3px; background: var(--dojo-rule, #e6dcc6); }
.shogi-game .brain-box__ladder .brain-box__ladder--on { background: var(--dojo-ai, #34488f); }
.shogi-game .brain-box__empty,
.shogi-game .brain-box__note { margin: 0; color: var(--dojo-light-2, #b9c6d0); font-size: 0.86rem; font-weight: 700; text-align: center; }
.shogi-game .brain-box__add { --room: var(--dojo-ai, #34488f); --room-deep: var(--dojo-ai-deep, #26356c); width: 100%; }
.shogi-game .brain-box__add:disabled { opacity: 0.45; }
.shogi-game .brain-box__shelf { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-box__shelf li { display: inline-flex; align-items: baseline; gap: 0.3rem; padding: 0.3rem 0.65rem; border-radius: 8px; color: var(--dojo-gold, #8a5f00); background: var(--dojo-gold-soft, #f6e7bf); font-size: 0.82rem; font-weight: 900; }
.shogi-game .brain-box__shelf small { font-size: 0.7rem; font-weight: 700; opacity: 0.8; }
.shogi-game .brain-box__toast {
  position: sticky;
  bottom: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  padding: 0.5rem 0.6rem 0.5rem 0.9rem;
  border-radius: 12px;
  color: var(--dojo-light, #fffcf4);
  background: var(--dojo-desk-3, #2d4456);
  box-shadow: var(--dojo-shadow, none);
  font-size: 0.88rem;
  font-weight: 800;
}
.shogi-game .brain-box__toast button { min-height: 44px; padding: 0 0.9rem; border: 0; border-radius: 999px; color: var(--dojo-ink, #1f2a33); background: var(--dojo-now, #f1a54c); box-shadow: none; font: inherit; font-weight: 900; }
/* 組のくわしい札 */
.shogi-game .brain-box__detail-head { font-size: 1.05rem; font-weight: 900; }
.shogi-game .brain-box__loci { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-box__loci li { padding: 0.2rem 0.5rem; border-radius: 999px; background: var(--dojo-paper-2, #f3ecdc); font-size: 0.78rem; font-weight: 800; }
.shogi-game .brain-box__loci span { margin-right: 0.2rem; }
/* 目録 */
.shogi-game .brain-box__catalog { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-box__set { width: 100%; height: 100%; }
.shogi-game .brain-box__set:disabled { opacity: 0.55; cursor: default; }
.shogi-game .brain-box__set-note { color: #f0c870; font-size: 0.72rem; font-weight: 900; }
/* 自分で書く */
.shogi-game .brain-box__write ol { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-box__write li { display: grid; grid-template-columns: 1.6rem minmax(0, 1fr); align-items: center; gap: 0.4rem; }
.shogi-game .brain-box__write li span { color: var(--dojo-ai, #34488f); font-weight: 900; text-align: right; }
.shogi-game .brain-box__write input,
.shogi-game .brain-box__title-input input {
  width: 100%;
  min-height: 44px;
  padding: 0 0.7rem;
  border: 2px solid var(--dojo-rule, #e6dcc6);
  border-radius: 10px;
  color: var(--dojo-ink, #1f2a33);
  background: #fff;
  font: inherit;
  font-size: 1rem;
}
.shogi-game .brain-box__write input:focus-visible,
.shogi-game .brain-box__title-input input:focus-visible { outline: 2px solid var(--dojo-now, #f1a54c); outline-offset: 1px; }
.shogi-game .brain-box__title-input { display: grid; gap: 0.25rem; color: var(--dojo-ink-2, #56636d); font-size: 0.82rem; font-weight: 800; }
.shogi-game .brain-box__add-row { justify-self: start; min-height: 44px; padding: 0 0.9rem; border: 2px dashed var(--dojo-rule, #e6dcc6); border-radius: 999px; color: var(--dojo-ink-2, #56636d); background: transparent; box-shadow: none; font: inherit; font-weight: 800; }
.shogi-game .brain-box__ask-note { color: var(--dojo-ai, #34488f); font-size: 0.9rem; font-weight: 900; }
.shogi-game .brain-palace__item.brain-box__item--long { font-size: 1.35rem; line-height: 1.35; }
/* 入れた日・結果 */
.shogi-game .brain-box__done { justify-items: center; text-align: center; }
.shogi-game .brain-box__done h2 { margin: 0; font-size: 1.15rem; }
.shogi-game .brain-box__done-icon { font-size: 2.4rem; line-height: 1; }
/* 段の目盛り(1日・3日・1週間・2週間・1か月・宝物)。横1列のバーで、届いた段を塗る。 */
.shogi-game .brain-box__steps { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; width: 100%; margin: 0.2rem 0 0; padding: 0; list-style: none; }
.shogi-game .brain-box__steps li { display: grid; justify-items: center; gap: 3px; min-width: 0; color: var(--dojo-ink-2, #56636d); font-size: 0.72rem; font-weight: 900; white-space: nowrap; }
.shogi-game .brain-box__steps li::before { content: ""; width: 100%; height: 8px; border-radius: 4px; background: var(--dojo-rule, #e6dcc6); }
.shogi-game .brain-box__steps .brain-box__steps-shelf { color: var(--dojo-gold, #8a5f00); }
.shogi-game .brain-box__steps .brain-box__steps-shelf::before { background: var(--dojo-gold-soft, #f6e7bf); }
.shogi-game .brain-box__steps .brain-box__steps--on { color: var(--dojo-ai, #34488f); }
.shogi-game .brain-box__steps .brain-box__steps--on::before { background: var(--dojo-ai, #34488f); }
.shogi-game .brain-box__steps .brain-box__steps-shelf.brain-box__steps--on { color: var(--dojo-gold, #8a5f00); }
.shogi-game .brain-box__steps .brain-box__steps-shelf.brain-box__steps--on::before { background: #e0b84a; }
.shogi-game .brain-box__steps .brain-box__steps--new::before { animation: brain-box-pop 420ms ease-out 200ms both; }
.shogi-game .brain-box__result { text-align: center; }
.shogi-game .brain-box__score { font-size: 1.05rem; font-weight: 800; }
.shogi-game .brain-box__score b { font-size: 2.2rem; color: var(--dojo-ai, #34488f); }
.shogi-game .brain-box__result-text { font-weight: 800; line-height: 1.6; }
/* めくり札(14-6の9) */
.shogi-game .brain-box__trail { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; margin: 0; padding: 0; list-style: none; }
.shogi-game .brain-box__trail li { display: grid; place-items: center; width: 28px; height: 28px; border: 2px solid rgba(255, 252, 244, 0.22); border-radius: 8px; color: var(--dojo-light-2, #b9c6d0); background: var(--dojo-desk-2, #243746); font-size: 0.8rem; font-weight: 900; }
.shogi-game .brain-box__trail .brain-box__trail--ok { color: #5a3a00; border-color: #f6c46a; background: radial-gradient(circle at 50% 40%, #ffe7a8, #f1a54c 70%); }
.shogi-game .brain-box__trail .brain-box__trail--miss { border-style: dashed; opacity: 0.7; }
.shogi-game .brain-box__trail .brain-box__trail--now { color: var(--dojo-light, #fffcf4); border-color: var(--dojo-now, #f1a54c); box-shadow: 0 0 0 3px rgba(241, 165, 76, 0.3); }
.shogi-game .brain-box__flip { justify-items: center; text-align: center; }
.shogi-game .brain-box__locus { display: grid; justify-items: center; gap: 0.1rem; }
.shogi-game .brain-box__locus b { font-size: 2.4rem; line-height: 1; }
.shogi-game .brain-box__locus span { color: var(--dojo-ai, #34488f); font-size: 1.05rem; font-weight: 900; }
.shogi-game .brain-box__ask { padding: 0.15rem 0.8rem; border-radius: 999px; color: #fff; background: var(--dojo-ai, #34488f); font-size: 0.95rem; font-weight: 900; }
.shogi-game .brain-box__question { color: var(--dojo-ink-2, #56636d); font-size: 0.9rem; font-weight: 800; line-height: 1.6; }
.shogi-game .brain-box__back {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 4.2rem;
  border-radius: 12px;
  background: repeating-linear-gradient(45deg, var(--dojo-ai, #34488f) 0 10px, var(--dojo-ai-deep, #26356c) 10px 20px);
}
.shogi-game .brain-box__back span { display: grid; place-items: center; width: 2.6rem; height: 2.6rem; border-radius: 50%; color: var(--dojo-ai, #34488f); background: var(--dojo-paper, #fbf7ee); font-size: 1.4rem; font-weight: 900; }
.shogi-game .brain-box__answer {
  width: 100%;
  padding: 0.7rem;
  border: 2px dashed var(--dojo-ai, #34488f);
  border-radius: 12px;
  background: #fff;
  font-size: 1.35rem;
  font-weight: 900;
  animation: brain-box-flip 240ms ease-out both;
}
.shogi-game .brain-box__cue { width: 100%; font-size: 0.92rem; font-weight: 700; line-height: 1.6; text-align: left; }
.shogi-game .brain-box__cue small { display: block; color: var(--dojo-ai, #34488f); font-size: 0.72rem; font-weight: 900; letter-spacing: 0.06em; }
.shogi-game .brain-box__flip-button { --room: var(--dojo-ai, #34488f); --room-deep: var(--dojo-ai-deep, #26356c); min-width: 12rem; }
.shogi-game .brain-box__grade { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; width: 100%; }
.shogi-game .brain-box__grade button { min-height: 56px; border: 0; border-radius: 14px; font: inherit; font-size: 1.05rem; font-weight: 900; cursor: pointer; }
.shogi-game .brain-box__yes { color: #fff; background: var(--dojo-good, #2e7d4f); box-shadow: 0 3px 0 #1f5a37; }
.shogi-game .brain-box__no { color: var(--dojo-ink, #1f2a33); background: var(--dojo-paper-2, #f3ecdc); box-shadow: 0 3px 0 #c9bfa9; }
.shogi-game .brain-box__grade button:focus-visible { outline: 3px solid var(--dojo-now, #f1a54c); outline-offset: 2px; }
.shogi-game .brain-box__hint { margin: 0; color: var(--dojo-light-2, #b9c6d0); font-size: 0.8rem; font-weight: 700; text-align: center; }
@keyframes brain-box-flip { from { transform: scaleX(0.2); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }
@keyframes brain-box-pop { 0% { transform: scale(0.6); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
/* 全体のボタンの書式(灰色の地)に負けないよう、:not(:disabled)をつけて紙の色のまま縁だけ光らせる。 */
@media (hover: hover) {
  .shogi-game .brain-box__card:not(:disabled):hover { border-color: var(--dojo-now, #f1a54c); background-color: var(--dojo-paper, #fbf7ee); }
  .shogi-game .brain-box__yes:not(:disabled):hover { background-color: #348a58; }
  .shogi-game .brain-box__no:not(:disabled):hover { background-color: #f8f2e4; }
  .shogi-game .brain-box__toast button:not(:disabled):hover { background-color: #f6b968; }
  .shogi-game .brain-box__add-row:not(:disabled):hover { background-color: transparent; border-color: var(--dojo-now, #f1a54c); }
}
.shogi-game .brain-box__card:focus-visible { outline: 3px solid var(--dojo-now, #f1a54c); outline-offset: 2px; }
/* 横向きの低い画面: めくり札を左、めくる・○×を右に並べて1画面に収める。 */
@media (orientation: landscape) and (max-height: 600px) {
  .shogi-game .brain-box__locus b { font-size: 1.8rem; }
  .shogi-game .brain-box__back { min-height: 3rem; }
  .shogi-game .brain-box__paper { padding: 0.7rem 0.9rem; gap: 0.35rem; }
  .shogi-game .brain-box--review {
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    grid-template-areas: "status status" "trail trail" "card actions" "card hint";
    align-items: center;
    width: min(100%, 48rem);
    gap: 0.5rem 0.9rem;
  }
  .shogi-game .brain-box--review > .brain-game__status { grid-area: status; }
  .shogi-game .brain-box--review > .brain-box__trail { grid-area: trail; }
  .shogi-game .brain-box--review > .brain-box__flip { grid-area: card; }
  .shogi-game .brain-box--review > .brain-game__actions { grid-area: actions; align-self: end; }
  .shogi-game .brain-box--review > .brain-box__hint { grid-area: hint; align-self: start; }
  .shogi-game .brain-box--review .brain-box__grade { grid-template-columns: minmax(0, 1fr); }
  .shogi-game .brain-box--review .brain-box__flip-button { min-width: 0; width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .shogi-game .brain-box__answer,
  .shogi-game .brain-box__steps .brain-box__steps--new { animation: none; }
}
</style>
