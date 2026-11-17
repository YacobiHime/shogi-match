import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ popup: vi.fn(), init: vi.fn(), emulator: vi.fn(), provider: { setCustomParameters: vi.fn() } }));
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class { setCustomParameters = sdk.provider.setCustomParameters; },
  browserPopupRedirectResolver: 'popup-resolver', inMemoryPersistence: 'memory-only',
  initializeAuth: sdk.init, connectAuthEmulator: sdk.emulator, signInWithPopup: sdk.popup,
}));
const KEY='yacobihime:shogi-match:cloud-sync:v1';
let store: Storage;
let click: (() => void) | undefined;
let button: { disabled: boolean; addEventListener: (event:string,fn:()=>void)=>void };
let message: { textContent: string; classList: { toggle: ReturnType<typeof vi.fn> } };
let back: { href: string };
let replace: ReturnType<typeof vi.fn>;
const flush=async()=>{ for(let i=0;i<30;i++)await Promise.resolve(); };
beforeEach(() => {
  vi.resetModules();sdk.popup.mockReset();sdk.init.mockReset();sdk.emulator.mockReset();sdk.provider.setCustomParameters.mockReset();
  sdk.init.mockReturnValue({});sdk.popup.mockResolvedValue({user:{uid:'new-user',email:'test@example.invalid',displayName:'test',refreshToken:'test-refresh'}});
  const values=new Map<string,string>();store={get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v)},removeItem:k=>{values.delete(k)},clear:()=>values.clear()};
  click=undefined;button={disabled:true,addEventListener:(_event,fn)=>{click=fn}};message={textContent:'',classList:{toggle:vi.fn()}};back={href:''};replace=vi.fn();
  vi.stubGlobal('window',{localStorage:store});vi.stubGlobal('location',{hostname:'shogi-64125.web.app',search:'?return=%2Fgame.html',replace});
  vi.stubGlobal('document',{querySelector:(selector:string)=>selector.includes('google')?button:selector.includes('message')?message:back});
});
afterEach(()=>vi.unstubAllGlobals());
describe('Googleログインのページ',()=>{
  it('Googleのアカウントを選び、今回の状態を保存してから元のページへ戻る',async()=>{
    await import('./login-page');expect(button.disabled).toBe(false);click?.();await flush();
    expect(sdk.provider.setCustomParameters).toHaveBeenCalledWith({prompt:'select_account'});
    expect(sdk.init).toHaveBeenCalledWith(expect.anything(),{persistence:'memory-only',popupRedirectResolver:'popup-resolver'});
    expect(JSON.parse(store.getItem(KEY)!)).toMatchObject({uid:'new-user',refreshToken:'test-refresh',base:null});expect(replace).toHaveBeenCalledWith('/game.html');
  });
  it('窓を閉じたときは戻らず、もう一度押せる',async()=>{
    sdk.popup.mockRejectedValue({code:'auth/popup-closed-by-user'});await import('./login-page');click?.();await flush();
    expect(message.textContent).toBe('');expect(button.disabled).toBe(false);expect(replace).not.toHaveBeenCalled();
  });
  it('保存に失敗した場合、以前のログインの印があってもゲームに戻らない',async()=>{
    store.setItem(KEY,JSON.stringify({uid:'old-user',refreshToken:'old-refresh',device:'old-device'}));store.setItem=()=>{throw Error('quota')};
    await import('./login-page');click?.();await flush();expect(message.textContent).toMatch(/保存できなかった/);expect(replace).not.toHaveBeenCalled();expect(button.disabled).toBe(false);
  });
  it('本番ではemulator=1を付けてもエミュレーターを使わない',async()=>{
    location.search='?emulator=1';await import('./login-page');expect(sdk.emulator).not.toHaveBeenCalled();
  });
});
