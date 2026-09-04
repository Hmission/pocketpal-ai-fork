/**
 * growth 单测（AIOS_CORE_SPEC Wave D）：迭代账本 + gap 清单 + 情绪台账
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  appendIteration,
  appendEmotion,
  writeGap,
  readIterations,
  readEmotions,
} from '../growth';
import {AIOS_GROWTH_DIR, AIOS_LOGS_DIR} from '../../../utils/paths';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  exists: jest.fn().mockResolvedValue(false),
  readFile: jest.fn().mockResolvedValue(''),
  writeFile: jest.fn().mockResolvedValue(undefined),
  appendFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  DocumentDirectoryPath: '/mock/documents',
  ExternalStorageDirectoryPath: '/mock/storage',
}));

jest.mock('../../../debug/eventStream', () => ({
  emit: jest.fn(),
}));

describe('growth（AIOS_CORE_SPEC Wave D）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.readFile as jest.Mock).mockResolvedValue('');
  });

  it('appendIteration 写 jsonl 行（含 date/ts/saw/source）', async () => {
    await appendIteration({saw: '今天看到了新东西', source: 'closing'});
    const call = (RNFS.appendFile as jest.Mock).mock.calls.find(
      c => c[0] === `${AIOS_GROWTH_DIR}/iterations.jsonl`,
    );
    expect(call).toBeTruthy();
    const rec = JSON.parse(String(call![1]).trim());
    expect(rec.saw).toBe('今天看到了新东西');
    expect(rec.source).toBe('closing');
    expect(rec.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rec.ts).toBeTruthy();
  });

  it('writeGap 空内容显式跳过（宁缺勿滥）', async () => {
    await writeGap('   ');
    expect(RNFS.writeFile).not.toHaveBeenCalled();
  });

  it('writeGap 正常内容当日一次（已存在不覆盖）', async () => {
    await writeGap('明天想长本体感觉');
    expect(RNFS.writeFile).toHaveBeenCalledTimes(1);
    const call = (RNFS.writeFile as jest.Mock).mock.calls[0];
    expect(String(call[0])).toContain(`${AIOS_GROWTH_DIR}/gap_`);
    expect(String(call[1])).toContain('明天想长本体感觉');
  });

  it('appendEmotion 按日分文件（emotion_YYYYMMDD.jsonl）', async () => {
    await appendEmotion({score: 1, label: '愉悦', source: 'trackSentiment'});
    const call = (RNFS.appendFile as jest.Mock).mock.calls.find(c =>
      String(c[0]).startsWith(`${AIOS_LOGS_DIR}/emotion_`),
    );
    expect(call).toBeTruthy();
    const rec = JSON.parse(String(call![1]).trim());
    expect(rec.score).toBe(1);
    expect(rec.source).toBe('trackSentiment');
  });

  it('readIterations 缺文件返回空数组；有文件解析并倒序', async () => {
    await expect(readIterations()).resolves.toEqual([]);

    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      [
        JSON.stringify({
          date: '2026-09-04',
          saw: 'a',
          source: 'closing',
          ts: '1',
        }),
        JSON.stringify({
          date: '2026-09-05',
          saw: 'b',
          source: 'closing',
          ts: '2',
        }),
      ].join('\n') + '\n',
    );
    const rows = await readIterations();
    expect(rows).toHaveLength(2);
    expect(rows[0].date).toBe('2026-09-05'); // 新→旧
  });

  it('readEmotions 容忍坏行（JSON 解析失败静默剔除）', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValue(
      '{"score":1,"label":"愉悦","source":"closing","ts":"x"}\n坏行\n',
    );
    const today = new Date().toISOString().slice(0, 10);
    const rows = await readEmotions(today);
    expect(rows).toHaveLength(1);
  });
});
