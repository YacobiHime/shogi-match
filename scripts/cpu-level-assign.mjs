// cpu-level-selfplay.mjsの結果から、各レベルの技量(skill)を割り付ける開発用スクリプト。
// 使い方: node scripts/cpu-level-assign.mjs result.json [--anchor old6000=20] [--curve linear|smooth] [--first-step 35] [--top 40]
//   基準は結果にある選手名(例: old6000=20)か、技量(例: s0.115=17、測定点の間は補間)で指定する。
//   s<技量>の選手のレーティングを技量について単調な折れ線にし、最大技量より先は末尾の傾きで1まで延ばす。
//   --curve linear(既定): Lv0から基準レベルまでと、そこからLv40までを、それぞれ等間隔のレーティングで分ける。
//   --curve smooth: 目標レーティングを R(L) = 最初の刻み×L + a(e^(bL) - 1 - bL) とし、
//   Lv0=0、基準レベル=基準のレーティング、Lv40=技量1のレーティングを通るようにa・bを決める。
//   自己対局では手の選び方のばらつきが減るほど差が大きく出るため、刻みを上位ほど滑らかに広げる。
import fs from "node:fs";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

/** 重み付きの隣接違反併合法で、技量に対して単調増加なレーティング列にする。 */
function isotonic(points) {
  const blocks = [];
  for (const point of points) {
    blocks.push({ ...point, count: 1 });
    while (blocks.length > 1 && blocks.at(-2).rating > blocks.at(-1).rating) {
      const last = blocks.pop();
      const previous = blocks.pop();
      const weight = previous.weight + last.weight;
      blocks.push({
        skill: (previous.skill * previous.count + last.skill * last.count) / (previous.count + last.count),
        rating: (previous.rating * previous.weight + last.rating * last.weight) / weight,
        weight,
        count: previous.count + last.count,
      });
    }
  }
  return blocks;
}

function ratingAt(curve, skill) {
  if (skill <= curve[0].skill) return curve[0].rating;
  for (let i = 1; i < curve.length; i += 1) {
    if (skill <= curve[i].skill) {
      const left = curve[i - 1];
      const right = curve[i];
      return left.rating + (right.rating - left.rating) * (skill - left.skill) / (right.skill - left.skill);
    }
  }
  return curve.at(-1).rating;
}

function interpolate(curve, rating) {
  if (rating <= curve[0].rating) return curve[0].skill;
  for (let i = 1; i < curve.length; i += 1) {
    if (rating <= curve[i].rating) {
      const left = curve[i - 1];
      const right = curve[i];
      return left.skill + (right.skill - left.skill) * (rating - left.rating) / (right.rating - left.rating);
    }
  }
  return curve.at(-1).skill;
}

const file = process.argv[2];
if (!file) throw new Error("自動対局の結果JSONを指定してください");
const { ratings } = JSON.parse(fs.readFileSync(file, "utf8"));
const [anchorPlayer, anchorLevelText] = option("anchor", "old6000=20").split("=");
const curveKind = option("curve", "linear");
const anchorLevel = Number(anchorLevelText);
const topLevel = Number(option("top", "40"));
const firstStep = Number(option("first-step", "25"));

/** 基準レベルと最上位を通る、刻みが滑らかに広がる目標レーティング曲線を作る。 */
function targetCurve(anchorRating, topRating) {
  const growth = (b, level) => Math.exp(b * level) - 1 - b * level;
  const scaleFor = (b) => (anchorRating - firstStep * anchorLevel) / growth(b, anchorLevel);
  const miss = (b) => firstStep * topLevel + scaleFor(b) * growth(b, topLevel) - topRating;
  if (!(anchorRating > firstStep * anchorLevel)) throw new Error("最初の刻みが大きすぎます");
  let low = 1e-4;
  let high = 1;
  for (let i = 0; i < 200; i += 1) {
    const middle = (low + high) / 2;
    if (miss(middle) > 0) high = middle;
    else low = middle;
  }
  const b = (low + high) / 2;
  if (Math.abs(miss(b)) > 1) throw new Error("目標曲線が基準と最上位を通りません。--first-stepを変えてください");
  const a = scaleFor(b);
  return (level) => firstStep * level + a * growth(b, level);
}

const base = ratings.find(({ player }) => player === "s0");
if (!base) throw new Error("技量0(s0)の選手が結果にありません");
const points = ratings
  .filter(({ player }) => /^s[\d.]+$/.test(player))
  .map(({ player, rating, se }) => ({
    skill: Number(player.slice(1)),
    rating: rating - base.rating,
    weight: 1 / Math.max(10, se) ** 2,
  }))
  .sort((left, right) => left.skill - right.skill);
const curve = isotonic(points).map(({ skill, rating }) => ({ skill, rating }));
curve[0] = { skill: 0, rating: 0 };
const tail = curve.slice(-3);
const slope = (tail.at(-1).rating - tail[0].rating) / (tail.at(-1).skill - tail[0].skill);
if (curve.at(-1).skill < 1) curve.push({ skill: 1, rating: curve.at(-1).rating + slope * (1 - curve.at(-1).skill) });

const anchor = ratings.find(({ player }) => player === anchorPlayer);
if (!anchor && !/^s[\d.]+$/.test(anchorPlayer)) throw new Error(`基準選手${anchorPlayer}が結果にありません`);
const anchorRating = anchor ? anchor.rating - base.rating : ratingAt(curve, Number(anchorPlayer.slice(1)));
const topRating = curve.at(-1).rating;
const target = curveKind === "smooth"
  ? targetCurve(anchorRating, topRating)
  : (level) => (level <= anchorLevel
    ? anchorRating * level / anchorLevel
    : anchorRating + (topRating - anchorRating) * (level - anchorLevel) / (topLevel - anchorLevel));
const levels = Array.from({ length: topLevel + 1 }, (_, level) => {
  const rating = target(level);
  return { level, rating: Math.round(rating), skill: Math.round(interpolate(curve, rating) * 1000) / 1000 };
});
levels[topLevel].skill = 1;

console.log(`基準: ${anchorPlayer}=${Math.round(anchorRating)} をLv${anchorLevel}、延長したLv${topLevel}=${Math.round(topRating)}`);
console.log("単調化した曲線:", curve.map(({ skill, rating }) => `${skill}:${Math.round(rating)}`).join(" "));
for (const other of ratings.filter(({ player }) => !/^s[\d.]+$/.test(player))) {
  const rating = other.rating - base.rating;
  const nearest = levels.reduce((best, entry) => (
    Math.abs(entry.rating - rating) < Math.abs(best.rating - rating) ? entry : best
  ));
  console.log(`${other.player}: ${Math.round(rating)} ±${other.se} ≒ Lv${nearest.level}`);
}
console.log("| Lv | 目標レーティング | 技量 |\n| ---: | ---: | ---: |");
for (const { level, rating, skill } of levels) console.log(`| ${level} | ${rating} | ${skill} |`);
