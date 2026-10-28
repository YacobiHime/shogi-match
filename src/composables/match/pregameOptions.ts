import type { PickerValue } from "../../PregamePicker.vue";
import { LEARNING_ASSIST_LIMITS, LEARNING_HANDICAPS } from "../../core/learning-setup.mjs";
import { CPU_STRENGTH_PRESETS } from "../../core/strength-settings.mjs";

// 対局準備の選択肢と、それを選択シートの項目・行の表示へ変える関数。
// どの行を出すか(pregameSides・pregameCommonRows)と選んだ値の反映(onPregamePick)は、ShogiMatchGame.vueにある。
export type PregameOption = { value: PickerValue; label: string };
export const CPU_STRATEGY_OPTIONS: PregameOption[] = [
  { value: "random", label: "おまかせ" },
  { value: "static", label: "居飛車" },
  { value: "ranging", label: "振り飛車" },
  { value: "surprise", label: "奇襲戦法" },
];
export const CPU_BISHOP_OPTIONS: PregameOption[] = [
  { value: "", label: "選択しない" },
  { value: "open", label: "開けたまま" },
  { value: "open-close", label: "開けてから閉じる" },
  { value: "exchange", label: "CPUから角交換" },
  { value: "invite-exchange", label: "こちらからの角交換を待つ" },
  { value: "closed", label: "閉じたまま指す" },
];
export const CPU_ROOK_OPTIONS: PregameOption[] = [
  { value: "", label: "選択しない" },
  { value: "rook-pawn", label: "飛車先を優先" },
  { value: "static", label: "居飛車を維持" },
  { value: "ranging", label: "振り飛車を目指す" },
  { value: "adaptive", label: "相手を見て決める" },
];
export const CPU_TEMPO_OPTIONS: PregameOption[] = [
  { value: "", label: "選択しない" },
  { value: "balanced", label: "バランス型" },
  { value: "aggressive", label: "積極的" },
  { value: "patient", label: "じっくり" },
  { value: "castle-first", label: "囲い優先" },
  { value: "attack-first", label: "攻め優先" },
];
export const CPU_FIRST_MOVE_OPTIONS: PregameOption[] = [
  { value: "random", label: "おまかせ" },
  { value: "bishop-diagonal", label: "角道を開ける（7六歩）" },
  { value: "rook-pawn", label: "飛車先を突く（2六歩）" },
  { value: "center-pawn", label: "中央の歩を突く（5六歩）" },
];
export const LEARNING_START_OPTIONS: PregameOption[] = [
  { value: "standard", label: "平手の初期局面" },
  { value: "handicap", label: "駒落ち" },
  { value: "formation", label: "戦法・囲いが完成した局面" },
];
export const COACH_LEVEL_OPTIONS: PregameOption[] = [
  { value: "off", label: "なし" },
  { value: "encourage", label: "応援のみ" },
  { value: "detailed", label: "詳しい助言" },
];
/** 閃きの出し方(N7。docs/coach-advice-expansion-design.mdの10章)。 */
export const HINT_STYLE_OPTIONS: PregameOption[] = [
  { value: "staged", label: "少しずつ（言葉 → 駒 → 答え）" },
  { value: "instant", label: "すぐ答え" },
];
export const strengthOptions: PregameOption[] = CPU_STRENGTH_PRESETS.map((preset) => ({
  value: preset.value, label: `Lv.${preset.level} ${preset.label}`,
}));
export const handicapOptions: PregameOption[] = LEARNING_HANDICAPS.map(({ id, label }) => ({ value: id, label }));
export const assistLimitOptions: PregameOption[] = LEARNING_ASSIST_LIMITS.map(({ value, label }) => ({ value, label }));

export function optionLabel(options: PregameOption[], value: PickerValue) {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

// 戦法・囲いの一覧は定義元ごとに型が異なるため、表示に使うidと名前だけを取り出す。
export type OpeningOption = { id: string; label?: string; optionLabel?: string };
export type OpeningOptionGroup = { label: string; options: readonly unknown[] };
export function openingOptions(group: OpeningOptionGroup) {
  return group.options as OpeningOption[];
}
/** 戦法・囲いの一覧を、先頭に「指定なし」を置いた選択シートの項目へ変える。 */
export function openingPickerGroups(groups: OpeningOptionGroup[], emptyLabel: string) {
  return [
    { options: [{ value: "", label: emptyLabel }] },
    ...groups.map((group) => ({
      label: group.label,
      options: openingOptions(group).map((option) => ({ value: option.id, label: option.optionLabel ?? option.label ?? option.id })),
    })),
  ];
}
export function openingLabel(groups: OpeningOptionGroup[], id: string, emptyLabel: string) {
  if (!id) return emptyLabel;
  const option = groups.flatMap(openingOptions).find((entry) => entry.id === id);
  return option?.optionLabel ?? option?.label ?? id;
}

export type PregameRow =
  | { kind: "pick"; id: string; label: string; value: string; disabled?: boolean }
  // あなたの作戦。[おすすめ][変更]の2つのボタンを持つ(作戦カードのシートで選ぶ)。
  | { kind: "plan"; id: string; label: string; value: string };
