import {routeTask} from '../taskRouter';

describe('taskRouter', () => {
  describe('image 任务', () => {
    it('命中中文「画…图」并提取主体', () => {
      const r = routeTask('画一只红色的龙');
      expect(r.task).toBe('image');
      expect(r.payload).toBe('一只红色的龙');
    });
    it('命中「生成…壁纸」', () => {
      const r = routeTask('帮我生成一张赛博朋克城市壁纸');
      expect(r.task).toBe('image');
      expect(r.payload).toBe('帮我生成一张赛博朋克城市壁纸');
    });
    it('命中英文 draw image', () => {
      const r = routeTask('draw a cute cat image');
      expect(r.task).toBe('image');
    });
    // v2.1 边界补齐（2026-08-16）：长描述/标点/照片措辞/句界截断
    it('v2.1 长描述含逗号句号：命中且主体截断到句界（真实用户例句）', () => {
      const r = routeTask(
        '画一张美女在河里洗澡的照片，超写实风格。长发在水里浣洗，玲珑有致的身材。',
      );
      expect(r.task).toBe('image');
      expect(r.payload).toBe('美女在河里洗澡的照片，超写实风格');
    });
    it('v2.1 超 40 字符无标点长描述仍命中（长度放宽 40→80）', () => {
      const r = routeTask(
        '画一只金毛犬在公园草坪上追逐飞盘阳光很好天空很蓝草地上还有一只柯基犬在打滚旁边坐着一个小男孩正在吃冰淇淋',
      );
      expect(r.task).toBe('image');
      expect(r.payload.length).toBeGreaterThan(40);
    });
    it('v2.1 「画…照片」措辞命中（照片补入目标词）', () => {
      const r = routeTask('画一张美女在河边洗澡的照片');
      expect(r.task).toBe('image');
    });
    it('v2.1 「生成一张照片」命中（生成+张/幅量词+照片分支）', () => {
      expect(routeTask('生成一张照片').task).toBe('image');
    });
    it('v2.1 句界截断：不吞「。帮我写首诗」后续句', () => {
      const r = routeTask('画一只猫。帮我写首诗');
      expect(r.task).toBe('image');
      expect(r.payload).toBe('一只猫');
    });
    it('v2.2 快捷前缀「图像生成：」命中且剥离前缀', () => {
      const r = routeTask('图像生成：一只在河边洗澡的美女');
      expect(r.task).toBe('image');
      expect(r.payload).toBe('一只在河边洗澡的美女');
    });
    it('v2.2 「图像生成：」后无内容不路由（无主体不生成）', () => {
      expect(routeTask('图像生成：').task).toBe('chitchat');
    });
    it('v2.2 「图片编辑：」无源图不走 image 路由（显式链路走 scheduler）', () => {
      expect(routeTask('图片编辑：把背景改红').task).toBe('chitchat');
    });
  });

  describe('write 任务', () => {
    it('命中「写一首诗」', () => {
      expect(routeTask('写一首关于秋天的诗').task).toBe('write');
    });
    it('命中「写文章」', () => {
      expect(routeTask('帮我写一篇介绍人工智能的文章').task).toBe('write');
    });
    it('08-17 补词：命中「写游记/周记」（真机验证发现缺口）', () => {
      expect(routeTask('帮我写一篇周末游记').task).toBe('write');
      expect(routeTask('写一篇周记').task).toBe('write');
    });
    it('v2.1 防误伤：含「照片」的写作句（写+文章）不判生图', () => {
      expect(routeTask('帮我写一篇关于照片的文章').task).toBe('write');
    });
    it('v2.1 防误伤：「生成一篇…文章」无张/幅量词不判生图，落闲聊', () => {
      expect(routeTask('帮我生成一篇关于照片的文章').task).toBe('chitchat');
    });
  });

  describe('code 任务', () => {
    it('命中「写代码」', () => {
      expect(routeTask('帮我写一个排序的代码').task).toBe('code');
    });
    it('命中英文 write function', () => {
      expect(routeTask('write a function to sort an array').task).toBe('code');
    });
  });

  describe('chitchat 兜底', () => {
    it('普通问候归为闲聊', () => {
      expect(routeTask('你好，今天过得怎么样').task).toBe('chitchat');
    });
    it('不误伤含 error 的日常对话', () => {
      // 收紧的 CODE_RE 不应把闲聊里的 error 判成代码任务
      expect(routeTask('我今天心情有点 error 的感觉').task).toBe('chitchat');
    });
  });
});
