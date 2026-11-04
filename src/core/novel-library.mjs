// 台本のファイル(src/story/scenes/<id>.md)を読む(docs/novel-scene-design.mdの12-6)。
// ファイルの中身はビルドのときに文字として取り込み(Viteのimport.meta.glob)、読むのは使うときに1回だけ。
// 書き方はdocs/novel-authoring-guide.md。台本はnovel-library.test.mjsが全部検査する。

import { parseNovelScript } from './novel-script.mjs';
import { fillScene } from './novel-direction.mjs';

/** 演出の見本の台本(物語の目録には載せない。試し読みのページとガイドの例)。 */
export const SAMPLE_SCENE_ID = 'sample-direction';

/** @type {Record<string, string>} ファイルの道 → 中身 */
const FILES = import.meta.glob('../story/scenes/*.md', { query: '?raw', import: 'default', eager: true });

/** ファイルの名前(拡張子なし) → 中身。 */
const SOURCES = Object.fromEntries(Object.entries(FILES).map(([path, text]) => [path.replace(/^.*\//, '').replace(/\.md$/, ''), String(text)]));

/** @type {Map<string, ReturnType<typeof parseNovelScript>>} */
const parsed = new Map();

/** 台本のファイルの名前(id)。 */
export const librarySceneIds = () => Object.keys(SOURCES).sort();
/** 台本のファイルがあるか。 */
export const hasLibraryScene = (id) => Object.hasOwn(SOURCES, id);
/** 台本の文(なければ空)。 */
export const libraryScript = (id) => SOURCES[id] ?? '';

/** 台本を読んだ結果(場面と検査の結果。読むのは1回だけ)。 */
export function libraryParsed(id) {
  if (!hasLibraryScene(id)) return null;
  if (!parsed.has(id)) parsed.set(id, parseNovelScript(SOURCES[id]));
  return parsed.get(id) ?? null;
}

/**
 * 台本の場面を、画面に出す形にする(名前と差し込みを入れる)。読めない台本はnull。
 * @param {string} id
 * @param {{ playerName?: string, momokaCall?: string, vars?: Record<string, string> }} [options]
 */
export function libraryScene(id, options = {}) {
  const result = libraryParsed(id);
  if (!result || result.problems.some((problem) => problem.level === 'error')) return null;
  return fillScene(result.scene, options);
}
