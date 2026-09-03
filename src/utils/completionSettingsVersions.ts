/**
 * Completion settings version constants and migration utilities
 *
 * This file handles the versioning and migration of completion settings.
 * It contains the default completion settings and migration logic.
 *
 * When adding new settings:
 * 1. Add the setting to defaultCompletionParams
 * 2. Increment CURRENT_COMPLETION_SETTINGS_VERSION
 * 3. Add a migration step in migrateCompletionSettings to handle the new setting
 */

import {CompletionParams} from './completionTypes';

// Current version of the completion settings schema
// Increment this when adding new settings or changing existing ones
export const CURRENT_COMPLETION_SETTINGS_VERSION = 5;

/**
 * Default completion parameters used throughout the app
 */
export const defaultCompletionParams: CompletionParams = {
  // App-specific properties
  version: CURRENT_COMPLETION_SETTINGS_VERSION, // Schema version for migrations
  include_thinking_in_context: true, // Whether to include thinking parts in the context sent to the model

  // llama.rn API properties
  prompt: '',
  n_predict: -1, // The maximum number of tokens to predict when generating text. -1 = unlimited (until EOS).
  temperature: 0.7, // The randomness of the generated text.
  top_k: 0, // 禁用 top_k（Qwen3/MiniCPM 官方推荐：走 top_p/min_p 采样系，不叠加 top_k）
  top_p: 0.8, // Qwen3 官方推荐 0.8（原 0.95 过宽，中文长文易散）
  min_p: 0.05, //The minimum probability for a token to be considered, relative to the probability of the most likely token.
  xtc_threshold: 0.1, // Sets a minimum probability threshold for tokens to be removed.
  xtc_probability: 0.0, // Sets the chance for token removal (checked once on sampler start)
  typical_p: 1.0, // Enable locally typical sampling with parameter p. Default: `1.0`, which is disabled.
  penalty_last_n: 64, // Last n tokens to consider for penalizing repetition. Default: `64`, where `0` is disabled and `-1` is ctx-size.
  penalty_repeat: 1.0, // Control the repetition of token sequences in the generated text.
  penalty_freq: 0.0, // Repeat alpha frequency penalty. Default: `0.0`, which is disabled.
  penalty_present: 0.0, // Repeat alpha presence penalty. Default: `0.0`, which is disabled.
  mirostat: 0, //Enable Mirostat sampling, controlling perplexity during text generation. Default: `0`, where `0` is disabled, `1` is Mirostat, and `2` is Mirostat 2.0.
  mirostat_tau: 5, // Set the Mirostat target entropy, parameter tau. Default: `5.0`
  mirostat_eta: 0.1, // Set the Mirostat learning rate, parameter eta.  Default: `0.1`
  seed: -1,
  n_probs: 0, // If greater than 0, the response also contains the probabilities of top N tokens for each generated token given the sampling settings.
  stop: ['</s>'],
  jinja: true, // Whether to use Jinja templating for chat formatting
  // A2（2026-09-03 真机取证）：默认关闭思考——本地 CPU 上每轮长思考流会放大
  // TTFT（2B 实测 73s 级），v3 迁移曾强制开启（见 migrateCompletionSettings）。
  // 思考仍是用户主权：聊天页 thinking pill 可随时显式开启。
  enable_thinking: false, // Whether to enable thinking mode for compatible models
  // emit_partial_completion: true, // This is not used in the current version of llama.rn
};

/**
 * Migrates completion settings to the latest version
 * @param settings The settings object to migrate
 * @returns The migrated settings object
 */
export function migrateCompletionSettings(settings: any): any {
  // Clone the settings to avoid modifying the original
  const migratedSettings = {...settings};

  // If no version is specified, assume it's the initial version (0)
  if (migratedSettings.version === undefined) {
    migratedSettings.version = 0;
  }

  // Apply migrations sequentially
  if (migratedSettings.version < 1) {
    // Migration to version 1: Add include_thinking_in_context
    migratedSettings.include_thinking_in_context =
      defaultCompletionParams.include_thinking_in_context;
    migratedSettings.version = 1;
  }

  if (migratedSettings.version < 2) {
    // Migration to version 2: Add jinja parameter
    migratedSettings.jinja = defaultCompletionParams.jinja;
    migratedSettings.version = 2;
  }

  // Add future migrations here as needed
  if (migratedSettings.version < 3) {
    // Migration to version 3: Add enable_thinking parameter
    migratedSettings.enable_thinking = defaultCompletionParams.enable_thinking;
    migratedSettings.version = 3;
  }

  if (migratedSettings.version < 4) {
    // Migration to version 4: Change n_predict default to -1 (unlimited)
    // Only migrate if user still has the old default; preserve intentional custom values
    if (migratedSettings.n_predict === 1024) {
      migratedSettings.n_predict = defaultCompletionParams.n_predict;
    }
    migratedSettings.version = 4;
  }

  if (migratedSettings.version < 5) {
    // Migration to version 5（A2 2026-09-03 K90 真机取证）：v3 迁移把
    // enable_thinking 默认强制写成 true，CPU 上每轮思考流放大 TTFT（2B 实测
    // 73s 级首 token 等待）→ 回退为默认关闭。仅回退「迁移注入」的 true——
    // 用户显式开启会成对写入 reasoning.enabled=true（ChatScreen
    // persistReasoning），迁移注入只写 enable_thinking（reasoning 缺失/未启用），
    // 保留用户主权：显式开启的思考不被动关闭。
    if (
      migratedSettings.enable_thinking === true &&
      migratedSettings.reasoning?.enabled !== true
    ) {
      migratedSettings.enable_thinking = false;
    }
    migratedSettings.version = 5;
  }

  // Add future migrations here as needed

  return migratedSettings;
}
