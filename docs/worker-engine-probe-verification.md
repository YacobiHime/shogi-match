# Workerエンジン疎通確認

WASM将棋エンジンを本番の対局処理へ組み込む前に、外側のWeb Worker内でエンジンを起動し、pthread用の入れ子Workerを含めて動作するか確認するための記録です。

## 確認方法

1. `npm run opening-editor`で開発サーバーを起動する。
2. `http://127.0.0.1:5173/engine-worker-probe.html`を対象ブラウザで開く。
3. `ok: true`と`crossOriginIsolated: true`が表示されることを確認する。
4. `workerUrl`と`scriptUrl`が`blob:`ではなく、`http:`または`https:`の実URLであることを確認する。

このプローブは`usiok`と`readyok`の受信までを確認した後、エンジンへ`quit`を送信します。本番の`ShogiEngine`はまだWorker版へ差し替えていません。

## 検証状況

| 環境 | 状態 | 備考 |
| --- | --- | --- |
| Windows / Chrome（ヘッドレス） | 自動確認済み | 2026-09-27。`ok: true`、`crossOriginIsolated: true`、外側WorkerとエンジンはいずれもHTTPの実URL |
| Windows / Firefox | 未確認 | 実ブラウザで上記手順を実施する |
| macOS / Safari | 未確認 | 入れ子Workerの互換性を重点確認する |
| Android / Chrome | 未確認 | 実機で上記手順を実施する |
| iOS / Safari | 未確認 | 本番差し替え前の必須確認。入れ子WorkerとBlob URLのエラー有無を重点確認する |

全対象ブラウザで疎通確認が済むまでは、Worker版を対局ランタイムの既定経路にしません。
