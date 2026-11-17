/**
 * 公開先のFirebaseプロジェクトのウェブアプリの設定(docs/cloud-sync-design.mdの1章)。
 * APIキーはブラウザに書く種類の値で、公開してよい(守るのはfirestore.rulesとAuthenticationの承認済みドメイン)。
 * ログインのページ(src/auth/login-page.ts)と同期(cloud-sync.mjs)が使う。画面に依存しない。
 */
export const FIREBASE_WEB_CONFIG = Object.freeze({
  apiKey: "AIzaSyA7eRGv1OQHvOMEVafYqqn2nndayi13hdk",
  authDomain: "shogi-64125.firebaseapp.com",
  projectId: "shogi-64125",
  appId: "1:1096210341511:web:5323e12ba0c3a6cef96222",
});

/** 確かめのためのエミュレーター(127.0.0.1・localhostで、ログインのページを?emulator=1で開いたときだけ)。 */
export const FIREBASE_EMULATORS = Object.freeze({
  auth: "http://127.0.0.1:9099",
  firestore: "http://127.0.0.1:8080",
});

/** エミュレーターを使ってよい場所か(公開先では使わない)。 */
export const isLocalHost = (hostname) => hostname === "127.0.0.1" || hostname === "localhost";
