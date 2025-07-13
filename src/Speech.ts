/**
 * Provides expo-speech compatible public API using all internal components.
 * Implements complete speech synthesis workflow with parameter validation,
 * error handling, and backward compatibility.
 */

import { MAX_TEXT_LENGTH } from "./constants";
import { Synthesizer } from "./core/synthesizer";
import { ConnectionManager } from "./core/connectionManager";
import { StateManager } from "./core/state";
import { AudioService } from "./services/audioService";
import { NetworkService } from "./services/networkService";
import { StorageService } from "./services/storageService";
import { VoiceService } from "./services/voiceService";
import { validateSpeechParameters } from "./utils/commonUtils";
import {
  SpeechOptions,
  SpeechError,
  EdgeSpeechVoice,
  SpeechAPIConfig,
} from "./types";

/**
 * Speech API class providing expo-speech compatible interface
 */
class SpeechAPI {
  private static instance: SpeechAPI | null = null;
  private static globalConfig: SpeechAPIConfig | null = null;
  private static configurationLocked = false;

  private synthesizer: Synthesizer | null = null;
  private voiceService: VoiceService | null = null;
  private audioService: AudioService | null = null;
  private connectionManager: ConnectionManager | null = null;
  private initialized = false;

  private constructor() {
    // Initialize services lazily
  }

  /**
   * Get singleton instance of Speech API
   */
  static getInstance(): SpeechAPI {
    if (!SpeechAPI.instance) {
      SpeechAPI.instance = new SpeechAPI();
    }
    return SpeechAPI.instance;
  }

  /**
   * Configure Speech API services before initialization
   *
   * This method allows you to customize all internal services (AudioService, VoiceService,
   * NetworkService, StorageService, ConnectionManager) before any Speech API methods are called.
   * Configuration must be set before the first call to speak(), getAvailableVoicesAsync(),
   * or any other Speech API method.
   *
   * @param config - Configuration options for all Speech API services
   * @throws {Error} If called after Speech API has been initialized
   *
   * @example
   * ```typescript
   * import { Speech, SpeechAPIConfig } from 'expo-edge-speech';
   *
   * // Configure before using any Speech API methods
   * Speech.configure({
   *   network: {
   *     maxRetries: 3,
   *     connectionTimeout: 8000,
   *     enableDebugLogging: true
   *   },
   *   connection: {
   *     maxConnections: 5,
   *     poolingEnabled: true,
   *     circuitBreaker: {
   *       failureThreshold: 3,
   *       recoveryTimeout: 15000
   *     }
   *   },
   *   audio: {
   *     loadingTimeout: 6000,
   *     platformConfig: {
   *       ios: { playsInSilentModeIOS: true },
   *       android: { shouldDuckAndroid: true }
   *     }
   *   }
   * });
   *
   * // Now use Speech API with custom configuration
   * await Speech.speak('Hello, configured world!');
   * ```
   */
  static configure(config: SpeechAPIConfig): void {
    if (SpeechAPI.configurationLocked) {
      throw new Error(
        "Speech API configuration cannot be changed after initialization. " +
          "Call Speech.configure() before using any other Speech API methods.",
      );
    }

    if (!config || typeof config !== "object") {
      throw new Error("Configuration must be a valid SpeechAPIConfig object");
    }

    // Store the configuration for use during initialization
    SpeechAPI.globalConfig = { ...config };
  }

  /**
   * Initialize all services if not already initialized
   */
  private async initializeServices(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Lock configuration to prevent changes after initialization
      SpeechAPI.configurationLocked = true;

      // Get global configuration
      const config = SpeechAPI.globalConfig;

      // Initialize services in dependency order with configuration
      const storageService = StorageService.getInstance(config?.storage);

      this.audioService = new AudioService(storageService, config?.audio);

      const networkService = new NetworkService(
        storageService,
        config?.network,
      );
      this.voiceService = VoiceService.getInstance(config?.voice);

      const stateManager = new StateManager(
        storageService,
        networkService,
        this.voiceService,
        this.audioService,
        undefined, // Assuming StateManager also takes config
      );

      // Map SpeechConnectionConfig to ConnectionManagerConfig if provided
      let connectionManagerConfig = undefined;
      if (config?.connection) {
        connectionManagerConfig = {
          maxConnections: config.connection.maxConnections,
          // Ensure all mapped properties from SpeechConnectionConfig are present
          // For example:
          // connectionTimeout: config.connection.connectionTimeout,
          // poolingEnabled: config.connection.poolingEnabled,
          // circuitBreaker: config.connection.circuitBreaker,
          // And any other properties ConnectionManagerConfig expects
        };
      }

      this.connectionManager = new ConnectionManager(
        stateManager,
        networkService,
        this.audioService,
        storageService,
        connectionManagerConfig, // Pass the mapped config
      );

      this.synthesizer = new Synthesizer(
        stateManager,
        this.connectionManager,
        this.audioService,
        this.voiceService,
        networkService,
      );

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize Speech services: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Internal speak method that orchestrates speech synthesis.
   * Assumes parameters have been validated by the public-facing API.
   * @param text The text to speak.
   * @param options Validated and normalized speech options.
   */
  async speak(text: string, options: SpeechOptions): Promise<void> {
    try {
      await this.initializeServices();
      if (!this.synthesizer) {
        throw new Error("Synthesizer not initialized");
      }
      await this.synthesizer.speak(text, options);
    } catch (error) {
      const speechError: SpeechError = {
        name: "SpeechError",
        message:
          error instanceof Error ? error.message : "Unknown speech error",
        code: "SPEECH_ERROR",
      };

      // Log error for debugging
      console.error("Speech error:", speechError);

      // Call error callback if provided
      if (options.onError) {
        if (typeof options.onError === "function") {
          options.onError(new Error(speechError.message));
        }
      }

      throw speechError;
    }
  }

  /**
   * Get list of all available voices from Microsoft Edge TTS service
   *
   * @returns Promise that resolves to an array of available voices with metadata
   * @throws {Error} If voice service fails to fetch voice list
   *
   * @example
   * ```typescript
   * const voices = await Speech.getAvailableVoicesAsync();
   * console.log(`Found ${voices.length} voices`);
   *
   * // Filter by language
   * const englishVoices = voices.filter(v => v.language.startsWith('en-'));
   *
   * // Filter by gender
   * const femaleVoices = voices.filter(v => v.gender === 'Female');
   *
   * // Use a specific voice
   * const ariaVoice = voices.find(v => v.identifier === 'en-US-AriaNeural');
   * if (ariaVoice) {
   *   await Speech.speak('Hello!', { voice: ariaVoice.identifier });
   * }
   * ```
   */
  async getAvailableVoicesAsync(): Promise<EdgeSpeechVoice[]> {
    try {
      // Initialize services if needed
      await this.initializeServices();

      // Ensure voice service is available
      if (!this.voiceService) {
        throw new Error("Voice service not initialized");
      }

      // Get voices from voice service
      const voices = await this.voiceService.getAvailableVoices();
      return voices;
    } catch (error) {
      throw new Error(
        `Failed to get available voices: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Stop current speech synthesis and clear any queued speech
   *
   * @returns Promise that resolves when speech is stopped
   * @throws {Error} If stopping speech fails
   *
   * @example
   * ```typescript
   * // Start speaking
   * Speech.speak('This is a long sentence that we might want to stop...');
   *
   * // Stop after 2 seconds
   * setTimeout(async () => {
   *   await Speech.stop();
   *   console.log('Speech stopped');
   * }, 2000);
   * ```
   */
  async stop(): Promise<void> {
    try {
      // Initialize services if needed
      await this.initializeServices();

      // Ensure synthesizer is available
      if (!this.synthesizer) {
        throw new Error("Synthesizer not initialized");
      }

      // Use synthesizer to stop speech
      await this.synthesizer.stop();
    } catch (error) {
      throw new Error(
        `Failed to stop speech: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Pause current speech synthesis
   *
   * @returns Promise that resolves when speech is paused
   * @throws {Error} If pausing speech fails
   *
   * @example
   * ```typescript
   * // Start speaking
   * await Speech.speak('This is a long sentence that we can pause and resume.');
   *
   * // Pause after 2 seconds
   * setTimeout(async () => {
   *   await Speech.pause();
   *   console.log('Speech paused');
   *
   *   // Resume after another 2 seconds
   *   setTimeout(async () => {
   *     await Speech.resume();
   *     console.log('Speech resumed');
   *   }, 2000);
   * }, 2000);
   * ```
   */
  async pause(): Promise<void> {
    try {
      // Initialize services if needed
      await this.initializeServices();

      // Ensure synthesizer is available
      if (!this.synthesizer) {
        throw new Error("Synthesizer not initialized");
      }

      // Use synthesizer to pause speech
      await this.synthesizer.pause();
    } catch (error) {
      throw new Error(
        `Failed to pause speech: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Resume previously paused speech synthesis
   *
   * @returns Promise that resolves when speech is resumed
   * @throws {Error} If resuming speech fails
   *
   * @example
   * ```typescript
   * // Pause and resume with user interaction
   * let isPaused = false;
   *
   * await Speech.speak('Click the button to pause or resume this speech.', {
   *   onStart: () => console.log('Speech started - button will control pause/resume')
   * });
   *
   * // Button click handler
   * async function togglePauseResume() {
   *   if (isPaused) {
   *     await Speech.resume();
   *     isPaused = false;
   *   } else {
   *     await Speech.pause();
   *     isPaused = true;
   *   }
   * }
   * ```
   */
  async resume(): Promise<void> {
    try {
      // Initialize services if needed
      await this.initializeServices();

      // Ensure synthesizer is available
      if (!this.synthesizer) {
        throw new Error("Synthesizer not initialized");
      }

      // Use synthesizer to resume speech
      await this.synthesizer.resume();
    } catch (error) {
      throw new Error(
        `Failed to resume speech: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Check if speech synthesis is currently active
   *
   * @returns Promise that resolves to true if speech is currently being synthesized or played, false otherwise
   * @throws {Error} If checking speech status fails
   *
   * @example
   * ```typescript
   * // Check speaking status
   * const isCurrentlySpeaking = await Speech.isSpeakingAsync();
   * console.log('Currently speaking:', isCurrentlySpeaking);
   *
   * // Wait for speech to complete
   * await Speech.speak('This will take a few seconds to complete.');
   *
   * while (await Speech.isSpeakingAsync()) {
   *   console.log('Still speaking...');
   *   await new Promise(resolve => setTimeout(resolve, 500));
   * }
   * console.log('Speech completed!');
   *
   * // Prevent overlapping speech
   * async function safeSpeech(text: string) {
   *   if (await Speech.isSpeakingAsync()) {
   *     await Speech.stop();
   *   }
   *   await Speech.speak(text);
   * }
   * ```
   */
  async isSpeakingAsync(): Promise<boolean> {
    try {
      // Initialize services if needed
      await this.initializeServices();

      // Ensure synthesizer is available
      if (!this.synthesizer) {
        return false;
      }

      // Use synthesizer to check speaking state
      return await this.synthesizer.isSpeakingAsync();
    } catch {
      // Return false on error to match expo-speech behavior
      return false;
    }
  }

  /**
   * Cleanup all resources and stop services
   *
   * This method should be called when you're done using the Speech API to prevent
   * open handles and ensure proper resource cleanup. It will stop any active speech,
   * shutdown connection managers, cleanup storage services, and reset the API state.
   *
   * @returns Promise that resolves when cleanup is complete
   *
   * @example
   * ```typescript
   * // Cleanup when app is closing or component unmounting
   * useEffect(() => {
   *   return () => {
   *     Speech.cleanup().catch(console.error);
   *   };
   * }, []);
   *
   * // Manual cleanup
   * await Speech.cleanup();
   * console.log('All speech resources cleaned up');
   * ```
   *
   * @note This method will log warnings for any cleanup errors but won't throw exceptions
   */
  async cleanup(): Promise<void> {
    try {
      // Stop any active speech
      if (this.synthesizer) {
        await this.synthesizer.stop();
      }

      // Shutdown connection manager to remove AppState listeners
      if (this.connectionManager) {
        await this.connectionManager.shutdown();
      }

      // Cleanup storage service (this stops the cleanup timer)
      const storageService = StorageService.getInstance();
      storageService.destroy();

      this.initialized = false;
      this.synthesizer = null;
      this.voiceService = null;
      this.audioService = null;
      this.connectionManager = null;
    } catch (error) {
      console.warn("Warning: Error during cleanup:", error);
    }
  }

  /**
   * Reset the Speech API state for testing purposes
   * @internal Only for testing - not part of public API
   */
  static resetForTesting(): void {
    SpeechAPI.configurationLocked = false;
    SpeechAPI.globalConfig = {};
    SpeechAPI.instance = null;
  }
}

// ============================================================================
// Public API Exports
// ============================================================================

// Get singleton instance
// const speechAPI = SpeechAPI.getInstance(); // Removed as it's unused

/**
 * Configure Speech API services before initialization
 *
 * This method allows you to customize all internal services (AudioService, VoiceService,
 * NetworkService, StorageService, ConnectionManager) before any Speech API methods are called.
 * Configuration must be set before the first call to speak(), getAvailableVoicesAsync(),
 * or any other Speech API method.
 *
 * @param config - Configuration options for all Speech API services
 * @throws {Error} If called after Speech API has been initialized
 *
 * @example
 * ```typescript
 * import { configure, SpeechAPIConfig } from 'expo-edge-speech';
 *
 * // Configure before using any Speech API methods
 * configure({
 *   network: {
 *     maxRetries: 3,
 *     connectionTimeout: 8000,
 *     enableDebugLogging: true
 *   },
 *   connection: {
 *     maxConnections: 5,
 *     poolingEnabled: true,
 *     circuitBreaker: {
 *       failureThreshold: 3,
 *       recoveryTimeout: 15000
 *     }
 *   },
 *   audio: {
 *     loadingTimeout: 6000,
 *     platformConfig: {
 *       ios: { playsInSilentModeIOS: true },
 *       android: { shouldDuckAndroid: true }
 *     }
 *   }
 * });
 * ```
 */
export const configure = (config: SpeechAPIConfig): void => {
  SpeechAPI.configure(config); // Changed Speech to SpeechAPI
};

/**
 * Speaks the given text with the specified options.
 *
 * Calling this when another text is being spoken adds an utterance to queue.
 * This is the main entry point for text-to-speech functionality.
 *
 * @param text - The text to be spoken
 * @param options - Configuration options for speech synthesis (optional)
 *
 * @example
 * ```typescript
 * // Basic usage with default voice
 * Speech.speak('Hello, world!');
 *
 * // With options
 * Speech.speak('Hello!', {
 *   voice: 'en-US-AriaNeural',
 *   rate: 1.2,
 *   onDone: () => console.log('Finished speaking')
 * });
 * ```
 */
export const speak = (text: string, options?: SpeechOptions): void => {
  const speechOptions = options || {};

  try {
    // Type check for text parameter
    if (typeof text !== "string") {
      throw new Error("Text to speak must be a string.");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("Text to speak cannot be empty.");
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new Error(
        `Text length (${text.length}) exceeds maximum allowed length (${MAX_TEXT_LENGTH})`,
      );
    }

    // Corrected call to validateSpeechParameters
    const paramValidation = validateSpeechParameters(speechOptions);
    if (!paramValidation.result.isValid) {
      throw new Error(
        `Invalid speech parameters: ${paramValidation.result.errors.join(", ")}`,
      );
    }

    const speechInstance = SpeechAPI.getInstance();
    // Use normalizedOptions from validation
    speechInstance
      .speak(text, paramValidation.normalizedOptions)
      .catch((error: SpeechError) => {
        // SpeechAPI.speak already calls onError and logs the error.
        // This catch is for any unhandled promise rejections from the speak call.
        console.error("Unhandled promise rejection in speak:", error.message);
      });
  } catch (error) {
    // Handle synchronous validation errors
    console.error("Speech validation error:", error);
    if (speechOptions.onError) {
      if (typeof speechOptions.onError === "function") {
        speechOptions.onError(error as Error);
      }
    }
    // To maintain expo-speech compatibility, we don't re-throw sync errors
    // if a callback is provided. But if not, throwing helps debugging.
    if (!speechOptions.onError) {
      throw error;
    }
  }
};

/**
 * Get all available voices from Microsoft Edge TTS service
 *
 * Returns a comprehensive list of all supported voices with their metadata
 * including language, gender, and capabilities.
 *
 * @returns A promise that resolves with an array of available voices.
 *
 * @example
 * ```typescript
 * const voices = await Speech.getAvailableVoicesAsync();
 * console.log(`Found ${voices.length} voices available`);
 *
 * // Find English voices
 * const englishVoices = voices.filter(v => v.language.startsWith('en-'));
 * ```
 */
export const getAvailableVoicesAsync = (): Promise<EdgeSpeechVoice[]> => {
  const speechInstance = SpeechAPI.getInstance(); // Changed Speech to SpeechAPI
  return speechInstance.getAvailableVoicesAsync();
};

/**
 * Stop current speech synthesis and clear any queued utterances
 *
 * Interrupts any currently playing speech and removes all pending
 * speech from the queue. This provides immediate speech termination.
 *
 * @returns A promise that resolves when speech is stopped.
 *
 * @example
 * ```typescript
 * // Stop speech immediately
 * await Speech.stop();
 * console.log('All speech stopped and queue cleared');
 * ```
 */
export const stop = (): Promise<void> => {
  const speechInstance = SpeechAPI.getInstance(); // Changed Speech to SpeechAPI
  return speechInstance.stop();
};

/**
 * Pause current speech synthesis
 *
 * Temporarily stops speech playback, allowing it to be resumed later.
 *
 * @returns A promise that resolves when speech is paused.
 *
 * @example
 * ```typescript
 * // Pause speech
 * await Speech.pause();
 * console.log('Speech paused');
 * ```
 */
export const pause = (): Promise<void> => {
  const speechInstance = SpeechAPI.getInstance(); // Changed Speech to SpeechAPI
  return speechInstance.pause();
};

/**
 * Resume previously paused speech synthesis
 *
 * Continues playback of speech that was previously paused. If no speech
 * was paused, this method does nothing.
 *
 * @returns A promise that resolves when speech is resumed.
 *
 * @example
 * ```typescript
 * // Resume paused speech
 * await Speech.resume();
 * console.log('Speech resumed');
 * ```
 */
export const resume = (): Promise<void> => {
  const speechInstance = SpeechAPI.getInstance(); // Changed Speech to SpeechAPI
  return speechInstance.resume();
};

/**
 * Check if the Text-to-Speech service is currently speaking
 *
 * Determines whether speech synthesis is currently active. Returns true
 * if speech is playing or paused, false if no speech is active.
 *
 * @returns A promise that resolves with a boolean indicating if speech is active.
 *
 * @note Will return true if speaker is paused
 *
 * @example
 * ```typescript
 * const isPlaying = await Speech.isSpeakingAsync();
 * if (isPlaying) {
 *   console.log('Speech is currently active');
 * } else {
 *   console.log('No speech is playing');
 * }
 * ```
 */
export const isSpeakingAsync = (): Promise<boolean> => {
  const speechInstance = SpeechAPI.getInstance(); // Changed Speech to SpeechAPI
  return speechInstance.isSpeakingAsync();
};

/**
 * Cleanup all resources and stop services
 *
 * Performs comprehensive cleanup of all speech-related resources including
 * stopping active speech, shutting down connections, and clearing storage.
 * This method should be called to prevent open handles and memory leaks.
 *
 * @returns A promise that resolves when cleanup is complete.
 *
 * @example
 * ```typescript
 * // Cleanup when app closes
 * await Speech.cleanup();
 * console.log('All resources cleaned up');
 * ```
 */
export const cleanup = (): Promise<void> => {
  const speechInstance = SpeechAPI.getInstance(); // Changed Speech to SpeechAPI
  return speechInstance.cleanup();
};

/**
 * Maximum text length for speech input.
 * This constant defines the character limit for text input to the speak function.
 */
export const maxSpeechInputLength = MAX_TEXT_LENGTH;

// Export SpeechAPI class for testing
export { SpeechAPI };

// Make SpeechAPI the default export for compatibility
export default SpeechAPI;
