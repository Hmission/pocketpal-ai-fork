/**
 * openaiClient/index — OpenAI 兼容客户端聚合入口（api 域拆分 · 批次4 P3）
 *
 * openai.ts（1095 行肥文件）按接口族拆分：
 *   types.ts            协议类型
 *   helpers.ts          超时裁定/SSE chunk 校验/请求头/URL 归一
 *   toolCalls.ts        流式 tool_calls 增量装配
 *   connection.ts       连接探测族（/v1/models、/props、testConnection、detectServerType）
 *   imageInline.ts      本地图片 base64 内联族（encode-once 缓存）
 *   reasoningPayload.ts 推理意图→服务器载荷翻译
 *   stream.ts           streamChatCompletion 流式补全
 *
 * src/api/openai.ts 保留为转发入口（外部 14 处引用路径零变化）。
 */
export * from './types';
export * from './helpers';
export * from './toolCalls';
export * from './connection';
export * from './imageInline';
export * from './reasoningPayload';
export * from './stream';
