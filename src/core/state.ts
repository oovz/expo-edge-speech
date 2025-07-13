/**
 * Provides centralized state management using all services and complete type definitions.
 * Coordinates state between Network, Storage, Voice, and Audio services while maintaining
 * expo-speech API compatibility and implementing thread-safe state updates.
 */

import {
  SpeechOptions,
  SpeechConfiguration,
  ConnectionState,
  SpeechError,
} from "../types";
import { EDGE_TTS_CONFIG } from "../constants"; // Added import

import { AudioPlaybackState } from "../services/audioService";
import { generateConnectionId, generateSessionId } from "../utils/commonUtils";

import { StorageService } from "../services/storageService";
import { NetworkService } from "../services/networkService";
import { VoiceService } from "../services/voiceService";
import { AudioService } from "../services/audioService";

// =============================================================================
// State Management Types and Interfaces
// =============================================================================

/**
 * Application state enumeration
 */
export enum ApplicationState {
  Idle = "idle",
  Initializing = "initializing",
  Ready = "ready",
  Synthesizing = "synthesizing",
  Playing = "playing",
  Paused = "paused",
  Error = "error",
  Cleaning = "cleaning",
}

/**
 * Unified speech synthesis session interface
 * Consolidates the session definitions from synthesizer.ts and state.ts
 */
export interface SynthesisSession {
  /** Session ID */
  id: string;
  /** Connection ID used for this session */
  connectionId: string;
  /** Text being synthesized */
  text: string;
  /** Speech options for this session */
  options: SpeechOptions;
  /** Session state */
  state: ApplicationState;
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Error information if any */
  error?: SpeechError;
  /** Synthesized audio data (optional) */
  audioData?: Uint8Array;
  /** Audio URI for playback (optional) */
  audioUri?: string;
}

/**
 * State change event data
 */
interface StateChangeEvent {
  /** Event type */
  type: "application" | "connection" | "synthesis" | "audio" | "configuration";
  /** Previous state value */
  previousState: any;
  /** New state value */
  newState: any;
  /** Timestamp of the change */
  timestamp: Date;
  /** Optional context data */
  context?: any;
}

/**
 * State change listener callback
 */
export type StateChangeListener = (event: StateChangeEvent) => void;

// =============================================================================
// State Management Service
// =============================================================================

/**
 * Centralized state management service for expo-edge-speech
 * Coordinates state between all services and provides thread-safe state updates
 */
export class StateManager {
  // Service instances
  private storageService: StorageService;
  private networkService: NetworkService;
  private voiceService: VoiceService;
  private audioService: AudioService;

  // State tracking
  private applicationState: ApplicationState = ApplicationState.Idle;
  private configuration: SpeechConfiguration;
  private activeSessions: Map<string, SynthesisSession> = new Map();
  private stateChangeListeners: Set<StateChangeListener> = new Set();

  // Thread safety
  private stateUpdateQueue: (() => void)[] = [];
  private isProcessingStateUpdates: boolean = false;

  constructor(
    storageService: StorageService,
    networkService: NetworkService,
    voiceService: VoiceService,
    audioService: AudioService,
    initialConfiguration?: Partial<SpeechConfiguration>,
  ) {
    this.storageService = storageService;
    this.networkService = networkService;
    this.voiceService = voiceService;
    this.audioService = audioService;

    // Initialize default configuration
    this.configuration = this.createDefaultConfiguration(initialConfiguration);

    // Set up service integration
    this.initializeServiceIntegration();
  }

  // =============================================================================
  // Configuration Management
  // =============================================================================

  /**
   * Create default configuration using complete constants
   */
  private createDefaultConfiguration(
    overrides?: Partial<SpeechConfiguration>,
  ): SpeechConfiguration {
    const defaultConfig: SpeechConfiguration = {
      audioFormat: {
        format: "audio-24khz-48kbitrate-mono-mp3",
        sampleRate: 24000,
        bitRate: 48000,
        channels: 1,
      },
      connectionPooling: {
        maxConnections: EDGE_TTS_CONFIG.connectionPoolSize,
        connectionTimeout: EDGE_TTS_CONFIG.connectionTimeout,
        reuseConnections: false, // Assuming 'false' is the desired default, EDGE_TTS_CONFIG doesn't specify this
      },
      wordBoundary: {
        enabled: true,
        offsetCompensation: 8750000, // 8,750,000 ticks padding
      },
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): SpeechConfiguration {
    return { ...this.configuration };
  }

  /**
   * Update configuration with state change notification
   */
  public updateConfiguration(
    updates: Partial<SpeechConfiguration>,
  ): Promise<void> {
    return this.enqueueStateUpdate(() => {
      const previousConfig = { ...this.configuration };
      this.configuration = { ...this.configuration, ...updates };

      this.notifyStateChange({
        type: "configuration",
        previousState: previousConfig,
        newState: this.configuration,
        timestamp: new Date(),
        context: { updates },
      });
    });
  }

  // =============================================================================
  // Application State Management
  // =============================================================================

  /**
   * Get current application state
   */
  public getApplicationState(): ApplicationState {
    return this.applicationState;
  }

  /**
   * Update application state with notifications
   */
  private updateApplicationState(newState: ApplicationState): Promise<void> {
    return this.enqueueStateUpdate(() => {
      if (this.applicationState !== newState) {
        const previousState = this.applicationState;
        this.applicationState = newState;

        this.notifyStateChange({
          type: "application",
          previousState,
          newState,
          timestamp: new Date(),
        });
      }
    });
  }

  // =============================================================================
  // Speech Synthesis Session Management
  // =============================================================================

  /**
   * Create new synthesis session using service integration
   */
  public async createSynthesisSession(
    text: string,
    options: SpeechOptions,
  ): Promise<SynthesisSession> {
    const sessionId = generateSessionId();
    const connectionId = generateConnectionId();

    const session: SynthesisSession = {
      id: sessionId,
      connectionId,
      text,
      options,
      state: ApplicationState.Initializing,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    // Note: Connection buffer creation is handled by ConnectionManager
    // to avoid duplicate buffer creation issues

    await this.enqueueStateUpdate(() => {
      this.activeSessions.set(sessionId, session);
      this.notifyStateChange({
        type: "synthesis",
        previousState: null,
        newState: session,
        timestamp: new Date(),
        context: { action: "created" },
      });
    });

    return session;
  }

  /**
   * Update synthesis session state
   */
  public async updateSynthesisSession(
    sessionId: string,
    updates: Partial<SynthesisSession>,
  ): Promise<void> {
    await this.enqueueStateUpdate(() => {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        const previousSession = { ...session };
        const updatedSession = {
          ...session,
          ...updates,
          lastActivity: new Date(),
        };
        this.activeSessions.set(sessionId, updatedSession);

        this.notifyStateChange({
          type: "synthesis",
          previousState: previousSession,
          newState: updatedSession,
          timestamp: new Date(),
          context: { sessionId, updates },
        });
      }
    });
  }

  /**
   * Remove synthesis session and cleanup
   */
  public async removeSynthesisSession(sessionId: string): Promise<void> {
    await this.enqueueStateUpdate(() => {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        // Cleanup connection via storage service
        this.storageService.cleanupConnection(session.connectionId);

        this.activeSessions.delete(sessionId);
        this.notifyStateChange({
          type: "synthesis",
          previousState: session,
          newState: null,
          timestamp: new Date(),
          context: { action: "removed", sessionId },
        });
      }
    });
  }

  /**
   * Get active synthesis sessions
   */
  public getActiveSessions(): SynthesisSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get specific synthesis session
   */
  public getSynthesisSession(sessionId: string): SynthesisSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  // =============================================================================
  // Service Coordination
  // =============================================================================

  /**
   * Initialize service integration with state tracking
   */
  private initializeServiceIntegration(): void {
    // Storage service connection state tracking (if available)
    if (this.storageService.onConnectionStateChange) {
      this.storageService.onConnectionStateChange(
        (connectionId: string, state: ConnectionState) => {
          this.handleConnectionStateChange(connectionId, state);
        },
      );
    }

    // Network service connection tracking (if available)
    if (this.networkService.onConnectionStateChange) {
      this.networkService.onConnectionStateChange(
        (connectionId: string, state: ConnectionState) => {
          this.handleConnectionStateChange(connectionId, state);
        },
      );
    }

    // Audio service playback state tracking (if available)
    if (this.audioService.onPlaybackStateChange) {
      this.audioService.onPlaybackStateChange(
        (state: AudioPlaybackState, context?: any) => {
          this.handleAudioStateChange(state, context);
        },
      );
    }
  }

  /**
   * Handle connection state changes from services
   */
  private handleConnectionStateChange(
    connectionId: string,
    state: ConnectionState,
  ): void {
    this.enqueueStateUpdate(() => {
      // Find sessions using this connection
      const affectedSessions = Array.from(this.activeSessions.values()).filter(
        (session) => session.connectionId === connectionId,
      );

      affectedSessions.forEach((session) => {
        let newSessionState: ApplicationState;
        switch (state) {
          case ConnectionState.Connecting:
            newSessionState = ApplicationState.Initializing;
            break;
          case ConnectionState.Connected:
            newSessionState = ApplicationState.Ready;
            break;
          case ConnectionState.Synthesizing:
            newSessionState = ApplicationState.Synthesizing;
            break;
          case ConnectionState.Error:
            newSessionState = ApplicationState.Error;
            break;
          default:
            newSessionState = ApplicationState.Idle;
        }

        this.updateSynthesisSession(session.id, { state: newSessionState });
      });

      this.notifyStateChange({
        type: "connection",
        previousState: null,
        newState: state,
        timestamp: new Date(),
        context: { connectionId, affectedSessions: affectedSessions.length },
      });
    });
  }

  /**
   * Handle audio state changes from audio service
   */
  private handleAudioStateChange(
    state: AudioPlaybackState,
    context?: any,
  ): void {
    this.enqueueStateUpdate(() => {
      let newAppState: ApplicationState;
      switch (state) {
        case AudioPlaybackState.Playing:
          newAppState = ApplicationState.Playing;
          break;
        case AudioPlaybackState.Paused:
          newAppState = ApplicationState.Paused;
          break;
        case AudioPlaybackState.Error:
          newAppState = ApplicationState.Error;
          break;
        case AudioPlaybackState.Completed:
        case AudioPlaybackState.Stopped:
          newAppState = ApplicationState.Idle;
          break;
        default:
          newAppState = this.applicationState;
      }

      if (newAppState !== this.applicationState) {
        this.updateApplicationState(newAppState);
      }

      this.notifyStateChange({
        type: "audio",
        previousState: null,
        newState: state,
        timestamp: new Date(),
        context,
      });
    });
  }

  // =============================================================================
  // Thread-Safe State Updates
  // =============================================================================

  /**
   * Enqueue state update for thread-safe processing
   */
  private async enqueueStateUpdate(updateFn: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stateUpdateQueue.push(() => {
        try {
          updateFn();
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.processStateUpdateQueue();
    });
  }

  /**
   * Process queued state updates
   */
  private async processStateUpdateQueue(): Promise<void> {
    if (this.isProcessingStateUpdates || this.stateUpdateQueue.length === 0) {
      return;
    }

    this.isProcessingStateUpdates = true;

    try {
      while (this.stateUpdateQueue.length > 0) {
        const updateFn = this.stateUpdateQueue.shift();
        if (updateFn) {
          updateFn();
        }
      }
    } finally {
      this.isProcessingStateUpdates = false;
    }
  }

  // =============================================================================
  // Event Listeners and Notifications
  // =============================================================================

  /**
   * Add state change listener
   */
  public addStateChangeListener(listener: StateChangeListener): void {
    this.stateChangeListeners.add(listener);
  }

  /**
   * Remove state change listener
   */
  public removeStateChangeListener(listener: StateChangeListener): void {
    this.stateChangeListeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyStateChange(event: StateChangeEvent): void {
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in state change listener:", error);
      }
    });
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Get comprehensive state summary
   */
  public getStateSummary(): {
    application: ApplicationState;
    configuration: SpeechConfiguration;
    activeSessions: number;
    connections: number;
    memoryUsage: any;
  } {
    return {
      application: this.applicationState,
      configuration: this.getConfiguration(),
      activeSessions: this.activeSessions.size,
      connections: this.storageService.getActiveConnectionCount(),
      memoryUsage: this.storageService.getMemoryStats?.() || {},
    };
  }

  /**
   * Initialize state manager
   */
  public async initialize(): Promise<void> {
    await this.updateApplicationState(ApplicationState.Initializing);

    try {
      // Initialize all services
      await this.storageService.initialize?.();
      await this.voiceService.initialize?.();
      await this.audioService.initialize?.();

      await this.updateApplicationState(ApplicationState.Ready);
    } catch (error) {
      await this.updateApplicationState(ApplicationState.Error);
      throw error;
    }
  }

  /**
   * Cleanup state manager and all services
   */
  public async cleanup(): Promise<void> {
    await this.updateApplicationState(ApplicationState.Cleaning);

    try {
      // Cleanup all active sessions
      const sessionIds = Array.from(this.activeSessions.keys());
      await Promise.all(
        sessionIds.map((sessionId) => this.removeSynthesisSession(sessionId)),
      );

      // Cleanup services
      await this.storageService.cleanup?.();
      await this.networkService.cleanup?.();
      await this.audioService.cleanup?.();

      // Clear listeners
      this.stateChangeListeners.clear();

      await this.updateApplicationState(ApplicationState.Idle);
    } catch (error) {
      await this.updateApplicationState(ApplicationState.Error);
      throw error;
    }
  }
}
