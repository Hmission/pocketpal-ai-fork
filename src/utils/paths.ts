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

// Workspace 文件系统（寄宿者注入的落盘形态）
export const AIOS_WORKSPACE_DIR = `${AIOS_ROOT}/workspace`;
export const AIOS_CONVERSATIONS_DIR = `${AIOS_WORKSPACE_DIR}/conversations`;
export const AIOS_WORKSPACE_MEMORY_DIR = `${AIOS_WORKSPACE_DIR}/memory`;
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
