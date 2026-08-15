import {chatSessionStore} from '../../store';
import {imageGenStore} from '../../store/imageGenStore';
import {runImageTaskCard} from '../chatImageTask';

// DreamLite 单通道（大王裁定 2026-08：聊天闭环只走唯一跑通模型）：
// generateDreamLiteEntry 内部自保加载，驻留时秒级出图
jest.mock('../../store/imageGenStore', () => ({
  imageGenStore: {
    modelLoaded: true,
    dreamliteLoaded: true,
    error: null,
    generateDreamLiteEntry: jest.fn(),
    setChatInlineGenerating: jest.fn(),
  },
}));
jest.mock('../../services/promptWriter', () => ({
  promptWriter: {isLoaded: false, writePrompt: jest.fn()},
  isPrompterModelName: jest.fn().mockReturnValue(false),
}));

const mockGenerate = imageGenStore.generateDreamLiteEntry as jest.Mock;

describe('runImageTaskCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerate.mockReset();
    (imageGenStore as any).error = null;
  });

  it('出图成功：插任务卡片→回写图片与提示词锚点（再来一张/编辑的依据）', async () => {
    mockGenerate.mockResolvedValue('file:///tmp/gen_1.png');

    await runImageTaskCard('一只猫');

    expect(chatSessionStore.addMessageToCurrentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('正在准备生成'),
        metadata: expect.objectContaining({
          imageTask: true,
          imagePrompt: '一只猫',
        }),
      }),
    );
    expect(chatSessionStore.updateMessage).toHaveBeenCalledWith(
      expect.anything(),
      'session-1',
      expect.objectContaining({
        text: expect.stringContaining('已为你生成'),
        imageUris: ['file:///tmp/gen_1.png'],
      }),
    );
  });

  it('出图失败：回写失败文案 + imageTaskFailed（渲染侧出「重试」动作）', async () => {
    mockGenerate.mockResolvedValue(null);
    (imageGenStore as any).error = '引擎过热';

    await runImageTaskCard('一只猫');

    expect(chatSessionStore.updateMessage).toHaveBeenCalledWith(
      expect.anything(),
      'session-1',
      expect.objectContaining({
        text: expect.stringContaining('引擎过热'),
        metadata: expect.objectContaining({imageTaskFailed: true}),
      }),
    );
  });

  it('驻留引擎复用：直调 DreamLite 单通道（1024×1024·4 步），不走 SD manifest 选模', async () => {
    mockGenerate.mockResolvedValue('file:///tmp/gen_2.png');

    await runImageTaskCard('一条龙');

    expect(mockGenerate).toHaveBeenCalledWith(1024, 1024, 4, '一条龙');
  });

  it('聊天内联生图标志：开始置 true，结束（含失败）finally 复位 false', async () => {
    mockGenerate.mockResolvedValue('file:///tmp/gen_3.png');
    const setFlag = imageGenStore.setChatInlineGenerating as jest.Mock;

    await runImageTaskCard('一只猫');

    expect(setFlag).toHaveBeenNthCalledWith(1, true);
    expect(setFlag).toHaveBeenLastCalledWith(false);

    // 失败路径同样复位
    setFlag.mockClear();
    mockGenerate.mockResolvedValue(null);
    (imageGenStore as any).error = '引擎过热';
    await runImageTaskCard('一条狗');
    expect(setFlag).toHaveBeenNthCalledWith(1, true);
    expect(setFlag).toHaveBeenLastCalledWith(false);
  });
});
