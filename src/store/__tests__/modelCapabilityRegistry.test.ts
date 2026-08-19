/**
 * modelCapabilityRegistry 选型测试（MODEL_MATRIX §1.1 → §18.7）
 *
 * 排序契约（2026-08-20 大王复核定稿）：用户用途标签命中（size 降序）
 * > DEFAULT_MAP 指纹，合并为「任务族候选」上限 3；任务族为空才兜底
 * 单个最大模型（不甩全量）；chitchat/image 返回空；play 复用 code、
 * adventure 复用 write；管家模型排除；findModelForTask = 候选首项兼容面。
 */
import {
  listModelsForTask,
  findModelForTask,
  candidateNote,
} from '../modelCapabilityRegistry';
import {modelStore} from '../index';
import {isPrompterModelName} from '../../services/promptWriter';
import {Model, ModelOrigin} from '../../utils/types';

jest.mock('../index', () => ({
  modelStore: {
    availableModels: [] as any[],
  },
}));

jest.mock('../../services/promptWriter', () => ({
  isPrompterModelName: jest.fn().mockReturnValue(false),
}));

const model = (over: Partial<Model>): Model =>
  ({
    id: over.id ?? 'm',
    name: over.name ?? 'model',
    filename: over.filename ?? 'model.gguf',
    size: over.size ?? 1e9,
    origin: ModelOrigin.PRESET,
    capabilities: over.capabilities,
  }) as unknown as Model;

const setAvailable = (models: Model[]) => {
  (modelStore as any).availableModels = models;
};

describe('listModelsForTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isPrompterModelName as jest.Mock).mockReturnValue(false);
    setAvailable([]);
  });

  it('chitchat / image 不选型：返回空数组', () => {
    setAvailable([model({id: 'a'})]);
    expect(listModelsForTask('chitchat')).toEqual([]);
    expect(listModelsForTask('image')).toEqual([]);
  });

  it('write：用户标签命中最高优先，组内 size 降序，任务族上限 3', () => {
    const taggedSmall = model({
      id: 'tagged-2b',
      capabilities: ['rewriting'],
      size: 2e9,
    });
    const taggedBig = model({
      id: 'tagged-4b',
      capabilities: ['creativity'],
      size: 3e9,
    });
    const fp = model({id: 'fp', name: 'Qwen3.5-4B-Instruct', size: 4e9});
    const rest = model({id: 'big', name: 'BigGeneric', size: 8e9});
    const rest2 = model({id: 'big2', name: 'BigGeneric2', size: 7e9});
    setAvailable([rest, rest2, fp, taggedSmall, taggedBig]);

    const list = listModelsForTask('write');
    // 任务族 = 标签 2 + 指纹 1；非任务族模型不再甩出（BigGeneric 不入列）
    expect(list.map(m => m.id)).toEqual(['tagged-4b', 'tagged-2b', 'fp']);
  });

  it('write 无标签：指纹命中即任务族（其余不入列）', () => {
    const fp = model({id: 'fp', name: 'qwen3.5-2b', size: 1.5e9});
    const big = model({id: 'big', name: 'BigGeneric', size: 8e9});
    const small = model({id: 'small', name: 'Tiny', size: 1e9});
    setAvailable([big, small, fp]);

    // 有指纹 → 只推任务族（fp），BigGeneric/Tiny 不甩出
    expect(listModelsForTask('write').map(m => m.id)).toEqual(['fp']);
  });

  it('无标签无指纹：兜底单个最大模型（不甩全量）', () => {
    const big = model({id: 'big', name: 'BigGeneric', size: 8e9});
    const small = model({id: 'small', name: 'Tiny', size: 1e9});
    setAvailable([small, big]);

    expect(listModelsForTask('write').map(m => m.id)).toEqual(['big']);
  });

  it('code：code 标签命中；play 复用 code 选型', () => {
    const coder = model({id: 'coder', capabilities: ['code'], size: 3e9});
    const writer = model({id: 'writer', capabilities: ['rewriting'], size: 4e9});
    setAvailable([writer, coder]);

    // writer 无 code 标签/指纹 → 不入 code 任务族
    expect(listModelsForTask('code').map(m => m.id)).toEqual(['coder']);
    expect(listModelsForTask('play').map(m => m.id)).toEqual(['coder']);
  });

  it('candidateNote：MODEL_MATRIX 定位优先，无定位给大小档位语', () => {
    const ministral = model({id: 'm', name: 'Ministral-3-3B-Instruct'});
    expect(candidateNote(ministral)).toBe('代码专长');
    const big = model({id: 'big', name: 'BigGeneric', size: 6e9});
    expect(candidateNote(big)).toBe('更大更强，但加载更慢');
    const small = model({id: 'small', name: 'Tiny', size: 1e9});
    expect(candidateNote(small)).toBe('均衡档，更快上手');
  });

  it('adventure 复用 write 选型', () => {
    const writer = model({id: 'writer', capabilities: ['rewriting'], size: 2e9});
    setAvailable([writer]);
    expect(listModelsForTask('adventure').map(m => m.id)).toEqual(['writer']);
  });

  it('管家模型排除（prompter 常驻槽不参与任务选型）', () => {
    (isPrompterModelName as jest.Mock).mockImplementation((name: string) =>
      name.includes('Butler'),
    );
    const butler = model({id: 'butler', name: 'Butler-1B', size: 9e9});
    const normal = model({id: 'normal', name: 'Normal', size: 1e9});
    setAvailable([butler, normal]);

    expect(listModelsForTask('write').map(m => m.id)).toEqual(['normal']);
  });

  it('findModelForTask 兼容面：返回候选首项；无候选返回 null', () => {
    const best = model({id: 'best', capabilities: ['rewriting'], size: 5e9});
    setAvailable([best]);
    expect(findModelForTask('write')?.id).toBe('best');
    setAvailable([]);
    expect(findModelForTask('write')).toBeNull();
  });
});
