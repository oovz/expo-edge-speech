/**
 * Test suite for handleTextMessage function with real Edge TTS data
 * Tests the parsing of actual Edge TTS protocol messages
 */

import { NetworkService } from "../src/services/networkService";
import { StorageService } from "../src/services/storageService";
import { SpeechNetworkConfig } from "../src/types";
import { readFileSync } from "fs";
import { join } from "path";

// Mock dependencies
jest.mock("../src/services/storageService");

describe("NetworkService handleTextMessage", () => {
  let networkService: NetworkService;
  let mockStorageService: jest.Mocked<StorageService>;

  beforeEach(() => {
    const config: SpeechNetworkConfig = {
      maxRetries: 2,
      connectionTimeout: 5000,
      enableDebugLogging: false,
    };

    mockStorageService = {
      createConnectionBuffer: jest.fn(),
      addAudioChunk: jest.fn(),
      getAudioData: jest.fn().mockReturnValue(new Uint8Array()),
      cleanupConnection: jest.fn(),
      hasConnectionBuffer: jest.fn().mockReturnValue(false),
    } as any;

    networkService = new NetworkService(mockStorageService, config);
  });

  describe("Real Edge TTS message parsing", () => {
    test("should parse turn.start message from text-message.txt", () => {
      // Read the actual sample data from the fixtures
      const sampleMessagePath = join(
        __dirname,
        "__fixtures__",
        "network-samples",
        "text-message-turn-start.txt",
      );
      const sampleMessage = readFileSync(sampleMessagePath, "utf-8");

      // Mock connection object
      const mockConnection = {
        id: "test-connection",
        websocket: null,
        state: "Connected" as any,
        requestId: "239fdb39-f62c-47b3-8ccd-d3f4fb88598e",
      };

      // Set up an active session for the request ID to simulate real usage
      const mockSession = {
        request: {
          connectionId: "test-connection-id", // Connection ID that should be passed to createConnectionBuffer
          text: "test",
          options: {},
        },
        response: {
          audioChunks: [],
          boundaries: [],
          duration: 0,
          completed: false,
        },
        createdAt: new Date(),
        promise: {
          resolve: jest.fn(),
          reject: jest.fn(),
        },
      };

      // Add the session to the network service's active sessions
      (networkService as any).activeSessions.set(
        "239fdb39-f62c-47b3-8ccd-d3f4fb88598e",
        mockSession,
      );

      // Spy on the log method to verify message processing
      const logSpy = jest
        .spyOn(networkService as any, "log")
        .mockImplementation();

      // Call the private handleTextMessage method
      expect(() => {
        (networkService as any).handleTextMessage(
          mockConnection,
          sampleMessage,
        );
      }).not.toThrow();

      // Verify that the message was processed correctly
      expect(logSpy).toHaveBeenCalledWith(
        "Received text message on connection test-connection",
      );
      expect(logSpy).toHaveBeenCalledWith(
        "Received Path:turn.start for request (X-RequestId: 239fdb39-f62c-47b3-8ccd-d3f4fb88598e)",
      );

      // Note: NetworkService no longer creates buffers on turn.start
      // This is handled by ConnectionManager to avoid duplication issues
      expect(mockStorageService.createConnectionBuffer).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });

    test("should correctly parse headers without space after colon", () => {
      // Test message with Edge TTS format (no space after colon)
      const edgeTtsMessage = [
        "X-RequestId:test-123-456",
        "Content-Type:application/json; charset=utf-8",
        "Path:turn.start",
        "",
        '{"context":{"serviceTag":"test-service-tag"}}',
      ].join("\r\n");

      const mockConnection = {
        id: "test-connection",
        websocket: null,
        state: "Connected" as any,
        requestId: "test-123-456",
      };

      const logSpy = jest
        .spyOn(networkService as any, "log")
        .mockImplementation();

      expect(() => {
        (networkService as any).handleTextMessage(
          mockConnection,
          edgeTtsMessage,
        );
      }).not.toThrow();

      expect(logSpy).toHaveBeenCalledWith(
        "Received Path:turn.start for request (X-RequestId: test-123-456)",
      );

      logSpy.mockRestore();
    });

    test("should handle missing header separator gracefully", () => {
      const invalidMessage = "X-RequestId:test-123\r\nPath:turn.start"; // Missing \r\n\r\n

      const mockConnection = {
        id: "test-connection",
        websocket: null,
        state: "Connected" as any,
        requestId: "test-123",
      };

      expect(() => {
        (networkService as any).handleTextMessage(
          mockConnection,
          invalidMessage,
        );
      }).toThrow("Invalid message format: missing header separator");
    });

    test("should handle malformed headers gracefully", () => {
      const messageWithMalformedHeader = [
        "X-RequestId:test-123",
        "MalformedHeader", // No colon
        "Path:turn.start",
        "",
        "{}",
      ].join("\r\n");

      const mockConnection = {
        id: "test-connection",
        websocket: null,
        state: "Connected" as any,
        requestId: "test-123",
      };

      const logSpy = jest
        .spyOn(networkService as any, "log")
        .mockImplementation();

      expect(() => {
        (networkService as any).handleTextMessage(
          mockConnection,
          messageWithMalformedHeader,
        );
      }).not.toThrow();

      // Should still process the valid headers
      expect(logSpy).toHaveBeenCalledWith(
        "Received Path:turn.start for request (X-RequestId: test-123)",
      );

      logSpy.mockRestore();
    });
  });
});
