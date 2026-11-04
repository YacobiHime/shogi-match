// ノベルの台本の検査(docs/novel-scene-design.mdの12-4、使い方はdocs/novel-authoring-guide.mdの2章)。
//   npm run novel:check                       … src/story/scenes/*.mdと、組み込みの場面(団体戦・棋士の1年)を全部
//   npm run novel:check -- path/to/scene.md  … 指定したファイルだけ
// まちがい(error)が1つでもあれば、終わりのコードを1にする(注意だけなら0)。

import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { formatProblems, parseNovelScript } from '../src/core/novel-script.mjs';
import { checkScene } from '../src/core/novel-direction.mjs';
import { TEAM_SCENES, teamScene } from '../src/core/team-story.mjs';
import { PRO_YEAR_SCENES, proYearScene } from '../src/core/pro-year-story.mjs';

const root = join(import.meta.dirname, '..');
const sceneDir = join(root, 'src', 'story', 'scenes');
const args = process.argv.slice(2);
const files = args.length ? args : readdirSync(sceneDir).filter((name) => name.endsWith('.md')).map((name) => join(sceneDir, name));

let errors = 0;
let warnings = 0;
const report = (label, problems) => {
  errors += problems.filter((problem) => problem.level === 'error').length;
  warnings += problems.filter((problem) => problem.level === 'warn').length;
  for (const text of formatProblems(problems, label)) console.log(text);
};

for (const file of files) {
  const { scene, problems } = parseNovelScript(readFileSync(file, 'utf8'));
  const label = relative(process.cwd(), file);
  const name = basename(file, '.md');
  if (scene.id && scene.id !== name) problems.push({ level: 'error', line: null, message: `ファイルの名前「${name}」とid「${scene.id}」が違います。同じにします。` });
  report(label, problems);
}
if (!args.length) {
  for (const id of Object.keys(TEAM_SCENES)) report(`team-story.mjs#${id}`, checkScene(teamScene(id, 'あなた')));
  for (const id of Object.keys(PRO_YEAR_SCENES)) report(`pro-year-story.mjs#${id}`, checkScene(proYearScene(id, { playerName: 'あなた' }), { vars: ['title', 'holder', 'event', 'round'] }));
}
console.log(`\n検査: ${files.length}ファイル${args.length ? '' : 'と組み込みの場面'}。まちがい${errors}件・注意${warnings}件。`);
process.exitCode = errors ? 1 : 0;
