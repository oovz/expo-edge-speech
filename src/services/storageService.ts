/**
 * Provides connection-scoped memory management for real-time audio streaming.
 * Handles automatic cleanup, memory tracking, and audio data coordination.
 */

import type { SpeechStorageConfig } from "../types";
import { AUDIO_STREAMING, CONNECTION_LIFECYCLE } from "../constants";

/**
 * Connection buffer interface for managing per-connection audio data
 */
interface ConnectionBuffer {
  /** Connection ID */
  connectionId: string;
  /** Buffered audio chunks */
  audioChunks: Uint8Array[];
  /** Total buffer size in bytes */
  totalSize: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Buffer state for coordination */
  state: "active" | "completed" | "cleaning";
}

/**
 * Memory usage statistics
 */
interface MemoryStats {
  /** Total memory used across all connections */
  totalMemoryUsed: number;
  /** Number of active connections */
  activeConnections: number;
  /** Largest buffer size */
  largestBuffer: number;
  /** Memory limit per connection */
  memoryLimitPerConnection: number;
  /** Global memory limit */
  globalMemoryLimit: number;
}

/**
 * Connection-scoped memory management service
 * Manages audio buffering for real-time streaming with automatic cleanup
 */
export class StorageService {
  private static instance: StorageService | null = null;

  /** Connection buffers mapped by connection ID */
  private connectionBuffers = new Map<string, ConnectionBuffer>();

  /** Cleanup interval timer */
  private cleanupTimer: NodeJS.Timeout | null = null;

  /** Service configuration */
  private config: Required<SpeechStorageConfig>;

  constructor(config?: Partial<SpeechStorageConfig>) {
    this.config = {
      maxBufferSize: 16 * 1024 * 1024, // 16MB max buffer size
      cleanupInterval: CONNECTION_LIFECYCLE.POOL_MANAGEMENT.CLEANUP_INTERVAL,
      warningThreshold: 0.8, // 80% of memory limit
      ...config,
    };

    this.startCleanupInterval();
  }

  /**
   * Get singleton instance of storage service
   */
  static getInstance(config?: Partial<SpeechStorageConfig>): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService(config);
    }
    return StorageService.instance;
  }

  /**
   * Create buffer for new connection
   * @param connectionId - The connection ID to create buffer for
   * @param allowExisting - If true, gracefully handle existing buffers instead of throwing error
   */
  createConnectionBuffer(
    connectionId: string,
    allowExisting: boolean = false,
  ): void {
    console.log(
      `[StorageService] Creating buffer for connectionId: ${connectionId}, allowExisting: ${allowExisting}`,
    );

    if (this.connectionBuffers.has(connectionId)) {
      if (allowExisting) {
        console.log(
          "[StorageService] Buffer already exists for connection, but allowExisting=true:",
          connectionId,
        );
        return; // Gracefully handle existing buffer
      } else {
        console.log(
          "[StorageService] Buffer already exists for connection:",
          connectionId,
        );
        throw new Error(
          `Buffer already exists for connection: ${connectionId}`,
        );
      }
    }

    const buffer: ConnectionBuffer = {
      connectionId,
      audioChunks: [],
      totalSize: 0,
      createdAt: new Date(),
      lastActivity: new Date(),
      state: "active",
    };

    this.connectionBuffers.set(connectionId, buffer);
    console.log(
      `[StorageService] Buffer created successfully for connectionId: ${connectionId}`,
    );
  }

  /**
   * Add audio chunk to connection buffer
   */
  addAudioChunk(connectionId: string, audioData: Uint8Array): boolean {
    console.log(
      `[StorageService] addAudioChunk called with connectionId: ${connectionId}`,
    );
    const buffer = this.connectionBuffers.get(connectionId);
    if (!buffer) {
      console.error(
        `[StorageService] No buffer found for connection: ${connectionId}`,
      );
      console.log(
        `[StorageService] Available buffers:`,
        Array.from(this.connectionBuffers.keys()),
      );
      throw new Error(`No buffer found for connection: ${connectionId}`);
    }

    if (buffer.state !== "active") {
      return false; // Buffer is being cleaned up or completed
    }

    // Check memory limits before adding
    const newSize = buffer.totalSize + audioData.length;
    if (newSize > this.config.maxBufferSize) {
      throw new Error(
        `Buffer size limit exceeded for connection ${connectionId}: ${newSize} > ${this.config.maxBufferSize}`,
      );
    }

    // Add chunk to buffer
    buffer.audioChunks.push(new Uint8Array(audioData));
    buffer.totalSize = newSize;
    buffer.lastActivity = new Date();

    // Check warning threshold
    if (newSize > this.config.maxBufferSize * this.config.warningThreshold) {
      console.warn(
        `Memory usage warning for connection ${connectionId}: ${newSize} bytes (${Math.round((newSize / this.config.maxBufferSize) * 100)}%)`,
      );
    }

    return true;
  }

  /**
   * Get merged audio data for connection
   */
  getMergedAudioData(connectionId: string): Uint8Array {
    console.log(
      `[StorageService] getMergedAudioData called with connectionId: ${connectionId}`,
    );
    console.log(
      `[StorageService] Available buffers:`,
      Array.from(this.connectionBuffers.keys()),
    );

    const buffer = this.connectionBuffers.get(connectionId);
    if (!buffer) {
      console.error(
        `[StorageService] No buffer found for connection: ${connectionId}`,
      );
      throw new Error(`No buffer found for connection: ${connectionId}`);
    }

    console.log(
      `[StorageService] Found buffer for connectionId: ${connectionId}, chunks: ${buffer.audioChunks.length}`,
    );
    return this.mergeAudioChunks(buffer.audioChunks);
  }

  /**
   * Mark connection buffer as completed (no more data expected)
   */
  markConnectionCompleted(connectionId: string): void {
    const buffer = this.connectionBuffers.get(connectionId);
    if (buffer) {
      buffer.state = "completed";
      buffer.lastActivity = new Date();
    }
  }

  /**
   * Clean up connection buffer and free memory
   */
  cleanupConnection(connectionId: string): boolean {
    const buffer = this.connectionBuffers.get(connectionId);
    if (!buffer) {
      return false;
    }

    // Mark as cleaning to prevent new additions
    buffer.state = "cleaning";

    // Clear audio chunks to free memory
    buffer.audioChunks.length = 0;
    buffer.totalSize = 0;

    // Remove from map
    this.connectionBuffers.delete(connectionId);

    return true;
  }

  /**
   * Get buffer info for connection
   */
  getConnectionBufferInfo(connectionId: string): {
    exists: boolean;
    size: number;
    chunkCount: number;
    state: string;
    lastActivity: Date | null;
  } {
    const buffer = this.connectionBuffers.get(connectionId);
    if (!buffer) {
      return {
        exists: false,
        size: 0,
        chunkCount: 0,
        state: "none",
        lastActivity: null,
      };
    }

    return {
      exists: true,
      size: buffer.totalSize,
      chunkCount: buffer.audioChunks.length,
      state: buffer.state,
      lastActivity: buffer.lastActivity,
    };
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): MemoryStats {
    let totalMemoryUsed = 0;
    let largestBuffer = 0;
    let activeConnections = 0;

    for (const buffer of this.connectionBuffers.values()) {
      totalMemoryUsed += buffer.totalSize;
      largestBuffer = Math.max(largestBuffer, buffer.totalSize);
      if (buffer.state === "active") {
        activeConnections++;
      }
    }

    return {
      totalMemoryUsed,
      activeConnections,
      largestBuffer,
      memoryLimitPerConnection: this.config.maxBufferSize,
      globalMemoryLimit: this.config.maxBufferSize * 10, // Support up to 10 concurrent connections
    };
  }

  /**
   * Merge multiple audio chunks into single Uint8Array
   */
  private mergeAudioChunks(chunks: Uint8Array[]): Uint8Array {
    if (chunks.length === 0) {
      return new Uint8Array(0);
    }

    if (chunks.length === 1) {
      return new Uint8Array(chunks[0]);
    }

    // Calculate total size
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

    // Create merged array
    const merged = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return merged;
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.performAutomaticCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Perform automatic cleanup of stale connections
   */
  private performAutomaticCleanup(): void {
    const now = new Date();
    const staleConnections: string[] = [];

    for (const [connectionId, buffer] of this.connectionBuffers) {
      const timeSinceActivity = now.getTime() - buffer.lastActivity.getTime();
      const isStale =
        timeSinceActivity > CONNECTION_LIFECYCLE.TIMEOUTS.GRACEFUL_CLOSE * 2;

      if (
        (buffer.state === "completed" || isStale) &&
        buffer.state !== "cleaning"
      ) {
        staleConnections.push(connectionId);
      }
    }

    // Clean up stale connections
    for (const connectionId of staleConnections) {
      this.cleanupConnection(connectionId);
    }

    if (staleConnections.length > 0) {
      console.debug(
        `Cleaned up ${staleConnections.length} stale connection buffers`,
      );
    }
  }

  /**
   * Validate audio data format and size
   */
  validateAudioData(audioData: Uint8Array): boolean {
    // Basic validation
    if (!audioData || audioData.length === 0) {
      return false;
    }

    // Check minimum chunk size
    if (audioData.length < AUDIO_STREAMING.CHUNK_PROCESSING.MIN_CHUNK_SIZE) {
      return false;
    }

    // Check maximum chunk size
    if (audioData.length > AUDIO_STREAMING.CHUNK_PROCESSING.MAX_CHUNK_SIZE) {
      return false;
    }

    return true;
  }

  /**
   * Estimate buffer size for streaming coordination
   */
  estimateBufferSize(
    connectionId: string,
    additionalBytes: number = 0,
  ): {
    currentSize: number;
    estimatedSize: number;
    remainingCapacity: number;
    utilizationPercent: number;
  } {
    const buffer = this.connectionBuffers.get(connectionId);
    const currentSize = buffer ? buffer.totalSize : 0;
    const estimatedSize = currentSize + additionalBytes;
    const maxBufferSize = this.config.maxBufferSize;
    const remainingCapacity = maxBufferSize - estimatedSize;
    const utilizationPercent = (estimatedSize / maxBufferSize) * 100;

    return {
      currentSize,
      estimatedSize,
      remainingCapacity,
      utilizationPercent,
    };
  }

  /**
   * Check if connection can accept more data
   */
  canAcceptMoreData(
    connectionId: string,
    additionalBytes: number = 0,
  ): boolean {
    const buffer = this.connectionBuffers.get(connectionId);
    if (!buffer || buffer.state !== "active") {
      return false;
    }

    const estimatedSize = buffer.totalSize + additionalBytes;
    const maxBufferSize = this.config.maxBufferSize;
    return estimatedSize <= maxBufferSize;
  }

  /**
   * Cleanup service and free all resources
   */
  destroy(): void {
    // Stop cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clean up all connection buffers
    for (const connectionId of this.connectionBuffers.keys()) {
      this.cleanupConnection(connectionId);
    }

    // Clear singleton instance
    StorageService.instance = null;
  }

  // =============================================================================
  // StateManager Integration Methods
  // =============================================================================

  /**
   * Initialize storage service (required by StateManager)
   */
  async initialize(): Promise<void> {
    // Storage service is ready to use after construction
    // Cleanup timer is already started in constructor
  }

  /**
   * Cleanup storage service and free resources (required by StateManager)
   */
  async cleanup(): Promise<void> {
    this.destroy();
  }

  /**
   * Register callback for connection state changes (required by StateManager)
   */
  onConnectionStateChange(
    callback: (connectionId: string, state: any) => void,
  ): void {
    // Storage service doesn't manage connection states directly,
    // but this method is required for StateManager compatibility
    // Connection state changes are handled by NetworkService
  }

  /**
   * Get active connection count (for StateManager)
   */
  getActiveConnectionCount(): number {
    return this.connectionBuffers.size;
  }

  // =============================================================================
  // Public Methods - Connection Buffer Management
  // =============================================================================
}

// Export singleton instance getter for convenience
export const getStorageService = (config?: Partial<SpeechStorageConfig>) =>
  StorageService.getInstance(config);
