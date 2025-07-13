/**
 * Creates voice management and caching service using network and storage services.
 * Fetches available voices, transforms Edge TTS voice data to expo-speech format,
 * implements voice list caching with TTL, provides voice search and filtering
 * functionality, and handles multilingual voice capabilities.
 */

import type { EdgeSpeechVoice, SpeechVoiceConfig } from "../types";
import { EDGE_TTS_VOICE_LIST_URL, VOICE_CACHING } from "../constants";
import { StorageService } from "./storageService";

/**
 * Voice cache entry with TTL
 */
interface VoiceCacheEntry {
  voices: EdgeSpeechVoice[];
  timestamp: Date;
  expiresAt: Date;
}

/**
 * Voice filtering options
 */
interface VoiceFilterOptions {
  language?: string;
  gender?: "Male" | "Female";
  contentCategories?: string[];
  voicePersonalities?: string[];
}

/**
 * Voice management and caching service
 * Handles voice fetching, transformation, caching, and filtering
 */
export class VoiceService {
  private static instance: VoiceService | null = null;

  /** Storage service for caching */
  private storageService: StorageService;

  /** Voice cache */
  private voiceCache: VoiceCacheEntry | null = null;

  /** Service configuration */
  private config: Required<SpeechVoiceConfig>;

  /** Debug logging flag */
  private debugLog: boolean;

  constructor(config?: Partial<SpeechVoiceConfig>) {
    this.config = {
      cacheTTL: VOICE_CACHING.VOICE_LIST_TTL,
      enableDebugLogging: false,
      networkTimeout: 10000,
      ...config,
    };

    this.debugLog = this.config.enableDebugLogging;
    this.storageService = StorageService.getInstance();
  }

  /**
   * Get singleton instance of voice service
   */
  static getInstance(config?: Partial<SpeechVoiceConfig>): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService(config);
    }
    return VoiceService.instance;
  }

  /**
   * Get available voices with caching
   * Fetches from cache if available and not expired, otherwise fetches from network
   */
  async getAvailableVoices(): Promise<EdgeSpeechVoice[]> {
    this.log("Getting available voices...");

    // Check cache first
    if (this.isVoiceCacheValid()) {
      this.log("Returning cached voices");
      return this.voiceCache!.voices;
    }

    // Fetch from network
    try {
      this.log("Fetching voices from network...");
      const voices = await this.fetchVoicesFromNetwork();

      // Update cache
      this.updateVoiceCache(voices);

      return voices;
    } catch (error) {
      this.log("Network fetch failed:", error);

      // Try to return expired cache as fallback
      if (this.voiceCache) {
        this.log("Returning expired cache as fallback");
        return this.voiceCache.voices;
      }

      // No cache available, throw error
      throw new Error(
        `Failed to fetch voices: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Search and filter voices
   */
  async getFilteredVoices(
    filterOptions: VoiceFilterOptions,
  ): Promise<EdgeSpeechVoice[]> {
    this.log("Filtering voices with options:", filterOptions);

    const allVoices = await this.getAvailableVoices();

    return allVoices.filter((voice) => {
      // Filter by language
      if (filterOptions.language) {
        // Direct comparison since voice.language is already a language code
        if (voice.language !== filterOptions.language) {
          return false;
        }
      }

      // Filter by gender (now available in EdgeSpeechVoice)
      if (filterOptions.gender) {
        if (voice.gender.toLowerCase() !== filterOptions.gender.toLowerCase()) {
          return false;
        }
      }

      // Filter by content categories
      if (
        filterOptions.contentCategories &&
        filterOptions.contentCategories.length > 0
      ) {
        const hasMatchingCategory = filterOptions.contentCategories.some(
          (category) =>
            voice.contentCategories.some((voiceCategory) =>
              voiceCategory.toLowerCase().includes(category.toLowerCase()),
            ),
        );
        if (!hasMatchingCategory) {
          return false;
        }
      }

      // Filter by voice personalities
      if (
        filterOptions.voicePersonalities &&
        filterOptions.voicePersonalities.length > 0
      ) {
        const hasMatchingPersonality = filterOptions.voicePersonalities.some(
          (personality) =>
            voice.voicePersonalities.some((voicePersonality) =>
              voicePersonality
                .toLowerCase()
                .includes(personality.toLowerCase()),
            ),
        );
        if (!hasMatchingPersonality) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Find voice by identifier
   */
  async findVoiceByIdentifier(
    identifier: string,
  ): Promise<EdgeSpeechVoice | null> {
    this.log(`Finding voice by identifier: ${identifier}`);

    const voices = await this.getAvailableVoices();
    return voices.find((voice) => voice.identifier === identifier) || null;
  }

  /**
   * Validate voice selection
   */
  async validateVoiceSelection(voiceIdentifier: string): Promise<{
    isValid: boolean;
    voice?: EdgeSpeechVoice;
    suggestions?: EdgeSpeechVoice[];
  }> {
    this.log(`Validating voice selection: ${voiceIdentifier}`);

    const voices = await this.getAvailableVoices();

    // Check exact match
    const exactMatch = voices.find(
      (voice) => voice.identifier === voiceIdentifier,
    );
    if (exactMatch) {
      return { isValid: true, voice: exactMatch };
    }

    // Find similar voices for suggestions
    let suggestions = voices
      .filter(
        (voice) =>
          voice.identifier
            .toLowerCase()
            .includes(voiceIdentifier.toLowerCase()) ||
          voice.name.toLowerCase().includes(voiceIdentifier.toLowerCase()),
      )
      .slice(0, 5); // Limit to 5 suggestions

    // If no partial matches found, try to extract language and suggest voices for that language
    if (suggestions.length === 0) {
      // Try to extract language from the identifier (e.g., "en-US" from "en-US-InvalidVoice")
      // Support various BCP 47 language formats including script-specific and regional variants
      const languageMatch = voiceIdentifier.match(
        /^([a-z]{2,3}-[A-Za-z]{2,}(?:-[A-Za-z]+)?)-/,
      );
      if (languageMatch) {
        const language = languageMatch[1];
        suggestions = voices
          .filter((voice) => voice.language === language)
          .slice(0, 5);
      }
    }

    return {
      isValid: false,
      suggestions,
    };
  }

  /**
   * Get voices by language
   */
  async getVoicesByLanguage(language: string): Promise<EdgeSpeechVoice[]> {
    this.log(`Getting voices for language: ${language}`);

    return this.getFilteredVoices({ language });
  }

  /**
   * Get default voice for language
   */
  async getDefaultVoiceForLanguage(
    language: string,
  ): Promise<EdgeSpeechVoice | null> {
    this.log(`Getting default voice for language: ${language}`);

    const voices = await this.getVoicesByLanguage(language);

    // Return first available voice for the language, or null if none found
    return voices.length > 0 ? voices[0] : null;
  }

  /**
   * Refresh voice cache
   * Forces a fresh fetch from the network
   */
  async refreshVoiceCache(): Promise<EdgeSpeechVoice[]> {
    this.log("Refreshing voice cache...");

    // Clear current cache
    this.voiceCache = null;

    // Fetch fresh data
    return this.getAvailableVoices();
  }

  /**
   * Check if voice cache is valid (exists and not expired)
   */
  private isVoiceCacheValid(): boolean {
    if (!this.voiceCache) {
      return false;
    }

    const now = new Date();
    const isExpired = now > this.voiceCache.expiresAt;

    if (isExpired) {
      this.log("Voice cache expired");
      return false;
    }

    this.log("Voice cache is valid");
    return true;
  }

  /**
   * Update voice cache with new data
   */
  private updateVoiceCache(voices: EdgeSpeechVoice[]): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.cacheTTL);

    this.voiceCache = {
      voices,
      timestamp: now,
      expiresAt,
    };

    this.log(
      `Voice cache updated with ${voices.length} voices, expires at:`,
      expiresAt,
    );
  }

  /**
   * Fetch voices from Edge TTS network service
   */
  private async fetchVoicesFromNetwork(): Promise<EdgeSpeechVoice[]> {
    this.log(`Fetching voices from: ${EDGE_TTS_VOICE_LIST_URL}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.networkTimeout,
    );

    try {
      const response = await fetch(EDGE_TTS_VOICE_LIST_URL, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36 Edg/91.0.864.41",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let edgeVoices: any[];
      try {
        edgeVoices = await response.json();
      } catch (jsonError) {
        throw new Error(
          `Failed to parse voice data: ${jsonError instanceof Error ? jsonError.message : "Invalid JSON"}`,
        );
      }

      this.log(`Fetched ${edgeVoices.length} voices from Edge TTS`);

      // Transform Edge TTS voices to expo-speech format
      return this.transformEdgeVoicesToExpoFormat(edgeVoices);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `Voice list fetch timeout after ${this.config.networkTimeout}ms`,
        );
      }

      throw error;
    }
  }

  /**
   * Transform Edge TTS voice data to EdgeSpeechVoice format
   */
  private transformEdgeVoicesToExpoFormat(
    edgeVoices: any[],
  ): EdgeSpeechVoice[] {
    this.log(
      `Transforming ${edgeVoices.length} Edge TTS voices to EdgeSpeechVoice format`,
    );

    return edgeVoices
      .map((edgeVoice) => {
        // Use ShortName as identifier (e.g., "en-US-AriaNeural")
        const identifier = edgeVoice.ShortName || edgeVoice.Name;

        // Extract friendly name or use ShortName as fallback
        const name =
          edgeVoice.FriendlyName || edgeVoice.ShortName || edgeVoice.Name;

        // Use Locale as language
        const language = edgeVoice.Locale;

        // Extract gender (keep capitalized as per Edge TTS API format)
        const gender = edgeVoice.Gender || "Unknown";

        // Extract content categories from VoiceTag (default to empty array if not available)
        const contentCategories = edgeVoice.VoiceTag?.ContentCategories || [];

        // Extract voice personalities from VoiceTag (default to empty array if not available)
        const voicePersonalities = edgeVoice.VoiceTag?.VoicePersonalities || [];

        return {
          identifier,
          name,
          language,
          gender,
          contentCategories,
          voicePersonalities,
        };
      })
      .filter((voice) => {
        // Filter out any voices with missing required fields
        return voice.identifier && voice.name && voice.language;
      });
  }

  /**
   * Debug logging helper
   */
  private log(message: string, ...args: any[]): void {
    if (this.debugLog) {
      console.log(`[VoiceService] ${message}`, ...args);
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      cacheValid: this.isVoiceCacheValid(),
      cacheExpiration: this.voiceCache?.expiresAt || null,
      cachedVoiceCount: this.voiceCache?.voices.length || 0,
      cacheTimestamp: this.voiceCache?.timestamp || null,
    };
  }

  // ===========================================================================
  // StateManager Integration Methods
  // ===========================================================================

  /**
   * Initialize the service (for StateManager integration)
   */
  async initialize(): Promise<void> {
    this.log("VoiceService initialized");
    // No specific initialization needed for voice service
  }

  /**
   * Cleanup the service (for StateManager integration)
   */
  async cleanup(): Promise<void> {
    this.log("VoiceService cleanup");
    // Clear cache to free memory
    this.voiceCache = null;
  }
}

/**
 * Default voice service instance
 */
export default VoiceService;
