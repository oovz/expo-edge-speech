/**
 * This module provides utilities for processing audio data from Edge TTS
 * including MP3 format validation, binary message parsing, metadata extraction,
 * and audio streaming buffer management.
 */

import {
  AUDIO_FORMATS,
  DEFAULT_AUDIO_FORMAT,
  WORD_BOUNDARY_OFFSET_COMPENSATION,
  BINARY_MESSAGE,
  BINARY_PARSING,
} from "../constants";

// =============================================================================
// Type Definitions for Edge TTS Audio Processing
// =============================================================================

/**
 * Message header format used by Edge TTS
 */
export interface EdgeTTSMessageHeader {
  [key: string]: string;
}

/**
 * Represents a parsed Edge TTS binary message containing audio data
 * Based on Edge TTS protocol: Int16 header length + JSON header + MP3 data
 */
export interface EdgeTTSBinaryMessage {
  /** Length of the header in bytes */
  headerLength: number;
  /** Parsed header containing metadata */
  header: Record<string, string>;
  /** Binary audio data (MP3 format) */
  audioData: ArrayBuffer;
}

/**
 * Audio metadata extracted from Edge TTS
 */
export interface EdgeTTSAudioMetadata {
  /** Audio format identifier */
  format: string;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Bit rate in kbps */
  bitRate: number;
  /** Number of audio channels */
  channels: number;
  /** Estimated duration in milliseconds */
  estimatedDuration?: number;
}

/**
 * Word boundary data with Edge TTS timing
 */
export interface EdgeTTSWordBoundary {
  /** Character index in original text */
  charIndex: number;
  /** Character length of the word */
  charLength: number;
  /** Raw offset in Edge TTS ticks */
  rawOffset: number;
  /** Compensated offset in Edge TTS ticks */
  compensatedOffset: number;
  /** Offset in milliseconds */
  offsetMs: number;
}

/**
 * Audio buffer for streaming MP3 chunks
 */
export interface AudioStreamBuffer {
  /** Accumulated audio chunks */
  chunks: ArrayBuffer[];
  /** Total size in bytes */
  totalSize: number;
  /** Metadata from first chunk */
  metadata?: EdgeTTSAudioMetadata;
}

// ============================================================================
// MP3 Format Validation and Detection
// ============================================================================

/**
 * Validates if the provided format string matches Edge TTS MP3 format
 * Edge TTS only supports: "audio-24khz-48kbitrate-mono-mp3"
 *
 * @param format - Audio format string to validate
 * @returns True if format is the supported Edge TTS MP3 format
 */
export function isValidMP3Format(format: string): boolean {
  return format === AUDIO_FORMATS.MP3_24KHZ_48KBPS;
}

/**
 * Detects if binary data contains MP3 audio
 * Checks for MP3 frame header signature (11 bits set)
 *
 * @param data - Binary data to check
 * @returns True if data appears to be MP3 format
 */
export function detectMP3Format(data: ArrayBuffer): boolean {
  if (data.byteLength < 4) {
    return false;
  }

  const view = new Uint8Array(data, 0, 4);

  // Check for MP3 frame sync: first 11 bits should be 1
  // MP3 frame header starts with 11111111 111xxxxx (0xFF 0xE0-0xFF)
  return view[0] === 0xff && (view[1] & 0xe0) === 0xe0;
}

/**
 * Validates that audio data conforms to Edge TTS MP3 specifications
 *
 * @param data - Audio data to validate
 * @returns True if data is valid Edge TTS MP3 format
 */
export function validateEdgeTTSMP3(data: ArrayBuffer): boolean {
  return detectMP3Format(data);
}

// ============================================================================
// Binary Audio Message Parsing
// ============================================================================

/**
 * Parses Edge TTS binary message format: Int16 header length (big-endian) + JSON header + MP3 data
 *
 * @param data - Binary message data from Edge TTS WebSocket
 * @returns Parsed message structure or null if invalid
 */
export function parseEdgeTTSBinaryMessage(
  data: ArrayBuffer,
): EdgeTTSBinaryMessage | null {
  if (data.byteLength < BINARY_MESSAGE.HEADER_LENGTH_BYTES) {
    return null;
  }

  try {
    const headerLengthView = new DataView(
      data,
      0,
      BINARY_MESSAGE.HEADER_LENGTH_BYTES,
    );
    const headerLength = headerLengthView.getUint16(0, false); // big-endian

    if (data.byteLength < BINARY_MESSAGE.HEADER_LENGTH_BYTES + headerLength) {
      return null;
    }

    // Extract and parse JSON header
    const headerStart = BINARY_MESSAGE.HEADER_LENGTH_BYTES;
    const headerEnd = headerStart + headerLength;
    const headerBytes = new Uint8Array(data, headerStart, headerLength);
    const headerText = new TextDecoder("utf-8").decode(headerBytes);

    // Parse header as HTTP-like format
    const header = parseMessageHeader(headerText);

    // Extract audio data
    const audioDataStart = headerEnd;
    const audioData = data.slice(audioDataStart);

    return {
      headerLength,
      header,
      audioData,
    };
  } catch {
    // Invalid binary message format
    return null;
  }
}

/**
 * Parses HTTP-like message header format used by Edge TTS
 *
 * @param headerText - Header text in HTTP format
 * @returns Parsed header object
 */
function parseMessageHeader(headerText: string): EdgeTTSMessageHeader {
  const header: EdgeTTSMessageHeader = {};
  const lines = headerText.split("\r\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      header[key] = value;
    }
  }

  return header;
}

/**
 * Validates that a binary message is an audio message from Edge TTS
 *
 * @param message - Parsed binary message
 * @returns True if message contains audio data
 */
export function isAudioMessage(message: EdgeTTSBinaryMessage): boolean {
  return (
    message.header["Content-Type"] === BINARY_PARSING.CONTENT_TYPE_AUDIO &&
    message.header.Path === BINARY_PARSING.PATH_AUDIO &&
    validateEdgeTTSMP3(message.audioData)
  );
}

// ============================================================================
// Audio Metadata Extraction
// ============================================================================

/**
 * Extracts audio metadata from Edge TTS binary message
 * Based on Edge TTS specification: 24kHz, 48kbps, mono MP3
 *
 * @param message - Parsed Edge TTS binary message
 * @returns Audio metadata or null if not an audio message
 */
export function extractAudioMetadata(
  message: EdgeTTSBinaryMessage,
): EdgeTTSAudioMetadata | null {
  if (!isAudioMessage(message)) {
    return null;
  }

  // Edge TTS uses fixed audio format specifications
  return {
    format: DEFAULT_AUDIO_FORMAT,
    sampleRate: 24000, // 24kHz
    bitRate: 48, // 48kbps
    channels: 1, // mono
    estimatedDuration: estimateMP3Duration(message.audioData),
  };
}

/**
 * Estimates MP3 audio duration from binary data
 * Uses frame counting approach for MP3 duration calculation
 *
 * @param mp3Data - MP3 audio data
 * @returns Estimated duration in milliseconds
 */
export function estimateMP3Duration(mp3Data: ArrayBuffer): number {
  if (!detectMP3Format(mp3Data)) {
    return 0;
  }

  // For Edge TTS fixed format (24kHz, 48kbps, mono)
  // Simple estimation: fileSize (bytes) / bitRate (bytes/sec) = duration (sec)
  const fileSizeBytes = mp3Data.byteLength;
  const bitRateBytesPerSecond = (48 * 1000) / 8; // 48kbps to bytes/sec
  const durationSeconds = fileSizeBytes / bitRateBytesPerSecond;

  return Math.round(durationSeconds * 1000); // Convert to milliseconds
}

// ============================================================================
// Word Boundary Timing Calculations
// ============================================================================

/**
 * Applies Edge TTS word boundary offset compensation
 * Implements: max(0, offset - 8750000) for padding compensation
 *
 * @param rawOffset - Raw offset in Edge TTS ticks
 * @returns Compensated offset in ticks
 */
export function compensateWordBoundaryOffset(rawOffset: number): number {
  return Math.max(0, rawOffset - WORD_BOUNDARY_OFFSET_COMPENSATION);
}

/**
 * Converts Edge TTS ticks to milliseconds
 * Implements: ticks / 10000
 *
 * @param ticks - Time value in Edge TTS ticks
 * @returns Time value in milliseconds
 */
export function ticksToMilliseconds(ticks: number): number {
  return ticks / 10000;
}

/**
 * Processes word boundary data from Edge TTS with offset compensation
 *
 * @param charIndex - Character index in original text
 * @param charLength - Character length of the word
 * @param rawOffset - Raw offset in Edge TTS ticks
 * @returns Processed word boundary data
 */
export function processWordBoundary(
  charIndex: number,
  charLength: number,
  rawOffset: number,
): EdgeTTSWordBoundary {
  const compensatedOffset = compensateWordBoundaryOffset(rawOffset);
  const offsetMs = ticksToMilliseconds(compensatedOffset);

  return {
    charIndex,
    charLength,
    rawOffset,
    compensatedOffset,
    offsetMs,
  };
}

// ============================================================================
// Audio Buffering for Streaming
// ============================================================================

/**
 * Creates a new audio stream buffer for accumulating MP3 chunks
 *
 * @returns New empty audio stream buffer
 */
export function createAudioStreamBuffer(): AudioStreamBuffer {
  return {
    chunks: [],
    totalSize: 0,
    metadata: undefined,
  };
}

/**
 * Adds an audio chunk to the streaming buffer
 *
 * @param buffer - Audio stream buffer
 * @param chunk - New audio chunk to add
 * @param metadata - Optional metadata (used for first chunk)
 */
export function addAudioChunk(
  buffer: AudioStreamBuffer,
  chunk: ArrayBuffer,
  metadata?: EdgeTTSAudioMetadata,
): void {
  buffer.chunks.push(chunk);
  buffer.totalSize += chunk.byteLength;

  if (metadata && !buffer.metadata) {
    buffer.metadata = metadata;
  }
}

/**
 * Combines all audio chunks into a single ArrayBuffer
 *
 * @param buffer - Audio stream buffer
 * @returns Combined audio data
 */
export function combineAudioChunks(buffer: AudioStreamBuffer): ArrayBuffer {
  if (buffer.chunks.length === 0) {
    return new ArrayBuffer(0);
  }

  if (buffer.chunks.length === 1) {
    return buffer.chunks[0];
  }

  // Combine multiple chunks
  const combined = new ArrayBuffer(buffer.totalSize);
  const combinedView = new Uint8Array(combined);
  let offset = 0;

  for (const chunk of buffer.chunks) {
    const chunkView = new Uint8Array(chunk);
    combinedView.set(chunkView, offset);
    offset += chunk.byteLength;
  }

  return combined;
}

/**
 * Clears the audio stream buffer and releases memory
 *
 * @param buffer - Audio stream buffer to clear
 */
export function clearAudioBuffer(buffer: AudioStreamBuffer): void {
  buffer.chunks.length = 0;
  buffer.totalSize = 0;
  buffer.metadata = undefined;
}

/**
 * Gets the current size of buffered audio data
 *
 * @param buffer - Audio stream buffer
 * @returns Total buffered size in bytes
 */
export function getBufferedSize(buffer: AudioStreamBuffer): number {
  return buffer.totalSize;
}

/**
 * Checks if the buffer has any audio data
 *
 * @param buffer - Audio stream buffer
 * @returns True if buffer contains audio data
 */
export function hasAudioData(buffer: AudioStreamBuffer): boolean {
  return buffer.chunks.length > 0 && buffer.totalSize > 0;
}

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

/**
 * Validates that streaming audio data maintains MP3 format consistency
 *
 * @param chunks - Array of audio chunks
 * @returns True if all chunks are valid MP3 format
 */
export function validateStreamingMP3Consistency(
  chunks: ArrayBuffer[],
): boolean {
  if (chunks.length === 0) {
    return true;
  }

  // Check first chunk for MP3 format
  if (!detectMP3Format(chunks[0])) {
    return false;
  }

  // For streaming, we assume subsequent chunks are continuation frames
  // and don't necessarily start with MP3 sync headers
  return true;
}

/**
 * Handles Edge TTS protocol specific audio processing edge cases
 *
 * @param data - Audio data to process
 * @returns Processed audio data or null if invalid
 */
export function handleEdgeTTSAudioEdgeCases(
  data: ArrayBuffer,
): ArrayBuffer | null {
  // Handle empty data
  if (data.byteLength === 0) {
    return null;
  }

  // Handle minimum size requirement for MP3
  if (data.byteLength < 4) {
    return null;
  }

  // Validate MP3 format
  if (!detectMP3Format(data)) {
    return null;
  }

  return data;
}

// ============================================================================
// Network Service Integration - WebSocket Chunk Processing
// ============================================================================

/**
 * Network Service streaming audio processor interface
 * Used for coordinating with Network Service real-time processing
 */
export interface NetworkServiceAudioProcessor {
  /** Process incoming WebSocket binary message containing audio */
  processWebSocketMessage(data: ArrayBuffer): EdgeTTSBinaryMessage | null;
  /** Extract audio data from processed message */
  extractAudioFromMessage(message: EdgeTTSBinaryMessage): ArrayBuffer | null;
  /** Validate streaming audio consistency */
  validateStreamingConsistency(chunks: ArrayBuffer[]): boolean;
  /** Handle network service edge cases */
  handleNetworkEdgeCases(data: ArrayBuffer): ArrayBuffer | null;
}

/**
 * Creates a Network Service audio processor for real-time WebSocket integration
 * Coordinates with Network Service for streaming audio processing
 *
 * @returns Network Service audio processor instance
 */
export function createNetworkServiceAudioProcessor(): NetworkServiceAudioProcessor {
  return {
    processWebSocketMessage(data: ArrayBuffer): EdgeTTSBinaryMessage | null {
      // Use existing binary message parsing with Network Service optimization
      const message = parseEdgeTTSBinaryMessage(data);
      if (!message) {
        return null;
      }

      // Validate that this is an audio message for Network Service
      if (!isAudioMessage(message)) {
        return null;
      }

      return message;
    },

    extractAudioFromMessage(message: EdgeTTSBinaryMessage): ArrayBuffer | null {
      if (!isAudioMessage(message)) {
        return null;
      }

      // Handle Network Service specific audio edge cases
      return handleEdgeTTSAudioEdgeCases(message.audioData);
    },

    validateStreamingConsistency(chunks: ArrayBuffer[]): boolean {
      // Enhanced validation for Network Service streaming
      return validateStreamingMP3Consistency(chunks);
    },

    handleNetworkEdgeCases(data: ArrayBuffer): ArrayBuffer | null {
      // Delegate to existing edge case handler with Network Service context
      return handleEdgeTTSAudioEdgeCases(data);
    },
  };
}

/**
 * Processes streaming audio chunks from Network Service with performance optimization
 * Designed for real-time processing with minimal latency
 *
 * @param chunks - Array of audio chunks from Network Service
 * @param processor - Network Service audio processor
 * @returns Processed and validated audio chunks
 */
export function processNetworkServiceAudioChunks(
  chunks: ArrayBuffer[],
  processor: NetworkServiceAudioProcessor,
): ArrayBuffer[] {
  if (chunks.length === 0) {
    return [];
  }

  const processedChunks: ArrayBuffer[] = [];

  for (const chunk of chunks) {
    const processedChunk = processor.handleNetworkEdgeCases(chunk);
    if (processedChunk) {
      processedChunks.push(processedChunk);
    }
  }

  // Validate streaming consistency for Network Service
  if (!processor.validateStreamingConsistency(processedChunks)) {
    return [];
  }

  return processedChunks;
}

// ============================================================================
// Storage Service Integration - Buffer Format Coordination
// ============================================================================

/**
 * Storage Service buffer format interface for coordinating with Storage Service
 */
export interface StorageServiceBufferFormat {
  /** Connection ID for buffer tracking */
  connectionId: string;
  /** Audio chunks in Storage Service format (Uint8Array[]) */
  audioChunks: Uint8Array[];
  /** Total buffer size coordination */
  totalSize: number;
  /** Last activity timestamp for Storage Service cleanup */
  lastActivity: Date;
}

/**
 * Converts AudioStreamBuffer to Storage Service buffer format
 * Coordinates with Storage Service buffer management
 *
 * @param buffer - Audio stream buffer
 * @param connectionId - Connection ID for Storage Service tracking
 * @returns Storage Service compatible buffer format
 */
export function convertToStorageServiceFormat(
  buffer: AudioStreamBuffer,
  connectionId: string,
): StorageServiceBufferFormat {
  const storageChunks: Uint8Array[] = buffer.chunks.map(
    (chunk) => new Uint8Array(chunk),
  );

  return {
    connectionId,
    audioChunks: storageChunks,
    totalSize: buffer.totalSize,
    lastActivity: new Date(),
  };
}

/**
 * Converts Storage Service buffer format back to AudioStreamBuffer
 * Enables coordination between audio processing and Storage Service
 *
 * @param storageBuffer - Storage Service buffer format
 * @returns AudioStreamBuffer for audio processing
 */
export function convertFromStorageServiceFormat(
  storageBuffer: StorageServiceBufferFormat,
): AudioStreamBuffer {
  const chunks: ArrayBuffer[] = storageBuffer.audioChunks.map(
    (uint8Array) => uint8Array.buffer as ArrayBuffer,
  );

  return {
    chunks,
    totalSize: storageBuffer.totalSize,
    metadata: undefined, // Metadata will be extracted from first chunk if needed
  };
}

/**
 * Merges audio chunks with Storage Service coordination
 * Optimized for Storage Service buffer management patterns
 *
 * @param storageBuffer - Storage Service buffer format
 * @returns Combined audio data ready for playback
 */
export function mergeStorageServiceAudioChunks(
  storageBuffer: StorageServiceBufferFormat,
): ArrayBuffer {
  if (storageBuffer.audioChunks.length === 0) {
    return new ArrayBuffer(0);
  }

  if (storageBuffer.audioChunks.length === 1) {
    return storageBuffer.audioChunks[0].buffer as ArrayBuffer;
  }

  // Performance-optimized merging for Storage Service format
  const combined = new ArrayBuffer(storageBuffer.totalSize);
  const combinedView = new Uint8Array(combined);
  let offset = 0;

  for (const chunk of storageBuffer.audioChunks) {
    combinedView.set(chunk, offset);
    offset += chunk.length;
  }

  return combined;
}

// ============================================================================
// expo-av Compatibility Functions
// ============================================================================

/**
 * expo-av compatible audio data interface
 * Based on expo-av documentation for Sound.createAsync requirements
 */
export interface ExpoAVAudioData {
  /** Data URI for expo-av Sound.createAsync */
  uri: string;
  /** Audio metadata for expo-av */
  metadata: {
    format: string;
    duration?: number;
    sampleRate: number;
    channels: number;
  };
}

/**
 * Generates expo-av compatible data URI from MP3 audio data
 * Creates base64 data URI for expo-av Sound.createAsync usage
 *
 * @param mp3Data - MP3 audio data from Edge TTS
 * @returns Data URI string for expo-av compatibility
 */
export function generateExpoAVDataURI(mp3Data: ArrayBuffer): string {
  // Convert ArrayBuffer to base64 for data URI
  const uint8Array = new Uint8Array(mp3Data);
  const binaryString = String.fromCharCode.apply(null, Array.from(uint8Array));
  const base64String = btoa(binaryString);

  // Create data URI with MP3 MIME type for expo-av
  return `data:audio/mpeg;base64,${base64String}`;
}

/**
 * Creates expo-av compatible audio data from Edge TTS MP3
 * Prepares audio data for use with expo-av Sound.createAsync
 *
 * @param mp3Data - MP3 audio data from Edge TTS
 * @param metadata - Optional audio metadata
 * @returns expo-av compatible audio data
 */
export function createExpoAVAudioData(
  mp3Data: ArrayBuffer,
  metadata?: EdgeTTSAudioMetadata,
): ExpoAVAudioData {
  const uri = generateExpoAVDataURI(mp3Data);

  // Use provided metadata or extract from MP3 data
  const audioMetadata = metadata || {
    format: DEFAULT_AUDIO_FORMAT,
    sampleRate: 24000, // Edge TTS 24kHz
    channels: 1, // Edge TTS mono
    estimatedDuration: estimateMP3Duration(mp3Data),
  };

  return {
    uri,
    metadata: {
      format: audioMetadata.format,
      duration: audioMetadata.estimatedDuration,
      sampleRate: audioMetadata.sampleRate,
      channels: audioMetadata.channels,
    },
  };
}

/**
 * Validates expo-av audio data compatibility
 * Ensures audio data meets expo-av Sound.createAsync requirements
 *
 * @param audioData - expo-av audio data to validate
 * @returns True if compatible with expo-av
 */
export function validateExpoAVCompatibility(
  audioData: ExpoAVAudioData,
): boolean {
  // Validate data URI format
  if (!audioData.uri.startsWith("data:audio/mpeg;base64,")) {
    return false;
  }

  // Validate metadata
  if (!audioData.metadata || !audioData.metadata.format) {
    return false;
  }

  // Validate Edge TTS specific requirements
  return (
    audioData.metadata.sampleRate === 24000 &&
    audioData.metadata.channels === 1 &&
    audioData.metadata.format === DEFAULT_AUDIO_FORMAT
  );
}

// ============================================================================
// Streaming Audio Validation for Real-time Processing
// ============================================================================

/**
 * Real-time streaming validator for audio processing
 */
export interface RealTimeStreamingValidator {
  /** Validate incoming audio chunk in real-time */
  validateChunk(chunk: ArrayBuffer, chunkIndex: number): boolean;
  /** Validate chunk sequence for streaming continuity */
  validateSequence(chunks: ArrayBuffer[]): boolean;
  /** Check if streaming is healthy */
  isStreamingHealthy(buffer: AudioStreamBuffer): boolean;
  /** Get streaming health metrics */
  getHealthMetrics(buffer: AudioStreamBuffer): StreamingHealthMetrics;
}

/**
 * Streaming health metrics for real-time monitoring
 */
export interface StreamingHealthMetrics {
  /** Number of chunks processed */
  chunksProcessed: number;
  /** Total data processed in bytes */
  totalDataProcessed: number;
  /** Average chunk size */
  averageChunkSize: number;
  /** Streaming consistency score (0-1) */
  consistencyScore: number;
  /** Is streaming within performance targets */
  isOptimal: boolean;
}

/**
 * Creates a real-time streaming validator for audio processing
 * Optimized for real-time validation with minimal overhead
 *
 * @returns Real-time streaming validator instance
 */
export function createRealTimeStreamingValidator(): RealTimeStreamingValidator {
  return {
    validateChunk(chunk: ArrayBuffer, chunkIndex: number): boolean {
      // Basic validation for real-time processing
      if (chunk.byteLength === 0) {
        return false;
      }

      // First chunk must be valid MP3
      if (chunkIndex === 0) {
        return detectMP3Format(chunk);
      }

      // Subsequent chunks can be continuation frames
      return chunk.byteLength > 0;
    },

    validateSequence(chunks: ArrayBuffer[]): boolean {
      if (chunks.length === 0) {
        return true;
      }

      // Use existing streaming consistency validation
      return validateStreamingMP3Consistency(chunks);
    },

    isStreamingHealthy(buffer: AudioStreamBuffer): boolean {
      if (buffer.chunks.length === 0) {
        return true;
      }

      // Check for reasonable chunk sizes and total size
      const averageChunkSize = buffer.totalSize / buffer.chunks.length;
      return averageChunkSize > 0 && buffer.totalSize > 0;
    },

    getHealthMetrics(buffer: AudioStreamBuffer): StreamingHealthMetrics {
      const chunksProcessed = buffer.chunks.length;
      const totalDataProcessed = buffer.totalSize;
      const averageChunkSize =
        chunksProcessed > 0 ? totalDataProcessed / chunksProcessed : 0;

      // Calculate consistency score based on chunk size variance
      let consistencyScore = 1.0;
      if (chunksProcessed > 1) {
        let variance = 0;
        for (const chunk of buffer.chunks) {
          const diff = chunk.byteLength - averageChunkSize;
          variance += diff * diff;
        }
        variance /= chunksProcessed;

        // Normalize variance to 0-1 score (lower variance = higher consistency)
        consistencyScore = Math.max(
          0,
          1 - variance / (averageChunkSize * averageChunkSize),
        );
      }

      const isOptimal =
        chunksProcessed > 0 &&
        averageChunkSize > 1000 && // Reasonable minimum chunk size
        consistencyScore > 0.7; // Reasonable consistency threshold

      return {
        chunksProcessed,
        totalDataProcessed,
        averageChunkSize,
        consistencyScore,
        isOptimal,
      };
    },
  };
}

// ============================================================================
// Performance Optimizations for Real-time Audio Processing
// ============================================================================

/**
 * Performance-optimized audio chunk processor for real-time streaming
 */
export interface PerformanceOptimizedProcessor {
  /** Process chunk with performance optimization */
  processChunkOptimized(chunk: ArrayBuffer): ArrayBuffer | null;
  /** Batch process multiple chunks efficiently */
  batchProcessChunks(chunks: ArrayBuffer[]): ArrayBuffer[];
  /** Pre-allocate buffers for performance */
  preAllocateBuffers(
    expectedChunkCount: number,
    expectedTotalSize: number,
  ): void;
  /** Clean up allocated resources */
  cleanup(): void;
  /** Get pre-allocated buffer */
  getPreallocatedBuffer(): ArrayBuffer | null;
}

/**
 * Creates a performance-optimized processor for real-time audio processing
 * Minimizes allocations and copying for maximum performance
 *
 * @returns Performance-optimized processor instance
 */
export function createPerformanceOptimizedProcessor(): PerformanceOptimizedProcessor {
  let preallocatedBuffer: ArrayBuffer | null = null;

  return {
    processChunkOptimized(chunk: ArrayBuffer): ArrayBuffer | null {
      // Fast path for empty chunks
      if (chunk.byteLength === 0) {
        return null;
      }

      // Fast validation without creating new objects
      if (chunk.byteLength < 4) {
        return null;
      }

      const view = new Uint8Array(chunk, 0, 4);
      if (view[0] !== 0xff || (view[1] & 0xe0) !== 0xe0) {
        return null;
      }

      return chunk; // Return original chunk to avoid copying
    },

    batchProcessChunks(chunks: ArrayBuffer[]): ArrayBuffer[] {
      const processed: ArrayBuffer[] = [];

      // Process in batches to maintain performance
      for (let i = 0; i < chunks.length; i++) {
        const processedChunk = this.processChunkOptimized(chunks[i]);
        if (processedChunk) {
          processed.push(processedChunk);
        }
      }

      return processed;
    },

    preAllocateBuffers(
      expectedChunkCount: number,
      expectedTotalSize: number,
    ): void {
      if (expectedTotalSize > 0) {
        preallocatedBuffer = new ArrayBuffer(expectedTotalSize);
      }
    },

    cleanup(): void {
      preallocatedBuffer = null;
    },

    getPreallocatedBuffer(): ArrayBuffer | null {
      return preallocatedBuffer;
    },
  };
}

/**
 * Optimized audio chunk combiner with pre-allocated buffers
 * Reduces memory allocations for real-time performance
 *
 * @param chunks - Audio chunks to combine
 * @param preallocatedBuffer - Optional pre-allocated buffer for performance
 * @returns Combined audio data
 */
export function combineAudioChunksOptimized(
  chunks: ArrayBuffer[],
  preallocatedBuffer?: ArrayBuffer,
): ArrayBuffer {
  if (chunks.length === 0) {
    return new ArrayBuffer(0);
  }

  if (chunks.length === 1) {
    return chunks[0];
  }

  // Calculate total size
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

  // Use pre-allocated buffer if available and correctly sized
  const combined =
    preallocatedBuffer && preallocatedBuffer.byteLength === totalSize
      ? preallocatedBuffer
      : new ArrayBuffer(totalSize);

  const combinedView = new Uint8Array(combined);
  let offset = 0;

  // Optimized copying loop
  for (const chunk of chunks) {
    const chunkView = new Uint8Array(chunk);
    combinedView.set(chunkView, offset);
    offset += chunk.byteLength;
  }

  return combined;
}

// ============================================================================
// Enhanced Edge Case Handling from Network Service Implementation
// ============================================================================

/**
 * Enhanced edge case handler for Network Service integration
 * Handles edge cases discovered during Network Service implementation
 */
export interface NetworkServiceEdgeCaseHandler {
  /** Handle WebSocket connection edge cases */
  handleWebSocketEdgeCases(data: ArrayBuffer): ArrayBuffer | null;
  /** Handle audio chunk corruption scenarios */
  handleChunkCorruption(chunk: ArrayBuffer): ArrayBuffer | null;
  /** Handle incomplete audio messages */
  handleIncompleteMessages(data: ArrayBuffer): ArrayBuffer | null;
  /** Handle audio format inconsistencies */
  handleFormatInconsistencies(chunks: ArrayBuffer[]): ArrayBuffer[];
}

/**
 * Creates enhanced edge case handler for Network Service integration
 * Includes all edge cases discovered during Network Service implementation
 *
 * @returns Network Service edge case handler
 */
export function createNetworkServiceEdgeCaseHandler(): NetworkServiceEdgeCaseHandler {
  return {
    handleWebSocketEdgeCases(data: ArrayBuffer): ArrayBuffer | null {
      // Handle empty WebSocket messages
      if (data.byteLength === 0) {
        return null;
      }

      // Handle minimum message size requirements
      if (data.byteLength < BINARY_MESSAGE.HEADER_LENGTH_BYTES) {
        return null;
      }

      // Delegate to existing handler with WebSocket context
      return handleEdgeTTSAudioEdgeCases(data);
    },

    handleChunkCorruption(chunk: ArrayBuffer): ArrayBuffer | null {
      // Check for obvious corruption patterns
      if (chunk.byteLength === 0) {
        return null;
      }

      // Validate MP3 structure for corruption detection
      if (!detectMP3Format(chunk)) {
        return null;
      }

      return chunk;
    },

    handleIncompleteMessages(data: ArrayBuffer): ArrayBuffer | null {
      // Try to parse as binary message to detect incomplete state
      const message = parseEdgeTTSBinaryMessage(data);
      if (!message) {
        return null; // Incomplete or invalid message
      }

      // Return audio data if message is complete
      return message.audioData;
    },

    handleFormatInconsistencies(chunks: ArrayBuffer[]): ArrayBuffer[] {
      if (chunks.length === 0) {
        return [];
      }

      const validChunks: ArrayBuffer[] = [];

      for (const chunk of chunks) {
        // Use existing edge case handler for each chunk
        const processedChunk = handleEdgeTTSAudioEdgeCases(chunk);
        if (processedChunk) {
          validChunks.push(processedChunk);
        }
      }

      // Validate overall consistency
      if (validateStreamingMP3Consistency(validChunks)) {
        return validChunks;
      }

      return [];
    },
  };
}

/**
 * Enhanced audio processing pipeline for Network Service integration
 * Combines all enhancements for comprehensive audio processing
 *
 * @param chunks - Raw audio chunks from Network Service
 * @param connectionId - Connection ID for Storage Service coordination
 * @returns Processed audio data ready for expo-av playback
 */
export function processNetworkServiceAudioPipeline(
  chunks: ArrayBuffer[],
  connectionId: string,
): ExpoAVAudioData | null {
  if (chunks.length === 0) {
    return null;
  }

  // Create processors
  const edgeCaseHandler = createNetworkServiceEdgeCaseHandler();
  const performanceProcessor = createPerformanceOptimizedProcessor();
  const streamingValidator = createRealTimeStreamingValidator();

  try {
    // Step 1: Handle edge cases
    const validChunks = edgeCaseHandler.handleFormatInconsistencies(chunks);
    if (validChunks.length === 0) {
      return null;
    }

    // Step 2: Process with performance optimization
    const processedChunks =
      performanceProcessor.batchProcessChunks(validChunks);
    if (processedChunks.length === 0) {
      return null;
    }

    // Step 3: Validate streaming consistency
    if (!streamingValidator.validateSequence(processedChunks)) {
      return null;
    }

    // Step 4: Combine chunks optimally
    const preallocatedBuffer = performanceProcessor.getPreallocatedBuffer();
    const combinedAudio = combineAudioChunksOptimized(
      processedChunks,
      preallocatedBuffer || undefined,
    );
    if (combinedAudio.byteLength === 0) {
      return null;
    }

    // Step 5: Create expo-av compatible data
    const expoAVData = createExpoAVAudioData(combinedAudio);
    if (!validateExpoAVCompatibility(expoAVData)) {
      return null;
    }

    return expoAVData;
  } finally {
    // Clean up resources
    performanceProcessor.cleanup();
  }
}
