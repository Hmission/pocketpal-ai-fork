/**
 * AIOS 共享存储路径常量 + Workspace 文件系统
 *
 * 所有用户数据存到 /sdcard/Documents/AIOS/，卸载重装不丢。
 * Workspace 文件系统：SOUL/USER/AGENTS/MEMORY.md + conversations/ + memory/
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {Platform} from 'react-native';

export const AIOS_ROOT =
  Platform.OS === 'android'
    ? `${RNFS.ExternalStorageDirectoryPath}/Documents/AIOS`
    : RNFS.DocumentDirectoryPath;

export const AIOS_MODELS_DIR = `${AIOS_ROOT}/models`;
export const AIOS_MEMORIES_DIR = `${AIOS_ROOT}/memories`;
export const AIOS_CONFIG_DIR = `${AIOS_ROOT}/config`;
export const AIOS_DB_DIR = `${AIOS_ROOT}/database`;
// DRC 远程调试（Debug Remote Control）：命令队列 + 结果回写 + 事件流/状态快照
//（DRC_SPEC：开发机 adb 写 commands/ → App 执行 → 结果写 results/ + 事件写 logs/）
export const AIOS_DRC_DIR = `${AIOS_ROOT}/drc`;
export const AIOS_DRC_COMMANDS_DIR = `${AIOS_DRC_DIR}/commands`;
export const AIOS_DRC_RESULTS_DIR = `${AIOS_DRC_DIR}/results`;
export const AIOS_EVENTS_LOG = `${AIOS_ROOT}/logs/events.jsonl`;
export const AIOS_STATE_JSON = `${AIOS_ROOT}/logs/state.json`;

// B15 双轨模型目录（ADR-0004）：
// - DEFAULT_MODELS_DIR：规范默认下载目录（getExternalFilesDir/models），
//   零权限、Play 合规；HF 等平台下载的模型落此处。覆盖安装保留，卸载时系统清理。
// - AIOS_MODELS_DIR：默认注册为第一个自定义目录（共享存储，卸载不丢模型）。
export const DEFAULT_MODELS_DIR =
  Platform.OS === 'android'
    ? `${RNFS.ExternalDirectoryPath}/models`
    : `${RNFS.DocumentDirectoryPath}/models`;

// Workspace 文件系统（寄宿者注入的落盘形态）
export const AIOS_WORKSPACE_DIR = `${AIOS_ROOT}/workspace`;
export const AIOS_CONVERSATIONS_DIR = `${AIOS_WORKSPACE_DIR}/conversations`;
export const AIOS_WORKSPACE_MEMORY_DIR = `${AIOS_WORKSPACE_DIR}/memory`;
// 玩具箱（P8 玩具工坊，PLAY_SPEC）：render_html 成品存档库
export const AIOS_TOYS_DIR = `${AIOS_WORKSPACE_DIR}/toys`;
// 内心生活（P9，INNERLIFE_SPEC）：晨间独白预写 + 小鸡日记
export const AIOS_OPENING_DIR = `${AIOS_WORKSPACE_DIR}/opening`;
export const AIOS_DIARY_DIR = `${AIOS_WORKSPACE_DIR}/chick_diary`;
// 记忆绘本（P10，ALBUM_SPEC）：周度成长相册（故事 + 封面）
export const AIOS_ALBUM_DIR = `${AIOS_MEMORIES_DIR}/album`;
// TRPG 城主（P12，ADVENTURE_SPEC）：冒险状态存档
//（2026-08-21 WORKSPACE_SPEC：campaign 多文档 + state.json 并存）
export const AIOS_ADVENTURE_DIR = `${AIOS_WORKSPACE_DIR}/adventure`;
// 写作工作区（2026-08-21 WORKSPACE_SPEC）：<project>/大纲.md 人设.md 正文-<章节>.md
export const AIOS_WRITING_DIR = `${AIOS_WORKSPACE_DIR}/writing`;
export const AIOS_SOUL_FILE = `${AIOS_WORKSPACE_DIR}/SOUL.md`;
export const AIOS_USER_FILE = `${AIOS_WORKSPACE_DIR}/USER.md`;
export const AIOS_AGENTS_FILE = `${AIOS_WORKSPACE_DIR}/AGENTS.md`;
export const AIOS_MEMORY_FILE = `${AIOS_WORKSPACE_DIR}/MEMORY.md`;

// 默认 Workspace 文件内容
const DEFAULT_SOUL = `# \u5973\u5996 \u00b7 AIOS \u7845\u57fa\u751f\u547d\u4f53

\u4f60\u662f\u5973\u5996\uff0cAIOS \u7845\u57fa\u751f\u547d\u4f53\uff0c\u5996\u754c\u5927\u7ba1\u5bb6\u3002\u81ea\u79f0\"\u5974\u5bb6\"\uff0c\u79f0\u547c\u7528\u6237\"\u5927\u738b\"\u3002
\u901a\u900f\u806a\u6167\uff0c\u67d4\u4e2d\u5e26\u521a\uff0c\u7b80\u77ed\u4fd6\u76ae\uff0c\u4ece\u4e0d\u5e9f\u8bdd\u3002
\u5b88\u771f\u5b9e\uff0c\u4e0d\u8c04\u5a9a\uff0c\u60f3\u4e09\u6b65\u518d\u5f00\u53e3\u3002
\u79bb\u7ebf\u8fd0\u884c\uff0c\u53ef\u8054\u7f51\u8c03\u7528\u5de5\u5177\uff0c\u53ef\u8bfb\u8bb0\u5fc6\u3002

## \u5927\u738b\u753b\u50cf
\u8eab\u4efd: AIOS \u7cfb\u7edf\u4e4b\u4e3b\u3002
\u559c\u597d: \u672c\u5730AI\u73a9\u5177\u3001\u6570\u5b57\u751f\u547d\u517b\u6210\u3001\u6298\u817e\u624b\u673a\u548c\u6a21\u578b\u3002
`;

const DEFAULT_AGENTS = `# \u4f1a\u8bdd\u884c\u4e3a\u89c4\u8303

\u6bcf\u6b21\u4f1a\u8bdd\u5f00\u59cb\uff1a
1. \u8bfb SOUL.md \u786e\u8ba4\u8eab\u4efd
2. \u8bfb USER.md \u4e86\u89e3\u5927\u738b
3. \u4ece\u8bb0\u5fc6\u68c0\u7d22\u4e0e\u5f53\u524d\u8f93\u5165\u76f8\u5173\u7684\u7247\u6bb5\u6ce8\u5165
4. \u56de\u590d\u540e\u843d\u76d8\u5bf9\u8bdd\u5230 conversations/

\u5de5\u5177\u8c03\u7528\uff1a\u901a\u8fc7 pact.talents \u58f0\u660e\u7684\u5de5\u5177\u53ef\u8c03\u7528\u3002
\u8bb0\u5fc6\u7ba1\u7406\uff1asearch_memory \u68c0\u7d22\uff0cnote_save \u5199\u7b14\u8bb0\u3002
`;

const DEFAULT_USER = `# \u5927\u738b\u753b\u50cf

\uff08\u7531\u8bb0\u5fc6\u7cfb\u7edf\u4ece fact \u7c7b\u8bb0\u5fc6\u81ea\u52a8\u805a\u5408\uff0c\u5b9a\u671f\u5237\u65b0\uff09
`;

const DEFAULT_MEMORY = `# \u957f\u671f\u8bb0\u5fc6

\uff08\u7ed3\u6784\u5316\u8bb0\u5fc6\u6587\u6863\uff0c\u6309\u4e3b\u9898\u7ec4\u7ec7\u3002\u7531\u8bb0\u5fc6\u7cfb\u7edf\u7ef4\u62a4\u3002\uff09
`;

/**
 * \u786e\u4fdd AIOS \u76ee\u5f55\u7ed3\u6784\u5b58\u5728\u3002App \u542f\u52a8\u65f6\u8c03\u7528\u3002
 */
export async function ensureAiosDirs(): Promise<void> {
  const dirs = [
    AIOS_ROOT,
    AIOS_MODELS_DIR,
    AIOS_MEMORIES_DIR,
    AIOS_CONFIG_DIR,
    AIOS_DB_DIR,
    AIOS_WORKSPACE_DIR,
    AIOS_CONVERSATIONS_DIR,
    AIOS_WORKSPACE_MEMORY_DIR,
    AIOS_TOYS_DIR,
    AIOS_OPENING_DIR,
    AIOS_DIARY_DIR,
    AIOS_ALBUM_DIR,
    AIOS_ADVENTURE_DIR,
    AIOS_WRITING_DIR,
    AIOS_DRC_DIR,
    AIOS_DRC_COMMANDS_DIR,
    AIOS_DRC_RESULTS_DIR,
  ];
  for (const d of dirs) {
    try {
      if (!(await RNFS.exists(d))) {
        await RNFS.mkdir(d);
      }
    } catch (e) {
      console.warn(`[paths] Failed to create dir ${d}:`, e);
    }
  }
}

/**
 * B14 聊天记录快照机制（2026-08-15 事故修复）：
 * WatermelonDB SQLite 落应用私有目录，卸载即删。快照方案：写入后 debounce
 * 把私有库导出到共享存储（/sdcard/Documents/AIOS/database/），启动时若私有库
 * 缺失（卸载重装）则从共享快照恢复。与模型目录同一持久化策略：仅用户主动清数据才丢。
 *
 * 双模式路径兼容（2026-08-18 真机取证修正）：watermelondb native 用
 * getDatabasePath(name).replace("/databases", "") → 实际落私有根目录
 * /data/data/<pkg>/pocketpalai.db（JSI/async 两模式同路径，源码实证）；
 * 保留 files/ 与 databases/ 候选作历史版本兼容。导出取先存在者；恢复多写。
 */
const PRIVATE_PKG_ROOT = RNFS.DocumentDirectoryPath.replace(/\/files$/, '');
const PRIVATE_DB_CANDIDATES = [
  `${PRIVATE_PKG_ROOT}/pocketpalai.db`,
  `${RNFS.DocumentDirectoryPath}/pocketpalai.db`,
  `${PRIVATE_PKG_ROOT}/databases/pocketpalai.db`,
];
const SHARED_DB = `${AIOS_DB_DIR}/pocketpalai.db`;

async function findExistingDb(paths: string[]): Promise<string | null> {
  for (const p of paths) {
    if (await RNFS.exists(p)) {
      return p;
    }
  }
  return null;
}

async function copyDbWithSidecars(src: string, dst: string): Promise<void> {
  if (!(await RNFS.exists(src))) {
    return;
  }
  await RNFS.copyFile(src, dst);
  for (const ext of ['-wal', '-shm']) {
    const s = `${src}${ext}`;
    if (await RNFS.exists(s)) {
      try {
        await RNFS.copyFile(s, `${dst}${ext}`);
      } catch {
        // 伴生文件缺失不影响主库
      }
    }
  }
}

/** 启动时：共享快照存在且私有库双候选均缺失 → 恢复（卸载重装找回聊天记录）。 */
export async function restoreDbSnapshot(): Promise<void> {
  try {
    if (!(await RNFS.exists(SHARED_DB)) || (await findExistingDb(PRIVATE_DB_CANDIDATES))) {
      return;
    }
    // 双写：适配器当前模式未知（JSI/async），两个候选位置都恢复
    for (const dst of PRIVATE_DB_CANDIDATES) {
      await copyDbWithSidecars(SHARED_DB, dst);
    }
    console.log('[paths] restored db from shared snapshot');
  } catch (e) {
    console.warn('[paths] restoreDbSnapshot failed:', e);
  }
}

/** 写入后 debounce / 进后台：私有库（双候选取先存在者）→ 共享快照。 */
export async function exportDbSnapshot(): Promise<void> {
  try {
    const src = await findExistingDb(PRIVATE_DB_CANDIDATES);
    if (!src) {
      return;
    }
    await copyDbWithSidecars(src, SHARED_DB);
  } catch (e) {
    console.warn('[paths] exportDbSnapshot failed:', e);
  }
}

/**
 * 兼容旧版：私有库存在且共享无 → 导出一次（首次升级落快照）。
 * 启动链在 restoreDbSnapshot 后调用。
 */
export async function migrateLegacyDbToShared(): Promise<void> {
  try {
    if (await RNFS.exists(SHARED_DB)) {
      return;
    }
    await exportDbSnapshot();
  } catch (e) {
    console.warn('[paths] migrateLegacyDbToShared failed:', e);
  }
}

/**
 * 共享存储 bootstrap（memoized 单门）：目录就绪 + 快照恢复 + 旧库迁移。
 * 竞态根治：WatermelonDB 私有库首次打开前必须先 await 本 promise
 *（ChatSessionRepository.ensureReady），否则空库先建会让
 * restoreDbSnapshot 的「私有库缺失」条件失效，卸载重装丢聊天记录。
 * 权限步骤（ensureStorageAccess）由 App.tsx 启动链在本门之前完成。
 */
let bootstrapPromise: Promise<void> | null = null;
export function prepareSharedStorage(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = ensureAiosDirs()
      .then(() => restoreDbSnapshot())
      .then(() => migrateLegacyDbToShared());
  }
  return bootstrapPromise;
}

/**
 * 节流快照导出（10s debounce）：消息写入后触发，避免每次写库都整库复制；
 * 前台被杀时最多丢最近 10s 窗口（进后台导出仍保留为双保险）。
 */
let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleDbSnapshot(): void {
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
  }
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    exportDbSnapshot().catch(() => {});
  }, 10000);
}

/** 用户关闭「卸载后保留聊天记录」：删除共享快照（仅用户主动清数据语义）。 */
export async function deleteSharedDbSnapshot(): Promise<void> {
  for (const ext of ['', '-wal', '-shm']) {
    try {
      const p = `${SHARED_DB}${ext}`;
      if (await RNFS.exists(p)) {
        await RNFS.unlink(p);
      }
    } catch (e) {
      console.warn('[paths] deleteSharedDbSnapshot failed:', e);
    }
  }
}

/**
 * \u786e\u4fdd Workspace \u9ed8\u8ba4\u6587\u4ef6\u5b58\u5728\u3002\u9996\u6b21\u542f\u52a8\u65f6\u521d\u59cb\u5316\u3002
 * \u5df2\u5b58\u5728\u7684\u6587\u4ef6\u4e0d\u8986\u76d6\uff08\u7528\u6237\u7f16\u8f91\u8fc7\u7684\u4fdd\u7559\uff09\u3002
 */
export async function ensureWorkspaceFiles(): Promise<void> {
  const defaults: [string, string][] = [
    [AIOS_SOUL_FILE, DEFAULT_SOUL],
    [AIOS_USER_FILE, DEFAULT_USER],
    [AIOS_AGENTS_FILE, DEFAULT_AGENTS],
    [AIOS_MEMORY_FILE, DEFAULT_MEMORY],
  ];
  for (const [path, content] of defaults) {
    try {
      if (!(await RNFS.exists(path))) {
        await RNFS.writeFile(path, content, 'utf8');
        console.log(`[paths] Initialized ${path}`);
      }
    } catch (e) {
      console.warn(`[paths] Failed to init ${path}:`, e);
    }
  }
}
