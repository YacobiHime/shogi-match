<template>
  <!--
    研究モード(docs/research-mode-design.md)。好きな局面をAIと一緒に調べる。
    PCは対局画面と同じ3列(左に棋譜・分岐・グラフ、真ん中に盤、右に検討の欄)、スマホは盤の下にタブ(検討・棋譜・グラフ)。
    局面編集のあいだは、検討の欄が駒箱と編集の道具に替わる(盤の大きさと位置は変えない)。
  -->
  <div
    ref="rootEl"
    class="shogi-dex shogi-research"
    :class="{ 'shogi-research--wide': wide, 'shogi-research--land': landscape, 'shogi-research--editing': editing }"
    role="dialog"
    aria-modal="true"
    aria-labelledby="shogi-research-title"
    data-research
    tabindex="-1"
    @keydown="onKeydown"
  >
    <header class="shogi-dex__header shogi-research__header">
      <button type="button" class="shogi-dex__back" data-research-back @click="goBack">
        <span aria-hidden="true">←</span> 戻る
      </button>
      <h1 id="shogi-research-title">
        {{ editing ? "局面編集" : "研究" }}
        <small>{{ editing ? "完了すると新しい研究になる" : title }}</small>
      </h1>
      <button v-if="!editing" type="button" class="shogi-research__head-button" data-research-book @click="openSheet('book')">研究帳</button>
    </header>

    <div class="shogi-research__body">
      <!-- 左の列(PC): 棋譜・分岐・グラフ。スマホでは下の欄のタブの中に出す。 -->
      <aside v-if="wide" class="shogi-research__left">
        <template v-if="!editing">
          <section class="shogi-research__box shogi-research__kifu-box" aria-label="棋譜">
            <h2>棋譜</h2>
            <ol ref="kifuListEl" class="shogi-research__kifu" data-research-kifu>
              <li :class="{ 'is-current': ply === 0 }">
                <button type="button" @click="goTo(0)"><span class="n">0</span><span>開始局面</span><span class="s num">{{ scoreCell(rootScore) }}</span><span class="b" /></button>
              </li>
              <li v-for="entry in line" :key="entry.path.join('.')" :class="{ 'is-current': entry.ply === ply, 'is-after': entry.ply > ply }">
                <button type="button" @click="goTo(entry.ply)">
                  <span class="n num">{{ entry.ply }}</span>
                  <span>{{ entry.label }} <i v-if="markOf(entry)" :class="['mark', `mark--${markOf(entry)!.kind}`]">{{ markOf(entry)!.label }}</i></span>
                  <span class="s num">{{ scoreCell(entry.score) }}</span>
                  <span class="b" :title="entry.branches > 1 ? '分岐あり' : ''">{{ entry.branches > 1 ? "+" : "" }}</span>
                </button>
              </li>
            </ol>
          </section>
          <section class="shogi-research__branches" aria-label="次の手" data-research-branches>
            <h2>次の手（{{ ply + 1 }}手目）</h2>
            <p v-if="!nextBranches.length" class="shogi-research__muted">盤で指すと、ここに次の手が並びます。</p>
            <div v-for="branch in nextBranches" :key="branch.index" class="shogi-research__branch">
              <button type="button" :class="{ on: branch.selected }" @click="chooseNext(branch.index)">
                {{ branch.label }} <small>{{ branch.main ? "本譜" : `分岐・${branch.length}手` }}</small>
              </button>
              <button type="button" class="shogi-research__branch-more" :aria-label="`${branch.label}の操作`" @click="branchMenu = branchMenu === branch.index ? -1 : branch.index">…</button>
              <div v-if="branchMenu === branch.index" class="shogi-research__branch-menu">
                <button v-if="!branch.main" type="button" @click="promote(branch.index)">本譜にする</button>
                <button type="button" data-research-branch-remove @click="removeNext(branch.index)">この分岐を消す</button>
              </div>
            </div>
          </section>
          <section class="shogi-research__graph-box" aria-label="評価値のグラフ">
            <div class="shogi-research__graph-head">
              <h2>評価値</h2>
              <span v-if="kifuAnalysis.running" class="shogi-research__progress"><i><b :style="{ width: `${kifuAnalysis.percent}%` }" /></i> <span class="num">{{ kifuAnalysis.done }}/{{ kifuAnalysis.total }}</span></span>
              <button type="button" class="shogi-research__small" data-research-analyze @click="toggleKifuAnalysis">{{ kifuAnalysis.running ? "止める" : "棋譜解析" }}</button>
            </div>
            <EvaluationGraph :points="graphPoints" :current-ply="ply" :total-ply="Math.max(1, line.length)" hide-legend @select="goTo" />
          </section>
        </template>
        <template v-else>
          <section class="shogi-research__box shogi-research__help">
            <h2>置き方</h2>
            <p>駒箱の駒を押す → 置くマスを押す<br>盤の駒を押す → 動かす先を押す<br>持ち駒へは駒台へ動かす<br><span class="shogi-research__muted">PCは右クリックで「くるっと」（成る・向き）</span></p>
          </section>
        </template>
      </aside>

      <!-- 真ん中: 盤。上に勝率のバー、下に手の行。 -->
      <main class="shogi-research__center">
        <div v-if="!editing" class="shogi-research__rate" :aria-label="`形勢 ${verdict || '読んでいます'}`">
          <span class="shogi-research__rate-side shogi-research__rate-side--black">▲先手 <span class="num">{{ rateLabel.black }}</span></span>
          <span class="shogi-research__rate-bar"><i :style="{ width: `${blackRate}%` }" /><span>{{ verdict || "読んでいます" }}</span></span>
          <span class="shogi-research__rate-side shogi-research__rate-side--white"><span class="num">{{ rateLabel.white }}</span> △後手</span>
        </div>
        <div v-else class="shogi-research__rate shogi-research__rate--note">編集のあいだは読みを止めています。「完了」で読み始めます。</div>
        <div class="shogi-research__board" data-research-board>
          <ShogiMatchBoard
            :sfen="boardSfen"
            :last-move="boardLastMove"
            :candidates="boardArrows"
            :allow-move="!editing && !preview"
            :allow-edit="editing && !boxPick"
            :enable-drag-and-drop="!boxPick"
            :mark-squares="boardMarks"
            :risk-squares="editProblemSquares"
            :layout="wide || landscape ? 'standard' : 'portrait'"
            :mobile="!wide"
            :asset-base-url="assetBaseUrl"
            black-player-name="先手"
            white-player-name="後手"
            @usi-move="onBoardMove"
            @edit="onBoardEdit"
            @square-click="onSquareClick"
            @hand-click="onHandClick"
          />
        </div>
        <div v-if="preview" class="shogi-research__preview" data-research-preview>
          <span>読み筋 {{ preview.row.rank }}位 <b class="num">{{ preview.step }}/{{ preview.row.pv.length }}</b> {{ previewLabel }}</span>
          <div>
            <button type="button" :disabled="preview.step <= 0" aria-label="読み筋を1手戻す" @click="previewStep(-1)">◀</button>
            <button type="button" :disabled="preview.step >= preview.row.pv.length" aria-label="読み筋を1手進める" @click="previewStep(1)">▶</button>
            <button type="button" data-research-preview-add @click="addPreviewLine">棋譜に入れる</button>
            <button type="button" @click="preview = null">閉じる</button>
          </div>
        </div>
        <div v-else-if="!editing" class="shogi-research__move" data-research-nav>
          <button type="button" aria-label="最初へ" :disabled="ply === 0" @click="goTo(0)">⏮</button>
          <button type="button" aria-label="1手戻る" :disabled="ply === 0" @click="step(-1)">◀</button>
          <span>{{ moveCaption }}<small>{{ moveSub }}</small></span>
          <button type="button" aria-label="1手進む" :disabled="ply >= line.length" @click="step(1)">▶</button>
          <button type="button" aria-label="最後へ" :disabled="ply >= line.length" @click="goTo(line.length)">⏭</button>
        </div>
        <div v-else class="shogi-research__move shogi-research__move--count">
          <span>駒箱 <b class="num">{{ totals.box }}枚</b> ・ 盤と持ち駒 <b class="num">{{ totals.placed }}枚</b><small>いつも40枚。増えも減りもしない</small></span>
        </div>
      </main>

      <!-- 右の列(PC)・下の欄(スマホ)。 -->
      <section class="shogi-research__side" :aria-label="editing ? '局面編集の道具' : '検討'">
        <div v-if="!wide && !editing" class="shogi-research__tabs" role="tablist">
          <button v-for="item in TABS" :key="item.id" type="button" role="tab" :aria-selected="tab === item.id" :class="{ on: tab === item.id }" @click="tab = item.id">{{ item.label }}</button>
        </div>

        <!-- 検討 -->
        <div v-if="!editing && (wide || tab === 'study')" class="shogi-research__study" data-research-study>
          <!-- スマホは、読みの情報・候補の数・読む長さを1行にして、読み筋の表を広く見せる。 -->
          <div v-if="!wide" class="shogi-research__phone-row">
            <span class="shogi-research__phone-stats num"><i v-if="engineRunning" class="pulse" aria-hidden="true" />{{ statsLines.main }}</span>
            <span class="shogi-research__stepper">
              <span class="shogi-research__phone-label">候補</span>
              <button type="button" aria-label="候補を減らす" :disabled="settings.multiPv <= MULTI_PV_MIN" @click="changeMultiPv(-1)">−</button>
              <b class="num" data-research-multipv>{{ settings.multiPv }}</b>
              <button type="button" aria-label="候補を増やす" :disabled="settings.multiPv >= MULTI_PV_MAX" @click="changeMultiPv(1)">＋</button>
            </span>
            <button type="button" class="shogi-research__phone-limit" data-research-limit @click="openSheet('limit')">{{ limitLabel }} ▾</button>
          </div>
          <div v-if="wide" class="shogi-research__run">
            <button type="button" class="shogi-research__go" :class="{ 'is-running': engineRunning }" data-research-go @click="toggleAnalyzing">
              <span v-if="engineRunning" class="pulse" aria-hidden="true" />{{ engineRunning ? "止める" : "読む" }}
            </button>
            <div class="shogi-research__stats">
              <strong>{{ statusText }}</strong>
              <span class="num">{{ statsLines.main }}</span>
              <span v-if="wide" class="num">{{ statsLines.sub }}</span>
            </div>
          </div>
          <div v-if="wide" class="shogi-research__settings">
            <div class="shogi-research__setting">
              <span>候補の数</span>
              <span class="shogi-research__stepper">
                <button type="button" aria-label="候補を減らす" :disabled="settings.multiPv <= MULTI_PV_MIN" @click="changeMultiPv(-1)">−</button>
                <b class="num" data-research-multipv>{{ settings.multiPv }}</b>
                <button type="button" aria-label="候補を増やす" :disabled="settings.multiPv >= MULTI_PV_MAX" @click="changeMultiPv(1)">＋</button>
              </span>
            </div>
            <button type="button" class="shogi-research__setting" data-research-limit @click="openSheet('limit')">
              <span>読む長さ</span><em>{{ limitLabel }} ▾</em>
            </button>
            <div v-if="wide" class="shogi-research__setting">
              <span>矢印</span>
              <span class="shogi-research__switch">
                <button type="button" :class="{ on: settings.arrows }" @click="setSetting('arrows', true)">あり</button>
                <button type="button" :class="{ on: !settings.arrows }" @click="setSetting('arrows', false)">なし</button>
              </span>
            </div>
            <div v-if="wide" class="shogi-research__setting">
              <span>表示</span>
              <span class="shogi-research__switch">
                <button type="button" :class="{ on: settings.display === 'score' }" @click="setSetting('display', 'score')">評価値</button>
                <button type="button" :class="{ on: settings.display === 'rate' }" @click="setSetting('display', 'rate')">勝率</button>
              </span>
            </div>
          </div>
          <ol class="shogi-research__pv" data-research-pv>
            <li v-for="row in rows" :key="row.rank" :class="{ 'is-open': preview?.row.rank === row.rank }">
              <button type="button" @click="openPreview(row)">
                <span :class="['shogi-research__rank', `shogi-research__rank--${Math.min(row.rank, 5)}`]">{{ row.rank }}</span>
                <span class="shogi-research__score num">{{ settings.display === "rate" ? row.rateText : row.scoreText }}<small v-if="wide">{{ settings.display === "rate" ? row.scoreText : `勝率 ${row.rateText}` }}</small></span>
                <span class="shogi-research__pv-move">{{ row.label }}</span>
                <span class="shogi-research__pv-line">{{ row.line }}</span>
              </button>
            </li>
            <li v-if="!rows.length" class="shogi-research__muted shogi-research__pv-empty">{{ emptyRowsText }}</li>
          </ol>
          <div v-if="wide" class="shogi-research__hime" :class="{ 'is-notice': hime.tone === 'notice' }">
            <img :src="himeUrl" alt="" aria-hidden="true">
            <p>{{ hime.text }}</p>
          </div>
          <div v-if="wide" class="shogi-research__actions">
            <button type="button" data-research-edit @click="startEdit">局面編集</button>
            <button type="button" data-research-play @click="openSheet('play')">この局面から<br>対局</button>
            <button type="button" @click="openSheet('io')">読み込み・<br>書き出し</button>
          </div>
        </div>

        <!-- スマホの棋譜のタブ -->
        <div v-if="!wide && !editing && tab === 'kifu'" class="shogi-research__phone-kifu">
          <ol ref="kifuListEl" class="shogi-research__kifu" data-research-kifu>
            <li :class="{ 'is-current': ply === 0 }"><button type="button" @click="goTo(0)"><span class="n">0</span><span>開始局面</span><span class="s" /><span class="b" /></button></li>
            <li v-for="entry in line" :key="entry.path.join('.')" :class="{ 'is-current': entry.ply === ply, 'is-after': entry.ply > ply }">
              <button type="button" @click="goTo(entry.ply)">
                <span class="n num">{{ entry.ply }}</span><span>{{ entry.label }}</span><span class="s num">{{ scoreCell(entry.score) }}</span><span class="b">{{ entry.branches > 1 ? "+" : "" }}</span>
              </button>
            </li>
          </ol>
          <div class="shogi-research__branches" data-research-branches>
            <h2>次の手（{{ ply + 1 }}手目）</h2>
            <p v-if="!nextBranches.length" class="shogi-research__muted">盤で指すと、ここに並びます。</p>
            <div v-for="branch in nextBranches" :key="branch.index" class="shogi-research__branch">
              <button type="button" :class="{ on: branch.selected }" @click="chooseNext(branch.index)">{{ branch.label }} <small>{{ branch.main ? "本譜" : `分岐・${branch.length}手` }}</small></button>
              <button type="button" class="shogi-research__branch-more" :aria-label="`${branch.label}の操作`" @click="branchMenu = branchMenu === branch.index ? -1 : branch.index">…</button>
              <div v-if="branchMenu === branch.index" class="shogi-research__branch-menu">
                <button v-if="!branch.main" type="button" @click="promote(branch.index)">本譜にする</button>
                <button type="button" @click="removeNext(branch.index)">この分岐を消す</button>
              </div>
            </div>
          </div>
        </div>

        <!-- スマホのグラフのタブ -->
        <div v-if="!wide && !editing && tab === 'graph'" class="shogi-research__phone-graph">
          <div class="shogi-research__graph-head">
            <h2>評価値</h2>
            <span v-if="kifuAnalysis.running" class="shogi-research__progress"><i><b :style="{ width: `${kifuAnalysis.percent}%` }" /></i> <span class="num">{{ kifuAnalysis.done }}/{{ kifuAnalysis.total }}</span></span>
            <button type="button" class="shogi-research__small" data-research-analyze @click="toggleKifuAnalysis">{{ kifuAnalysis.running ? "止める" : "棋譜解析" }}</button>
          </div>
          <EvaluationGraph :points="graphPoints" :current-ply="ply" :total-ply="Math.max(1, line.length)" @select="goTo" />
        </div>

        <!-- 局面編集の道具 -->
        <div v-if="editing" class="shogi-research__edit" data-research-edit-tools>
          <div class="shogi-research__edit-scroll">
          <h2>駒箱 <small>（盤と持ち駒にない駒）</small></h2>
          <div class="shogi-research__piece-box">
            <button
              v-for="type in BOX_ORDER"
              :key="type"
              type="button"
              :class="{ 'is-picked': boxPick?.type === type }"
              :disabled="!box[type]"
              :aria-label="`駒箱の${PIECE_NAMES[type]}（${box[type]}枚）`"
              :data-research-box="type"
              @click="pickBox(type)"
            >
              <img :src="pieceImageUrl(type, placeSide)" alt="">
              <b v-if="box[type] > 1" class="num">{{ box[type] }}</b>
            </button>
          </div>
          <div class="shogi-research__setting">
            <span>置く駒</span>
            <span class="shogi-research__switch">
              <button type="button" :class="{ on: placeSide === 'black' }" @click="setPlaceSide('black')">▲先手</button>
              <button type="button" :class="{ on: placeSide === 'white' }" @click="setPlaceSide('white')">△後手</button>
            </span>
          </div>
          <div v-if="boxPick" class="shogi-research__picked">
            {{ placeSide === "black" ? "▲" : "△" }}{{ PIECE_NAMES[boxPick.type] }}を置くマスを押してね
            <div v-if="boxPick.type !== 'king'">
              <button type="button" @click="boxToHandNow('black')">▲の持ち駒へ</button>
              <button type="button" @click="boxToHandNow('white')">△の持ち駒へ</button>
              <button type="button" @click="boxPick = null">やめる</button>
            </div>
          </div>
          <div v-else-if="pickedInfo" class="shogi-research__picked" data-research-picked>
            {{ pickedInfo.text }}を選んでいます
            <div>
              <button v-if="pickedInfo.square && pickedInfo.promotable" type="button" @click="editPicked('promote')">{{ pickedInfo.promoted ? "戻す" : "成る" }}</button>
              <button v-if="pickedInfo.square" type="button" @click="editPicked('color')">向きを変える</button>
              <button type="button" data-research-to-box @click="editPicked('box')">駒箱へ</button>
            </div>
          </div>
          <h2>はじめの形</h2>
          <div class="shogi-research__chips">
            <button v-for="preset in EDIT_PRESETS" :key="preset.id" type="button" :data-research-preset="preset.id" @click="applyPreset(preset.sfen)">{{ preset.label }}</button>
            <button type="button" :class="{ on: handicapOpen }" @click="handicapOpen = !handicapOpen">駒落ち…</button>
          </div>
          <div v-if="handicapOpen" class="shogi-research__chips">
            <button v-for="preset in HANDICAP_PRESETS" :key="preset.id" type="button" @click="applyPreset(preset.sfen); handicapOpen = false">{{ preset.label }}</button>
          </div>
          <h2>手番</h2>
          <div class="shogi-research__chips">
            <button type="button" :class="{ on: editTurn === 'black' }" @click="setEditTurn('black')">▲先手番</button>
            <button type="button" :class="{ on: editTurn === 'white' }" @click="setEditTurn('white')">△後手番</button>
          </div>
          </div>
          <div class="shogi-research__edit-foot">
            <div class="shogi-research__hime" :class="{ 'is-ng': editCheck.problems.length }">
              <img :src="himeUrl" alt="" aria-hidden="true">
              <p data-research-edit-message>{{ editMessage }}</p>
            </div>
            <div class="shogi-research__actions shogi-research__actions--two">
              <button type="button" @click="cancelEdit">編集をやめる</button>
              <button type="button" class="is-primary" :disabled="editCheck.problems.length > 0" data-research-edit-done @click="finishEdit">完了</button>
            </div>
          </div>
        </div>

        <!-- スマホの下の操作の帯 -->
        <div v-if="!wide && !editing" class="shogi-research__bar">
          <button type="button" class="shogi-research__go" :class="{ 'is-running': engineRunning }" @click="toggleAnalyzing"><span v-if="engineRunning" class="pulse" aria-hidden="true" />{{ engineRunning ? "止める" : "読む" }}</button>
          <button type="button" data-research-edit @click="startEdit">局面編集</button>
          <button type="button" data-research-play @click="openSheet('play')">対局</button>
          <button type="button" aria-label="その他" @click="openSheet('more')">…</button>
        </div>
      </section>
    </div>

    <!-- 消した分岐をもとに戻す帯(5秒)。 -->
    <div v-if="undoRemove" class="shogi-research__toast" role="status">
      分岐を消しました <button type="button" data-research-undo @click="restoreRemoved">もとに戻す</button>
    </div>

    <!-- シート(読む長さ・この局面から対局・研究帳・読み込みと書き出し・その他)。 -->
    <div v-if="sheet" class="shogi-research__veil" @click.self="sheet = ''">
      <div class="shogi-research__sheet" role="dialog" aria-modal="true" :aria-label="sheetTitle" :data-research-sheet="sheet">
        <h2>{{ sheetTitle }}</h2>

        <template v-if="sheet === 'limit'">
          <div v-for="group in limitGroups" :key="group.name" class="shogi-research__sheet-group">
            <h3>{{ group.name }}</h3>
            <div class="shogi-research__chips shogi-research__chips--paper">
              <button v-for="item in group.items" :key="item.id" type="button" :class="{ on: settings.limit === item.id }" @click="setSetting('limit', item.id); sheet = ''">{{ item.label }}</button>
            </div>
          </div>
        </template>

        <template v-else-if="sheet === 'play'">
          <div class="shogi-research__sheet-row">
            <span>持つ側</span>
            <span class="shogi-research__seg">
              <button type="button" :class="{ on: playSide === 'black' }" @click="playSide = 'black'">▲先手</button>
              <button type="button" :class="{ on: playSide === 'white' }" @click="playSide = 'white'">△後手</button>
            </span>
          </div>
          <div class="shogi-research__sheet-row">
            <span>相手の強さ</span>
            <span class="shogi-research__stepper shogi-research__stepper--paper">
              <button type="button" aria-label="弱くする" :disabled="playStrengthIndex <= 0" @click="playStrengthIndex -= 1">−</button>
              <em data-research-play-strength>{{ strengthOptions[playStrengthIndex]?.label ?? "" }}</em>
              <button type="button" aria-label="強くする" :disabled="playStrengthIndex >= strengthOptions.length - 1" @click="playStrengthIndex += 1">＋</button>
            </span>
          </div>
          <p class="shogi-research__sheet-note">閃き・待ったは何回でも使えるよ。記録には数えない。指した手は研究の棋譜に分岐で入る。</p>
          <p v-if="!engineReadyPosition" class="shogi-research__sheet-note is-ng">玉が片方にしかない局面では対局できないよ。局面編集で玉を置いてね。</p>
          <div class="shogi-research__sheet-actions">
            <button type="button" @click="sheet = ''">やめる</button>
            <button type="button" class="is-primary" :disabled="!engineReadyPosition" data-research-play-start @click="startMatch">対局開始</button>
          </div>
        </template>

        <template v-else-if="sheet === 'book'">
          <button type="button" class="shogi-research__sheet-wide" data-research-new @click="newResearch">＋ 新しい研究（平手）</button>
          <ul class="shogi-research__book" data-research-book-list>
            <li v-for="item in book.items" :key="item.id" :class="{ 'is-current': item.id === research.id }">
              <template v-if="confirmDropId === item.id">
                <span>「{{ researchTitle(item) }}」を研究帳から消す？</span>
                <span class="shogi-research__book-actions">
                  <button ref="dropCancelEl" type="button" @click="confirmDropId = ''">やめる</button>
                  <button type="button" class="is-danger" @click="dropItem(item.id)">消す</button>
                </span>
              </template>
              <template v-else>
                <button type="button" class="shogi-research__book-open" @click="openItem(item.id)">
                  <b>{{ researchTitle(item) }}</b>
                  <small>{{ formatDate(item.updatedAt) }}・{{ lineLengthOf(item) }}手</small>
                </button>
                <button type="button" class="shogi-research__book-drop" :aria-label="`${researchTitle(item)}を消す`" @click="askDrop(item.id)">消す</button>
              </template>
            </li>
          </ul>
        </template>

        <template v-else-if="sheet === 'io'">
          <textarea v-model="ioText" class="shogi-research__io" rows="6" placeholder="KIF・KI2・CSA・SFEN・USIの文字を貼り付け" data-research-io />
          <p v-if="ioMessage" class="shogi-research__sheet-note" :class="{ 'is-ng': ioError }">{{ ioMessage }}</p>
          <div class="shogi-research__sheet-actions shogi-research__sheet-actions--wrap">
            <button type="button" class="is-primary" :disabled="!ioText.trim()" data-research-import @click="importText">読み込む</button>
            <button type="button" @click="exportText('kif')">棋譜をコピー（KIF）</button>
            <button type="button" @click="exportText('sfen')">局面をコピー（SFEN）</button>
          </div>
        </template>

        <template v-else-if="sheet === 'more'">
          <div class="shogi-research__sheet-actions shogi-research__sheet-actions--column">
            <button type="button" @click="sheet = ''; tab = 'graph'; toggleKifuAnalysis()">{{ kifuAnalysis.running ? "棋譜解析を止める" : "棋譜解析" }}</button>
            <button type="button" @click="openSheet('io')">読み込み・書き出し</button>
            <button type="button" @click="setSetting('display', settings.display === 'rate' ? 'score' : 'rate')">表示: {{ settings.display === "rate" ? "勝率 → 評価値にする" : "評価値 → 勝率にする" }}</button>
            <button type="button" @click="setSetting('arrows', !settings.arrows)">矢印: {{ settings.arrows ? "あり → なしにする" : "なし → ありにする" }}</button>
          </div>
        </template>

        <button type="button" class="shogi-research__sheet-close" aria-label="閉じる" @click="sheet = ''">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type PropType } from "vue";
import ShogiMatchBoard from "./ShogiMatchBoard.vue";
import EvaluationGraph from "./EvaluationGraph.vue";
import type { ShogiEngine } from "./core/engine.js";
import { useResearchEngine } from "./composables/useResearchEngine";
import {
  type EngineFactory,
  analysisEngineCount,
  createExtraEngines,
  engineLane,
  releaseEngines,
} from "./composables/match/analysisEngines";
import {
  MULTI_PV_MAX,
  MULTI_PV_MIN,
  STANDARD_SFEN,
  THINK_LIMITS,
  activeLine,
  applyUsi,
  branchesAt,
  chooseBranch,
  createResearch,
  dropResearch,
  exportResearchKif,
  goToPly,
  importResearch,
  loadResearchBook,
  loadResearchSettings,
  nodeAt,
  playLine,
  playMove,
  promoteBranch,
  putResearch,
  pvLabels,
  recordScore,
  removeBranch,
  researchTitle,
  restoreBranch,
  saveResearchBook,
  saveResearchSettings,
  sfenAt,
  sideOf,
} from "./core/research-record.mjs";
import { blackRateOf, candidateArrows, candidateRows, himeLine, scoreText, statsText, verdictText } from "./core/research-analysis.mjs";
import {
  BOX_ORDER,
  EDIT_PRESETS,
  HANDICAP_PRESETS,
  PIECE_NAMES,
  applyBoardEdit,
  boardToBox,
  boxToHand,
  handToBox,
  pieceAt,
  pieceBox,
  pieceTotals,
  placeFromBox,
  setTurn,
  toggleColor,
  togglePromote,
  validateEditedPosition,
  withPlyOne,
} from "./core/position-editor.mjs";
import { findMateLine } from "./core/problem-solver";
import { analysisPointsFromResults, analyzeKifuStaged } from "./core/kifu-analysis-pipeline.mjs";
import { kifuAnalysisPlan } from "./core/reference-kifu-analysis.mjs";
import { scoreToGraphValue, formatAnalysisScore } from "./core/kifu-analysis.mjs";

type Research = ReturnType<typeof createResearch>;
type Row = ReturnType<typeof candidateRows>[number];
type LineEntry = ReturnType<typeof activeLine>[number];
type Score = { type: "cp" | "mate"; value: number };
type Mark = { kind: "blunder" | "mistake" | "dubious" | "good" | "brilliant"; label: string; mover: "black" | "white" };

const props = defineProps({
  assetBaseUrl: { type: String, default: "." },
  /** 検討に使うエンジンを借りる(対局用のエンジン。docs/research-mode-design.mdの2章の5)。 */
  acquireEngine: { type: Function as PropType<() => Promise<ShogiEngine>>, required: true },
  /** 借りたエンジンを返す。 */
  releaseEngine: { type: Function as PropType<(engine: ShogiEngine) => void>, default: null },
  /** 棋譜解析で追加するエンジンの作り方。 */
  engineFactory: { type: Function as PropType<() => Promise<EngineFactory | null>>, default: null },
  /** 開く研究(対局後の検討の「研究で開く」)。なければ前の研究。 */
  openRequest: { type: Object as PropType<{ sfen: string; moves: string[]; ply: number; name?: string } | null>, default: null },
  /** この局面から対局で指した手(分岐で研究に戻す)。 */
  matchReturn: { type: Object as PropType<{ researchId: string; path: number[]; moves: string[] } | null>, default: null },
  /** この局面から対局の相手の強さの選択肢と、はじめの値。 */
  strengthOptions: { type: Array as PropType<{ value: number; label: string }[]>, default: () => [] },
  strengthValue: { type: Number, default: 0 },
});
const emit = defineEmits<{
  close: [];
  "start-match": [request: { sfen: string; playerColor: "black" | "white"; strength: number; researchId: string; path: number[] }];
}>();

const TABS = [
  { id: "study", label: "検討" },
  { id: "kifu", label: "棋譜" },
  { id: "graph", label: "グラフ" },
] as const;

const storage = typeof localStorage === "undefined" ? null : localStorage;
const rootEl = ref<HTMLElement | null>(null);
const kifuListEl = ref<HTMLElement | null>(null);
const himeUrl = computed(() => `${props.assetBaseUrl}/characters/yakobihime-mini.webp?v=4`);

// ---- 画面の大きさ(PCの3列か、スマホの縦積みか)
const wide = ref(false);
// 横向きのスマホ(幅が900pxに届かない横長)は、盤を左、検討の欄を右に並べる(縦に積むと盤が小さくなりすぎる)。
const landscape = ref(false);
let resizeObserver: ResizeObserver | null = null;
function measure() {
  const el = rootEl.value;
  if (!el) return;
  const { width, height } = el.getBoundingClientRect();
  wide.value = width >= 900 && width > height * 1.05;
  landscape.value = !wide.value && width > height * 1.2;
}

// ---- 研究帳と、いまの研究
const book = ref(loadResearchBook(storage));
const research = ref<Research>(pickInitialResearch());
const settings = ref(loadResearchSettings(storage));
const tab = ref<"study" | "kifu" | "graph">("study");

function pickInitialResearch(): Research {
  const items = book.value.items as Research[];
  if (props.matchReturn) {
    const found = items.find(({ id }) => id === props.matchReturn!.researchId);
    if (found) {
      found.path = [...props.matchReturn.path];
      if (nodeAt(found, found.path)) playLine(found, props.matchReturn.moves);
      else found.path = [];
      return found;
    }
  }
  if (props.openRequest) {
    const created = createResearch({ sfen: props.openRequest.sfen, moves: props.openRequest.moves, name: props.openRequest.name ?? "" });
    goToPly(created, props.openRequest.ply);
    return created;
  }
  return items.find(({ id }) => id === book.value.current) ?? createResearch();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveSoon() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}
function saveNow() {
  saveTimer = null;
  book.value = putResearch(book.value, research.value);
  saveResearchBook(storage, book.value);
}
watch(research, saveSoon, { deep: true });
watch(settings, (value) => saveResearchSettings(storage, value), { deep: true });

const title = computed(() => researchTitle(research.value));
const line = computed<LineEntry[]>(() => activeLine(research.value));
const ply = computed(() => research.value.path.length);
const currentSfen = computed(() => sfenAt(research.value));
const positionKey = computed(() => `${research.value.id}:${research.value.path.join(".")}`);
const previousUsi = computed(() => (ply.value > 0 ? line.value[ply.value - 1]?.usi ?? "" : ""));
const rootScore = computed(() => (research.value.root as { score?: Score }).score);
const nextBranches = computed(() => branchesAt(research.value, ply.value + 1));
const branchMenu = ref(-1);

function goTo(target: number) {
  preview.value = null;
  branchMenu.value = -1;
  goToPly(research.value, target);
}
function step(delta: number) {
  goTo(ply.value + delta);
}
function chooseNext(index: number) {
  branchMenu.value = -1;
  preview.value = null;
  chooseBranch(research.value, ply.value + 1, index);
}
function promote(index: number) {
  branchMenu.value = -1;
  promoteBranch(research.value, ply.value + 1, index);
}
const undoRemove = shallowRef<ReturnType<typeof removeBranch>>(null);
let undoTimer: ReturnType<typeof setTimeout> | null = null;
function removeNext(index: number) {
  branchMenu.value = -1;
  const undo = removeBranch(research.value, ply.value + 1, index);
  if (!undo) return;
  undoRemove.value = undo;
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { undoRemove.value = null; }, 5000);
}
function restoreRemoved() {
  if (undoRemove.value) restoreBranch(research.value, undoRemove.value);
  undoRemove.value = null;
}
function onBoardMove(usi: string) {
  preview.value = null;
  playMove(research.value, usi);
}

const moveCaption = computed(() => (ply.value === 0 ? "開始局面" : `${ply.value}手目 ${line.value[ply.value - 1]?.label ?? ""}`));
const moveSub = computed(() => {
  const side = sideOf(currentSfen.value) === "black" ? "▲先手" : "△後手";
  return `次は ${side}の番${nextBranches.value.length > 1 ? " ・ 分岐あり" : ""}`;
});

function markOf(entry: LineEntry): Mark | null {
  const node = nodeAt(research.value, entry.path) as { mark?: Mark | null } | null;
  return node?.mark ?? null;
}
function scoreCell(score?: Score | null) {
  return score ? scoreText(score) : "";
}

// ---- 局面編集のあいだか(検討を止めるため、ここで先に作る)
const editing = ref(false);
const editSfen = ref("");

// ---- 検討(エンジンで読む)
const analyzing = ref(true);
const engine = useResearchEngine({
  acquire: async () => {
    const worker = await props.acquireEngine();
    // 検討は、端末のコアを使って読む(対局の強さには関係しない)。
    const cores = Number(globalThis.navigator?.hardwareConcurrency) || 2;
    try {
      await worker.setSearchThreads(Math.min(wide.value ? 4 : 2, Math.max(1, cores - 1)));
    } catch {
      // スレッドを増やせなくても1本で読む。
    }
    return worker;
  },
  release: (worker) => {
    void worker.setSearchThreads(1).catch(() => undefined);
    props.releaseEngine?.(worker);
  },
});
const engineCheck = computed(() => validateEditedPosition(currentSfen.value));
const engineReadyPosition = computed(() => engineCheck.value.engineReady);
const engineRunning = computed(() => engine.running.value || mateSearching.value);
const limit = computed(() => THINK_LIMITS.find(({ id }) => id === settings.value.limit) ?? THINK_LIMITS[0]);
const limitLabel = computed(() => limit.value.label);
const limitGroups = computed(() => {
  const groups: { name: string; items: typeof THINK_LIMITS[number][] }[] = [];
  for (const item of THINK_LIMITS) {
    const group = groups.find(({ name }) => name === item.group);
    if (group) group.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }
  return groups;
});

function positionCommand(target: Research) {
  const moves = activeLine(target).slice(0, target.path.length).map(({ usi }) => usi);
  const base = target.sfen === STANDARD_SFEN ? "startpos" : target.sfen;
  return moves.length ? `${base} moves ${moves.join(" ")}` : base;
}

// 片方の玉しかない局面は、エンジンではなく詰み探索で読む(3-3)。
const mateSearching = ref(false);
const mateRows = shallowRef<Row[]>([]);
let mateTimer: ReturnType<typeof setTimeout> | null = null;
function startMateSearch(sfen: string, key: string) {
  stopMateSearch();
  mateSearching.value = true;
  let plies = 1;
  const runStep = () => {
    mateTimer = null;
    if (positionKey.value !== key) return stopMateSearch();
    const found = findMateLine(sfen, plies, { nodeLimit: 300000, maxTimeMs: 900 });
    if (found && found.length) {
      mateRows.value = candidateRows(sfen, [{ rank: 1, move: found[0], pv: found, score: { type: "mate", value: sideOf(sfen) === "black" ? found.length : -found.length } }]).map((row) => ({ ...row, score: { type: "mate", value: sideOf(sfen) === "black" ? found.length : -found.length } }));
      mateSearching.value = false;
      return;
    }
    if (found === undefined || plies >= 15) {
      mateSearching.value = false;
      return;
    }
    plies += 2;
    mateTimer = setTimeout(runStep, 30);
  };
  mateTimer = setTimeout(runStep, 30);
}
function stopMateSearch() {
  if (mateTimer) clearTimeout(mateTimer);
  mateTimer = null;
  mateSearching.value = false;
}

const kifuAnalysisBlocksEngine = ref(false);
function refreshAnalysis() {
  mateRows.value = [];
  if (!analyzing.value || editing.value || kifuAnalysisBlocksEngine.value) {
    void engine.stop();
    stopMateSearch();
    return;
  }
  if (!engineReadyPosition.value) {
    void engine.stop();
    if (engineCheck.value.kings.black + engineCheck.value.kings.white === 1) startMateSearch(currentSfen.value, positionKey.value);
    return;
  }
  stopMateSearch();
  void engine.start(positionCommand(research.value), positionKey.value, { multiPv: settings.value.multiPv, go: { ...limit.value.go } });
}
watch(
  () => [positionKey.value, settings.value.multiPv, settings.value.limit, editing.value, analyzing.value, kifuAnalysisBlocksEngine.value],
  refreshAnalysis,
);

function toggleAnalyzing() {
  // 読む長さを決めて読み終えたあとの「読む」は、同じ局面を読み直す。
  if (!engineRunning.value) {
    analyzing.value = true;
    refreshAnalysis();
    return;
  }
  analyzing.value = false;
  void engine.stop();
  stopMateSearch();
}

const rows = computed<Row[]>(() => {
  if (!engineReadyPosition.value) return mateRows.value;
  if (engine.searchedKey.value !== positionKey.value) return [];
  return candidateRows(currentSfen.value, engine.candidates.value, { limit: settings.value.multiPv, previousUsi: previousUsi.value });
});
const bestScore = computed(() => rows.value[0]?.score ?? null);
const statsLines = computed(() => (engineReadyPosition.value
  ? statsText(engine.stats.value)
  : { main: engineCheck.value.kings.black + engineCheck.value.kings.white === 1 ? "玉が1枚の局面は詰みを探します" : "玉を置くと読めます", sub: "" }));
const statusText = computed(() => {
  if (engine.error.value) return "将棋AIを使えません";
  if (mateSearching.value) return "詰みを探しています";
  if (engine.running.value) return "読んでいます";
  if (rows.value.length) return `止めました（深さ${engine.stats.value.depth ?? "—"}）`;
  return "止まっています";
});
const emptyRowsText = computed(() => {
  if (engine.error.value) return `将棋AIを起動できませんでした（${engine.error.value}）`;
  if (!engineReadyPosition.value && !mateSearching.value && engineCheck.value.kings.black + engineCheck.value.kings.white === 1) return "詰みは見つかりませんでした。";
  if (!analyzing.value) return "「読む」を押すと、候補が並びます。";
  return "読んでいます…";
});
const settled = computed(() => (engine.stats.value.depth ?? 0) >= 12 || !engine.running.value);
const hime = computed(() => {
  if (engine.error.value) return { text: "将棋AIが起動できなかったよ。もう一度開き直してみてね。", tone: "normal" };
  if (!engineReadyPosition.value && !rows.value.length) return { text: mateSearching.value ? "詰みを探しているよ。" : "この局面は、玉を置くと読めるよ。", tone: "normal" };
  return himeLine(rows.value, { settled: settled.value });
});
const blackRate = computed(() => blackRateOf(bestScore.value) ?? 50);
const verdict = computed(() => (bestScore.value ? verdictText(bestScore.value) : ""));
const rateLabel = computed(() => (bestScore.value
  ? { black: `${Math.round(blackRate.value)}%`, white: `${Math.round(100 - blackRate.value)}%` }
  : { black: "—", white: "—" }));

// 深さ12以上まで読めた評価値を、その局面の評価値として棋譜とグラフに残す(3-7の1)。
watch([rows, () => engine.stats.value.depth], () => {
  const best = rows.value[0];
  const depth = engine.stats.value.depth ?? 0;
  if (!best?.score || depth < 12 || engine.searchedKey.value !== positionKey.value) return;
  recordScore(research.value, research.value.path, best.score, depth);
});

// ---- 盤
const preview = shallowRef<{ row: Row; step: number } | null>(null);
function openPreview(row: Row) {
  if (preview.value?.row.rank === row.rank) {
    preview.value = null;
    return;
  }
  preview.value = { row, step: 1 };
}
function previewStep(delta: number) {
  if (!preview.value) return;
  preview.value = { ...preview.value, step: Math.max(0, Math.min(preview.value.row.pv.length, preview.value.step + delta)) };
}
const previewSfen = computed(() => {
  if (!preview.value) return "";
  let sfen = currentSfen.value;
  for (const usi of preview.value.row.pv.slice(0, preview.value.step)) sfen = applyUsi(sfen, usi) ?? sfen;
  return sfen;
});
const previewLabel = computed(() => {
  if (!preview.value || preview.value.step === 0) return "";
  return pvLabels(currentSfen.value, preview.value.row.pv.slice(0, preview.value.step), { previousUsi: previousUsi.value }).at(-1) ?? "";
});
function addPreviewLine() {
  if (!preview.value) return;
  const moves = preview.value.row.pv.slice(0, Math.max(1, preview.value.step));
  preview.value = null;
  playLine(research.value, moves);
}

const boardSfen = computed(() => (editing.value ? editSfen.value : preview.value ? previewSfen.value : currentSfen.value));
const boardLastMove = computed(() => {
  if (editing.value) return "";
  if (preview.value) return preview.value.step > 0 ? preview.value.row.pv[preview.value.step - 1] : previousUsi.value;
  return previousUsi.value;
});
const boardArrows = computed(() => (editing.value || preview.value || !settings.value.arrows
  ? []
  : candidateArrows(rows.value).map(({ usi, rank }) => ({ usi, rank, guideKind: "ai" as const }))));

// ---- 局面編集(3-5)
const boxPick = shallowRef<{ type: string } | null>(null);
const picked = shallowRef<{ square?: string; hand?: "black" | "white"; type?: string } | null>(null);
const placeSide = ref<"black" | "white">("black");
const handicapOpen = ref(false);
const box = computed(() => (editing.value ? pieceBox(editSfen.value) : {}) as Record<string, number>);
const totals = computed(() => (editing.value ? pieceTotals(editSfen.value) : { box: 0, placed: 40 }));
const editTurn = computed(() => sideOf(editSfen.value));
const editCheck = computed(() => (editing.value ? validateEditedPosition(editSfen.value) : { problems: [], engineReady: true, kings: { black: 1, white: 1 } }));
const editProblemSquares = computed(() => (editing.value ? editCheck.value.problems.flatMap(({ squares }) => squares) : []));
const editMessage = computed(() => {
  const problem = editCheck.value.problems[0];
  if (problem) return problem.message;
  if (!editCheck.value.engineReady) return "玉が片方だけの局面は、詰みを探して読むよ。完了を押してね。";
  return "置けたら「完了」を押してね。この局面から読み始めるよ。";
});
const boardMarks = computed(() => {
  if (!editing.value || !boxPick.value) return [];
  const marks: { file: number; rank: number; tone: "reach" }[] = [];
  for (let file = 1; file <= 9; file += 1) {
    for (let rank = 1; rank <= 9; rank += 1) {
      const square = `${file}${String.fromCharCode(96 + rank)}`;
      if (!pieceAt(editSfen.value, square)) marks.push({ file, rank, tone: "reach" });
    }
  }
  return marks;
});
const pickedInfo = computed(() => {
  const value = picked.value;
  if (!value || !editing.value) return null;
  if (value.square) {
    const piece = pieceAt(editSfen.value, value.square);
    if (!piece) return null;
    const file = value.square[0];
    const rank = "一二三四五六七八九"[value.square.charCodeAt(1) - 97];
    return {
      square: value.square,
      text: `${piece.side === "black" ? "▲" : "△"}${piece.name}（${file}${rank}）`,
      promotable: piece.promotable,
      promoted: ["promPawn", "promLance", "promKnight", "promSilver", "horse", "dragon"].includes(piece.type),
    };
  }
  if (value.hand && value.type) return { square: "", text: `${value.hand === "black" ? "▲" : "△"}の持ち駒の${PIECE_NAMES[value.type as keyof typeof PIECE_NAMES] ?? ""}`, promotable: false, promoted: false };
  return null;
});

function startEdit() {
  sheet.value = "";
  preview.value = null;
  editSfen.value = withPlyOne(currentSfen.value);
  editing.value = true;
  boxPick.value = null;
  picked.value = null;
  placeSide.value = "black";
}
function cancelEdit() {
  editing.value = false;
  boxPick.value = null;
  picked.value = null;
}
function finishEdit() {
  if (editCheck.value.problems.length) return;
  saveNow();
  research.value = createResearch({ sfen: withPlyOne(editSfen.value) });
  editing.value = false;
  boxPick.value = null;
  picked.value = null;
  saveNow();
}
function applyPreset(sfen: string) {
  editSfen.value = sfen;
  boxPick.value = null;
  picked.value = null;
}
function setEditTurn(side: "black" | "white") {
  editSfen.value = setTurn(editSfen.value, side);
}
function setPlaceSide(side: "black" | "white") {
  placeSide.value = side;
}
function pickBox(type: string) {
  picked.value = null;
  boxPick.value = boxPick.value?.type === type ? null : { type };
}
function boxToHandNow(side: "black" | "white") {
  if (!boxPick.value) return;
  const next = boxToHand(editSfen.value, boxPick.value.type, side);
  if (next) editSfen.value = next;
  if (!pieceBox(editSfen.value)[boxPick.value.type]) boxPick.value = null;
}
function onSquareClick(square: string) {
  if (!editing.value) return;
  if (boxPick.value) {
    const next = placeFromBox(editSfen.value, boxPick.value.type, placeSide.value, square);
    if (next) editSfen.value = next;
    if (!pieceBox(editSfen.value)[boxPick.value.type]) boxPick.value = null;
    picked.value = null;
    return;
  }
  picked.value = pieceAt(editSfen.value, square) ? { square } : null;
}
function onHandClick(side: "black" | "white", type: string) {
  if (!editing.value || boxPick.value) return;
  picked.value = { hand: side, type };
}
function onBoardEdit(change: { move?: { from: unknown; to: unknown }; rotate?: unknown }) {
  if (!editing.value) return;
  const next = applyBoardEdit(editSfen.value, change as Parameters<typeof applyBoardEdit>[1]);
  if (!next) return;
  editSfen.value = next;
  const to = change.move?.to as { usi?: string } | undefined;
  picked.value = to && typeof to.usi === "string" ? { square: to.usi } : null;
}
function editPicked(action: "promote" | "color" | "box") {
  const value = picked.value;
  if (!value) return;
  let next: string | null = null;
  if (value.square) {
    if (action === "promote") next = togglePromote(editSfen.value, value.square);
    if (action === "color") next = toggleColor(editSfen.value, value.square);
    if (action === "box") next = boardToBox(editSfen.value, value.square);
  } else if (value.hand && value.type && action === "box") {
    next = handToBox(editSfen.value, value.type, value.hand);
  }
  if (next) editSfen.value = next;
  if (action === "box") picked.value = null;
}
function pieceImageUrl(type: string, side: "black" | "white") {
  const name = type === "king" ? (side === "black" ? "king2" : "king") : type;
  const theme = (storage?.getItem("shogi-match-piece-theme")) || "hitomoji_wood";
  return `${props.assetBaseUrl.replace(/\/$/, "")}/piece/${theme}/${side}_${name}.webp`;
}

// ---- 評価値のグラフと棋譜解析(3-7)
const graphPoints = computed(() => {
  const points = [];
  const root = research.value.root as { score?: Score };
  if (root.score) points.push({ ply: 0, graphValue: scoreToGraphValue(root.score) ?? 0, label: "開始局面", scoreLabel: formatAnalysisScore(root.score), score: root.score, annotation: null });
  for (const entry of line.value) {
    if (!entry.score) continue;
    const mark = markOf(entry);
    points.push({
      ply: entry.ply,
      graphValue: scoreToGraphValue(entry.score) ?? 0,
      label: `${entry.ply}手目 ${entry.label}`,
      scoreLabel: formatAnalysisScore(entry.score),
      score: entry.score,
      annotation: mark,
    });
  }
  return points;
});

const kifuAnalysis = ref({ running: false, done: 0, total: 0, percent: 0 });
let kifuCancelled = false;
let kifuEngines: ShogiEngine[] = [];
async function toggleKifuAnalysis() {
  if (kifuAnalysis.value.running) {
    kifuCancelled = true;
    return;
  }
  const steps = [{ sfen: research.value.sfen, lastMove: "", label: "" }];
  const entries = line.value;
  for (const entry of entries) {
    const after = applyUsi(entry.sfenBefore, entry.usi);
    if (!after) break;
    steps.push({ sfen: after, lastMove: entry.usi, label: entry.label });
  }
  if (steps.length < 2) return;
  kifuCancelled = false;
  kifuAnalysis.value = { running: true, done: 0, total: steps.length, percent: 0 };
  const compact = !wide.value;
  try {
    const factory = props.engineFactory ? await props.engineFactory() : null;
    kifuEngines = await createExtraEngines(factory, Math.max(0, analysisEngineCount(compact) - 1));
    let lanes;
    if (kifuEngines.length) {
      lanes = kifuEngines.map((laneEngine) => engineLane(laneEngine, (sfen) => sfen));
    } else {
      // 追加のエンジンを起動できない端末は、検討を止めて対局用のエンジンで読み、終わったら検討に戻る。
      kifuAnalysisBlocksEngine.value = true;
      await engine.stop();
      const main = await props.acquireEngine();
      lanes = [engineLane(main, (sfen) => sfen)];
    }
    const paths = [[], ...entries.map(({ path }) => path)];
    await analyzeKifuStaged({
      steps,
      lanes,
      plan: kifuAnalysisPlan(settings.value.analysisLevel, compact),
      results: [],
      isCancelled: () => kifuCancelled,
      onProgress: ({ done, total }: { done: number; total: number }) => {
        kifuAnalysis.value = { running: true, done, total, percent: total ? Math.round((done / total) * 100) : 0 };
      },
      onResults: (results: unknown[], contexts: unknown[]) => {
        const points = analysisPointsFromResults(steps, results, contexts);
        for (const point of points) {
          const node = nodeAt(research.value, paths[point.ply]) as { score?: Score; depth?: number; mark?: Mark | null } | null;
          if (!node || !point.score) continue;
          node.score = { type: point.score.type, value: point.score.value } as Score;
          node.depth = Math.max(node.depth ?? 0, 16);
          node.mark = (point.annotation as Mark | null) ?? null;
        }
      },
    });
  } catch {
    // 解析できなかった局面は、検討の評価値のまま。
  } finally {
    releaseEngines(kifuEngines);
    kifuEngines = [];
    kifuAnalysis.value = { ...kifuAnalysis.value, running: false };
    kifuAnalysisBlocksEngine.value = false;
  }
}

// ---- シート
type SheetKind = "" | "limit" | "play" | "book" | "io" | "more";
const sheet = ref<SheetKind>("");
const SHEET_TITLES: Record<string, string> = { limit: "読む長さ", play: "この局面から対局", book: "研究帳", io: "読み込み・書き出し", more: "その他" };
const sheetTitle = computed(() => SHEET_TITLES[sheet.value] ?? "");
function openSheet(kind: SheetKind) {
  confirmDropId.value = "";
  ioMessage.value = "";
  if (kind === "play") playSide.value = sideOf(currentSfen.value);
  sheet.value = kind;
}
function setSetting<K extends "multiPv" | "limit" | "arrows" | "display">(key: K, value: (typeof settings.value)[K]) {
  settings.value = { ...settings.value, [key]: value };
}
function changeMultiPv(delta: number) {
  setSetting("multiPv", Math.max(MULTI_PV_MIN, Math.min(MULTI_PV_MAX, settings.value.multiPv + delta)));
}

// この局面から対局(3-6)
const playSide = ref<"black" | "white">("black");
const playStrengthIndex = ref(Math.max(0, props.strengthOptions.findIndex(({ value }) => value === props.strengthValue)));
async function startMatch() {
  if (!engineReadyPosition.value) return;
  saveNow();
  sheet.value = "";
  await engine.stop();
  emit("start-match", {
    sfen: currentSfen.value,
    playerColor: playSide.value,
    strength: props.strengthOptions[playStrengthIndex.value]?.value ?? props.strengthValue,
    researchId: research.value.id,
    path: [...research.value.path],
  });
}

// 研究帳(3-8)
const confirmDropId = ref("");
const dropCancelEl = ref<HTMLButtonElement[] | HTMLButtonElement | null>(null);
function askDrop(id: string) {
  confirmDropId.value = id;
  // 取り消せないので、はじめは「やめる」に合わせる(UD:5-2)。
  void nextTick(() => {
    const el = Array.isArray(dropCancelEl.value) ? dropCancelEl.value[0] : dropCancelEl.value;
    el?.focus();
  });
}
function dropItem(id: string) {
  confirmDropId.value = "";
  book.value = dropResearch(book.value, id);
  saveResearchBook(storage, book.value);
  if (research.value.id === id) {
    const next = (book.value.items as Research[])[0];
    research.value = next ?? createResearch();
  }
}
function openItem(id: string) {
  saveNow();
  const found = (book.value.items as Research[]).find((item) => item.id === id);
  if (found) research.value = found;
  sheet.value = "";
}
function newResearch() {
  saveNow();
  research.value = createResearch();
  sheet.value = "";
  saveNow();
}
function formatDate(time: number) {
  const date = new Date(time);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function lineLengthOf(item: Research) {
  return activeLine({ ...item, path: [] }).length;
}

// 読み込み・書き出し(3-8)
const ioText = ref("");
const ioMessage = ref("");
const ioError = ref(false);
function importText() {
  const result = importResearch(ioText.value);
  if (result instanceof Error) {
    ioError.value = true;
    ioMessage.value = `読み込めませんでした: ${result.message}`;
    return;
  }
  saveNow();
  research.value = result as Research;
  saveNow();
  ioText.value = "";
  ioError.value = false;
  ioMessage.value = "";
  sheet.value = "";
}
async function exportText(kind: "kif" | "sfen") {
  const text = kind === "kif" ? exportResearchKif(research.value) : `sfen ${currentSfen.value}`;
  ioText.value = text;
  ioError.value = false;
  try {
    await navigator.clipboard.writeText(text);
    ioMessage.value = kind === "kif" ? "棋譜をコピーしました。" : "局面をコピーしました。";
  } catch {
    ioMessage.value = "下の文字を選んでコピーしてね。";
  }
}

// ---- 戻る・キー操作
/** 戻る操作。重ねて開いたものから閉じる。閉じたらfalse。 */
function goBack() {
  if (sheet.value) {
    sheet.value = "";
    return true;
  }
  if (preview.value) {
    preview.value = null;
    return true;
  }
  if (editing.value) {
    cancelEdit();
    return true;
  }
  close();
  return false;
}
function close() {
  saveNow();
  emit("close");
}
function onKeydown(event: KeyboardEvent) {
  if (sheet.value || editing.value) return;
  const target = event.target as HTMLElement | null;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
  if (event.key === "ArrowLeft") step(-1);
  else if (event.key === "ArrowRight") step(1);
  else if (event.key === "Home") goTo(0);
  else if (event.key === "End") goTo(line.value.length);
  else return;
  event.preventDefault();
}

// いまの手を棋譜の一覧の見える位置に送る。
watch(ply, () => {
  void nextTick(() => kifuListEl.value?.querySelector(".is-current")?.scrollIntoView({ block: "nearest" }));
});

onMounted(() => {
  measure();
  resizeObserver = new ResizeObserver(measure);
  if (rootEl.value) resizeObserver.observe(rootEl.value);
  saveNow();
  refreshAnalysis();
  rootEl.value?.focus({ preventScroll: true });
  void nextTick(() => kifuListEl.value?.querySelector(".is-current")?.scrollIntoView({ block: "nearest" }));
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (saveTimer) saveNow();
  if (undoTimer) clearTimeout(undoTimer);
  stopMateSearch();
  kifuCancelled = true;
  releaseEngines(kifuEngines);
  void engine.dispose();
});

defineExpose({ goBack });
</script>

<style>
.shogi-game .shogi-research {
  --research-cand: #d8483a;
  --research-black: #3b6fd0;
  --research-white: #d0453b;
  outline: none;
}
.shogi-game .shogi-research .num { font-variant-numeric: tabular-nums; }
.shogi-game .shogi-research button { font: inherit; cursor: pointer; }
.shogi-game .shogi-research button:disabled { cursor: default; opacity: 0.45; }
.shogi-game .shogi-research__header h1 { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
.shogi-game .shogi-research__header h1 small { overflow: hidden; color: var(--muted, rgba(255, 252, 244, 0.72)); font-size: 0.72rem; letter-spacing: 0; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .shogi-research .shogi-research__head-button {
  margin-left: auto;
  min-height: 2.75rem;
  padding: 0 1rem;
  border: 2px solid rgba(255, 252, 244, 0.45);
  border-radius: 6px;
  color: #fffcf4;
  background: #2b465b;
  font-weight: 800;
}
.shogi-game .shogi-research__body {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.shogi-game .shogi-research--wide .shogi-research__body {
  grid-template-columns: minmax(250px, 290px) minmax(0, 1fr) minmax(290px, 330px);
  grid-template-rows: minmax(0, 1fr);
  gap: 10px;
  padding: 10px;
}
.shogi-game .shogi-research h2 { margin: 0; color: #f1a54c; font-size: 0.85rem; letter-spacing: 0.04em; }
.shogi-game .shogi-research__muted { margin: 0; color: rgba(255, 252, 244, 0.6); font-size: 0.8rem; }

/* 左の列 */
.shogi-game .shogi-research__left { display: grid; grid-template-rows: minmax(0, 1fr) auto 196px; gap: 8px; min-height: 0; }
.shogi-game .shogi-research__box { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 4px; min-height: 0; padding: 6px 0 0; border: 1px solid rgba(241, 165, 76, 0.5); border-left: 3px solid #f1a54c; background: rgba(23, 38, 50, 0.94); }
.shogi-game .shogi-research__box h2 { padding: 0 10px; text-align: center; }
.shogi-game .shogi-research__help p { margin: 0; padding: 4px 12px 12px; font-size: 0.85rem; line-height: 1.8; }
.shogi-game .shogi-research__kifu { margin: 0; padding: 0; overflow-y: auto; list-style: none; font-size: 0.9rem; }
.shogi-game .shogi-research__kifu li button {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto 14px;
  gap: 6px;
  align-items: center;
  width: 100%;
  min-height: 30px;
  padding: 2px 8px;
  border: 0;
  border-bottom: 1px solid rgba(255, 252, 244, 0.06);
  color: #fffcf4;
  background: transparent;
  text-align: left;
}
.shogi-game .shogi-research__kifu .n { color: rgba(255, 252, 244, 0.6); font-size: 0.75rem; text-align: right; }
.shogi-game .shogi-research__kifu .s { color: rgba(255, 252, 244, 0.6); font-size: 0.75rem; text-align: right; }
.shogi-game .shogi-research__kifu .b { color: #f1a54c; font-weight: 900; text-align: center; }
.shogi-game .shogi-research__kifu li.is-current button { background: rgba(241, 165, 76, 0.22); box-shadow: inset 0 0 0 1px #f1a54c; }
.shogi-game .shogi-research__kifu li.is-after button { opacity: 0.6; }
.shogi-game .shogi-research__kifu .mark { margin-left: 4px; padding: 0 4px; border-radius: 3px; font-size: 0.68rem; font-style: normal; font-weight: 900; }
.shogi-game .shogi-research__kifu .mark--blunder { background: #ff4b00; color: #fff; }
.shogi-game .shogi-research__kifu .mark--mistake { background: #f6aa00; color: #3a2800; }
.shogi-game .shogi-research__kifu .mark--dubious { background: #fff100; color: #3a3500; }
.shogi-game .shogi-research__kifu .mark--good { background: #03af7a; color: #fff; }
.shogi-game .shogi-research__kifu .mark--brilliant { background: #990099; color: #fff; }
.shogi-game .shogi-research__branches { display: grid; gap: 4px; align-content: start; }
.shogi-game .shogi-research__branch { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 36px; gap: 4px; }
.shogi-game .shogi-research__branch > button,
.shogi-game .shogi-research__branch-more {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid rgba(255, 252, 244, 0.22);
  border-radius: 6px;
  color: #fffcf4;
  background: #172632;
  font-weight: 800;
  text-align: left;
}
.shogi-game .shogi-research__branch-more { justify-content: center; padding: 0; }
.shogi-game .shogi-research__branch > button.on { border-color: #f1a54c; background: rgba(241, 165, 76, 0.16); }
.shogi-game .shogi-research__branch small { color: rgba(255, 252, 244, 0.65); font-size: 0.72rem; font-weight: 700; }
.shogi-game .shogi-research__branch-menu { grid-column: 1 / -1; display: flex; gap: 4px; }
.shogi-game .shogi-research__branch-menu button { flex: 1; min-height: 34px; border: 1px solid rgba(255, 252, 244, 0.3); border-radius: 6px; color: #fffcf4; background: #2b465b; font-size: 0.8rem; font-weight: 800; }
.shogi-game .shogi-research__graph-box { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 4px; min-height: 0; }
.shogi-game .shogi-research__graph-head { display: flex; align-items: center; gap: 8px; }
.shogi-game .shogi-research__graph-head .shogi-research__small { margin-left: auto; }
.shogi-game .shogi-research__small { min-height: 32px; padding: 0 10px; border: 1px solid rgba(255, 252, 244, 0.35); border-radius: 6px; color: #fffcf4; background: #2b465b; font-size: 0.8rem; font-weight: 800; }
.shogi-game .shogi-research__progress { display: inline-flex; align-items: center; gap: 4px; color: rgba(255, 252, 244, 0.7); font-size: 0.75rem; }
.shogi-game .shogi-research__progress i { display: block; width: 60px; height: 6px; border-radius: 3px; background: rgba(255, 252, 244, 0.2); overflow: hidden; }
.shogi-game .shogi-research__progress b { display: block; height: 100%; background: #f1a54c; }
.shogi-game .shogi-research__graph-box .evaluation-graph,
.shogi-game .shogi-research__phone-graph .evaluation-graph { min-height: 0; }
.shogi-game .shogi-research__graph-box .evaluation-graph__svg { min-height: 0; height: 100%; }

/* 真ん中 */
.shogi-game .shogi-research__center { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 6px; min-height: 0; min-width: 0; }
.shogi-game .shogi-research__rate { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; min-height: 28px; padding: 0 8px; font-weight: 900; }
.shogi-game .shogi-research__rate--note { display: flex; justify-content: center; color: rgba(255, 252, 244, 0.7); font-size: 0.8rem; font-weight: 800; text-align: center; }
.shogi-game .shogi-research__rate-side { font-size: 0.8rem; white-space: nowrap; }
.shogi-game .shogi-research__rate-side--black { color: #9cc0ff; }
.shogi-game .shogi-research__rate-side--white { color: #ffb0a6; }
.shogi-game .shogi-research__rate-bar { position: relative; height: 14px; border-radius: 7px; overflow: hidden; background: var(--research-white); }
.shogi-game .shogi-research__rate-bar i { position: absolute; inset: 0 auto 0 0; background: var(--research-black); transition: width 0.4s ease; }
.shogi-game .shogi-research__rate-bar span { position: absolute; left: 50%; top: 50%; translate: -50% -50%; padding: 0 8px; border: 1px solid rgba(255, 252, 244, 0.3); border-radius: 999px; background: #172632; color: #fffcf4; font-size: 0.72rem; line-height: 1.35; white-space: nowrap; }
.shogi-game .shogi-research__board { position: relative; min-height: 0; min-width: 0; }
.shogi-game .shogi-research__board .shogi-match-theme-controls { display: none; }
.shogi-game .shogi-research__move { display: grid; grid-template-columns: 48px 48px minmax(0, 1fr) 48px 48px; gap: 6px; align-items: center; padding: 0 6px; }
.shogi-game .shogi-research--wide .shogi-research__move { grid-template-columns: 56px 56px minmax(0, 1fr) 56px 56px; max-width: 600px; width: 100%; justify-self: center; }
.shogi-game .shogi-research__move button,
.shogi-game .shogi-research__preview button { min-height: 44px; border: 1px solid rgba(255, 252, 244, 0.3); border-radius: 6px; color: #fffcf4; background: #2b465b; font-weight: 900; }
.shogi-game .shogi-research__move span { display: grid; text-align: center; font-weight: 900; font-size: 0.95rem; line-height: 1.25; }
.shogi-game .shogi-research__move span small { color: rgba(255, 252, 244, 0.65); font-size: 0.72rem; font-weight: 700; }
.shogi-game .shogi-research__move--count { grid-template-columns: minmax(0, 1fr) !important; }
.shogi-game .shogi-research__move--count > span { display: block; }
.shogi-game .shogi-research__move--count > span small { display: block; }
.shogi-game .shogi-research__preview { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; padding: 4px 6px; border: 1px solid #f1a54c; border-radius: 8px; background: rgba(241, 165, 76, 0.12); font-size: 0.85rem; font-weight: 800; }
.shogi-game .shogi-research__preview div { display: flex; gap: 4px; }
.shogi-game .shogi-research__preview button { min-height: 38px; padding: 0 10px; }

/* 右の列(検討)・スマホの下の欄 */
.shogi-game .shogi-research__side { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; min-height: 0; min-width: 0; }
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__side { border-top: 1px solid rgba(241, 165, 76, 0.5); background: #172632; }
.shogi-game .shogi-research--wide .shogi-research__side { grid-template-rows: minmax(0, 1fr); }
.shogi-game .shogi-research__tabs { display: grid; grid-template-columns: repeat(3, 1fr); }
.shogi-game .shogi-research__tabs button { min-height: 38px; border: 0; border-bottom: 3px solid transparent; color: rgba(255, 252, 244, 0.65); background: transparent; font-weight: 900; }
.shogi-game .shogi-research__tabs button.on { color: #fffcf4; border-bottom-color: #f1a54c; }
.shogi-game .shogi-research__study { display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto auto; gap: 8px; min-height: 0; padding: 6px 8px; }
.shogi-game .shogi-research--wide .shogi-research__study { padding: 0; }
.shogi-game .shogi-research__run { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: center; }
.shogi-game .shogi-research--wide .shogi-research__run { padding: 8px 10px; border: 1px solid rgba(241, 165, 76, 0.5); border-left: 3px solid #f1a54c; background: rgba(23, 38, 50, 0.94); }
.shogi-game .shogi-research__go {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 88px;
  min-height: 46px;
  padding: 0 12px;
  border: 1px solid #b57c39;
  border-radius: 6px;
  color: #1d303f;
  background: #f1a54c;
  box-shadow: 0 3px 0 #b57c39;
  font-weight: 900;
}
.shogi-game .shogi-research__go .pulse { width: 10px; height: 10px; border-radius: 50%; background: #d8483a; animation: shogi-research-pulse 1.2s ease-in-out infinite; }
@keyframes shogi-research-pulse { 50% { box-shadow: 0 0 0 5px rgba(216, 72, 58, 0.25); } }
@media (prefers-reduced-motion: reduce) { .shogi-game .shogi-research__go .pulse { animation: none; } }
.shogi-game .shogi-research__stats { display: grid; gap: 1px; color: rgba(255, 252, 244, 0.72); font-size: 0.78rem; line-height: 1.35; min-width: 0; }
.shogi-game .shogi-research__stats strong { color: #fffcf4; font-size: 0.85rem; }
.shogi-game .shogi-research__settings { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.shogi-game .shogi-research__setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 40px;
  padding: 0 8px;
  border: 1px solid rgba(255, 252, 244, 0.18);
  border-radius: 6px;
  color: #fffcf4;
  background: #172632;
  font-size: 0.8rem;
  font-weight: 800;
  white-space: nowrap;
}
.shogi-game .shogi-research__setting em { color: #f1a54c; font-style: normal; }
.shogi-game .shogi-research__stepper { display: inline-flex; align-items: center; gap: 4px; }
.shogi-game .shogi-research__stepper button { width: 30px; height: 30px; border: 1px solid rgba(255, 252, 244, 0.3); border-radius: 50%; color: #fffcf4; background: #2b465b; font-weight: 900; line-height: 1; }
.shogi-game .shogi-research__stepper b { min-width: 1.4em; color: #f1a54c; font-size: 1rem; text-align: center; }
.shogi-game .shogi-research__switch { display: inline-flex; border: 1px solid rgba(255, 252, 244, 0.3); border-radius: 999px; overflow: hidden; }
.shogi-game .shogi-research__switch button { min-height: 28px; padding: 0 10px; border: 0; color: #fffcf4; background: transparent; font-size: 0.75rem; font-weight: 800; }
.shogi-game .shogi-research__switch button.on { color: #1d303f; background: #f1a54c; font-weight: 900; }
.shogi-game .shogi-research__pv { display: grid; gap: 4px; align-content: start; min-height: 0; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
.shogi-game .shogi-research__pv li button {
  display: grid;
  grid-template-columns: 26px 64px minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  color: #fffcf4;
  background: rgba(255, 252, 244, 0.05);
  text-align: left;
}
.shogi-game .shogi-research__pv li:first-child button { background: rgba(216, 72, 58, 0.16); box-shadow: inset 0 0 0 1px rgba(216, 72, 58, 0.55); }
.shogi-game .shogi-research__pv li.is-open button { box-shadow: inset 0 0 0 2px #f1a54c; }
.shogi-game .shogi-research__rank { grid-row: 1 / 3; display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--research-cand); color: #fff; font-size: 0.8rem; font-weight: 900; }
.shogi-game .shogi-research__rank--2 { background: rgba(216, 72, 58, 0.78); }
.shogi-game .shogi-research__rank--3 { background: rgba(216, 72, 58, 0.62); }
.shogi-game .shogi-research__rank--4,
.shogi-game .shogi-research__rank--5 { background: rgba(216, 72, 58, 0.5); }
.shogi-game .shogi-research__score { grid-row: 1 / 3; display: grid; font-size: 1rem; font-weight: 900; text-align: right; line-height: 1.2; }
.shogi-game .shogi-research__score small { color: rgba(255, 252, 244, 0.65); font-size: 0.68rem; font-weight: 700; }
.shogi-game .shogi-research__pv-move { font-size: 0.95rem; font-weight: 900; }
.shogi-game .shogi-research__pv-line { overflow: hidden; color: rgba(255, 252, 244, 0.7); font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .shogi-research__pv li:first-child .shogi-research__pv-line { display: -webkit-box; white-space: normal; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.shogi-game .shogi-research__pv-empty { padding: 10px 8px; }
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__pv li button { grid-template-columns: 24px 56px auto minmax(0, 1fr); grid-template-rows: auto; padding: 5px 8px; }
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__rank,
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__score { grid-row: auto; }
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__score { font-size: 0.9rem; }
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__study { grid-template-rows: auto minmax(0, 1fr); gap: 6px; }
.shogi-game .shogi-research__phone-row { display: flex; align-items: center; gap: 6px; min-height: 34px; font-size: 0.75rem; }
.shogi-game .shogi-research__phone-stats { display: inline-flex; align-items: center; gap: 5px; flex: 1; min-width: 0; overflow: hidden; color: rgba(255, 252, 244, 0.75); white-space: nowrap; text-overflow: ellipsis; }
.shogi-game .shogi-research__phone-stats .pulse { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #d8483a; }
.shogi-game .shogi-research__phone-label { color: rgba(255, 252, 244, 0.75); font-weight: 800; }
.shogi-game .shogi-research__phone-row .shogi-research__stepper button { width: 28px; height: 28px; }
.shogi-game .shogi-research__phone-limit { min-height: 32px; padding: 0 8px; border: 1px solid rgba(255, 252, 244, 0.25); border-radius: 6px; color: #f1a54c; background: #172632; font-size: 0.75rem; font-weight: 800; white-space: nowrap; }
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__setting { min-height: 34px; }
.shogi-game .shogi-research__hime { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 8px; align-items: center; }
.shogi-game .shogi-research__hime img { width: 48px; height: 60px; object-fit: contain; image-rendering: pixelated; }
.shogi-game .shogi-research__hime p { margin: 0; padding: 8px 10px; border-left: 3px solid #f1a54c; background: rgba(23, 38, 50, 0.94); font-size: 0.85rem; font-weight: 700; line-height: 1.45; }
.shogi-game .shogi-research__hime.is-notice p { border-left-color: #f1a54c; background: rgba(241, 165, 76, 0.16); }
.shogi-game .shogi-research__hime.is-ng p { border-left-color: #e0655a; color: #ffd0c9; }
.shogi-game .shogi-research__actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.shogi-game .shogi-research__actions--two { grid-template-columns: 1fr 1.4fr; }
.shogi-game .shogi-research__actions button,
.shogi-game .shogi-research__bar button {
  min-height: 48px;
  padding: 0 6px;
  border: 1px solid rgba(255, 252, 244, 0.3);
  border-radius: 6px;
  color: #fffcf4;
  background: #2b465b;
  font-size: 0.85rem;
  font-weight: 800;
  line-height: 1.2;
}
.shogi-game .shogi-research .is-primary { border-color: #b57c39; color: #1d303f; background: #f1a54c; box-shadow: 0 3px 0 #b57c39; font-weight: 900; }
.shogi-game .shogi-research__bar { display: grid; grid-template-columns: 1.2fr 1fr 1fr 52px; gap: 6px; padding: 6px 8px 8px; }
.shogi-game .shogi-research__bar .shogi-research__go { min-width: 0; }
.shogi-game .shogi-research__phone-kifu { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; min-height: 0; padding: 6px 8px; overflow: hidden; }
.shogi-game .shogi-research__phone-kifu .shogi-research__kifu { min-height: 0; border: 1px solid rgba(241, 165, 76, 0.5); background: rgba(23, 38, 50, 0.94); }
.shogi-game .shogi-research__phone-kifu .shogi-research__branches { overflow-y: auto; min-height: 0; }
.shogi-game .shogi-research__phone-graph { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 4px; min-height: 0; padding: 6px 8px; }

/* 局面編集 */
.shogi-game .shogi-research__edit { display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 8px; min-height: 0; padding: 6px 8px 8px; }
.shogi-game .shogi-research--wide .shogi-research__edit { padding: 0; }
.shogi-game .shogi-research__edit-scroll { display: grid; gap: 8px; align-content: start; min-height: 0; overflow-y: auto; }
.shogi-game .shogi-research__edit-foot { display: grid; gap: 6px; }
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__edit-foot .shogi-research__hime img { display: none; }
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__edit-foot .shogi-research__hime { grid-template-columns: minmax(0, 1fr); }
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__edit-foot .shogi-research__hime p { padding: 4px 8px; font-size: 0.78rem; }
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__edit-foot .shogi-research__actions button { min-height: 44px; }
.shogi-game .shogi-research__edit h2 small { color: rgba(255, 252, 244, 0.6); font-weight: 700; }
.shogi-game .shogi-research__piece-box { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 3px; padding: 5px; border-radius: 8px; background: #6b4a2a; }
.shogi-game .shogi-research--wide .shogi-research__piece-box { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.shogi-game .shogi-research__piece-box button { position: relative; height: 44px; padding: 2px; border: 0; border-radius: 6px; background: transparent; }
.shogi-game .shogi-research__piece-box button img { width: 100%; height: 100%; object-fit: contain; }
.shogi-game .shogi-research__piece-box button b { position: absolute; right: 0; bottom: 0; min-width: 18px; padding: 0 3px; border-radius: 9px; background: #1d303f; color: #fffcf4; font-size: 0.68rem; line-height: 18px; }
.shogi-game .shogi-research__piece-box button.is-picked { background: rgba(47, 111, 214, 0.35); box-shadow: inset 0 0 0 3px #2f6fd6; }
.shogi-game .shogi-research__piece-box button:disabled { opacity: 0.25; }
.shogi-game .shogi-research__picked { display: grid; gap: 6px; padding: 8px; border: 1px solid #2f6fd6; border-radius: 8px; background: rgba(47, 111, 214, 0.14); font-size: 0.82rem; font-weight: 800; }
.shogi-game .shogi-research__picked div { display: flex; gap: 6px; }
.shogi-game .shogi-research__picked button { flex: 1; min-height: 38px; border: 1px solid rgba(255, 252, 244, 0.3); border-radius: 6px; color: #fffcf4; background: #2b465b; font-size: 0.8rem; font-weight: 800; }
.shogi-game .shogi-research__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.shogi-game .shogi-research__chips button { min-height: 38px; padding: 0 12px; border: 1px solid rgba(255, 252, 244, 0.3); border-radius: 999px; color: #fffcf4; background: #172632; font-size: 0.82rem; font-weight: 800; }
.shogi-game .shogi-research__chips button.on { border-color: #fffcf4; color: #1d303f; background: #fffcf4; }

/* 消した分岐をもとに戻す帯 */
.shogi-game .shogi-research__toast { position: absolute; left: 50%; bottom: 16px; z-index: 30; display: flex; align-items: center; gap: 10px; translate: -50% 0; padding: 8px 12px; border-radius: 8px; background: #fffcf4; color: #1d303f; font-weight: 800; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); }
.shogi-game .shogi-research__toast button { min-height: 36px; padding: 0 12px; border: 0; border-radius: 6px; color: #1d303f; background: #f1a54c; font-weight: 900; }

/* シート(対局準備の選択シートと同じ紙) */
.shogi-game .shogi-research__veil { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; padding: 16px; background: rgba(8, 14, 20, 0.62); }
.shogi-game .shogi-research__sheet { position: relative; display: grid; gap: 12px; width: min(440px, 100%); max-height: 100%; padding: 18px 18px 16px; overflow-y: auto; border-radius: 12px; color: #1d303f; background: #fffcf4; box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45); }
.shogi-game .shogi-research__sheet h2 { color: #1d303f; font-size: 1.1rem; }
.shogi-game .shogi-research__sheet h3 { margin: 0 0 4px; color: #526878; font-size: 0.8rem; }
.shogi-game .shogi-research__sheet-close { position: absolute; top: 8px; right: 8px; width: 44px; height: 44px; border: 0; border-radius: 50%; color: #526878; background: transparent; font-size: 1.3rem; }
.shogi-game .shogi-research__chips--paper button { color: #1d303f; background: #fff; border-color: #cfc4ad; }
.shogi-game .shogi-research__chips--paper button.on { color: #fffcf4; background: #2b465b; border-color: #2b465b; }
.shogi-game .shogi-research__sheet-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 52px; padding: 0 12px; border: 1px solid #d9cfba; border-radius: 8px; background: #fff; font-weight: 800; }
.shogi-game .shogi-research__seg { display: inline-flex; border: 2px solid #2b465b; border-radius: 8px; overflow: hidden; }
.shogi-game .shogi-research__seg button { min-height: 38px; padding: 0 14px; border: 0; color: #1d303f; background: #fff; font-weight: 900; }
.shogi-game .shogi-research__seg button.on { color: #fffcf4; background: #2b465b; }
.shogi-game .shogi-research__stepper--paper em { min-width: 9em; color: #8a5b00; font-style: normal; font-size: 0.85rem; text-align: center; }
.shogi-game .shogi-research__stepper--paper button { color: #1d303f; background: #fff; border-color: #cfc4ad; }
.shogi-game .shogi-research__sheet-note { margin: 0; color: #526878; font-size: 0.85rem; font-weight: 700; }
.shogi-game .shogi-research__sheet-note.is-ng { color: #b53500; }
.shogi-game .shogi-research__sheet-actions { display: grid; grid-template-columns: 1fr 1.4fr; gap: 8px; }
.shogi-game .shogi-research__sheet-actions--wrap { grid-template-columns: 1fr; }
.shogi-game .shogi-research__sheet-actions--column { grid-template-columns: 1fr; }
.shogi-game .shogi-research__sheet-actions button,
.shogi-game .shogi-research__sheet-wide { min-height: 48px; padding: 0 12px; border: 1px solid #cfc4ad; border-radius: 8px; color: #1d303f; background: #e9e2d2; font-weight: 800; }
.shogi-game .shogi-research__sheet-actions button.is-primary { color: #1d303f; background: #f1a54c; border-color: #b57c39; }
.shogi-game .shogi-research__book { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.shogi-game .shogi-research__book li { display: flex; align-items: center; gap: 6px; padding: 6px; border: 1px solid #d9cfba; border-radius: 8px; background: #fff; font-size: 0.85rem; }
.shogi-game .shogi-research__book li.is-current { border-color: #f1a54c; box-shadow: inset 4px 0 0 #f1a54c; }
.shogi-game .shogi-research__book-open { display: grid; flex: 1; min-width: 0; min-height: 44px; padding: 0 6px; border: 0; color: #1d303f; background: transparent; text-align: left; }
.shogi-game .shogi-research__book-open b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shogi-game .shogi-research__book-open small { color: #526878; }
.shogi-game .shogi-research__book-drop,
.shogi-game .shogi-research__book-actions button { min-height: 40px; padding: 0 10px; border: 1px solid #cfc4ad; border-radius: 6px; color: #1d303f; background: #f3ecdc; font-weight: 800; }
.shogi-game .shogi-research__book li > span:first-child { flex: 1; }
.shogi-game .shogi-research__book-actions { display: flex; gap: 6px; }
.shogi-game .shogi-research__book-actions .is-danger { color: #fff; background: #b53500; border-color: #8a2800; }
.shogi-game .shogi-research__io { width: 100%; min-height: 8em; padding: 8px; border: 1px solid #cfc4ad; border-radius: 8px; color: #1d303f; background: #fff; font: 0.8rem/1.4 ui-monospace, monospace; resize: vertical; }

/* 横向きのスマホ: 盤を左、検討の欄(タブ)を右に並べる。 */
.shogi-game .shogi-research--land .shogi-research__body { grid-template-columns: minmax(0, 1fr) minmax(300px, 48%); grid-template-rows: minmax(0, 1fr) !important; }
.shogi-game .shogi-research--land .shogi-research__center { grid-template-rows: auto minmax(0, 1fr) auto !important; min-height: 0; }
.shogi-game .shogi-research--land .shogi-research__board { height: auto !important; }
.shogi-game .shogi-research--land .shogi-research__side { border-top: 0; border-left: 1px solid rgba(241, 165, 76, 0.5); }
.shogi-game .shogi-research--land .shogi-research__move { grid-template-columns: 40px 40px minmax(0, 1fr) 40px 40px; }
.shogi-game .shogi-research--land .shogi-research__move button { min-height: 36px; }
.shogi-game .shogi-research--land .shogi-research__bar button { min-height: 40px; }
/* スマホ: 盤の段の高さは中身で変えない(docs/stable-board-layout-design.md)。 */
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__board { height: min(calc(100vw * 1.18), 50dvh); }

.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__center { grid-template-rows: auto auto auto; gap: 4px; padding-top: 4px; }
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__rate { min-height: 24px; }
.shogi-game .shogi-research:not(.shogi-research--wide) .shogi-research__body { grid-template-rows: auto minmax(0, 1fr); }
</style>
