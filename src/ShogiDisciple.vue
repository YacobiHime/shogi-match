<template>
  <!--
    師匠の1年(docs/disciple-mode-design.md)。弟子を選び、半月ごとに予定を選んで育て、研修会の入会試験と例会を弟子が指す。
    立ち絵を真ん中に大きく置き、ターン・目標・能力・やる気と体力・予定のボタンをその上に重ねる(18章。弟子の絵はまだないので百花の立ち絵で代用)。
    段階1(23章): 予定は稽古・休む・出かけるの3つ。観戦の見立ては段階2で足す(結果だけ見る)。
  -->
  <div class="disciple" role="dialog" aria-modal="true" aria-label="師匠の1年" data-disciple>
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
      <!-- 上の帯 -->
      <header class="disciple__top">
        <div class="disciple__turn" :class="{ 'disciple__turn--big': view.big && !view.end }">
          <b>{{ view.calendar.label }}</b><small>{{ view.calendar.sub }}</small>
        </div>
        <div class="disciple__goal">
          <div><small>次の目標</small><b>{{ view.goal.text }}</b></div>
          <div v-if="view.goal.left" class="disciple__left">あと<b>{{ view.goal.left }}</b>{{ view.goal.unit ?? 'ターン' }}</div>
        </div>
        <button v-if="bookGames.length" type="button" class="disciple__menu-btn disciple__menu-btn--text" data-disciple-book-open @click="bookOpen = true">棋譜帳</button>
        <button type="button" class="disciple__menu-btn disciple__menu-btn--text" data-disciple-slots-open @click="showSlots">記録</button>
        <button type="button" class="disciple__menu-btn" aria-label="戻る" data-disciple-back @click="emit('close')">←</button>
      </header>

      <!-- 左の能力 -->
      <aside class="disciple__panel disciple__stats" aria-label="能力">
        <div class="disciple__who"><b>{{ view.name }}</b><small>{{ view.place }}<template v-if="view.shoreikai">・{{ view.age }}歳</template></small></div>
        <div v-for="stat in view.stats" :key="stat.key" class="disciple__stat" :data-disciple-stat="stat.key">
          <span class="disciple__stat-name">{{ stat.label }}</span>
          <span class="disciple__rank" :class="`disciple__rank--${stat.rank}`">{{ stat.rank }}</span>
          <span class="disciple__bar"><i :style="{ width: `${Math.min(100, stat.value / 12)}%` }"></i></span>
          <span class="disciple__num">
            <template v-if="previewGains[stat.key]"><b class="disciple__up">+{{ previewGains[stat.key] }}</b></template>
            <template v-else>{{ stat.value }}</template>
          </span>
          <span v-if="stat.aimed" class="disciple__aim" title="狙い目">狙</span>
        </div>
        <div class="disciple__chips">
          <span class="disciple__chip disciple__chip--style">{{ PLAY_STYLES[view.style]?.label }}</span>
          <span v-for="id in view.skills" :key="id" class="disciple__chip">{{ skillById(id)?.name }}{{ '★'.repeat(skillById(id)?.star ?? 0) }}</span>
          <span class="disciple__chip disciple__chip--hidden">弱点 {{ view.weakness ? view.weakness : '？' }}</span>
          <!-- 押すと作戦帳(35-12)。覚えられる作戦があれば、隣に札を出す。 -->
          <button v-if="view.mastery" type="button" class="disciple__chip disciple__chip--mastery disciple__chip--btn" data-disciple-mastery data-disciple-plans-open
            title="作戦帳を開く（定跡のあと、研究してきた手を何手まで指せるか）" @click="plansOpen = !plansOpen">作戦帳 {{ view.book.count }}・戦法熟練度 {{ view.mastery.label }} {{ view.mastery.value }}</button>
          <button v-if="view.book.offer.length" type="button" class="disciple__chip disciple__chip--btn disciple__chip--learn" data-disciple-learn-open @click="plansOpen = true">新しい作戦を覚えられる</button>
          <span v-if="view.spotted?.length" class="disciple__chip disciple__chip--spotted" data-disciple-spotted title="観戦で見抜いた崩れ方の回数">見抜いた {{ view.spotted.map((item) => `${item.label} ${item.count}`).join('・') }}</span>
          <span v-if="view.rival" class="disciple__chip disciple__chip--rival" data-disciple-rival :title="`羽音の弟子（${view.rival.where}）`">ライバル {{ view.rival.name }} {{ view.rival.wins }}勝{{ view.rival.losses }}敗</span>
          <button type="button" class="disciple__chip disciple__chip--btn" data-disciple-skills-open @click="skillsOpen = !skillsOpen">スキルの条件</button>
        </div>
      </aside>

      <!-- 右のやる気・体力・適性 -->
      <aside class="disciple__panel disciple__mood" aria-label="調子">
        <div><small>やる気</small><b class="disciple__mood-face">{{ MOOD_LABELS[view.mood + 2] }}</b></div>
        <div><small>体力 {{ view.stamina }}/100</small><span class="disciple__hp"><i :style="{ width: `${view.stamina}%` }"></i></span></div>
        <div>
          <small>適性</small>
          <div class="disciple__apt">
            <span v-for="key in APTITUDE_KEYS" :key="key">{{ APTITUDE_SHORT[key] }}<b>{{ view.aptitudes[key].rank }}</b></span>
          </div>
        </div>
        <div v-if="view.charms.length" data-disciple-charms>
          <small>お守り</small>
          <div class="disciple__charms"><span v-for="charm in view.charms" :key="charm.id" :title="charm.text">{{ charm.name }}<b v-if="charm.count > 1">×{{ charm.count }}</b></span></div>
        </div>
      </aside>

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
            <small>{{ row.tierLabel }}・{{ row.vs }}　熟練度 {{ row.mastery }}・{{ row.games }}局{{ row.wins }}勝<template v-if="row.memo">・研究メモ {{ row.memo }}局面</template></small>
            <small v-if="row.chainNow.length || row.chainNext" class="disciple__plan-chain">
              <template v-if="row.chainNow.length">囲いの続き {{ row.chainNow.join('→') }}</template>
              <template v-if="row.chainNext">{{ row.chainNow.length ? '　' : '' }}次は{{ row.chainNext.label }}（あと{{ row.chainNext.left }}局）</template>
            </small>
          </li>
        </ul>
        <p v-if="view.book.seen.length" class="disciple__muted" data-disciple-plan-seen>覚えられそう（負けた相手の作戦）：{{ view.book.seen.join('・') }}</p>
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
        <h4>なんて声をかける？</h4>
        <div class="disciple__choice">
          <button v-for="word in WORDS" :key="word.id" type="button" class="disciple__opt" :data-disciple-word="word.id" @click="words(word.id)">
            {{ word.label }}<small>{{ word.note }}</small>
          </button>
        </div>
      </section>

      <!-- 入会試験・例会 -->
      <section v-else-if="view.kind === 'exam' || view.kind === 'reikai'" class="disciple__panel disciple__sheet" data-disciple-event>
        <h3>{{ view.eventTitle }}<small v-if="view.big" class="disciple__bigtag">大一番</small></h3>
        <p v-if="view.opponent" class="disciple__muted">相手：{{ view.opponent.name }}（{{ view.opponent.label }}）<template v-if="view.book.opponentStyle">　得意 {{ view.book.opponentStyle }}</template></p>
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
          <button v-if="engineFactory" type="button" class="disciple__btn disciple__btn--main" data-disciple-watch @click="startWatch">
            {{ view.big ? '作戦を授けて観戦する' : '1局目を観戦する' }}
          </button>
        </div>
        <p class="disciple__muted disciple__note">観戦すると、崩れた手の理由を見抜いて、次の稽古を狙い目にできる（師匠の眼 {{ view.eye.dan }}段）。</p>
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

      <!-- 稽古を選ぶ -->
      <template v-else-if="training">
        <section class="disciple__panel disciple__preview" data-disciple-preview>
          <h4>{{ selected?.label }}<small>体力 −{{ selected?.stamina }}・失敗 {{ selected?.fail }}%</small></h4>
          <div class="disciple__gains">
            <div v-for="stat in view.stats" :key="stat.key" :class="{ 'disciple__gain--hot': (selected?.gains[stat.key] ?? 0) >= 15 }">
              {{ stat.label }}<b>{{ selected?.gains[stat.key] ? `+${selected.gains[stat.key]}` : '—' }}</b>
            </div>
          </div>
          <div v-if="selectedId === 'shisho'" class="disciple__choice disciple__choice--four">
            <button v-for="stat in view.stats" :key="stat.key" type="button" class="disciple__opt" :aria-pressed="choice === stat.key"
              @click="choice = stat.key">{{ stat.label }}</button>
          </div>
          <p v-if="selected?.aptitude" class="disciple__extra">{{ APTITUDE_LABELS[selected.aptitude] }}の適性 +1目盛り</p>
          <p v-if="selected?.friends.length" class="disciple__extra">{{ selected.friends.map(friendName).join('・') }}が一緒（伸びが増える）</p>
          <div class="disciple__row">
            <button type="button" class="disciple__btn" @click="training = false">やめる</button>
            <button type="button" class="disciple__btn disciple__btn--main" data-disciple-train-go @click="openLesson">この稽古にする</button>
          </div>
        </section>
        <nav class="disciple__dock disciple__dock--train" aria-label="稽古">
          <button v-for="item in view.trainings" :key="item.id" type="button" class="disciple__cmd disciple__cmd--train"
            :aria-pressed="item.id === selectedId" :data-disciple-train="item.id" @click="selectedId = item.id">
            <small class="disciple__lv">Lv{{ item.level }}</small>
            <span v-if="item.aimed" class="disciple__aimtag">狙い目</span>
            <span v-if="item.friends.length" class="disciple__friend-dot">{{ item.friends.map(friendName).join('・') }}</span>
            <b>{{ item.label }}</b><small :class="{ 'disciple__warn': item.fail >= 8 }">失敗 {{ item.fail }}%</small>
          </button>
        </nav>
      </template>

      <!-- 予定 -->
      <nav v-else class="disciple__dock disciple__dock--free" aria-label="予定">
        <button type="button" class="disciple__cmd disciple__cmd--main" data-disciple-action="train" @click="openTraining">稽古<small>能力を伸ばす</small></button>
        <button type="button" class="disciple__cmd" data-disciple-action="study" @click="act('study')">研究会<small>読みと安定</small></button>
        <button type="button" class="disciple__cmd" data-disciple-action="master" @click="act('master')">師匠の予定<small>連れていく</small></button>
        <button type="button" class="disciple__cmd" data-disciple-action="rest" @click="act('rest')">休む<small>体力が戻る</small></button>
        <button type="button" class="disciple__cmd" data-disciple-action="outing" @click="act('outing')">出かける<small>やる気が上がる</small></button>
      </nav>
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
            @resize="onBoardResize"
          />
        </div>
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
        <p v-if="watch.plans" class="disciple__today-plan" data-disciple-today-plan>今日の作戦 <b>{{ watch.plans.own }}</b><small v-if="watch.plans.opponent">相手の得意 {{ watch.plans.opponent }}</small></p>
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
import {
  APTITUDE_KEYS, APTITUDE_LABELS, CAUSES, DISCIPLES, PLAY_STYLES, STAT_KEYS, STAT_LABELS, skillById, statRank,
} from "./core/disciple-strength.mjs";
import {
  FRIENDS, PLANS, WORDS, applyFindings, praiseLine, chooseAction, chooseWords, createDiscipleRun, dayResultView, discipleView, endCardText, eyeDan, learnPlan, loadDiscipleRun, playEvent, saveDiscipleRun, skipLearn, watchSpec,
} from "./core/disciple-run.mjs";
import { sfenAfter } from "./core/pro-cut.mjs";
import { LESSON_ROUNDS, autoPick, cardById, cardFits, lessonHands, scoreLesson } from "./core/disciple-lesson.mjs";
import { useEngineGame } from "./composables/match/useEngineGame";
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
const previewGains = computed<Record<string, number>>(() => (training.value && selected.value ? selected.value.gains : {}));
const friendName = (id: string) => view.value?.friends.find((friend: { id: string }) => friend.id === id)?.name ?? "";
function openTraining() {
  training.value = true;
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
  entries: { move: string; eval: number; loss: number; d?: unknown }[]; end: unknown; win: boolean; done: boolean;
  marks: WatchMark[]; guesses: (string | null)[]; selected: number; error: string;
  /** 観戦の段(33-3)。指している→終局の札→その日の結果発表→検討。 */
  phase: "playing" | "end" | "result" | "review";
  endCard: { stamp: string; line: string } | null;
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
    marks: [], guesses: [], selected: -1, error: "", phase: "playing", endCard: null, day: null, mode: "live", upto: 0, endReason: "",
    seek: null, good: [], goodSel: -1, praised: "",
  };
  watch.value = current;
  const ticket = ++watchTicket;
  engineGame.play(made.spec, (entry, index) => {
    if (ticket !== watchTicket) return;
    current.entries[index] = entry as Watch["entries"][number];
    watch.value = { ...current, entries: [...current.entries] };
  }).then((game) => {
    if (!game || ticket !== watchTicket) return;
    finishWatchGame(current, game.end as { winner: string });
  }).catch((error) => {
    console.warn("師匠の1年の観戦の本局を指せませんでした", error);
    if (ticket !== watchTicket) return;
    current.error = "エンジンを起動できなかったので、結果だけ見ます";
    watch.value = { ...current };
    play();
    current.done = true;
  });
}
function finishWatchGame(current: Watch, end: { winner: string }) {
  current.end = end;
  current.win = end?.winner === current.side;
  // その日の局を記録する(観戦した局はエンジンの勝ち負け)。
  // 弟子から見たいちばん低い評価値(劣勢から勝つと、逆境の粘りの条件に数える。25-3)。
  const sign = current.side === "black" ? 1 : -1;
  const watchedMin = Math.min(0, ...current.entries.map((entry) => sign * (Number(entry?.eval) || 0)));
  // 観戦した本局の手は、研究メモ(35-13)に使う。
  const { state: next, result } = playEvent(state.value, { plan: current.plan, forced: [current.win], watchedMin, charm: current.charm, entries: current.entries });
  charmPick.value = "";
  // 選んだ作戦は、その日の相手に合わせたものなので持ち越さない。
  plan.card = "";
  commit(next);
  // 崩れ方は盤面で起きたことから決める(33-5)。言えない手は印にしない。大一番は背景の札に。
  current.marks = reviewMarks(current.entries, current.side, { dan: eyeDan(state.value?.eye), big: Boolean(current.plan) });
  current.guesses = current.marks.map(() => null);
  current.selected = current.marks.length ? 0 : -1;
  current.good = goodMoves(current.entries, current.side);
  current.done = true;
  // 終局の札 → その日の結果発表 → 検討の順に見せる(33-3。結果を先に知らせる)。
  current.endCard = endCardText({ win: current.win, reason: (end as { reason?: string })?.reason, plies: current.entries.length });
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
const watchRows = computed(() => (watch.value?.done ? reviewRows(watch.value.entries, watch.value.side) : []));
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
  const next = unansweredMark(current.upto + 1) ? null : aiHint(current.entries, current.upto + 1);
  const now = current.upto > 0 && !unansweredMark(current.upto) ? aiHint(current.entries, current.upto) : null;
  const shown = { nextBest: next?.bestText ?? "", nextUsi: next?.best ?? "", pv: now?.pvText ?? "" };
  return shown.nextBest || shown.pv ? shown : null;
});
const aiLocked = computed(() => Boolean(watch.value?.phase === "review" && !seeking.value && (unansweredMark(watch.value.upto) || unansweredMark(watch.value.upto + 1))));
const watchArrows = computed(() => (aiShown.value?.nextUsi ? [{ usi: aiShown.value.nextUsi, guideKind: "ai" as const }] : []));
function goPly(ply: number) {
  const current = watch.value;
  if (!current) return;
  const upto = Math.max(0, Math.min(current.entries.length, Math.round(ply)));
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
  emit("research", { sfen: STANDARD_SFEN, moves: current.entries.map((entry) => entry.move), ply: current.upto, name: `${view.value?.name ?? ""} 対 ${current.opponent.name}` });
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
  const mine = (index: number) => (index % 2 === 0 ? "black" : "white") === current.side;
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
  if (((current.upto - 1) % 2 === 0 ? "black" : "white") !== current.side) return null;
  return thoughtReading(current.entries as any, current.upto);
});
/** 盤の局面(選んだ印の局面。印を選んでいなければ最新の局面)と、直前の手。 */
const watchUpto = computed(() => (watch.value?.phase === "review" ? watch.value.upto : watch.value?.entries.length ?? 0));
const watchSfen = computed(() => sfenAfter((watch.value?.entries ?? []).slice(0, watchUpto.value).map((entry) => entry.move)) ?? STANDARD_SFEN);
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
  --ink: #1d2a36; --accent: #f1a54c; --accent-ink: #5a3410; --muted: #6b7a88; --panel: rgba(255, 252, 244, 0.93); --line: rgba(29, 42, 54, 0.14);
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

.shogi-game .disciple__top { position: absolute; z-index: 5; top: 0.6rem; left: 0.6rem; right: 0.6rem; display: flex; gap: 0.5rem; align-items: stretch; }
.shogi-game .disciple__top--pick { right: auto; align-items: center; }
.shogi-game .disciple__title { padding: 0.35rem 0.9rem; border-radius: 0.6rem; background: var(--panel); }
.shogi-game .disciple .disciple__back { min-height: 2.75rem; padding: 0 0.9rem; border: 0; border-radius: 999px; background: var(--ink); color: #fff; font-weight: 900; }
.shogi-game .disciple__turn { display: grid; place-items: center; min-width: 6rem; padding: 0.3rem 0.6rem; border-radius: 0.8rem; background: var(--ink); color: #fff; line-height: 1.15; text-align: center; }
.shogi-game .disciple__turn--big { background: #d8655b; }
.shogi-game .disciple__turn b { font-size: 1rem; }
.shogi-game .disciple__turn small { color: #c6d2dc; font-size: 0.66rem; }
.shogi-game .disciple__goal { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.35rem 0.8rem; border: 2px solid var(--accent); border-radius: 0.8rem; background: var(--panel); }
.shogi-game .disciple__goal small { display: block; color: var(--accent-ink); font-size: 0.68rem; font-weight: 900; }
.shogi-game .disciple__goal b { font-size: 0.92rem; }
.shogi-game .disciple__left { font-size: 0.72rem; color: var(--muted); text-align: right; }
.shogi-game .disciple__left b { display: inline-block; margin: 0 0.1rem; color: #d8655b; font-size: 1.25rem; }
.shogi-game .disciple .disciple__menu-btn { width: 2.8rem; border: 0; border-radius: 0.8rem; background: var(--panel); color: var(--ink); font-size: 1.1rem; font-weight: 900; }

.shogi-game .disciple__panel { position: absolute; z-index: 5; padding: 0.55rem 0.6rem; border-radius: 0.9rem; background: var(--panel); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); }
.shogi-game .disciple__stats { left: 0.6rem; top: 4.6rem; width: 14rem; display: grid; gap: 0.35rem; }
.shogi-game .disciple__who { display: flex; justify-content: space-between; align-items: baseline; }
.shogi-game .disciple__who small, .shogi-game .disciple__muted { color: var(--muted); font-size: 0.72rem; }
.shogi-game .disciple__stat { position: relative; display: grid; grid-template-columns: 2.4rem 1.7rem 1fr 2.4rem; align-items: center; gap: 0.3rem; font-size: 0.82rem; }
.shogi-game .disciple__stat-name { font-weight: 900; }
.shogi-game .disciple__rank { display: inline-grid; place-items: center; min-width: 1.6rem; height: 1.6rem; margin-right: 0.25rem; border-radius: 0.4rem; color: #fff; font-weight: 900; font-size: 0.8rem; background: #9aa4ad; }
.shogi-game .disciple__rank--F { background: #7fa0b8; } .shogi-game .disciple__rank--E { background: #5aa66a; } .shogi-game .disciple__rank--D { background: #4f86c6; }
.shogi-game .disciple__rank--C { background: #9a6fc4; } .shogi-game .disciple__rank--B { background: #d8655b; } .shogi-game .disciple__rank--A { background: #e08a2e; }
.shogi-game .disciple__rank--S, .shogi-game .disciple__rank--SS { background: #e2b33f; }
.shogi-game .disciple__bar { height: 0.55rem; border-radius: 999px; background: #e7e1d3; overflow: hidden; }
.shogi-game .disciple__bar i { display: block; height: 100%; background: #4f86c6; }
.shogi-game .disciple__num { text-align: right; font-weight: 900; font-variant-numeric: tabular-nums; }
.shogi-game .disciple__up { color: #3c9a4c; }
.shogi-game .disciple__aim { position: absolute; right: -0.4rem; top: -0.3rem; padding: 0 0.25rem; border-radius: 999px; background: #e2457a; color: #fff; font-size: 0.56rem; }
.shogi-game .disciple__chips { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.shogi-game .disciple__chip { padding: 0.08rem 0.45rem; border-radius: 999px; background: linear-gradient(90deg, #ffe6a8, #ffd0a0); color: #6a3a10; font-size: 0.66rem; font-weight: 900; }
.shogi-game .disciple__chip--style { background: var(--ink); color: #fff; }
.shogi-game .disciple__chip--hidden { background: #e6e1d6; color: var(--muted); }
.shogi-game .disciple__mood { right: 0.6rem; top: 4.6rem; width: 11.5rem; display: grid; gap: 0.45rem; }
.shogi-game .disciple__mood small { display: block; color: var(--muted); font-size: 0.7rem; font-weight: 700; }
.shogi-game .disciple__mood-face { color: #d8655b; }
.shogi-game .disciple__hp { display: block; height: 0.8rem; border-radius: 999px; background: #e7e1d3; overflow: hidden; }
.shogi-game .disciple__hp i { display: block; height: 100%; background: linear-gradient(90deg, #6cc07a, #a6d86a); }
.shogi-game .disciple__apt { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.2rem; }
.shogi-game .disciple__apt span { display: flex; justify-content: space-between; padding: 0.1rem 0.3rem; border-radius: 0.35rem; background: #f3eee2; font-size: 0.66rem; font-weight: 800; }
.shogi-game .disciple__apt b { color: var(--accent-ink); }
.shogi-game .disciple__say { position: absolute; z-index: 6; left: 50%; top: 30%; transform: translateX(-125%); max-width: 14rem; margin: 0; padding: 0.55rem 0.8rem; border-radius: 1rem 1rem 0.2rem 1rem; background: #fff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12); font-size: 0.86rem; font-weight: 700; }

.shogi-game .disciple__dock { position: absolute; z-index: 5; left: 0.6rem; right: 0.6rem; bottom: 0.6rem; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.45rem; }
.shogi-game .disciple__dock--train { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.shogi-game .disciple .disciple__cmd { position: relative; display: grid; place-items: center; align-content: center; gap: 0.1rem; min-height: 4.4rem; padding: 0.3rem; border: 3px solid transparent; border-radius: 1rem; background: #fff; color: var(--ink); box-shadow: 0 4px 0 #c9bfa8; font-size: 1rem; font-weight: 900; }
.shogi-game .disciple .disciple__cmd small { color: var(--muted); font-size: 0.66rem; font-weight: 700; }
.shogi-game .disciple .disciple__cmd--main { background: var(--accent); color: #fff; box-shadow: 0 4px 0 #b86f22; }
.shogi-game .disciple .disciple__cmd--main small { color: #fff4e0; }
.shogi-game .disciple .disciple__cmd:not(:disabled):hover, .shogi-game .disciple .disciple__cmd:not(:disabled):focus-visible { background: #fffaf0; color: var(--ink); }
.shogi-game .disciple .disciple__cmd--main:not(:disabled):hover { background: #f5b25f; color: #fff; }
.shogi-game .disciple .disciple__cmd--train[aria-pressed="true"], .shogi-game .disciple .disciple__cmd--train[aria-pressed="true"]:not(:disabled):hover { border-color: var(--accent); background: #fff3e2; color: var(--ink); transform: translateY(-0.4rem); }
.shogi-game .disciple .disciple__opt:not(:disabled):hover { background: #fffaf0; color: var(--ink); }
.shogi-game .disciple .disciple__opt[aria-pressed="true"]:not(:disabled):hover { background: #fff3e2; }
.shogi-game .disciple .disciple__pick-card:not(:disabled):hover { background: #fffaf0; color: var(--ink); }
.shogi-game .disciple .disciple__btn:not(:disabled):hover { filter: brightness(1.04); }
.shogi-game .disciple__lv { position: absolute; top: 0.25rem; left: 0.45rem; }
.shogi-game .disciple__aimtag { position: absolute; top: 0.25rem; right: 0.4rem; padding: 0 0.35rem; border-radius: 999px; background: #e2457a; color: #fff; font-size: 0.58rem; }
.shogi-game .disciple__friend-dot { position: absolute; top: -0.75rem; padding: 0.05rem 0.45rem; border-radius: 999px; background: #f3b4c8; color: #6a1f3a; font-size: 0.62rem; white-space: nowrap; }
.shogi-game .disciple .disciple__warn { color: #d8655b; }

.shogi-game .disciple__preview { left: 50%; bottom: 7.4rem; transform: translateX(-50%); width: min(26rem, calc(100% - 1.2rem)); }
.shogi-game .disciple__preview h4, .shogi-game .disciple__sheet h4 { display: flex; justify-content: space-between; margin: 0.2rem 0 0.35rem; font-size: 0.9rem; }
.shogi-game .disciple__preview h4 small { color: var(--muted); font-size: 0.72rem; }
.shogi-game .disciple__gains { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.3rem; text-align: center; font-size: 0.72rem; }
.shogi-game .disciple__gains div { padding: 0.25rem 0; border-radius: 0.5rem; background: #f3eee2; }
.shogi-game .disciple__gains b { display: block; font-size: 1rem; }
.shogi-game .disciple__gain--hot { background: #ffe7c6 !important; color: #c0661b; }
.shogi-game .disciple__extra { margin: 0.3rem 0 0; color: #c0661b; font-size: 0.74rem; font-weight: 800; }
.shogi-game .disciple__row { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.shogi-game .disciple .disciple__btn { flex: 1; min-height: 2.9rem; border: 0; border-radius: 0.8rem; background: #e9e2d2; color: var(--ink); font-weight: 900; }
.shogi-game .disciple .disciple__btn--main { background: var(--accent); color: #fff; box-shadow: 0 3px 0 #b86f22; }

.shogi-game .disciple__sheet { left: 50%; bottom: 0.6rem; transform: translateX(-50%); width: min(34rem, calc(100% - 1.2rem)); max-height: calc(100% - 6rem); overflow-y: auto; }
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
.shogi-game .disciple .disciple__menu-btn--text { width: auto; padding: 0 0.6rem; font-size: 0.8rem; }
/* お守り(26章) */
.shogi-game .disciple__charms { display: flex; flex-wrap: wrap; gap: 0.2rem; }
.shogi-game .disciple__charms span { padding: 0.08rem 0.4rem; border-radius: 999px; background: #fde3e6; color: #8a2a3a; font-size: 0.66rem; font-weight: 800; }
.shogi-game .disciple__choice--charm { grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr)); }
.shogi-game .disciple [data-disciple-scene] { z-index: 9; }
/* 指導の引き出し(25-1)・研究会と師匠の予定(25-2)・スキルの条件(25-3) */
.shogi-game .disciple__dock--free { grid-template-columns: 1.4fr repeat(4, minmax(0, 1fr)); }
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
.shogi-game .disciple__skills { left: 50%; top: 4.4rem; z-index: 7; transform: translateX(-50%); width: min(24rem, calc(100% - 1.2rem)); max-height: calc(100% - 12rem); overflow-y: auto; }
.shogi-game .disciple__skills h4 { display: flex; align-items: center; justify-content: space-between; margin: 0 0 0.3rem; font-size: 0.9rem; }
.shogi-game .disciple .disciple__x { width: 2rem; height: 2rem; border: 0; border-radius: 50%; background: #e9e2d2; color: var(--ink); font-weight: 900; }
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
  .shogi-game .disciple__top { top: 0.4rem; left: 0.4rem; right: 0.4rem; }
  .shogi-game .disciple__turn { min-width: 4.6rem; }
  .shogi-game .disciple__turn b { font-size: 0.86rem; }
  .shogi-game .disciple__goal { gap: 0.3rem; padding: 0.25rem 0.45rem; }
  .shogi-game .disciple__goal b { font-size: 0.74rem; }
  .shogi-game .disciple__left { flex: none; white-space: nowrap; font-size: 0.64rem; }
  .shogi-game .disciple__left b { font-size: 1.05rem; }
  .shogi-game .disciple .disciple__menu-btn { width: 2.3rem; }
  .shogi-game .disciple .disciple__menu-btn--text { width: auto; padding: 0 0.35rem; font-size: 0.7rem; }
  .shogi-game .disciple__stats { top: 3.8rem; left: 0.4rem; width: 9.8rem; padding: 0.4rem 0.45rem; gap: 0.2rem; }
  .shogi-game .disciple__stat { grid-template-columns: 2rem 1.4rem 1fr 2rem; font-size: 0.68rem; gap: 0.2rem; }
  .shogi-game .disciple__rank { min-width: 1.3rem; height: 1.3rem; font-size: 0.68rem; }
  .shogi-game .disciple__mood { top: 3.8rem; right: 0.4rem; width: 7.6rem; padding: 0.4rem 0.45rem; gap: 0.3rem; }
  .shogi-game .disciple__apt { grid-template-columns: repeat(2, 1fr); }
  .shogi-game .disciple__say { top: 46%; left: 0.6rem; transform: none; max-width: 62%; font-size: 0.8rem; }
  .shogi-game .disciple__dock { left: 0.4rem; right: 0.4rem; bottom: 0.4rem; }
  .shogi-game .disciple__dock--train { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .shogi-game .disciple__dock--free { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.3rem; }
  .shogi-game .disciple .disciple__dock--free .disciple__cmd { padding: 0.15rem; font-size: 0.76rem; letter-spacing: -0.03em; }
  .shogi-game .disciple__dock--free .disciple__cmd small { display: none; }
  .shogi-game .disciple .disciple__card { min-height: 4.6rem; font-size: 0.76rem; }
  /* スマホ縦: 弟子の札は下にあるので、仲間は候補の下(立ち絵の胸のあたり)に置く。 */
  .shogi-game .disciple__team { top: 14.4rem; bottom: auto; left: 0.4rem; right: 0.4rem; padding: 0.4rem; }
  .shogi-game .disciple .disciple__team-chip { min-height: 2.3rem; padding: 0.15rem 0.45rem; }
  .shogi-game .disciple .disciple__cmd { min-height: 3.4rem; font-size: 0.9rem; }
  .shogi-game .disciple__preview { bottom: 8.6rem; }
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
</style>
