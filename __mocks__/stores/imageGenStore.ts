/**
 * R4-B：imageGenStore mock（组件直连改 barrel 后走此 mock）。
 * 目标：组件套件不再构造真实 imageGenStore（engineMutex 注册 + DB 水合链
 * ——即 [ImageGenStore] migration failed 警告 + ~170MB 堆基线来源）。
 * 普通对象（与 __mocks__/stores 其它 mock 风格一致——jest.fn 身份保留，
 * 组件测试中渲染态由测试手动 act 驱动，与 mockChatSessionStore 同标准）。
 */
export const mockImageGenStore = {
  // 渲染态（对齐真实 store 消费面；测试可手动赋值 + act 驱动）
  loading: false,
  generating: false,
  chatInlineGenerating: false,
  modelLoaded: false,
  dreamliteLoaded: false,
  error: null as string | null,
  pendingPrompt: '',
  pendingEditSource: null as unknown,
  stepTime: 0,
  history: [] as unknown[],

  // action 方法（组件/服务调用面）
  beginTask: jest.fn(),
  failTask: jest.fn(),
  finishTask: jest.fn(),
  generate: jest.fn(),
  generateDreamLiteEntry: jest.fn(),
  decodeEditImage: jest.fn(),
  editDreamLiteEntry: jest.fn(),
  loadDreamLiteEntry: jest.fn(),
  loadModel: jest.fn(),
  unloadModel: jest.fn(),
  runCaptionTask: jest.fn(),
  recoverHistoryFromDisk: jest.fn(),
  saveToAlbum: jest.fn(),
  setChatInlineGenerating: jest.fn(),
  upscaleImageEntry: jest.fn(),
};
