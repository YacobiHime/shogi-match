import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";

export type BoardLayout = "standard" | "compact" | "portrait";
export type UiLayout = "wide" | "side" | "stack";

type ResponsiveLayoutOptions = {
  analysisVisible: Ref<boolean>;
};

// 盤描画の外枠寸法（src/renderer/view/primitive/board/params.ts）。どれも9x9の盤は878x960。
const BOARD_FRAMES = {
  standard: { width: 1471, height: 959 },
  compact: { width: 1088, height: 1015 },
  portrait: { width: 878, height: 1168 },
} as const;
type BoardFrameName = keyof typeof BOARD_FRAMES;

// 縦積みで盤以外に要る高さと、横並びの情報欄に要る幅の見積もり。
const STACK_RESERVED_EM = 19;
const STACK_ANALYSIS_RESERVED_EM = 26;
const SIDE_COLUMN_MIN_EM = 17;
const WIDE_COLUMNS_MIN_EM = 33;
const PHONE_ASPECT_RATIO = 1.5;
const PHONE_PORTRAIT_TOLERANCE = 0.8;

export function fitBoardFrame(
  names: BoardFrameName[],
  width: number,
  height: number,
  preferred: { name: BoardFrameName; tolerance: number } = { name: "compact", tolerance: 0.9 },
) {
  const fits = names.map((name) => {
    const frame = BOARD_FRAMES[name];
    const scale = Math.max(0, Math.min(width / frame.width, height / frame.height));
    return { name, scale, width: frame.width * scale, height: frame.height * scale };
  });
  const best = fits.reduce((a, b) => (b.scale > a.scale ? b : a));
  const favored = fits.find(({ name }) => name === preferred.name);
  return favored && favored.scale >= best.scale * preferred.tolerance ? favored : best;
}

/** 縦積みで優先する駒台配置。スマホの縦長画面では上下、それ以外はcompact。 */
export function stackPreferredFrame(width: number, height: number) {
  return height / width >= PHONE_ASPECT_RATIO
    ? { name: "portrait" as const, tolerance: PHONE_PORTRAIT_TOLERANCE }
    : { name: "compact" as const, tolerance: 0.9 };
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useResponsiveLayout({ analysisVisible }: ResponsiveLayoutOptions) {
  const boardLayout = ref<BoardLayout>("standard");
  const boardShell = ref<HTMLElement | null>(null);
  const gameRoot = ref<HTMLElement | null>(null);
  const uiLayout = ref<UiLayout>("stack");
  const uiFontPx = ref(15);
  const uiBoardSize = ref({ width: 0, height: 0 });
  const uiShort = ref(false);
  const uiNarrow = ref(false);
  const menuCollapsed = computed(() => uiLayout.value !== "wide");
  const uiLayoutStyle = computed(() => ({
    "--ui-font": `${uiFontPx.value}px`,
    "--board-w": `${Math.floor(uiBoardSize.value.width)}px`,
    "--board-h": `${Math.floor(uiBoardSize.value.height)}px`,
  }));
  let boardResizeObserver: ResizeObserver | undefined;

  function updateStackBoardFrame() {
    const shell = boardShell.value;
    if (uiLayout.value !== "stack" || !shell) return;
    const { clientWidth, clientHeight } = shell;
    const root = gameRoot.value;
    if (!clientWidth || !clientHeight || !root) return;
    boardLayout.value = fitBoardFrame(
      ["portrait", "compact", "standard"],
      clientWidth,
      clientHeight,
      stackPreferredFrame(root.clientWidth, root.clientHeight),
    ).name;
  }

  function updateUiLayout() {
    const root = gameRoot.value;
    if (!root) return;
    const width = root.clientWidth;
    const height = root.clientHeight;
    if (!width || !height) return;

    const sideFont = clampNumber(Math.min(height / 50, width / 70), 13, 20);
    const sidePad = sideFont * 0.6;
    const sideBoard = fitBoardFrame(
      ["compact", "standard"],
      width - sideFont * SIDE_COLUMN_MIN_EM - sidePad * 3,
      height - sidePad * 2,
    );

    const stackFont = clampNumber(Math.min(width / 26, height / 46), 13, 18);
    const stackPad = stackFont * 0.45;
    const stackBoard = fitBoardFrame(
      ["portrait", "compact", "standard"],
      width - stackPad * 2,
      height - stackPad * 2 - stackFont * (
        analysisVisible.value ? STACK_ANALYSIS_RESERVED_EM : STACK_RESERVED_EM
      ),
      stackPreferredFrame(width, height),
    );

    if (sideBoard.scale > stackBoard.scale) {
      const sideSpace = width - sideBoard.width - sidePad * 3;
      uiLayout.value = sideSpace >= sideFont * WIDE_COLUMNS_MIN_EM ? "wide" : "side";
      uiFontPx.value = Math.round(sideFont * 10) / 10;
      uiBoardSize.value = { width: sideBoard.width, height: sideBoard.height };
      boardLayout.value = sideBoard.name;
      uiShort.value = height < 560;
      uiNarrow.value = false;
    } else {
      uiLayout.value = "stack";
      uiFontPx.value = Math.round(stackFont * 10) / 10;
      uiBoardSize.value = { width: stackBoard.width, height: stackBoard.height };
      uiShort.value = height < 700;
      uiNarrow.value = width < 600;
      updateStackBoardFrame();
    }
  }

  watch(analysisVisible, () => nextTick(updateUiLayout));

  onMounted(() => {
    updateUiLayout();
    boardResizeObserver = new ResizeObserver((entries) => {
      if (entries.some(({ target }) => target === gameRoot.value)) updateUiLayout();
      else updateStackBoardFrame();
    });
    if (gameRoot.value) boardResizeObserver.observe(gameRoot.value);
    if (boardShell.value) boardResizeObserver.observe(boardShell.value);
  });

  onBeforeUnmount(() => boardResizeObserver?.disconnect());

  return {
    boardLayout,
    boardShell,
    gameRoot,
    menuCollapsed,
    uiBoardSize,
    uiFontPx,
    uiLayout,
    uiLayoutStyle,
    uiNarrow,
    uiShort,
    updateStackBoardFrame,
    updateUiLayout,
  };
}
