<template>
  <!--
    棋士の1年の「見るもの」の行(先週のニュース・取材・分身・人・先週のまとめ。docs/pro-year-design.mdの14・15章)。
    広い画面では右の列の上、狭い画面では今週のタブの下に置く(16-3の3。選ぶものと決めるボタンを今週の札にまとめ、見るものは外へ)。
    押すと親がシートを開く。書式はShogiProYear.vueの pro-year__* をそのまま使う。
  -->
  <div class="pro-year__extras" data-pro-extras>
    <!-- 先週の将棋ニュース(14-3の3)。押すと紙面。 -->
    <button v-if="week.news" type="button" class="pro-year__news" data-pro-news @click="emit('news')">
      <span class="pro-year__news-mast">週刊 将棋ニュース<small>第{{ week.news.number }}週</small></span>
      <b class="pro-year__news-head">{{ week.news.headline }}</b>
      <span v-if="week.news.lead || week.news.lines?.[0]" class="pro-year__news-lead">{{ week.news.lead || week.news.lines[0] }}</span>
      <span class="pro-year__news-more" aria-hidden="true">紙面を開く ›</span>
    </button>
    <!-- 取材の依頼(14-3の5)。行動の枠を使わない。 -->
    <button v-if="week.interview" type="button" class="pro-year__interview" data-pro-interview @click="emit('interview')">
      <span class="pro-year__interview-icon" aria-hidden="true">記</span>
      <span><b>取材の依頼</b><small>{{ week.interview.reporter }}「{{ week.interview.question }}」</small></span>
      <span class="pro-year__interview-go">答える</span>
    </button>
    <!-- 分身の1行(14-3の2・16-3の6)。いちばん高い能力をランクの文字で。押すと分身の能力。 -->
    <button type="button" class="pro-year__avatar-row" data-pro-avatar @click="emit('avatar')">
      <span class="pro-year__slot-icon pro-year__avatar-icon" aria-hidden="true">分</span>
      <span class="pro-year__slot-text">
        <b>
          分身<template v-if="avatarTop">　いちばん高い {{ avatarTop.label }} <i class="pro-year__rank-inline" :class="`player-ability__rank player-ability__rank--${avatarTop.rank}`">{{ avatarTop.rank }}</i>（{{ avatarTop.value }}）</template>
          <template v-if="week.avatar.grew">・今週 <i class="pro-year__gain">{{ week.avatar.grew.label }}＋{{ week.avatar.grew.gain }}</i></template>
        </b>
        <small v-if="week.avatar.closest">{{ week.avatar.closest.label }} Lv{{ week.avatar.closest.level + 1 }} まで あと{{ week.avatar.closest.need }}</small>
        <span class="pro-year__avatar-bar" aria-hidden="true"><i :style="{ width: `${Math.round((week.avatar.closest?.ratio ?? 1) * 100)}%` }"></i></span>
      </span>
      <span class="pro-year__row-more" aria-hidden="true">能力を見る ›</span>
    </button>
    <!-- 人の1行(15-3の1・3)。押すと人のシート。 -->
    <button v-if="week.people?.length" type="button" class="pro-year__avatar-row pro-year__people-row" data-pro-people @click="emit('people')">
      <span class="pro-year__slot-icon pro-year__avatar-icon" aria-hidden="true">人</span>
      <span class="pro-year__people-faces">
        <span v-for="person in week.people" :key="person.id" class="pro-year__person-mini" :data-pro-person="person.role">
          <span class="pro-year__face" :class="`pro-year__face--${person.role.startsWith('peer') ? 'peer' : person.role}`" aria-hidden="true">{{ person.icon }}</span>
          <span class="pro-year__koma" :aria-label="`${person.name} 絆の段${person.level}`"><i v-for="n in 5" :key="n" :class="{ on: n <= person.level }"></i></span>
        </span>
      </span>
      <small v-if="closestBond" class="pro-year__people-next">{{ closestBond.rel }} 段{{ closestBond.next.level }}まで<br>あと{{ closestBond.next.need }}</small>
    </button>
    <div v-if="!week.news && week.lastWeek?.lines?.length" class="pro-year__lastweek" data-pro-lastweek>
      <h3 class="pro-year__subhead">先週のまとめ<small>（第{{ week.lastWeek.number }}週）</small></h3>
      <ul><li v-for="(line, index) in week.lastWeek.lines" :key="index">{{ line }}</li></ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";

defineProps({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  week: { type: Object as PropType<any>, required: true },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  closestBond: { type: Object as PropType<any>, default: null },
  /** 分身のいちばん高い能力(名前・ランク・値)。 */
  avatarTop: { type: Object as PropType<{ label: string; rank: string; value: number } | null>, default: null },
});
const emit = defineEmits<{ news: []; interview: []; avatar: []; people: [] }>();
</script>
