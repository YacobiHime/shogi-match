<template>
  <!--
    団体戦の仲間のステータス(docs/team-battle-design.mdの16章)。チームの顔を押すと重ねて開く。
    顔・席・名前、この大会の成績・強さの目安、棋風と得意戦法、能力(名鑑と同じレーダー)、その人への一言。
  -->
  <div class="shogi-tournament__sheet" role="dialog" aria-modal="true" :aria-label="`${status.you ? playerName : status.name}のステータス`" data-team-member-sheet @click.self="emit('close')">
    <div class="shogi-tournament__sheet-panel shogi-tournament__detail team-member">
      <header class="team-member__head">
        <img v-if="face" class="team-member__face" :class="`team-member__face--${faceKind}`" :src="face" alt="" draggable="false">
        <span v-else class="team-member__face team-member__face--char" aria-hidden="true">{{ status.name.slice(0, 1) }}</span>
        <span class="team-member__title">
          <small v-if="status.seat || status.dan">{{ [status.seat, status.dan].filter(Boolean).join("・") }}</small>
          <strong>{{ status.you ? playerName : status.name }}</strong>
        </span>
      </header>
      <ul class="team-member__facts">
        <li data-team-member-record>{{ status.recordText }}</li>
        <li v-if="strengthText">{{ status.you ? `強さ ${strengthText}` : strengthText }}</li>
        <li v-if="status.repertoire">得意 {{ status.repertoire }}</li>
      </ul>
      <PlayerAbilityPanel v-if="abilityView" :view="abilityView" compact :openings="false" />
      <p v-else-if="status.you" class="team-member__empty">あと{{ myNeed || "少し" }}{{ myNeed ? "手" : "" }}ぶん指すと、能力が見えてくるよ。</p>
      <p v-if="line" class="team-member__line" data-team-member-line>{{ line }}</p>
      <button ref="closeEl" type="button" class="shogi-tournament__sub shogi-tournament__sheet-close" data-team-member-close @click="emit('close')">閉じる</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, type PropType } from "vue";
import PlayerAbilityPanel from "./PlayerAbilityPanel.vue";
import { memberAbilityView } from "./core/ryuo-book.mjs";
import { teamUserLine } from "./core/team-battle.mjs";

type Status = {
  id: string; name: string; you: boolean; story: string | null; seat: string; dan: string;
  recordText: string; strength: string; repertoire: string; line: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AbilityProfile = { ready: boolean; view?: any; best?: { label: string } | null; worst?: { label: string } | null; need?: number } | null;

const props = defineProps({
  status: { type: Object as PropType<Status>, required: true },
  face: { type: String, default: "" },
  faceKind: { type: String, default: "portrait" },
  playerName: { type: String, default: "あなた" },
  /** 自分の能力(やこびノートの「能力」と同じ。my-abilities.mjsのmyAbilityProfile)。 */
  myProfile: { type: Object as PropType<AbilityProfile>, default: null },
});
const emit = defineEmits<{ close: [] }>();

const abilityView = computed(() => {
  if (props.status.you) return props.myProfile?.ready ? props.myProfile.view : null;
  return props.status.profile ? memberAbilityView(props.status.profile) : null;
});
const myNeed = computed(() => (props.myProfile && !props.myProfile.ready ? props.myProfile.need ?? 0 : 0));
const strengthText = computed(() => props.status.strength);
const line = computed(() => (props.status.you ? teamUserLine(props.myProfile?.ready ? props.myProfile : null) : props.status.line));

const closeEl = ref<HTMLButtonElement | null>(null);
onMounted(() => closeEl.value?.focus());
</script>

<style>
.shogi-game .team-member { display: grid; gap: 0.55rem; max-height: min(88vh, 46rem); overflow-y: auto; }
.shogi-game .team-member__head { display: flex; align-items: center; gap: 0.7rem; }
.shogi-game .team-member__face {
  flex: none; width: 3.6rem; height: 3.6rem; border-radius: 50%; object-fit: cover; object-position: 50% 4%;
  border: 0.14rem solid rgba(255, 252, 244, 0.75); background: #e9eef1;
}
.shogi-game .team-member__face--sprite { object-fit: contain; object-position: 50% 0; image-rendering: pixelated; background: #2b465b; }
.shogi-game .team-member__face--char { display: inline-grid; place-items: center; color: #172632; font-size: 1.5rem; font-weight: 900; }
.shogi-game .team-member__title { display: grid; min-width: 0; }
.shogi-game .team-member__title small { color: var(--amber, #f1a54c); font-size: 0.78rem; font-weight: 900; }
.shogi-game .team-member__title strong { font-size: 1.25rem; }
.shogi-game .team-member__facts { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .team-member__facts li {
  padding: 0.15rem 0.55rem; border: 0.08rem solid rgba(255, 252, 244, 0.3); border-radius: 999px;
  color: #e8eef2; background: rgba(43, 70, 91, 0.7); font-size: 0.8rem; font-weight: 700;
}
.shogi-game .team-member__empty { margin: 0; color: #cfd8de; font-size: 0.85rem; }
.shogi-game .team-member__line {
  margin: 0; padding: 0.45rem 0.7rem; border-left: 0.25rem solid #86d4a9; border-radius: 0.3rem;
  background: rgba(134, 212, 169, 0.12); font-size: 0.9rem; font-weight: 700; line-height: 1.5;
}
</style>
