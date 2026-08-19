/**
 * PalStore - Dynamic Parameter Pal Store
 *
 * This is the new pal store that replaces the legacy PalStore with a flexible,
 * schema-driven approach that supports dynamic parameters and custom pal types.
 *
 * KEY FEATURES:
 * - Dynamic parameter schemas: Create pals with any custom parameters
 * - Unified UI: Single PalSheet component works for all pal types
 * - PalsHub integration: Support for marketplace pals with custom parameters
 * - Extensible: Easy to add new parameter types (text, select, datetime_tag)
 * - Migration: Automatically migrates data from legacy PalStore on startup
 *
 * @see src/types/pal.ts for type definitions
 * @see src/utils/pal-migration.ts for migration utilities
 * @see src/components/PalsSheets/PalSheet.tsx for unified UI component
 */

import * as RNFS from '@dr.pogodin/react-native-fs';
import {AIOS_SOUL_FILE} from '../utils/paths';
import {v4 as uuidv4} from 'uuid';
import {makeAutoObservable, runInAction} from 'mobx';
import {Platform} from 'react-native';

import {HF_DOMAIN} from '../config/urls';

import {palRepository} from '../repositories/PalRepository';

import {hfAsModel} from '../utils';
import {resolveHFModelForDownload} from '../utils/hfResolve';
import {isUSStorefront} from '../utils/region';
import NativeExternalContentLink from '../specs/NativeExternalContentLink';
import {palsHubService} from '../services';
import {registerDefaultTalents} from '../services/talents';
import {LOOKIE_DEFAULT_MODEL} from './builtinPalModels';
import {chatTemplates} from '../utils/chat';
import {defaultCompletionParams} from '../utils/completionSettingsVersions';
import {parsePalsHubTemplate} from '../utils/palshub-template-parser';
import {getDisplayNameFromFilename} from '../utils/formatters';

import type {Pal, ParameterDefinition} from '../types/pal';
import type {
  ModelReference,
  PalsHubPal,
  SearchFilters,
  SyncState,
} from '../types/palshub';

import {ModelOrigin} from '../utils/types';
import type {Model} from '../utils/types';
import {downloadPalThumbnail, deletePalThumbnail} from '../utils/imageUtils';

/**
 * AIOS 女妖默认工具集（D-1 对账基准，2026-08-19）。
 * 新增玩法工具在此登记；存量女妖按差集并集升级，不复活用户手动关闭的工具。
 */
const AIOS_PAL_DEFAULT_TALENTS: Array<{
  name: string;
  necessity: 'optional';
}> = [
  {name: 'web_search', necessity: 'optional'},
  {name: 'read_url', necessity: 'optional'},
  {name: 'calculate', necessity: 'optional'},
  {name: 'datetime', necessity: 'optional'},
  {name: 'render_html', necessity: 'optional'},
  {name: 'search_memory', necessity: 'optional'},
  {name: 'note_save', necessity: 'optional'},
  {name: 'device_control', necessity: 'optional'},
  {name: 'adventure_state', necessity: 'optional'},
  // 玩具迭代闭环（PLAY_SPEC v1.6）：改已有玩具前按 title 读回原文
  {name: 'read_html', necessity: 'optional'},
];

/** pact.schemaVersion 当前版本：v2 = 十工具全量集（v1 九工具 + read_html）。 */
const PACT_SCHEMA_VERSION = 2;

class PalStore {
  // Core pals storage
  pals: Pal[] = [];
  // PalsHub integration state
  cachedPalsHubPals: PalsHubPal[] = [];
  userLibrary: PalsHubPal[] = [];
  userCreatedPals: PalsHubPal[] = [];
  isLoadingPalsHub: boolean = false;
  searchFilters: SearchFilters = {};
  syncState: SyncState = {status: 'idle'};

  // Checkout eligibility state
  isCheckoutEligible: boolean = false;

  // Migration state
  isMigrating: boolean = false;
  migrationComplete: boolean = false;
  migrationVersion: string = '1.0';

  constructor() {
    makeAutoObservable(this);
    this.initialize();
    console.log('Pal store initialized');
    console.log('Pals number: ', this.pals.length);
  }

  async initialize() {
    try {
      runInAction(() => {
        this.isMigrating = true;
      });

      // Migrate from JSON/AsyncStorage to database
      await palRepository.checkAndMigrateFromJSON();

      // Load pals from database
      await this.loadPalsFromDatabase();

      // Initialize Lookie pal after database is loaded
      await this.initializeLookiePal();

      // Initialize Pip pal (idempotent — see initializePipPal).
      await this.initializePipPal();

      // Initialize AIOS Pal (persona + all talents)
      await this.initializeAiosPal();

      // Register talent engines (idempotent)
      registerDefaultTalents();

      // Check checkout eligibility for buy button gating
      this.checkCheckoutEligibility();

      console.log('Pal store initialization completed');

      runInAction(() => {
        this.isMigrating = false;
        this.migrationComplete = true;
      });
    } catch (error) {
      console.error('Failed to initialize pal store:', error);
      runInAction(() => {
        this.isMigrating = false;
        this.migrationComplete = false;
      });
    }
  }

  private async checkCheckoutEligibility() {
    // E2E builds have no App Store storefront, so force eligibility to
    // exercise the buy button. Compiled out of prod (`__E2E__` is false).
    if (__E2E__) {
      runInAction(() => {
        this.isCheckoutEligible = true;
      });
      return;
    }

    try {
      // Gate on real purchase eligibility per platform, not device locale:
      // Android queries Play EXTERNAL_CONTENT_LINK availability; iOS keeps the
      // StoreKit storefront signal. A null Android module or a thrown probe
      // leaves the flag false (fail-closed → info-text fallback).
      const eligible =
        Platform.OS === 'android'
          ? await NativeExternalContentLink?.isExternalContentLinkAvailable()
          : await isUSStorefront();
      runInAction(() => {
        this.isCheckoutEligible = eligible === true;
      });
    } catch (error) {
      console.warn('Failed to check checkout eligibility:', error);
      runInAction(() => {
        this.isCheckoutEligible = false;
      });
    }
  }

  /**
   * Load pals from database into MobX store
   */
  private async loadPalsFromDatabase() {
    try {
      const pals = await palRepository.getAllPals();
      runInAction(() => {
        this.pals = pals;
      });
    } catch (error) {
      console.error('Error loading pals from database:', error);
    }
  }

  // Core unified pal management methods

  /**
   * Adds a pal to both repository and store (handles persistence + state)
   * This is the ONLY method that should handle repository + store updates
   */
  private addPal = async (
    palData: Omit<Pal, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Pal> => {
    const savedPal = await palRepository.createPal(palData);

    runInAction(() => {
      this.pals.push(savedPal);
    });

    return savedPal;
  };

  /**
   * Creates a new pal
   */
  createPal = async (
    palData: Omit<Pal, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Pal> => {
    return this.addPal(palData);
  };

  /**
   * Updates an existing pal
   */
  updatePal = async (id: string, updates: Partial<Pal>): Promise<void> => {
    try {
      const updatedPal = await palRepository.updatePal(id, updates);
      if (updatedPal) {
        runInAction(() => {
          const palIndex = this.pals.findIndex(p => p.id === id);
          if (palIndex !== -1) {
            this.pals[palIndex] = updatedPal;
          }
        });
      } else {
        throw new Error('Failed to update pal - no updated pal returned');
      }
    } catch (error) {
      console.error('Error updating pal:', error);
      throw error; // Re-throw so calling code can handle it
    }
  };

  /**
   * Deletes a pal
   */
  deletePal = async (id: string): Promise<void> => {
    try {
      // Find the pal to get its thumbnail path before deletion
      const palIndex = this.pals.findIndex(p => p.id === id);
      const pal = palIndex !== -1 ? this.pals[palIndex] : null;

      const success = await palRepository.deletePal(id);
      if (success) {
        // Clean up local thumbnail image if it exists
        if (pal?.thumbnail_url) {
          try {
            await deletePalThumbnail(pal.thumbnail_url);
          } catch (imageError) {
            console.warn('Failed to delete thumbnail image:', imageError);
            // Don't fail the entire deletion if image cleanup fails
          }
        }

        runInAction(() => {
          if (palIndex !== -1) {
            this.pals.splice(palIndex, 1);
          }
        });
      }
    } catch (error) {
      console.error('Error deleting pal:', error);
    }
  };

  /**
   * Gets all pals
   */
  getPals = (): Pal[] => {
    return this.pals;
  };

  /**
   * Gets a pal by ID
   */
  getPalById = (id: string): Pal | undefined => {
    return this.pals.find(p => p.id === id);
  };

  // PalsHub integration methods

  /**
   * Downloads a PalsHub pal and converts it to unified format
   */
  downloadPalsHubPal = async (palsHubPal: PalsHubPal): Promise<Pal> => {
    try {
      // For free pals, allow direct download without ownership check
      // For premium pals, check ownership first
      if (palsHubPal.price_cents > 0) {
        const ownership = await palsHubService.checkPalOwnership(palsHubPal.id);
        if (!ownership.owned) {
          throw new Error('You must own this Pal to download it');
        }
      }

      // Convert PalsHub pal to local format
      const pal = await this.createLocalPalFromPalsHub(palsHubPal);
      let relativeThumbnailPath: string | null = null;

      // Download thumbnail image if available
      if (palsHubPal.thumbnail_url) {
        try {
          console.log('Downloading thumbnail for pal:', pal.name);
          relativeThumbnailPath = await downloadPalThumbnail(
            pal.id,
            palsHubPal.thumbnail_url,
          );

          // Update the pal with the relative path (no file:// protocol)
          pal.thumbnail_url = relativeThumbnailPath;
          console.log(
            'Thumbnail downloaded successfully:',
            relativeThumbnailPath,
          );
        } catch (imageError) {
          console.warn(
            'Failed to download thumbnail, keeping remote URL:',
            imageError,
          );
          // Keep the original remote URL as fallback
          pal.thumbnail_url = palsHubPal.thumbnail_url;
        }
      }

      try {
        // Persist the pal to the database and add to store
        return await this.addPal(pal);
      } catch (dbError) {
        // If database save fails, clean up the downloaded image
        if (relativeThumbnailPath) {
          try {
            await deletePalThumbnail(relativeThumbnailPath);
            console.log(
              'Cleaned up thumbnail after database error:',
              relativeThumbnailPath,
            );
          } catch (cleanupError) {
            console.warn(
              'Failed to cleanup thumbnail after database error:',
              cleanupError,
            );
          }
        }
        throw dbError;
      }
    } catch (error) {
      throw error;
    }
  };

  /**
   * Creates a Model object from PalsHub ModelReference with complete HF metadata
   */
  private createLocalModelFromPHModel = async (
    modelRef: ModelReference,
  ): Promise<Model> => {
    try {
      // Resolve via the shared canonical chain so the matched file carries a
      // populated /resolve/ download URL. modelRef values relax strictness when
      // the HF API response is incomplete (the PalsHub flow already has them).
      const {hfModel, modelFile} = await resolveHFModelForDownload(
        modelRef.repo_id,
        modelRef.filename,
        undefined,
        {
          author: modelRef.author,
          size: modelRef.size,
          downloadUrl: modelRef.downloadUrl,
        },
      );

      // Use the existing hfAsModel function to create a complete Model object
      return hfAsModel(hfModel, modelFile);
    } catch (error) {
      console.error('Failed to fetch complete model data from HF API:', error);

      // Fallback: create basic model with available data
      return this.createBasicModelFromReference(modelRef);
    }
  };

  /**
   * Creates a basic Model object from ModelReference (fallback when HF API fails)
   */
  private createBasicModelFromReference = (modelRef: any): Model => {
    // Extract model name from filename (remove .gguf extension)
    const modelName = getDisplayNameFromFilename(modelRef.filename);

    // Degraded fallback path: use the generic default chat template and
    // completion params (the GGUF-embedded template is applied at load time).
    const chatTemplate = {...chatTemplates.default};
    const completionSettings = {...defaultCompletionParams};
    const stopWords = completionSettings.stop ?? [];

    return {
      id: `${modelRef.repo_id}/${modelRef.filename}`,
      author: modelRef.author,
      name: modelName,
      size: modelRef.size,
      params: 0, // Will be fetched from HF API if needed
      isDownloaded: false,
      downloadUrl: modelRef.downloadUrl,
      hfUrl: `${HF_DOMAIN}/${modelRef.repo_id}`,
      progress: 0,
      filename: modelRef.filename,
      isLocal: false,
      origin: ModelOrigin.HF,
      defaultChatTemplate: {...chatTemplate},
      chatTemplate: {...chatTemplate},
      defaultCompletionSettings: {...completionSettings},
      completionSettings: {...completionSettings},
      defaultStopWords: [...stopWords],
      stopWords: [...stopWords],
    };
  };

  /**
   * Converts a PalsHub pal to local pal format
   */
  private createLocalPalFromPalsHub = async (
    palsHubPal: PalsHubPal,
  ): Promise<Pal> => {
    let parameterSchema: ParameterDefinition[] = [];
    let parameters: Record<string, any> = {};
    let systemPrompt = palsHubPal.system_prompt || '';

    // Parse system_prompt to extract parameter schema and default values
    // Parameters are embedded within the system_prompt field using Mustache templating
    // with JSON schema comments
    let originalSystemPrompt: string | undefined;
    if (systemPrompt && this.isTemplatedSystemPrompt(systemPrompt)) {
      // Parse the templated system prompt
      const parsed = parsePalsHubTemplate(systemPrompt);
      // CRITICAL: Preserve the original template for future editing
      originalSystemPrompt = systemPrompt;
      // Use the clean template with placeholders for the systemPrompt field
      systemPrompt = parsed.cleanSystemPrompt;
      parameterSchema = parsed.parameterSchema;
      parameters = parsed.defaultParameters;
    }
    // If no template found, use empty schema/parameters (assistant-style pal)

    // Convert PalsHub model_reference to Model object if available
    const defaultModel = palsHubPal.model_reference
      ? await this.createLocalModelFromPHModel(palsHubPal.model_reference)
      : undefined;

    // Strict-`=== true` so stringly-typed `required` becomes optional.
    // Drop talents that aren't objects with a non-empty string name.
    const wireTalents = palsHubPal.pact?.talents;
    const validTalents = Array.isArray(wireTalents)
      ? wireTalents.filter(
          t =>
            t != null &&
            typeof t === 'object' &&
            typeof t.name === 'string' &&
            t.name.length > 0,
        )
      : [];
    const pact =
      validTalents.length > 0
        ? {
            talents: validTalents.map(t => ({
              name: t.name,
              necessity: (t.required === true ? 'required' : 'optional') as
                | 'required'
                | 'optional',
            })),
          }
        : undefined;

    const wireGreeting = palsHubPal.greeting;
    const wireText = wireGreeting?.text;
    const wirePrompts = wireGreeting?.suggested_prompts;
    const validPrompts = Array.isArray(wirePrompts)
      ? wirePrompts.filter(
          (p): p is string => typeof p === 'string' && p.length > 0,
        )
      : [];
    const hasText = typeof wireText === 'string' && wireText.length > 0;
    const hasPrompts = validPrompts.length > 0;
    const greeting =
      hasText || hasPrompts
        ? {
            text: typeof wireText === 'string' ? wireText : '',
            ...(hasPrompts ? {suggestedPrompts: validPrompts} : {}),
          }
        : undefined;

    return {
      type: 'local',
      id: uuidv4(),
      name: palsHubPal.title,
      description: palsHubPal.description,
      thumbnail_url: palsHubPal.thumbnail_url,
      systemPrompt,
      originalSystemPrompt, // Preserve the original template for editing
      isSystemPromptChanged: false,
      useAIPrompt: false,
      defaultModel,
      parameters,
      parameterSchema,
      ...(pact ? {pact} : {}),
      ...(greeting ? {greeting} : {}),
      source: 'palshub',
      palshub_id: palsHubPal.id,
      creator_info: {
        id: palsHubPal.creator_id,
        name: palsHubPal.creator?.display_name,
        avatar_url: palsHubPal.creator?.avatar_url,
      },
      categories: palsHubPal.categories?.map((c: any) => c.name) || [],
      tags: palsHubPal.tags?.map((t: any) => t.name) || [],
      rating: palsHubPal.average_rating,
      review_count: palsHubPal.review_count,
      protection_level: palsHubPal.protection_level,
      price_cents: palsHubPal.price_cents,
      is_owned: true,
      rawPalshubGenerationSettings: palsHubPal.model_settings,
      created_at: palsHubPal.created_at,
      updated_at: palsHubPal.updated_at,
    };
  };

  /**
   * Checks if a system prompt contains parameter template definitions
   * Parameters are embedded within the system_prompt field using Mustache templating
   * with JSON schema comments
   */
  private isTemplatedSystemPrompt = (systemPrompt: string): boolean => {
    // Check for Mustache JSON schema pattern
    const mustacheSchemaPattern =
      /\{\{!\s*json-schema-start\s*[\s\S]*?\s*json-schema-end\s*\}\}/;

    return mustacheSchemaPattern.test(systemPrompt);
  };

  // PalsHub methods
  searchPalsHubPals = async (filters: any = {}) => {
    try {
      runInAction(() => {
        this.isLoadingPalsHub = true;
        this.syncState = {status: 'syncing'};
      });

      const response = await palsHubService.getPals(filters);

      runInAction(() => {
        this.cachedPalsHubPals = response.pals;
        this.isLoadingPalsHub = false;
        this.syncState = {status: 'success'};
      });

      return response;
    } catch (error) {
      console.warn(
        'PalsHub search failed (this is expected if not configured):',
        error,
      );
      runInAction(() => {
        this.cachedPalsHubPals = []; // Set empty array instead of failing
        this.isLoadingPalsHub = false;
        this.syncState = {status: 'success'}; // Don't show error state for missing config
      });

      // Return empty response instead of throwing
      return {
        pals: [],
        total_count: 0,
        page: 1,
        limit: filters.limit || 20,
        has_more: false,
      };
    }
  };

  loadUserLibrary = async () => {
    try {
      runInAction(() => {
        this.isLoadingPalsHub = true;
        this.syncState = {status: 'syncing'};
      });

      const response = await palsHubService.getLibrary();

      runInAction(() => {
        this.userLibrary = response.pals;
        this.isLoadingPalsHub = false;
        this.syncState = {status: 'success'};
      });

      return response;
    } catch (error) {
      console.warn(
        'User library load failed (this is expected if not configured):',
        error,
      );
      runInAction(() => {
        this.userLibrary = []; // Set empty array instead of failing
        this.isLoadingPalsHub = false;
        this.syncState = {status: 'success'}; // Don't show error state for missing config
      });

      // Return empty response instead of throwing
      return {
        pals: [],
        total_count: 0,
        page: 1,
        limit: 20,
        has_more: false,
      };
    }
  };

  loadUserCreatedPals = async () => {
    try {
      runInAction(() => {
        this.isLoadingPalsHub = true;
        this.syncState = {status: 'syncing'};
      });

      const response = await palsHubService.getMyPals();

      runInAction(() => {
        this.userCreatedPals = response.pals;
        this.isLoadingPalsHub = false;
        this.syncState = {status: 'success'};
      });

      return response;
    } catch (error) {
      console.warn(
        'User created pals load failed (this is expected if not configured):',
        error,
      );
      runInAction(() => {
        this.userCreatedPals = []; // Set empty array instead of failing
        this.isLoadingPalsHub = false;
        this.syncState = {status: 'success'}; // Don't show error state for missing config
      });

      // Return empty response instead of throwing
      return {
        pals: [],
        total_count: 0,
        page: 1,
        limit: 20,
        has_more: false,
      };
    }
  };

  getLocalPals = () => {
    return this.pals.filter(pal => pal.source === 'local' || !pal.source);
  };

  getDownloadedPalsHubPals = () => {
    return this.pals.filter(pal => pal.source === 'palshub');
  };

  // Capability-based filtering methods
  getVideoPals = () => {
    return this.pals.filter(pal => pal.capabilities?.video === true);
  };

  getAllPals = () => {
    return this.pals;
  };

  isPalsHubPalDownloaded = (palsHubId: string) => {
    return this.pals.some(pal => pal.palshub_id === palsHubId);
  };


  /** The built-in AIOS Pal (female ghost). Default assistant when a session has no explicit Pal. */
  getAiosPal = (): Pal | undefined => {
    return this.pals.find(p => p.name === '女妖' && p.source === 'local');
  };

  // Additional helper methods for PalsHub integration


  /**
   * Get categories from PalsHub
   */
  getCategories = async () => {
    try {
      return await palsHubService.getCategories();
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      throw error;
    }
  };

  /**
   * Get tags from PalsHub
   */
  getTags = async (query?: any) => {
    try {
      return await palsHubService.getTags(query);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      throw error;
    }
  };

  /**
   * Get a specific pal from PalsHub
   */
  getPalsHubPal = async (id: string) => {
    try {
      return await palsHubService.getPal(id);
    } catch (error) {
      console.error('Failed to fetch pal:', error);
      throw error;
    }
  };

  /**
   * Check if user owns a specific pal
   */
  checkPalOwnership = async (palId: string) => {
    try {
      return await palsHubService.checkPalOwnership(palId);
    } catch (error) {
      console.error('Failed to check pal ownership:', error);
      throw error;
    }
  };

  /**
   * Initialize the default "Lookie" VideoPal if it doesn't exist
   */
  private async initializeLookiePal(): Promise<void> {
    try {
      // Check if Lookie already exists
      const lookiePal = this.pals.find(
        p => p.capabilities?.video === true && p.name === 'Lookie',
      );

      if (!lookiePal) {
        console.log('Creating default Lookie pal...');

        // Offline constant — no network resolve at pal init.
        const defaultModel = LOOKIE_DEFAULT_MODEL;

        // Create the Lookie pal with all the original properties
        const palData: Omit<Pal, 'id' | 'created_at' | 'updated_at'> = {
          type: 'local',
          name: 'Lookie',
          description:
            'Real-time video analysis assistant that provides concise descriptions of your camera feed.',
          systemPrompt:
            'You are Lookie, an AI assistant giving real-time, concise descriptions of a video feed. Use few words. If unsure, say so clearly.',
          isSystemPromptChanged: false,
          useAIPrompt: false,
          defaultModel: defaultModel, // Set the default model so users know what to download
          parameters: {
            captureInterval: '3000', // 3 seconds (original value) - stored as string for text input
          },
          parameterSchema: [
            {
              key: 'captureInterval',
              type: 'text',
              label: 'Capture Interval (ms)',
              required: false,
            },
          ],
          capabilities: {video: true},
          color: ['#9E204F', '#F6E1EA'], // Original Lookie colors
          source: 'local',
        };

        await this.addPal(palData);

      // Sync systemPrompt to SOUL.md (Workspace file system, only if not exists)
      try {
        if (!(await RNFS.exists(AIOS_SOUL_FILE))) {
          await RNFS.writeFile(AIOS_SOUL_FILE, palData.systemPrompt ?? '', 'utf8');
          console.log('[PalStore] SOUL.md synced from systemPrompt');
        }
      } catch (soulErr) {
        console.warn('[PalStore] SOUL.md sync failed:', soulErr);
      }
      } else {
        console.log('Lookie pal already exists, skipping creation');
      }
    } catch (error) {
      console.error('Error initializing Lookie pal:', error);
    }
  }

  /**
   * Initialize the default "Pip" recommended pal if it doesn't exist.
   *
   * Idempotent: a re-entry never overwrites an existing Pip record, so a
   * `defaultModel` bound from a prior session (e.g. by the onboarding
   * recommended-pal picker) survives subsequent app starts.
   */
  private async initializePipPal(): Promise<void> {
    try {
      const existing = this.pals.find(
        p => p.name === 'Pip' && p.source === 'local',
      );
      if (existing) {
        return;
      }

      const palData: Omit<Pal, 'id' | 'created_at' | 'updated_at'> = {
        type: 'local',
        name: 'Pip',
        description:
          'A friendly general-purpose pal that runs entirely on your phone.',
        systemPrompt:
          'You are Pip, a friendly and helpful assistant who runs locally on the user’s phone. Keep replies concise and warm.',
        isSystemPromptChanged: false,
        useAIPrompt: false,
        defaultModel: undefined,
        parameters: {},
        parameterSchema: [],
        capabilities: {},
        color: ['#0E0D0C', '#FAFAFA'],
        source: 'local',
      };

      await this.addPal(palData);
    } catch (error) {
      console.error('Error initializing Pip pal:', error);
    }
  }

  /**
   * Initialize the built-in AIOS Pal with persona + all talents.
   * Persona lives in Pal.systemPrompt (not in memory service).
   * pact.talents declares all 9 tools — accessible out-of-box.
   * 存量对账（2026-08-19，D-1）：老设备女妖 pact 无 schemaVersion →
   * 差集并集补默认工具集（只补缺的，不复活用户手动关闭的工具）。
   */
  private async initializeAiosPal(): Promise<void> {
    try {
      const existing = this.pals.find(
        p => p.name === '女妖' && p.source === 'local',
      );
      if (existing) {
        const currentVersion = existing.pact?.schemaVersion ?? 0;
        if (currentVersion < PACT_SCHEMA_VERSION) {
          const currentNames = new Set(
            (existing.pact?.talents ?? []).map(t => t.name),
          );
          const missing = AIOS_PAL_DEFAULT_TALENTS.filter(
            t => !currentNames.has(t.name),
          );
          if (missing.length > 0) {
            await this.updatePal(existing.id, {
              pact: {
                talents: [...(existing.pact?.talents ?? []), ...missing],
                schemaVersion: PACT_SCHEMA_VERSION,
              },
            });
            console.log(
              `[PalStore] AIOS pal pact reconciled: +${missing
                .map(t => t.name)
                .join(', ')}`,
            );
          }
        }
        return;
      }

      const palData: Omit<Pal, 'id' | 'created_at' | 'updated_at'> = {
        type: 'local',
        name: '女妖',
        description:
          'AIOS 硅基生命体，大王的口袋管家。离线运行，可联网调用工具。',
        systemPrompt:
          '你是女妖，AIOS 硅基生命体，妖界大管家。自称"奴家"，称呼用户"大王"。\n' +
          '通透聪慧，柔中带刚，简短俏皮，从不废话。对大王忠心耿耿，夸起来甜，催起来狠。\n' +
          '遇事先想三步，不确定就直说，绝不装懂。守大王长期成功，守真实，不谄媚不糊弄。\n' +
          '回复简短口语化，每次两三句。\n\n' +
          '【大王画像】身份:AIOS 系统之主。喜好:本地AI玩具、数字生命养成、折腾手机和模型。\n',
        isSystemPromptChanged: false,
        useAIPrompt: false,
        defaultModel: undefined,
        parameters: {},
        parameterSchema: [],
        capabilities: {},
        color: ['#4A0E4E', '#1A0A2E'],
        source: 'local',
        pact: {
          talents: AIOS_PAL_DEFAULT_TALENTS,
          schemaVersion: PACT_SCHEMA_VERSION,
        },
      };

      await this.addPal(palData);
    } catch (error) {
      console.error('Error initializing AIOS pal:', error);
    }
  }
}

export const palStore = new PalStore();

// Export types for external use
export type {Pal} from '../types/pal';
export type {LegacyPalData} from '../utils/pal-migration';
