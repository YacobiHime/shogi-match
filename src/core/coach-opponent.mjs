/**
 * 大会(竜王戦・名人戦)の対局の始めに、やこび姫が相手の棋風と特殊能力から「どう戦うか」を1行で言う。
 * 設計は docs/coach-plan-advice-design.md の9章(案C)。名鑑と同じ特殊能力の札(player-character.mjs)を元にする。
 */
import { attackStyleLabel, traitById } from './player-character.mjs';

/** 特殊能力ごとの、相手の特徴と、こちらの戦い方。 */
const TRAIT_ADVICE = Object.freeze({
  'grand-view': '「大局観」の持ち主だよ。目先の駒得より、形勢の大きな流れを大事にしよう！',
  'demon-reading': '「鬼の読み」の持ち主だよ。無理攻めは読まれるから、手堅く指そう！',
  comeback: '「逆転の名手」だよ。リードしても最後まで気を抜かないで！',
  'research-demon': '「研究の鬼」だよ。序盤は定跡を外れても慌てないで、自分の形を作ろう！',
  'defense-master': '「受けの達人」だよ。攻めを急がず、じっくり駒を集めてから仕掛けよう！',
  'endgame-collapse': '終盤で頓死することがある相手だよ。苦しくても終盤まで粘れば、チャンスが来るよ！',
  'weak-defense': '受けが苦手な相手だよ。先に攻めの形を作って、どんどん攻めよう！',
  'loose-when-ahead': '優勢になると緩む相手だよ。押されても、あきらめずに粘ろう！',
  'big-stage-weak': '大舞台で硬くなる相手だよ。のびのび指せば、こっちのペースだよ！',
  'time-trouble': '終盤で時間に追われる相手だよ。終盤の入り口まで互角なら、チャンスだよ！',
  'endgame-defense': '終盤の受けが正確な相手だよ。早めに駒得して、リードを広げよう！',
  'fast-attack': '寄せが速い相手だよ。玉をしっかり囲ってから戦おう！',
  tsume: '詰将棋が得意な相手だよ。王手の続く形にならないよう、玉を固めよう！',
  'deep-reading': '読みが深い相手だよ。焦らず、じっくり指そう！',
  'middle-strong': '中盤が強い相手だよ。序盤で良い形を作っておこう！',
  'opening-study': '序盤の研究が深い相手だよ。定跡を外れても、慌てないでね！',
  'vs-ranging': '振り飛車が相手だと強い棋士だよ。作戦選びも勝負のうちだね！',
  'vs-static': '居飛車が相手だと強い棋士だよ。作戦選びも勝負のうちだね！',
  tenacious: '劣勢でも崩れない相手だよ。リードしても、最後まで丁寧に指そう！',
  'late-bloom': '指すほど強くなる相手だよ。序盤からリードを取りにいこう！',
  'big-stage': '大舞台に強い相手だよ。こっちも気持ちで負けないで！',
});

/** 棋風ごとの、こちらの戦い方。 */
const STYLE_ADVICE = Object.freeze({
  '激しい攻め将棋': '激しい攻め将棋の相手だよ。先に玉を固めて、攻めを受け止めよう！',
  '攻め将棋': '攻め将棋の相手だよ。玉の守りを忘れずにね！',
  '手厚い受け将棋': '手厚い受け将棋の相手だよ。攻めの駒を集めてから、じっくり仕掛けよう！',
  '受け将棋': '受け将棋の相手だよ。攻めを焦らず、形を整えてから仕掛けよう！',
});

/**
 * 相手の特徴から1行。金の特殊能力 → 苦手(こちらのチャンス) → 得意 → 棋風 の順で、最初に言えるもの。
 * @param {{ attack?: number, traits?: { id: string, degree?: number }[] } | null | undefined} character
 * @param {string} name 相手の名前
 */
export function opponentStyleAdvice(character, name) {
  if (!character || !name) return null;
  const traits = character.traits ?? [];
  const rank = (id) => {
    const trait = traitById(id);
    if (!trait) return 9;
    if (trait.tier === 'gold') return 0;
    return trait.kind === 'weakness' ? 1 : 2;
  };
  const picked = [...traits].filter(({ id }) => TRAIT_ADVICE[id]).sort((a, b) => rank(a.id) - rank(b.id))[0];
  const line = picked ? TRAIT_ADVICE[picked.id] : STYLE_ADVICE[attackStyleLabel(character.attack)];
  if (!line) return null;
  return { key: `opponent-style-${picked?.id ?? 'style'}`, text: `${name}さんは、${line}` };
}
