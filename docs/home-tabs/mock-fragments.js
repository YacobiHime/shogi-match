// docs/home-roadmap-design.mdの8章のモックアップの中身。
// 今のホームを開き、まなぶ・しらべるのタブの中身をこの断片に差し替えて写真を撮る(アイコン・文字・色は今のアプリのものを使う)。
// <i data-icon="…"> は、今のホームのタイルのアイコン(SVG)をそのまま写したものに置き換える。数字は見本。
window.HOME_TABS_MOCK = {
  css: `
  .shogi-title__panels [data-home-group]:has(> .mock-cards), .shogi-title__panels [data-home-group]:has(> .mock-reco), .shogi-title__panels [data-home-group]:has(> .mock-recent) { align-self: stretch !important; height: 100% !important; display: grid; gap: .55em; grid-template-rows: auto minmax(0, 1fr); align-content: stretch; }
  .mock-fill .shogi-title__group-title { margin: 0; }
  .mock-cards { display: grid; gap: .6em; min-height: 0; }
  .mock-cards--learn { grid-template-rows: repeat(3, minmax(0, 1fr)); }
  .mock-cards--dex { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(3, minmax(0, 1fr)); }
  @media (orientation: landscape) { .mock-cards--dex { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); } }
  .shogi-game .mock-card { margin: 0; border: 0.12em solid rgba(255,252,244,.3); border-radius: .8em; color: #fffcf4; background: rgba(43,70,91,.92); box-shadow: 0 .25em 0 rgba(23,38,50,.85); font-size: 1em; font-weight: 700; cursor: pointer; position: relative; display: grid !important; grid-template-columns: auto minmax(0, 1fr) !important; grid-template-areas: "icon name" "icon info" !important; align-content: center !important; align-items: center !important; justify-items: start !important; justify-content: stretch !important; text-align: left !important; column-gap: .9em; row-gap: .25em; min-height: 0 !important; padding: .7em 2.2em .7em 1em !important; position: relative; }
  .mock-card .shogi-title__icon { grid-area: icon !important; width: 3.4em !important; height: 3.4em !important; align-self: center; }
  .mock-card .mock-name { grid-area: name !important; justify-self: start; font-size: 1.25em; font-weight: 800; line-height: 1.2; }
  .mock-card .mock-info { grid-area: info !important; justify-self: stretch; width: 100%; display: grid; gap: .3em; min-width: 0; font-size: .86em; font-weight: 600; color: #d9e3ea; line-height: 1.35; }
  .mock-card .mock-info b { color: #fffcf4; }
  .mock-bar { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: .5em; }
  .mock-bar i { display: block; height: .5em; border-radius: 1em; background: rgba(255,252,244,.18); overflow: hidden; }
  .mock-bar i::before { content: ""; display: block; height: 100%; width: var(--p); background: #f1a54c; border-radius: inherit; }
  .mock-bar small { font-size: .95em; color: #fffcf4; }
  .mock-chips { display: flex; flex-wrap: wrap; gap: .3em; }
  .mock-chips span { padding: .1em .55em; border-radius: 1em; background: rgba(23,38,50,.6); border: 1px solid rgba(255,252,244,.22); font-size: .92em; white-space: nowrap; }
  .mock-week { display: flex; gap: .25em; align-items: center; }
  .mock-week span { display: inline-grid; place-items: center; width: 1.45em; height: 1.45em; border-radius: 50%; border: 1px solid rgba(255,252,244,.35); font-size: .8em; }
  .mock-week span.on { background: #f1a54c; border-color: #f1a54c; color: #1d303f; }
  .mock-week span.today { border: 2px solid #fffcf4; }
  .mock-go { position: absolute; right: .8em; top: 50%; transform: translateY(-50%); font-size: 1.4em; color: rgba(255,252,244,.55); }
  .shogi-game .mock-cards--dex .mock-card { grid-template-columns: 1fr !important; grid-template-areas: "icon" "name" "info" !important; justify-items: center !important; text-align: center !important; row-gap: .2em; padding: .5em .6em !important; }
  .mock-cards--dex .mock-card .shogi-title__icon { width: 2.8em !important; height: 2.8em !important; }
  .mock-cards--dex .mock-name { font-size: 1.1em; justify-self: center; }
  .mock-cards--dex .mock-info { font-size: .8em; justify-items: center; text-align: center; }
  .shogi-game .mock-card--reco { border-color: #f1a54c; }
  .mock-card .shogi-title__tile-badge { position: absolute; top: -.7em; right: .8em; z-index: 1; }
  /* 案B */
  .mock-reco { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .8em; align-items: center; padding: .9em 1em; border-radius: .9em; border: .14em solid #f1a54c; background: rgba(43,70,91,.95); box-shadow: 0 .25em 0 rgba(23,38,50,.85); }
  .mock-reco img { width: 3.4em; image-rendering: pixelated; }
  .mock-reco p { margin: 0; font-weight: 700; line-height: 1.45; }
  .mock-reco p small { display: block; color: #d9e3ea; font-weight: 600; font-size: .85em; }
  .mock-reco button { grid-column: 1 / -1; justify-self: stretch; background: #f1a54c !important; color: #1d303f !important; border-color: #f1a54c !important; font-weight: 800; }
  .mock-row3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: .55em; }
  .mock-row3 .shogi-title__tile { grid-template-columns: 1fr !important; grid-template-areas: "icon" "label" !important; justify-items: center; min-height: 0 !important; padding: .55em .3em !important; }
  .mock-row3 .shogi-title__tile .shogi-title__icon { width: 2.4em; height: 2.4em; }
  .mock-recent { display: grid; gap: .4em; }
  .mock-recent h3 { margin: 0; font-size: .85em; color: #c8d4dc; }
  `,
  a: {
    learn: `
    <h2 class="shogi-title__group-title">まなぶ</h2>
    <div class="mock-cards mock-cards--learn">
      <button type="button" class="mock-card mock-card--reco"><span class="shogi-title__tile-badge">おすすめ</span><i data-icon="tutorial"></i>
        <span class="mock-name">将棋教室</span>
        <span class="mock-info"><span>つぎは <b>第2巻 3章「角の動き」</b></span>
          <span class="mock-bar"><i style="--p:35%"></i><small>14/40</small></span>
          <span class="mock-chips"><span>コツ 5/12</span><span>金メダル 3</span></span></span><span class="mock-go">›</span></button>
      <button type="button" class="mock-card"><i data-icon="problems"></i>
        <span class="mock-name">問題集</span>
        <span class="mock-info"><span>今日の5問 <b>2/5</b>　あなたの対局 <b>2問</b></span>
          <span class="mock-bar"><i style="--p:16%"></i><small>詰将棋 24/150</small></span></span><span class="mock-go">›</span></button>
      <button type="button" class="mock-card"><i data-icon="brain"></i>
        <span class="mock-name">脳トレ</span>
        <span class="mock-info"><span>今日は <b>計算力の部屋</b></span>
          <span class="mock-week"><span class="on">月</span><span class="on">火</span><span class="today">水</span><span>木</span><span>金</span><span>土</span><span>日</span><small>　今週 2/3</small></span></span><span class="mock-go">›</span></button>
    </div>`,
    dex: `
    <h2 class="shogi-title__group-title">しらべる</h2>
    <div class="mock-cards mock-cards--dex">
      <button type="button" class="mock-card"><i data-icon="piece"></i><span class="mock-name">駒図鑑</span><span class="mock-info"><span>8種の動きと成り</span></span></button>
      <button type="button" class="mock-card"><i data-icon="tesuji"></i><span class="mock-name">手筋図鑑</span><span class="mock-info"><span>使った手筋 <b>5</b>/18</span></span></button>
      <button type="button" class="mock-card"><i data-icon="opening"></i><span class="mock-name">定跡図鑑</span><span class="mock-info"><span>組んだ作戦 <b>12</b>/72</span></span></button>
      <button type="button" class="mock-card"><i data-icon="world"></i><span class="mock-name">将棋界図鑑</span><span class="mock-info"><span>タイトル・名局・棋士</span></span></button>
      <button type="button" class="mock-card"><i data-icon="glossary"></i><span class="mock-name">用語辞典</span><span class="mock-info"><span>将棋のことば <b>300</b>語</span></span></button>
      <button type="button" class="mock-card"><i data-icon="research"></i><span class="mock-name">研究</span><span class="mock-info"><span>研究帳 <b>3</b>局</span></span></button>
    </div>`,
  },
  b: {
    learn: `
    <h2 class="shogi-title__group-title">まなぶ</h2>
    <div class="mock-reco"><img data-chara alt=""><p>次は「角の動き」だよ！<small>将棋教室　第2巻 3章・5分くらい</small></p><button type="button">続きから</button></div>
    <div class="mock-row3">
      <button type="button" class="shogi-title__tile"><i data-icon="tutorial"></i><span class="shogi-title__label">将棋教室</span></button>
      <button type="button" class="shogi-title__tile"><i data-icon="problems"></i><span class="shogi-title__label">問題集</span></button>
      <button type="button" class="shogi-title__tile"><i data-icon="brain"></i><span class="shogi-title__label">脳トレ</span></button>
    </div>`,
    dex: `
    <h2 class="shogi-title__group-title">しらべる</h2>
    <div class="mock-recent"><h3>さいきん見たもの</h3><div class="mock-chips"><span>棒銀</span><span>ふんどしの桂</span><span>竜王戦</span><span>美濃囲い</span></div></div>
    <div class="mock-row3">
      <button type="button" class="shogi-title__tile"><i data-icon="piece"></i><span class="shogi-title__label">駒図鑑</span></button>
      <button type="button" class="shogi-title__tile"><i data-icon="tesuji"></i><span class="shogi-title__label">手筋図鑑</span></button>
      <button type="button" class="shogi-title__tile"><i data-icon="opening"></i><span class="shogi-title__label">定跡図鑑</span></button>
      <button type="button" class="shogi-title__tile"><i data-icon="world"></i><span class="shogi-title__label">将棋界図鑑</span></button>
      <button type="button" class="shogi-title__tile"><i data-icon="glossary"></i><span class="shogi-title__label">用語辞典</span></button>
      <button type="button" class="shogi-title__tile"><i data-icon="research"></i><span class="shogi-title__label">研究</span></button>
    </div>`,
  },
};
