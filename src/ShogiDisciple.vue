<template>
  <!--
    師匠の1年(docs/disciple-mode-design.md)。弟子を選び、半月ごとに予定を選んで育て、研修会の入会試験と例会を弟子が指す。
    立ち絵を真ん中に大きく置き、ターン・目標・能力・やる気と体力・予定のボタンをその上に重ねる(18章。弟子の絵はまだないので百花の立ち絵で代用)。
    段階1(23章): 予定は稽古・休む・出かけるの3つ。観戦の見立ては段階2で足す(結果だけ見る)。
  -->
  <div class="disciple" :class="{ 'disciple--training': training && view && !lessonOrSheet }" role="dialog" aria-modal="true" aria-label="師匠の1年" data-disciple>
    <div class="disciple__room" aria-hidden="true"></div>
    <div class="disciple__figure" :class="{ 'disciple__figure--bounce': bounce }" aria-hidden="true">
      <img :src="portrait" alt="" draggable="false">
    </div>

    <!-- 弟子の記録(27章)。ほかの枠に記録があるときの入口と、上の帯の「記録」から -->
    <template v-if="slotsShown">
      <div class="disciple__top disciple__top--pick">
        <button type="button" class="disciple__back" data-disciple-back @click="leaveSlots">← 戻る</button>
        <b class="disciple__title">師匠の1年　{{ SLOT_TEXT.title }}</b>
      </div>
      <section class="disciple__panel disciple__slots" data-disciple-slots-screen>
        <p class="disciple__muted">{{ SLOT_TEXT.sub }}</p>
        <div v-for="card in slotList" :key="card.index" class="disciple__slot" :class="{ 'disciple__slot--active': card.active }">
          <button type="button" class="disciple__slot-main" :data-disciple-slot="card.index" @click="openSlot(card.index)">
            <small>{{ card.label }}<template v-if="card.active">・{{ card.summary?.end ? SLOT_TEXT.ended : SLOT_TEXT.playing }}</template></small>
            <template v-if="card.summary">
              <b>{{ card.summary.name }}</b>
              <span>{{ card.summary.head }}・{{ card.summary.place }}</span>
              <span v-if="card.summary.end" class="disciple__slot-end">評価 {{ card.summary.end.rank }}</span>
            </template>
            <template v-else><b>{{ SLOT_TEXT.empty }}</b><span>{{ SLOT_TEXT.emptyNote }}</span></template>
          </button>
          <template v-if="!card.empty">
            <div v-if="slotAsk === card.index" class="disciple__slot-ask">
              <small>{{ SLOT_TEXT.deleteAsk }}</small>
              <button type="button" class="disciple__btn" @click="slotAsk = -1">{{ SLOT_TEXT.deleteKeep }}</button>
              <button type="button" class="disciple__btn disciple__btn--danger" :data-disciple-slot-delete="card.index" @click="removeSlot(card.index)">{{ SLOT_TEXT.deleteDo }}</button>
            </div>
            <button v-else type="button" class="disciple__slot-del" :data-disciple-slot-ask="card.index" @click="slotAsk = card.index">{{ SLOT_TEXT.delete }}</button>
          </template>
        </div>
      </section>
    </template>

    <!-- 弟子を選ぶ -->
    <template v-else-if="!state">
      <div class="disciple__top disciple__top--pick">
        <button type="button" class="disciple__back" data-disciple-back @click="emit('close')">← 戻る</button>
        <b class="disciple__title">師匠の1年　弟子を選ぶ</b>
        <button v-if="otherSlots" type="button" class="disciple__title disciple__slots-link" data-disciple-slots-open @click="showSlots">記録を選ぶ</button>
        <button v-if="ichimon.members.length" type="button" class="disciple__title disciple__slots-link" data-disciple-ichimon-open @click="ichimonOpen = true">一門 {{ ichimon.members.length }}人</button>
      </div>
      <section class="disciple__panel disciple__pick-info" :aria-label="picked.name">
        <h2>{{ picked.name }}<small>（仮）</small></h2>
        <p class="disciple__muted">{{ picked.grade }}・{{ picked.age }}歳・{{ PLAY_STYLES[picked.style]?.label }}</p>
        <p class="disciple__intro">{{ picked.intro }}</p>
        <dl class="disciple__dl">
          <template v-for="stat in pickedStats" :key="stat.key">
            <dt>{{ stat.label }}</dt><dd><span class="disciple__rank" :class="`disciple__rank--${stat.rank}`">{{ stat.rank }}</span>{{ stat.value }}</dd>
          </template>
          <dt>スキル</dt><dd>{{ picked.skills.map((id) => skillById(id)?.name).join('・') }}</dd>
          <dt>難しさ</dt><dd class="disciple__diff">{{ '★'.repeat(picked.difficulty) }}{{ '☆'.repeat(3 - picked.difficulty) }}</dd>
        </dl>
      </section>
      <div class="disciple__pick-cards" role="radiogroup" aria-label="弟子の候補">
        <button v-for="candidate in DISCIPLES" :key="candidate.id" type="button" class="disciple__pick-card" role="radio"
          :aria-checked="candidate.id === pickedId" :data-disciple-pick="candidate.id" @click="pickedId = candidate.id">
          <b>{{ candidate.name }}</b><small>{{ candidate.grade }}・{{ PLAY_STYLES[candidate.style]?.label }}</small>
        </button>
      </div>
      <!-- 連れていく仲間(29章)。一門の先輩がいて、候補が4人より多いときだけ選ぶ -->
      <section v-if="pool.length > TEAM_SIZE" class="disciple__panel disciple__team" data-disciple-team>
        <h4>連れていく仲間<small>{{ teamIds.length }}/{{ TEAM_SIZE }}人</small></h4>
        <div class="disciple__team-list">
          <button v-for="friend in pool" :key="friend.id" type="button" class="disciple__team-chip" :aria-pressed="teamIds.includes(friend.id)"
            :disabled="!teamIds.includes(friend.id) && teamIds.length >= TEAM_SIZE" :data-disciple-friend="friend.id" @click="toggleFriend(friend.id)">
            <b>{{ friend.name }}</b><small>{{ friend.senpai ? friend.title : '研究会の仲間' }}</small>
          </button>
        </div>
      </section>
      <button type="button" class="disciple__go" data-disciple-start @click="start">この子を弟子にする</button>
    </template>

    <template v-else-if="view">
      <!-- 上: 残りの札・目標の帯・体力と調子(48章。育成ゲームの組み立てを借りる) -->
      <header class="disciple__hud">
        <div class="disciple__turn" :class="{ 'disciple__turn--big': eventDay }" data-disciple-turn>
          <small>{{ turnCard.top }}</small>
          <b><span v-if="turnCard.pre" class="disciple__turn-pre">{{ turnCard.pre }}</span>{{ turnCard.big }}<span>{{ turnCard.unit }}</span></b>
          <em>{{ turnCard.tag }}</em>
        </div>
        <div class="disciple__goal" :title="`目標 ${view.goal.text}`">
          <small>目標</small><b>{{ view.goal.text }}</b>
          <button type="button" class="disciple__goal-more" data-disciple-detail-open @click="detailOpen = true">詳細</button>
        </div>
        <div class="disciple__vital" data-disciple-vital>
          <span>体力</span>
          <span class="disciple__hp">
            <i :style="{ width: `${view.stamina}%` }"></i>
            <s v-if="staminaCost" :style="{ left: `${Math.max(0, view.stamina - staminaCost)}%`, width: `${Math.min(staminaCost, view.stamina)}%` }"></s>
            <b>{{ staminaCost ? `${view.stamina}→${Math.max(0, view.stamina - staminaCost)}` : `${view.stamina}/100` }}</b>
          </span>
          <span class="disciple__mood-badge" :class="`disciple__mood-badge--m${view.mood + 2}`">{{ MOOD_MARKS[view.mood + 2] }} {{ MOOD_LABELS[view.mood + 2] }}</span>
        </div>
      </header>

      <!-- 右の丸い小さなボタン(会・作戦帳・棋譜帳・記録・戻る) -->
      <nav class="disciple__side" aria-label="見る">
        <!-- 会の画面(36-5)。はじめての例会の朝の場面を見るまでは出さない(36-6)。 -->
        <button v-if="society && societyShown" type="button" class="disciple__round" data-disciple-society-open @click="openSociety()"><span aria-hidden="true">🏯</span>{{ society.title }}</button>
        <!-- 押すと作戦帳(35-12)。覚えられる作戦があれば、印を付ける。 -->
        <button v-if="view.mastery" type="button" class="disciple__round" :class="{ 'disciple__round--new': view.book.offer.length }" data-disciple-plans-open
          title="作戦帳を開く" @click="plansOpen = !plansOpen"><span aria-hidden="true">📒</span>作戦帳</button>
        <button v-if="bookGames.length" type="button" class="disciple__round" data-disciple-book-open @click="bookOpen = true"><span aria-hidden="true">📖</span>棋譜帳</button>
        <button type="button" class="disciple__round" data-disciple-slots-open @click="showSlots"><span aria-hidden="true">✎</span>記録</button>
        <button type="button" class="disciple__round" aria-label="戻る" data-disciple-back @click="emit('close')"><span aria-hidden="true">←</span>戻る</button>
      </nav>

      <!-- 能力のくわしいこと(詳細のシート。前の左右の欄の札をここへ移した。48-2) -->
      <section v-if="detailOpen && !view.end" class="disciple__panel disciple__skills disciple__detail" data-disciple-detail>
        <h4>{{ view.name }}<small class="disciple__muted">　{{ view.place }}<template v-if="view.shoreikai">・{{ view.age }}歳</template></small><button type="button" class="disciple__x" aria-label="閉じる" @click="detailOpen = false">×</button></h4>
        <p class="disciple__detail-goal"><small>目標</small>{{ view.goal.text }}<template v-if="view.goal.left">（あと{{ view.goal.left }}{{ view.goal.unit ?? 'ターン' }}）</template><br><small>{{ view.calendar.label }}・{{ view.calendar.sub }}</small></p>
        <div class="disciple__chips">
          <span class="disciple__chip disciple__chip--style">{{ PLAY_STYLES[view.style]?.label }}</span>
          <span v-for="id in view.skills" :key="id" class="disciple__chip">{{ skillById(id)?.name }}{{ '★'.repeat(skillById(id)?.star ?? 0) }}</span>
          <span class="disciple__chip disciple__chip--hidden">弱点 {{ view.weakness ? view.weakness : '？' }}</span>
          <button v-if="view.mastery" type="button" class="disciple__chip disciple__chip--mastery disciple__chip--btn" data-disciple-mastery
            title="作戦帳を開く（定跡のあと、研究してきた手を何手まで指せるか）" @click="openPlansFromDetail">作戦帳 {{ view.book.count }}・戦法熟練度 {{ view.mastery.label }} {{ view.mastery.value }}</button>
          <button v-if="view.book.offer.length" type="button" class="disciple__chip disciple__chip--btn disciple__chip--learn" data-disciple-learn-open @click="openPlansFromDetail">新しい作戦を覚えられる</button>
          <span v-if="view.spotted?.length" class="disciple__chip disciple__chip--spotted" data-disciple-spotted title="観戦で見抜いた崩れ方の回数">見抜いた {{ view.spotted.map((item) => `${item.label} ${item.count}`).join('・') }}</span>
          <span v-if="view.rival" class="disciple__chip disciple__chip--rival" data-disciple-rival :title="`羽音の弟子（${view.rival.where}）${view.rival.plan ? `・得意 ${view.rival.plan}（作戦${view.rival.plans}つ）` : ''}`">ライバル {{ view.rival.name }} {{ view.rival.wins }}勝{{ view.rival.losses }}敗<template v-if="view.rival.plan">・得意 {{ view.rival.plan }}</template></span>
        </div>
        <h5>適性</h5>
        <div class="disciple__apt">
          <span v-for="key in APTITUDE_KEYS" :key="key">{{ APTITUDE_SHORT[key] }}<b>{{ view.aptitudes[key].rank }}</b></span>
        </div>
        <template v-if="view.charms.length">
          <h5>お守り</h5>
          <div class="disciple__charms" data-disciple-charms><span v-for="charm in view.charms" :key="charm.id" :title="charm.text">{{ charm.name }}<b v-if="charm.count > 1">×{{ charm.count }}</b></span></div>
        </template>
        <h5>最近の出来事</h5>
        <ul class="disciple__log" data-disciple-log>
          <li v-for="(entry, index) in [...view.log].reverse()" :key="index">{{ entry.text }}</li>
        </ul>
      </section>

      <!-- スキルを覚える条件(25-3) -->
      <section v-if="skillsOpen && !view.end" class="disciple__panel disciple__skills" data-disciple-skills>
        <h4>スキルを覚える条件<button type="button" class="disciple__x" aria-label="閉じる" @click="skillsOpen = false">×</button></h4>
        <ul>
          <li v-for="row in view.skillProgress" :key="row.id" :class="{ 'disciple__skill--have': row.have }">
            <b>{{ skillById(row.id)?.name }}{{ '★'.repeat(skillById(row.id)?.star ?? 0) }}</b>
            <small>{{ row.have ? '覚えた' : row.text }}</small>
            <span v-if="!row.have" class="disciple__skill-bar"><i :style="{ width: `${(row.now / row.need) * 100}%` }"></i></span>
          </li>
        </ul>
      </section>

      <!-- 作戦帳(35-12)。知っている作戦と熟練度・局数・囲いの続き、覚えられる作戦の候補。 -->
      <section v-if="plansOpen && !view.end" class="disciple__panel disciple__skills disciple__plans" data-disciple-plans>
        <h4>作戦帳（{{ view.book.count }}）<button type="button" class="disciple__x" aria-label="閉じる" @click="plansOpen = false">×</button></h4>
        <div v-if="view.book.offer.length" class="disciple__learn" data-disciple-learn>
          <p><b>新しい作戦を1つ覚えられる</b><small>棋譜並べの勉強の成果。残りは、また次に出る</small></p>
          <div class="disciple__choice">
            <button v-for="card in view.book.offer" :key="card.id" type="button" class="disciple__opt" :data-disciple-learn-card="card.id" @click="learn(card.id)">
              {{ card.label }}<small>{{ PLAN_TIER_TEXT[card.tier] }}・{{ PLAN_VS_TEXT[card.vs] }}</small>
            </button>
          </div>
          <button type="button" class="disciple__link" data-disciple-learn-skip @click="skipLearnNow">いまは覚えない</button>
        </div>
        <ul>
          <li v-for="row in view.book.rows" :key="row.id" :data-disciple-plan-row="row.id">
            <b>{{ row.label }}</b>
            <small>{{ row.tierLabel }}・{{ row.vs }}　熟練度 {{ row.mastery }}・{{ row.games }}局{{ row.wins }}勝</small>
            <button v-if="row.memo" type="button" class="disciple__link disciple__note-open" :data-disciple-notes-open="row.id" @click="openNotes(row.id)">研究ノート {{ row.memo }}局面を見る</button>
            <small v-if="row.chainNow.length || row.chainNext" class="disciple__plan-chain">
              <template v-if="row.chainNow.length">囲いの続き {{ row.chainNow.join('→') }}</template>
              <template v-if="row.chainNext">{{ row.chainNow.length ? '　' : '' }}次は{{ row.chainNext.label }}（あと{{ row.chainNext.left }}局）</template>
            </small>
          </li>
        </ul>
        <p v-if="view.book.seen.length" class="disciple__muted" data-disciple-plan-seen>覚えられそう（負けた相手の作戦）：{{ view.book.seen.join('・') }}</p>
      </section>

      <!-- 研究ノート(49章)。観戦した局で研究の続きに指して形勢を保った手を、局面ごとに残したもの。盤は対局と同じ部品。 -->
      <section v-if="notesCard && !view.end" class="disciple__panel disciple__notes" data-disciple-notes>
        <h4>研究ノート　{{ notesLabel }}<button type="button" class="disciple__x" aria-label="閉じる" @click="notesCard = ''">×</button></h4>
        <p class="disciple__muted">観戦した対局で定跡のあとに指して形勢を保った手と、一門の先輩・師匠の棋譜から写した手。同じ局面になったら、考えずにこの手を指す。負けた局で大きく損をした手は×（次は避ける）。</p>
        <div class="disciple__notes-body">
          <div ref="noteStageEl" class="disciple__notes-board">
            <div class="disciple__board-box" :style="noteBoxStyle">
              <ShogiMatchBoard
                v-if="noteRow"
                :sfen="noteRow.sfen"
                :last-move="''"
                :candidates="noteArrows"
                :allow-move="false"
                :enable-drag-and-drop="false"
                :flip="noteRow.sfen.split(' ')[1] === 'w'"
                :mobile="true"
                :layout="'portrait'"
                :asset-base-url="assetBaseUrl"
                @resize="onNoteBoardResize"
              />
            </div>
          </div>
          <ol class="disciple__notes-list">
            <li v-for="(row, index) in noteList" :key="row.key">
              <button type="button" class="disciple__opt" :aria-pressed="noteRow?.key === row.key" :data-disciple-note="index" @click="noteIndex = index">
                {{ index + 1 }}. {{ row.move ? noteMoveLabel(row) : '×' + noteMoveLabel(row, true) }}
                <small>{{ row.games ? `${row.games}局で指して${row.wins}勝` : 'まだ指していない' }}<template v-if="row.avoid">・避ける</template><template v-if="sourceLabel(row.source)">・{{ sourceLabel(row.source) }}</template></small>
              </button>
            </li>
          </ol>
        </div>
      </section>

      <p v-if="line" class="disciple__say" data-disciple-say>{{ line }}</p>

      <!-- 終わり -->
      <section v-if="view.end" class="disciple__panel disciple__sheet" data-disciple-end>
        <div class="disciple__stamp">評価 {{ view.end.rank }}</div>
        <p>{{ view.end.text }}</p>
        <p class="disciple__muted">{{ view.calendar.label }}・{{ view.end.turn }}ターン</p>
        <p v-if="state?.ichimonJoined" class="disciple__extra" data-disciple-ichimon-joined>{{ view.name }}は一門に入った（{{ state.ichimonJoined }}人目）。次の弟子の仲間として連れていける</p>
        <p v-if="view.end.kind === 'pro'" class="disciple__extra" data-disciple-debut>四段になったので、竜王戦・名人戦の棋士の名簿に新四段として入る（竜王戦6組・C級2組から）。大会であなたと当たる日が来るかもしれない</p>
        <p v-if="view.rival?.pro" class="disciple__extra" data-disciple-rival-pro>羽音の弟子の{{ view.rival.name }}も四段になる。竜王戦・名人戦の名簿に入り、大会で当たるかもしれない</p>
        <div class="disciple__row">
          <button type="button" class="disciple__btn" @click="emit('close')">ホームへ</button>
          <button type="button" class="disciple__btn disciple__btn--main" data-disciple-again @click="again">もう一度弟子をとる</button>
        </div>
      </section>

      <!-- 対局のあとの言葉 -->
      <section v-else-if="view.kind === 'words'" class="disciple__panel disciple__sheet" data-disciple-words>
        <h3>{{ view.lastEvent?.label }}　{{ view.lastEvent?.wins }}勝{{ view.lastEvent?.losses }}敗</h3>
        <p v-if="resultSeen" class="disciple__muted" data-disciple-words-summary>{{ dayResultView(view.lastEvent).marks }}　{{ dayResultView(view.lastEvent).headline }}</p>
        <ul v-else class="disciple__games">
          <li v-for="(game, index) in view.lastEvent?.games ?? []" :key="index">
            <span class="disciple__star" :class="game.win ? 'disciple__star--win' : 'disciple__star--loss'">{{ game.win ? '○' : '●' }}</span>
            <span>{{ Number(index) + 1 }}局目　対 {{ game.name }}</span><small>勝つ見込み{{ Math.round(game.chance * 100) }}%</small>
          </li>
        </ul>
        <p v-if="view.lastEvent?.events.length" class="disciple__events">{{ view.lastEvent.events.join('・') }}</p>
        <button v-if="society && societyShown && state?.lastDay" type="button" class="disciple__link" data-disciple-society-last @click="openSociety('day')">ほかの局の結果と名札掛けを見る</button>
        <h4>なんて声をかける？</h4>
        <div class="disciple__choice">
          <button v-for="word in WORDS" :key="word.id" type="button" class="disciple__opt" :data-disciple-word="word.id" @click="words(word.id)">
            {{ word.label }}<small>{{ word.note }}</small>
          </button>
        </div>
      </section>

      <!-- 入会試験・例会 -->
      <section v-else-if="eventDay && eventOpen" class="disciple__panel disciple__sheet" data-disciple-event>
        <h3>{{ view.eventTitle }}<small v-if="view.big" class="disciple__bigtag">大一番</small><button type="button" class="disciple__x" aria-label="閉じる" data-disciple-event-close @click="eventOpen = false">×</button></h3>
        <p v-if="view.opponent" class="disciple__muted">相手：{{ view.opponent.name }}（{{ view.opponent.label }}）<template v-if="view.book.opponentStyle">　得意 {{ view.book.opponentStyle }}</template></p>
        <!-- 手合いと、相手の4つの能力(弟子と並べる。36-5) -->
        <p v-if="view.opponent?.teai" class="disciple__teai" data-disciple-teai>手合い　<b>{{ view.opponent.teai }}</b></p>
        <div v-if="opponentStats.length" class="disciple__versus" data-disciple-versus>
          <div v-for="(stat, index) in opponentStats" :key="stat.key" class="disciple__versus-row">
            <span class="disciple__versus-me"><b :class="`disciple__rank--${view.stats[index].rank}`">{{ view.stats[index].rank }}</b>{{ view.stats[index].value }}</span>
            <span class="disciple__versus-name">{{ stat.label }}</span>
            <span class="disciple__versus-them">{{ stat.value }}<b :class="`disciple__rank--${stat.rank}`">{{ stat.rank }}</b></span>
          </div>
          <small class="disciple__muted">左が{{ view.name }}、右が{{ view.opponent?.name }}</small>
        </div>
        <button v-if="society && societyShown && view.kind === 'reikai'" type="button" class="disciple__link" data-disciple-society-day @click="openSociety('day')">今日の対戦表を見る</button>
        <p v-if="view.stakes" class="disciple__stakes" data-disciple-stakes>{{ view.stakes }}</p>
        <template v-if="view.big">
          <h4>序盤の方針</h4>
          <div class="disciple__choice">
            <button v-for="option in PLANS.opening" :key="option.id" type="button" class="disciple__opt" :aria-pressed="plan.opening === option.id"
              :data-disciple-plan="option.id" @click="plan.opening = option.id">{{ option.label }}<small>{{ option.note }}</small></button>
          </div>
          <!-- 作戦帳から選ぶ(35章のO2)。同じ種類の選択肢は、おまかせと3つまで(UD:9)。力戦では選べない。 -->
          <h4>作戦<small class="disciple__muted">　作戦帳 {{ view.book.count }}</small></h4>
          <div class="disciple__choice disciple__choice--plans" data-disciple-plan-cards>
            <button type="button" class="disciple__opt" :aria-pressed="!plan.card" :disabled="plan.opening === 'wild'" data-disciple-plan-card="" @click="plan.card = ''">おまかせ<small>熟練度で選ぶ</small></button>
            <button v-for="card in view.book.choices" :key="card.id" type="button" class="disciple__opt" :aria-pressed="plan.card === card.id" :disabled="plan.opening === 'wild'"
              :data-disciple-plan-card="card.id" @click="plan.card = card.id">{{ card.label }}<small>熟練度 {{ card.mastery }}</small></button>
          </div>
          <h4>終盤の構え</h4>
          <div class="disciple__choice disciple__choice--two">
            <button v-for="option in PLANS.ending" :key="option.id" type="button" class="disciple__opt" :aria-pressed="plan.ending === option.id"
              :data-disciple-plan="option.id" @click="plan.ending = option.id">{{ option.label }}<small>{{ option.note }}</small></button>
          </div>
        </template>
        <template v-if="view.big && view.charms.length">
          <h4>お守りを持たせる</h4>
          <div class="disciple__choice disciple__choice--charm">
            <button type="button" class="disciple__opt" :aria-pressed="!charmPick" data-disciple-charm="" @click="charmPick = ''">持たせない<small>次の大一番にとっておく</small></button>
            <button v-for="charm in view.charms" :key="charm.id" type="button" class="disciple__opt" :aria-pressed="charmPick === charm.id"
              :data-disciple-charm="charm.id" @click="charmPick = charm.id">{{ charm.name }}<small>{{ charm.text }}</small></button>
          </div>
        </template>
        <div class="disciple__row">
          <button type="button" class="disciple__btn" data-disciple-play @click="play">結果だけ見る</button>
          <button v-if="engineFactory && view.watchable" type="button" class="disciple__btn disciple__btn--main" data-disciple-watch @click="startWatch">
            {{ view.big ? '作戦を授けて観戦する' : '1局目を観戦する' }}
          </button>
        </div>
        <p v-if="view.watchable" class="disciple__muted disciple__note">観戦すると、崩れた手の理由を見抜いて、次の稽古を狙い目にできる（師匠の眼 {{ view.eye.dan }}段）。</p>
        <p v-if="view.handicap" class="disciple__muted disciple__note" data-disciple-handicap-note>今日の1局目は駒落ち。上手が駒を落として、先に指す。</p>
      </section>

      <!-- 指導の引き出し(25-1): 3回、手札の3枚から1枚ずつ選ぶ -->
      <section v-else-if="lesson" class="disciple__panel disciple__sheet disciple__lesson" data-disciple-lesson>
        <h3>{{ selected?.label }}の稽古<small class="disciple__muted">{{ lesson.picks.length + 1 > LESSON_ROUNDS ? '' : `${lesson.picks.length + 1}/${LESSON_ROUNDS}枚目` }}</small></h3>
        <div class="disciple__meter" aria-label="稽古の出来">
          <i :style="{ width: `${Math.min(100, lessonScore.points)}%` }"></i>
          <span class="disciple__meter-line" style="left: 60%">よく</span>
          <span class="disciple__meter-line" style="left: 85%">完璧</span>
        </div>
        <p class="disciple__muted">出来 {{ lessonScore.points }}　<b>{{ lessonScore.grade.label }}</b>（伸び×{{ lessonScore.grade.scale }}）</p>
        <ol v-if="lessonScore.steps.length" class="disciple__steps">
          <li v-for="step in lessonScore.steps" :key="step.id + step.gained">{{ cardById(step.id)?.label }}<b>+{{ step.gained }}</b><span v-if="step.fit" class="disciple__fit">この子に合う</span></li>
        </ol>
        <div v-if="lessonHand.length" class="disciple__choice">
          <button v-for="id in lessonHand" :key="id" type="button" class="disciple__opt disciple__card" :data-disciple-card="id" @click="pickCard(id)">
            <span v-if="cardFits(cardById(id), state.discipleId)" class="disciple__fit">この子に合う</span>
            {{ cardById(id)?.label }}<small>{{ cardById(id)?.text }}</small>
            <small class="disciple__card-cost">{{ cardCost(id) }}</small>
          </button>
        </div>
        <div class="disciple__row">
          <button type="button" class="disciple__btn" @click="lesson = null">稽古を選び直す</button>
          <button type="button" class="disciple__btn" data-disciple-card-auto @click="pickCard(autoPick(state, lessonHand, lesson.picks))">おまかせ</button>
          <button type="button" class="disciple__btn disciple__btn--main" data-disciple-lesson-rest @click="finishLesson">残りはおまかせで稽古</button>
        </div>
      </section>

      <!-- 稽古を選ぶ(48-3): 選んだ稽古の札と、その稽古にいる一門の仲間 -->
      <template v-if="training && !lessonOrSheet">
        <!-- 研究(49章): 作戦帳の1枚を選び、その作戦の熟練度を上げる。能力値は伸びない。 -->
        <section v-if="researching" class="disciple__panel disciple__picked" data-disciple-preview data-disciple-research-preview>
          <b>研究<em>作戦の熟練度</em></b>
          <small>定跡のあと、研究してきた手で指せる手数が増える</small>
          <span class="disciple__risk">{{ researchRow?.label }}　熟練度 {{ researchRow?.mastery }}→<i>{{ Math.min(100, (researchRow?.mastery ?? 0) + researchGain) }}</i>・体力 <b>−{{ RESEARCH.stamina }}</b></span>
          <span v-if="masterCount" class="disciple__extra" data-disciple-research-master>師匠の棋譜 {{ masterCount }}局も並べる（研究ノートに写す）</span>
          <div class="disciple__research-cards">
            <button v-for="row in view.book.rows" :key="row.id" type="button" class="disciple__opt" :aria-pressed="researchRow?.id === row.id"
              :data-disciple-research-card="row.id" @click="researchCardId = row.id">{{ row.label }}<small>熟練度 {{ row.mastery }}・{{ row.games }}局{{ row.wins }}勝</small></button>
          </div>
        </section>
        <section v-else class="disciple__panel disciple__picked" data-disciple-preview>
          <b>{{ selected?.label }}<em>Lv{{ selected?.level }}</em></b>
          <small>{{ trainingNote }}</small>
          <span class="disciple__risk">失敗率 <i :class="{ 'disciple__warn': (selected?.fail ?? 0) >= 8 }">{{ selected?.fail }}%</i>・体力 <b>−{{ selected?.stamina }}</b></span>
          <div v-if="selectedId === 'shisho'" class="disciple__choice disciple__choice--four">
            <button v-for="stat in view.stats" :key="stat.key" type="button" class="disciple__opt" :aria-pressed="choice === stat.key"
              @click="choice = stat.key">{{ stat.label }}</button>
          </div>
          <p v-if="selected?.aptitude" class="disciple__extra">{{ APTITUDE_LABELS[selected.aptitude] }}の適性 +1目盛り</p>
        </section>
        <div v-if="!researching && selected?.friends.length" class="disciple__friends" data-disciple-friends>
          <small>一門の仲間</small>
          <span v-for="id in selected.friends" :key="id" class="disciple__friend" :style="{ background: friendColor(id) }" :title="friendName(id)">
            {{ friendName(id).slice(0, 1) }}<em v-if="friendBond(id) >= 80">絆</em>
            <span class="disciple__bond"><i :class="{ 'disciple__bond--full': friendBond(id) >= 100 }" :style="{ width: `${Math.min(100, friendBond(id))}%` }"></i></span>
          </span>
        </div>
      </template>

      <!-- 下: 能力の列とコマンド(48-2) -->
      <section v-if="!view.end && !lessonOrSheet" class="disciple__bottom">
        <button type="button" class="disciple__statrow" aria-label="能力のくわしいことを見る" data-disciple-detail-open @click="detailOpen = true">
          <span v-for="stat in view.stats" :key="stat.key" class="disciple__stat" :class="{ 'disciple__stat--aim': stat.aimed }" :data-disciple-stat="stat.key">
            <b v-if="previewGains[stat.key]" class="disciple__plus" :class="{ 'disciple__plus--small': previewGains[stat.key] < 20 }">+{{ previewGains[stat.key] }}</b>
            <small>{{ stat.label }}</small>
            <span class="disciple__stat-row"><span class="disciple__rank" :class="`disciple__rank--${stat.rank}`">{{ stat.rank }}</span><b class="disciple__val">{{ stat.value }}</b></span>
            <small class="disciple__max">/{{ STAT_MAX }}</small>
          </span>
          <span class="disciple__stat disciple__stat--lv" data-disciple-level>
            <small>棋力</small><b>{{ levelGradeName(view.level) }}</b><small class="disciple__max">Lv{{ Math.round(view.level) }}</small>
          </span>
        </button>

        <!-- 稽古の5つ -->
        <template v-if="training">
          <nav class="disciple__tbtns" aria-label="稽古">
            <button v-for="item in view.trainings" :key="item.id" type="button" class="disciple__tbtn"
              :aria-pressed="item.id === selectedId" :data-disciple-train="item.id" @click="pickTraining(item.id)">
              <span v-if="item.friends.length" class="disciple__tbtn-cnt">{{ item.friends.length }}</span>
              <span v-if="item.aimed" class="disciple__aimtag">狙い目</span>
              <span class="disciple__tbtn-mark">{{ TRAINING_MARKS[item.id] }}</span>{{ item.label }}
              <span class="disciple__tbtn-lv">Lv{{ item.level }}</span>
            </button>
            <button v-if="view.book.rows.length" type="button" class="disciple__tbtn disciple__tbtn--research" :aria-pressed="researching"
              data-disciple-train="research" @click="pickTraining('research')">
              <span class="disciple__tbtn-mark">研</span>研究
              <span class="disciple__tbtn-lv">熟練度</span>
            </button>
          </nav>
          <div class="disciple__tfoot">
            <button type="button" class="disciple__pill" @click="training = false">戻る</button>
            <span class="disciple__tfoot-hint">もう一度押しても決まる</span>
            <button type="button" class="disciple__pill disciple__pill--go" data-disciple-train-go @click="confirmTraining">これにする</button>
          </div>
        </template>

        <!-- 予定(丸いコマンド)。例会・入会試験の日は、まんなかが「例会へ」になり、ほかは押せない(48-2、D:3-2) -->
        <template v-else>
          <nav class="disciple__dock disciple__dock--free" aria-label="予定">
            <button type="button" class="disciple__cmd" :disabled="eventDay" data-disciple-action="rest" @click="act('rest')"><span aria-hidden="true">🍵</span>休む<small>体力が戻る</small></button>
            <button v-if="eventDay" type="button" class="disciple__cmd disciple__cmd--main disciple__cmd--event" data-disciple-event-open @click="eventOpen = true">
              <span aria-hidden="true">⚑</span>{{ view.kind === 'exam' ? '入会試験へ' : '例会へ' }}<small>{{ view.big ? '大一番' : '観戦できる' }}</small>
            </button>
            <button v-else type="button" class="disciple__cmd disciple__cmd--main" data-disciple-action="train" @click="openTraining"><span aria-hidden="true">♟</span>稽古<small>能力を伸ばす</small></button>
            <button type="button" class="disciple__cmd" :disabled="eventDay" data-disciple-skills-open @click="skillsOpen = !skillsOpen"><span aria-hidden="true">✦</span>スキル<small>{{ view.skills.length }}つ</small></button>
            <button type="button" class="disciple__cmd" :disabled="eventDay" data-disciple-action="outing" @click="act('outing')"><span aria-hidden="true">🎐</span>出かける<small>やる気</small></button>
            <button type="button" class="disciple__cmd" :disabled="eventDay" data-disciple-action="study" @click="act('study')"><span aria-hidden="true">👥</span>研究会<small>読みと安定</small></button>
          </nav>
          <div class="disciple__foot">
            <button type="button" class="disciple__pill" data-disciple-log-open @click="detailOpen = true">ログ</button>
            <button type="button" class="disciple__pill" :disabled="eventDay" data-disciple-action="master" @click="act('master')">師匠の予定</button>
          </div>
        </template>
      </section>
    </template>

    <!-- 観戦と見立て(24章) -->
    <section v-if="watch" class="disciple__watch" :class="{ 'disciple__watch--review': watch.phase === 'review' }" role="dialog" aria-modal="true" aria-label="観戦" data-disciple-watching>
      <header class="disciple__watch-head">
        <b>{{ watch.phase === 'review' ? '検討' : '観戦' }}　{{ watch.label }}</b>
        <small>{{ view?.name }}（{{ watch.side === 'black' ? '先手' : '後手' }}）対 {{ watch.opponent.name }}　{{ watch.end ? `${watch.entries.length}手で終局` : `${watch.entries.length}手目` }}</small>
        <button v-if="watch.phase === 'review'" type="button" class="disciple__watch-close disciple__watch-research" data-disciple-research @click="openResearch">研究で開く</button>
        <button type="button" class="disciple__watch-close" data-disciple-watch-close @click="closeWatch">{{ watch.mode === 'book' ? '閉じる' : watch.phase === 'review' ? '検討を終える' : watch.done ? 'あとで' : 'やめる' }}</button>
      </header>
      <!-- 盤は対局と同じ部品と駒・盤の素材(ShogiMatchBoard)。枠を、描かれる盤と同じ大きさにする(TeamPeekSheet.vueと同じ方法)。 -->
      <div ref="watchStageEl" class="disciple__watch-board" @pointerdown="onBoardPointerDown" @pointerup="onBoardPointerUp">
        <div class="disciple__board-box" :style="boardBoxStyle">
          <ShogiMatchBoard
            :sfen="watchSfen"
            :last-move="watchLastMove"
            :candidates="watchArrows"
            :risk-squares="clueRings"
            :threat-arrows="clueArrows"
            :allow-move="false"
            :enable-drag-and-drop="false"
            :flip="watch.side === 'white'"
            :mobile="true"
            :layout="'portrait'"
            :asset-base-url="assetBaseUrl"
            :black-player-name="watch.side === 'black' ? view?.name ?? '' : watch.opponent.name"
            :white-player-name="watch.side === 'white' ? view?.name ?? '' : watch.opponent.name"
            :clocks="watchClockView"
            :fast-clock="watchClockView?.fast ?? ''"
            :waza-glow="watchGlow"
            @resize="onBoardResize"
          />
        </div>
        <!-- 技の演出(42章)。対局と同じ帯。弟子の手は名前つきの大きな帯、相手の手は小さな帯。押せない。 -->
        <WazaCutin v-if="watchCutin" :key="watchCutin.id" :cutin="watchCutin" />
      </div>
      <div v-if="watch.phase === 'review'" class="disciple__watch-nav" data-disciple-nav>
        <button type="button" aria-label="最初へ" data-disciple-nav-first @click="goPly(0)">⏮</button>
        <button type="button" aria-label="1手戻る" data-disciple-nav-prev @click="goPly(watch.upto - 1)">◀</button>
        <span data-disciple-nav-ply>{{ watch.upto }}手目 / {{ watch.entries.length }}手</span>
        <button type="button" aria-label="1手進む" data-disciple-nav-next @click="goPly(watch.upto + 1)">▶</button>
        <button type="button" aria-label="最後へ" data-disciple-nav-last @click="goPly(watch.entries.length)">⏭</button>
      </div>
      <div class="disciple__watch-side">
        <!-- 今日の作戦(35-7)。観戦のはじめから最後まで同じ行に出す。 -->
        <p v-if="watch.plans" class="disciple__today-plan" data-disciple-today-plan>今日の作戦 <b>{{ watch.plans.own }}</b><small v-if="watch.plans.opponent">相手の得意 {{ watch.plans.opponent }}</small><small v-if="watch.timeText" data-disciple-time-rule>{{ watch.timeText }}</small></p>
        <p v-if="watchThought" class="disciple__thought" data-disciple-thought><b>{{ view?.name }}の考え</b>{{ watchThought }}
          <small v-if="watchReading" data-disciple-reading>読み筋 {{ watchReading.text }}<template v-if="watchReading.surprised">　相手は{{ watchReading.actualText }}（読んでいなかった手）</template></small></p>
        <p v-if="watch.error" class="disciple__ask">{{ watch.error }}</p>
        <p v-else-if="!watch.end" class="disciple__ask">弟子が指しています……<small>終局すると、結果を発表してから、一緒に検討できます</small></p>
        <template v-else-if="watch.phase === 'review'">
          <!-- スマホは、棋譜と見立てをタブで切り替える(広い画面は両方を並べる。33-4)。 -->
          <div class="disciple__watch-tabs" role="tablist">
            <button type="button" role="tab" :aria-selected="watchTab === 'kifu'" data-disciple-tab="kifu" @click="watchTab = 'kifu'">棋譜</button>
            <button type="button" role="tab" :aria-selected="watchTab === 'marks'" data-disciple-tab="marks" @click="watchTab = 'marks'">{{ seeking ? '分かれ目' : `見立て（${watch.marks.length}）` }}</button>
            <button v-if="watch.good.length" type="button" role="tab" :aria-selected="watchTab === 'good'" :disabled="seeking" data-disciple-tab="good" @click="watchTab = 'good'">好手（{{ watch.good.length }}）</button>
          </div>
          <!-- 分かれ目さがし(33-6)。印を見る前に、形勢が分かれた手を当てる。印・形勢の言葉・グラフの線は伏せる。 -->
          <div v-if="seeking && watch.seek" class="disciple__pane disciple__pane--marks disciple__seek" :class="{ 'disciple__pane--on': watchTab === 'marks' }" data-disciple-seek>
            <p class="disciple__ask"><b>どこで形勢が分かれたと思う？</b>
              <small>棋譜を動かして、ここだと思う手で「ここが分かれ目」（{{ SEEK_RULES.tries }}回まで。前後{{ SEEK_RULES.near }}手なら見抜いた）</small></p>
            <p v-if="seekHint" class="disciple__found" :class="{ 'disciple__found--miss': !watch.seek.hit }" data-disciple-seek-hint>{{ seekHint }}</p>
            <div class="disciple__row disciple__row--left">
              <button type="button" class="disciple__btn" data-disciple-seek-skip @click="closeSeek">{{ seekDone ? '印を見る' : '印を見る（飛ばす）' }}</button>
              <button v-if="!seekDone" type="button" class="disciple__btn disciple__btn--main" :disabled="watch.upto === 0" data-disciple-seek-here @click="seekHere">ここが分かれ目（{{ watch.upto }}手目）</button>
            </div>
          </div>
          <!-- 好手をほめる(33-6。D:5-4)。 -->
          <div v-if="watch.good.length && !seeking" class="disciple__pane disciple__pane--good" :class="{ 'disciple__pane--on': watchTab === 'good' }" data-disciple-good-pane>
            <p class="disciple__ask"><b>好手</b><small>{{ view?.name }}のいい手。ほめると、やる気が上がる（1局に1回）</small></p>
            <div class="disciple__row disciple__row--left">
              <button v-for="(good, index) in watch.good" :key="good.ply" type="button" class="disciple__btn disciple__good-chip" :class="{ 'disciple__good-chip--on': watch.goodSel === index }" :data-disciple-good="index" @click="selectGood(index)">★{{ good.ply }}手目</button>
            </div>
            <div v-if="selectedGood" class="disciple__ask disciple__good-card" data-disciple-good-card>
              <b>好手！「{{ selectedGood.name }}」</b>
              <small>{{ selectedGood.ply }}手目　{{ watchRows[selectedGood.ply - 1]?.text }}</small>
              <button v-if="watch.mode !== 'book'" type="button" class="disciple__btn disciple__btn--main" :disabled="Boolean(watch.praised)" data-disciple-praise @click="praiseGood">{{ watch.praised ? (watch.praised === selectedGood.name ? 'ほめた' : 'もうほめた') : 'ほめる' }}</button>
              <p v-if="watch.praised === selectedGood.name" class="disciple__found" data-disciple-praised>「{{ praiseLine(state?.discipleId ?? '', selectedGood.name) }}」</p>
            </div>
          </div>
          <div v-if="!seeking" class="disciple__pane disciple__pane--marks" :class="{ 'disciple__pane--on': watchTab === 'marks' }">
          <p class="disciple__ask"><b>{{ watch.win ? '勝ち' : '負け' }}</b>
            <small v-if="!watch.marks.length">大きく崩れた手はなかった。いい将棋だったね</small>
            <small v-else-if="watch.mode === 'book'">印の手で、そのとき選んだ答えと、AIの検討が見られます</small>
            <small v-else>グラフの印か、手の一覧の赤い点の手で、崩れた理由を選ぼう（{{ answeredCount }}/{{ watch.marks.length }}）</small></p>
          <div v-if="selectedMark" class="disciple__ask" data-disciple-mark-card>
            <b v-if="selectedMark.sub === 'section'">序盤（{{ selectedMark.from }}〜{{ selectedMark.to }}手）　形勢 {{ selectedMark.startWord }} → {{ selectedMark.endWord }}。理由は？</b>
            <b v-else>{{ selectedMark.ply }}手目　形勢が{{ selectedMark.loss }}点落ちた。理由は？</b>
            <div class="disciple__clues"><span v-for="clue in selectedMark.clues" :key="clue" :class="{ 'disciple__clue--red': clue.startsWith('赤い輪') || clue.startsWith('点線') }">{{ clue }}</span></div>
            <div v-if="selectedMark.sub === 'section'" class="disciple__row disciple__row--left">
              <button type="button" class="disciple__btn" data-disciple-section-start @click="goPly(selectedMark.from ?? 1)">区間の始め</button>
              <button type="button" class="disciple__btn" data-disciple-section-end @click="goPly(selectedMark.to ?? selectedMark.ply)">区間の終わり</button>
            </div>
            <div class="disciple__reasons">
              <button v-for="id in REVIEW_CAUSE_ORDER" :key="id" type="button" class="disciple__opt"
                :class="{ 'disciple__opt--right': guessOf(watch.selected) && selectedMark.cause === id, 'disciple__opt--near': guessOf(watch.selected) && selectedMark.alt === id && guessOf(watch.selected) === id, 'disciple__opt--wrong': guessOf(watch.selected) === id && selectedMark.cause !== id && selectedMark.alt !== id }"
                :disabled="Boolean(guessOf(watch.selected))" :data-disciple-cause="id" @click="guess(id)">
                {{ REVIEW_CAUSES[id].label }}<small>{{ REVIEW_CAUSES[id].note }}</small>
              </button>
            </div>
            <p v-if="guessOf(watch.selected) && selectedJudge" class="disciple__found" data-disciple-found>
              {{ selectedJudge.right ? '見抜いた！' : selectedJudge.near ? `おしい！ 答えは「${causeLabel(selectedMark.cause)}」` : `答えは「${causeLabel(selectedMark.cause)}」` }}
              {{ causeExplain(selectedMark) }}。「{{ STAT_LABELS[targetOf(selectedMark.cause)] }}」の稽古が狙い目（伸び×{{ selectedJudge.boost }}）<template v-if="selectedJudge.time">。秒読みだったので、早指しの稽古も合う</template>
            </p>
          </div>
          </div>
          <p v-if="aiShown" class="disciple__ai" data-disciple-ai>
            <b>AIの検討</b>
            <template v-if="aiShown.nextBest">この局面のAIの最善手は {{ aiShown.nextBest }}（矢印）。</template>
            <template v-if="aiShown.pv">{{ watch.upto }}手目のあとのAIの読み：{{ aiShown.pv }}</template>
          </p>
          <p v-else-if="aiLocked" class="disciple__ai disciple__ai--locked">理由を選ぶと、AIの検討が見られます</p>
          <ol ref="moveListEl" class="disciple__moves disciple__pane disciple__pane--kifu" :class="{ 'disciple__pane--on': watchTab === 'kifu' }" data-disciple-moves>
            <li v-for="row in watchRows" :key="row.ply" :class="{ 'disciple__move--on': row.ply === watch.upto, 'disciple__move--mine': row.mine }">
              <button type="button" :data-disciple-move="row.ply" @click="goPly(row.ply)">
                <i>{{ row.ply }}</i><span>{{ row.text }}</span><em :class="`disciple__tone--${row.tone}`">{{ seeking ? '' : row.word }}</em>
                <b v-if="markPlies.has(row.ply)" class="disciple__dot disciple__dot--red" aria-label="崩れた手"></b>
                <b v-else-if="goodPlies.has(row.ply)" class="disciple__dot disciple__dot--gold" aria-label="好手"></b>
              </button>
            </li>
          </ol>
        </template>
      </div>
      <!-- 終局の札(33-3)。押すか、少し待つと結果発表へ。 -->
      <button v-if="watch.phase === 'end' && watch.endCard" type="button" class="disciple__endcard" :class="{ 'disciple__endcard--big': watch.day?.big, 'disciple__endcard--loss': !watch.win }" data-disciple-endcard @click="showDayResult">
        <span class="disciple__endcard-stamp">{{ watch.endCard.stamp }}</span>
        <b v-if="watch.endCard.mate" class="disciple__endcard-mate" data-disciple-endcard-mate>{{ watch.endCard.mate }}</b>
        <small>{{ watch.endCard.line }}</small>
      </button>
      <!-- その日の結果発表(33-3)。○●・知らせを見てから、検討するか決める。 -->
      <div v-if="watch.phase === 'result' && watch.day" class="disciple__result" role="dialog" aria-label="その日の結果" data-disciple-result>
        <div class="disciple__result-card">
          <small>{{ watch.day.label }}</small>
          <h3 :class="{ 'disciple__result-big': watch.day.big }">{{ watch.day.headline }}</h3>
          <p v-if="watch.day.big" class="disciple__muted">{{ watch.day.wins }}勝{{ watch.day.losses }}敗</p>
          <ul class="disciple__games">
            <li v-for="game in watch.day.games" :key="game.no">
              <span class="disciple__star" :class="game.win ? 'disciple__star--win' : 'disciple__star--loss'">{{ game.win ? '○' : '●' }}</span>
              <span>{{ game.no }}局目　対 {{ game.name }}<b v-if="game.watched" class="disciple__watched-tag">観戦</b></span><small>勝つ見込み{{ game.chance }}%</small>
            </li>
          </ul>
          <p v-if="watch.day.events.length" class="disciple__events" data-disciple-result-events>{{ watch.day.events.join('・') }}</p>
          <div class="disciple__row">
            <button type="button" class="disciple__btn" data-disciple-result-later @click="closeWatch">あとで</button>
            <button type="button" class="disciple__btn disciple__btn--main" data-disciple-review @click="startReview">検討する</button>
          </div>
        </div>
      </div>
      <div class="disciple__graph" aria-label="評価値のグラフ" data-disciple-graph @click="onGraphClick">
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="50" x2="400" y2="50" stroke="#d9d2c4" stroke-width="1" />
          <line v-if="watch.phase === 'review'" :x1="graphX(watch.upto)" y1="0" :x2="graphX(watch.upto)" y2="100" stroke="#1d2a36" stroke-width="1.5" />
          <polyline v-if="!seeking" fill="none" stroke="#4f86c6" stroke-width="2.5" :points="graphPoints" />
        </svg>
        <span v-if="seeking" class="disciple__graph-hide">分かれ目を当てるまで、形勢のグラフは伏せています</span>
        <button v-for="(good, index) in (watch.phase === 'review' && !seeking ? watch.good : [])" :key="`g${good.ply}`" type="button" class="disciple__mark disciple__mark--gold"
          :class="{ 'disciple__mark--gold-up': index % 2 === 1 }" :style="{ left: `${markLeft(good.ply)}%`, bottom: '0.3rem' }" :data-disciple-good-mark="index" @click.stop="selectGood(index)">★{{ good.ply }}</button>
        <button v-for="(mark, index) in (watch.phase === 'review' && !seeking ? watch.marks : [])" :key="mark.ply" type="button" class="disciple__mark"
          :class="{ 'disciple__mark--done': guessOf(index), 'disciple__mark--on': watch.selected === index }"
          :style="{ left: `${markLeft(mark.ply)}%`, top: markRaised(index) ? '2.8rem' : '0.3rem' }" :data-disciple-mark="index" @click.stop="selectMark(index)">{{ mark.ply }}手目{{ guessOf(index) ? ' ✓' : '' }}</button>
      </div>
    </section>

    <!-- 弟子の棋譜帳(33-4)。観戦した対局を、印と答えとAIの検討つきで見返す。 -->
    <section v-if="bookOpen" class="disciple__panel disciple__skills disciple__book" data-disciple-book>
      <h4>{{ view?.name }}の棋譜帳<button type="button" class="disciple__x" aria-label="閉じる" @click="bookOpen = false">×</button></h4>
      <ul>
        <li v-for="game in bookGames" :key="game.id">
          <button type="button" class="disciple__book-row" :data-disciple-book-game="game.id" @click="openBookGame(game)">
            <span class="disciple__star" :class="game.win ? 'disciple__star--win' : 'disciple__star--loss'">{{ game.win ? '○' : '●' }}</span>
            <span><b>{{ game.label }}</b><small>対 {{ game.opponent }}　{{ game.plies }}手　{{ game.when }}</small></span>
          </button>
        </li>
      </ul>
    </section>

    <!-- 会の画面(36-5)。名札掛け・対戦表・会員・規定。 -->
    <section v-if="societyOpen && society" class="disciple__panel disciple__society" role="dialog" :aria-label="society.title" data-disciple-society>
      <h4>{{ society.title }}<button type="button" class="disciple__x" aria-label="閉じる" @click="closeSociety">×</button></h4>
      <div class="disciple__society-tabs" role="tablist">
        <button v-for="tab in SOCIETY_TABS" :key="tab.id" type="button" role="tab" class="disciple__society-tab" :aria-selected="societyTab === tab.id"
          :data-disciple-society-tab="tab.id" @click="societyTab = tab.id; memberSel = ''">{{ tab.label }}</button>
      </div>
      <div class="disciple__society-body">
        <template v-if="societyTab === 'board'">
          <ShoreikaiNameboard :columns="society.board" :top-rank="society.topRank" :direction="society.kind === 'kenshukai' ? '右ほど上のクラス' : '右ほど上の段級'"
            :you-label="view?.name ?? ''" rival-label="羽音の弟子" />
          <p class="disciple__muted">名札は昇級すると右の列へ掛け替わる。{{ society.kind === 'kenshukai' ? 'A2クラスまで上がると、奨励会へ編入できる' : '三段になると三段リーグ' }}。</p>
        </template>
        <template v-else-if="societyTab === 'day'">
          <div v-for="day in [society.upcoming, society.last].filter(Boolean)" :key="day.title" class="disciple__day" :data-disciple-day="day === society.upcoming ? 'next' : 'last'">
            <h5>{{ day === society.upcoming ? '次：' : '前回：' }}{{ day.title }}</h5>
            <ol class="disciple__day-mine">
              <li v-for="(game, index) in day.mine" :key="`m${index}`" :class="{ 'disciple__day--rival': game.rival }">
                <span class="disciple__star" :class="game.result === 'win' ? 'disciple__star--win' : game.result === 'loss' ? 'disciple__star--loss' : ''">{{ game.result === 'win' ? '○' : game.result === 'loss' ? '●' : Number(index) + 1 }}</span>
                <span><b>{{ view?.name }}</b> − {{ game.name }}<small>（{{ game.place }}）</small></span>
                <small class="disciple__teai-chip">{{ game.teai || '平手' }}</small>
              </li>
            </ol>
            <p v-if="day.others.length" class="disciple__muted">近いクラスのほかの局</p>
            <ul class="disciple__day-others">
              <li v-for="(game, index) in day.others" :key="`o${index}`">
                <small>{{ game.round != null ? `${game.round + 1}局目` : '' }}</small>
                <span :class="{ 'disciple__won': game.winner === 'a' }">{{ game.a.name }}<small>（{{ game.a.place }}）</small></span>
                <span class="disciple__muted">−</span>
                <span :class="{ 'disciple__won': game.winner === 'b' }">{{ game.b.name }}<small>（{{ game.b.place }}）</small></span>
                <small class="disciple__teai-chip">{{ game.teai || '平手' }}{{ game.winner ? '' : '・対局前' }}</small>
              </li>
            </ul>
          </div>
          <p v-if="!society.upcoming && !society.last" class="disciple__muted">例会が始まると、ここに組み合わせが出る。</p>
        </template>
        <template v-else-if="societyTab === 'members'">
          <ul v-if="!memberSel" class="disciple__members">
            <li v-for="member in society.members" :key="member.id">
              <button type="button" class="disciple__member" :class="{ 'disciple__member--rival': member.rival, 'disciple__member--peer': member.peer }" :data-disciple-member="member.id" @click="memberSel = member.id">
                <span><b>{{ member.name }}</b><small>{{ member.place }}・{{ member.age }}歳{{ member.rival ? '・羽音の弟子' : member.peer ? '・同期' : '' }}</small></span>
                <span class="disciple__member-ranks"><i v-for="stat in member.abilities" :key="stat.key" :class="`disciple__rank--${stat.rank}`" :title="stat.label">{{ stat.rank }}</i></span>
              </button>
            </li>
          </ul>
          <div v-else-if="selectedMember" class="disciple__member-card" data-disciple-member-card>
            <button type="button" class="disciple__link" @click="memberSel = ''">← 会員の一覧</button>
            <h5>{{ selectedMember.name }}<small>{{ selectedMember.place }}・{{ selectedMember.age }}歳{{ selectedMember.rival ? '・羽音の弟子' : selectedMember.peer ? '・同期' : '' }}</small></h5>
            <!-- やこびノートの棋士名鑑と同じ部品(レーダーチャートとランク・型・得意戦法の使用率)。44章。 -->
            <PlayerAbilityPanel class="disciple__member-ability" :view="selectedMember.ability" :chart-max="STAT_MAX"
              :compare="memberCompare" :own-label="selectedMember.name" />
            <!-- スキルと戦法熟練度(45章)。熟練度は得意戦法ごとの横棒(羽音の弟子は作戦帳の熟練度)。 -->
            <div class="disciple__member-extra" data-disciple-member-skills>
              <h6>スキル</h6>
              <ul v-if="selectedMember.skills.length" class="disciple__member-skills">
                <li v-for="id in selectedMember.skills" :key="id">
                  <b>{{ skillById(id)?.name }}<span class="disciple__member-star">{{ '★'.repeat(skillById(id)?.star ?? 0) }}</span></b>
                  <small>{{ skillById(id)?.when }}：{{ skillById(id)?.text }}</small>
                </li>
              </ul>
              <p v-else class="disciple__muted">まだない</p>
            </div>
            <div v-if="selectedMember.mastery.length" class="disciple__member-extra" data-disciple-member-mastery>
              <h6>戦法熟練度</h6>
              <ul class="disciple__member-mastery">
                <li v-for="row in selectedMember.mastery" :key="row.id">
                  <span class="disciple__member-mastery-label">{{ row.label }}</span>
                  <span class="disciple__member-mastery-bar" aria-hidden="true"><i :style="{ width: `${Math.max(2, (row.value / MEMBER_MASTERY_MAX) * 100)}%` }"></i></span>
                  <span class="disciple__member-mastery-num">{{ row.value }}</span>
                </li>
              </ul>
            </div>
            <dl class="disciple__member-profile">
              <div><dt>得意戦法</dt><dd>{{ selectedMember.repertoire || '—' }}</dd></div>
              <div v-if="selectedMember.style"><dt>最近の作戦</dt><dd>{{ selectedMember.style }}</dd></div>
              <div><dt>この会で</dt><dd>{{ selectedMember.record.w }}勝{{ selectedMember.record.l }}敗</dd></div>
              <div data-disciple-member-vs><dt>{{ view?.name }}と</dt><dd>{{ selectedMember.vs.w + selectedMember.vs.l ? `${selectedMember.vs.w}勝${selectedMember.vs.l}敗（${view?.name}から見て）` : 'まだ当たっていない' }}</dd></div>
            </dl>
          </div>
        </template>
        <template v-else>
          <dl class="disciple__rules">
            <div><dt>いま</dt><dd>{{ society.rules.place }}<template v-if="society.rules.progress">　{{ society.rules.progress.record }}<template v-if="society.rules.progress.streak >= 2">・{{ society.rules.progress.streak }}連勝中</template></template></dd></div>
            <div v-if="society.rules.rule"><dt>{{ society.rules.next }}へ</dt><dd>{{ society.rules.rule }}<template v-if="society.rules.progress">（あと{{ society.rules.progress.winsLeft }}勝）</template></dd></div>
            <div><dt>降級点</dt><dd>{{ society.rules.point ? '付いている（もう一度負けが込むと降級）' : society.rules.slump ? 'あと1つ負けると付く' : 'なし' }}</dd></div>
            <div><dt>手合い</dt><dd><span v-for="row in society.rules.teai" :key="row.gap" class="disciple__rules-teai">{{ row.gap }}：{{ row.teai }}</span><span v-if="society.rules.shido" class="disciple__rules-teai">2回に1回の例会の4局目：幹事の先生との指導対局（駒落ち）</span></dd></div>
            <div v-if="society.rules.age"><dt>年齢制限</dt><dd>{{ society.rules.age.shodan }}歳までに初段、{{ society.rules.age.pro }}歳までに四段（いま{{ society.rules.age.now }}歳）</dd></div>
            <div><dt>この先</dt><dd>{{ society.rules.exit }}</dd></div>
          </dl>
          <table v-if="society.rules.league" class="disciple__league" data-disciple-league>
            <caption>第{{ society.rules.league.term }}期 三段リーグ（{{ society.rules.league.round }}/{{ society.rules.league.rounds }}回戦）</caption>
            <tr v-for="row in society.rules.league.rows" :key="row.place + row.name" :class="[`disciple__league--${row.zone}`, { 'disciple__league--you': row.you }]">
              <td>{{ row.place }}</td><td>{{ row.name }}</td><td>{{ row.wins }}勝{{ row.losses }}敗</td>
              <td class="disciple__league-marks">{{ row.marks.map((mark) => mark === 'win' ? '○' : mark === 'loss' ? '●' : '・').join('') }}</td>
            </tr>
          </table>
          <div v-if="systemCards.length" class="disciple__cards" data-disciple-system-cards>
            <h5>制度の札</h5>
            <details v-for="card in systemCards" :key="card.id" :data-disciple-system-card="card.id"><summary>{{ card.title }}</summary><p>{{ card.text }}</p></details>
          </div>
        </template>
      </div>
    </section>

    <!-- 一門の名簿(29章) -->
    <section v-if="ichimonOpen" class="disciple__panel disciple__skills disciple__ichimon" data-disciple-ichimon>
      <h4>一門<button type="button" class="disciple__x" aria-label="閉じる" @click="ichimonOpen = false">×</button></h4>
      <ul>
        <li v-for="member in [...ichimon.members].reverse()" :key="member.id">
          <b>{{ member.name }}</b>
          <small>{{ member.kind === 'pro' ? `四段（棋士番号${member.kishiNumber ?? ''}）` : member.best || '研修会' }}・評価 {{ member.rank }}</small>
          <small class="disciple__ichimon-stats">読み{{ member.stats.reading }} 作戦{{ member.stats.plan }} 安定{{ member.stats.steady }} 詰み{{ member.stats.mate }}</small>
          <small v-if="member.vsMaster" class="disciple__ichimon-stats">あなたとの公式戦 {{ member.vsMaster.wins }}勝{{ member.vsMaster.losses }}敗（弟子から見て）<template v-if="member.ongaeshi">・恩返し済み</template></small>
        </li>
      </ul>
    </section>

    <!-- 問題の場面(26章)。予定を止めず、上に重ねて出す。答えたら効き目を入れる。 -->
    <NovelScene
      v-if="sceneData"
      ref="sceneEl"
      :scene="sceneData"
      :asset-base-url="assetBaseUrl"
      data-disciple-scene
      @choose="sceneChoice = $event.value"
      @done="closeScene"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch as vueWatch, type PropType } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import NovelScene from "./NovelScene.vue";
import { libraryScene } from "./core/novel-library.mjs";
import { aiHint, addBookGame, bookEntry, bookList, reviewRows, thoughtLine, thoughtReading } from "./core/disciple-review.mjs";
import { REVIEW_CAUSES, REVIEW_CAUSE_ORDER, SEEK_RULES, causeExplain, causeLabel, goodMoves, judgeReviewGuess, judgeSeek, reviewMarks, turningPoint } from "./core/disciple-causes.mjs";
import { charmById, resolveScene } from "./core/disciple-events.mjs";
import { TEAM_SIZE, defaultTeam, friendPool, joinIchimon, loadIchimon, pickTeam, saveIchimon } from "./core/disciple-ichimon.mjs";
import { DISCIPLE_SLOT_TEXT as SLOT_TEXT, deleteDiscipleSlot, discipleSlotCards, switchDiscipleSlot } from "./core/disciple-slots.mjs";
import { STANDARD_SFEN } from "./game-state";
import ShoreikaiNameboard from "./ShoreikaiNameboard.vue";
import PlayerAbilityPanel from "./PlayerAbilityPanel.vue";
import { MEMBER_MASTERY_MAX, memberMakeup, societyView, systemCardsOf } from "./core/disciple-society.mjs";
import {
  APTITUDE_KEYS, APTITUDE_LABELS, CAUSES, DISCIPLES, MOOD_SCALE, PLAY_STYLES, STAT_KEYS, STAT_LABELS, STAT_MAX, TRAININGS, moverOfPly, skillById, statRank,
} from "./core/disciple-strength.mjs";
import { levelGradeName } from "./core/tournament-world.mjs";
import {
  FRIENDS, PLANS, RESEARCH, WORDS, applyFindings, planBookOf, praiseLine, chooseAction, chooseWords, createDiscipleRun, dayResultView, discipleView, endCardText, eyeDan, learnPlan, loadDiscipleRun, playEvent, saveDiscipleRun, skipLearn, watchSpec,
} from "./core/disciple-run.mjs";
import { sfenAfter } from "./core/pro-cut.mjs";
import { NOTE_SOURCE_LABELS, masterGameCount, noteRows, planCard } from "./core/disciple-plans.mjs";
import { loadMyGames } from "./core/my-games.mjs";
import { moveLabel } from "./core/research-record.mjs";
import { LESSON_ROUNDS, autoPick, cardById, cardFits, lessonHands, scoreLesson } from "./core/disciple-lesson.mjs";
import { useEngineGame } from "./composables/match/useEngineGame";
import { paceMs, watchClocks } from "./core/watch-pace.mjs";
import WazaCutin, { type WazaCutinView } from "./WazaCutin.vue";
import { createWatchWaza, planNames, watchMemoStep, watchWazaStep } from "./core/watch-waza.mjs";
import { WAZA_EFFECT_KEY, wazaChime } from "./core/move-waza.mjs";
import { createWazaAudio } from "./waza-audio";
import { createMoveSoundPlayer, moveSoundForUsi } from "./core/move-sound";
import { finishingMate } from "./core/mate-finish.mjs";
import type { EngineFactory } from "./composables/match/analysisEngines";

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  /** 観戦の本局を指すエンジン(対局画面のensureEngineFactory)。なければ観戦しない(結果だけ)。 */
  engineFactory: { type: Function as PropType<(() => Promise<EngineFactory>) | null>, default: null },
  /** 場面の地の文の名前(師匠)。 */
  playerName: { type: String, default: "" },
});
const emit = defineEmits<{ close: []; research: [request: { sfen: string; moves: string[]; ply: number; name?: string }] }>();

const MOOD_LABELS = ["絶不調", "不調", "ふつう", "好調", "絶好調"];
const MOOD_MARKS = ["▼▼", "▼", "―", "▲", "▲▲"];
/** 稽古の丸いボタンの字(48-3)。 */
const TRAINING_MARKS: Record<string, string> = { tsume: "詰", kifu: "譜", jissen: "戦", fast: "速", shisho: "師" };
/** 一門の仲間の顔の色(並んだ順)。 */
const FRIEND_COLORS = ["#d77a9b", "#4f7fc4", "#3fa38f", "#c98a2e", "#8e6ad8", "#5f8f3f"];
const APTITUDE_SHORT: Record<string, string> = { static: "対居", ranging: "対振", aifuri: "相振", kakugawari: "角換", fast: "早指", long: "長時間" };

const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const state = shallowRef<any>(null);
onMounted(() => {
  ichimon.value = loadIchimon(storage());
  teamIds.value = defaultTeam(friendPool(ichimon.value));
  state.value = loadDiscipleRun(storage());
  // ほかの枠に記録があれば、どの弟子を育てるかから(27章)。
  refreshSlots();
  if (otherSlots.value) showSlots();
});

// ---- 弟子の記録(27章)。遊んでいる枠はdisciple:v1、ほかはdisciple-slots:v1にしまう。
const slotsShown = ref(false);
const slotList = ref<ReturnType<typeof discipleSlotCards>>([]);
const slotAsk = ref(-1);
const otherSlots = ref(false);
function refreshSlots() {
  slotList.value = discipleSlotCards(storage());
  otherSlots.value = slotList.value.some((card) => !card.active && !card.empty);
}
function showSlots() {
  refreshSlots();
  slotAsk.value = -1;
  slotsShown.value = true;
}
function openSlot(index: number) {
  switchDiscipleSlot(storage(), index);
  state.value = loadDiscipleRun(storage());
  slotsShown.value = false;
  line.value = "";
  refreshSlots();
}
function removeSlot(index: number) {
  const card = slotList.value.find((item) => item.index === index);
  if (card?.active) commit(null);
  else deleteDiscipleSlot(storage(), index);
  refreshSlots();
  slotAsk.value = -1;
}
/** 記録の一覧から戻る(遊んでいる記録があればそこへ、なければホームへ)。 */
function leaveSlots() {
  slotsShown.value = false;
  if (!state.value) emit("close");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function commit(next: any) {
  state.value = next;
  saveDiscipleRun(storage(), next);
}
const view = computed(() => (state.value ? discipleView(state.value) : null));
// 弟子の絵ができるまで、百花の立ち絵で代用する(19-9)。
const portrait = computed(() => `${props.assetBaseUrl}/characters/sakurano-momoka.webp?v=1`);

// ---- 弟子を選ぶ
const pickedId = ref(DISCIPLES[0].id);
const picked = computed(() => DISCIPLES.find((entry) => entry.id === pickedId.value) ?? DISCIPLES[0]);
const pickedStats = computed(() => STAT_KEYS.map((key) => ({ key, label: STAT_LABELS[key], value: picked.value.stats[key], rank: statRank(picked.value.stats[key]) })));
// ---- 一門と連れていく仲間(29章)
const ichimon = ref(loadIchimon(null));
const ichimonOpen = ref(false);
const pool = computed(() => friendPool(ichimon.value));
const teamIds = ref<string[]>([]);
function toggleFriend(id: string) {
  teamIds.value = teamIds.value.includes(id) ? teamIds.value.filter((item) => item !== id) : teamIds.value.length < TEAM_SIZE ? [...teamIds.value, id] : teamIds.value;
}
/** 育成が終わったら、弟子を一門に入れる(1回だけ)。 */
vueWatch(() => state.value?.end, (end) => {
  if (!end || !state.value || state.value.ichimonJoined) return;
  const joined = joinIchimon(ichimon.value, state.value);
  if (!joined.joined) return;
  ichimon.value = joined.ichimon;
  saveIchimon(storage(), joined.ichimon);
  commit(joined.state);
  teamIds.value = defaultTeam(pool.value);
}, { immediate: true });
function start() {
  const team = pool.value.length > TEAM_SIZE ? pickTeam(pool.value, teamIds.value) : pickTeam(pool.value, defaultTeam(pool.value));
  commit(createDiscipleRun({ seed: Date.now() >>> 0, discipleId: pickedId.value, team }));
  say("先生、今日からよろしくお願いします");
}
function again() {
  commit(null);
  line.value = "";
}

// ---- 弟子の一言と、跳ねる動き(D:3-1 無反応をなくす)
const line = ref("");
const bounce = ref(false);
function say(text: string) {
  line.value = text;
  bounce.value = false;
  requestAnimationFrame(() => {
    bounce.value = true;
  });
}

// ---- 予定
const training = ref(false);
const selectedId = ref("tsume");
const choice = ref("steady");
const selected = computed(() => view.value?.trainings.find((item) => item.id === selectedId.value) ?? null);
const previewGains = computed<Record<string, number>>(() => (training.value && selected.value && !researching.value ? selected.value.gains : {}));
const friendName = (id: string) => view.value?.friends.find((friend: { id: string }) => friend.id === id)?.name ?? "";
function openTraining() {
  training.value = true;
}
/** 稽古の丸いボタン。選んでいる稽古をもう一度押すと決まる(48-3、D:3-1)。 */
function pickTraining(id: string) {
  if (id === selectedId.value) confirmTraining();
  else selectedId.value = id;
}
/** 「これにする」: 稽古は指導の引き出しへ、研究はそのまま決める(49章)。 */
function confirmTraining() {
  if (researching.value) research();
  else openLesson();
}
// ---- 研究(49章)。作戦帳の1枚の熟練度を上げる。
const researching = computed(() => selectedId.value === "research");
const researchCardId = ref("");
const researchRow = computed(() => {
  const rows = view.value?.book.rows ?? [];
  return rows.find((row: { id: string }) => row.id === researchCardId.value) ?? rows.find((row: { id: string }) => row.id === view.value?.mastery?.card) ?? rows[0] ?? null;
});
const researchGain = computed(() => Math.round(RESEARCH.mastery * ((MOOD_SCALE as Record<string, number>)[String(Math.round(view.value?.mood ?? 0))] ?? 1)));
/** 師匠(あなた)の対局の棋譜(新しい順)。研究のときに、同じ作戦の向きの対局を研究ノートに写す(49-14)。 */
const masterGames = shallowRef<{ moves: string[]; userColor: "black" | "white" }[]>([]);
const masterCount = computed(() => (researchRow.value ? masterGameCount(researchRow.value.id, masterGames.value) : 0));
vueWatch(researching, (now) => {
  if (now) masterGames.value = loadMyGames(storage()).map((game: { moves: string[]; userColor: "black" | "white" }) => ({ moves: game.moves, userColor: game.userColor }));
});
function research() {
  const card = researchRow.value?.id;
  if (!card) return;
  const { state: next, result } = chooseAction(state.value, { kind: "research", card, master: masterGames.value });
  training.value = false;
  selectedId.value = "tsume";
  commit(next);
  say(growthLine(result) || result.text);
}
/** 選んだ稽古で何が伸びるか(主に・少し)。 */
const trainingNote = computed(() => {
  const training = TRAININGS.find((item) => item.id === selectedId.value);
  if (!training) return "";
  const head = training.main === "choice" ? "選んだ能力と、戦い方" : `主に「${STAT_LABELS[training.main as keyof typeof STAT_LABELS]}」${training.sub ? `、少し「${STAT_LABELS[training.sub as keyof typeof STAT_LABELS]}」` : ""}`;
  return selected.value?.friends.length ? `${head}・仲間と一緒で伸びが増える` : head;
});
/** 稽古を選んでいるあいだ、体力のゲージに斜線で見せる使う分。 */
const staminaCost = computed(() => (training.value ? (researching.value ? RESEARCH.stamina : selected.value?.stamina ?? 0) : 0));
const friendColor = (id: string) => {
  const index = view.value?.friends.findIndex((friend: { id: string }) => friend.id === id) ?? 0;
  return FRIEND_COLORS[Math.max(0, index) % FRIEND_COLORS.length];
};
const friendBond = (id: string) => view.value?.friends.find((friend: { id: string }) => friend.id === id)?.bond ?? 0;
// ---- 上の札と、例会の日(48-2)
const detailOpen = ref(false);
const eventOpen = ref(false);
const eventDay = computed(() => view.value?.kind === "exam" || view.value?.kind === "reikai");
vueWatch(() => state.value?.turn, () => {
  eventOpen.value = false;
});
/** 左上の札。例会の日は「今日」、ふだんは目標まであといくつ。 */
const turnCard = computed(() => {
  const current = view.value;
  if (!current) return { top: "", pre: "", big: "", unit: "", tag: "" };
  const half = String(current.calendar.sub ?? "").split("・")[0];
  const top = `${current.calendar.label}・${half}`;
  if (eventDay.value) return { top, pre: "", big: "今日", unit: "", tag: current.kind === "exam" ? "入会試験" : current.big ? "大一番" : "例会の日" };
  if (current.goal.left) return { top, pre: "あと", big: String(current.goal.left), unit: current.goal.unit ?? "ターン", tag: current.place };
  return { top, pre: "", big: `${current.calendar.month}月`, unit: "", tag: current.place };
});
/** 下の能力の列を隠す段(終わり・言葉・例会の札・指導の引き出し)。 */
const lessonOrSheet = computed(() => Boolean(view.value?.end || view.value?.kind === "words" || (eventDay.value && eventOpen.value) || lesson.value));
function openPlansFromDetail() {
  detailOpen.value = false;
  plansOpen.value = true;
}
// 指導の引き出し(25-1)。手札は弟子の状態から決まる(選び直しても同じ手札)。
const lesson = ref<{ hands: string[][]; picks: string[] } | null>(null);
const lessonHand = computed(() => (lesson.value ? lesson.value.hands[lesson.value.picks.length] ?? [] : []));
const lessonScore = computed(() => scoreLesson(state.value ?? {}, lesson.value?.picks ?? []));
function cardCost(id: string) {
  const card = cardById(id);
  if (!card) return "";
  return card.stamina > 0 ? `体力＋${card.stamina}` : card.stamina < 0 ? `体力${card.stamina}` : "体力そのまま";
}
function openLesson() {
  lesson.value = { hands: lessonHands(state.value, selectedId.value), picks: [] };
}
function pickCard(id: string) {
  if (!lesson.value) return;
  const picks = [...lesson.value.picks, id];
  lesson.value = { ...lesson.value, picks };
  if (picks.length >= LESSON_ROUNDS) train(picks);
}
function finishLesson() {
  if (!lesson.value) return;
  const picks = [...lesson.value.picks];
  while (picks.length < LESSON_ROUNDS) picks.push(autoPick(state.value, lesson.value.hands[picks.length] ?? [], picks));
  train(picks);
}
function train(cards: string[] = []) {
  const { state: next, result } = chooseAction(state.value, { kind: "train", id: selectedId.value, choice: choice.value, cards });
  training.value = false;
  lesson.value = null;
  commit(next);
  say(growthLine(result) || (result.failed ? "……ごめんなさい、今日は集中できませんでした" : result.text));
}
function act(kind: "rest" | "outing" | "study" | "master") {
  const { state: next, result } = chooseAction(state.value, { kind });
  commit(next);
  say(growthLine(result) || result.text);
}
/** 覚えたスキルと、引き出しに増えたカードの知らせ(G:3 出来事の重さ。ふだんの一言より先に言う)。 */
function growthLine(result: { newSkills?: string[]; newCards?: string[]; newCharms?: string[]; overcome?: boolean }) {
  if (result.overcome) return "先生、勝てました。もう、大事な日もこわくないです";
  const skills = (result.newSkills ?? []).map((id) => `「${skillById(id)?.name}」`).join("");
  if (skills) return `先生、スキル${skills}を覚えました！`;
  const cards = (result.newCards ?? []).map((id) => `「${cardById(id)?.label}」`).join("");
  if (cards) return `指導の引き出しに${cards}が増えた`;
  const charms = (result.newCharms ?? []).map((id) => `「${charmById(id)?.name}」`).join("");
  return charms ? `お守り${charms}を手に入れた。大一番に持たせられる` : "";
}
const skillsOpen = ref(false);
// ---- 研究ノート(49章)
const notesCard = ref("");
const noteIndex = ref(0);
const noteList = computed(() => (notesCard.value && state.value ? noteRows(planBookOf(state.value), notesCard.value) : []));
const notesLabel = computed(() => planCard(notesCard.value)?.label ?? "");
const noteRow = computed(() => noteList.value[Math.min(noteIndex.value, Math.max(0, noteList.value.length - 1))] ?? null);
const noteArrows = computed(() => {
  const row = noteRow.value;
  if (!row) return [];
  // 避ける手は矢印を出さない(盤の点線の矢印は「相手の狙い」の印なので)。一覧の「×」で見せる。
  return row.move ? [{ usi: row.move, guideKind: "plan" as const }] : [];
});
const sourceLabel = (source: string) => (NOTE_SOURCE_LABELS as Record<string, string>)[source] ?? "";
function openNotes(cardId: string) {
  notesCard.value = cardId;
  noteIndex.value = 0;
}
/** ノートの手の表記(「▲7六歩」)。 */
function noteMoveLabel(row: { sfen: string; move: string; avoid: string }, avoid = false) {
  return moveLabel(row.sfen, avoid ? row.avoid : row.move, "") || (avoid ? row.avoid : row.move);
}
const noteStageEl = ref<HTMLElement | null>(null);
const noteBoxStyle = ref<Record<string, string>>({});
const noteAspect = ref(878 / 1128);
function onNoteBoardResize({ width, height }: { width: number; height: number }) {
  if (width > 0 && height > 0 && Math.abs(width / height - noteAspect.value) > 0.005) noteAspect.value = width / height;
}
function layoutNoteBox() {
  const stage = noteStageEl.value;
  if (!stage) return;
  const width = Math.max(1, Math.floor(Math.min(stage.clientWidth, stage.clientHeight * noteAspect.value)));
  noteBoxStyle.value = { width: `${width}px`, height: `${Math.max(1, Math.floor(width / noteAspect.value))}px` };
}
const noteObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layoutNoteBox()) : null;
vueWatch(noteStageEl, (stage) => {
  noteObserver?.disconnect();
  if (stage) noteObserver?.observe(stage);
  layoutNoteBox();
});
vueWatch(noteAspect, layoutNoteBox);
onBeforeUnmount(() => noteObserver?.disconnect());
// ---- 会の画面(36-5)。名札掛け・対戦表・会員・規定。
const SOCIETY_TABS = [
  { id: "board", label: "名札掛け" },
  { id: "day", label: "対戦表" },
  { id: "members", label: "会員" },
  { id: "rules", label: "規定" },
] as const;
type SocietyTab = (typeof SOCIETY_TABS)[number]["id"];
const societyOpen = ref(false);
const societyTab = ref<SocietyTab>("board");
const memberSel = ref("");
const society = computed(() => (state.value ? societyView(state.value) : null));
/** 会のボタンは、はじめての例会の朝の場面(制度の札「名札掛けと例会」)を見てから出す(36-6)。前の版の保存や奨励会では、すぐ出す。 */
const societyShown = computed(() => {
  const s = state.value;
  if (!s) return false;
  return Boolean(s.shoreikai) || (s.systemCards ?? []).includes("reikai") || (s.kenshukai?.dayNo ?? 0) > 1;
});
const systemCards = computed(() => systemCardsOf(state.value));
const selectedMember = computed(() => society.value?.members.find((member) => member.id === memberSel.value) ?? null);
/** 会員の札のレーダーチャートに点線で重ねる、弟子の4つの能力(44章)。 */
const memberCompare = computed(() => (state.value?.stats ? {
  label: view.value?.name ?? "弟子",
  abilities: STAT_KEYS.map((key) => ({ key, value: Math.round(state.value.stats[key] ?? 0), rank: String(statRank(state.value.stats[key] ?? 0)) })),
} : null));
/** 例会の札の、相手の4つの能力(弟子と並べる)。 */
const opponentStats = computed(() => {
  const opponent = view.value?.opponent;
  return opponent?.id && Number.isFinite(opponent.level) ? memberMakeup(opponent.id, opponent.level).abilities : [];
});
function openSociety(tab: SocietyTab = "board") {
  societyTab.value = tab;
  memberSel.value = "";
  societyOpen.value = true;
}
function closeSociety() {
  societyOpen.value = false;
  memberSel.value = "";
}
/** 作戦帳のシート(35-12)。覚えられる作戦が出たら開く。 */
const plansOpen = ref(false);
const PLAN_TIER_TEXT: Record<string, string> = { start: "はじめ", basic: "基本", advanced: "応用", special: "特殊な囲い", surprise: "奇襲" };
const PLAN_VS_TEXT: Record<string, string> = { both: "相手を選ばない", static: "居飛車の相手に", ranging: "振り飛車の相手に" };
vueWatch(() => view.value?.book?.offer?.length ?? 0, (now, before) => {
  if (now > (before ?? 0)) plansOpen.value = true;
});
function learn(id: string) {
  if (!state.value) return;
  const { state: next, text } = learnPlan(state.value, id);
  if (!text) return;
  commit(next);
  say(text);
}
function skipLearnNow() {
  if (!state.value) return;
  commit(skipLearn(state.value));
}

// ---- 問題の場面(26章)
const sceneEl = ref<InstanceType<typeof NovelScene> | null>(null);
const sceneChoice = ref<string | null>(null);
/** いま見せる場面(言葉の窓・観戦・終わりの間は待つ)。 */
const sceneData = computed(() => {
  const pending = view.value?.scene;
  if (!pending || slotsShown.value || view.value?.kind === "words" || view.value?.end || watch.value) return null;
  return libraryScene(pending.script, { playerName: props.playerName, vars: pending.vars });
});
function closeScene() {
  if (!state.value) return;
  const { state: next, text } = resolveScene(state.value, sceneChoice.value);
  sceneChoice.value = null;
  commit(next);
  if (text) say(text);
}

// ---- 入会試験・例会
/** 大一番の作戦。cardは作戦帳から選んだ作戦(空ならおまかせ。35章のO2)。 */
const plan = reactive({ opening: "own", ending: "wait", card: "" });
/** 大一番に持たせるお守り(26章)。空なら持たせない。 */
const charmPick = ref("");
function play() {
  const big = Boolean(view.value?.big);
  const charm = big ? charmPick.value || null : null;
  charmPick.value = "";
  const chosen = big ? { ...plan } : null;
  // 選んだ作戦は、その日の相手に合わせたものなので持ち越さない。
  plan.card = "";
  const { state: next, result } = playEvent(state.value, { plan: chosen, charm });
  commit(next);
  const grown = growthLine(result);
  if (grown) return say(grown);
  say(result.losses === 0 ? `${result.wins}勝！ 先生、勝ちました` : result.wins === 0 ? "……全部負けてしまいました" : `${result.wins}勝${result.losses}敗でした`);
}
function words(id: string) {
  resultSeen.value = false;
  const { state: next, text } = chooseWords(state.value, id);
  commit(next);
  say(text);
}

// ---- 観戦と見立て(24章)。その日のはじめの局をエンジンが本当に指し、終局したら崩れた場面に印を付ける。
type WatchMark = {
  ply: number; loss: number; cause: string; clues: string[];
  /** 6つの崩れ方の副(おしい)・中身・背景の札・盤の手がかり(33-5)。前の版の棋譜帳の印には無い。 */
  alt?: string | null; sub?: string; tesuji?: string; tags?: string[]; rings?: string[]; threat?: string;
  from?: number; to?: number; startWord?: string; endWord?: string;
};
type Watch = {
  label: string; side: "black" | "white"; opponent: { name: string; level: number }; plan: { opening: string; ending: string; card?: string } | null; charm: string | null;
  /** 今日の作戦(35-7)。棋譜帳から開いた前の版の局には無い。 */
  plans?: { own: string; opponent: string } | null;
  entries: { move: string; eval: number; loss: number; d?: unknown; time?: number }[]; end: unknown; win: boolean; done: boolean;
  /** 駒落ちの局のはじめの局面(37章)。平手は空。 */
  sfen?: string;
  /** 持ち時間(38章)。棋譜帳から開いた局には無い。 */
  control?: { main: number; byoyomi: number } | null;
  timeText?: string;
  marks: WatchMark[]; guesses: (string | null)[]; selected: number; error: string;
  /** 観戦の段(33-3)。指している→終局の札→その日の結果発表→検討。 */
  phase: "playing" | "end" | "result" | "review";
  endCard: { stamp: string; line: string; mate?: string } | null;
  day: ReturnType<typeof dayResultView> | null;
  /** live=観戦した直後、book=棋譜帳から開いた(答えは入れない。33-4)。 */
  mode: "live" | "book";
  /** 検討の盤の手数(はじめから何手指した局面か)。 */
  upto: number;
  endReason: string;
  /** 分かれ目さがし(33-6)。印を見る前に、形勢が分かれた手を当てる。 */
  seek: { ply: number; tries: number[]; hit: boolean; closed: boolean } | null;
  /** 弟子の好手(33-6)と、ほめた好手の名前(1局に1回)。 */
  good: { ply: number; kind: string; name: string }[];
  goodSel: number;
  praised: string;
};
const watch = ref<Watch | null>(null);
/** 観戦の番号(やめたり次の観戦を始めたりしたら変わる。古い本局の知らせは捨てる)。 */
let watchTicket = 0;
const engineGame = useEngineGame({ engineFactory: () => props.engineFactory!(), storage });
onBeforeUnmount(() => engineGame.dispose());
function startWatch() {
  const big = Boolean(view.value?.big);
  const planNow = big ? { ...plan } : null;
  const charm = big ? charmPick.value || null : null;
  const made = watchSpec(state.value, { plan: planNow, charm });
  if (!made) {
    play();
    return;
  }
  const current: Watch = {
    label: made.spec.label, side: made.side === "white" ? "white" : "black", opponent: made.opponent, plan: planNow, charm, plans: made.plans, entries: [], end: null, win: false, done: false,
    sfen: made.spec.sfen ?? "", control: made.spec.control ?? null, timeText: made.timeText ?? "",
    marks: [], guesses: [], selected: -1, error: "", phase: "playing", endCard: null, day: null, mode: "live", upto: 0, endReason: "",
    seek: null, good: [], goodSel: -1, praised: "",
  };
  watch.value = current;
  const ticket = ++watchTicket;
  stopPace();
  resetWatchWaza();
  // 保存していた手(画面を離れて戻ったとき)は、playの中で先にまとめて届くので、待たずに並べる。
  paceInstant = true;
  const playing = engineGame.play(made.spec, (entry, index) => {
    if (ticket !== watchTicket) return;
    arrived[index] = entry as Watch["entries"][number];
    if (paceInstant) {
      current.entries = arrived.slice(0, index + 1);
      watch.value = { ...current, entries: [...current.entries] };
      revealMoves(current, index + 1, { quiet: true });
      return;
    }
    pumpPace(current, ticket);
  });
  paceInstant = false;
  playing.then((game) => {
    if (!game || ticket !== watchTicket) return;
    // 見せる手が追いつくのを待ってから、終局にする(38章)。
    paceEnd = () => finishWatchGame(current, game.end as { winner: string });
    pumpPace(current, ticket);
  }).catch((error) => {
    console.warn("師匠の1年の観戦の本局を指せませんでした", error);
    if (ticket !== watchTicket) return;
    stopPace();
    current.error = "エンジンを起動できなかったので、結果だけ見ます";
    watch.value = { ...current };
    play();
    current.done = true;
  });
}
// ---- 手を見せる速さと時計(38章)。エンジンが考え終えた順に受け取り(arrived)、その手で使った持ち時間に合わせた早送りの長さで1手ずつ見せる。
let arrived: Watch["entries"] = [];
let paceTimer: ReturnType<typeof setInterval> | null = null;
let paceInstant = false;
let paceEnd: (() => void) | null = null;
/** 見せる前の手を考えている途中の進み(0〜1)。時計の早送りに使う。 */
const paceProgress = ref(0);
function stopPace() {
  if (paceTimer) clearInterval(paceTimer);
  paceTimer = null;
  clearTimeout(holdTimer);
  holdUntil = 0;
  arrived = [];
  paceEnd = null;
  paceProgress.value = 0;
}
// ---- 技の演出・駒音・終局の判子(42章)。対局と同じ判定と帯(watch-waza.mjs)を、見せた1手ずつに当てる。
// 観戦は盤を触らずに進むので、駒音はWeb Audioで鳴らす(押してから時間がたっても鳴る。47章)。
const moveSounds = createMoveSoundPlayer(() => props.assetBaseUrl, { webAudio: true });
onMounted(() => moveSounds.preload());
const wazaAudio = createWazaAudio();
/** 画面を押したときに、駒音と技の音の出口を開く。 */
function unlockSounds() {
  moveSounds.unlock();
  wazaAudio.unlock();
}
onMounted(() => window.addEventListener("pointerdown", unlockSounds, { capture: true, passive: true }));
onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", unlockSounds, { capture: true });
  moveSounds.dispose();
});
let wazaTracker = createWatchWaza();
/** 演出を当てた手の数(保存から戻ったときにまとめて並べた手は、形の追跡だけ進める)。 */
let wazaSeen = 0;
const watchCutin = ref<WazaCutinView | null>(null);
const watchGlow = ref<{ id: number; square: string; tier: string; mine: boolean; targets: string[]; pieces?: string[]; edge?: boolean; look?: string } | null>(null);
let wazaSeq = 0;
let holdUntil = 0;
const holding = () => Date.now() < holdUntil;
let cutinTimer: ReturnType<typeof setTimeout> | undefined;
let glowTimer: ReturnType<typeof setTimeout> | undefined;
let holdTimer: ReturnType<typeof setTimeout> | undefined;
/** 光の輪は帯より少し長く残す(どの駒の手だったか見返せる。対局と同じ)。 */
const WATCH_GLOW_MIN_MS = 1200;
/** 対局の「技の演出」の設定(全部・かんたん・なし)に従う。 */
function wazaChoice(): string {
  try {
    const value = storage()?.getItem(WAZA_EFFECT_KEY);
    return value === "off" || value === "simple" ? value : "on";
  } catch {
    return "on";
  }
}
function clearWatchWaza() {
  clearTimeout(cutinTimer);
  clearTimeout(glowTimer);
  clearTimeout(holdTimer);
  watchCutin.value = null;
  watchGlow.value = null;
}
function resetWatchWaza() {
  clearWatchWaza();
  wazaTracker = createWatchWaza();
  wazaSeen = 0;
}
onBeforeUnmount(clearWatchWaza);
/**
 * 見せた手(index番目まで)に、駒音と技の演出を当てる。帯の分だけ次の手を待たせるミリ秒を返す。
 * quietなら音と帯を出さず、形の追跡だけ進める(保存から戻ったときの手)。
 */
function revealMoves(current: Watch, upto: number, { quiet = false }: { quiet?: boolean } = {}) {
  let hold = 0;
  const start = current.sfen || STANDARD_SFEN;
  const choice = wazaChoice();
  for (let index = wazaSeen; index < upto; index += 1) {
    const entry = current.entries[index];
    if (!entry) break;
    const moves = current.entries.slice(0, index).map((item) => item.move);
    const before = index ? sfenAfter(moves, current.sfen ?? "") ?? start : start;
    const after = sfenAfter([...moves, entry.move], current.sfen ?? "") ?? before;
    const wazaStep = watchWazaStep(wazaTracker, {
      before, usi: entry.move, after, ply: index + 1, side: current.side, name: view.value?.name ?? "",
      plan: planNames(current.plans?.own), simple: choice === "simple",
    });
    // 弟子が研究ノートの手を指したら「研究どおり！」の帯(49章。技の帯が出る手は技の帯を先に)。
    const memo = !wazaStep && (entry.d as { s?: string } | undefined)?.s === "memo" && moverOfPly(index + 1, current.sfen) === current.side;
    const step = wazaStep ?? (memo ? watchMemoStep(wazaTracker, { usi: entry.move, name: view.value?.name ?? "", simple: choice === "simple" }) : null);
    wazaSeen = index + 1;
    if (quiet || index < upto - 1) continue;
    const sound = moveSoundForUsi(before, entry.move);
    if (sound) moveSounds.play(sound);
    if (!step || choice === "off") continue;
    wazaSeq += 1;
    clearTimeout(cutinTimer);
    clearTimeout(glowTimer);
    watchCutin.value = { id: wazaSeq, ...step.cutin };
    watchGlow.value = { id: wazaSeq, ...step.glow };
    cutinTimer = setTimeout(() => { watchCutin.value = null; }, step.cutin.ms);
    glowTimer = setTimeout(() => { watchGlow.value = null; }, Math.max(step.cutin.ms, WATCH_GLOW_MIN_MS));
    wazaAudio.play(wazaChime(step.cutin.size === "big" ? step.cutin.tier : "normal", { mine: step.cutin.mine }), 90);
    // 弟子の大きな帯は読み終わるまで次の手を待たせる(小さな帯は待たせない。D:3-2 間)。
    if (step.cutin.size === "big") hold = Math.max(hold, step.cutin.ms);
  }
  return hold;
}
function pumpPace(current: Watch, ticket: number) {
  if (paceTimer || holding() || ticket !== watchTicket) return;
  const index = current.entries.length;
  const entry = arrived[index];
  if (!entry) {
    // まだ読んでいる手は、届いたときにもう一度呼ばれる。読み終えて見せる手も尽きたら終局。
    if (paceEnd) {
      const end = paceEnd;
      paceEnd = null;
      end();
    }
    return;
  }
  const duration = paceMs(entry);
  const started = Date.now();
  paceTimer = setInterval(() => {
    if (ticket !== watchTicket) {
      stopPace();
      return;
    }
    const progress = Math.min(1, (Date.now() - started) / duration);
    paceProgress.value = progress;
    if (progress < 1) return;
    if (paceTimer) clearInterval(paceTimer);
    paceTimer = null;
    paceProgress.value = 0;
    current.entries = arrived.slice(0, index + 1);
    watch.value = { ...current, entries: [...current.entries] };
    const hold = revealMoves(current, index + 1);
    if (hold > 0) {
      holdUntil = Date.now() + hold;
      holdTimer = setTimeout(() => { holdUntil = 0; pumpPace(current, ticket); }, hold);
    } else pumpPace(current, ticket);
  }, 100);
}
onBeforeUnmount(stopPace);
/** 盤の名札の横の時計(38章)。観戦は見せた手まで、検討は見ている手まで。 */
const watchClockView = computed(() => {
  const current = watch.value;
  if (!current?.control) return null;
  const upto = current.phase === "review" ? current.upto : current.entries.length;
  const whiteFirst = (current.sfen ?? "").split(" ")[1] === "w";
  const progress = current.phase === "playing" && !current.done ? paceProgress.value : 0;
  return watchClocks(current.phase === "playing" ? arrived.length > current.entries.length ? arrived : current.entries : current.entries, upto, { control: current.control, whiteFirst, progress });
});
function finishWatchGame(current: Watch, end: { winner: string }) {
  current.end = end;
  current.win = end?.winner === current.side;
  // その日の局を記録する(観戦した局はエンジンの勝ち負け)。
  // 弟子から見たいちばん低い評価値(劣勢から勝つと、逆境の粘りの条件に数える。25-3)。
  const sign = current.side === "black" ? 1 : -1;
  const watchedMin = Math.min(0, ...current.entries.map((entry) => sign * (Number(entry?.eval) || 0)));
  // 観戦した本局の手は、研究メモ(35-13)に使う。
  // 研究メモは平手の作戦の手なので、駒落ちの局からは書き足さない(37章)。
  const { state: next, result } = playEvent(state.value, { plan: current.plan, forced: [current.win], watchedMin, charm: current.charm, entries: current.sfen ? [] : current.entries });
  charmPick.value = "";
  // 選んだ作戦は、その日の相手に合わせたものなので持ち越さない。
  plan.card = "";
  commit(next);
  // 崩れ方は盤面で起きたことから決める(33-5)。言えない手は印にしない。大一番は背景の札に。
  current.marks = reviewMarks(current.entries, current.side, { dan: eyeDan(state.value?.eye), big: Boolean(current.plan), start: current.sfen ?? "" });
  current.guesses = current.marks.map(() => null);
  current.selected = current.marks.length ? 0 : -1;
  current.good = goodMoves(current.entries, current.side, { start: current.sfen ?? "" });
  current.done = true;
  // 終局の札 → その日の結果発表 → 検討の順に見せる(33-3。結果を先に知らせる)。
  current.endCard = endCardText({ win: current.win, reason: (end as { reason?: string })?.reason, plies: current.entries.length });
  // 詰みで終わった局は、最後の王手の連続を「N手詰め」で添える(大会の寄せの記録と同じ数え方。mate-finish.mjs)。
  if ((end as { reason?: string })?.reason === "mate") {
    const mate = finishingMate(current.entries.map((entry) => entry.move), { initialSfen: current.sfen || STANDARD_SFEN });
    if (mate?.plies) current.endCard = { ...current.endCard, mate: `${mate.plies}手詰め` };
  }
  clearWatchWaza();
  // 判子の音(大会の終局の判子と同じ音)。札が押されるのに合わせる。
  window.setTimeout(() => moveSounds.play("stamp"), 180);
  current.day = dayResultView(state.value?.lastEvent);
  current.phase = "end";
  current.upto = current.entries.length;
  current.endReason = String((end as { reason?: string })?.reason ?? "resign");
  saveToBook(current);
  watch.value = { ...current };
  resultSeen.value = true;
  say(growthLine(result) || (current.win ? "勝ちました。先生、見ててくれましたか" : "負けてしまいました……"));
  window.setTimeout(() => {
    showDayResult();
  }, current.day?.big ? END_CARD_BIG_MS : END_CARD_MS);
}
/** 終局の札を見せる長さ(大一番は少し長く止める。D:3-2)。 */
const END_CARD_MS = 1500;
const END_CARD_BIG_MS = 2300;
/** 観戦した日は、声をかけるの札の結果の一覧を1行にまとめる(結果はもう見たので)。 */
const resultSeen = ref(false);
function showDayResult() {
  if (watch.value?.phase === "end") watch.value = { ...watch.value, phase: "result" };
}
function startReview() {
  const current = watch.value;
  if (!current) return;
  // 形勢が分かれた手があれば、印を見る前に分かれ目さがし(33-6)。はじめの局面から並べる。
  const point = current.marks.length ? turningPoint(current.entries, current.side) : null;
  if (point) {
    watchTab.value = "marks";
    watch.value = { ...current, phase: "review", selected: -1, upto: 0, seek: { ply: point.ply, tries: [], hit: false, closed: false } };
    return;
  }
  // 答える印があれば見立てのタブ、なければ棋譜のタブから。
  watchTab.value = current.marks.length ? "marks" : current.good.length ? "good" : "kifu";
  watch.value = { ...current, phase: "review", selected: current.marks.length ? 0 : -1, upto: current.marks[0]?.ply ?? current.good[0]?.ply ?? current.entries.length };
}
/** 分かれ目さがしの途中か(印・形勢の言葉・グラフの線・AIの検討を伏せる)。 */
const seeking = computed(() => Boolean(watch.value?.phase === "review" && watch.value.seek && !watch.value.seek.closed));
const seekDone = computed(() => Boolean(watch.value?.seek && (watch.value.seek.hit || watch.value.seek.tries.length >= SEEK_RULES.tries)));
const seekHint = computed(() => {
  const seek = watch.value?.seek;
  if (!seek || !seek.tries.length) return "";
  if (seek.hit) return `見抜いた！ 分かれ目は${seek.ply}手目。師匠の眼が1つ上がる`;
  if (seekDone.value) return `分かれ目は${seek.ply}手目でした`;
  const judged = judgeSeek(seek.tries[seek.tries.length - 1], seek);
  return judged.direction === "early" ? "もう少しあと。もう1回" : "もう少し前。もう1回";
});
/** 「ここが分かれ目」: 今の手数で答える(2回まで)。 */
function seekHere() {
  const current = watch.value;
  if (!current?.seek || seekDone.value) return;
  const tries = [...current.seek.tries, current.upto];
  const hit = judgeSeek(current.upto, current.seek).hit;
  watch.value = { ...current, seek: { ...current.seek, tries, hit } };
}
/** 「印を見る」: 分かれ目さがしを終えて(飛ばして)、印に答える段へ。 */
function closeSeek() {
  const current = watch.value;
  if (!current?.seek) return;
  watchTab.value = current.marks.length ? "marks" : "kifu";
  watch.value = { ...current, seek: { ...current.seek, closed: true } };
  if (current.marks.length) selectMark(0);
}
/** 好手を選ぶ(その手の局面へ)。 */
function selectGood(index: number) {
  const current = watch.value;
  const good = current?.good[index];
  if (!current || !good || seeking.value) return;
  watchTab.value = "good";
  watch.value = { ...current, goodSel: index };
  goPly(good.ply);
}
const selectedGood = computed(() => (watch.value && watch.value.goodSel >= 0 ? watch.value.good[watch.value.goodSel] ?? null : null));
/** ほめる(1局に1回。やる気は検討を終えたときに入れる。D:5-4)。 */
function praiseGood() {
  const current = watch.value;
  const good = selectedGood.value;
  if (!current || !good || current.praised || current.mode === "book") return;
  watch.value = { ...current, praised: good.name };
}

// ---- 検討の盤(33-4)。1手ずつ・手の一覧・グラフで飛ぶ・AIの検討・研究で開く・棋譜帳。
const watchTab = ref<"kifu" | "marks" | "good">("kifu");
const moveListEl = ref<HTMLElement | null>(null);
/** 手の一覧(終局したら作る)。 */
const watchRows = computed(() => (watch.value?.done ? reviewRows(watch.value.entries, watch.value.side, { sfen: watch.value.sfen || STANDARD_SFEN }) : []));
const markPlies = computed(() => new Set(seeking.value ? [] : (watch.value?.marks ?? []).map((mark) => mark.ply)));
const goodPlies = computed(() => new Set(seeking.value ? [] : (watch.value?.good ?? []).map((good) => good.ply)));
/** その手が、まだ答えていない印か(答える前はAIの検討を見せない)。 */
function unansweredMark(ply: number) {
  const current = watch.value;
  if (!current || current.mode === "book") return false;
  const index = current.marks.findIndex((mark) => mark.ply === ply);
  return index >= 0 && !current.guesses[index];
}
/** 今の局面のAIの検討: 次の手のAIの最善手(矢印)と、今の手のあとのAIの読み筋。 */
const aiShown = computed(() => {
  const current = watch.value;
  if (!current || current.phase !== "review" || seeking.value) return null;
  const start = { start: current.sfen ?? "" };
  const next = unansweredMark(current.upto + 1) ? null : aiHint(current.entries, current.upto + 1, start);
  const now = current.upto > 0 && !unansweredMark(current.upto) ? aiHint(current.entries, current.upto, start) : null;
  const shown = { nextBest: next?.bestText ?? "", nextUsi: next?.best ?? "", pv: now?.pvText ?? "" };
  return shown.nextBest || shown.pv ? shown : null;
});
const aiLocked = computed(() => Boolean(watch.value?.phase === "review" && !seeking.value && (unansweredMark(watch.value.upto) || unansweredMark(watch.value.upto + 1))));
const watchArrows = computed(() => (aiShown.value?.nextUsi ? [{ usi: aiShown.value.nextUsi, guideKind: "ai" as const }] : []));
function goPly(ply: number) {
  const current = watch.value;
  if (!current) return;
  const upto = Math.max(0, Math.min(current.entries.length, Math.round(ply)));
  // 検討で1手進めたときは駒音を鳴らす(42章。飛ぶときは鳴らさない)。
  if (upto === current.upto + 1) {
    const before = sfenAfter(current.entries.slice(0, current.upto).map((entry) => entry.move), current.sfen ?? "") ?? (current.sfen || STANDARD_SFEN);
    const sound = moveSoundForUsi(before, current.entries[current.upto]?.move ?? "");
    if (sound) moveSounds.play(sound);
  }
  watch.value = { ...current, upto, selected: seeking.value ? -1 : current.marks.findIndex((mark) => mark.ply === upto), goodSel: current.good.findIndex((good) => good.ply === upto) };
  // 手の一覧だけを動かす(scrollIntoViewは画面ごと動いて、盤が見えなくなる)。
  requestAnimationFrame(() => {
    const list = moveListEl.value;
    const row = list?.querySelector<HTMLElement>(".disciple__move--on");
    if (list && row) list.scrollTop = Math.max(0, row.offsetTop - list.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2);
  });
}
function selectMark(index: number) {
  const current = watch.value;
  const mark = current?.marks[index];
  if (!current || !mark) return;
  if (current.phase !== "review" || (current.seek && !current.seek.closed)) return;
  watchTab.value = "marks";
  goPly(mark.ply);
}
/** グラフの横の位置と手数(graphPointsと同じ物差し)。 */
const graphTotal = () => Math.max(watch.value?.entries.length ?? 0, 60);
const graphX = (ply: number) => (ply / graphTotal()) * 400;
function onGraphClick(event: MouseEvent) {
  if (watch.value?.phase !== "review") return;
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  goPly(((event.clientX - box.left) / box.width) * graphTotal());
}
let boardPointerX: number | null = null;
function onBoardPointerDown(event: PointerEvent) {
  boardPointerX = event.clientX;
}
/** 盤を左右にはらうと1手ずつ(右へはらうと戻る)。 */
function onBoardPointerUp(event: PointerEvent) {
  if (boardPointerX === null || watch.value?.phase !== "review") return;
  const dx = event.clientX - boardPointerX;
  boardPointerX = null;
  if (Math.abs(dx) >= 40) goPly(watch.value.upto + (dx < 0 ? 1 : -1));
}
function onWatchKey(event: KeyboardEvent) {
  if (watch.value?.phase !== "review" || sceneData.value) return;
  if (event.key === "ArrowLeft") goPly(watch.value.upto - 1);
  else if (event.key === "ArrowRight") goPly(watch.value.upto + 1);
  else return;
  event.preventDefault();
}
onMounted(() => window.addEventListener("keydown", onWatchKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onWatchKey));
/** 研究モードで開く(好きな局面を読ませたり、別の手を試したりできる)。 */
function openResearch() {
  const current = watch.value;
  if (!current) return;
  emit("research", { sfen: current.sfen || STANDARD_SFEN, moves: current.entries.map((entry) => entry.move), ply: current.upto, name: `${view.value?.name ?? ""} 対 ${current.opponent.name}` });
}
/** 棋譜帳に残す(答えを入れたら、答えつきで入れ替える)。 */
function saveToBook(current: Watch) {
  if (!state.value || current.mode === "book" || !current.entries.length) return;
  const entry = bookEntry({ ...current, endReason: current.endReason }, { turn: Number(state.value.turn) || 0, when: view.value?.calendar?.label ?? "" });
  commit(addBookGame(structuredClone(state.value), entry));
}
const bookOpen = ref(false);
const bookGames = computed(() => bookList(state.value));
function openBookGame(game: ReturnType<typeof bookList>[number]) {
  bookOpen.value = false;
  watchTab.value = "kifu";
  watch.value = {
    label: game.label, side: game.side === "white" ? "white" : "black", opponent: { name: game.opponent, level: 0 }, plan: null, charm: null,
    entries: game.entries.map((entry: { move: string; eval: number; best?: string; pv?: string }) => ({ ...entry, loss: 0 })), end: { reason: game.endReason }, win: game.win, done: true,
    sfen: (game as { sfen?: string }).sfen ?? "",
    marks: game.marks, guesses: game.guesses.length ? game.guesses : game.marks.map(() => null), selected: -1, error: "",
    phase: "review", endCard: null, day: null, mode: "book", upto: game.plies, endReason: game.endReason,
    seek: null, good: game.good ?? [], goodSel: -1, praised: "",
  };
}
const guessOf = (index: number) => watch.value?.guesses[index] ?? null;
const answeredCount = computed(() => watch.value?.guesses.filter(Boolean).length ?? 0);
const selectedMark = computed(() => (watch.value && watch.value.selected >= 0 ? watch.value.marks[watch.value.selected] : null));
const targetOf = (cause: string) => {
  const target = REVIEW_CAUSES[cause as keyof typeof REVIEW_CAUSES]?.target ?? CAUSES[cause as keyof typeof CAUSES]?.target ?? "steady";
  return (target === "time" ? "steady" : target) as keyof typeof STAT_LABELS;
};
/** 選んだ印の答えの判定(主・副・外れ。33-5)。 */
const selectedJudge = computed(() => {
  const mark = selectedMark.value;
  const guessId = watch.value ? guessOf(watch.value.selected) : null;
  return mark && guessId ? judgeReviewGuess(mark, guessId) : null;
});
/** 選んだ印の盤の手がかり(取られた駒の赤い輪・相手の次の手の点線の矢印)。その印の手の局面のときだけ。 */
const clueRings = computed(() => (selectedMark.value && selectedMark.value.ply === watch.value?.upto ? selectedMark.value.rings ?? [] : []));
const clueArrows = computed(() => {
  const mark = selectedMark.value;
  if (!mark?.threat || mark.ply !== watch.value?.upto) return [];
  // 相手の手の色(先手の狙いは青、後手の狙いは赤。対局の相手の狙いと同じ見せ方)。
  return [{ usi: mark.threat, color: (watch.value?.side === "black" ? "white" : "black") as "black" | "white" }];
});
function guess(id: string) {
  if (!watch.value || watch.value.selected < 0) return;
  const guesses = [...watch.value.guesses];
  guesses[watch.value.selected] = id;
  const nextIndex = guesses.findIndex((value) => !value);
  watch.value = { ...watch.value, guesses, selected: watch.value.selected };
  if (nextIndex >= 0) window.setTimeout(() => {
    if (watch.value && watch.value.guesses === guesses) selectMark(nextIndex);
  }, 1400);
}
function closeWatch() {
  const current = watch.value;
  if (!current) return;
  if (!current.done) {
    // 観戦の途中でやめた: 本局を止め、まだ何も記録しない(もう一度観戦するか、結果だけ見られる)。
    engineGame.cancel();
    stopPace();
    watchTicket += 1;
    watch.value = null;
    return;
  }
  watchTicket += 1;
  watch.value = null;
  if (current.mode === "book") return;
  if (current.phase !== "review") return;
  if (current.guesses.some(Boolean)) saveToBook(current);
  const seekHit = Boolean(current.seek?.hit);
  if (current.guesses.some(Boolean) || seekHit || current.praised) {
    const { state: next, revealed, results } = applyFindings(state.value, current.marks, current.guesses, { seekHit, praised: current.praised });
    commit(next);
    const right = results.filter((item) => item.right).length + (seekHit ? 1 : 0);
    say(revealed ? `先生……弱点は「${revealed}」なんですね` : current.praised ? praiseLine(state.value?.discipleId ?? "", current.praised) : right ? "先生、よく見てますね。そこを稽古します" : "次は、そこに気をつけます");
  }
}
/** 弟子の考えの一言(34-17)。指しているあいだは弟子の最後の手、検討では今の手(弟子の手のとき)。 */
const watchThought = computed(() => {
  const current = watch.value;
  if (!current || current.error || seeking.value) return "";
  const mine = (index: number) => moverOfPly(index + 1, current.sfen) === current.side;
  if (current.phase === "review") {
    const index = current.upto - 1;
    return index >= 0 && mine(index) ? thoughtLine(current.entries[index] as any) : "";
  }
  for (let index = current.entries.length - 1; index >= 0; index -= 1) {
    if (mine(index)) return thoughtLine(current.entries[index] as any);
  }
  return "";
});
/** 検討の今の手(弟子の手)の読み筋と、相手の実際の手(34-18)。 */
const watchReading = computed(() => {
  const current = watch.value;
  if (!current || current.phase !== "review" || seeking.value || current.upto < 1) return null;
  if (moverOfPly(current.upto, current.sfen) !== current.side) return null;
  return thoughtReading(current.entries as any, current.upto, { start: current.sfen ?? "" });
});
/** 盤の局面(選んだ印の局面。印を選んでいなければ最新の局面)と、直前の手。 */
const watchUpto = computed(() => (watch.value?.phase === "review" ? watch.value.upto : watch.value?.entries.length ?? 0));
const watchSfen = computed(() => sfenAfter((watch.value?.entries ?? []).slice(0, watchUpto.value).map((entry) => entry.move), watch.value?.sfen ?? "") ?? watch.value?.sfen ?? STANDARD_SFEN);
const watchLastMove = computed(() => (watchUpto.value > 0 ? watch.value?.entries[watchUpto.value - 1]?.move ?? "" : ""));
// 盤の枠を、描かれる盤と同じ大きさにする(TeamPeekSheet.vueと同じ方法)。
const watchStageEl = ref<HTMLElement | null>(null);
const boardBoxStyle = ref<Record<string, string>>({});
const boardAspect = ref(878 / 1128);
function onBoardResize({ width, height }: { width: number; height: number }) {
  if (width > 0 && height > 0 && Math.abs(width / height - boardAspect.value) > 0.005) boardAspect.value = width / height;
}
function layoutBoardBox() {
  const stage = watchStageEl.value;
  if (!stage) return;
  const width = Math.max(1, Math.floor(Math.min(stage.clientWidth, stage.clientHeight * boardAspect.value)));
  boardBoxStyle.value = { width: `${width}px`, height: `${Math.max(1, Math.floor(width / boardAspect.value))}px` };
}
const boardObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layoutBoardBox()) : null;
vueWatch(watchStageEl, (stage) => {
  boardObserver?.disconnect();
  if (stage) boardObserver?.observe(stage);
  layoutBoardBox();
});
vueWatch(boardAspect, layoutBoardBox);
onBeforeUnmount(() => boardObserver?.disconnect());
/** 評価値のグラフ(弟子から見た値。±2000で頭打ち)。 */
const graphPoints = computed(() => {
  const current = watch.value;
  if (!current?.entries.length) return "0,50";
  const total = Math.max(current.entries.length, 60);
  return current.entries.map((entry, index) => {
    const value = (current.side === "black" ? 1 : -1) * (Number(entry.eval) || 0);
    const y = 50 - Math.max(-2000, Math.min(2000, value)) / 40;
    return `${((index + 1) / total * 400).toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
});
/** 近い印は、ひとつ下の段にずらす(重ならないように)。 */
const markRaised = (index: number) => {
  const marks = watch.value?.marks ?? [];
  return index > 0 && Math.abs(markLeft(marks[index].ply) - markLeft(marks[index - 1].ply)) < 12 && !markRaised(index - 1);
};
const markLeft = (ply: number) => Math.min(92, Math.max(4, (ply / Math.max(watch.value?.entries.length ?? 60, 60)) * 100));

/** 戻る操作。観戦・稽古の札を開いていれば閉じる。閉じるものがなければfalse(ホームへ)。 */
function goBack() {
  if (slotsShown.value) {
    if (slotAsk.value >= 0) slotAsk.value = -1;
    else if (state.value) slotsShown.value = false;
    else return false;
    return true;
  }
  if (sceneData.value) {
    if (!sceneEl.value?.goBack()) closeScene();
    return true;
  }
  if (ichimonOpen.value) {
    ichimonOpen.value = false;
    return true;
  }
  if (bookOpen.value) {
    bookOpen.value = false;
    return true;
  }
  if (watch.value) {
    closeWatch();
    return true;
  }
  if (lesson.value) {
    lesson.value = null;
    return true;
  }
  if (societyOpen.value) {
    if (memberSel.value) memberSel.value = "";
    else closeSociety();
    return true;
  }
  if (plansOpen.value) {
    plansOpen.value = false;
    return true;
  }
  if (skillsOpen.value) {
    skillsOpen.value = false;
    return true;
  }
  if (training.value) {
    training.value = false;
    return true;
  }
  return false;
}
defineExpose({ goBack });
</script>

<style>
.shogi-game .disciple {
  --ink: #1d2a36; --accent: #f1a54c; --accent-ink: #5a3410; --muted: #6b7a88; --panel: rgba(255, 252, 244, 0.93); --panel-solid: #fffcf4; --line: rgba(29, 42, 54, 0.14);
  position: absolute; inset: 0; z-index: 6; overflow: hidden; color: var(--ink);
  background: linear-gradient(180deg, #f6e7c9, #dcebf2 70%, #c9dccf);
}
.shogi-game .disciple__room { position: absolute; inset: 0; pointer-events: none; }
.shogi-game .disciple__room::before {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 28%;
  background: repeating-linear-gradient(90deg, #cdb88a 0 2px, #d9c79c 2px 46px), #d9c79c; border-top: 6px solid #9c7f4e;
}
.shogi-game .disciple__room::after {
  content: ""; position: absolute; left: 8%; right: 8%; top: 8%; height: 58%; opacity: 0.7;
  background: linear-gradient(90deg, transparent 49.6%, #b99d6b 49.6% 50.4%, transparent 50.4%),
    repeating-linear-gradient(0deg, transparent 0 58px, rgba(185, 157, 107, 0.5) 58px 60px),
    repeating-linear-gradient(90deg, transparent 0 58px, rgba(185, 157, 107, 0.5) 58px 60px), rgba(255, 252, 240, 0.55);
  border: 6px solid #b99d6b; border-bottom: 0;
}
.shogi-game .disciple__figure { position: absolute; z-index: 1; left: 50%; top: 5%; height: 150%; aspect-ratio: 0.344; transform: translateX(-50%); pointer-events: none; }
.shogi-game .disciple__figure img { width: 100%; height: 100%; display: block; object-fit: contain; object-position: 50% 0; filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.18)); }
.shogi-game .disciple__figure--bounce { animation: disciple-bounce 0.5s ease; }
@keyframes disciple-bounce { 30% { transform: translateX(-50%) translateY(-10px); } 60% { transform: translateX(-50%) translateY(0); } }

.shogi-game .disciple__top { position: absolute; z-index: 5; top: 0.6rem; left: 0.6rem; right: 0.6rem; display: flex; gap: 0.5rem; align-items: stretch; height: 3.6rem; }
/* 上の帯は高さを決めておく(左右の札は決まった位置にあり、帯が文字の折り返しで伸びると重なるため。46章)。 */
.shogi-game .disciple__top--pick { height: auto; }
.shogi-game .disciple__top--pick { right: auto; align-items: center; }
.shogi-game .disciple__title { padding: 0.35rem 0.9rem; border-radius: 0.6rem; background: var(--panel); }
.shogi-game .disciple .disciple__back { min-height: 2.75rem; padding: 0 0.9rem; border: 0; border-radius: 999px; background: var(--ink); color: #fff; font-weight: 900; }

.shogi-game .disciple__panel { position: absolute; z-index: 5; padding: 0.55rem 0.6rem; border-radius: 0.9rem; background: var(--panel); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); }
.shogi-game .disciple__muted { color: var(--muted); font-size: 0.72rem; }
.shogi-game .disciple__rank--F { background: #7fa0b8; } .shogi-game .disciple__rank--E { background: #5aa66a; } .shogi-game .disciple__rank--D { background: #4f86c6; }
.shogi-game .disciple__rank--C { background: #9a6fc4; } .shogi-game .disciple__rank--B { background: #d8655b; } .shogi-game .disciple__rank--A { background: #e08a2e; }
.shogi-game .disciple__rank--S, .shogi-game .disciple__rank--SS { background: #e2b33f; }
.shogi-game .disciple__chips { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.shogi-game .disciple__chip { padding: 0.08rem 0.45rem; border-radius: 999px; background: linear-gradient(90deg, #ffe6a8, #ffd0a0); color: #6a3a10; font-size: 0.66rem; font-weight: 900; }
.shogi-game .disciple__chip--style { background: var(--ink); color: #fff; }
.shogi-game .disciple__chip--hidden { background: #e6e1d6; color: var(--muted); }

.shogi-game .disciple .disciple__opt:not(:disabled):hover { background: #fffaf0; color: var(--ink); }
.shogi-game .disciple .disciple__opt[aria-pressed="true"]:not(:disabled):hover { background: #fff3e2; }
.shogi-game .disciple .disciple__pick-card:not(:disabled):hover { background: #fffaf0; color: var(--ink); }
.shogi-game .disciple .disciple__btn:not(:disabled):hover { filter: brightness(1.04); }
.shogi-game .disciple__aimtag { position: absolute; top: 0.25rem; right: 0.4rem; padding: 0 0.35rem; border-radius: 999px; background: #e2457a; color: #fff; font-size: 0.58rem; }
.shogi-game .disciple .disciple__warn { color: #d8655b; }

.shogi-game .disciple__sheet h4 { display: flex; justify-content: space-between; margin: 0.2rem 0 0.35rem; font-size: 0.9rem; }
.shogi-game .disciple__extra { margin: 0.3rem 0 0; color: #c0661b; font-size: 0.74rem; font-weight: 800; }
.shogi-game .disciple__row { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.shogi-game .disciple .disciple__btn { flex: 1; min-height: 2.9rem; border: 0; border-radius: 0.8rem; background: #e9e2d2; color: var(--ink); font-weight: 900; }
.shogi-game .disciple .disciple__btn--main { background: var(--accent); color: #fff; box-shadow: 0 3px 0 #b86f22; }

.shogi-game .disciple__sheet { z-index: 7; background: var(--panel-solid); left: 50%; bottom: 0.6rem; transform: translateX(-50%); width: min(34rem, calc(100% - 1.2rem)); max-height: calc(100% - 6rem); overflow-y: auto; }
.shogi-game .disciple__sheet h3 { display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.3rem; font-size: 1rem; }
.shogi-game .disciple__bigtag { padding: 0.05rem 0.5rem; border-radius: 999px; background: #d8655b; color: #fff; font-size: 0.7rem; }
.shogi-game .disciple__choice { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.4rem; }
.shogi-game .disciple__choice--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.shogi-game .disciple__choice--four { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 0.4rem; }
.shogi-game .disciple .disciple__opt { min-height: 3rem; padding: 0.3rem; border: 2px solid var(--line); border-radius: 0.8rem; background: #fff; color: var(--ink); font-size: 0.84rem; font-weight: 900; }
.shogi-game .disciple .disciple__opt small { display: block; color: var(--muted); font-size: 0.64rem; font-weight: 700; }
.shogi-game .disciple .disciple__opt[aria-pressed="true"] { border-color: var(--accent); background: #fff3e2; }
.shogi-game .disciple__games { display: grid; gap: 0.2rem; margin: 0.2rem 0; padding: 0; list-style: none; font-size: 0.82rem; }
.shogi-game .disciple__games li { display: flex; align-items: center; gap: 0.4rem; }
.shogi-game .disciple__games small { margin-left: auto; color: var(--muted); }
.shogi-game .disciple__star { display: grid; place-items: center; width: 1.5rem; height: 1.5rem; border-radius: 50%; color: #fff; font-weight: 900; }
.shogi-game .disciple__star--win { background: #d8655b; } .shogi-game .disciple__star--loss { background: #7a8794; }
.shogi-game .disciple__events { margin: 0.2rem 0; color: #c0661b; font-size: 0.8rem; font-weight: 800; }
.shogi-game .disciple__note { margin: 0.4rem 0 0; }
.shogi-game .disciple__stamp { display: inline-block; padding: 0.2rem 0.8rem; border: 4px solid #d8655b; border-radius: 0.5rem; color: #d8655b; font-size: 1.5rem; font-weight: 900; transform: rotate(-6deg); }

/* 一門と連れていく仲間(29章) */
.shogi-game .disciple .disciple__go:not(:disabled):hover { background: #f5b25f; color: #fff; }
.shogi-game .disciple__team { left: 0.6rem; right: 13.2rem; bottom: 4.6rem; }
.shogi-game .disciple__team h4 { display: flex; justify-content: space-between; margin: 0 0 0.3rem; font-size: 0.86rem; }
.shogi-game .disciple__team h4 small { color: var(--muted); font-size: 0.72rem; }
.shogi-game .disciple__team-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.shogi-game .disciple .disciple__team-chip { display: grid; gap: 0; min-height: 2.6rem; padding: 0.2rem 0.6rem; border: 2px solid var(--line); border-radius: 0.7rem; background: #fff; color: var(--ink); text-align: left; }
.shogi-game .disciple .disciple__team-chip small { color: var(--muted); font-size: 0.6rem; }
.shogi-game .disciple .disciple__team-chip[aria-pressed="true"], .shogi-game .disciple .disciple__team-chip[aria-pressed="true"]:not(:disabled):hover { border-color: var(--accent); background: #fff3e2; color: var(--ink); }
.shogi-game .disciple .disciple__team-chip:disabled { opacity: 0.5; }
.shogi-game .disciple__ichimon .disciple__ichimon-stats { grid-column: 1 / -1; }
/* 羽音の一門(30章) */
.shogi-game .disciple__chip--rival { background: #e4dcf3; color: #4b2f7a; }
/* 奨励会(28章) */
.shogi-game .disciple__stakes { margin: 0.1rem 0 0.3rem; color: #c0661b; font-size: 0.8rem; font-weight: 800; }
/* 弟子の記録(27章) */
.shogi-game .disciple__slots { left: 50%; top: 4.4rem; transform: translateX(-50%); display: grid; gap: 0.45rem; width: min(30rem, calc(100% - 1.2rem)); max-height: calc(100% - 5.4rem); overflow-y: auto; }
.shogi-game .disciple__slots > p { margin: 0; font-size: 0.8rem; }
.shogi-game .disciple__slot { display: grid; gap: 0.3rem; padding: 0.3rem; border: 3px solid transparent; border-radius: 0.9rem; background: #fff; }
.shogi-game .disciple__slot--active { border-color: var(--accent); }
.shogi-game .disciple .disciple__slot-main { display: grid; gap: 0.1rem; min-height: 4rem; padding: 0.35rem 0.5rem; border: 0; border-radius: 0.7rem; background: transparent; color: var(--ink); text-align: left; box-shadow: none; }
.shogi-game .disciple .disciple__slot-main:not(:disabled):hover { background: #fffaf0; color: var(--ink); }
.shogi-game .disciple__slot-main small { color: var(--muted); font-size: 0.7rem; font-weight: 800; }
.shogi-game .disciple__slot-main b { font-size: 1.02rem; }
.shogi-game .disciple__slot-main span { font-size: 0.78rem; }
.shogi-game .disciple .disciple__slot-main .disciple__slot-end { color: #d8655b; font-weight: 900; }
.shogi-game .disciple .disciple__slot-del { justify-self: end; min-height: 2.2rem; padding: 0 0.8rem; border: 0; border-radius: 999px; background: #efe9dc; color: var(--muted); font-size: 0.74rem; font-weight: 800; }
.shogi-game .disciple__slot-ask { display: flex; align-items: center; gap: 0.4rem; }
.shogi-game .disciple__slot-ask small { flex: 2; color: #b23b3b; font-size: 0.72rem; font-weight: 800; }
.shogi-game .disciple .disciple__btn.disciple__btn--danger, .shogi-game .disciple .disciple__btn.disciple__btn--danger:not(:disabled):hover { background: #d8655b; color: #fff; box-shadow: 0 3px 0 #a8443c; }
.shogi-game .disciple .disciple__slots-link { min-height: 2.75rem; border: 2px solid var(--accent); color: var(--accent-ink); font-weight: 900; }
/* お守り(26章) */
.shogi-game .disciple__charms { display: flex; flex-wrap: wrap; gap: 0.2rem; }
.shogi-game .disciple__charms span { padding: 0.08rem 0.4rem; border-radius: 999px; background: #fde3e6; color: #8a2a3a; font-size: 0.66rem; font-weight: 800; }
.shogi-game .disciple__choice--charm { grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr)); }
.shogi-game .disciple [data-disciple-scene] { z-index: 9; }
/* 指導の引き出し(25-1)・研究会と師匠の予定(25-2)・スキルの条件(25-3) */
.shogi-game .disciple__lesson h3 small { margin-left: auto; font-size: 0.74rem; }
.shogi-game .disciple__meter { position: relative; height: 0.9rem; margin: 0.9rem 0 0.2rem; border-radius: 999px; background: #e7e1d3; }
.shogi-game .disciple__meter i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #f1a54c, #e2457a); transition: width 0.35s ease-out; }
.shogi-game .disciple__meter-line { position: absolute; top: -0.85rem; bottom: 0; border-left: 2px dashed #8a7a5c; padding-left: 0.15rem; color: var(--muted); font-size: 0.58rem; font-weight: 800; line-height: 1; }
.shogi-game .disciple__lesson > .disciple__muted { margin: 0.2rem 0; font-size: 0.78rem; }
.shogi-game .disciple__steps { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0 0 0.4rem; padding: 0; list-style: none; font-size: 0.72rem; }
.shogi-game .disciple__steps li { display: flex; align-items: center; gap: 0.25rem; padding: 0.1rem 0.45rem; border-radius: 999px; background: #f3eee2; }
.shogi-game .disciple__steps b { color: #c0661b; }
.shogi-game .disciple__fit { padding: 0 0.35rem; border-radius: 999px; background: #e2457a; color: #fff; font-size: 0.58rem; font-weight: 900; }
.shogi-game .disciple .disciple__card { position: relative; display: grid; align-content: center; gap: 0.15rem; min-height: 5.2rem; padding-top: 0.9rem; }
.shogi-game .disciple__card .disciple__fit { position: absolute; top: -0.5rem; left: 50%; transform: translateX(-50%); white-space: nowrap; }
.shogi-game .disciple .disciple__card small.disciple__card-cost { color: #4f86c6; }
.shogi-game .disciple .disciple__chip--btn, .shogi-game .disciple .disciple__chip--btn:not(:disabled):hover { min-width: 0; min-height: 0; height: auto; margin: 0; padding: 0.08rem 0.45rem; border: 0; border-radius: 999px; background: #fff; color: var(--accent-ink); box-shadow: inset 0 0 0 1.5px var(--accent); font-size: 0.66rem; font-weight: 900; line-height: 1.5; cursor: pointer; }
/* 会の画面(36-5)。ほかのシートより広く、画面の上下いっぱいまで。中身は枠の中で動く。 */
.shogi-game .disciple__society {
  position: absolute; left: 50%; top: 4.4rem; bottom: 0.8rem; z-index: 8; transform: translateX(-50%);
  display: flex; flex-direction: column; gap: 0.5rem; width: min(46rem, calc(100% - 1.2rem)); overflow: hidden;
  background: #fffcf4; box-shadow: 0 0.6rem 1.6rem rgba(29, 42, 54, 0.28);
}
.shogi-game .disciple__society h4 { display: flex; align-items: center; justify-content: space-between; margin: 0; font-size: 1rem; }
.shogi-game .disciple__society-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.3rem; flex: none; }
.shogi-game .disciple .disciple__society-tab {
  min-height: 2.6rem; padding: 0 0.3rem; border: 1px solid var(--line); border-radius: 0.6rem; background: #fff; color: var(--ink); font-size: 0.85rem; font-weight: 800;
}
.shogi-game .disciple .disciple__society-tab[aria-selected="true"] { border-color: var(--accent); background: var(--accent); color: var(--accent-ink); }
.shogi-game .disciple__society-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; font-size: 0.85rem; }
.shogi-game .disciple__society-body h5 { margin: 0.4rem 0 0.3rem; font-size: 0.9rem; }
.shogi-game .disciple__society-body h5 small { margin-left: 0.5rem; color: var(--muted); font-weight: 600; }
.shogi-game .disciple__day + .disciple__day { margin-top: 0.6rem; padding-top: 0.5rem; border-top: 1px dashed var(--line); }
.shogi-game .disciple__day ol, .shogi-game .disciple__day ul { display: grid; gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .disciple__day-mine li { display: grid; grid-template-columns: 1.6rem minmax(0, 1fr) auto; align-items: center; gap: 0.4rem; padding: 0.3rem 0.4rem; border-radius: 0.5rem; background: rgba(241, 165, 76, 0.12); }
.shogi-game .disciple__day--rival { box-shadow: inset 3px 0 0 #8e6ad8; }
.shogi-game .disciple__day-others li { display: grid; grid-template-columns: 2.6rem minmax(0, 1fr) auto minmax(0, 1fr) auto; align-items: center; gap: 0.3rem; padding: 0.15rem 0.4rem; }
.shogi-game .disciple__day small { color: var(--muted); font-size: 0.72rem; }
.shogi-game .disciple__won { font-weight: 800; }
.shogi-game .disciple__won::after { content: "○"; margin-left: 0.2rem; color: #c0392b; }
.shogi-game .disciple__teai-chip { padding: 0.05rem 0.45rem; border-radius: 999px; background: rgba(29, 42, 54, 0.07); white-space: nowrap; }
/* スマホ: 手合いの札は名前の下の行へ(名前を折り返さない)。 */
@media (max-width: 560px) {
  .shogi-game .disciple__day-others li { grid-template-columns: 2.4rem minmax(0, 1fr) auto minmax(0, 1fr); row-gap: 0.1rem; padding-block: 0.25rem; border-bottom: 1px solid var(--line); }
  .shogi-game .disciple__day-others li > .disciple__teai-chip { grid-column: 2 / -1; justify-self: start; }
  .shogi-game .disciple__day-mine li { grid-template-columns: 1.6rem minmax(0, 1fr); row-gap: 0.1rem; }
  .shogi-game .disciple__day-mine li > .disciple__teai-chip { grid-column: 2; justify-self: start; }
  .shogi-game .disciple__day-others li small { font-size: 0.66rem; }
}
.shogi-game .disciple__members { display: grid; gap: 0.25rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .disciple .disciple__member {
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; width: 100%; min-height: 2.8rem; padding: 0.3rem 0.6rem;
  border: 1px solid var(--line); border-radius: 0.6rem; background: #fff; color: var(--ink); text-align: left;
}
.shogi-game .disciple__member small { display: block; color: var(--muted); font-size: 0.72rem; }
.shogi-game .disciple .disciple__member--rival { border-color: #8e6ad8; }
.shogi-game .disciple .disciple__member--peer { border-color: #4f9a72; }
.shogi-game .disciple__member-ranks { display: flex; gap: 0.2rem; }
.shogi-game .disciple__member-ranks i { display: grid; place-items: center; width: 1.6rem; height: 1.6rem; border-radius: 0.35rem; color: #fff; font-style: normal; font-weight: 800; font-size: 0.75rem; }
.shogi-game .disciple__member-card { display: grid; gap: 0.35rem; }
/* 会員の札の能力(棋士名鑑と同じ部品PlayerAbilityPanel。44章)。部品は暗い地の色なので、師匠の1年の明るい地の色に直す。 */
.shogi-game .disciple__member-ability { color: var(--ink, #1d303f); }
.shogi-game .disciple__member-ability .player-ability__radar { max-width: 17rem; }
@container (min-width: 34rem) {
  .shogi-game .disciple__member-ability .player-ability__main { grid-template-columns: minmax(0, 17rem) auto; justify-content: center; }
}
.shogi-game .disciple__member-ability .shogi-radar__grid polygon,
.shogi-game .disciple__member-ability .shogi-radar__grid line { stroke: rgba(29, 48, 63, 0.2); }
.shogi-game .disciple__member-ability .shogi-radar__label { fill: #1d303f; }
.shogi-game .disciple__member-ability .shogi-radar__value { fill: #b8641c; }
.shogi-game .disciple__member-ability .shogi-radar__dot { stroke: #fffcf4; }
.shogi-game .disciple__member-ability .shogi-radar__area { fill: rgba(241, 165, 76, 0.45); stroke: #d9822b; }
.shogi-game .disciple__member-ability .shogi-radar__compare { fill: rgba(47, 111, 168, 0.1); stroke: #2f6fa8; }
.shogi-game .disciple__member-ability .player-ability__value { color: #4a5a68; }
.shogi-game .disciple__member-ability .player-ability__compare-rank { color: #2f6fa8; }
.shogi-game .disciple__member-ability .player-ability__legend span::before { border-top-color: #d9822b; }
.shogi-game .disciple__member-ability .player-ability__legend-compare::before { border-top-color: #2f6fa8 !important; }
.shogi-game .disciple__member-ability .player-ability__type { color: #b8641c; }
.shogi-game .disciple__member-ability .player-ability__usage-bar { background: rgba(29, 48, 63, 0.12); }
.shogi-game .disciple__member-ability .player-ability__usage-note { color: #5d6b78; }
.shogi-game .disciple__member-extra { display: grid; gap: 0.25rem; }
.shogi-game .disciple__member-extra h6 { margin: 0.2rem 0 0; color: #5d6b78; font-size: 0.8rem; }
.shogi-game .disciple__member-skills { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .disciple__member-skills li { display: grid; gap: 0.05rem; padding: 0.3rem 0.5rem; border-radius: 0.5rem; background: rgba(241, 165, 76, 0.12); }
.shogi-game .disciple__member-skills b { font-size: 0.85rem; }
.shogi-game .disciple__member-star { margin-left: 0.25em; color: #d9822b; font-size: 0.75rem; }
.shogi-game .disciple__member-skills small { color: #5d6b78; font-size: 0.72rem; line-height: 1.4; }
.shogi-game .disciple__member-mastery { display: grid; gap: 0.3rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .disciple__member-mastery li { display: grid; grid-template-columns: minmax(0, 9.5em) minmax(3rem, 1fr) 2.2em; align-items: center; gap: 0.5rem; }
.shogi-game .disciple__member-mastery-label { overflow: hidden; font-size: 0.82rem; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .disciple__member-mastery-bar { display: block; height: 0.55rem; overflow: hidden; border-radius: 999px; background: rgba(29, 48, 63, 0.12); }
.shogi-game .disciple__member-mastery-bar i { display: block; height: 100%; border-radius: 999px; background: #d9822b; }
.shogi-game .disciple__member-mastery-num { font-size: 0.8rem; font-variant-numeric: tabular-nums; text-align: right; }
.shogi-game .disciple__member-profile { display: grid; gap: 0.2rem; margin: 0; font-size: 0.85rem; }
.shogi-game .disciple__member-profile div { display: grid; grid-template-columns: 6em minmax(0, 1fr); gap: 0.5rem; }
.shogi-game .disciple__member-profile dt { color: #5d6b78; font-weight: 700; }
.shogi-game .disciple__member-profile dd { margin: 0; }
.shogi-game .disciple__rules { display: grid; gap: 0.35rem; margin: 0; }
.shogi-game .disciple__rules > div { display: grid; grid-template-columns: 6rem minmax(0, 1fr); gap: 0.5rem; }
.shogi-game .disciple__rules dt { color: var(--muted); font-weight: 800; }
.shogi-game .disciple__rules dd { margin: 0; }
.shogi-game .disciple__rules-teai { display: block; }
.shogi-game .disciple__league { width: 100%; margin-top: 0.6rem; border-collapse: collapse; font-size: 0.8rem; }
.shogi-game .disciple__league caption { text-align: left; font-weight: 800; }
.shogi-game .disciple__league td { padding: 0.2rem 0.3rem; border-bottom: 1px solid var(--line); }
.shogi-game .disciple__league--promote td { background: rgba(241, 165, 76, 0.18); }
.shogi-game .disciple__league--you td { font-weight: 800; }
.shogi-game .disciple__league-marks { letter-spacing: 0.1em; }
.shogi-game .disciple__cards { margin-top: 0.6rem; }
.shogi-game .disciple__cards details { padding: 0.3rem 0.5rem; border: 1px solid var(--line); border-radius: 0.5rem; background: #fff; }
.shogi-game .disciple__cards details + details { margin-top: 0.25rem; }
.shogi-game .disciple__cards summary { min-height: 1.8rem; font-weight: 800; cursor: pointer; }
.shogi-game .disciple__cards p { margin: 0.2rem 0 0.2rem; }
/* 例会の札の手合いと、相手の4つの能力(弟子と並べる)。 */
.shogi-game .disciple__teai { margin: 0.2rem 0; font-size: 0.85rem; }
.shogi-game .disciple__teai b { color: #a3522a; }
.shogi-game .disciple__versus { display: grid; gap: 0.15rem; margin: 0.3rem 0; font-size: 0.78rem; }
.shogi-game .disciple__versus-row { display: grid; grid-template-columns: 1fr 3rem 1fr; align-items: center; gap: 0.4rem; }
.shogi-game .disciple__versus-me { display: flex; justify-content: flex-end; align-items: center; gap: 0.3rem; }
.shogi-game .disciple__versus-them { display: flex; align-items: center; gap: 0.3rem; }
.shogi-game .disciple__versus-name { text-align: center; color: var(--muted); font-weight: 800; }
.shogi-game .disciple__versus b { display: grid; place-items: center; width: 1.4rem; height: 1.4rem; border-radius: 0.3rem; color: #fff; font-size: 0.7rem; }
.shogi-game .disciple__skills { background: var(--panel-solid); left: 50%; top: 4.4rem; z-index: 7; transform: translateX(-50%); width: min(24rem, calc(100% - 1.2rem)); max-height: calc(100% - 12rem); overflow-y: auto; }
.shogi-game .disciple__skills h4 { display: flex; align-items: center; justify-content: space-between; margin: 0 0 0.3rem; font-size: 0.9rem; }
/* 札を閉じる丸いボタン。全体のボタンの書式(最低の高さ44px・余白)に負けて縦長の楕円になっていたので、
   大きさと余白をここで決め直す(押せる大きさは44px。U:7-4 操作しやすさ)。 */
.shogi-game .disciple .disciple__x {
  flex: none; display: inline-grid; place-items: center; align-self: center;
  width: 44px; height: 44px; min-width: 44px; min-height: 44px; margin: -6px -6px -6px 0.4rem; padding: 0;
  border: 1px solid rgba(43, 36, 28, 0.18); border-radius: 50%; background: #efe8da; color: var(--ink);
  box-shadow: none; font-size: 1.15rem; font-weight: 900; line-height: 1;
}
@media (hover: hover) {
  .shogi-game .disciple .disciple__x:not(:disabled):hover { background-color: #e4dac6; border-color: rgba(43, 36, 28, 0.35); transform: none; }
}
.shogi-game .disciple__skills ul { display: grid; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.shogi-game .disciple__skills li { display: grid; grid-template-columns: auto 1fr; gap: 0.1rem 0.5rem; align-items: center; font-size: 0.8rem; }
.shogi-game .disciple__skills small { color: var(--muted); font-size: 0.68rem; }
/* 作戦帳(35-12)。 */
.shogi-game .disciple__plans li { grid-template-columns: 1fr; }
.shogi-game .disciple__plans .disciple__plan-chain { color: #2a4f86; }
.shogi-game .disciple__learn { display: grid; gap: 0.35rem; margin-bottom: 0.5rem; padding: 0.5rem; border-radius: 0.7rem; background: #fff7e0; }
.shogi-game .disciple__learn p { margin: 0; font-size: 0.8rem; }
.shogi-game .disciple__learn p small { display: block; }
.shogi-game .disciple .disciple__link { justify-self: end; min-height: 2.75rem; padding: 0 0.6rem; border: 0; background: transparent; color: var(--muted); font-size: 0.76rem; text-decoration: underline; }
.shogi-game .disciple .disciple__chip--btn.disciple__chip--learn, .shogi-game .disciple .disciple__chip--btn.disciple__chip--learn:not(:disabled):hover { background: #f0a24a; color: #fff; box-shadow: none; animation: disciple-learn-pulse 1.6s ease-in-out 2; }
@keyframes disciple-learn-pulse { 50% { transform: scale(1.06); } }
@media (prefers-reduced-motion: reduce) { .shogi-game .disciple .disciple__chip--btn.disciple__chip--learn { animation: none; } }
.shogi-game .disciple__skill--have b { color: #c0661b; }
.shogi-game .disciple__skill-bar { grid-column: 1 / -1; height: 0.35rem; border-radius: 999px; background: #e7e1d3; overflow: hidden; }
.shogi-game .disciple__skill-bar i { display: block; height: 100%; background: var(--accent); }

.shogi-game .disciple__pick-info { left: 0.6rem; top: 4.2rem; width: 16rem; }
.shogi-game .disciple__pick-info h2 { margin: 0; font-size: 1.2rem; }
.shogi-game .disciple__pick-info h2 small { color: var(--muted); font-size: 0.7rem; }
.shogi-game .disciple__intro { margin: 0.35rem 0; font-size: 0.82rem; line-height: 1.5; }
.shogi-game .disciple__dl { display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 0.5rem; margin: 0; font-size: 0.8rem; }
.shogi-game .disciple__dl dt { color: var(--muted); }
.shogi-game .disciple__dl dd { margin: 0; font-weight: 700; }
.shogi-game .disciple__diff { color: #d8655b; }
.shogi-game .disciple__pick-cards { position: absolute; z-index: 5; right: 0.6rem; top: 4.2rem; display: grid; gap: 0.45rem; width: 12rem; }
.shogi-game .disciple .disciple__pick-card { display: grid; gap: 0.1rem; padding: 0.5rem 0.6rem; border: 3px solid transparent; border-radius: 0.9rem; background: var(--panel); color: var(--ink); text-align: left; }
.shogi-game .disciple .disciple__pick-card[aria-checked="true"] { border-color: var(--accent); }
.shogi-game .disciple__pick-card small { color: var(--muted); font-size: 0.7rem; }
.shogi-game .disciple .disciple__go { position: absolute; z-index: 5; right: 0.6rem; bottom: 0.6rem; min-width: 12rem; min-height: 3.4rem; border: 0; border-radius: 1rem; background: var(--accent); color: #fff; font-size: 1.05rem; font-weight: 900; box-shadow: 0 4px 0 #b86f22; }

/* 観戦と見立て(24章) */
.shogi-game .disciple__watch { position: absolute; inset: 0; z-index: 8; display: grid; grid-template-columns: minmax(0, 1fr) 22rem; grid-template-rows: auto minmax(0, 1fr) auto auto; grid-template-areas: "head head" "board side" "nav side" "graph graph"; gap: 0.5rem; padding: 0.6rem; background: #1c2630; color: #fff; }
.shogi-game .disciple__watch-nav { grid-area: nav; display: flex; align-items: center; justify-content: center; gap: 0.35rem; }
.shogi-game .disciple .disciple__watch-nav button { width: 3.2rem; min-height: 2.75rem; border: 0; border-radius: 0.6rem; background: #2f3e4c; color: #fff; font-size: 1rem; }
.shogi-game .disciple__watch-nav span { min-width: 8.5em; text-align: center; font-weight: 800; font-size: 0.85rem; }
.shogi-game .disciple .disciple__watch-research { margin-left: auto; }
.shogi-game .disciple .disciple__watch-research + .disciple__watch-close { margin-left: 0; }
.shogi-game .disciple__watch-tabs { display: none; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 0.3rem; }
.shogi-game .disciple .disciple__watch-tabs button { min-height: 2.6rem; border: 0; border-radius: 0.6rem; background: #263442; color: #9fb1bd; font-weight: 800; }
.shogi-game .disciple .disciple__watch-tabs button[aria-selected="true"] { background: var(--accent); color: #fff; }
.shogi-game .disciple__pane--marks { display: grid; gap: 0.5rem; }
.shogi-game .disciple__ai { margin: 0; padding: 0.45rem 0.6rem; border-radius: 0.7rem; background: #eef3fb; color: #2a4f86; font-size: 0.8rem; line-height: 1.5; }
.shogi-game .disciple__ai b { margin-right: 0.4rem; }
.shogi-game .disciple__ai--locked { background: #2a3746; color: #b8c6d2; }
.shogi-game .disciple__moves { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; overflow-y: auto; min-height: 6rem; }
.shogi-game .disciple .disciple__moves button { display: grid; grid-template-columns: 2.2em minmax(0, 1fr) auto 0.9em; align-items: center; gap: 0.4rem; width: 100%; min-height: 2.1rem; padding: 0 0.55rem; border: 0; border-radius: 0.5rem; background: #263442; color: #fff; font-size: 0.85rem; text-align: left; }
.shogi-game .disciple .disciple__move--mine button { background: #2c3c4c; }
.shogi-game .disciple .disciple__move--on button { outline: 2px solid var(--accent); background: #3a4b5c; }
.shogi-game .disciple__moves i { color: #9fb1bd; font-style: normal; font-size: 0.72rem; }
.shogi-game .disciple__moves em { font-style: normal; font-size: 0.72rem; color: #cfd8de; }
.shogi-game .disciple__tone--good { color: #7fd3a3 !important; }
.shogi-game .disciple__tone--bad { color: #ff9b8f !important; }
.shogi-game .disciple__dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; }
.shogi-game .disciple__dot--red { background: #e2457a; }
/* 好手の金(33-6)。崩れた手の赤と見分ける。 */
.shogi-game .disciple__dot--gold { background: #e3b23c; box-shadow: 0 0 0 2px rgba(227, 178, 60, 0.35); }
.shogi-game .disciple__pane--good { display: grid; gap: 0.4rem; }
.shogi-game .disciple .disciple__good-chip { min-height: 2.4rem; border-color: #e3b23c; background: #fff7e0; color: #8a5a00; }
.shogi-game .disciple .disciple__good-chip--on { outline: 3px solid #e3b23c; }
.shogi-game .disciple__good-card { display: grid; gap: 0.35rem; border: 2px solid #e3b23c; }
.shogi-game .disciple__good-card b { color: #8a5a00; }
.shogi-game .disciple__seek { border-radius: 0.9rem; }
.shogi-game .disciple__found--miss { color: #2a4f86; }
.shogi-game .disciple__graph-hide { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: 0.75rem; font-weight: 800; pointer-events: none; }
.shogi-game .disciple__chip--spotted { background: #e9f6ea; color: #2d6b38; }
.shogi-game .disciple__chip--mastery { background: #eef3fb; color: #2a4f86; }
/* 弟子の考えの一言(34-17)。 */
.shogi-game .disciple__thought { margin: 0; padding: 0.4rem 0.6rem; border-radius: 0.7rem; background: #fff7e0; color: #5a3410; font-size: 0.82rem; }
.shogi-game .disciple__thought b { margin-right: 0.45rem; color: #8a5a00; }
.shogi-game .disciple__thought small { display: block; margin-top: 0.2rem; color: #6b5a3a; font-size: 0.74rem; }
/* 今日の作戦(35-7)。 */
.shogi-game .disciple__today-plan { margin: 0; padding: 0.35rem 0.6rem; border-radius: 0.7rem; background: #eef3fb; color: #22344a; font-size: 0.8rem; }
.shogi-game .disciple__today-plan b { margin-left: 0.3rem; color: #2a4f86; }
.shogi-game .disciple__today-plan small { display: block; color: #5a6b80; font-size: 0.72rem; }
.shogi-game .disciple .disciple__book-row { display: grid; grid-template-columns: 2rem 1fr; align-items: center; gap: 0.5rem; width: 100%; padding: 0.45rem; border: 0; border-radius: 0.6rem; background: transparent; color: var(--ink); text-align: left; }
.shogi-game .disciple__book-row small { display: block; color: var(--muted); font-size: 0.72rem; }
.shogi-game .disciple__watch-head { grid-area: head; display: flex; align-items: center; gap: 0.6rem; }
.shogi-game .disciple__watch-head small { color: #b8c6d2; }
.shogi-game .disciple .disciple__watch-close { margin-left: auto; min-height: 2.6rem; padding: 0 0.9rem; border: 1px solid #50606e; border-radius: 0.6rem; background: transparent; color: #fff; font-weight: 800; }
.shogi-game .disciple__watch-board { grid-area: board; position: relative; z-index: 0; isolation: isolate; display: grid; place-items: center; min-height: 0; }
.shogi-game .disciple__board-box { position: relative; }
.shogi-game .disciple__board-box .shogi-match-theme-controls { display: none; }
.shogi-game .disciple__watch-side { grid-area: side; display: flex; flex-direction: column; gap: 0.5rem; min-height: 0; overflow: hidden; }
/* 広い画面: 右の欄は盤と1手ずつのボタンの段にまたがる。中身の高さで段(auto)を伸ばさないよう、欄の大きさを中身から決めない(33-6の分かれ目さがしの札で、観戦の画面が画面より高くなっていた)。 */
@media (min-width: 641px) { .shogi-game .disciple__watch-side { contain: size; } }
.shogi-game .disciple__watch-side > * { flex: none; }
.shogi-game .disciple__watch-side > .disciple__moves { flex: 1 1 0; }
.shogi-game .disciple__pane--marks { max-height: 60%; overflow-y: auto; }
.shogi-game .disciple__ask { margin: 0; padding: 0.6rem; border-radius: 0.9rem; background: #fffaf0; color: var(--ink); font-size: 0.9rem; }
.shogi-game .disciple__ask small { display: block; color: var(--muted); font-size: 0.74rem; }
.shogi-game .disciple__clues { display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0.35rem 0; }
.shogi-game .disciple__clues span { padding: 0.1rem 0.45rem; border-radius: 999px; background: #f0e7d6; font-size: 0.7rem; font-weight: 800; }
.shogi-game .disciple__reasons { display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem; }
.shogi-game .disciple__reasons button:last-child { grid-column: 1 / -1; }
.shogi-game .disciple .disciple__opt--right, .shogi-game .disciple .disciple__opt--right:disabled { border-color: #3c9a4c; background: #e9f6ea; color: var(--ink); opacity: 1; }
.shogi-game .disciple .disciple__opt--near, .shogi-game .disciple .disciple__opt--near:disabled { border-color: #d89a2b; background: #fdf3e0; color: var(--ink); opacity: 1; }
.shogi-game .disciple__clue--red { background: #fbe0dc !important; color: #b8352b; }
.shogi-game .disciple__row--left { justify-content: flex-start; }
.shogi-game .disciple .disciple__opt--wrong, .shogi-game .disciple .disciple__opt--wrong:disabled { border-color: #d8655b; background: #fbe9e7; color: var(--ink); opacity: 1; }
.shogi-game .disciple__found { margin: 0.4rem 0 0; color: #c0661b; font-size: 0.8rem; font-weight: 800; }
.shogi-game .disciple__graph { grid-area: graph; cursor: pointer; position: relative; height: 7rem; border-radius: 0.8rem; background: #fff; overflow: hidden; }
.shogi-game .disciple__graph svg { width: 100%; height: 100%; display: block; }
.shogi-game .disciple .disciple__mark { position: absolute; top: 0.3rem; transform: translateX(-50%); min-height: 2.2rem; padding: 0 0.5rem; border: 0; border-radius: 999px; background: #e2457a; color: #fff; font-size: 0.7rem; font-weight: 900; }
.shogi-game .disciple .disciple__mark--done { background: #3c9a4c; }
.shogi-game .disciple .disciple__mark--on { outline: 3px solid #1d2a36; }
.shogi-game .disciple .disciple__mark--gold { top: auto; min-height: 1.9rem; background: #e3b23c; color: #3b2a00; }
.shogi-game .disciple .disciple__mark--gold-up { bottom: 2.3rem !important; }

/* 終局の札と結果発表(33-3) */
.shogi-game .disciple .disciple__endcard { position: absolute; z-index: 20; left: 50%; top: 42%; display: grid; justify-items: center; gap: 0.3rem; min-width: 14rem; padding: 1rem 1.6rem; border: 4px solid #c0392b; border-radius: 1rem; background: #fffaf0; color: #c0392b; transform: translate(-50%, -50%) rotate(-4deg); box-shadow: 0 0.6rem 1.6rem rgba(0, 0, 0, 0.45); animation: disciple-stamp 0.32s cubic-bezier(.2,1.6,.4,1); }
.shogi-game .disciple .disciple__endcard--loss { border-color: #3a5470; color: #3a5470; }
.shogi-game .disciple .disciple__endcard--big { min-width: 17rem; padding: 1.3rem 2rem; }
.shogi-game .disciple__endcard-stamp { font-size: 2.6rem; font-weight: 900; letter-spacing: 0.2em; line-height: 1; }
.shogi-game .disciple__endcard--big .disciple__endcard-stamp { font-size: 3.4rem; }
.shogi-game .disciple__endcard-mate { padding: 0.05rem 0.7rem; border-radius: 999px; color: #fffaf0; background: #c0392b; font-size: 1rem; font-weight: 900; letter-spacing: 0.08em; }
.shogi-game .disciple__endcard--loss .disciple__endcard-mate { background: #34495e; }
.shogi-game .disciple__endcard small { color: var(--ink); font-size: 0.85rem; font-weight: 800; }
@keyframes disciple-stamp { from { transform: translate(-50%, -50%) rotate(-4deg) scale(1.8); opacity: 0; } to { transform: translate(-50%, -50%) rotate(-4deg) scale(1); opacity: 1; } }
.shogi-game .disciple__result { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; padding: 1rem; background: rgba(20, 28, 36, 0.72); }
.shogi-game .disciple__result-card { display: grid; gap: 0.5rem; width: min(26rem, 100%); max-height: 100%; overflow-y: auto; padding: 1rem 1.1rem; border-radius: 1rem; background: var(--panel); color: var(--ink); box-shadow: 0 0.6rem 1.6rem rgba(0, 0, 0, 0.45); }
.shogi-game .disciple__result-card h3 { margin: 0; font-size: 1.5rem; }
.shogi-game .disciple__result-card .disciple__result-big { color: #c0661b; font-size: 1.9rem; }
.shogi-game .disciple__watched-tag { margin-left: 0.4rem; padding: 0.05rem 0.4rem; border-radius: 999px; background: #e7eef6; color: #3a5470; font-size: 0.68rem; }
@media (prefers-reduced-motion: reduce) {
  .shogi-game .disciple .disciple__endcard { animation: none; }
}

/* スマホ縦: 立ち絵は真ん中のまま、UIを上下に寄せる(18章) */
@media (max-width: 640px) {
  .shogi-game .disciple__figure { top: 9%; height: 118%; }
  .shogi-game .disciple__top { top: 0.4rem; left: 0.4rem; right: 0.4rem; height: 3.2rem; }
  .shogi-game .disciple .disciple__card { min-height: 4.6rem; font-size: 0.76rem; }
  /* スマホ縦: 弟子の札は下にあるので、仲間は候補の下(立ち絵の胸のあたり)に置く。 */
  .shogi-game .disciple__team { top: 14.4rem; bottom: auto; left: 0.4rem; right: 0.4rem; padding: 0.4rem; }
  .shogi-game .disciple .disciple__team-chip { min-height: 2.3rem; padding: 0.15rem 0.45rem; }
  .shogi-game .disciple__sheet { bottom: 0.4rem; width: calc(100% - 0.8rem); }
  .shogi-game .disciple__pick-info { top: auto; bottom: 4.6rem; left: 0.4rem; right: 0.4rem; width: auto; }
  .shogi-game .disciple__intro { display: none; }
  .shogi-game .disciple__pick-cards { top: 3.6rem; right: 0.4rem; width: 9.4rem; }
  .shogi-game .disciple .disciple__go { left: 0.4rem; right: 0.4rem; bottom: 0.4rem; min-height: 3.2rem; }
  .shogi-game .disciple__watch { grid-template-columns: 1fr; grid-template-rows: auto auto auto auto minmax(0, 1fr); grid-template-areas: "graph" "head" "board" "nav" "side"; padding: 0.4rem; overflow-y: auto; }
  /* 検討の段は、盤と1手ずつのボタンを動かさず、手の一覧と見立ての札だけをその中で動かす(33-4)。 */
  .shogi-game .disciple__watch--review { overflow: hidden; }
  .shogi-game .disciple__watch--review .disciple__watch-board { height: min(46vh, calc((100vw - 0.8rem) * 1.285)); }
  .shogi-game .disciple__watch-side > .disciple__moves { flex: 1 1 0; }
  .shogi-game .disciple__pane--marks { max-height: none; flex: 1 1 0; min-height: 0; }
  .shogi-game .disciple__watch-tabs { display: grid; }
  .shogi-game .disciple__pane:not(.disciple__pane--on) { display: none; }
  .shogi-game .disciple__moves { overflow-y: auto; }
  .shogi-game .disciple__watch-head small { display: none; }
  .shogi-game .disciple__watch-board { height: min(64vh, calc((100vw - 0.8rem) * 1.285)); }
  .shogi-game .disciple__graph { height: 5.5rem; }
}
/* 狭いスマホ(ボタンが4つ並ぶと目標の欄が細くなる): 見出しの「次の目標」と「あと」を省き、ボタンを詰める(46章)。 */
@media (max-width: 420px) {
  .shogi-game .disciple__top { gap: 0.3rem; }
}

/* ===== ホームの作り直し(48章。育成ゲームの組み立てを借り、色と絵はこのゲームのもの) ===== */
.shogi-game .disciple__rank { display: inline-grid; place-items: center; min-width: 1.6rem; height: 1.6rem; margin-right: 0.25rem; padding: 0 0.15rem; border-radius: 0.4rem; color: #fff; font-weight: 900; font-style: italic; font-size: 0.8rem; background: #9aa4ad; }
.shogi-game .disciple__rank--F { background: #7fa0b8; } .shogi-game .disciple__rank--E { background: #5aa66a; } .shogi-game .disciple__rank--D { background: #4f86c6; }
.shogi-game .disciple__rank--C { background: #9a6fc4; } .shogi-game .disciple__rank--B { background: #d8655b; } .shogi-game .disciple__rank--A { background: #e08a2e; }
.shogi-game .disciple__rank--S, .shogi-game .disciple__rank--SS { background: #e2b33f; }
.shogi-game .disciple__apt { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.2rem; }
.shogi-game .disciple__apt span { display: flex; justify-content: space-between; padding: 0.1rem 0.3rem; border-radius: 0.35rem; background: #f3eee2; font-size: 0.7rem; font-weight: 800; }
.shogi-game .disciple__apt b { color: var(--accent-ink); }
/* 上: 残りの札・目標・体力 */
.shogi-game .disciple__hud { position: absolute; z-index: 5; top: 0.6rem; left: 0.6rem; right: 0.6rem; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.45rem 0.5rem; }
.shogi-game .disciple__turn { grid-row: span 2; display: grid; align-content: center; justify-items: center; min-width: 5.8rem; padding: 0.35rem 0.5rem; border-radius: 0.9rem; background: var(--ink); color: #fff; box-shadow: 0 3px 0 #0d151c; line-height: 1.1; text-align: center; }
.shogi-game .disciple__turn small { color: #c6d2dc; font-size: 0.64rem; white-space: nowrap; }
.shogi-game .disciple__turn b { font-size: 1.85rem; letter-spacing: -0.02em; white-space: nowrap; }
.shogi-game .disciple__turn b > span { font-size: 0.8rem; margin-left: 0.1rem; }
.shogi-game .disciple__turn b > .disciple__turn-pre { margin: 0 0.1rem 0 0; }
.shogi-game .disciple__turn em { max-width: 7rem; margin-top: 0.2rem; overflow: hidden; padding: 0.08rem 0.45rem; border-radius: 999px; background: var(--accent); color: #fff; font-size: 0.64rem; font-style: normal; font-weight: 800; white-space: nowrap; text-overflow: ellipsis; }
.shogi-game .disciple__turn--big { background: #b8453b; box-shadow: 0 3px 0 #6e231c; }
.shogi-game .disciple__turn--big em { background: #fff; color: #b8453b; }
.shogi-game .disciple__goal { display: flex; align-items: center; gap: 0.5rem; min-width: 0; padding: 0.3rem 0.35rem 0.3rem 0.6rem; border: 2px solid var(--accent); border-radius: 0.8rem; background: var(--panel-solid); }
.shogi-game .disciple__goal small { flex: none; padding: 0.05rem 0.4rem; border-radius: 0.3rem; background: var(--accent); color: #fff; font-size: 0.66rem; font-weight: 900; }
.shogi-game .disciple__goal b { flex: 1; min-width: 0; overflow: hidden; font-size: 0.88rem; white-space: nowrap; text-overflow: ellipsis; }
.shogi-game .disciple .disciple__goal-more { flex: none; min-height: 2rem; padding: 0 0.6rem; border: 0; border-radius: 0.5rem; background: var(--ink); color: #fff; font-size: 0.72rem; font-weight: 800; }
.shogi-game .disciple .disciple__goal-more:not(:disabled):hover { background: #33475a; color: #fff; }
.shogi-game .disciple__vital { display: flex; align-items: center; gap: 0.45rem; min-width: 0; padding: 0.3rem 0.5rem; border: 1px solid var(--line); border-radius: 0.8rem; background: var(--panel-solid); }
.shogi-game .disciple__vital > span:first-child { flex: none; color: var(--muted); font-size: 0.7rem; font-weight: 900; }
.shogi-game .disciple__hp { position: relative; flex: 1; min-width: 0; height: 0.95rem; overflow: hidden; border-radius: 999px; background: #e6dccb; box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15); }
.shogi-game .disciple__hp i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: linear-gradient(90deg, #f0b23e, #6cc06a); transition: width 0.3s; }
.shogi-game .disciple__hp s { position: absolute; top: 0; bottom: 0; border-right: 2px solid #cf5a4e; background: repeating-linear-gradient(45deg, rgba(207, 90, 78, 0.55) 0 4px, rgba(207, 90, 78, 0.25) 4px 8px); text-decoration: none; }
.shogi-game .disciple__hp b { position: absolute; right: 0.4rem; top: 50%; transform: translateY(-50%); font-size: 0.62rem; }
.shogi-game .disciple__mood-badge { flex: none; padding: 0.1rem 0.5rem; border-radius: 999px; background: #ece7dc; color: var(--muted); font-size: 0.72rem; font-weight: 900; white-space: nowrap; }
.shogi-game .disciple__mood-badge--m3, .shogi-game .disciple__mood-badge--m4 { background: #ffe5c7; color: #b9561a; }
.shogi-game .disciple__mood-badge--m0, .shogi-game .disciple__mood-badge--m1 { background: #dfe6f3; color: #3a5a8c; }
/* 右の丸い小さなボタン */
.shogi-game .disciple__side { position: absolute; z-index: 5; right: 0.6rem; top: 6.4rem; display: grid; gap: 0.4rem; }
.shogi-game .disciple .disciple__round { position: relative; display: grid; place-items: center; align-content: center; width: 3rem; height: 3rem; min-height: 0; padding: 0; border: 2px solid #fff; border-radius: 50%; background: #f6eedc; color: var(--ink); box-shadow: 0 2px 0 #c9b184; font-size: 0.54rem; font-weight: 800; line-height: 1.1; }
.shogi-game .disciple .disciple__round span { font-size: 1rem; font-weight: 900; }
.shogi-game .disciple .disciple__round:not(:disabled):hover { background: #fffaf0; color: var(--ink); }
.shogi-game .disciple .disciple__round--new::after { content: "!"; position: absolute; top: -0.2rem; right: -0.2rem; display: grid; place-items: center; width: 1rem; height: 1rem; border-radius: 50%; background: #e2457a; color: #fff; font-size: 0.66rem; }
/* 弟子の一言 */
.shogi-game .disciple__say { position: absolute; z-index: 4; left: 0.6rem; top: 6.4rem; max-width: min(17rem, calc(100% - 5rem)); margin: 0; padding: 0.5rem 0.75rem; border-radius: 1rem 1rem 1rem 0.2rem; background: #fff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12); font-size: 0.84rem; font-weight: 700; }
.shogi-game .disciple__sheet h3 .disciple__x { margin-left: auto; }
/* 詳細のシート */
.shogi-game .disciple__detail h4 small { flex: 1; text-align: left; }
.shogi-game .disciple__detail h5 { margin: 0.6rem 0 0.25rem; font-size: 0.8rem; }
.shogi-game .disciple__detail-goal { margin: 0 0 0.4rem; font-size: 0.86rem; font-weight: 800; }
.shogi-game .disciple__detail-goal small { margin-right: 0.3rem; color: var(--muted); font-size: 0.7rem; }
.shogi-game .disciple__log { display: grid; gap: 0.2rem; margin: 0; padding: 0; list-style: none; font-size: 0.76rem; }
.shogi-game .disciple__log li { padding: 0.15rem 0.4rem; border-radius: 0.4rem; background: #f6f1e5; }
/* 下: 能力の列とコマンド */
.shogi-game .disciple__bottom { position: absolute; z-index: 5; left: 0; right: 0; bottom: 0; padding: 0 0.6rem 0.6rem; }
.shogi-game .disciple .disciple__statrow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(0, 1.15fr); gap: 0.3rem; width: 100%; min-height: 0; padding: 0.4rem; border: 1px solid var(--line); border-radius: 0.9rem; background: var(--panel-solid); color: var(--ink); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); font-weight: 400; text-align: center; }
.shogi-game .disciple .disciple__statrow:not(:disabled):hover { background: #fff; color: var(--ink); }
.shogi-game .disciple__stat { position: relative; display: grid; justify-items: center; gap: 0.05rem; padding: 0.2rem 0 0.25rem; border-radius: 0.6rem; background: #fff; }
.shogi-game .disciple__statrow:hover .disciple__stat { background: #fbf6ea; }
.shogi-game .disciple__stat > small { color: var(--muted); font-size: 0.68rem; font-weight: 900; }
.shogi-game .disciple__stat-row { display: flex; align-items: center; }
.shogi-game .disciple__stat-row .disciple__rank { margin-right: 0.2rem; }
.shogi-game .disciple__val { font-size: 1.05rem; font-weight: 900; font-variant-numeric: tabular-nums; }
.shogi-game .disciple__stat > .disciple__max { color: var(--muted); font-size: 0.58rem; font-weight: 700; }
.shogi-game .disciple__stat--aim::after { content: "狙い目"; position: absolute; top: -0.5rem; right: 0.1rem; padding: 0 0.3rem; border-radius: 999px; background: #e2457a; color: #fff; font-size: 0.55rem; font-weight: 800; }
.shogi-game .disciple__stat--lv { background: var(--ink); color: #fff; }
.shogi-game .disciple__stat--lv > small, .shogi-game .disciple__stat--lv > .disciple__max { color: #c6d2dc; }
.shogi-game .disciple__statrow:hover .disciple__stat--lv { background: #2b3b4a; }
.shogi-game .disciple__stat--lv b { overflow: hidden; max-width: 100%; font-size: 0.92rem; white-space: nowrap; text-overflow: ellipsis; }
.shogi-game .disciple__plus { position: absolute; left: 50%; top: -1.45rem; transform: translateX(-50%); color: #e8913a; font-size: 1.15rem; font-weight: 900; text-shadow: 0 2px 0 #fff, 0 0 6px #fff, 0 0 2px #fff; white-space: nowrap; animation: disciple-pop 0.25s ease; }
.shogi-game .disciple__plus--small { font-size: 0.92rem; }
@keyframes disciple-pop { from { transform: translateX(-50%) translateY(6px) scale(0.6); opacity: 0; } }
.shogi-game .disciple__dock--free { display: grid; grid-template-columns: 1fr 1.45fr 1fr; grid-template-rows: auto auto; gap: 0.45rem 0.6rem; align-items: center; margin-top: 0.6rem; }
.shogi-game .disciple .disciple__cmd { display: grid; place-items: center; align-content: center; gap: 0.05rem; justify-self: center; width: 100%; max-width: 5.6rem; min-height: 0; aspect-ratio: 1; padding: 0; border: 3px solid #fff; border-radius: 50%; background: radial-gradient(circle at 50% 30%, #fff, #f6eedc); color: var(--ink); box-shadow: 0 4px 0 #c9b184, 0 6px 10px rgba(0, 0, 0, 0.12); font-size: 0.86rem; font-weight: 900; line-height: 1.2; transition: transform 0.08s; }
.shogi-game .disciple .disciple__cmd > span { font-size: 1.3rem; line-height: 1; }
.shogi-game .disciple .disciple__cmd small { color: var(--muted); font-size: 0.56rem; font-weight: 700; }
.shogi-game .disciple .disciple__cmd:not(:disabled):hover { background: radial-gradient(circle at 50% 30%, #fff, #fbf3e2); color: var(--ink); }
.shogi-game .disciple .disciple__cmd:not(:disabled):active { transform: translateY(3px); box-shadow: 0 1px 0 #c9b184; }
.shogi-game .disciple .disciple__cmd:disabled { opacity: 0.6; filter: grayscale(0.7); }
.shogi-game .disciple .disciple__cmd--main { grid-row: span 2; grid-column: 2; max-width: 8.4rem; border-color: #fff4e2; background: radial-gradient(circle at 50% 30%, #ffd59a, #e8913a); color: #fff; box-shadow: 0 5px 0 #b8621d, 0 8px 14px rgba(0, 0, 0, 0.18); font-size: 1.25rem; }
.shogi-game .disciple .disciple__cmd--main > span { font-size: 1.9rem; }
.shogi-game .disciple .disciple__cmd--main small { color: #fff4e2; font-size: 0.66rem; }
.shogi-game .disciple .disciple__cmd--main:not(:disabled):hover { background: radial-gradient(circle at 50% 30%, #ffe0b0, #f09c48); color: #fff; }
.shogi-game .disciple .disciple__cmd--event, .shogi-game .disciple .disciple__cmd--event:not(:disabled):hover { background: radial-gradient(circle at 50% 30%, #ffb3a8, #cf5a4e); box-shadow: 0 5px 0 #8f3128, 0 8px 14px rgba(0, 0, 0, 0.18); }
.shogi-game .disciple__foot, .shogi-game .disciple__tfoot { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-top: 0.5rem; }
.shogi-game .disciple .disciple__pill { min-height: 2.2rem; padding: 0 0.9rem; border: 0; border-radius: 999px; background: rgba(31, 43, 54, 0.78); color: #fff; font-size: 0.74rem; font-weight: 800; }
.shogi-game .disciple .disciple__pill:not(:disabled):hover { background: rgba(31, 43, 54, 0.9); color: #fff; }
.shogi-game .disciple .disciple__pill:disabled { opacity: 0.5; }
.shogi-game .disciple .disciple__pill--go, .shogi-game .disciple .disciple__pill--go:not(:disabled):hover { min-height: 2.7rem; padding: 0 1.3rem; background: #e8913a; box-shadow: 0 3px 0 #b8621d; font-size: 0.95rem; font-weight: 900; }
.shogi-game .disciple__tfoot-hint { flex: 1; min-width: 0; padding: 0.3rem 0.5rem; border-radius: 999px; background: var(--panel-solid); font-size: 0.7rem; text-align: center; }
/* 稽古を選ぶ */
.shogi-game .disciple__tbtns { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 0.35rem; align-items: end; margin-top: 0.8rem; padding: 0 0.2rem; }
.shogi-game .disciple .disciple__tbtn { position: relative; display: grid; place-items: center; align-content: center; justify-self: center; width: 100%; max-width: 5rem; min-height: 0; aspect-ratio: 1; padding: 0; border: 3px solid #fff; border-radius: 50%; background: radial-gradient(circle at 50% 30%, #fff, #f6eedc); color: var(--ink); box-shadow: 0 4px 0 #c9b184; font-size: 0.72rem; font-weight: 900; line-height: 1.15; transition: transform 0.12s; }
.shogi-game .disciple .disciple__tbtn:not(:disabled):hover { background: radial-gradient(circle at 50% 30%, #fff, #fbf3e2); color: var(--ink); }
.shogi-game .disciple__tbtn-mark { font-size: 1.25rem; }
.shogi-game .disciple__tbtn-lv { position: absolute; bottom: -0.55rem; left: 50%; transform: translateX(-50%); padding: 0 0.35rem; border-radius: 999px; background: var(--ink); color: #fff; font-size: 0.56rem; white-space: nowrap; }
.shogi-game .disciple__tbtn-cnt { position: absolute; top: -0.25rem; right: -0.25rem; display: grid; place-items: center; width: 1.15rem; height: 1.15rem; border-radius: 50%; background: #4f7fc4; color: #fff; font-size: 0.62rem; }
.shogi-game .disciple__tbtn .disciple__aimtag { position: absolute; top: -0.55rem; left: 50%; transform: translateX(-50%); padding: 0 0.3rem; border-radius: 999px; background: #e2457a; color: #fff; font-size: 0.52rem; white-space: nowrap; }
.shogi-game .disciple .disciple__tbtn[aria-pressed="true"], .shogi-game .disciple .disciple__tbtn[aria-pressed="true"]:not(:disabled):hover { transform: translateY(-0.6rem) scale(1.05); background: radial-gradient(circle at 50% 30%, #ffd59a, #e8913a); color: #fff; box-shadow: 0 5px 0 #b8621d, 0 8px 14px rgba(0, 0, 0, 0.2); }
.shogi-game .disciple__picked { left: 0.6rem; top: 6.4rem; display: grid; gap: 0.15rem; width: min(15rem, calc(100% - 5.2rem)); border: 2px solid #e8913a; background: var(--panel-solid); }
.shogi-game .disciple__picked > b { font-size: 1.05rem; }
.shogi-game .disciple__picked > b em { margin-left: 0.3rem; color: #e8913a; font-size: 0.8rem; font-style: normal; }
.shogi-game .disciple__picked > small { color: var(--muted); font-size: 0.72rem; }
.shogi-game .disciple__risk { font-size: 0.76rem; font-weight: 800; }
.shogi-game .disciple__risk i { padding: 0 0.4rem; border-radius: 999px; background: #e3f3e6; color: #3c8a50; font-style: normal; }
.shogi-game .disciple__risk i.disciple__warn { background: #fde4e0; color: #cf5a4e; }
.shogi-game .disciple__friends { position: absolute; z-index: 4; right: 0.6rem; top: 6.4rem; display: grid; justify-items: center; gap: 0.5rem; }
.shogi-game .disciple__friends > small { padding: 0.05rem 0.4rem; border-radius: 999px; background: var(--panel-solid); color: var(--muted); font-size: 0.62rem; font-weight: 800; }
.shogi-game .disciple__friend { position: relative; display: grid; place-items: center; width: 3rem; height: 3rem; border: 3px solid #fff; border-radius: 50%; color: #fff; font-size: 1.1rem; font-weight: 900; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15); }
.shogi-game .disciple__friend em { position: absolute; top: -0.3rem; right: -0.4rem; padding: 0 0.25rem; border-radius: 999px; background: #cf5a4e; font-size: 0.55rem; font-style: normal; }
.shogi-game .disciple__bond { position: absolute; left: 50%; bottom: -0.35rem; width: 2.4rem; height: 0.32rem; overflow: hidden; transform: translateX(-50%); border: 1px solid #fff; border-radius: 999px; background: #e6dccb; }
.shogi-game .disciple__bond i { position: absolute; inset: 0 auto 0 0; background: #e8913a; }
.shogi-game .disciple__bond i.disciple__bond--full { background: #d9a832; }
/* 研究(49章): 作戦帳の札の一覧は札の中で動かす。研究のボタンは藍色の縁 */
.shogi-game .disciple__research-cards { display: grid; gap: 0.3rem; max-height: min(14rem, 32vh); margin-top: 0.3rem; overflow-y: auto; }
.shogi-game .disciple .disciple__research-cards .disciple__opt { min-height: 2.6rem; text-align: left; }
.shogi-game .disciple .disciple__tbtn--research { border-color: #c9d6ef; }
/* 稽古を選んでいるあいだ、右の丸いボタンと一言は仲間の顔に場所をゆずる */
.shogi-game .disciple--training .disciple__side, .shogi-game .disciple--training .disciple__say { display: none; }
/* 広い横長の画面(PC・横向きのタブレット): 左上に札、左下に能力の列、右下にコマンド、立ち絵は真ん中 */
@media (min-width: 900px) and (min-aspect-ratio: 1/1) {
  .shogi-game .disciple__hud { right: auto; width: 25rem; }
  .shogi-game .disciple__side { top: 0.6rem; grid-auto-flow: column; }
  .shogi-game .disciple__say, .shogi-game .disciple__picked { top: 7rem; }
  .shogi-game .disciple__bottom { left: 0.8rem; right: 0.8rem; bottom: 0.8rem; display: grid; grid-template-columns: minmax(0, 29rem) minmax(0, 1fr) minmax(0, 26rem); align-items: end; padding: 0; pointer-events: none; }
  .shogi-game .disciple__bottom > * { grid-column: 3; pointer-events: auto; }
  .shogi-game .disciple .disciple__bottom > .disciple__statrow { grid-column: 1; grid-row: 1 / span 2; align-self: end; }
  .shogi-game .disciple__friends { top: 6rem; right: 28rem; }
  .shogi-game .disciple .disciple__cmd { max-width: 6rem; }
  .shogi-game .disciple .disciple__cmd--main { max-width: 9rem; }
}
/* 背の低い縦の画面(360×640など): コマンドを小さくし、説明の字を省く */
@media (max-height: 700px) and (max-aspect-ratio: 1/1) {
  .shogi-game .disciple .disciple__cmd { max-width: 4.4rem; }
  .shogi-game .disciple .disciple__cmd--main { max-width: 6.4rem; }
  .shogi-game .disciple .disciple__cmd > span { font-size: 1.05rem; }
  .shogi-game .disciple .disciple__cmd--main > span { font-size: 1.5rem; }
  .shogi-game .disciple .disciple__cmd small { display: none; }
  .shogi-game .disciple .disciple__tbtn { max-width: 4rem; font-size: 0.62rem; }
}
@media (max-width: 380px) {
  .shogi-game .disciple__turn { min-width: 4.8rem; }
  .shogi-game .disciple__turn b { font-size: 1.5rem; }
  .shogi-game .disciple__goal small { display: none; }
  .shogi-game .disciple__val { font-size: 0.92rem; }
  .shogi-game .disciple__rank { min-width: 1.3rem; height: 1.3rem; font-size: 0.7rem; }
}
/* 研究ノート(49章)。会の画面と同じ大きさのシート。広い画面は盤と一覧を横に、狭い画面は縦に。 */
.shogi-game .disciple__notes {
  position: absolute; left: 50%; top: 4.4rem; bottom: 0.8rem; z-index: 8; transform: translateX(-50%);
  display: flex; flex-direction: column; gap: 0.4rem; width: min(46rem, calc(100% - 1.2rem)); overflow: hidden; background: var(--panel-solid);
}
.shogi-game .disciple__notes h4 { display: flex; align-items: center; justify-content: space-between; margin: 0; font-size: 1rem; }
.shogi-game .disciple__notes > p { margin: 0; font-size: 0.74rem; }
.shogi-game .disciple__notes-body { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 0.5rem; }
.shogi-game .disciple__notes-board { position: relative; min-height: 0; display: grid; place-items: center; }
.shogi-game .disciple__notes-list { display: grid; align-content: start; gap: 0.3rem; min-height: 0; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
.shogi-game .disciple .disciple__notes-list .disciple__opt { width: 100%; min-height: 2.6rem; text-align: left; }
.shogi-game .disciple .disciple__note-open { display: block; margin-top: 0.15rem; font-size: 0.72rem; }
@media (max-width: 640px), (max-aspect-ratio: 1/1) {
  .shogi-game .disciple__notes { top: 0.4rem; bottom: 0.4rem; width: calc(100% - 0.8rem); }
  .shogi-game .disciple__notes-body { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1.4fr) minmax(0, 1fr); }
}
</style>
