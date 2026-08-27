import {
  schemaMigrations,
  createTable,
  addColumns,
} from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    // Initial migration is handled by the schema
    {
      toVersion: 2,
      steps: [
        createTable({
          name: 'cached_pals',
          columns: [
            {name: 'palshub_id', type: 'string', isIndexed: true},
            {name: 'title', type: 'string'},
            {name: 'description', type: 'string', isOptional: true},
            {name: 'thumbnail_url', type: 'string', isOptional: true},
            {name: 'creator_id', type: 'string'},
            {name: 'creator_name', type: 'string', isOptional: true},
            {name: 'creator_avatar_url', type: 'string', isOptional: true},
            {name: 'protection_level', type: 'string'},
            {name: 'price_cents', type: 'number'},
            {name: 'allow_fork', type: 'boolean'},
            {name: 'average_rating', type: 'number', isOptional: true},
            {name: 'review_count', type: 'number'},
            {name: 'is_owned', type: 'boolean'},
            {name: 'categories', type: 'string'}, // JSON array
            {name: 'tags', type: 'string'}, // JSON array
            {name: 'system_prompt', type: 'string', isOptional: true},
            {name: 'model_settings', type: 'string'}, // JSON object
            {name: 'cached_at', type: 'number'},
            {name: 'created_at', type: 'number'},
            {name: 'updated_at', type: 'number'},
          ],
        }),
        createTable({
          name: 'user_library',
          columns: [
            {name: 'user_id', type: 'string', isIndexed: true},
            {name: 'palshub_id', type: 'string', isIndexed: true},
            {name: 'purchased_at', type: 'number'},
            {name: 'purchase_id', type: 'string', isOptional: true},
            {name: 'is_downloaded', type: 'boolean'},
            {name: 'download_path', type: 'string', isOptional: true},
            {name: 'created_at', type: 'number'},
          ],
        }),
        createTable({
          name: 'sync_status',
          columns: [
            {name: 'entity_type', type: 'string', isIndexed: true},
            {name: 'entity_id', type: 'string', isOptional: true},
            {name: 'last_sync', type: 'number'},
            {name: 'sync_version', type: 'string', isOptional: true},
            {name: 'status', type: 'string'},
            {name: 'error_message', type: 'string', isOptional: true},
            {name: 'created_at', type: 'number'},
            {name: 'updated_at', type: 'number'},
          ],
        }),
      ],
    },
    // Migration to version 3: Add local_pals table
    {
      toVersion: 3,
      steps: [
        createTable({
          name: 'local_pals',
          columns: [
            {name: 'name', type: 'string'},
            {name: 'system_prompt', type: 'string'},
            {name: 'original_system_prompt', type: 'string', isOptional: true},
            {name: 'is_system_prompt_changed', type: 'boolean'},
            {name: 'use_ai_prompt', type: 'boolean'},
            {name: 'default_model', type: 'string', isOptional: true}, // JSON stringified
            {name: 'prompt_generation_model', type: 'string', isOptional: true}, // JSON stringified
            {name: 'generating_prompt', type: 'string', isOptional: true},
            {name: 'color', type: 'string', isOptional: true}, // JSON stringified [string, string]
            {name: 'capabilities', type: 'string'}, // JSON stringified PalCapabilities
            {name: 'parameters', type: 'string'}, // JSON stringified Record<string, any>
            {name: 'parameter_schema', type: 'string'}, // JSON stringified ParameterDefinition[]
            {name: 'source', type: 'string'}, // 'local' | 'palshub'
            {name: 'palshub_id', type: 'string', isOptional: true},
            {name: 'creator_info', type: 'string', isOptional: true}, // JSON stringified
            {name: 'categories', type: 'string', isOptional: true}, // JSON stringified string[]
            {name: 'tags', type: 'string', isOptional: true}, // JSON stringified string[]
            {name: 'rating', type: 'number', isOptional: true},
            {name: 'review_count', type: 'number', isOptional: true},
            {name: 'protection_level', type: 'string', isOptional: true},
            {name: 'price_cents', type: 'number', isOptional: true},
            {name: 'is_owned', type: 'boolean', isOptional: true},
            {name: 'generation_settings', type: 'string', isOptional: true}, // JSON stringified
            {name: 'created_at', type: 'number'},
            {name: 'updated_at', type: 'number'},
          ],
        }),
      ],
    },
    // Migration to version 4: Add description column to local_pals
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'local_pals',
          columns: [{name: 'description', type: 'string', isOptional: true}],
        }),
      ],
    },
    // Migration to version 5: Add thumbnail_url column to local_pals
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'local_pals',
          columns: [{name: 'thumbnail_url', type: 'string', isOptional: true}],
        }),
      ],
    },
    // Migration to version 6: Add settings_source column to chat_sessions
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'chat_sessions',
          columns: [
            {name: 'settings_source', type: 'string', isOptional: true},
          ],
        }),
      ],
    },
    // Migration to version 7: Add pact and greeting columns to local_pals
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: 'local_pals',
          columns: [
            {name: 'pact', type: 'string', isOptional: true}, // JSON stringified { talents: TalentRef[] }
            {name: 'greeting', type: 'string', isOptional: true}, // JSON stringified Pal['greeting']
          ],
        }),
      ],
    },
    // Migration to version 8: Add intent column to chat_sessions
    // (会话级意图状态机落库，CHAT_UI_SPEC §18.1)
    {
      toVersion: 8,
      steps: [
        addColumns({
          table: 'chat_sessions',
          columns: [{name: 'intent', type: 'string', isOptional: true}],
        }),
      ],
    },
    // Migration to version 9: Add image_gen_tasks table
    // (生图任务元数据落库，B28——对齐聊天存储架构，获得 B14 整库快照保护)
    {
      toVersion: 9,
      steps: [
        createTable({
          name: 'image_gen_tasks',
          columns: [
            {name: 'uri', type: 'string', isIndexed: true},
            {name: 'prompt', type: 'string'},
            {name: 'seed', type: 'number'},
            {name: 'ts', type: 'number'},
            {name: 'width', type: 'number'},
            {name: 'height', type: 'number'},
            {name: 'steps', type: 'number', isOptional: true},
            {name: 'cfg', type: 'number', isOptional: true},
            {name: 'family', type: 'string', isOptional: true},
            {name: 'kind', type: 'string', isOptional: true},
            {name: 'source_uri', type: 'string', isOptional: true},
            {name: 'duration_ms', type: 'number', isOptional: true},
            {name: 'model_label', type: 'string', isOptional: true},
            {name: 'task_id', type: 'string', isIndexed: true},
            {name: 'status', type: 'string'},
            {name: 'error_summary', type: 'string', isOptional: true},
            {name: 'error_detail', type: 'string', isOptional: true},
            {name: 'created_at', type: 'number'},
          ],
        }),
      ],
    },
    // Migration to version 10: Add image_gen_queue table
    // (生图队列/任务购物车，IMAGEGEN_QUEUE_SPEC v0.1——快照字段入队冻结)
    {
      toVersion: 10,
      steps: [
        createTable({
          name: 'image_gen_queue',
          columns: [
            {name: 'prompt', type: 'string'},
            {name: 'negative_prompt', type: 'string'},
            {name: 'steps', type: 'number'},
            {name: 'cfg', type: 'number'},
            {name: 'width', type: 'number'},
            {name: 'height', type: 'number'},
            {name: 'ratio', type: 'string'},
            {name: 'seed', type: 'number'},
            {name: 'family', type: 'string'},
            {name: 'model_id', type: 'string', isIndexed: true},
            {name: 'lora_enabled', type: 'boolean'},
            {name: 'lora_multiplier', type: 'number'},
            // SD 族执行指令（入队时由组件层按 manifest 解析；自包含快照，执行零外部依赖）
            {name: 'main_path', type: 'string', isOptional: true},
            {name: 'companion_paths', type: 'string', isOptional: true}, // JSON
            {name: 'backend', type: 'string', isOptional: true},
            {name: 'lora_path', type: 'string', isOptional: true},
            {name: 'total', type: 'number'},
            {name: 'done', type: 'number'},
            {name: 'failed', type: 'number'},
            {name: 'status', type: 'string'},
            {name: 'created_at', type: 'number'},
            {name: 'updated_at', type: 'number'},
          ],
        }),
      ],
    },
  ],
});
