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
  });

  describe('write 任务', () => {
    it('命中「写一首诗」', () => {
      expect(routeTask('写一首关于秋天的诗').task).toBe('write');
    });
    it('命中「写文章」', () => {
      expect(routeTask('帮我写一篇介绍人工智能的文章').task).toBe('write');
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
