/**
 * ログインのページ(auth.html)の中身(docs/cloud-sync-design.mdの5章)。
 * FirebaseのSDKでGoogleの窓を開いてログインし、得た「更新のための印」をこの端末の保存(cloud-sync.mjsのCLOUD_SYNC_KEY)に書いて、
 * 来たページへ戻る。SDKの保存は使わない(inMemoryPersistence。印の置き場所は1つだけにする)。
 * 対局画面からは読まない(SDKは最初に読むJSに入れない。vite.auth.config.jsで別に作る)。
 */
import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider, browserPopupRedirectResolver, connectAuthEmulator, inMemoryPersistence, initializeAuth, signInWithPopup,
} from "firebase/auth";
import { FIREBASE_EMULATORS, FIREBASE_WEB_CONFIG, isLocalHost } from "../core/firebase-config.mjs";
import { CLOUD_SYNC_KEY, newCloudState, saveCloudState } from "../core/cloud-sync.mjs";
import { loginErrorText, safeReturnPath } from "./login-text.mjs";

const params = new URLSearchParams(location.search);
const back = safeReturnPath(params.get("return"));
const emulator = isLocalHost(location.hostname) && params.get("emulator") === "1";

const button = document.querySelector<HTMLButtonElement>("[data-login-google]");
const message = document.querySelector<HTMLElement>("[data-login-message]");
const backLink = document.querySelector<HTMLAnchorElement>("[data-login-back]");
if (backLink) backLink.href = back;

function say(text: string, error = false) {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("login__message--error", error);
}

const app = initializeApp(FIREBASE_WEB_CONFIG);
const auth = initializeAuth(app, { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver });
if (emulator) connectAuthEmulator(auth, FIREBASE_EMULATORS.auth, { disableWarnings: true });

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function signIn() {
  if (!button) return;
  button.disabled = true;
  say("Googleの窓でアカウントを選んでね…");
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const { user } = await signInWithPopup(auth, provider);
    const store = storage();
    if (!store) throw Object.assign(new Error("storage"), { code: "app/storage" });
    saveCloudState(store, newCloudState({
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      refreshToken: user.refreshToken,
      emulator,
    }));
    if (!store.getItem(CLOUD_SYNC_KEY)) throw Object.assign(new Error("storage"), { code: "app/storage" });
    say("ログインしたよ。ゲームに戻るね…");
    location.replace(back);
  } catch (cause) {
    const code = String((cause as { code?: string })?.code ?? "");
    const text = loginErrorText(code);
    if (text) say(text, true);
    else say("");
    button.disabled = false;
  }
}

if (button) {
  button.addEventListener("click", () => void signIn());
  button.disabled = false;
}
