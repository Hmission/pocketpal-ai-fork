/**
 * starmap — 端侧星图快照（AIOS_CORE_SPEC Wave C）
 *
 * 母仓协议：AIOS_STARMAP_GLANCE（Ring1 我是谁 / Ring2 我有什么骨架 / Ring3 我长什么样器官 / 活体健康）。
 * 端侧形态：三维快照（能力面/数据面/健康面）落 logs/starmap_snapshot.json——
 * 程序化零模型，冷启动 + 收尾各写一次；DRC state.json 可查，生长 inspect 可消费。
 *
 * 锋利原则：只做只读快照采集，不驱动任何加载/扫描行为；失败静默（观测不为 SPOF）。
 */
import * as RNFS from '@dr.pogodin/react-native-fs';
import {emit} from '../../debug/eventStream';
import {
  AIOS_STARMAP_SNAPSHOT,
  AIOS_WORKSPACE_DIR,
  AIOS_GROWTH_DIR,
} from '../../utils/paths';

export interface StarmapSnapshot {
  /** 采集时间 */
  ts: string;
  /** 能力面：TalentRegistry 已注册引擎清单 */
  capabilities: {
    engines: string[];
    count: number;
  };
  /** 数据面：workspace 目录统计（名称 → 条目数） */
  data: {
    workspaceDirs: Record<string, number>;
    growthEntries: number;
  };
  /** 健康面：引擎状态 */
  health: {
    engines: Record<string, string>;
    models: number;
  };
}

interface HealthProvider {
  getEngines(): Record<string, {phase: string}>;
  getModelCount(): number;
}

/** 健康面采集器（由调用方注入，避免 starmap 直接依赖 store 造成环依赖） */
let healthProvider: HealthProvider | null = null;

export function registerHealthProvider(p: HealthProvider): void {
  healthProvider = p;
}

async function countFiles(dir: string): Promise<number> {
  try {
    if (!(await RNFS.exists(dir))) {
      return 0;
    }
    const items = await RNFS.readDir(dir);
    return items.filter(i => i.isFile()).length;
  } catch {
    return 0;
  }
}

/**
 * 采集能力面（TalentRegistry 引擎名清单）。
 * 由调用方注入引擎列表（starmap 不直接 import talentRegistry，防依赖反向）。
 */
export function collectCapabilities(
  engineNames: string[],
): StarmapSnapshot['capabilities'] {
  return {
    engines: [...engineNames].sort(),
    count: engineNames.length,
  };
}

/**
 * 采集数据面（workspace 目录条目统计）。
 */
export async function collectData(): Promise<StarmapSnapshot['data']> {
  const workspaceDirs: Record<string, number> = {};
  try {
    if (await RNFS.exists(AIOS_WORKSPACE_DIR)) {
      const dirs = await RNFS.readDir(AIOS_WORKSPACE_DIR);
      for (const d of dirs) {
        if (d.isDirectory()) {
          workspaceDirs[d.name] = await countFiles(d.path);
        }
      }
    }
  } catch {
    // 静默
  }
  const growthEntries = await countFiles(AIOS_GROWTH_DIR);
  return {workspaceDirs, growthEntries};
}

/**
 * 采集健康面（引擎相位 + 模型数）。
 */
export function collectHealth(): StarmapSnapshot['health'] {
  const engines: Record<string, string> = {};
  if (healthProvider) {
    for (const [kind, state] of Object.entries(healthProvider.getEngines())) {
      engines[kind] = state.phase;
    }
  }
  return {
    engines,
    models: healthProvider?.getModelCount() ?? 0,
  };
}

/**
 * 写星图快照（覆盖写，单文件即最新）。返回快照本体；失败返回 null。
 */
export async function captureStarmap(
  engineNames: string[],
): Promise<StarmapSnapshot | null> {
  try {
    const snapshot: StarmapSnapshot = {
      ts: new Date().toISOString(),
      capabilities: collectCapabilities(engineNames),
      data: await collectData(),
      health: collectHealth(),
    };
    await RNFS.writeFile(
      AIOS_STARMAP_SNAPSHOT,
      JSON.stringify(snapshot, null, 1),
      'utf8',
    );
    emit('app', 'starmap.captured', {
      engines: snapshot.capabilities.count,
    });
    return snapshot;
  } catch (e) {
    console.warn('[starmap] capture failed:', e);
    return null;
  }
}

/** 读最近一次星图快照；缺失返回 null（文件即过期公理） */
export async function readStarmap(): Promise<StarmapSnapshot | null> {
  try {
    if (!(await RNFS.exists(AIOS_STARMAP_SNAPSHOT))) {
      return null;
    }
    const raw = await RNFS.readFile(AIOS_STARMAP_SNAPSHOT, 'utf8');
    return JSON.parse(raw) as StarmapSnapshot;
  } catch {
    return null;
  }
}
