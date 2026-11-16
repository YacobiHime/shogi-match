import { describe, expect, it } from 'vitest';
import { rememberLogin } from './login-state.mjs';
import { CLOUD_SYNC_KEY, loadCloudState, newCloudState } from '../core/cloud-sync.mjs';
const account = { uid:'next-user', refreshToken:'next-refresh' };
describe('ログイン状態を保存してから戻る', () => {
  it('今回の印を保存できたときだけ成功する', () => {
    const values=new Map();const store={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
    const saved=rememberLogin(store,account);
    expect(loadCloudState(store)).toMatchObject({uid:account.uid,refreshToken:account.refreshToken,device:saved.device});
  });
  it('以前のログイン状態が残っていても、書き込みに失敗した新しいログインを成功扱いにしない', () => {
    const old=JSON.stringify(newCloudState({uid:'old-user',refreshToken:'old-refresh'}));
    const store={getItem:k=>k===CLOUD_SYNC_KEY?old:null,setItem:()=>{throw Error('quota');}};
    expect(()=>rememberLogin(store,account)).toThrowError(expect.objectContaining({code:'app/storage'}));
    expect(loadCloudState(store).uid).toBe('old-user');
  });
  it('保存が使えない端末でも成功扱いにしない', () => {
    expect(()=>rememberLogin(null,account)).toThrowError(expect.objectContaining({code:'app/storage'}));
  });
});
