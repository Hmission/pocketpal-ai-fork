import {chatSessionStore} from '../../store';
// R4-B：service 改走 store barrel 后，测试对象改用全局 mockImageGenStore（身份对齐）
import {mockImageGenStore} from '../../../__mocks__/stores/imageGenStore';
import {promptWriter} from '../promptWriter';
import {runImageTaskCard, runEditImageTaskCard} from '../chatImageTask';

// DreamLite 单通道（大王裁定 2026-08：聊天闭环只走唯一跑通模型）：
// generateDreamLiteEntry / editDreamLiteEntry 内部自保加载，驻留时秒级出图
jest.mock('../../services/promptWriter', () => ({
  promptWriter: {isLoaded: false, writePrompt: jest.fn()},
  isPrompterModelName: jest.fn().mockReturnValue(false),
}));

const mockGenerate = mockImageGenStore.generateDreamLiteEntry as jest.Mock;
const mockEdit = mockImageGenStore.editDreamLiteEntry as jest.Mock;
const mockDecode = mockImageGenStore.decodeEditImage as jest.Mock;
const mockWritePrompt = promptWriter.writePrompt as jest.Mock;

describe('runImageTaskCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerate.mockReset();
    mockEdit.mockReset();
    mockDecode.mockReset();
    mockWritePrompt.mockReset();
    (mockImageGenStore as any).error = null;
    (mockImageGenStore as any).modelLoaded = true;
    (mockImageGenStore as any).dreamliteLoaded = true;
    (promptWriter as any).isLoaded = false;
  });

  it('出图成功：插任务卡片→回写图片与提示词锚点（再来一张/编辑的依据）', async () => {
    mockGenerate.mockResolvedValue('file:///tmp/gen_1.png');

    await runImageTaskCard('一只猫');

    expect(chatSessionStore.addMessageToCurrentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('已识别为生图任务'),
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

  it('管家增强提示词：回写 metadata.imageEnhancedPrompt（渲染侧「管家优化为」展示）', async () => {
    mockGenerate.mockResolvedValue('file:///tmp/gen_enh.png');
    (promptWriter as any).isLoaded = true;
    mockWritePrompt.mockResolvedValue(
      'a cat sitting on a windowsill, masterpiece, best quality',
    );

    await runImageTaskCard('一只猫');

    // 引擎收到的是增强后的英文 SD 提示词
    expect(mockGenerate).toHaveBeenCalledWith(
      1024,
      1024,
      4,
      'a cat sitting on a windowsill, masterpiece, best quality',
    );
    expect(chatSessionStore.updateMessage).toHaveBeenCalledWith(
      expect.anything(),
      'session-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          imageEnhancedPrompt:
            'a cat sitting on a windowsill, masterpiece, best quality',
        }),
      }),
    );
  });

  it('管家未就绪：不写 imageEnhancedPrompt（静默回退原文）', async () => {
    mockGenerate.mockResolvedValue('file:///tmp/gen_raw.png');

    await runImageTaskCard('一只猫');

    const updateArg = (chatSessionStore.updateMessage as jest.Mock).mock
      .calls[0][2];
    expect(updateArg.metadata?.imageEnhancedPrompt).toBeUndefined();
    expect(mockGenerate).toHaveBeenCalledWith(1024, 1024, 4, '一只猫');
  });

  it('管家就绪但增强失败：写 enhancedFailed（显式失败，不静默，P0 净化）', async () => {
    mockGenerate.mockResolvedValue('file:///tmp/gen_fail.png');
    (promptWriter as any).isLoaded = true;
    mockWritePrompt.mockRejectedValue(new Error('completion failed'));

    await runImageTaskCard('一只猫');

    const updateArg = (chatSessionStore.updateMessage as jest.Mock).mock
      .calls[0][2];
    expect(updateArg.metadata?.enhancedFailed).toBe(true);
    expect(updateArg.metadata?.imageEnhancedPrompt).toBeUndefined();
    // 增强失败不阻断出图：引擎收到原文
    expect(mockGenerate).toHaveBeenCalledWith(1024, 1024, 4, '一只猫');
  });

  it('出图失败：回写失败文案 + imageTaskFailed（渲染侧出「重试」动作）', async () => {
    mockGenerate.mockResolvedValue(null);
    (mockImageGenStore as any).error = '引擎过热';

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
    const setFlag = mockImageGenStore.setChatInlineGenerating as jest.Mock;

    await runImageTaskCard('一只猫');

    expect(setFlag).toHaveBeenNthCalledWith(1, true);
    expect(setFlag).toHaveBeenLastCalledWith(false);

    // 失败路径同样复位
    setFlag.mockClear();
    mockGenerate.mockResolvedValue(null);
    (mockImageGenStore as any).error = '引擎过热';
    await runImageTaskCard('一条狗');
    expect(setFlag).toHaveBeenNthCalledWith(1, true);
    expect(setFlag).toHaveBeenLastCalledWith(false);
  });
});

describe('runEditImageTaskCard（P5 聊天内编辑闭环）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEdit.mockReset();
    mockDecode.mockReset();
    (mockImageGenStore as any).error = null;
    (mockImageGenStore as any).modelLoaded = true;
    (mockImageGenStore as any).dreamliteLoaded = true;
  });

  it('编辑成功：解码源图（双解码 1024²+512²）→DreamLite 编辑（视觉通道）→回写结果图', async () => {
    // 双解码：1024² → UNet cond；512² → TE 视觉通道（ViT）
    mockDecode
      .mockResolvedValueOnce(new Float32Array(4 * 1024 * 1024))
      .mockResolvedValueOnce(new Float32Array(3 * 512 * 512));
    mockEdit.mockResolvedValue('file:///tmp/edit_1.png');

    await runEditImageTaskCard('file:///tmp/src.png', '把背景改成海边');

    expect(mockDecode).toHaveBeenNthCalledWith(1, '/tmp/src.png', 1024);
    expect(mockDecode).toHaveBeenNthCalledWith(2, '/tmp/src.png', 512);
    expect(mockEdit).toHaveBeenCalledWith(
      expect.any(Float32Array),
      1024,
      1024,
      4,
      '把背景改成海边',
      expect.any(Float32Array), // visRgb（512² TE 视觉条件）
    );
    // 编辑指令不经过管家英文扩写（diptych 语义文本条件）
    expect(mockWritePrompt).not.toHaveBeenCalled();
    expect(chatSessionStore.updateMessage).toHaveBeenCalledWith(
      expect.anything(),
      'session-1',
      expect.objectContaining({
        text: expect.stringContaining('已为你编辑'),
        imageUris: ['file:///tmp/edit_1.png'],
        metadata: expect.objectContaining({
          editTask: true,
          editSourceUri: 'file:///tmp/src.png',
          editInstruction: '把背景改成海边',
        }),
      }),
    );
  });

  it('编辑失败：回写失败文案 + editTaskFailed（渲染侧出「重试」动作）', async () => {
    mockDecode
      .mockResolvedValueOnce(new Float32Array(4 * 1024 * 1024))
      .mockResolvedValueOnce(new Float32Array(3 * 512 * 512));
    mockEdit.mockResolvedValue(null);
    (mockImageGenStore as any).error = '源图解码失败';

    await runEditImageTaskCard('file:///tmp/src.png', '把背景改成海边');

    expect(chatSessionStore.updateMessage).toHaveBeenCalledWith(
      expect.anything(),
      'session-1',
      expect.objectContaining({
        text: expect.stringContaining('源图解码失败'),
        metadata: expect.objectContaining({
          editTask: true,
          editTaskFailed: true,
        }),
      }),
    );
  });
});
