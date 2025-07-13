/**
 * Test for "response" path message handling
 * Tests the fix for handling Path:response WebSocket text messages
 */

import { NetworkService } from "../src/services/networkService";
import { StorageService } from "../src/services/storageService";
import { SpeechNetworkConfig } from "../src/types";
import { readFileSync } from "fs";
import { join } from "path";

// Mock dependencies
jest.mock("../src/services/storageService");

describe("NetworkService response path handling", () => {
  let networkService: NetworkService;
  let mockStorageService: jest.Mocked<StorageService>;
  let logSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    const config: SpeechNetworkConfig = {
      maxRetries: 2,
      connectionTimeout: 5000,
      enableDebugLogging: true,
    };

    mockStorageService = {
      createConnectionBuffer: jest.fn(),
      addAudioChunk: jest.fn(),
      getAudioData: jest.fn().mockReturnValue(new Uint8Array()),
      cleanupConnection: jest.fn(),
      hasConnectionBuffer: jest.fn().mockReturnValue(false),
    } as any;

    networkService = new NetworkService(mockStorageService, config);
    logSpy = jest.spyOn(console, "log").mockImplementation();
    debugSpy = jest.spyOn(console, "debug").mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
    debugSpy.mockRestore();
  });

  describe("Path:response message handling", () => {
    test("should handle response path messages correctly", () => {
      // Read the actual response sample data from the fixtures
      const responseMessagePath = join(
        __dirname,
        "__fixtures__",
        "network-samples",
        "text-message-response.txt",
      );
      const responseMessage = readFileSync(responseMessagePath, "utf-8");

      // Mock connection object
      const mockConnection = {
        id: "test-connection",
        websocket: null,
        state: "Connected" as any,
        requestId: "efdc6e11-7741-40f4-9918-0dc934776930",
      };

      // Set up an active session for the request ID
      const mockSession = {
        request: {
          connectionId: "test-connection-id",
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
        "efdc6e11-7741-40f4-9918-0dc934776930",
        mockSession,
      );

      // Call the private handleTextMessage method
      expect(() => {
        (networkService as any).handleTextMessage(
          mockConnection,
          responseMessage,
        );
      }).not.toThrow();

      // Verify that the message was processed correctly
      // First call should be console.log: "Received text message on connection..."
      expect(logSpy.mock.calls[0][0]).toContain(
        "[NetworkService] Received text message on connection test-connection",
      );

      // Second call should be console.debug: "Processing message: path=response..."
      expect(debugSpy.mock.calls[0][0]).toContain(
        "[NetworkService] Processing message: path=response, requestId=efdc6e11-7741-40f4-9918-0dc934776930",
      );

      // Third call should be console.log: "Received Path:response for request..."
      expect(logSpy.mock.calls[1][0]).toContain(
        "[NetworkService] Received Path:response for request (X-RequestId: efdc6e11-7741-40f4-9918-0dc934776930)",
      );

      // Verify service tag logging
      expect(logSpy.mock.calls[3][0]).toContain(
        "[NetworkService] Path:response Service tag: c2be35ebbfd2402687ba9f38f108ce25",
      );

      // Verify stream ID logging
      expect(logSpy.mock.calls[4][0]).toContain(
        "[NetworkService] Path:response Audio stream ID: 1EDD06D3FB1F4B1E9279E047205026BF",
      );
    });

    test("should handle response message with unknown session gracefully", () => {
      const responseMessage = [
        "X-RequestId:unknown-request-id",
        "Content-Type:application/json; charset=utf-8",
        "Path:response",
        "",
        '{"context":{"serviceTag":"test-tag"},"audio":{"type":"inline","streamId":"test-stream"}}',
      ].join("\r\n");

      const mockConnection = {
        id: "test-connection",
        websocket: null,
        state: "Connected" as any,
        requestId: "unknown-request-id",
      };

      expect(() => {
        (networkService as any).handleTextMessage(
          mockConnection,
          responseMessage,
        );
      }).not.toThrow();

      // Verify that it handles unknown session gracefully
      expect(logSpy.mock.calls[0][0]).toContain(
        "[NetworkService] Received text message on connection test-connection",
      );

      expect(debugSpy.mock.calls[0][0]).toContain(
        "[NetworkService] Processing message: path=response, requestId=unknown-request-id",
      );

      expect(logSpy.mock.calls[1][0]).toContain(
        "[NetworkService] Received Path:response for request (X-RequestId: unknown-request-id)",
      );

      expect(logSpy.mock.calls[2][0]).toContain(
        "[NetworkService] Received response for unknown session. X-RequestId: unknown-request-id",
      );
    });

    test("should handle malformed response JSON gracefully", () => {
      const responseMessage = [
        "X-RequestId:test-request-id",
        "Content-Type:application/json; charset=utf-8",
        "Path:response",
        "",
        '{"invalid":"json"', // Malformed JSON
      ].join("\r\n");

      const mockConnection = {
        id: "test-connection",
        websocket: null,
        state: "Connected" as any,
        requestId: "test-request-id",
      };

      // Set up an active session
      const mockSession = {
        request: {
          connectionId: "test-connection-id",
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

      (networkService as any).activeSessions.set(
        "test-request-id",
        mockSession,
      );

      expect(() => {
        (networkService as any).handleTextMessage(
          mockConnection,
          responseMessage,
        );
      }).not.toThrow();

      // Verify that it handles JSON parsing errors gracefully
      expect(logSpy.mock.calls[0][0]).toContain(
        "[NetworkService] Received text message on connection test-connection",
      );

      expect(debugSpy.mock.calls[0][0]).toContain(
        "[NetworkService] Processing message: path=response, requestId=test-request-id",
      );

      expect(logSpy.mock.calls[1][0]).toContain(
        "[NetworkService] Received Path:response for request (X-RequestId: test-request-id)",
      );

      expect(logSpy.mock.calls[2][0]).toMatch(
        /Error processing response message:/,
      );
    });
  });
});
