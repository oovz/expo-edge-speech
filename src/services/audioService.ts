/**
 * Provides audio playback service using expo-av with integration for Network Service,
 * Storage Service, and Audio Utilities. Handles platform-specific configuration,
 * audio session management, and provides expo-speech compatible callbacks.
 */

import { Audio } from "expo-av";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import type {
  SpeechOptions,
  SpeechEventCallback,
  SpeechError,
  SpeechAudioConfig,
} from "../types";
import { EDGE_TTS_CONFIG } from "../constants";
import { StorageService } from "./storageService";
import { validateEdgeTTSMP3 } from "../utils/audioUtils";

// =============================================================================
// Audio Service Configuration and Types
// =============================================================================

/**
 * Audio playback state enumeration
 */
export enum AudioPlaybackState {
  Idle = "idle",
  Loading = "loading",
  Playing = "playing",
  Paused = "paused",
  Stopped = "stopped",
  Error = "error",
  Completed = "completed",
}

/**
 * User action state enumeration for deterministic action tracking
 */
export enum UserActionState {
  Idle = "idle",
  PauseRequested = "pause-requested",
  ResumeRequested = "resume-requested",
  StopRequested = "stop-requested",
}

// =============================================================================
// Audio Service Implementation
// =============================================================================

/**
 * Audio Service class providing audio playback functionality
 * integration for Edge TTS audio streaming, platform-specific configuration,
 * session management, and expo-speech compatible callbacks.
 */
export class AudioService {
  /** Current audio playback state */
  private state: AudioPlaybackState = AudioPlaybackState.Idle;

  /** Current audio object from expo-av */
  private sound: Audio.Sound | null = null;

  /** Current connection ID for storage coordination */
  private connectionId: string | null = null;

  /** Audio service configuration */
  private config: SpeechAudioConfig;

  /** Storage service instance */
  private storageService: StorageService;

  /** Whether audio session has been initialized */
  private audioSessionInitialized = false;

  /** Current audio URI for expo-av */
  private audioURI: string | null = null;

  /** Current temporary audio file path */
  private tempAudioFilePath: string | null = null;

  // Callback handlers matching expo-speech API
  private onStartCallback: SpeechEventCallback | null = null;
  private onDoneCallback: SpeechEventCallback | null = null;
  private onStoppedCallback: SpeechEventCallback | null = null;
  private onPauseCallback: SpeechEventCallback | null = null;
  private onResumeCallback: SpeechEventCallback | null = null;
  private onErrorCallback: ((error: SpeechError) => void) | null = null;

  // State change callback for StateManager integration
  private onPlaybackStateChangeCallback:
    | ((state: AudioPlaybackState, context?: any) => void)
    | null = null;

  // Enhanced interruption detection state (no timeouts)
  private userActionState: UserActionState = UserActionState.Idle;
  private lastValidPosition: number = 0;

  constructor(
    storageService: StorageService,
    config?: Partial<SpeechAudioConfig>,
  ) {
    this.storageService = storageService;
    this.config = this.createDefaultConfig(config);
  }

  // =============================================================================
  // StateManager Integration Methods
  // =============================================================================

  /**
   * Initialize audio service (required by StateManager)
   */
  async initialize(): Promise<void> {
    try {
      await this.initializeAudioSession();
      this.setState(AudioPlaybackState.Idle);
    } catch (error) {
      this.setState(AudioPlaybackState.Error);
      throw new Error(`AudioService initialization failed: ${error}`);
    }
  }

  /**
   * Cleanup audio service and release resources (required by StateManager)
   */
  async cleanup(): Promise<void> {
    try {
      await this.unloadAudio();
      this.setState(AudioPlaybackState.Idle);

      // Reset enhanced state tracking (no timeouts to clear)
      this.userActionState = UserActionState.Idle;
      this.lastValidPosition = 0;

      // Clear all callbacks
      this.onStartCallback = null;
      this.onDoneCallback = null;
      this.onStoppedCallback = null;
      this.onPauseCallback = null;
      this.onResumeCallback = null;
      this.onErrorCallback = null;
      this.onPlaybackStateChangeCallback = null;

      this.connectionId = null;
      this.audioSessionInitialized = false;
    } catch (error) {
      this.setState(AudioPlaybackState.Error);
      throw new Error(`AudioService cleanup failed: ${error}`);
    }
  }

  /**
   * Register callback for playback state changes (required by StateManager)
   */
  onPlaybackStateChange(
    callback: (state: AudioPlaybackState, context?: any) => void,
  ): void {
    this.onPlaybackStateChangeCallback = callback;
  }

  // =============================================================================
  // Public Methods - expo-speech Compatible API
  // =============================================================================

  /**
   * Play audio from Storage Service buffer using connection ID
   */
  async speak(options: SpeechOptions, connectionId: string): Promise<void> {
    try {
      this.connectionId = connectionId;
      this.setCallbacks(options);

      // Ensure audio session is configured for the platform
      await this.initializeAudioSession();

      console.log(
        `[AudioService] About to call storageService.getMergedAudioData from speak with connectionId: ${connectionId}`,
      );

      // Get merged audio data from Storage Service
      const audioBuffer = this.storageService.getMergedAudioData(connectionId);

      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error("No audio data available for playback");
      }

      // Validate MP3 format using Audio Utilities
      if (!validateEdgeTTSMP3(audioBuffer.buffer as ArrayBuffer)) {
        throw new Error("Invalid MP3 audio format");
      }

      // Create temporary audio file and write buffer
      const tempFileUri = await this.createTempAudioFile(audioBuffer);
      this.tempAudioFilePath = tempFileUri;
      this.audioURI = tempFileUri;

      // Load and play audio
      await this.loadAudio(this.audioURI);
      await this.playAudio();
    } catch (error) {
      const audioError: SpeechError = {
        name: "AudioPlaybackError",
        message: `Audio playback failed: ${error}`,
        code: "AUDIO_PLAYBACK_FAILED",
      };
      this.handleError(audioError);
    }
  }

  /**
   * Play audio from streamed data stored in Storage Service
   */
  async playStreamedAudio(connectionId: string): Promise<void> {
    try {
      console.log(
        `[AudioService] playStreamedAudio called with connectionId: ${connectionId}`,
      );
      this.connectionId = connectionId;

      // Ensure audio session is configured for the platform
      await this.initializeAudioSession();

      // Get merged audio data from Storage Service
      console.log(
        `[AudioService] About to call storageService.getMergedAudioData from playStreamedAudio with connectionId: ${connectionId}`,
      );
      const mergedBuffer = this.storageService.getMergedAudioData(connectionId);

      if (!mergedBuffer || mergedBuffer.length === 0) {
        throw new Error("No audio data available for playback");
      }

      console.log(
        `[AudioService] Successfully retrieved audio buffer (${mergedBuffer.length} bytes) for connectionId: ${connectionId}`,
      );

      // Play the merged audio buffer
      await this.playAudioFromBuffer(mergedBuffer);
    } catch (error) {
      console.error(
        `[AudioService] playStreamedAudio failed for connectionId: ${connectionId}`,
        error,
      );
      const audioError: SpeechError = {
        name: "StreamedAudioError",
        message: `Streamed audio playback failed: ${error}`,
        code: "STREAMED_AUDIO_FAILED",
      };
      this.handleError(audioError);
    }
  }

  /**
   * Pause audio playback
   */
  async pause(): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [AudioService] pause() called - current state: ${this.state}, has sound: ${!!this.sound}`,
    );

    // Set user action state for deterministic tracking
    this.userActionState = UserActionState.PauseRequested;

    try {
      if (this.sound && this.state === AudioPlaybackState.Playing) {
        console.log(`[${timestamp}] [AudioService] Pausing audio playback`);
        await this.sound.pauseAsync();
        this.setState(AudioPlaybackState.Paused);
        console.log(
          `[${timestamp}] [AudioService] Audio paused successfully, state set to Paused`,
        );

        // Note: onPause callback is handled by ConnectionManager, not AudioService
        // This ensures single callback invocation through proper 3-layer coordination
      } else {
        if (!this.sound) {
          console.log(
            `[${timestamp}] [AudioService] Pause skipped - no audio loaded`,
          );
        } else if (this.state === AudioPlaybackState.Paused) {
          console.log(
            `[${timestamp}] [AudioService] Audio is already paused - no action needed`,
          );
        } else {
          console.log(
            `[${timestamp}] [AudioService] Pause not available - current state is ${this.state} (requires Playing state)`,
          );
        }
      }
    } catch (error) {
      console.error(
        `[${timestamp}] [AudioService] Failed to pause audio:`,
        error,
      );
      this.handleError({
        name: "AudioPauseError",
        message: `Failed to pause audio: ${error}`,
        code: "AUDIO_PAUSE_FAILED",
      });
    } finally {
      this.userActionState = UserActionState.Idle;
    }
  }

  /**
   * Resume audio playback
   */
  async resume(): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [AudioService] resume() called - current state: ${this.state}, has sound: ${!!this.sound}`,
    );

    // Set user action state for deterministic tracking
    this.userActionState = UserActionState.ResumeRequested;

    try {
      if (this.sound && this.state === AudioPlaybackState.Paused) {
        console.log(`[${timestamp}] [AudioService] Resuming audio playback`);
        await this.sound.playAsync();
        this.setState(AudioPlaybackState.Playing);
        console.log(
          `[${timestamp}] [AudioService] Audio resumed successfully, state set to Playing`,
        );

        // Note: onResume callback is handled by ConnectionManager, not AudioService
        // This ensures single callback invocation through proper 3-layer coordination
      } else {
        if (!this.sound) {
          console.log(
            `[${timestamp}] [AudioService] Resume skipped - no audio loaded`,
          );
        } else if (this.state === AudioPlaybackState.Playing) {
          console.log(
            `[${timestamp}] [AudioService] Audio is already playing - no action needed`,
          );
        } else {
          console.log(
            `[${timestamp}] [AudioService] Resume not available - current state is ${this.state} (requires Paused state)`,
          );
        }
      }
    } catch (error) {
      console.error(
        `[${timestamp}] [AudioService] Failed to resume audio:`,
        error,
      );
      this.handleError({
        name: "AudioResumeError",
        message: `Failed to resume audio: ${error}`,
        code: "AUDIO_RESUME_FAILED",
      });
    } finally {
      this.userActionState = UserActionState.Idle;
    }
  }

  /**
   * Stop audio playback and cleanup
   */
  async stop(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.stopAsync();
      }

      // Cleanup audio resources
      await this.unloadAudio();

      // Set final state after cleanup
      this.setState(AudioPlaybackState.Stopped);

      if (this.onStoppedCallback) {
        this.onStoppedCallback();
      }

      // Cleanup connection in Storage Service
      if (this.connectionId) {
        this.storageService.cleanupConnection(this.connectionId);
        this.connectionId = null;
      }

      this.clearCallbacks();
    } catch (error) {
      console.warn("Warning: Error during audio cleanup:", error);
    }
  }

  /**
   * Start progressive audio playback as chunks arrive (for streaming)
   */
  async startProgressivePlayback(connectionId: string): Promise<void> {
    try {
      console.log(
        `[AudioService] Starting progressive playback for connectionId: ${connectionId}`,
      );
      this.connectionId = connectionId;

      // Ensure audio session is configured for the platform
      await this.initializeAudioSession();

      // Get current available audio data from Storage Service
      const audioBuffer = this.storageService.getMergedAudioData(connectionId);

      if (!audioBuffer || audioBuffer.length === 0) {
        console.log(
          `[AudioService] No audio data yet for progressive playback, waiting...`,
        );
        return; // This is normal for progressive loading - data will come later
      }

      // Create temporary audio file and write current buffer
      const tempFileUri = await this.createTempAudioFile(audioBuffer);
      this.tempAudioFilePath = tempFileUri;
      this.audioURI = tempFileUri;

      // Load and start playing the partial audio
      await this.loadAudio(this.audioURI);
      await this.playAudio();

      console.log(
        `[AudioService] Progressive playback started for connectionId: ${connectionId}`,
      );
    } catch (error) {
      console.error(
        `[AudioService] Failed to start progressive playback for connectionId: ${connectionId}`,
        error,
      );
      const audioError: SpeechError = {
        name: "ProgressivePlaybackError",
        message: `Progressive playback failed: ${error}`,
        code: "PROGRESSIVE_PLAYBACK_FAILED",
      };
      this.handleError(audioError);
    }
  }

  /**
   * Finalize progressive playback after all chunks have been received
   */
  async finalizeProgressivePlayback(connectionId: string): Promise<void> {
    try {
      console.log(
        `[AudioService] Finalizing progressive playback for connectionId: ${connectionId}`,
      );

      // If audio is currently playing, we need to handle the transition smoothly
      if (this.sound && this.state === AudioPlaybackState.Playing) {
        // Get the final complete audio data
        const finalAudioBuffer =
          this.storageService.getMergedAudioData(connectionId);

        if (finalAudioBuffer && finalAudioBuffer.length > 0) {
          // For now, we'll let the current playback continue
          // In a more sophisticated implementation, we might:
          // 1. Check current playback position
          // 2. Create a new file with complete data
          // 3. Seamlessly transition to the complete file
          console.log(
            `[AudioService] Progressive playback finalized with ${finalAudioBuffer.length} total bytes`,
          );
        }
      }
    } catch (error) {
      console.error(
        `[AudioService] Failed to finalize progressive playback for connectionId: ${connectionId}`,
        error,
      );
      // Don't throw here - the main playback should continue even if finalization fails
    }
  }

  // =============================================================================
  // Private Methods - Internal Implementation
  // =============================================================================

  /**
   * Process audio buffer and validate format
   */
  private async processAudioBuffer(
    audioBuffer: Uint8Array,
  ): Promise<Uint8Array> {
    // Validate MP3 format using Audio Utilities
    if (!validateEdgeTTSMP3(audioBuffer.buffer as ArrayBuffer)) {
      throw new Error("Invalid MP3 audio format");
    }

    // Return validated buffer
    return audioBuffer;
  }

  /**
   * Load audio using expo-av Sound API
   */
  private async loadAudio(uri: string): Promise<void> {
    try {
      this.setState(AudioPlaybackState.Loading);

      const loadingOptions = this.createLoadingOptions();
      const { sound } = await Audio.Sound.createAsync({ uri }, loadingOptions);

      this.sound = sound;

      // Set up playback status update callback
      this.sound.setOnPlaybackStatusUpdate((status) => {
        this.handlePlaybackStatusUpdate(status);
      });
    } catch (error) {
      throw new Error(`Failed to load audio: ${error}`);
    }
  }

  /**
   * Start audio playback
   */
  private async playAudio(): Promise<void> {
    if (!this.sound) {
      throw new Error("No audio loaded for playback");
    }

    this.setState(AudioPlaybackState.Playing);

    if (this.onStartCallback) {
      this.onStartCallback();
    }

    await this.sound.playAsync();
  }

  /**
   * Play audio from buffer data
   */
  private async playAudioFromBuffer(buffer: Uint8Array): Promise<void> {
    // Validate MP3 format using Audio Utilities
    if (!validateEdgeTTSMP3(buffer.buffer as ArrayBuffer)) {
      throw new Error("Invalid MP3 audio format");
    }

    // Create temporary audio file and write buffer
    const tempFileUri = await this.createTempAudioFile(buffer);
    this.tempAudioFilePath = tempFileUri;

    await this.loadAudio(tempFileUri);
    await this.playAudio();
  }

  /**
   * Create temporary audio file from buffer
   */
  private async createTempAudioFile(audioBuffer: Uint8Array): Promise<string> {
    try {
      // Generate a unique filename for the temporary audio file
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const filename = `audio_${timestamp}_${randomId}.mp3`;

      // Use cache directory for temporary files (auto-managed by system)
      const tempFileUri = `${FileSystem.cacheDirectory}${filename}`;

      console.log(
        `[AudioService] Creating temporary audio file: ${tempFileUri}`,
      );

      // Convert Uint8Array to base64 string for FileSystem
      let binaryString = "";
      for (let i = 0; i < audioBuffer.length; i++) {
        binaryString += String.fromCharCode(audioBuffer[i]);
      }
      const base64String = btoa(binaryString);

      // Write audio buffer to temporary file as base64
      await FileSystem.writeAsStringAsync(tempFileUri, base64String, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(
        `[AudioService] Successfully created temporary audio file: ${tempFileUri}`,
      );

      return tempFileUri;
    } catch (error) {
      throw new Error(`Failed to create temporary audio file: ${error}`);
    }
  }

  /**
   * Unload current audio and free resources
   */
  private async unloadAudio(): Promise<void> {
    if (this.sound) {
      await this.sound.unloadAsync();
      this.sound = null;
    }

    // Clean up temporary audio file
    await this.cleanupTempAudioFile();

    this.audioURI = null;
  }

  /**
   * Clean up temporary audio file immediately after audio resource release
   */
  private async cleanupTempAudioFile(): Promise<void> {
    if (!this.tempAudioFilePath) {
      return;
    }

    const filePath = this.tempAudioFilePath;
    this.tempAudioFilePath = null;

    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
        console.log(
          `[AudioService] Cleaned up temporary audio file: ${filePath}`,
        );
      }
    } catch (error) {
      console.warn(
        `[AudioService] Failed to cleanup temporary audio file: ${error}`,
      );
    }
  }

  /**
   * Initialize audio session for platform-specific configuration
   */
  private async initializeAudioSession(): Promise<void> {
    if (this.audioSessionInitialized) {
      return;
    }

    try {
      const platformConfig = this.config.platformConfig;

      if (platformConfig && Platform.OS === "ios") {
        await Audio.setAudioModeAsync({
          // iOS-specific parameters only
          staysActiveInBackground: platformConfig.ios.staysActiveInBackground,
          playsInSilentModeIOS: platformConfig.ios.playsInSilentModeIOS,
          interruptionModeIOS: platformConfig.ios.interruptionModeIOS,
        });
      } else if (platformConfig && Platform.OS === "android") {
        await Audio.setAudioModeAsync({
          // Android-specific parameters only
          staysActiveInBackground:
            platformConfig.android.staysActiveInBackground,
          shouldDuckAndroid: platformConfig.android.shouldDuckAndroid,
          playThroughEarpieceAndroid:
            platformConfig.android.playThroughEarpieceAndroid,
          interruptionModeAndroid:
            platformConfig.android.interruptionModeAndroid,
        });
      }

      this.audioSessionInitialized = true;
    } catch (error) {
      console.warn("Failed to initialize audio session:", error);
    }
  }

  /**
   * Create loading options for expo-av
   */
  private createLoadingOptions() {
    return {
      shouldPlay: false,
      volume: 1.0,
      isLooping: false,
      isMuted: false,
    };
  }

  /**
   * Handle playback status updates from expo-av
   */
  private handlePlaybackStatusUpdate(status: any): void {
    if (status.isLoaded) {
      if (status.didJustFinish) {
        this.setState(AudioPlaybackState.Completed);

        if (this.onDoneCallback) {
          this.onDoneCallback();
        }

        this.unloadAudio().then(() => {
          this.setState(AudioPlaybackState.Idle);
        });
      }

      // Enhanced interruption detection without timeouts
      if (this.userActionState === UserActionState.Idle) {
        if (this.isGenuineInterruption(status)) {
          console.log(
            `[AudioService] Genuine interruption detected via enhanced validation`,
          );
          this.setState(AudioPlaybackState.Paused);
        }
      }

      // Track position for validation
      if (status.positionMillis > this.lastValidPosition) {
        this.lastValidPosition = status.positionMillis;
      }
    }
  }

  /**
   * Set audio playback state
   */
  private setState(newState: AudioPlaybackState): void {
    this.state = newState;

    // Notify StateManager if callback is registered
    if (this.onPlaybackStateChangeCallback) {
      this.onPlaybackStateChangeCallback(newState, this.connectionId);
    }
  }

  /**
   * Enhanced interruption detection using audio status validation
   */
  private isGenuineInterruption(status: any): boolean {
    // Must not be playing
    if (status.isPlaying !== false) return false;

    // Must be in Playing state to detect interruption
    if (this.state !== AudioPlaybackState.Playing) return false;

    // Validate it's not a startup transient (position > minimum threshold)
    if (status.positionMillis && status.positionMillis < 100) return false;

    // Validate audio is loaded and has duration
    if (!status.isLoaded || !status.durationMillis) return false;

    // Validate it's not an intentional completion
    if (status.didJustFinish) return false;

    // Check for error conditions that would indicate real interruption
    if (status.error) return true;

    // Additional validation: check if position makes sense relative to duration
    if (status.positionMillis > status.durationMillis) return false;

    // Check if audio has progressed sufficiently to be considered "started"
    const minimumProgressMs = 50; // Must have played at least 50ms
    if ((status.positionMillis || 0) < minimumProgressMs) return false;

    return true; // All criteria met for genuine interruption
  }

  /**
   * Schedule debounced interruption detection
   */
  /**
   * Set callback handlers from speech options
   */
  private setCallbacks(options: SpeechOptions): void {
    this.onStartCallback = options.onStart || null;
    this.onDoneCallback = options.onDone || null;
    this.onStoppedCallback = options.onStopped || null;
    this.onPauseCallback = options.onPause || null;
    this.onResumeCallback = options.onResume || null;
    this.onErrorCallback = options.onError || null;
  }

  /**
   * Clear all callback handlers
   */
  private clearCallbacks(): void {
    this.onStartCallback = null;
    this.onDoneCallback = null;
    this.onStoppedCallback = null;
    this.onPauseCallback = null;
    this.onResumeCallback = null;
    this.onErrorCallback = null;
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(
    config?: Partial<SpeechAudioConfig>,
  ): SpeechAudioConfig {
    return {
      platformConfig: {
        ios: {
          // iOS-specific parameters
          staysActiveInBackground: false, // Note: not available in Expo Go for iOS
          playsInSilentModeIOS: true, // TTS should work even in silent mode
          interruptionModeIOS: 1, // DO_NOT_MIX (InterruptionModeIOS.DoNotMix)
        },
        android: {
          // Android-specific parameters
          staysActiveInBackground: false, // Don't need background audio for TTS
          shouldDuckAndroid: true, // TTS should lower other audio
          playThroughEarpieceAndroid: false, // Use speakers, not earpiece
          interruptionModeAndroid: 1, // DO_NOT_MIX (InterruptionModeAndroid.DoNotMix)
        },
      },
      loadingTimeout: EDGE_TTS_CONFIG.audioTimeout,
      autoInitializeAudioSession: true,
      ...config,
    };
  }

  /**
   * Handle audio errors
   */
  private handleError(error: SpeechError): void {
    this.setState(AudioPlaybackState.Error);

    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }

  // =============================================================================
  // Public Getters
  // =============================================================================

  /**
   * Get current playback state
   */
  get currentState(): AudioPlaybackState {
    return this.state;
  }

  /**
   * Get current connection ID
   */
  get currentConnectionId(): string | null {
    return this.connectionId;
  }

  /**
   * Check if audio is currently playing
   */
  get isPlaying(): boolean {
    return this.state === AudioPlaybackState.Playing;
  }

  /**
   * Check if audio is paused
   */
  get isPaused(): boolean {
    return this.state === AudioPlaybackState.Paused;
  }

  /**
   * Check if audio is stopped
   */
  get isStopped(): boolean {
    return this.state === AudioPlaybackState.Stopped;
  }
}

// =============================================================================
// Export Audio Service
// =============================================================================

export { AudioService as default };
