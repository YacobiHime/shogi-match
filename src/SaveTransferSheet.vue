<template>
  <!--
    引き継ぎ(docs/save-transfer-design.md)。ホームの「引き継ぎ」から開く。
    送る(コードを作る・ファイルに書き出す)と受け取る(コードを入れる・ファイルを読み込む)の2組。
    受け取るときは、置き換える前に両方の記録の要約を並べて確かめる。最初のフォーカスは「戻る」(UD:5-2、U:3-1)。
    置き換えたらページを読み直す(データリセットと同じ。どの画面も新しい記録から始まる)。
    Googleアカウントの同期(docs/cloud-sync-design.mdの6章)：メニューのいちばん上の組(ログイン・状態・今すぐ同期・ログアウト)と、
    どちらの記録を使うかの段(cloud-choice。初期フォーカスは「あとで決める」)、クラウドの記録を消す段(cloud-delete)。
  -->
  <div
    class="shogi-game__confirm shogi-game__confirm--over-home"
    :role="step === 'confirm' || step === 'cloud-choice' || step === 'cloud-delete' ? 'alertdialog' : 'dialog'"
    aria-modal="true"
    aria-labelledby="save-transfer-title"
    data-save-transfer
    :data-step="step"
    @click.self="onBackdrop"
  >
    <div class="shogi-game__confirm-panel shogi-welcome save-transfer">
      <template v-if="step === 'menu'">
        <h2 id="save-transfer-title">{{ T.title }}</h2>
        <p>{{ T.lead }}</p>
        <div class="save-transfer__groups">
          <section v-if="sync" class="save-transfer__group save-transfer__sync" data-sync-group>
            <h3>{{ S.head }}</h3>
            <template v-if="sync.signedIn.value">
              <p class="save-transfer__account" data-sync-account>{{ S.signedInAs(accountName) }}<small v-if="accountEmail">{{ accountEmail }}</small></p>
              <p class="save-transfer__note" data-sync-saved>{{ sync.savedAt.value ? S.lastSaved(formatSaveTime(sync.savedAt.value)) : S.notSavedYet }}</p>
              <div class="save-transfer__row">
                <button type="button" data-sync-now :disabled="sync.status.value === 'syncing'" @click="sync.syncNow()">{{ sync.status.value === "syncing" ? sync.statusText.value : S.syncNow }}</button>
                <button type="button" data-sync-sign-out :disabled="sync.status.value === 'syncing'" @click="sync.signOut()">{{ S.signOut }}</button>
              </div>
              <button type="button" class="save-transfer__small" data-sync-delete @click="go('cloud-delete')">{{ S.deleteCloud }}</button>
            </template>
            <ul v-else class="shogi-welcome__choices">
              <li>
                <button type="button" data-sync-sign-in @click="sync.signIn()">
                  <strong>{{ S.signIn }}</strong><small>{{ S.signInNote }}</small>
                </button>
              </li>
            </ul>
            <p v-if="sync.message.value" class="save-transfer__notice" role="status" data-sync-message>{{ sync.message.value }}</p>
          </section>
          <section class="save-transfer__group">
            <h3>{{ T.sendHead }}</h3>
            <ul class="shogi-welcome__choices">
              <li v-if="cloud">
                <button type="button" data-transfer-make-code @click="makeCode">
                  <strong>{{ T.makeCode }}</strong><small>{{ T.makeCodeNote }}</small>
                </button>
              </li>
              <li>
                <button type="button" data-transfer-export @click="exportFile">
                  <strong>{{ T.exportFile }}</strong><small>{{ T.exportFileNote }}</small>
                </button>
              </li>
            </ul>
          </section>
          <section class="save-transfer__group">
            <h3>{{ T.receiveHead }}</h3>
            <ul class="shogi-welcome__choices">
              <li v-if="cloud">
                <button type="button" data-transfer-enter-code @click="openEnter">
                  <strong>{{ T.enterCode }}</strong><small>{{ T.enterCodeNote }}</small>
                </button>
              </li>
              <li>
                <button type="button" data-transfer-import @click="fileInput?.click()">
                  <strong>{{ T.importFile }}</strong><small>{{ T.importFileNote }}</small>
                </button>
              </li>
            </ul>
          </section>
        </div>
        <p v-if="!cloud" class="save-transfer__note">{{ T.cloudOff }}</p>
        <p v-if="notice" class="save-transfer__notice" role="status" data-transfer-notice>{{ notice }}</p>
        <p v-if="error" class="save-transfer__error" role="alert" data-transfer-error>{{ error }}</p>
        <input ref="fileInput" type="file" accept=".json,application/json" class="save-transfer__file" tabindex="-1" aria-hidden="true" @change="onFile" />
        <button ref="firstFocus" type="button" class="shogi-welcome__skip" data-transfer-close @click="emit('close')">{{ T.close }}</button>
      </template>

      <template v-else-if="step === 'busy'">
        <h2 id="save-transfer-title">{{ T.title }}</h2>
        <p class="save-transfer__busy" role="status"><span class="save-transfer__spinner" aria-hidden="true"></span>{{ busyText }}</p>
      </template>

      <template v-else-if="step === 'code'">
        <h2 id="save-transfer-title">{{ T.codeHead }}</h2>
        <p class="save-transfer__code" data-transfer-code>{{ formatTransferCode(madeCode) }}</p>
        <p>{{ T.codeUntil(formatSaveTime(madeUntil)) }}</p>
        <p class="save-transfer__note">{{ T.codeHow }}</p>
        <div class="save-transfer__row">
          <button type="button" data-transfer-copy @click="copyCode">{{ copied ? T.copied : T.copy }}</button>
          <button ref="firstFocus" type="button" data-transfer-close @click="emit('close')">{{ T.close }}</button>
        </div>
      </template>

      <template v-else-if="step === 'enter'">
        <h2 id="save-transfer-title">{{ T.enterHead }}</h2>
        <form class="save-transfer__enter" @submit.prevent="receiveCode">
          <input
            ref="firstFocus"
            v-model="codeInput"
            class="save-transfer__input"
            type="text"
            inputmode="text"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            maxlength="20"
            :placeholder="'XXXX-XXXX-XXXX'"
            :aria-describedby="error ? 'save-transfer-enter-error' : 'save-transfer-enter-hint'"
            data-transfer-code-input
          />
          <p v-if="error" id="save-transfer-enter-error" class="save-transfer__error" role="alert" data-transfer-error>{{ error }}</p>
          <p v-else id="save-transfer-enter-hint" class="save-transfer__note">{{ T.enterHint }}</p>
          <div class="save-transfer__row">
            <button type="button" @click="toMenu">{{ T.back }}</button>
            <button type="submit" class="save-transfer__go" data-transfer-receive>{{ T.receive }}</button>
          </div>
        </form>
      </template>

      <template v-else-if="step === 'cloud-choice' && sync && sync.choice.value">
        <h2 id="save-transfer-title">{{ S.chooseHead }}</h2>
        <p>{{ sync.choice.value.first ? S.chooseFirst : S.chooseLead }}{{ S.chooseNote }}</p>
        <div class="save-transfer__compare">
          <section data-sync-choice-local>
            <h3>{{ S.local }}</h3>
            <ul><li v-for="line in sync.choice.value.localLines" :key="line">{{ line }}</li></ul>
            <button type="button" class="shogi-game__confirm-danger" data-sync-use-local :disabled="sync.status.value === 'syncing'" @click="sync.useLocal()">{{ S.useThis }}</button>
          </section>
          <section data-sync-choice-cloud>
            <h3>{{ S.cloud }}</h3>
            <ul><li v-for="line in sync.choice.value.cloudLines" :key="line">{{ line }}</li></ul>
            <button type="button" class="shogi-game__confirm-danger" data-sync-use-cloud :disabled="sync.status.value === 'syncing' || sync.choice.value.cloudBroken" @click="sync.useCloud()">{{ S.useThis }}</button>
          </section>
        </div>
        <button type="button" class="save-transfer__keep" data-sync-keep @click="keepLocal">{{ keptLocal ? S.keptLocal : S.keepLocal }}</button>
        <p v-if="sync.message.value" class="save-transfer__error" role="alert" data-sync-message>{{ sync.message.value }}</p>
        <div>
          <button ref="firstFocus" type="button" data-sync-later @click="emit('close')">{{ S.later }}</button>
        </div>
      </template>

      <template v-else-if="step === 'cloud-delete' && sync">
        <h2 id="save-transfer-title">{{ S.deleteHead }}</h2>
        <p>{{ S.deleteNote }}</p>
        <div>
          <button type="button" class="shogi-game__confirm-danger" data-sync-delete-go :disabled="sync.status.value === 'syncing'" @click="deleteCloud">{{ S.deleteGo }}</button>
          <button ref="firstFocus" type="button" @click="toMenu">{{ T.back }}</button>
        </div>
      </template>

      <template v-else-if="step === 'confirm' && incoming">
        <h2 id="save-transfer-title">{{ T.confirmHead }}</h2>
        <p>{{ T.confirmNote }}</p>
        <div class="save-transfer__compare">
          <section data-transfer-incoming>
            <h3>{{ T.incoming }}</h3>
            <ul><li v-for="line in incomingLines" :key="line">{{ line }}</li></ul>
          </section>
          <section data-transfer-current>
            <h3>{{ T.current }}</h3>
            <ul><li v-for="line in currentLines" :key="line">{{ line }}</li></ul>
          </section>
        </div>
        <button type="button" class="save-transfer__keep" data-transfer-keep @click="keepCurrent">{{ kept ? T.keptCurrent : T.keepCurrent }}</button>
        <p v-if="error" class="save-transfer__error" role="alert" data-transfer-error>{{ error }}</p>
        <div>
          <button type="button" class="shogi-game__confirm-danger" data-transfer-apply @click="apply">{{ T.replace }}</button>
          <button ref="firstFocus" type="button" @click="toMenu">{{ T.back }}</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type PropType } from "vue";
import {
  SAVE_TRANSFER_TEXT as T, applySave, collectSave, decodeSave, encodeSave, formatSaveTime, saveFileName, summarizeSave, summaryLines,
} from "./core/save-transfer.mjs";
import { SaveCloudError, deleteSave, downloadSave, formatTransferCode, normalizeTransferCode, rememberTransferCode, uploadSave } from "./core/save-cloud.mjs";
import { CLOUD_SYNC_TEXT as S } from "./core/cloud-sync.mjs";
import type { CloudSyncApi } from "./composables/useCloudSync";

type Step = "menu" | "busy" | "code" | "enter" | "confirm" | "cloud-choice" | "cloud-delete";

const props = defineProps({
  /** 引き継ぎコードを使えるか(公式の公開先だけ。core/save-cloud.mjsのcanUseSaveCloud)。 */
  cloud: { type: Boolean, default: false },
  /** Googleアカウントの同期(公式の公開先だけ。composables/useCloudSync.ts)。使えないときはnull。 */
  sync: { type: Object as PropType<CloudSyncApi | null>, default: null },
  /** 開く段(同期でどちらを使うか聞くときは cloud-choice)。 */
  startStep: { type: String as PropType<"menu" | "cloud-choice">, default: "menu" },
});
const emit = defineEmits<{ close: [] }>();

type Bundle = { format: string; v: number; at: number; entries: Record<string, string> };

const step = ref<Step>(props.startStep === "cloud-choice" && props.sync?.choice.value ? "cloud-choice" : "menu");
const keptLocal = ref(false);
/** ログインしている人の名前(表示名。なければメールアドレス)と、その下に小さく出すメールアドレス。 */
const accountName = computed(() => {
  const state = props.sync?.state.value;
  if (!state) return "";
  return state.name || state.email || "Googleアカウント";
});
const accountEmail = computed(() => {
  const state = props.sync?.state.value;
  return state?.name && state.email ? state.email : "";
});
const busyText = ref("");
const error = ref("");
const notice = ref("");
const madeCode = ref("");
const madeUntil = ref(0);
const copied = ref(false);
const codeInput = ref("");
const incoming = ref<Bundle | null>(null);
/** コードで受け取ったときのコードと分けた数(置き換えたら預けた記録を消す)。 */
const received = ref<{ code: string; parts: number } | null>(null);
const kept = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const firstFocus = ref<HTMLElement | null>(null);

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const incomingLines = computed(() => (incoming.value ? summaryLines(summarizeSave(incoming.value)) : []));
const currentLines = computed(() => {
  void incoming.value;
  return summaryLines({ ...summarizeSave(collectSave(storage())), at: 0 });
});

function focusFirst() {
  void nextTick(() => firstFocus.value?.focus());
}
onMounted(focusFirst);

function go(next: Step) {
  step.value = next;
  focusFirst();
}

function toMenu() {
  error.value = "";
  incoming.value = null;
  received.value = null;
  kept.value = false;
  go("menu");
}

function errorText(reason: string) {
  return (T.errors as Record<string, string>)[reason] ?? T.errors.broken;
}

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportFile() {
  const bundle = collectSave(storage());
  const name = saveFileName(bundle.at);
  download(encodeSave(bundle), name);
  error.value = "";
  notice.value = T.exported(name);
}

async function makeCode() {
  error.value = "";
  notice.value = "";
  busyText.value = T.uploading;
  go("busy");
  try {
    const made = await uploadSave(encodeSave(collectSave(storage())));
    // 受け取られなかったら、期限のあとにこの端末が消す(docs/save-transfer-design.mdの6章)。
    rememberTransferCode(storage(), made);
    madeCode.value = made.code;
    madeUntil.value = made.expireAt;
    copied.value = false;
    go("code");
  } catch (cause) {
    error.value = errorText(cause instanceof SaveCloudError ? cause.reason : "offline");
    go("menu");
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(formatTransferCode(madeCode.value));
    copied.value = true;
  } catch {
    // コピーできない環境では、コードを読んで打ってもらう。
  }
}

function openEnter() {
  error.value = "";
  notice.value = "";
  codeInput.value = "";
  go("enter");
}

function showIncoming(text: string) {
  const decoded = decodeSave(text);
  if (decoded.ok === false) return decoded.reason;
  incoming.value = decoded.bundle as Bundle;
  kept.value = false;
  error.value = "";
  go("confirm");
  return "";
}

async function receiveCode() {
  const code = normalizeTransferCode(codeInput.value);
  if (!code) {
    error.value = T.errors.code;
    return;
  }
  error.value = "";
  busyText.value = T.downloading;
  go("busy");
  try {
    const got = await downloadSave(code);
    received.value = { code, parts: got.parts };
    const reason = showIncoming(got.text);
    if (reason) {
      error.value = errorText(reason === "broken" ? "broken" : reason);
      go("enter");
    }
  } catch (cause) {
    error.value = errorText(cause instanceof SaveCloudError ? cause.reason : "offline");
    go("enter");
  }
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  notice.value = "";
  received.value = null;
  let text = "";
  try {
    text = await file.text();
  } catch {
    error.value = T.errors.file;
    return;
  }
  const reason = showIncoming(text);
  if (reason) error.value = errorText(reason === "broken" ? "file" : reason);
}

/** どちらを使うかの段で、この端末の記録をファイルに残す(選ばなかったほうの安全網。D:4-3)。 */
function keepLocal() {
  const bundle = collectSave(storage());
  download(encodeSave(bundle), saveFileName(bundle.at).replace(".json", "-this-device.json"));
  keptLocal.value = true;
}

async function deleteCloud() {
  await props.sync?.deleteCloud();
  if (!props.sync?.signedIn.value) toMenu();
}

// どちらを使うかの答えが出たら(クラウドに保存できた)、メニューへ戻す。読み込むときはページを読み直す。
watch(() => props.sync?.status.value, (status) => {
  if (step.value === "cloud-choice" && status !== "choose" && status !== "syncing" && !props.sync?.choice.value) toMenu();
});

function keepCurrent() {
  const bundle = collectSave(storage());
  download(encodeSave(bundle), saveFileName(bundle.at).replace(".json", "-before.json"));
  kept.value = true;
}

async function apply() {
  if (!incoming.value) return;
  const result = applySave(storage(), incoming.value);
  if (!result.ok) {
    error.value = T.errors.apply;
    return;
  }
  // コードは1回だけ使える。消せなくても7日で読めなくなる。
  if (received.value) await deleteSave(received.value.code, { parts: received.value.parts }).catch(() => undefined);
  // 確認は閉じないまま読み直す(閉じると戻る操作の見張りを外すhistory.back()が走り、読み直しが取り消される)。
  window.location.reload();
}

function onBackdrop() {
  if (step.value === "busy") return;
  if (!goBack()) emit("close");
}

/** 戻る操作(ブラウザの戻る・Esc)。段の中で戻れたら真。メニューなら偽(親が閉じる)。 */
function goBack(): boolean {
  if (step.value === "busy") return true;
  if (step.value === "menu") return false;
  // どちらを使うかの段は「あとで決める」と同じ(閉じる)。
  if (step.value === "cloud-choice") return false;
  toMenu();
  return true;
}

defineExpose({ goBack });
</script>

<style scoped>
.save-transfer { max-width: min(40em, 100%); }
.save-transfer .save-transfer__groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(15em, 100%), 1fr)); gap: 0.6em; }
.save-transfer__group h3,
.save-transfer__compare h3 { margin: 0 0 0.3em; font-size: 0.9em; opacity: 0.85; }
.save-transfer__group .shogi-welcome__choices { grid-template-columns: repeat(auto-fit, minmax(min(11em, 100%), 1fr)); gap: 0.4em; }
.save-transfer__note { font-size: 0.85em; opacity: 0.85; }
.save-transfer__notice { font-weight: 700; }
.save-transfer__error { color: #f6b2ae; font-weight: 700; }
.save-transfer__file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.save-transfer__busy { display: flex; align-items: center; gap: 0.6em; justify-content: center; min-height: 4em; }
.save-transfer__spinner {
  width: 1.2em;
  height: 1.2em;
  border: 3px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: save-transfer-spin 0.9s linear infinite;
}
@keyframes save-transfer-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .save-transfer__spinner { animation-duration: 3s; } }
.save-transfer__code {
  margin: 0.3em 0;
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: clamp(1.4em, 7vw, 2.2em);
  font-weight: 800;
  letter-spacing: 0.08em;
  text-align: center;
  user-select: all;
}
.save-transfer__row { display: flex; flex-wrap: wrap; gap: 0.5em; justify-content: center; }
.save-transfer__enter { display: grid; gap: 0.5em; }
.save-transfer__input {
  min-height: 48px;
  padding: 0.3em 0.6em;
  border: 2px solid currentColor;
  border-radius: 0.5em;
  background: rgba(255, 252, 244, 0.95);
  color: #1d303f;
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 1.3em;
  letter-spacing: 0.06em;
  text-align: center;
  text-transform: uppercase;
}
.save-transfer__compare { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6em; text-align: left; }
.save-transfer__compare section { padding: 0.5em 0.6em; border: 1px solid rgba(255, 252, 244, 0.35); border-radius: 0.5em; }
.save-transfer__compare ul { margin: 0; padding-left: 1.1em; font-size: 0.88em; }
.save-transfer__keep { justify-self: center; font-size: 0.9em; }
.save-transfer__sync { grid-column: 1 / -1; padding: 0.5em 0.6em; border: 1px solid rgba(255, 252, 244, 0.35); border-radius: 0.6em; }
.save-transfer__account { margin: 0.2em 0; font-weight: 700; overflow-wrap: anywhere; }
.save-transfer__account small { display: block; font-size: 0.8em; font-weight: 400; opacity: 0.85; }
.save-transfer__small { margin-top: 0.4em; font-size: 0.82em; min-height: 44px; }
.save-transfer__compare section { display: grid; gap: 0.4em; align-content: start; }
.save-transfer__compare section .shogi-game__confirm-danger { justify-self: center; }
@media (max-width: 30em) {
  .save-transfer__group .shogi-welcome__choices,
  .save-transfer__compare { grid-template-columns: minmax(0, 1fr); }
}
</style>
