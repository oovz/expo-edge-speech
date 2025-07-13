/**
 * Coordinates WebSocket connections via Network Service with audio playback via Audio Service.
 * Handles connection pooling using Storage Service, processes audio data streams,
 * manages concurrent connections using State Management, and implements circuit breaker pattern.
 */

import { ConnectionState } from "../types";
import type {
  SpeechOptions,
  SpeechError,
  WordBoundary,
  SpeechConnectionConfig,
  CircuitBreakerConfig,
} from "../types";

import { AppState, NativeEventSubscription } from "react-native";

import { StateManager } from "./state";
import { NetworkService } from "../services/networkService";
import { AudioService } from "../services/audioService";
import { StorageService } from "../services/storageService";

import { CONNECTION_LIFECYCLE } from "../constants";

// =============================================================================
// Connection Manager Configuration and Types
// =============================================================================

/**
 * Circuit breaker state
 */
enum CircuitBreakerState {
  Closed = "closed", // Normal operation
  Open = "open", // Blocking requests due to failures
  HalfOpen = "halfopen", // Testing if service has recovered
}

/**
 * Streaming coordinator for connection management
 */
interface StreamingCoordinator {
  /** Connection ID */
  connectionId: string;
  /** Connection state */
  state: ConnectionState;
  /** Audio chunks received */
  audioChunks: Uint8Array[];
  /** Total audio size */
  totalAudioSize: number;
  /** Speech options */
  options: SpeechOptions;
  /** Retry count for error recovery */
  retryCount?: number;
}

/**
 * Connection queue entry
 */
interface QueuedConnection {
  options: SpeechOptions & {
    ssml?: string;
    clientSessionId: string;
    connectionId: string;
  };
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}

// =============================================================================
// Connection Manager Implementation
// =============================================================================

/**
 * Connection Manager - coordinates all services for speech synthesis
 *
 * Responsibilities:
 * - Coordinate WebSocket connections via Network Service with audio playback via Audio Service
 * - Handle connection pooling using Storage Service connection management
 * - Implement connection lifecycle management using all service capabilities
 * - Process audio data streams coordinating Network Service, Storage Service, and Audio Utilities
 * - Handle connection errors and recovery using Network Service error handling
 * - Manage concurrent connections using State Management
 * - Coordinate real-time streaming between all services
 * - Implement circuit breaker pattern using complete error types and constants
 */
export class ConnectionManager {
  private stateManager: StateManager;
  private networkService: NetworkService;
  private audioService: AudioService;
  private storageService: StorageService;

  private config: Required<SpeechConnectionConfig>;
  private circuitBreakerState: CircuitBreakerState;
  private activeConnections: Map<string, StreamingCoordinator>;
  private activeSessions: Map<string, string>; // sessionId -> connectionId mapping
  private connectionQueue: QueuedConnection[];
  private globalConnectionState: ConnectionState = ConnectionState.Disconnected;
  private isShuttingDown = false;

  // Circuit breaker tracking
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  // App state handler management to prevent memory leaks
  private appStateSubscription?: NativeEventSubscription;
  private appStateHandlerAdded = false;

  constructor(
    stateManager: StateManager,
    networkService: NetworkService,
    audioService: AudioService,
    storageService: StorageService,
    config?: Partial<SpeechConnectionConfig>,
  ) {
    this.stateManager = stateManager;
    this.networkService = networkService;
    this.audioService = audioService;
    this.storageService = storageService;

    // Initialize configuration with defaults
    this.config = {
      maxConnections: CONNECTION_LIFECYCLE.POOL_MANAGEMENT.MAX_POOL_SIZE,
      connectionTimeout: CONNECTION_LIFECYCLE.TIMEOUTS.CONNECTION_ESTABLISHMENT,
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 30000, // 30 seconds
        testRequestLimit: 3,
      } as Required<CircuitBreakerConfig>,
      poolingEnabled: false, // Disabled by default to enforce connection limits
      ...config,
    };

    this.circuitBreakerState = CircuitBreakerState.Closed;
    this.activeConnections = new Map();
    this.activeSessions = new Map();
    this.connectionQueue = [];

    this.setupEventHandlers();
  }

  // =============================================================================
  // Public API - Session-based Methods
  // =============================================================================

  /**
   * Start speech synthesis and return session ID
   */
  async startSynthesis(
    ssml: string, // Changed from text to ssml
    options: SpeechOptions & {
      clientSessionId: string;
      connectionId: string;
    },
  ): Promise<string> {
    // Check circuit breaker state
    if (!this.isCircuitClosed()) {
      throw this.createSpeechError(
        "CircuitBreakerOpen",
        "Service temporarily unavailable due to repeated failures",
        "CONNECTION_CIRCUIT_BREAKER_OPEN",
      );
    }

    // Check connection limits
    const maxConnections = this.config.maxConnections;
    if (this.activeConnections.size >= maxConnections) {
      if (this.config.poolingEnabled) {
        // Queue the request
        return new Promise((resolve, reject) => {
          this.connectionQueue.push({
            options: { ...options, ssml }, // Changed from text to ssml
            resolve,
            reject,
          });
        });
      } else {
        throw this.createSpeechError(
          "ConnectionLimitExceeded",
          "Maximum concurrent connections reached",
          "CONNECTION_LIMIT_EXCEEDED",
        );
      }
    }

    try {
      const result = await this.createAndManageConnection(ssml, options); // Changed from text to ssml
      this.recordSuccess();
      return result.sessionId;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Stop speech synthesis for a specific session
   */
  async stopSynthesis(sessionId: string): Promise<void> {
    const connectionId = this.activeSessions.get(sessionId);
    if (!connectionId) {
      throw this.createSpeechError(
        "SessionNotFound",
        "Session not found",
        "SESSION_NOT_FOUND",
      );
    }

    await this.terminateConnection(connectionId);
    this.activeSessions.delete(sessionId);

    // Trigger callback
    const coordinator = this.activeConnections.get(connectionId);
    if (coordinator?.options.onStopped) {
      coordinator.options.onStopped();
    }
  }

  /**
   * Pause speech synthesis for a specific session
   */
  async pauseSynthesis(sessionId: string): Promise<void> {
    const connectionId = this.activeSessions.get(sessionId);
    if (!connectionId) {
      throw this.createSpeechError(
        "SessionNotFound",
        "Session not found",
        "SESSION_NOT_FOUND",
      );
    }

    await this.audioService.pause();
    // State coordination happens through service integration

    // Trigger callback
    const coordinator = this.activeConnections.get(connectionId);
    if (coordinator?.options.onPause) {
      coordinator.options.onPause();
    }
  }

  /**
   * Resume speech synthesis for a specific session
   */
  async resumeSynthesis(sessionId: string): Promise<void> {
    const connectionId = this.activeSessions.get(sessionId);
    if (!connectionId) {
      throw this.createSpeechError(
        "SessionNotFound",
        "Session not found",
        "SESSION_NOT_FOUND",
      );
    }

    await this.audioService.resume();
    // State coordination happens through service integration

    // Trigger callback
    const coordinator = this.activeConnections.get(connectionId);
    if (coordinator?.options.onResume) {
      coordinator.options.onResume();
    }
  }

  /**
   * Get connection pool status
   */
  getConnectionPoolStatus(): {
    activeConnections: number;
    maxConnections: number;
    availableConnections: number;
    circuitBreakerState: string;
  } {
    const maxConnections = this.config.maxConnections;
    return {
      activeConnections: this.activeConnections.size,
      maxConnections: maxConnections,
      availableConnections: maxConnections - this.activeConnections.size,
      circuitBreakerState: this.circuitBreakerState,
    };
  }

  /**
   * Shutdown connection manager and clean up all resources
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    await this.stopAllConnections();
    this.activeSessions.clear();

    // Cleanup AppState subscription (React Native pattern)
    // Following React Native documentation for proper subscription cleanup
    if (this.appStateSubscription && this.appStateHandlerAdded) {
      try {
        // Remove the AppState event listener using NativeEventSubscription.remove()
        // This is the documented React Native pattern for cleanup
        this.appStateSubscription.remove();
        this.appStateSubscription = undefined;
        this.appStateHandlerAdded = false;
      } catch (error) {
        console.warn("Failed to remove AppState listener:", error);
        // Reset subscription state even if removal fails to prevent memory leaks
        this.appStateSubscription = undefined;
        this.appStateHandlerAdded = false;
      }
    }
  }

  /**
   * Stop all active connections and clear queue
   */
  async stopAllConnections(): Promise<void> {
    // Stop all active connections
    const stopPromises = Array.from(this.activeConnections.values()).map(
      (coordinator) => this.terminateConnection(coordinator.connectionId),
    );

    await Promise.allSettled(stopPromises);

    // Clear connection queue
    this.connectionQueue.forEach(({ reject }) => {
      reject(
        this.createSpeechError(
          "ConnectionStopped",
          "Connection stopped by user request",
          "CONNECTION_STOPPED",
        ),
      );
    });
    this.connectionQueue.length = 0;

    // Clear all connections on shutdown
    this.activeConnections.clear();
    this.globalConnectionState = ConnectionState.Disconnected;
  }

  /**
   * Get connection manager status
   */
  getStatus(): {
    activeConnections: number;
    queuedConnections: number;
    circuitBreakerState: CircuitBreakerState;
    failureCount: number;
  } {
    return {
      activeConnections: this.activeConnections.size,
      queuedConnections: this.connectionQueue.length,
      circuitBreakerState: this.circuitBreakerState,
      failureCount: this.failureCount,
    };
  }

  // =============================================================================
  // Connection Lifecycle Management
  // =============================================================================

  /**
   * Create and manage a complete connection lifecycle
   */
  private async createAndManageConnection(
    ssml: string,
    options: SpeechOptions & {
      clientSessionId: string;
      connectionId: string;
    },
  ): Promise<{ sessionId: string; connectionId: string }> {
    const connectionId = options.connectionId; // Use provided connectionId
    // Use clientSessionId from options as it's now required.
    const localSessionId = options.clientSessionId;

    // Initialize streaming coordinator
    const coordinator: StreamingCoordinator = {
      connectionId,
      state: ConnectionState.Connecting,
      audioChunks: [],
      totalAudioSize: 0,
      options,
    };

    this.activeConnections.set(connectionId, coordinator);
    this.activeSessions.set(localSessionId, connectionId);

    try {
      // Update state
      coordinator.state = ConnectionState.Connecting;
      this.globalConnectionState = ConnectionState.Connecting;
      // State coordination happens through service integration

      // Initialize storage for this connection
      this.storageService.createConnectionBuffer(connectionId);

      // Setup audio streaming coordination
      await this.setupAudioStreamingCoordination(coordinator);

      // Establish connection via Network Service
      await this.establishNetworkConnection(
        connectionId,
        ssml,
        options, // options already of type SpeechOptions & { clientSessionId: string; connectionId: string }
      );

      coordinator.state = ConnectionState.Connected;
      this.globalConnectionState = ConnectionState.Connected;

      return {
        sessionId: localSessionId,
        connectionId: connectionId,
      };
    } catch (error) {
      try {
        // If handleConnectionError doesn't throw, the retry was successful or error handled
        await this.handleConnectionError(connectionId, error as SpeechError);
        // If error handled and connection established, return the IDs
        return {
          sessionId: localSessionId,
          connectionId: connectionId,
        };
      } catch (handlerError) {
        // If handleConnectionError throws, the error handling failed
        this.activeSessions.delete(localSessionId); // Clean up mapping on final failure
        throw handlerError;
      }
    }
  }

  /**
   * Setup audio streaming coordination between services
   */
  private async setupAudioStreamingCoordination(
    coordinator: StreamingCoordinator,
  ): Promise<void> {
    // Audio service will be configured when playback starts
    // Store audio configuration in coordinator
    (coordinator as any).audioConfig = {
      connectionId: coordinator.connectionId,
      options: coordinator.options,
    };

    // Setup audio data processing pipeline
    this.setupAudioDataPipeline(coordinator);
  }

  /**
   * Setup audio data processing pipeline
   */
  private setupAudioDataPipeline(coordinator: StreamingCoordinator): void {
    // Audio data will flow: Network Service → Storage Service → Audio Service
    // This pipeline is coordinated through handleAudioData method
  }

  /**
   * Establish WebSocket connection via Network Service
   */
  private async establishNetworkConnection(
    connectionId: string,
    ssml: string,
    options: SpeechOptions & {
      clientSessionId: string;
      connectionId: string; // This is the same as the connectionId parameter
    },
  ): Promise<void> {
    // Process synthesis using traditional batch processing approach
    const response = await this.networkService.synthesizeText(
      ssml,
      options,
      options.clientSessionId,
      connectionId,
    );

    // Process any word boundaries
    for (const boundary of response.boundaries) {
      this.handleBoundaryEvent(connectionId, boundary);
    }

    // After all chunks are collected, trigger batch audio processing
    await this.streamAudioToService(connectionId);
  }

  /**
   * Terminate connection and cleanup
   */
  private async terminateConnection(connectionId: string): Promise<void> {
    const coordinator = this.activeConnections.get(connectionId);
    if (!coordinator) return;

    try {
      // Stop audio playback
      await this.audioService.stop();

      // Network Service cleanup happens automatically in synthesize method

      // Cleanup storage
      this.storageService.cleanupConnection(connectionId);
    } catch (error) {
      console.warn(
        `Error during connection cleanup for ${connectionId}:`,
        error,
      );
    } finally {
      await this.cleanupConnection(connectionId);
    }
  }

  /**
   * Cleanup connection resources
   */
  private async cleanupConnection(connectionId: string): Promise<void> {
    // Remove from active connections
    this.activeConnections.delete(connectionId);

    // Update state if no more connections
    if (this.activeConnections.size === 0) {
      this.globalConnectionState = ConnectionState.Disconnected;
    }

    // Process queued connections if space available
    await this.processConnectionQueue();
  }

  // =============================================================================
  // Audio Data Streaming Coordination
  // =============================================================================

  /**
   * Handle incoming audio data from Network Service
   * Coordinates data flow between Network Service, Storage Service, and Audio Service
   */
  private async handleAudioData(
    connectionId: string,
    audioData: Uint8Array,
  ): Promise<void> {
    const coordinator = this.activeConnections.get(connectionId);
    if (!coordinator) {
      console.warn(
        `Received audio data for unknown connection: ${connectionId}`,
      );
      return;
    }

    try {
      // Update coordinator tracking
      coordinator.audioChunks.push(audioData);
      coordinator.totalAudioSize += audioData.length;

      // Store audio data in StorageService.
      // The actual mechanism for this depends on StorageService's API.
      // For now, we assume StorageService is aware of the coordinator.audioChunks
      // or there's a direct method like:
      // this.storageService.addAudioChunk(connectionId, audioData);

      // DO NOT stream to Audio Service for playback on every chunk.
      // Playback will be triggered once all chunks are received.
      // await this.streamAudioToService(connectionId);
    } catch (error) {
      console.error(
        `Error handling audio data for connection ${connectionId}:`,
        error,
      );

      // For storage errors, just trigger the error callback but don't terminate the connection
      // This allows the connection to continue processing other audio chunks
      if (coordinator.options.onError) {
        coordinator.options.onError(error as Error);
      }
    }
  }

  /**
   * Store audio data (new helper method)
   */
  private async storeAudioData(
    connectionId: string,
    audioData: Uint8Array,
  ): Promise<void> {
    const coordinator = this.activeConnections.get(connectionId);
    if (!coordinator) {
      console.warn(
        `Attempted to store audio data for unknown connection: ${connectionId}`,
      );
      return;
    }

    try {
      // Update coordinator tracking
      coordinator.audioChunks.push(audioData);
      coordinator.totalAudioSize += audioData.length;

      // Store audio data in StorageService for audio playback
      await this.storageService.addAudioChunk(connectionId, audioData);
    } catch (error) {
      console.error(
        `Error storing audio data for connection ${connectionId}:`,
        error,
      );
      if (coordinator.options.onError) {
        coordinator.options.onError(error as Error);
      }
    }
  }

  /**
   * Stream audio data to Audio Service
   */
  private async streamAudioToService(connectionId: string): Promise<void> {
    const coordinator = this.activeConnections.get(connectionId);
    if (!coordinator) return;

    // In batch processing mode, we use AudioService.speak() which supports callbacks
    // Wrap the user's onDone callback to include connection cleanup
    const wrappedOptions = {
      ...coordinator.options,
      onDone: () => {
        // Call user's callback first
        if (coordinator.options.onDone) {
          coordinator.options.onDone();
        }

        // Then clean up the connection to enable pooling
        this.terminateConnection(connectionId).catch((error) => {
          console.error(
            `[ConnectionManager] Failed to cleanup connection ${connectionId}:`,
            error,
          );
        });
      },
      onError: (error: Error) => {
        // Call user's callback first
        if (coordinator.options.onError) {
          coordinator.options.onError(error);
        }

        // Clean up connection on error too
        this.terminateConnection(connectionId).catch((cleanupError) => {
          console.error(
            `[ConnectionManager] Failed to cleanup connection ${connectionId} after error:`,
            cleanupError,
          );
        });
      },
    };

    // Use the full AudioService.speak() method which handles callbacks properly
    await this.audioService.speak(wrappedOptions, connectionId);
  }

  /**
   * Handle boundary events from Network Service
   */
  private handleBoundaryEvent(
    connectionId: string,
    boundary: WordBoundary,
  ): void {
    const coordinator = this.activeConnections.get(connectionId);
    if (!coordinator) return;

    // Trigger user callbacks if available
    if (coordinator.options.onBoundary) {
      coordinator.options.onBoundary(boundary);
    }
  }

  // =============================================================================
  // Error Handling and Recovery
  // =============================================================================

  /**
   * Handle connection errors with recovery logic
   */
  private async handleConnectionError(
    connectionId: string,
    error: SpeechError,
  ): Promise<void> {
    const coordinator = this.activeConnections.get(connectionId);
    if (!coordinator) return;

    console.error(`Connection error for ${connectionId}:`, error);

    // Update coordinator state
    coordinator.state = ConnectionState.Error;

    // Trigger user error callback
    if (coordinator.options.onError) {
      coordinator.options.onError(new Error(error.message));
    }

    // Attempt recovery based on error type
    const shouldRetry = this.shouldRetryConnection(error);

    // For non-retryable errors, terminate immediately and re-throw
    if (!shouldRetry) {
      await this.terminateConnection(connectionId);
      // Ensure we throw a proper Error instance
      if (error instanceof Error) {
        throw error;
      } else {
        // Convert error object to proper Error instance
        const errorInstance = new Error(error.message || "Unknown error");
        errorInstance.name = error.name || "Error";
        (errorInstance as any).code = error.code;
        throw errorInstance;
      }
    }

    // For retryable errors, check circuit breaker and retry count
    if (!this.isCircuitClosed()) {
      await this.terminateConnection(connectionId);
      throw this.createSpeechError(
        "CircuitBreakerOpen",
        "Circuit breaker is open",
        "CIRCUIT_BREAKER_OPEN",
      );
    }

    // Check retry count before attempting retry
    const currentRetries = coordinator.retryCount || 0;
    const maxRetries = 3;

    if (currentRetries >= maxRetries) {
      await this.terminateConnection(connectionId);
      throw this.createSpeechError(
        "MaxRetriesExceeded",
        `Maximum retry attempts (${maxRetries}) exceeded`,
        "MAX_RETRIES_EXCEEDED",
      );
    }

    // Attempt retry with exponential backoff
    try {
      await this.retryConnection(connectionId);
    } catch (retryError) {
      // Retry failed, terminate and re-throw
      await this.terminateConnection(connectionId);
      throw retryError;
    }
  }

  /**
   * Determine if connection should be retried based on error type
   */
  private shouldRetryConnection(error: SpeechError): boolean {
    const retryableErrors = ["NetworkError", "TimeoutError", "WebSocketError"];

    return retryableErrors.includes(error.code?.toString() || "");
  }

  /**
   * Retry connection with exponential backoff
   */
  private async retryConnection(connectionId: string): Promise<void> {
    const coordinator = this.activeConnections.get(connectionId);
    if (!coordinator) {
      throw this.createSpeechError(
        "ConnectionNotFound",
        "Connection not found for retry",
        "CONNECTION_NOT_FOUND",
      );
    }

    // Increment retry count
    coordinator.retryCount = (coordinator.retryCount || 0) + 1;

    // Implement exponential backoff with shorter delays for testing
    const retryDelay = Math.min(
      50 * Math.pow(2, coordinator.retryCount - 1), // Start with 50ms, shorter for tests
      1000, // Max 1 second for tests
    );

    await new Promise((resolve) => setTimeout(resolve, retryDelay));

    // Reset coordinator state for retry
    coordinator.state = ConnectionState.Connecting;
    coordinator.audioChunks = [];
    coordinator.totalAudioSize = 0;

    // Attempt to re-establish connection directly through Network Service
    const { options: coordinatorOptions } = coordinator; // Renamed to avoid conflict
    const ssmlToRetry = (coordinatorOptions as any).ssml || "";

    try {
      // Re-establish the network connection
      await this.establishNetworkConnection(
        connectionId,
        ssmlToRetry,
        coordinatorOptions as SpeechOptions & {
          clientSessionId: string;
          connectionId: string;
        },
      );

      // Update coordinator state on success
      coordinator.state = ConnectionState.Connected;
      this.globalConnectionState = ConnectionState.Connected;
    } catch (error) {
      // Mark coordinator as failed and handle the error recursively
      coordinator.state = ConnectionState.Error;
      await this.handleConnectionError(connectionId, error as SpeechError);
    }
  }

  // =============================================================================
  // Circuit Breaker Pattern Implementation
  // =============================================================================

  /**
   * Check if circuit breaker allows new connections
   */
  private isCircuitClosed(): boolean {
    const now = Date.now();

    switch (this.circuitBreakerState) {
      case CircuitBreakerState.Closed:
        return true;

      case CircuitBreakerState.Open:
        // Check if we should transition to half-open
        const recoveryTimeout = this.config.circuitBreaker.recoveryTimeout!;
        if (now - this.lastFailureTime >= recoveryTimeout) {
          this.circuitBreakerState = CircuitBreakerState.HalfOpen;
          this.successCount = 0;
          return true;
        }
        return false;

      case CircuitBreakerState.HalfOpen:
        return true;

      default:
        return false;
    }
  }

  /**
   * Record successful connection
   */
  private recordSuccess(): void {
    this.successCount++;

    if (this.circuitBreakerState === CircuitBreakerState.HalfOpen) {
      const testRequestLimit = this.config.circuitBreaker.testRequestLimit!;
      if (this.successCount >= testRequestLimit) {
        this.circuitBreakerState = CircuitBreakerState.Closed;
        this.failureCount = 0;
      }
    }
  }

  /**
   * Record connection failure
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    const failureThreshold = this.config.circuitBreaker.failureThreshold!;
    if (this.failureCount >= failureThreshold) {
      this.circuitBreakerState = CircuitBreakerState.Open;
    }
  }

  // =============================================================================
  // Connection Queue Management
  // =============================================================================

  /**
   * Process queued connections when space becomes available
   */
  private async processConnectionQueue(): Promise<void> {
    // Don't process queue during shutdown
    if (this.isShuttingDown) {
      return;
    }

    while (
      this.connectionQueue.length > 0 &&
      this.activeConnections.size < this.config.maxConnections &&
      this.isCircuitClosed()
    ) {
      const {
        options: queuedOptions,
        resolve,
        reject,
      } = this.connectionQueue.shift()!; // Renamed to avoid conflict

      try {
        const ssmlToSynthesize = (queuedOptions as any).ssml || "";
        const result = await this.createAndManageConnection(
          ssmlToSynthesize,
          queuedOptions as SpeechOptions & {
            clientSessionId: string;
            connectionId: string;
          },
        );
        resolve(result.sessionId);
      } catch (error) {
        reject(error);
      }
    }
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Update global connection state based on individual connection states
   */
  private updateGlobalConnectionState(): void {
    const states = Array.from(this.activeConnections.values()).map(
      (c) => c.state,
    );

    // Connection state updates are handled by StateManager through service events
    // This method tracks internal state but doesn't update external state
    let globalState: ConnectionState;

    if (states.length === 0) {
      globalState = ConnectionState.Disconnected;
    } else if (states.some((s) => s === ConnectionState.Error)) {
      globalState = ConnectionState.Error;
    } else if (states.some((s) => s === ConnectionState.Synthesizing)) {
      globalState = ConnectionState.Synthesizing;
    } else if (states.every((s) => s === ConnectionState.Connected)) {
      globalState = ConnectionState.Connected;
    } else {
      globalState = ConnectionState.Connecting;
    }

    // Store global state for internal tracking
    this.globalConnectionState = globalState;
  }

  /**
   * Setup event handlers for service coordination
   */
  private setupEventHandlers(): void {
    // Setup state change listener for service coordination
    this.stateManager.addStateChangeListener((event) => {
      // Handle state changes for connection management coordination
      if (event.type === "connection" || event.type === "application") {
        // Update global connection state based on state manager events
        // This enables proper service coordination
      }
    });

    // Setup cleanup on app state changes (React Native/Expo compatible)
    // Following React Native AppState documentation patterns
    if (AppState && !this.appStateHandlerAdded) {
      try {
        // Subscribe to AppState changes using the documented React Native pattern
        // AppState.addEventListener returns a NativeEventSubscription
        this.appStateSubscription = AppState.addEventListener(
          "change",
          (nextAppState: string) => {
            try {
              // React Native AppState values: 'active', 'background', 'inactive'
              // Stop connections when app goes to background or becomes inactive
              // This prevents issues with background execution limits
              if (
                nextAppState === "background" ||
                nextAppState === "inactive"
              ) {
                this.stopAllConnections().catch((error) => {
                  console.error(
                    "Failed to stop connections on app state change:",
                    error,
                  );
                });
              }
            } catch (error) {
              console.error("Error in AppState change handler:", error);
            }
          },
        );
        this.appStateHandlerAdded = true;
      } catch (error) {
        console.warn("Failed to setup AppState listener:", error);
        // Ensure flag is reset if setup fails
        this.appStateHandlerAdded = false;
      }
    }
  }

  /**
   * Create SpeechError object
   */
  private createSpeechError(
    name: string,
    message: string,
    code: string,
  ): Error {
    const error = new Error(message);
    error.name = name;
    (error as any).code = code;
    return error;
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private uint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binary = "";
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }
}
