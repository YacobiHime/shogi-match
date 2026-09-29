<template>
  <div class="pregame-picker" role="dialog" aria-modal="true" :aria-label="title" @click.self="emit('close')">
    <div class="pregame-picker__panel">
      <header class="pregame-picker__header">
        <h3>{{ title }}</h3>
        <button type="button" class="pregame-picker__close" aria-label="閉じる" @click="emit('close')">×</button>
      </header>
      <div class="pregame-picker__body">
        <section v-for="section in sections" :key="section.key" class="pregame-picker__section">
          <h4 v-if="section.label">{{ section.label }}</h4>
          <template v-for="(group, groupIndex) in section.groups" :key="`${section.key}-${groupIndex}`">
            <p v-if="group.label" class="pregame-picker__group">{{ group.label }}</p>
            <div class="pregame-picker__options" role="radiogroup" :aria-label="group.label || section.label || title">
              <button
                v-for="option in group.options"
                :key="String(option.value)"
                type="button"
                role="radio"
                class="pregame-picker__option"
                :class="{ 'pregame-picker__option--selected': option.value === section.value }"
                :aria-checked="option.value === section.value"
                :disabled="option.disabled"
                @click="emit('select', section.key, option.value)"
              >
                <span>{{ option.label }}</span>
                <small v-if="option.description">{{ option.description }}</small>
              </button>
            </div>
          </template>
        </section>
        <p v-if="note" class="pregame-picker__note">{{ note }}</p>
      </div>
      <!-- 複数の項目をまとめて選ぶときは、選んでも閉じずに「決定」で閉じる。 -->
      <footer v-if="sections.length > 1" class="pregame-picker__footer">
        <button type="button" class="pregame-picker__done" @click="emit('close')">決定</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";

export type PickerValue = string | number;
export type PickerOption = { value: PickerValue; label: string; description?: string; disabled?: boolean };
export type PickerSection = {
  key: string;
  label?: string;
  value: PickerValue;
  groups: { label?: string; options: PickerOption[] }[];
};

defineProps({
  title: { type: String, required: true },
  sections: { type: Array as PropType<PickerSection[]>, required: true },
  note: { type: String, default: "" },
});
const emit = defineEmits<{
  select: [key: string, value: PickerValue];
  close: [];
}>();
</script>

<style>
.pregame-picker {
  position: absolute;
  z-index: 110;
  inset: 0;
  display: grid;
  place-items: center;
  padding: clamp(0.6em, 3vw, 2em);
  background: rgba(23, 38, 50, 0.6);
}
.pregame-picker__panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(32em, 100%);
  max-height: min(40em, 100%);
  overflow: hidden;
  border: 3px solid #c98a3d;
  border-radius: 0.6em;
  color: #1d303f;
  background: #fffcf4;
  box-shadow: 0 1em 2.6em rgba(7, 18, 26, 0.5);
}
.pregame-picker__header {
  position: relative;
  padding: 0.55em 2.8em;
  background: #c98a3d;
  text-align: center;
}
.pregame-picker__header h3 {
  margin: 0;
  color: #fffcf4;
  font-size: 1.1em;
  letter-spacing: 0.08em;
}
.shogi-game .pregame-picker__close {
  position: absolute;
  top: 50%;
  right: 0.4em;
  width: 2em;
  min-height: 2em;
  padding: 0;
  border: 0;
  color: #fffcf4;
  background: transparent;
  box-shadow: none;
  font-size: 1.2em;
  line-height: 1;
  transform: translateY(-50%);
}
.pregame-picker__body {
  display: grid;
  gap: 0.9em;
  align-content: start;
  padding: 0.9em;
  overflow: auto;
  overscroll-behavior: contain;
}
.pregame-picker__section {
  display: grid;
  gap: 0.45em;
}
.pregame-picker__section + .pregame-picker__section {
  padding-top: 0.9em;
  border-top: 2px solid #d9cfbd;
}
.pregame-picker__section h4 {
  margin: 0;
  font-size: 1em;
}
.pregame-picker__group {
  margin: 0.35em 0 0;
  color: #6b5a45;
  font-size: 0.8em;
  font-weight: 700;
}
.pregame-picker__options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9.5em, 1fr));
  gap: 0.45em;
}
.shogi-game .pregame-picker__option {
  display: grid;
  gap: 0.1em;
  justify-items: start;
  min-height: 2.8em;
  padding: 0.45em 0.75em;
  border: 2px solid #d9cfbd;
  border-radius: 0.45em;
  color: #1d303f;
  background: #fff;
  box-shadow: none;
  text-align: left;
}
.shogi-game .pregame-picker__option small {
  color: #6b5a45;
  font-size: 0.75em;
  font-weight: 400;
}
.shogi-game .pregame-picker__option--selected {
  border-color: #c98a3d;
  background: #fdebd0;
  font-weight: 700;
}
.shogi-game .pregame-picker__option:disabled {
  border-color: #d9cfbd;
  color: #1d303f;
  background: #fff;
  opacity: 0.45;
}
@media (hover: hover) {
  .shogi-game .pregame-picker__option:not(:disabled):hover {
    border-color: #c98a3d;
    background-color: #fdf3e2;
  }
  .shogi-game .pregame-picker__done:not(:disabled):hover {
    background-color: #53616c;
  }
  .shogi-game .pregame-picker__close:not(:disabled):hover {
    background-color: transparent;
  }
}
.pregame-picker__note {
  margin: 0;
  color: #6b5a45;
  font-size: 0.8em;
}
.pregame-picker__footer {
  display: grid;
  justify-items: center;
  padding: 0.6em 0.9em 0.9em;
  border-top: 2px solid #d9cfbd;
}
.shogi-game .pregame-picker__done {
  width: min(12em, 100%);
  min-height: 2.6em;
  border: 0;
  border-radius: 0.4em;
  color: #fffcf4;
  background: #3f4b55;
  box-shadow: 0 3px 0 #252d33;
  font-weight: 700;
}
</style>
