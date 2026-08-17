/**
 * api/openai — 转发入口（api 域拆分 · 批次4 P3）
 *
 * 原 1095 行肥文件已按接口族拆分至 ./openaiClient/（types/helpers/toolCalls/
 * connection/imageInline/reasoningPayload/stream）。本文件保留为纯转发，
 * 外部 `from '../api/openai'` 引用零变化；新代码请直接引用 openaiClient 子模块。
 */
export * from './openaiClient';
