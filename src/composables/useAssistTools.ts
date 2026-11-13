import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";

/** Keep display tools inline only when every button has room at its normal size. */
export function useAssistTools(actions: Ref<HTMLElement | null>, fontSize: Ref<number>, primaryCount: Ref<number>) {
  const tools = ref<HTMLDetailsElement | null>(null);
  const collapsed = ref(true);
  const open = ref(false);
  let observer: ResizeObserver | undefined;

  function measure() {
    const element = actions.value;
    if (!element?.clientWidth) return;
    const style = getComputedStyle(element);
    const minimum = parseFloat(style.getPropertyValue("--assist-button-min-em")) || 5.5;
    const gap = parseFloat(style.columnGap) || 0;
    // 表示補助のボタンの数は、並べてあるボタンから数える(足しても数え直さなくてよい。docs/stable-board-layout-design.mdの8-1)。
    const toolCount = tools.value?.querySelectorAll(".shogi-game__display-tools-buttons > button").length || 6;
    const count = primaryCount.value + toolCount;
    // Primary buttons can have a slightly larger font than the row itself.
    const buttonFont = parseFloat(getComputedStyle(element.querySelector("button") ?? element).fontSize) || fontSize.value;
    const unit = Math.max(fontSize.value, buttonFont);
    collapsed.value = element.clientWidth < count * minimum * unit + (count - 1) * gap;
  }
  function close(focus = false) {
    if (!collapsed.value || !open.value) return;
    open.value = false;
    if (focus) tools.value?.querySelector("summary")?.focus();
  }
  function sync(event: Event) {
    if (collapsed.value) open.value = (event.currentTarget as HTMLDetailsElement).open;
  }
  function outside(event: PointerEvent) {
    if (tools.value && !event.composedPath().includes(tools.value)) close();
  }
  watch(collapsed, () => { open.value = false; });
  watch([fontSize, primaryCount], () => void nextTick(measure));
  onMounted(() => {
    observer = new ResizeObserver(measure);
    // 操作の列はホームのあとに出るので、出たとき(入れ替わったとき)に見張りを付け直す。
    watch(actions, (element, previous) => {
      if (previous) observer?.unobserve(previous);
      if (element) {
        observer?.observe(element);
        void nextTick(measure);
      }
    }, { immediate: true });
    window.addEventListener("pointerdown", outside);
  });
  onBeforeUnmount(() => {
    observer?.disconnect();
    window.removeEventListener("pointerdown", outside);
  });
  return { tools, collapsed, open, close, sync };
}
