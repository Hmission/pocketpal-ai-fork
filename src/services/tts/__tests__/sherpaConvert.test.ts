import * as RNFS from '@dr.pogodin/react-native-fs';

import {
  convertUnicodeIndexer,
  convertVoiceStyle,
  generateKokoroTokensTxt,
} from '../sherpaConvert';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

const mockReadFile = RNFS.readFile as jest.Mock;
const mockWriteFile = RNFS.writeFile as jest.Mock;

describe('sherpaConvert (B36)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateKokoroTokensTxt', () => {
    it('writes "<token> <id>" lines sorted by id', async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          model: {vocab: {b: 1, a: 0, ' ': 2}},
        }),
      );
      await generateKokoroTokensTxt('/t.json', '/tokens.txt');
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/tokens.txt',
        'a 0\nb 1\n  2\n',
        'utf8',
      );
    });

    it('throws when model.vocab is missing', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({model: {}}));
      await expect(
        generateKokoroTokensTxt('/t.json', '/t.txt'),
      ).rejects.toThrow('model.vocab');
    });
  });

  describe('convertUnicodeIndexer', () => {
    it('writes int32 LE binary', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify([-1, 0, 1, 65535]));
      await convertUnicodeIndexer('/u.json', '/u.bin');
      const [, b64] = mockWriteFile.mock.calls[0] as [string, string, string];
      expect(mockWriteFile.mock.calls[0]![2]).toBe('base64');
      const bytes = Buffer.from(b64, 'base64');
      expect(bytes.length).toBe(16);
      expect(bytes.readInt32LE(0)).toBe(-1);
      expect(bytes.readInt32LE(4)).toBe(0);
      expect(bytes.readInt32LE(8)).toBe(1);
      expect(bytes.readInt32LE(12)).toBe(65535);
    });
  });

  describe('convertVoiceStyle', () => {
    it('writes 6×int64 header + ttl/dp floats', async () => {
      // ttl: 1×2×3, dp: 1×2×1 → header [1,50,256,1,8,16] 固定
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          style_ttl: {
            data: [
              [
                [1, 2, 3],
                [4, 5, 6],
              ],
            ],
          },
          style_dp: {data: [[[0.5], [1.5]]]},
        }),
      );
      await convertVoiceStyle('/v.json', '/v.bin');
      const [, b64] = mockWriteFile.mock.calls[0] as [string, string, string];
      const bytes = Buffer.from(b64, 'base64');
      // 48 头 + 6×4 + 2×4 = 80
      expect(bytes.length).toBe(48 + 24 + 8);
      expect(bytes.readBigInt64LE(0)).toBe(1n);
      expect(bytes.readBigInt64LE(8)).toBe(50n);
      expect(bytes.readBigInt64LE(16)).toBe(256n);
      expect(bytes.readBigInt64LE(24)).toBe(1n);
      expect(bytes.readBigInt64LE(32)).toBe(8n);
      expect(bytes.readBigInt64LE(40)).toBe(16n);
      expect(bytes.readFloatLE(48)).toBe(1);
      expect(bytes.readFloatLE(52)).toBe(2);
      expect(bytes.readFloatLE(64)).toBe(5);
      expect(bytes.readFloatLE(68)).toBe(6);
      expect(bytes.readFloatLE(72)).toBe(0.5);
      expect(bytes.readFloatLE(76)).toBe(1.5);
    });

    it('throws when style_ttl/style_dp is missing', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));
      await expect(convertVoiceStyle('/v.json', '/v.bin')).rejects.toThrow(
        'style_ttl',
      );
    });
  });
});
