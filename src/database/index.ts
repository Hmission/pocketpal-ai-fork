import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import migrations from './migrations';
import {
  ChatSession,
  Message,
  CompletionSetting,
  GlobalSetting,
  CachedPal,
  UserLibrary,
  SyncStatus,
  LocalPal,
  ImageGenTask,
} from './models';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'pocketpalai',
  // 注：JSI 模式下 SQLite 固定落应用私有目录（files/pocketpalai.db），
  // 不支持 dbLocation。卸载不丢由快照机制保证（见 utils/paths.ts
  // exportDbSnapshot / restoreDbSnapshot，B14）。
  jsi: true, // enable JSI for better performance if available
  onSetUpError: error => {
    console.error('Database setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    ChatSession,
    Message,
    CompletionSetting,
    GlobalSetting,
    CachedPal,
    UserLibrary,
    SyncStatus,
    LocalPal,
    ImageGenTask,
  ],
});

export {
  ChatSession,
  Message,
  CompletionSetting,
  GlobalSetting,
  CachedPal,
  UserLibrary,
  SyncStatus,
  LocalPal,
  ImageGenTask,
};
