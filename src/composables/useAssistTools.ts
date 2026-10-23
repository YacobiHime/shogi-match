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
    const count = primaryCount.value + 3;
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
    if (actions.value) observer.observe(actions.value);
    measure();
    window.addEventListener("pointerdown", outside);
  });
  onBeforeUnmount(() => {
    observer?.disconnect();
    window.removeEventListener("pointerdown", outside);
  });
  return { tools, collapsed, open, close, sync };
}
