import { describe, expect, it } from 'vitest';
import { BLIP_MIN_GAP_MS, VOICE_PITCH, VOICE_STYLES, blipPlan, clickPlan, normalizeVoiceStyle, voiceKind } from './novel-sound.mjs';

describe('ノベルの場面の文字の音(docs/novel-scene-design.mdの11章)', () => {
  it('おまかせは地の文がタイプ・台詞が信号。タイプ・信号はみんな同じ形、なしは鳴らさない', () => {
    expect(Object.keys(VOICE_STYLES)).toEqual(['auto', 'type', 'signal', 'off']);
    expect(voiceKind('narration', 'auto')).toBe('type');
    expect(voiceKind('hanane', 'auto')).toBe('signal');
    expect(voiceKind('narration', 'signal')).toBe('signal');
    expect(voiceKind('momoka', 'type')).toBe('type');
    expect(voiceKind('hanane', 'off')).toBeNull();
  });

  it('空白・句読点・かっこでは鳴らさず、間が短すぎるときも鳴らさない', () => {
    for (const char of ['、', '。', '！', '？', '…', '「', '」', ' ', 'ー']) {
      expect(blipPlan({ char, who: 'hanane', style: 'auto', sinceLastMs: 999 })).toBeNull();
    }
    expect(blipPlan({ char: 'あ', who: 'hanane', style: 'auto', sinceLastMs: BLIP_MIN_GAP_MS - 1 })).toBeNull();
    expect(blipPlan({ char: 'あ', who: 'hanane', style: 'auto', sinceLastMs: BLIP_MIN_GAP_MS })).not.toBeNull();
    expect(blipPlan({ char: 'あ', who: 'hanane', style: 'off', sinceLastMs: 999 })).toBeNull();
  });

  it('信号は話す人ごとの高さ(羽音は低め・百花は高め)で、同じ字は同じ音。短い音と長い音が混ざる', () => {
    const hanane = blipPlan({ char: '将', who: 'hanane', style: 'auto', sinceLastMs: 999 });
    const momoka = blipPlan({ char: '将', who: 'momoka', style: 'auto', sinceLastMs: 999 });
    expect(hanane.kind).toBe('signal');
    expect(hanane.freq).toBeLessThan(momoka.freq);
    expect(Math.abs(hanane.freq - VOICE_PITCH.hanane)).toBeLessThanOrEqual(VOICE_PITCH.hanane * 0.03 + 1);
    expect(blipPlan({ char: '将', who: 'hanane', style: 'auto', sinceLastMs: 999 })).toEqual(hanane);
    const lengths = new Set(Array.from('放課後の空き教室に羽音がいた').map((char) => blipPlan({ char, who: 'momoka', style: 'signal', sinceLastMs: 999 })?.ms));
    expect([...lengths].sort()).toEqual([32, 70]);
  });

  it('タイプは短い雑音。知らない人は真ん中の高さ', () => {
    const type = blipPlan({ char: 'か', who: 'narration', style: 'auto', sinceLastMs: 999 });
    expect(type).toMatchObject({ kind: 'type', ms: 16 });
    expect(blipPlan({ char: 'か', who: 'stranger', style: 'signal', sinceLastMs: 999 }).freq).toBeGreaterThan(600);
  });

  it('クリックの音は進む・答え・ボタンで少しずつ違い、答えがいちばんはっきり', () => {
    const click = clickPlan('click');
    const choice = clickPlan('choice');
    const tool = clickPlan('tool');
    expect(click.from).toBeGreaterThan(click.to);
    expect(choice.gain).toBeGreaterThan(click.gain);
    expect(tool.gain).toBeLessThan(click.gain);
    expect(normalizeVoiceStyle('signal')).toBe('signal');
    expect(normalizeVoiceStyle('beep')).toBe('auto');
    expect(normalizeVoiceStyle(undefined)).toBe('auto');
  });
});
