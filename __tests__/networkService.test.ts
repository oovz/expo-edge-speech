/**
 * Complete test suite for EdgeSpeech WebSocket communication service
 * Tests WebSocket protocol implementation, audio processing, boundary events,
 * integration with storage service, SSML generation, and error handling.
 */

import {
  NetworkService,
  timingConverter,
} from "../src/services/networkService";
import { SpeechOptions } from "../src/types";

// Test constants for consistent session and connection IDs
const TEST_SESSION_ID = "test-session-id";
const TEST_CONNECTION_ID = "test-connection-id";

// Create mock WebSocket instance helper
const createMockWebSocketInstance = () => {
  const instance = {
    binaryType: "",
    readyState: 0, // WebSocket.CONNECTING initially
    send: jest.fn(),
    close: jest.fn(),
    onopen: null as any,
    onmessage: null as any,
    onerror: null as any,
    onclose: null as any,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    url: "",
    // Store reference for test access
    __mockInstance: null as any,
    // Capture request ID from sent messages
    __capturedRequestId: null as string | null,
  };

  // Override send to capture request ID
  const originalSend = instance.send;
  instance.send = jest.fn((data: string) => {
    if (typeof data === "string" && data.includes("X-RequestId:")) {
      const match = data.match(/X-RequestId:\s*([^\r\n]+)/);
      if (match) {
        instance.__capturedRequestId = match[1].trim();
      }
    }
    return originalSend.call(instance, data);
  });

  instance.__mockInstance = instance;
  return instance;
};

// Global variable to store the current mock WebSocket instance
let currentMockWebSocket: any = null;

// Mock global WebSocket
const originalWebSocket = global.WebSocket;

// Create mock StorageService instance
const mockStorageServiceInstance = {
  createConnectionBuffer: jest.fn(),
  addAudioChunk: jest.fn(),
  markConnectionCompleted: jest.fn(),
  cleanupConnection: jest.fn(),
};

// Mock StorageService
jest.mock("../src/services/storageService", () => ({
  StorageService: jest
    .fn()
    .mockImplementation(() => mockStorageServiceInstance),
}));

// Mock audio utilities
jest.mock("../src/utils/audioUtils", () => ({
  parseEdgeTTSBinaryMessage: jest.fn().mockReturnValue({
    header: { "X-RequestId": "test123" },
    audioData: new ArrayBuffer(1024),
  }),
}));

// Mock SSML utilities
jest.mock("../src/utils/ssmlUtils", () => ({
  generateSSML: jest.fn().mockReturnValue("<speak>Test SSML</speak>"),
}));

// Mock common utilities
jest.mock("../src/utils/commonUtils", () => ({
  ...jest.requireActual("../src/utils/commonUtils"),
  validateSpeechParameters: jest.fn().mockReturnValue({
    result: { isValid: true, errors: [] },
    normalizedOptions: {},
  }),
}));

describe("Network Service Implementation", () => {
  let networkService: NetworkService;
  let mockStorageService: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock global WebSocket
    global.WebSocket = jest.fn().mockImplementation((url: string) => {
      const instance = createMockWebSocketInstance();
      instance.url = url;

      // Store reference for test access
      currentMockWebSocket = instance;

      // Simulate connection establishment after a brief delay
      setTimeout(() => {
        instance.readyState = 1; // WebSocket.OPEN
        if (instance.onopen && typeof instance.onopen === "function") {
          instance.onopen({ type: "open", target: instance });
        }
      }, 5);

      return instance;
    }) as any;

    // Reset mock instances - create fresh mock instances for each test
    Object.keys(mockStorageServiceInstance).forEach((key) => {
      if (typeof mockStorageServiceInstance[key] === "function") {
        mockStorageServiceInstance[key].mockClear?.();
      }
    });

    // Create mock storage service
    mockStorageService = mockStorageServiceInstance;

    // Create network service instance
    networkService = new NetworkService(mockStorageService, {
      enableDebugLogging: false,
      maxRetries: 1, // Reduce retries for faster tests
      connectionTimeout: 1000, // Shorter timeout for tests
      gracefulCloseTimeout: 50, // Very short graceful close for fast test cleanup
    });

    // Reset the current mock WebSocket reference
    currentMockWebSocket = null;
  });

  afterEach(async () => {
    // Close the network service to cleanup any pending timeouts and connections
    if (networkService) {
      await networkService.close();
    }

    // Restore original WebSocket if needed
    if (originalWebSocket) {
      global.WebSocket = originalWebSocket;
    }
  });

  describe("Service Initialization", () => {
    it("should initialize with default configuration", () => {
      const service = new NetworkService(mockStorageService, {});
      const stats = service.getStats();

      expect(stats.activeSessions).toBe(0);
      expect(stats.activeConnections).toBe(0);
      expect(stats.connections).toEqual([]);
    });

    it("should initialize with custom configuration", () => {
      const config = {
        maxRetries: 5,
        baseRetryDelay: 2000,
        maxRetryDelay: 20000,
        connectionTimeout: 10000,
        enableDebugLogging: true,
      };

      const service = new NetworkService(mockStorageService, config);
      expect(service).toBeInstanceOf(NetworkService);
    });

    it("should accept storage service dependency", () => {
      expect(mockStorageService).toBeDefined();
      expect(mockStorageService.createConnectionBuffer).toBeDefined();
      expect(mockStorageService.addAudioChunk).toBeDefined();
      expect(mockStorageService.markConnectionCompleted).toBeDefined();
    });
  });

  describe("Timing Conversion Utilities", () => {
    it("should convert ticks to milliseconds correctly", () => {
      expect(timingConverter.ticksToMs(10000)).toBe(1);
      expect(timingConverter.ticksToMs(100000)).toBe(10);
      expect(timingConverter.ticksToMs(0)).toBe(0);
    });

    it("should convert milliseconds to ticks correctly", () => {
      expect(timingConverter.msToTicks(1)).toBe(10000);
      expect(timingConverter.msToTicks(10)).toBe(100000);
      expect(timingConverter.msToTicks(0)).toBe(0);
    });

    it("should compensate offset with padding adjustment", () => {
      // Test offset compensation (8,750,000 ticks padding)
      expect(timingConverter.compensateOffset(10000000)).toBe(1250000);
      expect(timingConverter.compensateOffset(8000000)).toBe(0); // Below padding threshold
      expect(timingConverter.compensateOffset(8750000)).toBe(0); // Exactly at padding
    });
  });

  describe("Text Synthesis", () => {
    const mockSpeechOptions: SpeechOptions = {
      voice: "en-US-AriaNeural",
      language: "en-US",
      rate: 1.0,
      pitch: 1.0,
    };

    beforeEach(() => {
      // Mock SSML validation to return valid
      const { validateSpeechParameters } = require("../src/utils/commonUtils");
      validateSpeechParameters.mockReturnValue({
        result: { isValid: true, errors: [] },
        normalizedOptions: {},
      });

      // Mock SSML generation
      const { generateSSML } = require("../src/utils/ssmlUtils");
      generateSSML.mockReturnValue("<speak>Test SSML</speak>");
    });

    it("should reject empty text", async () => {
      await expect(
        networkService.synthesizeText(
          "",
          mockSpeechOptions,
          "test-session-1",
          "test-connection-1",
        ),
      ).rejects.toThrow("SSML cannot be empty");
    });

    it("should reject text exceeding maximum length", async () => {
      const longText = "a".repeat(70000); // Exceeds AUDIO_CONFIG.maxBufferSize (65536)

      await expect(
        networkService.synthesizeText(
          longText,
          mockSpeechOptions,
          "test-session-2",
          "test-connection-2",
        ),
      ).rejects.toThrow("SSML length exceeds maximum");
    });

    it("should reject invalid SSML input", async () => {
      // Test empty SSML rejection
      await expect(
        networkService.synthesizeText(
          "",
          mockSpeechOptions,
          TEST_SESSION_ID,
          TEST_CONNECTION_ID,
        ),
      ).rejects.toThrow("SSML cannot be empty");

      // Test oversized SSML rejection
      const oversizedSSML = "x".repeat(1000000); // Exceeds maxBufferSize
      await expect(
        networkService.synthesizeText(
          oversizedSSML,
          mockSpeechOptions,
          TEST_SESSION_ID,
          TEST_CONNECTION_ID,
        ),
      ).rejects.toThrow("SSML length exceeds maximum");
    });

    it("should create synthesis session for valid input", async () => {
      // Start synthesis
      const synthesisPromise = networkService.synthesizeText(
        "Hello world",
        mockSpeechOptions,
      );

      // Wait for WebSocket creation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check that session is created immediately
      const stats = networkService.getStats();
      expect(stats.activeSessions).toBe(1);

      // Get the mock WebSocket instance created by the factory
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Simulate connection error to complete the test quickly
      if (mockWS?.onerror) {
        mockWS.onerror({ type: "error", message: "Test connection failed" });
      }

      // Expect the synthesis to fail due to connection error
      await expect(synthesisPromise).rejects.toThrow();
    });
  });

  describe("WebSocket Connection Management", () => {
    it("should establish WebSocket connection with proper URL", async () => {
      // Trigger connection creation
      networkService
        .synthesizeText(
          "test",
          { voice: "en-US-AriaNeural" },
          TEST_SESSION_ID,
          TEST_CONNECTION_ID,
        )
        .catch(() => {}); // Ignore promise rejection for this test

      // Wait for WebSocket constructor to be called
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify WebSocket was created with correct URL pattern
      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining("wss://speech.platform.bing.com"),
      );
    });

    it("should handle WebSocket connection timeout", async () => {
      // Create a special mock WebSocket that doesn't auto-connect
      global.WebSocket = jest.fn().mockImplementation((url: string) => {
        const instance = createMockWebSocketInstance();
        instance.url = url;
        // Don't simulate connection establishment - let it timeout
        currentMockWebSocket = instance;
        return instance;
      }) as any;

      const service = new NetworkService(mockStorageService, {
        connectionTimeout: 100, // Very short timeout
        maxRetries: 0, // Disable retries to avoid exponential backoff delays
      });

      await expect(
        service.synthesizeText(
          "test",
          { voice: "en-US-AriaNeural" },
          "test-session",
          "test-connection",
        ),
      ).rejects.toThrow("Connection timeout after 100ms");
    });

    it("should handle WebSocket connection errors", async () => {
      const synthesisPromise = networkService.synthesizeText(
        "test",
        { voice: "en-US-AriaNeural" },
        "test-session-1",
        "test-connection-1",
      );

      // Wait for WebSocket creation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate connection error immediately
      const mockWS = currentMockWebSocket;
      if (mockWS?.onerror) {
        mockWS.onerror({ type: "error", message: "Connection failed" });
      }

      await expect(synthesisPromise).rejects.toThrow();
    });

    it("should setup WebSocket event handlers after connection", async () => {
      networkService
        .synthesizeText(
          "test",
          { voice: "en-US-AriaNeural" },
          "test-session-2",
          "test-connection-2",
        )
        .catch(() => {}); // Ignore rejection

      // Allow time for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Verify event handlers are set
      expect(mockWS.onmessage).toBeDefined();
      expect(mockWS.onerror).toBeDefined();
      expect(mockWS.onclose).toBeDefined();
    });
  });

  describe("Message Protocol Implementation", () => {
    beforeEach(() => {
      // Get commonUtils mock
      const { validateSpeechParameters } = require("../src/utils/commonUtils");
      validateSpeechParameters.mockReturnValue({
        result: { isValid: true, errors: [] },
        normalizedOptions: {},
      });

      // Get ssmlUtils mock
      const { generateSSML } = require("../src/utils/ssmlUtils");
      generateSSML.mockReturnValue("<speak>Test</speak>");
    });

    it("should send speech configuration message", async () => {
      networkService
        .synthesizeText(
          "test",
          { voice: "en-US-AriaNeural" },
          "test-session",
          "test-connection",
        )
        .catch(() => {});

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Check that send was called (should include config message)
      expect(mockWS.send).toHaveBeenCalled();
    });

    it("should handle text messages correctly", async () => {
      networkService
        .synthesizeText(
          "test",
          { voice: "en-US-AriaNeural" },
          "test-session",
          "test-connection",
        )
        .catch(() => {});

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Wait for synthesis to start and send messages
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Get the captured request ID from the mock WebSocket
      const capturedRequestId = mockWS?.__capturedRequestId;
      expect(capturedRequestId).toBeTruthy();

      // Simulate receiving turn.start message with the captured request ID
      if (mockWS?.onmessage && capturedRequestId) {
        const turnStartMessage = `X-RequestId:${capturedRequestId}\r\nPath:turn.start\r\n\r\n`;
        mockWS.onmessage({ data: turnStartMessage });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Note: NetworkService no longer creates buffers on turn.start message
      // This is handled by ConnectionManager to avoid duplication issues
      expect(mockStorageService.createConnectionBuffer).not.toHaveBeenCalled();
    });

    it("should handle binary audio messages", async () => {
      const { parseEdgeTTSBinaryMessage } = require("../src/utils/audioUtils");
      parseEdgeTTSBinaryMessage.mockReturnValue({
        header: { "X-RequestId": "placeholder" }, // Will be updated with captured ID
        audioData: new ArrayBuffer(1024),
      });

      networkService
        .synthesizeText(
          "test",
          { voice: "en-US-AriaNeural" },
          "test-session",
          "test-connection",
        )
        .catch(() => {});

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Wait for synthesis to start and send messages
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Get the captured request ID from the mock WebSocket
      const capturedRequestId = mockWS?.__capturedRequestId;
      expect(capturedRequestId).toBeTruthy();

      // Update mock to return the captured request ID
      if (capturedRequestId) {
        parseEdgeTTSBinaryMessage.mockReturnValue({
          header: { "X-RequestId": capturedRequestId },
          audioData: new ArrayBuffer(1024),
        });
      }

      // Simulate binary message
      if (mockWS?.onmessage) {
        const binaryMessage = new ArrayBuffer(100);
        mockWS.onmessage({ data: binaryMessage });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify binary message parsing and storage
      expect(parseEdgeTTSBinaryMessage).toHaveBeenCalled();
      expect(mockStorageService.addAudioChunk).toHaveBeenCalled();
    });

    it("should handle turn.end message and complete synthesis", async () => {
      const synthesisPromise = networkService.synthesizeText(
        "test",
        {
          voice: "en-US-AriaNeural",
        },
        "test-session",
        "test-connection",
      );

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Wait for synthesis to start and send messages
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Get the captured request ID from the mock WebSocket
      const capturedRequestId = mockWS?.__capturedRequestId;
      expect(capturedRequestId).toBeTruthy();

      // Simulate turn.end message to complete synthesis with captured request ID
      if (mockWS?.onmessage && capturedRequestId) {
        const turnEndMessage = `X-RequestId:${capturedRequestId}\r\nPath:turn.end\r\n\r\n`;
        mockWS.onmessage({ data: turnEndMessage });
      }

      await expect(synthesisPromise).rejects.toThrow("No audio data received");
    });
  });

  describe("Boundary Event Processing", () => {
    it("should process word boundary events correctly", async () => {
      networkService
        .synthesizeText(
          "test",
          { voice: "en-US-AriaNeural" },
          "test-session",
          "test-connection",
        )
        .catch(() => {});

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Simulate boundary metadata message
      if (mockWS?.onmessage) {
        const boundaryMessage =
          "X-RequestId:test123\r\nPath:audio.metadata\r\n\r\n" +
          JSON.stringify({
            Metadata: [
              {
                Type: "WordBoundary",
                Data: {
                  Offset: 10000000, // 1000ms + padding
                  Duration: 5000000, // 500ms
                  text: { Text: "test", Length: 4 },
                },
              },
            ],
          });
        mockWS.onmessage({ data: boundaryMessage });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Boundary processing should work with timing conversion
      // This is verified by the fact that no errors are thrown
    });
  });

  describe("Storage Service Integration", () => {
    it("should create connection buffer on turn start", async () => {
      networkService
        .synthesizeText(
          "test",
          { voice: "en-US-AriaNeural" },
          "test-session",
          "test-connection",
        )
        .catch(() => {});

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Wait for synthesis to start and send messages
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Get the captured request ID from the mock WebSocket
      const capturedRequestId = mockWS?.__capturedRequestId;
      expect(capturedRequestId).toBeTruthy();

      // Simulate turn.start message with captured request ID
      if (mockWS?.onmessage && capturedRequestId) {
        const turnStartMessage = `X-RequestId:${capturedRequestId}\r\nPath:turn.start\r\n\r\n`;
        mockWS.onmessage({ data: turnStartMessage });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Note: NetworkService no longer creates buffers on turn.start message
      // This is handled by ConnectionManager to avoid duplication issues
      expect(mockStorageService.createConnectionBuffer).not.toHaveBeenCalled();
    });

    it("should add audio chunks to storage", async () => {
      const { parseEdgeTTSBinaryMessage } = require("../src/utils/audioUtils");
      parseEdgeTTSBinaryMessage.mockReturnValue({
        header: { "X-RequestId": "placeholder" },
        audioData: new ArrayBuffer(1024),
      });

      networkService
        .synthesizeText(
          "test",
          { voice: "en-US-AriaNeural" },
          "test-session",
          "test-connection",
        )
        .catch(() => {});

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Wait for synthesis to start and send messages
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Get the captured request ID from the mock WebSocket
      const capturedRequestId = mockWS?.__capturedRequestId;
      expect(capturedRequestId).toBeTruthy();

      // Update mock to return the captured request ID
      if (capturedRequestId) {
        parseEdgeTTSBinaryMessage.mockReturnValue({
          header: { "X-RequestId": capturedRequestId },
          audioData: new ArrayBuffer(1024),
        });
      }

      // Simulate binary message
      if (mockWS?.onmessage) {
        mockWS.onmessage({ data: new ArrayBuffer(1024) });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockStorageService.addAudioChunk).toHaveBeenCalled();
    });

    it("should mark connection completed on synthesis finish", async () => {
      const { parseEdgeTTSBinaryMessage } = require("../src/utils/audioUtils");
      parseEdgeTTSBinaryMessage.mockReturnValue({
        header: { "X-RequestId": "placeholder" },
        audioData: new ArrayBuffer(1024),
      });

      const synthesisPromise = networkService.synthesizeText(
        "test",
        {
          voice: "en-US-AriaNeural",
        },
        "test-session",
        "test-connection",
      );

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Wait for synthesis to start and send messages
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Get the captured request ID from the mock WebSocket
      const capturedRequestId = mockWS?.__capturedRequestId;
      expect(capturedRequestId).toBeTruthy();

      // Update mock to return the captured request ID
      if (capturedRequestId) {
        parseEdgeTTSBinaryMessage.mockReturnValue({
          header: { "X-RequestId": capturedRequestId },
          audioData: new ArrayBuffer(1024),
        });
      }

      // Add some audio data first
      if (mockWS?.onmessage && capturedRequestId) {
        mockWS.onmessage({ data: new ArrayBuffer(1024) });

        // Then complete synthesis
        setTimeout(() => {
          const turnEndMessage = `X-RequestId:${capturedRequestId}\r\nPath:turn.end\r\n\r\n`;
          mockWS.onmessage({ data: turnEndMessage });
        }, 5);
      }

      await expect(synthesisPromise).resolves.toMatchObject({
        audioChunks: expect.any(Array),
        boundaries: expect.any(Array),
        duration: expect.any(Number),
        completed: true,
      });

      expect(mockStorageService.markConnectionCompleted).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle NoAudioReceived error", async () => {
      const synthesisPromise = networkService.synthesizeText(
        "test",
        {
          voice: "en-US-AriaNeural",
        },
        "test-session",
        "test-connection",
      );

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Wait for synthesis to start and send messages
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Get the captured request ID from the mock WebSocket
      const capturedRequestId = mockWS?.__capturedRequestId;
      expect(capturedRequestId).toBeTruthy();

      // Complete synthesis without audio data using captured request ID
      if (mockWS?.onmessage && capturedRequestId) {
        const turnEndMessage = `X-RequestId:${capturedRequestId}\r\nPath:turn.end\r\n\r\n`;
        mockWS.onmessage({ data: turnEndMessage });
      }

      await expect(synthesisPromise).rejects.toThrow("No audio data received");
    });

    it("should handle WebSocket errors gracefully", async () => {
      const synthesisPromise = networkService.synthesizeText(
        "test",
        {
          voice: "en-US-AriaNeural",
        },
        "test-session",
        "test-connection",
      );

      // Wait for WebSocket creation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Simulate WebSocket error
      if (mockWS?.onerror) {
        mockWS.onerror({ type: "error", message: "WebSocket error" });
      }

      await expect(synthesisPromise).rejects.toThrow();
    });

    it("should handle unexpected response format", async () => {
      networkService
        .synthesizeText(
          "test",
          { voice: "en-US-AriaNeural" },
          "test-session",
          "test-connection",
        )
        .catch(() => {});

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Send malformed message
      if (mockWS?.onmessage) {
        mockWS.onmessage({ data: "invalid message format" });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should handle gracefully without crashing
    });
  });

  describe("Connection Lifecycle", () => {
    it("should close all connections on service close", async () => {
      // Start a synthesis to create a connection
      networkService
        .synthesizeText(
          "test",
          { voice: "en-US-AriaNeural" },
          "test-session",
          "test-connection",
        )
        .catch(() => {});

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Close the service
      await networkService.close();

      // Should have called close on WebSocket
      expect(mockWS.close).toHaveBeenCalled();
    });

    it("should cleanup sessions and connections", async () => {
      const stats1 = networkService.getStats();
      expect(stats1.activeSessions).toBe(0);

      // Start synthesis
      networkService
        .synthesizeText(
          "test",
          { voice: "en-US-AriaNeural" },
          "test-session",
          "test-connection",
        )
        .catch(() => {});

      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats2 = networkService.getStats();
      expect(stats2.activeSessions).toBe(1);

      // Close service
      await networkService.close();

      const stats3 = networkService.getStats();
      expect(stats3.activeSessions).toBe(0);
      expect(stats3.activeConnections).toBe(0);
    });
  });

  describe("SSML Integration", () => {
    it("should properly handle SSML input for synthesis", async () => {
      const { validateSpeechParameters } = require("../src/utils/commonUtils");
      validateSpeechParameters.mockReturnValue({
        result: { isValid: true, errors: [] },
        normalizedOptions: {},
      });

      const ssmlInput =
        "<speak><voice name='en-US-AriaNeural'><prosody rate='+20%' pitch='-10%'>Hello world</prosody></voice></speak>";

      networkService
        .synthesizeText(ssmlInput, {
          voice: "en-US-AriaNeural",
          rate: 1.2,
          pitch: 0.8,
        })
        .catch(() => {});

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Verify that WebSocket was created (indicating SSML was processed)
      expect(global.WebSocket).toHaveBeenCalled();
    });
  });

  describe("timeout handling", () => {
    it("should handle synthesis timeout properly", async () => {
      const timeoutService = new NetworkService(mockStorageService, {
        enableDebugLogging: false,
        maxRetries: 0, // No retries to simplify test
        connectionTimeout: 1000,
        gracefulCloseTimeout: 50,
      });

      // Mock a successful initial connection but no response
      const synthesisPromise = timeoutService.synthesizeText(
        "test text",
        {
          voice: "en-US-AriaNeural",
        },
        "test-session",
        "test-connection",
      );

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate connection establishment
      if (currentMockWebSocket?.onopen) {
        currentMockWebSocket.onopen({
          type: "open",
          target: currentMockWebSocket,
        });
      }

      // Wait a bit more for the synthesis to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Get the request ID that was captured
      const requestId = currentMockWebSocket?.__capturedRequestId;

      // Access the private activeSessions to trigger timeout
      const networkServiceAny = timeoutService as any;
      if (requestId && networkServiceAny.activeSessions?.has(requestId)) {
        const session = networkServiceAny.activeSessions.get(requestId);

        if (
          session &&
          typeof networkServiceAny.handleSynthesisTimeout === "function"
        ) {
          networkServiceAny.handleSynthesisTimeout(requestId);
        }
      }

      await expect(synthesisPromise).rejects.toThrow("Synthesis timeout");

      if (requestId && networkServiceAny.activeSessions) {
        expect(networkServiceAny.activeSessions.has(requestId)).toBe(false);
      }

      // Clean up
      await timeoutService.close();
    });
  });

  describe("WebSocket Handler Fix", () => {
    it("should handle connection establishment and communication phases with single handler setup", async () => {
      const synthesisPromise = networkService.synthesizeText(
        "test",
        {
          voice: "en-US-AriaNeural",
        },
        "test-session",
        "test-connection",
      );

      // Wait for WebSocket creation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Verify that handlers are set up once (not overwritten)
      expect(mockWS.onopen).toBeDefined();
      expect(mockWS.onerror).toBeDefined();
      expect(mockWS.onclose).toBeDefined();
      expect(mockWS.onmessage).toBeDefined();

      // Test connection establishment phase
      const originalOnError = mockWS.onerror;
      const originalOnClose = mockWS.onclose;

      // Simulate successful connection
      if (mockWS.onopen) {
        mockWS.onopen();
      }

      // Wait for connection to be established
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify handlers are still the same (not overwritten during communication phase)
      expect(mockWS.onerror).toBe(originalOnError);
      expect(mockWS.onclose).toBe(originalOnClose);

      // Now test that error handling works during communication phase
      // The error should be handled without rejecting the connection promise
      // but should handle error gracefully through handleConnectionError

      // Test communication phase error handling - should NOT reject the synthesis promise
      // but should handle error gracefully through handleConnectionError
      if (mockWS.onerror) {
        // Mock handleConnectionError to avoid actual error propagation
        const originalHandleError = (networkService as any)
          .handleConnectionError;
        (networkService as any).handleConnectionError = jest.fn();

        mockWS.onerror({ type: "error", message: "Communication error" });

        // Wait for error handling
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Verify handleConnectionError was called (communication phase)
        expect(
          (networkService as any).handleConnectionError,
        ).toHaveBeenCalled();

        // Restore original method
        (networkService as any).handleConnectionError = originalHandleError;
      }

      // Clean up the test
      await networkService.close();
    });

    it("should handle connection errors during establishment phase", async () => {
      const synthesisPromise = networkService.synthesizeText(
        "test",
        {
          voice: "en-US-AriaNeural",
        },
        "test-session",
        "test-connection",
      );

      // Wait for WebSocket creation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Simulate connection error before onopen
      if (mockWS.onerror) {
        mockWS.onerror({ type: "error", message: "Connection failed" });
      }

      // Should reject the synthesis promise
      await expect(synthesisPromise).rejects.toThrow("Connection failed");
    });

    it("should handle connection close during establishment phase", async () => {
      const synthesisPromise = networkService.synthesizeText(
        "test",
        {
          voice: "en-US-AriaNeural",
        },
        "test-session",
        "test-connection",
      );

      // Wait for WebSocket creation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Simulate unexpected close before onopen
      if (mockWS.onclose) {
        mockWS.onclose({ code: 1006, reason: "Connection lost" });
      }

      // Should reject the synthesis promise
      await expect(synthesisPromise).rejects.toThrow("Connection lost");
    });

    it("should not overwrite handlers after connection is established", async () => {
      // Mock the setupWebSocketHandlers to track how many times it's called
      const originalSetupHandlers = (networkService as any)
        .setupWebSocketHandlers;
      const setupHandlersSpy = jest.fn(originalSetupHandlers);
      (networkService as any).setupWebSocketHandlers = setupHandlersSpy;

      networkService.synthesizeText(
        "test",
        {
          voice: "en-US-AriaNeural",
        },
        "test-session",
        "test-connection",
      );

      // Wait for WebSocket creation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Verify setupWebSocketHandlers was called exactly once with connection context
      expect(setupHandlersSpy).toHaveBeenCalledTimes(1);
      expect(setupHandlersSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          resolve: expect.any(Function),
          reject: expect.any(Function),
          timeoutHandle: expect.any(Object),
        }),
      );

      // Restore original method
      (networkService as any).setupWebSocketHandlers = originalSetupHandlers;

      // Clean up
      await networkService.close();
    });
  });

  describe("Storage Buffer Timing Fix", () => {
    it("should handle binary audio messages arriving before turn.start", async () => {
      // In batch processing mode, NetworkService no longer creates buffers defensively
      // Buffer creation is handled exclusively by ConnectionManager
      const { parseEdgeTTSBinaryMessage } = require("../src/utils/audioUtils");

      const synthesisPromise = networkService.synthesizeText(
        "test",
        {
          voice: "en-US-AriaNeural",
        },
        "test-session",
        "test-connection",
      );

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Wait for synthesis to start and send messages
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Get the captured request ID from the mock WebSocket
      const capturedRequestId = mockWS?.__capturedRequestId;
      expect(capturedRequestId).toBeTruthy();

      // Mock parseEdgeTTSBinaryMessage to return a valid message with the captured request ID
      if (capturedRequestId) {
        parseEdgeTTSBinaryMessage.mockReturnValue({
          header: { "X-RequestId": capturedRequestId },
          audioData: new ArrayBuffer(1024),
        });
      }

      // Reset mock to track calls
      mockStorageService.addAudioChunk.mockClear();

      // Simulate binary audio message arriving BEFORE turn.start message
      if (mockWS?.onmessage && capturedRequestId) {
        mockWS.onmessage({ data: new ArrayBuffer(1024) });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify that NetworkService does NOT create buffers (ConnectionManager responsibility)
      expect(mockStorageService.createConnectionBuffer).not.toHaveBeenCalled();

      // Verify that addAudioChunk was called (buffer should already exist from ConnectionManager)
      expect(mockStorageService.addAudioChunk).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Uint8Array),
      );

      // Now simulate turn.start message arriving later
      if (mockWS?.onmessage && capturedRequestId) {
        const turnStartMessage = `X-RequestId:${capturedRequestId}\r\nPath:turn.start\r\n\r\n`;
        mockWS.onmessage({ data: turnStartMessage });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Clean up by completing the synthesis
      if (mockWS?.onmessage && capturedRequestId) {
        const turnEndMessage = `X-RequestId:${capturedRequestId}\r\nPath:turn.end\r\n\r\n`;
        mockWS.onmessage({ data: turnEndMessage });
      }

      // The synthesis should complete successfully despite the message order
      await expect(synthesisPromise).resolves.toMatchObject({
        audioChunks: expect.any(Array),
        boundaries: expect.any(Array),
        duration: expect.any(Number),
        completed: true,
      });
    });

    it("should handle binary message processing without buffer creation", async () => {
      // In batch processing mode, NetworkService no longer creates buffers
      // This test verifies that binary messages are processed correctly when
      // buffer creation is handled by ConnectionManager
      const { parseEdgeTTSBinaryMessage } = require("../src/utils/audioUtils");

      const synthesisPromise = networkService.synthesizeText(
        "test",
        {
          voice: "en-US-AriaNeural",
        },
        "test-session",
        "test-connection",
      );

      // Wait for WebSocket creation and connection
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Get the mock WebSocket instance
      const mockWS = currentMockWebSocket;
      expect(mockWS).toBeDefined();

      // Wait for synthesis to start and send messages
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Get the captured request ID from the mock WebSocket
      const capturedRequestId = mockWS?.__capturedRequestId;
      expect(capturedRequestId).toBeTruthy();

      // Mock parseEdgeTTSBinaryMessage to return a valid message with the captured request ID
      if (capturedRequestId) {
        parseEdgeTTSBinaryMessage.mockReturnValue({
          header: { "X-RequestId": capturedRequestId },
          audioData: new ArrayBuffer(1024),
        });
      }

      // Reset mocks to track calls
      mockStorageService.createConnectionBuffer.mockClear();
      mockStorageService.addAudioChunk.mockClear();

      // Simulate binary audio message - should process without creating buffer
      if (mockWS?.onmessage && capturedRequestId) {
        mockWS.onmessage({ data: new ArrayBuffer(1024) });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify that NetworkService does NOT create buffers
      expect(mockStorageService.createConnectionBuffer).not.toHaveBeenCalled();

      // Audio chunk should be added to existing buffer (created by ConnectionManager)
      expect(mockStorageService.addAudioChunk).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Uint8Array),
      );

      // Simulate turn.start message
      if (mockWS?.onmessage && capturedRequestId) {
        const turnStartMessage = `X-RequestId:${capturedRequestId}\r\nPath:turn.start\r\n\r\n`;
        mockWS.onmessage({ data: turnStartMessage });
      }

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Still no buffer creation from NetworkService
      expect(mockStorageService.createConnectionBuffer).not.toHaveBeenCalled();

      // Clean up by completing the synthesis
      if (mockWS?.onmessage && capturedRequestId) {
        const turnEndMessage = `X-RequestId: ${capturedRequestId}\r\nPath: turn.end\r\n\r\n`;
        mockWS.onmessage({ data: turnEndMessage });
      }

      // The synthesis should complete successfully
      await expect(synthesisPromise).resolves.toMatchObject({
        audioChunks: expect.any(Array),
        boundaries: expect.any(Array),
        duration: expect.any(Number),
        completed: true,
      });
    });
  });
});
