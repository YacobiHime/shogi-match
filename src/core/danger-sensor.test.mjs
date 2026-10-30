import { describe, expect, it } from 'vitest';
import { SENSOR_AUTO_MAX_LEVEL, dangerSensor, dangerSensorAuto, endangeredPieces } from './danger-sensor.mjs';

describe('危機感知センサー', () => {
  it('相手の今の手で取られて損をする形になった駒を、何に狙われているかと一緒に言う', () => {
    // 後手が角を打って、守りのない5六の銀に当てた。
    const before = '4k4/9/9/9/9/4S4/9/9/4K4 w b 1';
    const after = '4k4/9/7b1/9/9/4S4/9/9/4K4 b - 2';
    expect(dangerSensor({ sfen: after, previousSfen: before, color: 'black' }))
      .toEqual({ squares: ['5f'], key: 'threat-sensor-5f', text: '銀が角に狙われてるよ！' });
  });

  it('両取りは2枚とも言う(値打ちの高い順)', () => {
    const before = '4k4/9/9/9/9/9/3G1S3/9/K8 w n 1';
    const after = '4k4/9/9/9/4n4/9/3G1S3/9/K8 b - 2';
    const sensed = dangerSensor({ sfen: after, previousSfen: before, color: 'black' });
    expect(sensed?.text).toBe('金と銀が狙われてるよ！');
    expect(sensed?.squares).toEqual(['6g', '4g']);
  });

  it('守りが足りていて、取られても損をしない駒は言わない', () => {
    // 4八の銀は玉が守っている(角で取っても、玉で取り返せる)。
    expect(dangerSensor({ sfen: '4k4/9/9/9/8b/9/9/5S3/4K4 b - 2', previousSfen: '4k4/9/9/9/9/9/9/5S3/4K4 w b 1', color: 'black' })).toBeNull();
  });

  it('歩の当たりは言わない', () => {
    expect(endangeredPieces('4k4/9/7b1/9/9/4P4/9/9/4K4 b - 2', 'black')).toEqual([]);
  });

  it('前の局面から当たっていた駒は、もう一度は言わない(同じ知らせを毎手くり返さない)', () => {
    const loose = '4k4/9/7b1/9/9/4S4/9/9/4K4 b - 2';
    expect(dangerSensor({ sfen: loose, previousSfen: '4k4/9/7b1/9/9/4S4/9/9/4K4 w - 1', color: 'black' })).toBeNull();
    // 相手の手番だった局面がなければ、今の局面だけで決める。
    expect(dangerSensor({ sfen: loose, color: 'black' })?.squares).toEqual(['5f']);
  });

  it('後手の駒も、後手から見て同じように見る', () => {
    const before = '4k4/9/9/9/9/9/9/9/4K4 b B 1';
    const after = '4k4/9/4s4/9/9/9/9/9/4K4 b B 1';
    expect(endangeredPieces(after, 'white')).toEqual([]);
    const attacked = '4k4/9/4s4/9/9/9/8B/9/4K4 w - 2';
    expect(dangerSensor({ sfen: attacked, previousSfen: before, color: 'white' })?.text).toBe('銀が角に狙われてるよ！');
  });

  it('自動では、学習対局と7級までの相手との対局で付ける', () => {
    expect(dangerSensorAuto({ learning: true, cpuLevel: 40 })).toBe(true);
    expect(dangerSensorAuto({ cpuLevel: SENSOR_AUTO_MAX_LEVEL })).toBe(true);
    expect(dangerSensorAuto({ cpuLevel: SENSOR_AUTO_MAX_LEVEL + 1 })).toBe(false);
    expect(endangeredPieces('not a sfen', 'black')).toEqual([]);
  });
});
