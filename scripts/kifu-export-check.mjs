// 先にビルドと serve-static を起動する。NODE_PATHにリポジトリ外のPlaywrightを指定できる。
// node scripts/kifu-export-check.mjs [http://127.0.0.1:8799]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { Record, importKIF } from 'tsshogi';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:8799';
const out = '/tmp/shogi-kifu-export';
mkdirSync(out, { recursive: true });
const expected = new Record();
const moves = ['7g7f', '3c3d', '2g2f', '8c8d'];
for (const usi of moves) expected.append(expected.position.createMoveByUSI(usi));
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
function check(ok, text) { if (!ok) throw Error(text); console.log(`OK ${text}`); }
try {
  for (const [width, height] of [[390,844], [820,1180], [1366,768], [844,390]]) {
    const context = await browser.newContext({ viewport: {width,height}, acceptDownloads: true });
    const page = await context.newPage();
    await page.addInitScript(({ sfen, moves }) => {
      localStorage.clear();
      localStorage.setItem('yacobihime:shogi-match:player-name:v1', JSON.stringify({name:'やこび'}));
      const key = 'yacobihime:shogi-match:%2Fgame.html:standalone';
      localStorage.setItem(key, JSON.stringify({version:1, savedAt:Date.now(), initialSfen:sfen, startSfen:sfen, mode:'local', matchKind:'normal', moves, active:true, coachLevel:'off', activePlayerColor:'black', searchNodes:10000}));
    }, { sfen: expected.initialPosition.sfen, moves });
    await page.goto(`${base}/game.html?mode=local&black_name=先手の人&white_name=後手の人`);
    await page.waitForSelector('.shogi-game__menu-toggle');
    await page.locator('.shogi-game__menu-toggle').click();
    await page.waitForSelector('[data-kifu-export]');
    const menuFits = () => page.locator('.shogi-game__menu').evaluate(el => {
      const r=el.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1;
    });
    check(await menuFits(), `${width}×${height} メニューが画面に収まる`);
    const download = async (ply, sfen) => {
      const wait = page.waitForEvent('download');
      await page.locator('[data-kifu-export]').click();
      const file = await wait;
      check(file.suggestedFilename().endsWith(`-${ply}.kifu`), `${width}×${height} ${ply}手のファイル名`);
      const path = `${out}/${width}-${ply}.kifu`;
      await file.saveAs(path);
      const loaded=importKIF(readFileSync(path,'utf8'));
      check(!(loaded instanceof Error), 'KIFを読み直せる');
      loaded.goto(loaded.length);
      check(loaded.length===ply && loaded.position.sfen===sfen, '保存した棋譜の局面と手数が一致する');
      check(/棋譜ファイルを書き出した/.test(await page.locator('[data-kifu-export-notice]').textContent()), 'メニューに結果を表示する');
    };
    await download(4, expected.position.sfen);
    check(await menuFits(), '結果を表示したメニューも画面に収まる');
    await page.screenshot({path:`${out}/${width}x${height}.png`});
    if (width===390) {
      // 書き出したあとも実際に1手指し、続けた棋譜を再度保存する。
      await page.keyboard.press('Escape');
      await page.evaluate(()=>{window.kifuMoves=0;document.getElementById('game').addEventListener('match-move',()=>window.kifuMoves++);});
      const cells=await page.locator('.board.operation > div').evaluateAll(elements=>elements.slice(0,81).map(el=>{
        const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};
      }).sort((a,b)=>Math.abs(a.y-b.y)>1?a.y-b.y:a.x-b.x));
      for (const index of [5*9+7,4*9+7]) await page.mouse.click(cells[index].x,cells[index].y);
      await page.waitForFunction(()=>window.kifuMoves===1);
      const next=new Record();
      for(const usi of [...moves,'2f2e']) next.append(next.position.createMoveByUSI(usi));
      await page.locator('.shogi-game__menu-toggle').click();
      await download(5,next.position.sfen);
      await page.evaluate(()=>{window.kifuCreateUrl=URL.createObjectURL;URL.createObjectURL=()=>{throw Error('test');};});
      await page.locator('[data-kifu-export]').click();
      await page.waitForFunction(()=>document.querySelector('[data-kifu-export-notice]').textContent.includes('書き出せなかった'));
      check(true,'保存できない場合の案内');
      await page.evaluate(()=>{URL.createObjectURL=window.kifuCreateUrl;});
      await download(5,next.position.sfen);
    }
    await page.locator('.shogi-game__menu-close').scrollIntoViewIfNeeded();
    await page.locator('.shogi-game__menu-close').click();
    await page.waitForSelector('.shogi-game__menu', {state:'detached'});
    check(await page.locator('.shogi-game__menu').count()===0, 'スクロールしてメニューを閉じられる');
    await context.close();
  }
} finally { await browser.close(); }
