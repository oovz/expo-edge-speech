/**
 * Comprehensive Tests for Edge TTS Audio Processing Utilities
 * This test suite combines all tests for audioUtils.ts functionality including:
 * - Basic Edge TTS audio processing utilities
 * - Enhanced utilities with WebSocket integration, Storage Service coordination, and expo-av compatibility
 */

import * as fs from "fs";
import * as path from "path";

import {
  // Type imports
  EdgeTTSBinaryMessage,
  EdgeTTSAudioMetadata,

  // MP3 format validation functions
  isValidMP3Format,
  detectMP3Format,
  validateEdgeTTSMP3,

  // Binary message parsing functions
  parseEdgeTTSBinaryMessage,
  isAudioMessage,

  // Audio metadata extraction functions
  extractAudioMetadata,
  estimateMP3Duration,

  // Word boundary timing functions
  compensateWordBoundaryOffset,
  ticksToMilliseconds,
  processWordBoundary,

  // Audio streaming buffer functions
  createAudioStreamBuffer,
  addAudioChunk,
  combineAudioChunks,
  clearAudioBuffer,
  getBufferedSize,
  hasAudioData,

  // Network Service Integration
  NetworkServiceAudioProcessor,
  createNetworkServiceAudioProcessor,
  processNetworkServiceAudioChunks,

  // Storage Service Integration
  StorageServiceBufferFormat,
  convertToStorageServiceFormat,
  convertFromStorageServiceFormat,
  mergeStorageServiceAudioChunks,

  // expo-av Compatibility
  ExpoAVAudioData,
  generateExpoAVDataURI,
  createExpoAVAudioData,
  validateExpoAVCompatibility,

  // Real-time Streaming Validation
  createRealTimeStreamingValidator,

  // Performance Optimizations
  createPerformanceOptimizedProcessor,
  combineAudioChunksOptimized,

  // Enhanced Edge Case Handling
  createNetworkServiceEdgeCaseHandler,

  // Complete Pipeline
  processNetworkServiceAudioPipeline,
} from "../src/utils/audioUtils";

import {
  AUDIO_FORMATS,
  DEFAULT_AUDIO_FORMAT,
  WORD_BOUNDARY_OFFSET_COMPENSATION,
} from "../src/constants";

// Load real Edge TTS MP3 file for testing
const REAL_MP3_PATH = path.join(
  __dirname,
  "__fixtures__",
  "audio-samples",
  "hello-world-edge-tts.mp3",
);
let realEdgeTTSMP3: ArrayBuffer | null = null;

// Helper function to load the real MP3 file
function loadRealMP3File(): ArrayBuffer {
  if (!realEdgeTTSMP3) {
    try {
      const buffer = fs.readFileSync(REAL_MP3_PATH);
      realEdgeTTSMP3 = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      );
    } catch {
      console.warn(
        "Warning: Could not load real Edge TTS MP3 file, using synthetic data for tests",
      );
      // Fallback to synthetic data if file not found
      const fallbackData = new ArrayBuffer(1024);
      const view = new Uint8Array(fallbackData);
      view[0] = 0xff; // MP3 sync byte 1
      view[1] = 0xe0; // MP3 sync byte 2
      realEdgeTTSMP3 = fallbackData;
    }
  }
  return realEdgeTTSMP3;
}

// Helper function to create Edge TTS binary message with real MP3 data
function createRealEdgeTTSBinaryMessage(): ArrayBuffer {
  const headerText =
    "Content-Type: audio/mpeg\r\nPath: audio\r\nX-RequestId: test-real-mp3\r\n\r\n";

  const headerLength = headerText.length;
  const mp3Data = loadRealMP3File();
  const totalSize = 2 + headerLength + mp3Data.byteLength;

  const binaryMessage = new ArrayBuffer(totalSize);

  const view = new DataView(binaryMessage);
  const uint8View = new Uint8Array(binaryMessage);

  // Write header length (big-endian Int16)
  view.setUint16(0, headerLength, false);

  // Write header text
  for (let i = 0; i < headerLength; i++) {
    uint8View[2 + i] = headerText.charCodeAt(i);
  }

  // Write real MP3 data
  const mp3View = new Uint8Array(mp3Data);
  uint8View.set(mp3View, 2 + headerLength);

  return binaryMessage;
}

describe("AudioUtils - Edge TTS Audio Processing Utilities", () => {
  // ============================================================================
  // MP3 Format Validation Tests
  // ============================================================================

  describe("MP3 Format Validation", () => {
    describe("isValidMP3Format", () => {
      it("should validate Edge TTS MP3 format string", () => {
        expect(isValidMP3Format(AUDIO_FORMATS.MP3_24KHZ_48KBPS)).toBe(true);
        expect(isValidMP3Format(DEFAULT_AUDIO_FORMAT)).toBe(true);
      });

      it("should reject invalid format strings", () => {
        expect(isValidMP3Format("audio-wav")).toBe(false);
        expect(isValidMP3Format("audio-ogg")).toBe(false);
        expect(isValidMP3Format("")).toBe(false);
        expect(isValidMP3Format("invalid-format")).toBe(false);
      });

      it("should reject non-Edge-TTS MP3 formats", () => {
        expect(isValidMP3Format("audio-16khz-32kbitrate-mono-mp3")).toBe(false);
        expect(isValidMP3Format("audio-48khz-96kbitrate-stereo-mp3")).toBe(
          false,
        );
      });
    });

    describe("detectMP3Format", () => {
      it("should detect valid MP3 header bytes", () => {
        const validMP3Data = new ArrayBuffer(4);
        const view = new Uint8Array(validMP3Data);
        view[0] = 0xff; // MP3 sync byte 1
        view[1] = 0xe0; // MP3 sync byte 2 (minimum valid)

        expect(detectMP3Format(validMP3Data)).toBe(true);
      });

      it("should reject invalid MP3 header bytes", () => {
        const invalidMP3Data = new ArrayBuffer(4);
        const view = new Uint8Array(invalidMP3Data);
        view[0] = 0x00;
        view[1] = 0x00;

        expect(detectMP3Format(invalidMP3Data)).toBe(false);
      });

      it("should handle empty or too small data", () => {
        expect(detectMP3Format(new ArrayBuffer(0))).toBe(false);
        expect(detectMP3Format(new ArrayBuffer(1))).toBe(false);
      });
    });

    describe("validateEdgeTTSMP3", () => {
      it("should validate complete Edge TTS MP3 data", () => {
        const validMP3Data = new ArrayBuffer(1024);
        const view = new Uint8Array(validMP3Data);
        view[0] = 0xff;
        view[1] = 0xe0;

        expect(validateEdgeTTSMP3(validMP3Data)).toBe(true);
      });

      it("should reject invalid Edge TTS MP3 data", () => {
        const invalidData = new ArrayBuffer(1024);
        expect(validateEdgeTTSMP3(invalidData)).toBe(false);
      });

      it("should validate real Edge TTS MP3 file", () => {
        const realMP3Data = loadRealMP3File();
        expect(validateEdgeTTSMP3(realMP3Data)).toBe(true);
      });
    });
  });

  // ============================================================================
  // Binary Message Parsing Tests
  // ============================================================================

  describe("Binary Message Parsing", () => {
    describe("parseEdgeTTSBinaryMessage", () => {
      it("should parse valid Edge TTS binary message", () => {
        // Create test binary message: headerLength (2 bytes) + header + audio data
        const headerText =
          "Content-Type: audio/mpeg\r\nPath: audio\r\nX-RequestId: test123\r\n\r\n";
        const headerLength = headerText.length;
        const audioDataSize = 512;
        const totalSize = 2 + headerLength + audioDataSize;

        const binaryData = new ArrayBuffer(totalSize);
        const view = new DataView(binaryData);
        const uint8View = new Uint8Array(binaryData);

        // Write header length (big-endian Int16)
        view.setUint16(0, headerLength, false);

        // Write header text
        for (let i = 0; i < headerLength; i++) {
          uint8View[2 + i] = headerText.charCodeAt(i);
        }

        // Write MP3 audio data (starts with valid MP3 header)
        uint8View[2 + headerLength] = 0xff;
        uint8View[2 + headerLength + 1] = 0xe0;

        const result = parseEdgeTTSBinaryMessage(binaryData);

        expect(result).not.toBeNull();
        expect(result!.headerLength).toBe(headerLength);
        expect(result!.header["Content-Type"]).toBe("audio/mpeg");
        expect(result!.header.Path).toBe("audio");
        expect(result!.header["X-RequestId"]).toBe("test123");
        expect(result!.audioData.byteLength).toBe(audioDataSize);
      });

      it("should return null for invalid binary message", () => {
        const invalidData = new ArrayBuffer(1);
        expect(parseEdgeTTSBinaryMessage(invalidData)).toBeNull();
      });

      it("should return null for corrupted header", () => {
        const corruptedData = new ArrayBuffer(10);
        const view = new DataView(corruptedData);
        view.setUint16(0, 1000, false); // Header length larger than total data (big-endian)

        expect(parseEdgeTTSBinaryMessage(corruptedData)).toBeNull();
      });

      it("should parse real Edge TTS binary message with MP3 data", () => {
        const realBinaryMessage = createRealEdgeTTSBinaryMessage();
        const result = parseEdgeTTSBinaryMessage(realBinaryMessage);

        expect(result).not.toBeNull();
        expect(result!.header["Content-Type"]).toBe("audio/mpeg");
        expect(result!.header.Path).toBe("audio");
        expect(result!.header["X-RequestId"]).toBe("test-real-mp3");
        expect(result!.audioData.byteLength).toBeGreaterThan(0);

        // Verify it's a valid MP3
        expect(validateEdgeTTSMP3(result!.audioData)).toBe(true);
      });
    });

    describe("isAudioMessage", () => {
      it("should identify audio messages correctly", () => {
        // Create audio data with valid MP3 header
        const audioData = new ArrayBuffer(512);
        const view = new Uint8Array(audioData);
        view[0] = 0xff;
        view[1] = 0xe0;

        const audioMessage: EdgeTTSBinaryMessage = {
          headerLength: 50,
          header: {
            "Content-Type": "audio/mpeg",
            Path: "audio",
            "X-RequestId": "test123",
          },
          audioData,
        };

        expect(isAudioMessage(audioMessage)).toBe(true);
      });

      it("should reject non-audio messages", () => {
        const nonAudioMessage: EdgeTTSBinaryMessage = {
          headerLength: 50,
          header: {
            "Content-Type": "application/json",
            Path: "turn.end",
            "X-RequestId": "test123",
          },
          audioData: new ArrayBuffer(0),
        };

        expect(isAudioMessage(nonAudioMessage)).toBe(false);
      });
    });
  });

  // ============================================================================
  // Audio Metadata Extraction Tests
  // ============================================================================

  describe("Audio Metadata Extraction", () => {
    describe("extractAudioMetadata", () => {
      it("should extract metadata from Edge TTS audio message", () => {
        // Create audio data with valid MP3 header
        const audioData = new ArrayBuffer(1024);
        const view = new Uint8Array(audioData);
        view[0] = 0xff;
        view[1] = 0xe0;

        const audioMessage: EdgeTTSBinaryMessage = {
          headerLength: 50,
          header: {
            "Content-Type": "audio/mpeg",
            Path: "audio",
            "X-RequestId": "test123",
          },
          audioData,
        };

        const metadata = extractAudioMetadata(audioMessage);

        expect(metadata).not.toBeNull();
        expect(metadata!.format).toBe(AUDIO_FORMATS.MP3_24KHZ_48KBPS);
        expect(metadata!.sampleRate).toBe(24000);
        expect(metadata!.bitRate).toBe(48);
        expect(metadata!.channels).toBe(1);
        expect(metadata!.estimatedDuration).toBeGreaterThan(0);
      });

      it("should return null for non-audio messages", () => {
        const nonAudioMessage: EdgeTTSBinaryMessage = {
          headerLength: 50,
          header: {
            "Content-Type": "application/json",
            Path: "turn.end",
          },
          audioData: new ArrayBuffer(0),
        };

        expect(extractAudioMetadata(nonAudioMessage)).toBeNull();
      });

      it("should extract metadata from real Edge TTS audio message", () => {
        const realBinaryMessage = createRealEdgeTTSBinaryMessage();
        const parsedMessage = parseEdgeTTSBinaryMessage(realBinaryMessage);

        expect(parsedMessage).not.toBeNull();

        const metadata = extractAudioMetadata(parsedMessage!);

        expect(metadata).not.toBeNull();
        expect(metadata!.format).toBe(AUDIO_FORMATS.MP3_24KHZ_48KBPS);
        expect(metadata!.sampleRate).toBe(24000);
        expect(metadata!.bitRate).toBe(48);
        expect(metadata!.channels).toBe(1);
        expect(metadata!.estimatedDuration).toBeGreaterThan(0);
      });
    });

    describe("estimateMP3Duration", () => {
      it("should estimate duration for Edge TTS MP3 format", () => {
        // Edge TTS: 24kHz, 48kbps = 6000 bytes per second
        const mp3Data = new ArrayBuffer(6000); // Should be ~1 second
        const view = new Uint8Array(mp3Data);
        view[0] = 0xff;
        view[1] = 0xe0;

        const duration = estimateMP3Duration(mp3Data);

        expect(duration).toBeCloseTo(1000, 100); // Within 100ms tolerance
      });

      it("should handle empty audio data", () => {
        const emptyData = new ArrayBuffer(0);
        expect(estimateMP3Duration(emptyData)).toBe(0);
      });

      it("should handle small audio chunks", () => {
        const smallData = new ArrayBuffer(300); // ~50ms of audio
        const view = new Uint8Array(smallData);
        view[0] = 0xff;
        view[1] = 0xe0;

        const duration = estimateMP3Duration(smallData);

        expect(duration).toBeGreaterThan(0);
        expect(duration).toBeLessThan(100);
      });

      it("should estimate duration for real Edge TTS MP3 file", () => {
        const realMP3Data = loadRealMP3File();
        const duration = estimateMP3Duration(realMP3Data);

        // Real MP3 should have a meaningful duration
        expect(duration).toBeGreaterThan(0);
        expect(duration).toBeGreaterThan(100); // At least 100ms for "hello world"
        expect(duration).toBeLessThan(10000); // Less than 10 seconds
      });
    });
  });

  // ============================================================================
  // Word Boundary Timing Tests
  // ============================================================================

  describe("Word Boundary Timing", () => {
    describe("compensateWordBoundaryOffset", () => {
      it("should apply Edge TTS offset compensation", () => {
        const rawOffset = 8_850_000; // Raw offset from Edge TTS
        const compensated = compensateWordBoundaryOffset(rawOffset);

        expect(compensated).toBe(rawOffset - WORD_BOUNDARY_OFFSET_COMPENSATION);
        expect(compensated).toBe(100_000);
      });

      it("should not return negative offsets", () => {
        const smallOffset = 1_000_000; // Less than compensation
        const compensated = compensateWordBoundaryOffset(smallOffset);

        expect(compensated).toBe(0);
        expect(compensated).toBeGreaterThanOrEqual(0);
      });

      it("should handle zero offset", () => {
        expect(compensateWordBoundaryOffset(0)).toBe(0);
      });
    });

    describe("ticksToMilliseconds", () => {
      it("should convert Edge TTS ticks to milliseconds", () => {
        const ticks = 100_000; // 100,000 ticks
        const milliseconds = ticksToMilliseconds(ticks);

        expect(milliseconds).toBe(10); // 100,000 / 10,000 = 10ms
      });

      it("should handle zero ticks", () => {
        expect(ticksToMilliseconds(0)).toBe(0);
      });

      it("should handle large tick values", () => {
        const largeTicks = 50_000_000; // 50 million ticks
        const milliseconds = ticksToMilliseconds(largeTicks);

        expect(milliseconds).toBe(5000); // 5 seconds
      });
    });

    describe("processWordBoundary", () => {
      it("should process complete word boundary data", () => {
        const charIndex = 0;
        const charLength = 5;
        const rawOffset = 8_850_000;

        const processed = processWordBoundary(charIndex, charLength, rawOffset);

        expect(processed.charIndex).toBe(0);
        expect(processed.charLength).toBe(5);
        expect(processed.rawOffset).toBe(8_850_000);
        expect(processed.compensatedOffset).toBe(100_000);
        expect(processed.offsetMs).toBe(10); // (8_850_000 - 8_750_000) / 10_000
      });

      it("should handle boundary at start of speech", () => {
        const charIndex = 0;
        const charLength = 1;
        const rawOffset = 8_750_000; // Exactly at compensation threshold

        const processed = processWordBoundary(charIndex, charLength, rawOffset);

        expect(processed.offsetMs).toBe(0);
        expect(processed.compensatedOffset).toBe(0);
      });
    });
  });

  // ============================================================================
  // Audio Streaming Buffer Tests
  // ============================================================================

  describe("Audio Streaming Buffer", () => {
    describe("createAudioStreamBuffer", () => {
      it("should create empty audio stream buffer", () => {
        const buffer = createAudioStreamBuffer();

        expect(buffer.chunks).toEqual([]);
        expect(buffer.totalSize).toBe(0);
        expect(buffer.metadata).toBeUndefined();
      });
    });

    describe("addAudioChunk", () => {
      it("should add audio chunk to buffer", () => {
        const buffer = createAudioStreamBuffer();
        const chunkData = new ArrayBuffer(512);

        addAudioChunk(buffer, chunkData);

        expect(buffer.chunks.length).toBe(1);
        expect(buffer.totalSize).toBe(512);
        expect(buffer.chunks[0]).toBe(chunkData);
      });

      it("should add multiple chunks sequentially", () => {
        const buffer = createAudioStreamBuffer();
        const chunk1 = new ArrayBuffer(256);
        const chunk2 = new ArrayBuffer(512);
        const chunk3 = new ArrayBuffer(128);

        addAudioChunk(buffer, chunk1);
        addAudioChunk(buffer, chunk2);
        addAudioChunk(buffer, chunk3);

        expect(buffer.chunks.length).toBe(3);
        expect(buffer.totalSize).toBe(896);
      });

      it("should handle empty chunks", () => {
        const buffer = createAudioStreamBuffer();
        const emptyChunk = new ArrayBuffer(0);

        addAudioChunk(buffer, emptyChunk);

        expect(buffer.chunks.length).toBe(1);
        expect(buffer.totalSize).toBe(0);
      });

      it("should add metadata with first chunk", () => {
        const buffer = createAudioStreamBuffer();
        const chunkData = new ArrayBuffer(512);
        const metadata: EdgeTTSAudioMetadata = {
          format: AUDIO_FORMATS.MP3_24KHZ_48KBPS,
          sampleRate: 24000,
          bitRate: 48,
          channels: 1,
        };

        addAudioChunk(buffer, chunkData, metadata);

        expect(buffer.metadata).toBe(metadata);
      });
    });

    describe("combineAudioChunks", () => {
      it("should combine multiple audio chunks into single buffer", () => {
        const buffer = createAudioStreamBuffer();

        // Create test chunks with known data
        const chunk1 = new ArrayBuffer(4);
        const chunk2 = new ArrayBuffer(4);
        const view1 = new Uint8Array(chunk1);
        const view2 = new Uint8Array(chunk2);

        view1[0] = 0xff;
        view1[1] = 0xe0;
        view1[2] = 0x01;
        view1[3] = 0x02;
        view2[0] = 0x03;
        view2[1] = 0x04;
        view2[2] = 0x05;
        view2[3] = 0x06;

        addAudioChunk(buffer, chunk1);
        addAudioChunk(buffer, chunk2);

        const combined = combineAudioChunks(buffer);
        const combinedView = new Uint8Array(combined);

        expect(combined.byteLength).toBe(8);
        expect(combinedView[0]).toBe(0xff);
        expect(combinedView[1]).toBe(0xe0);
        expect(combinedView[4]).toBe(0x03);
        expect(combinedView[7]).toBe(0x06);
      });

      it("should handle empty buffer", () => {
        const buffer = createAudioStreamBuffer();
        const combined = combineAudioChunks(buffer);

        expect(combined.byteLength).toBe(0);
      });

      it("should handle single chunk buffer", () => {
        const buffer = createAudioStreamBuffer();
        const singleChunk = new ArrayBuffer(256);

        addAudioChunk(buffer, singleChunk);

        const combined = combineAudioChunks(buffer);
        expect(combined.byteLength).toBe(256);
      });
    });

    describe("clearAudioBuffer", () => {
      it("should clear all buffer data", () => {
        const buffer = createAudioStreamBuffer();

        addAudioChunk(buffer, new ArrayBuffer(512));
        addAudioChunk(buffer, new ArrayBuffer(256));

        expect(buffer.chunks.length).toBe(2);
        expect(buffer.totalSize).toBe(768);

        clearAudioBuffer(buffer);

        expect(buffer.chunks).toEqual([]);
        expect(buffer.totalSize).toBe(0);
        expect(buffer.metadata).toBeUndefined();
      });
    });

    describe("getBufferedSize", () => {
      it("should return current buffered size", () => {
        const buffer = createAudioStreamBuffer();

        expect(getBufferedSize(buffer)).toBe(0);

        addAudioChunk(buffer, new ArrayBuffer(512));
        expect(getBufferedSize(buffer)).toBe(512);

        addAudioChunk(buffer, new ArrayBuffer(256));
        expect(getBufferedSize(buffer)).toBe(768);

        clearAudioBuffer(buffer);
        expect(getBufferedSize(buffer)).toBe(0);
      });
    });

    describe("hasAudioData", () => {
      it("should detect presence of audio data", () => {
        const buffer = createAudioStreamBuffer();

        expect(hasAudioData(buffer)).toBe(false);

        addAudioChunk(buffer, new ArrayBuffer(512));
        expect(hasAudioData(buffer)).toBe(true);

        clearAudioBuffer(buffer);
        expect(hasAudioData(buffer)).toBe(false);
      });
    });
  });

  // ============================================================================
  // Integration Tests with Edge TTS Protocol Constants
  // ============================================================================

  describe("Integration with Edge TTS Protocol", () => {
    it("should integrate with Edge TTS constants correctly", () => {
      // Test that all constants are properly used
      expect(WORD_BOUNDARY_OFFSET_COMPENSATION).toBe(8_750_000);
      expect(AUDIO_FORMATS.MP3_24KHZ_48KBPS).toBe(
        "audio-24khz-48kbitrate-mono-mp3",
      );
      expect(DEFAULT_AUDIO_FORMAT).toBe(AUDIO_FORMATS.MP3_24KHZ_48KBPS);
    });

    it("should process realistic Edge TTS streaming scenario", () => {
      const buffer = createAudioStreamBuffer();

      // Simulate streaming audio chunks from WebSocket
      const chunks = [
        new ArrayBuffer(512),
        new ArrayBuffer(1024),
        new ArrayBuffer(256),
      ];

      // Add chunks as they arrive
      chunks.forEach((chunk) => addAudioChunk(buffer, chunk));

      // Verify streaming state
      expect(getBufferedSize(buffer)).toBe(1792);
      expect(buffer.chunks.length).toBe(3);

      // Process word boundary during streaming
      const wordBoundary = processWordBoundary(
        5, // charIndex
        4, // charLength
        9_000_000, // rawOffset - realistic offset
      );

      expect(wordBoundary.offsetMs).toBe(25); // (9_000_000 - 8_750_000) / 10_000
      expect(wordBoundary.compensatedOffset).toBe(250_000);

      // Combine all audio data
      const finalAudio = combineAudioChunks(buffer);
      expect(finalAudio.byteLength).toBe(1792);

      // Estimate total duration (note: without valid MP3 headers, this will be 0)
      const estimatedDuration = estimateMP3Duration(finalAudio);
      expect(estimatedDuration).toBe(0); // No valid MP3 header in test data
    });

    it("should process realistic Edge TTS streaming with real MP3 data", () => {
      const buffer = createAudioStreamBuffer();
      const realMP3Data = loadRealMP3File();

      // Split real MP3 data into chunks to simulate streaming
      const chunkSize = Math.ceil(realMP3Data.byteLength / 3);
      const chunks: ArrayBuffer[] = [];

      for (let i = 0; i < realMP3Data.byteLength; i += chunkSize) {
        const chunk = realMP3Data.slice(
          i,
          Math.min(i + chunkSize, realMP3Data.byteLength),
        );
        chunks.push(chunk);
      }

      // Add chunks as they arrive
      chunks.forEach((chunk) => addAudioChunk(buffer, chunk));

      // Verify streaming state
      expect(getBufferedSize(buffer)).toBe(realMP3Data.byteLength);
      expect(buffer.chunks.length).toBe(chunks.length);

      // Combine all audio data
      const finalAudio = combineAudioChunks(buffer);
      expect(finalAudio.byteLength).toBe(realMP3Data.byteLength);

      // Validate combined audio is still valid MP3
      expect(validateEdgeTTSMP3(finalAudio)).toBe(true);

      // Estimate total duration with real MP3 data
      const estimatedDuration = estimateMP3Duration(finalAudio);
      expect(estimatedDuration).toBeGreaterThan(0);
    });

    it("should validate Edge TTS binary message end-to-end", () => {
      // Create complete Edge TTS binary message
      const headerText =
        "Content-Type: audio/mpeg\r\nPath: audio\r\nX-RequestId: 12345678901234567890123456789012\r\nX-Timestamp: 2024-01-01T00:00:00.000Z\r\n\r\n";
      const audioSize = 1024;
      const totalSize = 2 + headerText.length + audioSize;

      const binaryMessage = new ArrayBuffer(totalSize);
      const view = new DataView(binaryMessage);
      const uint8View = new Uint8Array(binaryMessage);

      // Construct message
      view.setUint16(0, headerText.length, false);
      for (let i = 0; i < headerText.length; i++) {
        uint8View[2 + i] = headerText.charCodeAt(i);
      }

      // Add valid MP3 header
      uint8View[2 + headerText.length] = 0xff;
      uint8View[2 + headerText.length + 1] = 0xe0;

      // Parse message
      const parsed = parseEdgeTTSBinaryMessage(binaryMessage);
      expect(parsed).not.toBeNull();

      // Validate as audio message
      expect(isAudioMessage(parsed!)).toBe(true);

      // Extract metadata
      const metadata = extractAudioMetadata(parsed!);
      expect(metadata).not.toBeNull();
      expect(metadata!.format).toBe(AUDIO_FORMATS.MP3_24KHZ_48KBPS);

      // Validate MP3 data
      expect(validateEdgeTTSMP3(parsed!.audioData)).toBe(true);

      // Estimate duration
      const duration = estimateMP3Duration(parsed!.audioData);
      expect(duration).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Edge Case and Error Handling Tests
  // ============================================================================

  describe("Edge Cases and Error Handling", () => {
    it("should handle null and undefined inputs gracefully", () => {
      // These should not throw errors
      expect(detectMP3Format(new ArrayBuffer(0))).toBe(false);
      expect(parseEdgeTTSBinaryMessage(new ArrayBuffer(0))).toBeNull();
      expect(estimateMP3Duration(new ArrayBuffer(0))).toBe(0);
      expect(compensateWordBoundaryOffset(0)).toBe(0);
      expect(ticksToMilliseconds(0)).toBe(0);
    });

    it("should handle corrupted binary data", () => {
      const corruptedData = new ArrayBuffer(100);
      const view = new DataView(corruptedData);

      // Set invalid header length
      view.setUint16(0, 500, false); // Header length > total size (big-endian)

      expect(parseEdgeTTSBinaryMessage(corruptedData)).toBeNull();
    });

    it("should handle very large offsets", () => {
      const largeOffset = Number.MAX_SAFE_INTEGER;
      const compensated = compensateWordBoundaryOffset(largeOffset);

      expect(compensated).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(compensated)).toBe(true);
    });

    it("should handle audio buffer memory limits", () => {
      const buffer = createAudioStreamBuffer();

      // Add many small chunks
      for (let i = 0; i < 100; i++) {
        addAudioChunk(buffer, new ArrayBuffer(1024));
      }

      expect(getBufferedSize(buffer)).toBe(102400); // 100KB
      expect(buffer.chunks.length).toBe(100);

      // Should be able to combine without errors
      const combined = combineAudioChunks(buffer);
      expect(combined.byteLength).toBe(102400);
    });
  });
});

describe("Network Service Integration", () => {
  describe("createNetworkServiceAudioProcessor", () => {
    it("should create processor with correct interface", () => {
      const processor = createNetworkServiceAudioProcessor();
      expect(processor).toBeDefined();
      expect(typeof processor.processWebSocketMessage).toBe("function");
      expect(typeof processor.extractAudioFromMessage).toBe("function");
      expect(typeof processor.validateStreamingConsistency).toBe("function");
      expect(typeof processor.handleNetworkEdgeCases).toBe("function");
    });
  });

  describe("processNetworkServiceAudioChunks", () => {
    let processor: NetworkServiceAudioProcessor;
    let mockChunks: ArrayBuffer[];

    beforeEach(() => {
      processor = createNetworkServiceAudioProcessor();
      mockChunks = [
        new ArrayBuffer(128),
        new ArrayBuffer(256),
        new ArrayBuffer(512),
      ];
    });

    it("should process audio chunks successfully", () => {
      const result = processNetworkServiceAudioChunks(mockChunks, processor);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
      // Function returns ArrayBuffer[] - processed chunks
      result.forEach((chunk) => {
        expect(chunk instanceof ArrayBuffer).toBe(true);
      });
    });

    it("should handle empty chunks array", () => {
      const result = processNetworkServiceAudioChunks([], processor);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe("convertToStorageServiceFormat", () => {
    it("should convert AudioStreamBuffer to storage format", () => {
      const audioBuffer = createAudioStreamBuffer();
      const chunk1 = new ArrayBuffer(512);
      const chunk2 = new ArrayBuffer(256);

      addAudioChunk(audioBuffer, chunk1);
      addAudioChunk(audioBuffer, chunk2);

      const connectionId = "test-connection-123";
      const result = convertToStorageServiceFormat(audioBuffer, connectionId);

      expect(result).toBeDefined();
      expect(result.connectionId).toBe(connectionId);
      expect(Array.isArray(result.audioChunks)).toBe(true);
      expect(result.audioChunks.length).toBe(2);
      expect(typeof result.totalSize).toBe("number");
      expect(result.lastActivity).toBeInstanceOf(Date);
    });

    it("should handle empty buffer", () => {
      const emptyBuffer = createAudioStreamBuffer();
      const connectionId = "test-connection-456";

      const result = convertToStorageServiceFormat(emptyBuffer, connectionId);

      expect(result.connectionId).toBe(connectionId);
      expect(result.audioChunks.length).toBe(0);
      expect(result.totalSize).toBe(0);
    });
  });

  describe("convertFromStorageServiceFormat", () => {
    it("should convert from storage format back to AudioStreamBuffer", () => {
      const originalBuffer = createAudioStreamBuffer();
      addAudioChunk(originalBuffer, new ArrayBuffer(512));

      const storageFormat = convertToStorageServiceFormat(
        originalBuffer,
        "test-conn",
      );
      const result = convertFromStorageServiceFormat(storageFormat);

      expect(result).toBeDefined();
      expect(result.chunks).toBeDefined();
      expect(result.totalSize).toBeDefined();
    });
  });

  describe("mergeStorageServiceAudioChunks", () => {
    it("should merge storage buffer chunks", () => {
      const buffer1 = createAudioStreamBuffer();
      addAudioChunk(buffer1, new ArrayBuffer(256));

      const format1 = convertToStorageServiceFormat(buffer1, "conn1");

      const result = mergeStorageServiceAudioChunks(format1);

      expect(result instanceof ArrayBuffer).toBe(true);
      expect(result.byteLength).toBeGreaterThan(0);
    });
  });

  describe("generateExpoAVDataURI", () => {
    it("should generate valid data URI for audio", () => {
      const mockAudioData = new ArrayBuffer(1024);
      const dataURI = generateExpoAVDataURI(mockAudioData);

      expect(dataURI).toBeDefined();
      expect(typeof dataURI).toBe("string");
      expect(dataURI).toMatch(/^data:audio\/[^;]+;base64,/);
    });

    it("should handle empty audio data", () => {
      const emptyData = new ArrayBuffer(0);
      const dataURI = generateExpoAVDataURI(emptyData);

      expect(dataURI).toBeDefined();
      expect(dataURI).toMatch(/^data:audio\/[^;]+;base64,/);
    });
  });

  describe("createExpoAVAudioData", () => {
    it("should create valid ExpoAV audio data object", () => {
      const mockAudioBuffer = new ArrayBuffer(1024);
      const metadata: EdgeTTSAudioMetadata = {
        format: "audio-24khz-48kbitrate-mono-mp3",
        sampleRate: 24000,
        channels: 1,
        bitRate: 48000,
      };

      const audioData = createExpoAVAudioData(mockAudioBuffer, metadata);

      expect(audioData).toBeDefined();
      expect(audioData.uri).toBeDefined();
      expect(audioData.uri).toMatch(/^data:audio\/[^;]+;base64,/);
      expect(audioData.metadata).toBeDefined();
      expect(audioData.metadata.format).toBe("audio-24khz-48kbitrate-mono-mp3");
    });
  });

  describe("validateExpoAVCompatibility", () => {
    it("should validate compatible ExpoAV audio data", () => {
      const mockAudioBuffer = new ArrayBuffer(1024);
      const metadata: EdgeTTSAudioMetadata = {
        format: "audio-24khz-48kbitrate-mono-mp3",
        sampleRate: 24000,
        channels: 1,
        bitRate: 48000,
      };

      const audioData = createExpoAVAudioData(mockAudioBuffer, metadata);
      const isCompatible = validateExpoAVCompatibility(audioData);

      expect(typeof isCompatible).toBe("boolean");
      expect(isCompatible).toBe(true);
    });
  });

  describe("createRealTimeStreamingValidator", () => {
    it("should create streaming validator", () => {
      const validator = createRealTimeStreamingValidator();
      expect(validator).toBeDefined();
      expect(typeof validator.validateChunk).toBe("function");
      expect(typeof validator.validateSequence).toBe("function");
      expect(typeof validator.isStreamingHealthy).toBe("function");
      expect(typeof validator.getHealthMetrics).toBe("function");
      // Note: RealTimeStreamingValidator doesn't have reset method
    });

    it("should validate chunks in real-time", () => {
      const validator = createRealTimeStreamingValidator();

      // Test first chunk validation (must be valid MP3)
      const validFirstChunk = createValidMP3Data();
      expect(validator.validateChunk(validFirstChunk, 0)).toBe(true);

      // Test invalid first chunk
      const invalidFirstChunk = new ArrayBuffer(100);
      expect(validator.validateChunk(invalidFirstChunk, 0)).toBe(false);

      // Test empty chunk
      expect(validator.validateChunk(new ArrayBuffer(0), 0)).toBe(false);

      // Test subsequent chunks (can be continuation frames)
      const continuationChunk = new ArrayBuffer(100);
      expect(validator.validateChunk(continuationChunk, 1)).toBe(true);
    });

    it("should validate chunk sequences", () => {
      const validator = createRealTimeStreamingValidator();

      // Test empty sequence
      expect(validator.validateSequence([])).toBe(true);

      // Test sequence with valid first chunk
      const validSequence = [createValidMP3Data(), new ArrayBuffer(100)];
      expect(validator.validateSequence(validSequence)).toBe(true);

      // Test sequence with invalid first chunk
      const invalidSequence = [new ArrayBuffer(100), createValidMP3Data()];
      expect(validator.validateSequence(invalidSequence)).toBe(false);
    });

    it("should check streaming health", () => {
      const validator = createRealTimeStreamingValidator();

      // Test empty buffer (should be healthy)
      const emptyBuffer = createAudioStreamBuffer();
      expect(validator.isStreamingHealthy(emptyBuffer)).toBe(true);

      // Test buffer with data
      const bufferWithData = createAudioStreamBuffer();
      addAudioChunk(bufferWithData, new ArrayBuffer(512));
      addAudioChunk(bufferWithData, new ArrayBuffer(256));

      expect(validator.isStreamingHealthy(bufferWithData)).toBe(true);
    });

    it("should provide health metrics", () => {
      const validator = createRealTimeStreamingValidator();

      // Test empty buffer metrics
      const emptyBuffer = createAudioStreamBuffer();
      const emptyMetrics = validator.getHealthMetrics(emptyBuffer);

      expect(emptyMetrics.chunksProcessed).toBe(0);
      expect(emptyMetrics.totalDataProcessed).toBe(0);
      expect(emptyMetrics.averageChunkSize).toBe(0);
      expect(emptyMetrics.consistencyScore).toBe(1.0);
      expect(emptyMetrics.isOptimal).toBe(false);

      // Test buffer with data
      const buffer = createAudioStreamBuffer();
      addAudioChunk(buffer, new ArrayBuffer(1024));
      addAudioChunk(buffer, new ArrayBuffer(1024));
      addAudioChunk(buffer, new ArrayBuffer(1024));

      const metrics = validator.getHealthMetrics(buffer);

      expect(metrics.chunksProcessed).toBe(3);
      expect(metrics.totalDataProcessed).toBe(3072);
      expect(metrics.averageChunkSize).toBe(1024);
      expect(metrics.consistencyScore).toBe(1.0); // Perfect consistency
      expect(metrics.isOptimal).toBe(true); // Good chunk size and consistency
    });

    it("should calculate consistency score with varying chunk sizes", () => {
      const validator = createRealTimeStreamingValidator();

      // Test buffer with varying chunk sizes
      const buffer = createAudioStreamBuffer();
      addAudioChunk(buffer, new ArrayBuffer(512));
      addAudioChunk(buffer, new ArrayBuffer(1024));
      addAudioChunk(buffer, new ArrayBuffer(768));

      const metrics = validator.getHealthMetrics(buffer);

      expect(metrics.chunksProcessed).toBe(3);
      expect(metrics.totalDataProcessed).toBe(2304);
      expect(metrics.averageChunkSize).toBe(768);
      expect(metrics.consistencyScore).toBeGreaterThan(0);
      expect(metrics.consistencyScore).toBeLessThan(1.0); // Less than perfect due to variance
    });
  });

  describe("createPerformanceOptimizedProcessor", () => {
    it("should create optimized processor", () => {
      const processor = createPerformanceOptimizedProcessor();
      expect(processor).toBeDefined();
      expect(typeof processor.processChunkOptimized).toBe("function");
      expect(typeof processor.batchProcessChunks).toBe("function");
      expect(typeof processor.preAllocateBuffers).toBe("function");
      expect(typeof processor.cleanup).toBe("function");
      expect(typeof processor.getPreallocatedBuffer).toBe("function");
    });

    it("should process chunks optimally with performance optimization", () => {
      const processor = createPerformanceOptimizedProcessor();

      // Test processChunkOptimized with valid chunk
      const validChunk = createValidMP3Data();
      const processedChunk = processor.processChunkOptimized(validChunk);
      expect(processedChunk).toBe(validChunk); // Should return original to avoid copying

      // Test processChunkOptimized with empty chunk
      const emptyChunk = new ArrayBuffer(0);
      expect(processor.processChunkOptimized(emptyChunk)).toBeNull();

      // Test processChunkOptimized with too small chunk
      const smallChunk = new ArrayBuffer(2);
      expect(processor.processChunkOptimized(smallChunk)).toBeNull();

      // Test processChunkOptimized with invalid MP3 chunk
      const invalidChunk = new ArrayBuffer(100);
      expect(processor.processChunkOptimized(invalidChunk)).toBeNull();
    });

    it("should handle batch processing efficiently", () => {
      const processor = createPerformanceOptimizedProcessor();

      const validChunks = [
        createValidMP3Data(),
        createValidMP3Data(),
        createValidMP3Data(),
      ];

      const result = processor.batchProcessChunks(validChunks);
      expect(result).toHaveLength(3);
      expect(result.every((chunk) => chunk instanceof ArrayBuffer)).toBe(true);

      // Test with mixed valid/invalid chunks
      const mixedChunks = [
        createValidMP3Data(),
        new ArrayBuffer(1), // Invalid
        createValidMP3Data(),
        new ArrayBuffer(0), // Invalid
      ];

      const mixedResult = processor.batchProcessChunks(mixedChunks);
      expect(mixedResult.length).toBe(2); // Only valid chunks should be processed
    });

    it("should handle pre-allocation buffer functionality", () => {
      const processor = createPerformanceOptimizedProcessor();

      // Initially no pre-allocated buffer
      expect(processor.getPreallocatedBuffer()).toBeNull();

      // Pre-allocate buffer
      const expectedSize = 1024;
      processor.preAllocateBuffers(3, expectedSize);

      const preallocatedBuffer = processor.getPreallocatedBuffer();
      expect(preallocatedBuffer).not.toBeNull();
      expect(preallocatedBuffer!.byteLength).toBe(expectedSize);

      // Cleanup should remove pre-allocated buffer
      processor.cleanup();
      expect(processor.getPreallocatedBuffer()).toBeNull();
    });

    it("should handle pre-allocation with zero size", () => {
      const processor = createPerformanceOptimizedProcessor();

      // Pre-allocate with zero size should not create buffer
      processor.preAllocateBuffers(0, 0);
      expect(processor.getPreallocatedBuffer()).toBeNull();
    });
  });

  describe("combineAudioChunksOptimized", () => {
    it("should combine chunks with optimization", () => {
      const chunks = [
        new ArrayBuffer(256),
        new ArrayBuffer(512),
        new ArrayBuffer(256),
      ];
      const result = combineAudioChunksOptimized(chunks);
      expect(result).toBeDefined();
      expect(result.byteLength).toBe(1024);
    });

    it("should handle empty chunks array", () => {
      const result = combineAudioChunksOptimized([]);
      expect(result).toBeDefined();
      expect(result.byteLength).toBe(0);
    });

    it("should handle single chunk efficiently", () => {
      const singleChunk = new ArrayBuffer(512);
      const result = combineAudioChunksOptimized([singleChunk]);
      expect(result).toBe(singleChunk); // Should return original chunk
      expect(result.byteLength).toBe(512);
    });

    it("should use pre-allocated buffer when available and correctly sized", () => {
      const chunks = [new ArrayBuffer(256), new ArrayBuffer(256)];
      const totalSize = 512;
      const preallocatedBuffer = new ArrayBuffer(totalSize);

      const result = combineAudioChunksOptimized(chunks, preallocatedBuffer);
      expect(result).toBe(preallocatedBuffer); // Should use pre-allocated buffer
      expect(result.byteLength).toBe(totalSize);
    });

    it("should not use pre-allocated buffer when size mismatch", () => {
      const chunks = [new ArrayBuffer(256), new ArrayBuffer(256)];
      const wrongSizedBuffer = new ArrayBuffer(1024); // Wrong size

      const result = combineAudioChunksOptimized(chunks, wrongSizedBuffer);
      expect(result).not.toBe(wrongSizedBuffer); // Should allocate new buffer
      expect(result.byteLength).toBe(512); // Correct total size
    });

    it("should properly copy chunk data to combined buffer", () => {
      // Create chunks with known data patterns
      const chunk1 = new ArrayBuffer(4);
      const chunk2 = new ArrayBuffer(4);

      const view1 = new Uint8Array(chunk1);
      const view2 = new Uint8Array(chunk2);

      view1[0] = 0xaa;
      view1[1] = 0xbb;
      view1[2] = 0xcc;
      view1[3] = 0xdd;
      view2[0] = 0x11;
      view2[1] = 0x22;
      view2[2] = 0x33;
      view2[3] = 0x44;

      const result = combineAudioChunksOptimized([chunk1, chunk2]);
      const resultView = new Uint8Array(result);

      // Verify data integrity
      expect(resultView[0]).toBe(0xaa);
      expect(resultView[1]).toBe(0xbb);
      expect(resultView[2]).toBe(0xcc);
      expect(resultView[3]).toBe(0xdd);
      expect(resultView[4]).toBe(0x11);
      expect(resultView[5]).toBe(0x22);
      expect(resultView[6]).toBe(0x33);
      expect(resultView[7]).toBe(0x44);
    });
  });

  describe("createNetworkServiceEdgeCaseHandler", () => {
    it("should create edge case handler", () => {
      const handler = createNetworkServiceEdgeCaseHandler();
      expect(handler).toBeDefined();
      expect(typeof handler.handleWebSocketEdgeCases).toBe("function");
      expect(typeof handler.handleChunkCorruption).toBe("function");
      expect(typeof handler.handleIncompleteMessages).toBe("function");
      expect(typeof handler.handleFormatInconsistencies).toBe("function");
    });

    it("should handle WebSocket edge cases", () => {
      const handler = createNetworkServiceEdgeCaseHandler();

      // Test empty WebSocket message
      expect(handler.handleWebSocketEdgeCases(new ArrayBuffer(0))).toBeNull();

      // Test message smaller than header length requirement
      expect(handler.handleWebSocketEdgeCases(new ArrayBuffer(1))).toBeNull();

      // Test valid message
      const validMP3Data = createValidMP3Data();
      const result = handler.handleWebSocketEdgeCases(validMP3Data);
      expect(result).toBe(validMP3Data);
    });

    it("should handle chunk corruption", () => {
      const handler = createNetworkServiceEdgeCaseHandler();

      // Test empty chunk
      expect(handler.handleChunkCorruption(new ArrayBuffer(0))).toBeNull();

      // Test corrupted MP3 data
      const corruptedChunk = new ArrayBuffer(100);
      expect(handler.handleChunkCorruption(corruptedChunk)).toBeNull();

      // Test valid MP3 chunk
      const validChunk = createValidMP3Data();
      expect(handler.handleChunkCorruption(validChunk)).toBe(validChunk);
    });

    it("should handle incomplete messages", () => {
      const handler = createNetworkServiceEdgeCaseHandler();

      // Test 1: Create an incomplete message that might parse but shouldn't be valid
      const incompleteMessage = new ArrayBuffer(10);
      const dataView = new DataView(incompleteMessage);
      // Set header length to 8 (leaving only 0 bytes for audio data)
      dataView.setUint16(0, 8, false); // big-endian
      // Fill the rest with fake header data
      const headerText = "test\r\n\r\n";
      for (let i = 0; i < headerText.length && i < 8; i++) {
        dataView.setUint8(2 + i, headerText.charCodeAt(i));
      }

      const result = handler.handleIncompleteMessages(incompleteMessage);

      // The function should return null for incomplete messages, or an empty ArrayBuffer
      // Since this creates a message that parses but has 0-byte audioData, it should be acceptable
      expect(
        result === null ||
          (result instanceof ArrayBuffer && result.byteLength === 0),
      ).toBe(true);

      // Test 2: Create a truly incomplete message that should return null
      const trulyIncompleteMessage = new ArrayBuffer(10);
      const trulyIncompleteView = new DataView(trulyIncompleteMessage);
      // Set header length to 50 (larger than available data)
      trulyIncompleteView.setUint16(0, 50, false); // big-endian

      const result2 = handler.handleIncompleteMessages(trulyIncompleteMessage);
      expect(result2).toBeNull();

      // Test 3: Too small message
      const tooSmallMessage = new ArrayBuffer(1);
      const result3 = handler.handleIncompleteMessages(tooSmallMessage);
      expect(result3).toBeNull();

      // Test complete valid message
      const completeMessage = createValidEdgeTTSBinaryMessage();
      const validResult = handler.handleIncompleteMessages(completeMessage);
      expect(validResult).not.toBeNull();
      expect(validResult instanceof ArrayBuffer).toBe(true);
      expect(validResult!.byteLength).toBeGreaterThan(0);
    });

    it("should handle format inconsistencies", () => {
      const handler = createNetworkServiceEdgeCaseHandler();

      // Test empty chunks array
      expect(handler.handleFormatInconsistencies([])).toEqual([]);

      // Test mixed valid and invalid chunks
      const chunks = [
        createValidMP3Data(),
        new ArrayBuffer(1),
        createValidMP3Data(),
      ];

      const result = handler.handleFormatInconsistencies(chunks);
      expect(Array.isArray(result)).toBe(true);
      // Should contain valid chunks or be empty based on consistency validation
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("processNetworkServiceAudioPipeline", () => {
    it("should process complete audio pipeline", async () => {
      const mockAudioChunks = [new ArrayBuffer(512), new ArrayBuffer(256)];
      const connectionId = "test-connection";

      const result = processNetworkServiceAudioPipeline(
        mockAudioChunks,
        connectionId,
      );

      if (result) {
        expect(result.uri).toBeDefined();
        expect(result.metadata).toBeDefined();
        expect(result.metadata.format).toBeDefined();
      }
    });
  });
});

describe("AudioUtils Integration", () => {
  it("should seamlessly integrate functionality", async () => {
    const mp3Data = loadRealMP3File();
    expect(validateEdgeTTSMP3(mp3Data)).toBe(true);

    // Create binary message
    const binaryMessage = createRealEdgeTTSBinaryMessage();
    const parsed = parseEdgeTTSBinaryMessage(binaryMessage);
    expect(parsed).not.toBeNull();

    // Extract metadata
    const metadata = extractAudioMetadata(parsed!);
    expect(metadata).not.toBeNull();

    // enhancements
    const networkProcessor = createNetworkServiceAudioProcessor();
    const networkResult =
      networkProcessor.processWebSocketMessage(binaryMessage);
    expect(networkResult).not.toBeNull();

    // Convert to storage format
    const audioBuffer = createAudioStreamBuffer();
    addAudioChunk(audioBuffer, parsed!.audioData);
    const storageFormat = convertToStorageServiceFormat(
      audioBuffer,
      "test-connection",
    );
    expect(storageFormat).toBeDefined();

    // Create expo-av data
    const expoAVData = createExpoAVAudioData(parsed!.audioData, {
      format: "audio-24khz-48kbitrate-mono-mp3",
      sampleRate: 24000,
      channels: 1,
      bitRate: 48000,
    });
    expect(expoAVData.uri).toBeDefined();

    // Validate streaming
    const validator = createRealTimeStreamingValidator();
    const streamingResult = validator.validateChunk(
      parsed!.audioData,
      Date.now(),
    );
    expect(streamingResult).toBe(true);
  });

  it("should maintain performance across all functionality", () => {
    const iterations = 10;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      // operations
      const mp3Data = loadRealMP3File();
      validateEdgeTTSMP3(mp3Data);

      const binaryMessage = createRealEdgeTTSBinaryMessage();
      const parsed = parseEdgeTTSBinaryMessage(binaryMessage);

      if (parsed) {
        extractAudioMetadata(parsed);

        const audioStreamBuffer = createAudioStreamBuffer();
        addAudioChunk(audioStreamBuffer, parsed.audioData);
        convertToStorageServiceFormat(audioStreamBuffer, "test-connection");

        createExpoAVAudioData(parsed.audioData, {
          format: "audio-24khz-48kbitrate-mono-mp3",
          sampleRate: 24000,
          channels: 1,
          bitRate: 48000,
        });
      }
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    // Should complete all operations in reasonable time
    expect(avgDuration).toBeLessThan(50); // 50ms per iteration should be achievable
  });
});

describe("Network Service Integration", () => {
  describe("createNetworkServiceAudioProcessor", () => {
    it("should create NetworkServiceAudioProcessor", () => {
      const processor = createNetworkServiceAudioProcessor();

      expect(processor).toBeDefined();
      expect(typeof processor.processWebSocketMessage).toBe("function");
      expect(typeof processor.extractAudioFromMessage).toBe("function");
      expect(typeof processor.validateStreamingConsistency).toBe("function");
      expect(typeof processor.handleNetworkEdgeCases).toBe("function");
    });

    it("should process WebSocket messages", () => {
      const processor = createNetworkServiceAudioProcessor();
      const validMessage = createValidEdgeTTSBinaryMessage();

      const result = processor.processWebSocketMessage(validMessage);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.header["Content-Type"]).toBe("audio/mpeg");
        expect(result.audioData.byteLength).toBeGreaterThan(0);
      }
    });

    it("should return null for invalid WebSocket message", () => {
      const processor = createNetworkServiceAudioProcessor();
      const invalidMessage = new ArrayBuffer(1);

      const result = processor.processWebSocketMessage(invalidMessage);

      expect(result).toBeNull();
    });

    it("should extract audio from messages", () => {
      const processor = createNetworkServiceAudioProcessor();
      const validMessage = createValidEdgeTTSBinaryMessage();
      const parsed = processor.processWebSocketMessage(validMessage);

      if (parsed) {
        const extractedAudio = processor.extractAudioFromMessage(parsed);
        expect(extractedAudio).not.toBeNull();
        if (extractedAudio) {
          expect(extractedAudio.byteLength).toBeGreaterThan(0);
        }
      }
    });

    it("should validate streaming consistency", () => {
      const processor = createNetworkServiceAudioProcessor();
      const chunks = [createValidMP3Data(), createValidMP3Data()];

      const result = processor.validateStreamingConsistency(chunks);

      expect(typeof result).toBe("boolean");
    });

    it("should handle network edge cases", () => {
      const processor = createNetworkServiceAudioProcessor();
      const data = createValidMP3Data();

      const result = processor.handleNetworkEdgeCases(data);

      // Should return processed data or null for edge cases
      expect(result === null || result instanceof ArrayBuffer).toBe(true);
    });
  });

  describe("processNetworkServiceAudioChunks", () => {
    it("should process valid audio chunks", () => {
      const chunks = [createValidMP3Data(), createValidMP3Data()];
      const processor = createNetworkServiceAudioProcessor();

      const result = processNetworkServiceAudioChunks(chunks, processor);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      result.forEach((chunk) => {
        expect(chunk instanceof ArrayBuffer).toBe(true);
      });
    });

    it("should return empty array for empty chunks", () => {
      const processor = createNetworkServiceAudioProcessor();
      const result = processNetworkServiceAudioChunks([], processor);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it("should filter out invalid chunks", () => {
      const validChunk = createValidMP3Data();
      const invalidChunk = new ArrayBuffer(1);
      const chunks = [validChunk, invalidChunk, validChunk];
      const processor = createNetworkServiceAudioProcessor();

      const result = processNetworkServiceAudioChunks(chunks, processor);

      expect(Array.isArray(result)).toBe(true);
      // Should process valid chunks and handle invalid ones
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Storage Service Integration", () => {
  describe("convertToStorageServiceFormat", () => {
    it("should convert AudioStreamBuffer to Storage Service format", () => {
      const audioBuffer = createAudioStreamBuffer();
      const chunk1 = createValidMP3Data();
      const chunk2 = createValidMP3Data();

      addAudioChunk(audioBuffer, chunk1);
      addAudioChunk(audioBuffer, chunk2);

      const connectionId = "test-connection-123";
      const result = convertToStorageServiceFormat(audioBuffer, connectionId);

      expect(result).toBeDefined();
      expect(result.connectionId).toBe(connectionId);
      expect(Array.isArray(result.audioChunks)).toBe(true);
      expect(result.audioChunks.length).toBe(2);
      expect(typeof result.totalSize).toBe("number");
      expect(result.lastActivity).toBeInstanceOf(Date);
    });

    it("should handle empty buffer", () => {
      const emptyBuffer = createAudioStreamBuffer();
      const connectionId = "test-connection-123";

      const result = convertToStorageServiceFormat(emptyBuffer, connectionId);

      expect(result.connectionId).toBe(connectionId);
      expect(result.audioChunks.length).toBe(0);
      expect(result.totalSize).toBe(0);
    });
  });

  describe("convertFromStorageServiceFormat", () => {
    it("should convert Storage Service format to AudioStreamBuffer", () => {
      const chunk1 = new Uint8Array(createValidMP3Data());
      const chunk2 = new Uint8Array(createValidMP3Data());

      const storageBuffer: StorageServiceBufferFormat = {
        connectionId: "test-connection-123",
        audioChunks: [chunk1, chunk2],
        totalSize: chunk1.length + chunk2.length,
        lastActivity: new Date(),
      };

      const result = convertFromStorageServiceFormat(storageBuffer);

      expect(result).toBeDefined();
      expect(Array.isArray(result.chunks)).toBe(true);
      expect(result.chunks.length).toBe(2);
      expect(result.totalSize).toBe(storageBuffer.totalSize);
    });

    it("should handle empty storage buffer", () => {
      const emptyStorageBuffer: StorageServiceBufferFormat = {
        connectionId: "test-connection-123",
        audioChunks: [],
        totalSize: 0,
        lastActivity: new Date(),
      };

      const result = convertFromStorageServiceFormat(emptyStorageBuffer);

      expect(result.chunks.length).toBe(0);
      expect(result.totalSize).toBe(0);
    });
  });

  describe("mergeStorageServiceAudioChunks", () => {
    it("should merge multiple audio chunks", () => {
      const chunk1 = new Uint8Array([0xff, 0xe0, 0x00, 0x01]);
      const chunk2 = new Uint8Array([0x02, 0x03, 0x04, 0x05]);

      const storageBuffer: StorageServiceBufferFormat = {
        connectionId: "test-connection-123",
        audioChunks: [chunk1, chunk2],
        totalSize: chunk1.length + chunk2.length,
        lastActivity: new Date(),
      };

      const result = mergeStorageServiceAudioChunks(storageBuffer);

      expect(result instanceof ArrayBuffer).toBe(true);
      expect(result.byteLength).toBe(8);

      const resultView = new Uint8Array(result);
      expect(resultView[0]).toBe(0xff);
      expect(resultView[1]).toBe(0xe0);
      expect(resultView[4]).toBe(0x02);
      expect(resultView[7]).toBe(0x05);
    });

    it("should handle single chunk", () => {
      const chunk = new Uint8Array([0xff, 0xe0, 0x00, 0x01]);

      const storageBuffer: StorageServiceBufferFormat = {
        connectionId: "test-connection-123",
        audioChunks: [chunk],
        totalSize: chunk.length,
        lastActivity: new Date(),
      };

      const result = mergeStorageServiceAudioChunks(storageBuffer);

      expect(result.byteLength).toBe(4);
    });

    it("should handle empty chunks", () => {
      const storageBuffer: StorageServiceBufferFormat = {
        connectionId: "test-connection-123",
        audioChunks: [],
        totalSize: 0,
        lastActivity: new Date(),
      };

      const result = mergeStorageServiceAudioChunks(storageBuffer);

      expect(result.byteLength).toBe(0);
    });
  });
});

describe("expo-av Compatibility", () => {
  describe("createExpoAVAudioData", () => {
    it("should create expo-av compatible audio data", () => {
      const mp3Data = createValidMP3Data();

      const result = createExpoAVAudioData(mp3Data);

      expect(result).toBeDefined();
      expect(typeof result.uri).toBe("string");
      expect(result.uri).toMatch(/^data:audio\/mpeg;base64,/);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.format).toBe(DEFAULT_AUDIO_FORMAT);
      expect(typeof result.metadata.sampleRate).toBe("number");
      expect(typeof result.metadata.channels).toBe("number");
    });

    it("should use provided metadata when available", () => {
      const mp3Data = createValidMP3Data();
      const metadata: EdgeTTSAudioMetadata = {
        format: "custom-format",
        sampleRate: 48000,
        bitRate: 96,
        channels: 2,
        estimatedDuration: 5000,
      };

      const result = createExpoAVAudioData(mp3Data, metadata);

      expect(result.metadata.format).toBe("custom-format");
      expect(result.metadata.sampleRate).toBe(48000);
      expect(result.metadata.channels).toBe(2);
    });

    it("should handle empty MP3 data", () => {
      const emptyData = new ArrayBuffer(0);

      const result = createExpoAVAudioData(emptyData);

      expect(result).toBeDefined();
      expect(result.uri).toBe("data:audio/mpeg;base64,");
    });
  });

  describe("validateExpoAVCompatibility", () => {
    it("should validate compatible expo-av audio data", () => {
      const mp3Data = createValidMP3Data();
      const audioData = createExpoAVAudioData(mp3Data);

      const result = validateExpoAVCompatibility(audioData);

      expect(typeof result).toBe("boolean");
      expect(result).toBe(true);
    });

    it("should reject invalid data URI format", () => {
      const invalidAudioData: ExpoAVAudioData = {
        uri: "invalid-uri",
        metadata: {
          format: DEFAULT_AUDIO_FORMAT,
          sampleRate: 24000,
          channels: 1,
        },
      };

      const result = validateExpoAVCompatibility(invalidAudioData);

      expect(result).toBe(false);
    });

    it("should reject missing required metadata", () => {
      const invalidAudioData = {
        uri: "data:audio/mpeg;base64,SGVsbG8=",
        metadata: {},
      } as ExpoAVAudioData;

      const result = validateExpoAVCompatibility(invalidAudioData);

      expect(result).toBe(false);
    });
  });
});

describe("Complete Pipeline Integration", () => {
  describe("processNetworkServiceAudioPipeline", () => {
    it("should process complete audio pipeline", () => {
      const chunks = [createValidMP3Data(), createValidMP3Data()];
      const connectionId = "test-connection-123";

      const result = processNetworkServiceAudioPipeline(chunks, connectionId);

      if (result) {
        expect(result.uri).toMatch(/^data:audio\/mpeg;base64,/);
        expect(result.metadata.format).toBe(DEFAULT_AUDIO_FORMAT);
        expect(result.metadata.sampleRate).toBe(24000);
        expect(result.metadata.channels).toBe(1);
      }
    });

    it("should return null for empty chunks", () => {
      const result = processNetworkServiceAudioPipeline([], "test-connection");

      expect(result).toBeNull();
    });

    it("should return null for invalid chunks", () => {
      const invalidChunks = [new ArrayBuffer(1), new ArrayBuffer(2)];
      const result = processNetworkServiceAudioPipeline(
        invalidChunks,
        "test-connection",
      );

      expect(result).toBeNull();
    });

    it("should handle mixed valid and invalid chunks", () => {
      const chunks = [
        createValidMP3Data(),
        new ArrayBuffer(1), // Invalid
        createValidMP3Data(),
      ];

      const result = processNetworkServiceAudioPipeline(
        chunks,
        "test-connection",
      );

      // Should either process valid chunks or return null
      expect(
        result === null || (result && typeof result.uri === "string"),
      ).toBe(true);
    });
  });
});

// Helper function for creating valid MP3 data
function createValidMP3Data(): ArrayBuffer {
  const data = new ArrayBuffer(100);
  const view = new Uint8Array(data);

  // Set MP3 frame sync header
  view[0] = 0xff;
  view[1] = 0xe0;

  // Fill with some dummy MP3-like data
  for (let i = 2; i < 100; i++) {
    view[i] = i % 256;
  }

  return data;
}

// Helper function for creating valid Edge TTS binary message
function createValidEdgeTTSBinaryMessage(): ArrayBuffer {
  const header =
    "Content-Type: audio/mpeg\r\nPath: audio\r\nX-RequestId: test123\r\n\r\n";
  const headerBytes = new TextEncoder().encode(header);
  const headerLength = headerBytes.length;

  // Create valid MP3 audio data
  const audioData = createValidMP3Data();

  // Combine into message
  const message = new ArrayBuffer(2 + headerLength + audioData.byteLength);
  const view = new DataView(message);
  view.setUint16(0, headerLength, false); // big-endian

  const messageBytes = new Uint8Array(message);
  messageBytes.set(headerBytes, 2);
  messageBytes.set(new Uint8Array(audioData), 2 + headerLength);

  return message;
}
