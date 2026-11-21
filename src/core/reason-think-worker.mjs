// 理由で指す棋士の考え方を、画面を止めないよう別の糸(Worker)で動かす(docs/disciple-mode-design.mdの34-17)。
import { thinkHere } from './reason-think.mjs';

self.onmessage = async (event) => {
  const { id, request } = event.data ?? {};
  try {
    const result = await thinkHere(request);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: String(error?.message ?? error) });
  }
};
