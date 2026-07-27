const DEFAULT_NNUE_BASE_PATH = '../../assets/nnue/';

/**
 * 敵マスタの評価関数ファイル名を、対局ページから取得するURLへ変換する。
 * nullはエンジン内蔵評価関数を表す。
 *
 * @param {string | null} nnueFile
 * @param {string} [basePath]
 * @returns {string | null}
 */
export function resolveNnuePath(nnueFile, basePath = DEFAULT_NNUE_BASE_PATH) {
  if (nnueFile === null) return null;
  if (typeof nnueFile !== 'string' || nnueFile.trim() === '') {
    throw new Error('nnue_fileはnullまたは空でないファイル名にしてください');
  }
  if (nnueFile === '.' || nnueFile === '..' || /[\\/]/.test(nnueFile)) {
    throw new Error('nnue_fileにはディレクトリを含まないファイル名を指定してください');
  }
  if (typeof basePath !== 'string' || basePath.trim() === '') {
    throw new Error('NNUEのベースパスは空でない文字列にしてください');
  }

  const normalizedBasePath = basePath.endsWith('/') ? basePath : basePath + '/';
  return normalizedBasePath + encodeURIComponent(nnueFile);
}
