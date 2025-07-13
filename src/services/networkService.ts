/**
 * Complete EdgeSpeech WebSocket communication service using protocol knowledge
 * from previous tasks. Handles Edge TTS WebSocket protocol, binary audio processing,
 * boundary event parsing, timeout/retry logic, and storage service coordination.
 */

import * as Crypto from "expo-crypto";
import {
  type SpeechOptions,
  type WordBoundary,
  type BoundaryEventData,
  ConnectionState,
  NoAudioReceived,
  UnexpectedResponse,
  WebSocketError,
  type TimingConverter,
  type SpeechNetworkConfig,
} from "../types";
import type { ReactNativeWebSocket } from "../rn-types";

import {
  EDGE_TTS_WEBSOCKET_URL_TEMPLATE,
  SEC_MS_GEC_VERSION,
  CONNECTION_LIFECYCLE,
  MESSAGE_PATHS,
  CONTENT_TYPES,
  AUDIO_CONFIG,
  SEC_MS_GEC_GENERATION,
  MESSAGE_FORMAT,
} from "../constants";

import { parseEdgeTTSBinaryMessage } from "../utils/audioUtils";
import { StorageService } from "./storageService";
import { generateTimestamp } from "../utils/commonUtils";

// WebSocket Ready State Constants
// Define these locally to avoid dependency on global WebSocket in test environments
const WS_OPEN = 1;

// =============================================================================
// Network Service Configuration and Types
// =============================================================================

/**
 * WebSocket connection state
 */
interface EdgeTTSConnection {
  id: string;
  websocket: ReactNativeWebSocket | null;
  state: ConnectionState;
  createdAt: Date;
  lastActivity: Date;
}

/**
 * Message headers for Edge TTS protocol
 */
interface EdgeTTSHeaders {
  "X-RequestId": string;
  "X-Timestamp": string;
  "Content-Type": string;
  Path: string;
  [key: string]: string;
}

/**
 * Synthesis request parameters
 */
interface SynthesisRequest {
  /** text to synthesize (in non-SSML format) */
  text: string;
  /** Speech options */
  options: SpeechOptions;
  /** Request ID for tracking */
  requestId: string;
  /** Connection ID */
  connectionId: string;
}

/**
 * Synthesis response data
 */
interface SynthesisResponse {
  /** Audio data chunks */
  audioChunks: Uint8Array[];
  /** Word boundary events */
  boundaries: WordBoundary[];
  /** Total audio duration in milliseconds */
  duration: number;
  /** Synthesis completion status */
  completed: boolean;
}

/**
 * Active synthesis session
 */
interface SynthesisSession {
  /** Request parameters */
  request: SynthesisRequest;
  /** Response data */
  response: SynthesisResponse;
  /** Creation timestamp */
  createdAt: Date;
  /** Completion promise */
  promise: {
    resolve: (response: SynthesisResponse) => void;
    reject: (error: Error) => void;
  };
  /** Timeout handle */
  timeoutHandle?: ReturnType<typeof setTimeout>;
  /** Current position in original text for boundary event mapping */
  lastBoundaryPosition?: number;
}

// =============================================================================
// Timing Conversion Utilities
// =============================================================================

/**
 * Timing conversion implementation
 */
export const timingConverter: TimingConverter = {
  ticksToMs: (ticks: number): number => {
    return Math.round(ticks / 10000); // 10,000 ticks = 1 millisecond
  },

  msToTicks: (ms: number): number => {
    return ms * 10000; // 1 millisecond = 10,000 ticks
  },

  compensateOffset: (rawOffset: number): number => {
    // Apply 8,750,000 ticks (875ms) padding compensation
    return Math.max(0, rawOffset - 8750000);
  },
};

// =============================================================================
// Authentication Utilities
// =============================================================================

/**
 * Generate Windows file time for authentication
 */
function generateWindowsFileTime(): number {
  const now = new Date();
  const unixTime = Math.floor(now.getTime() / 1000);
  // Windows file time: 100-nanosecond intervals since 1601-01-01
  return (unixTime + SEC_MS_GEC_GENERATION.WIN_EPOCH) * 10000000;
}

/**
 * Generate SHA-256 hash
 */
async function generateSecMSGECToken(): Promise<string> {
  const ticks = generateWindowsFileTime();
  const hashInput = `${ticks}MSEdgeSpeechTTS`;

  const token = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    hashInput,
  );

  return token.toUpperCase();
}

// =============================================================================
// NetworkService Class
// =============================================================================

/**
 * Network service for Edge TTS WebSocket communication
 */
export class NetworkService {
  private config: SpeechNetworkConfig;
  private storageService: StorageService;
  // <X-RequestId, SynthesisSession>
  private activeSessions: Map<string, SynthesisSession> = new Map();
  private connections: Map<string, EdgeTTSConnection> = new Map();
  private debugLog: boolean = false;

  constructor(
    storageService: StorageService,
    config: Partial<SpeechNetworkConfig> = {},
  ) {
    this.storageService = storageService;
    this.config = {
      maxRetries:
        config.maxRetries ??
        CONNECTION_LIFECYCLE.RETRY_LIMITS.CONNECTION_ATTEMPTS,
      baseRetryDelay: config.baseRetryDelay ?? 1000,
      maxRetryDelay: config.maxRetryDelay ?? 10000,
      connectionTimeout:
        config.connectionTimeout ??
        CONNECTION_LIFECYCLE.TIMEOUTS.CONNECTION_ESTABLISHMENT,
      gracefulCloseTimeout:
        config.gracefulCloseTimeout ??
        CONNECTION_LIFECYCLE.TIMEOUTS.GRACEFUL_CLOSE,
      enableDebugLogging: config.enableDebugLogging ?? false,
    };
    this.debugLog = this.config.enableDebugLogging || false;
  }

  // ===========================================================================
  // Public API Methods
  // ===========================================================================

  /**
   * Synthesize SSML to speech using Edge TTS
   */
  async synthesizeText(
    ssml: string,
    options: SpeechOptions,
    // Add clientSessionId and connectionId parameters
    clientSessionId: string,
    connectionId: string,
  ): Promise<SynthesisResponse> {
    const requestId = clientSessionId;

    this.log(
      `Starting synthesis for request ${requestId} using connection ${connectionId}`,
    );

    // Validate input
    if (!ssml || ssml.trim().length === 0) {
      throw new Error("SSML cannot be empty");
    }

    if (ssml.length > AUDIO_CONFIG.maxBufferSize) {
      throw new Error(
        `SSML length exceeds maximum of ${AUDIO_CONFIG.maxBufferSize} characters`,
      );
    }

    // Create synthesis request
    const request: SynthesisRequest = {
      text: ssml, // Store SSML in text field for compatibility
      options,
      requestId, // This is clientSessionId
      connectionId, // This is the passed-in connectionId
    };

    // Create synthesis session
    return new Promise<SynthesisResponse>((resolve, reject) => {
      const session: SynthesisSession = {
        request,
        response: {
          audioChunks: [],
          boundaries: [],
          duration: 0,
          completed: false,
        },
        createdAt: new Date(),
        promise: { resolve, reject },
      };

      // Set timeout for total synthesis
      session.timeoutHandle = setTimeout(() => {
        this.handleSynthesisTimeout(requestId);
      }, CONNECTION_LIFECYCLE.TIMEOUTS.TOTAL_SYNTHESIS);

      this.activeSessions.set(requestId, session);

      // Start synthesis with retry logic
      this.performSynthesisWithRetry(session, 0).catch((error) => {
        this.cleanupSession(requestId);
        reject(error);
      });
    });
  }

  /**
   * Close all connections and cleanup
   */
  async close(): Promise<void> {
    this.log("Closing network service");

    // Clear all timeouts
    for (const session of this.activeSessions.values()) {
      if (session.timeoutHandle) {
        clearTimeout(session.timeoutHandle);
      }
    }

    // Close all connections aggressively
    const closePromises: Promise<void>[] = [];
    for (const connection of this.connections.values()) {
      closePromises.push(this.forceCloseConnection(connection.id));
    }

    await Promise.all(closePromises);

    // Clear collections
    this.activeSessions.clear();
    this.connections.clear();
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  /**
   * Create and establish WebSocket connection
   */
  private async createConnection(
    connectionId: string,
  ): Promise<EdgeTTSConnection> {
    this.log(`Creating connection ${connectionId}`);

    // Generate authentication token
    const secMsGecToken = await generateSecMSGECToken();

    // Build WebSocket URL with parameters
    const url = EDGE_TTS_WEBSOCKET_URL_TEMPLATE.replace(
      "{secMsGec}",
      secMsGecToken,
    )
      .replace("{secMsGecVersion}", SEC_MS_GEC_VERSION)
      .replace("{connectionId}", connectionId);

    this.log(`WebSocket URL: ${url}`);

    // Create connection object
    const connection: EdgeTTSConnection = {
      id: connectionId,
      websocket: null,
      state: ConnectionState.Connecting,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.connections.set(connectionId, connection);

    return new Promise<EdgeTTSConnection>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(
          new WebSocketError(
            `Connection timeout after ${this.config.connectionTimeout}ms`,
          ),
        );
      }, this.config.connectionTimeout);

      try {
        // Create WebSocket with authentication headers required by Edge TTS protocol
        // Note: React Native WebSocket headers are handled differently than DOM WebSocket
        const websocket = new WebSocket(url) as unknown as ReactNativeWebSocket;

        websocket.binaryType = "arraybuffer";

        // Set up websocket handlers once with state-aware logic
        connection.websocket = websocket;
        this.setupWebSocketHandlers(connection, {
          resolve,
          reject,
          timeoutHandle,
        });
      } catch (error) {
        clearTimeout(timeoutHandle);
        reject(new WebSocketError(`Failed to create WebSocket: ${error}`));
      }
    });
  }

  /**
   * Setup WebSocket event handlers with state-aware logic
   */
  private setupWebSocketHandlers(
    connection: EdgeTTSConnection, // connection.id is the connectionId, which is also the clientSessionId/requestId for the messages on this WebSocket
    connectionContext?: {
      resolve: (connection: EdgeTTSConnection) => void;
      reject: (error: Error) => void;
      timeoutHandle: NodeJS.Timeout;
    },
  ): void {
    if (!connection.websocket) return;

    // Single onopen handler for connection establishment
    connection.websocket.onopen = () => {
      this.log(`Connection ${connection.id} established`);

      if (connectionContext) {
        clearTimeout(connectionContext.timeoutHandle);
        this.setConnectionState(connection, ConnectionState.Connected);
        connection.lastActivity = new Date();
        connectionContext.resolve(connection);
      }
    };

    // State-aware onmessage handler
    connection.websocket.onmessage = (event) => {
      connection.lastActivity = new Date();
      this.handleWebSocketMessage(connection, event);
    };

    // State-aware onerror handler
    connection.websocket.onerror = (event) => {
      this.log(`WebSocket error on connection ${connection.id}:`, event);

      // During connection establishment
      if (
        connectionContext &&
        connection.state === ConnectionState.Connecting
      ) {
        clearTimeout(connectionContext.timeoutHandle);
        this.setConnectionState(connection, ConnectionState.Error);
        connectionContext.reject(
          new WebSocketError(`WebSocket connection error: ${event.message}`),
        );
      } else {
        // During communication phase
        this.handleConnectionError(
          connection,
          new WebSocketError(`WebSocket error: ${event.message}`),
        );
      }
    };

    // State-aware onclose handler
    connection.websocket.onclose = (event) => {
      this.log(
        `WebSocket closed on connection ${connection.id}: ${event.code} ${event.reason}`,
      );

      // During connection establishment
      if (
        connectionContext &&
        connection.state === ConnectionState.Connecting
      ) {
        clearTimeout(connectionContext.timeoutHandle);
        this.setConnectionState(connection, ConnectionState.Disconnected);
        if (event.code !== 1000) {
          connectionContext.reject(
            new WebSocketError(
              `WebSocket closed unexpectedly: ${event.code} ${event.reason}`,
            ),
          );
        }
      } else {
        // During communication phase
        connection.state = ConnectionState.Disconnected;
        if (event.code !== 1000) {
          this.handleConnectionError(
            connection,
            new WebSocketError(
              `WebSocket closed unexpectedly: ${event.code} ${event.reason}`,
            ),
          );
        }
      }
    };
  }

  /**
   * Close a WebSocket connection
   */
  private async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    this.log(`Closing connection ${connectionId}`);

    if (connection.websocket && connection.websocket.readyState === WS_OPEN) {
      connection.websocket.close(1000, "Normal closure");

      // Wait for graceful close with configurable timeout
      await new Promise<void>((resolve) => {
        const timeoutHandle = setTimeout(() => {
          resolve();
        }, this.config.gracefulCloseTimeout);

        if (connection.websocket) {
          connection.websocket.onclose = () => {
            clearTimeout(timeoutHandle);
            resolve();
          };
        }
      });
    }

    connection.state = ConnectionState.Disconnected;
    this.connections.delete(connectionId);
  }

  /**
   * Force close a WebSocket connection without waiting for graceful shutdown
   */
  private async forceCloseConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    this.log(`Force closing connection ${connectionId}`);

    if (connection.websocket) {
      try {
        // Clear all event handlers to prevent any callbacks after cleanup
        connection.websocket.onopen = null;
        connection.websocket.onmessage = null;
        connection.websocket.onerror = null;
        connection.websocket.onclose = null;

        // Force close the WebSocket immediately
        if (
          connection.websocket.readyState === WS_OPEN ||
          connection.websocket.readyState === 0 /* CONNECTING */
        ) {
          connection.websocket.close(1000, "Force close");
        }
      } catch (error) {
        // Ignore any errors during force close
        this.log(`Error during force close: ${error}`);
      }
    }

    connection.state = ConnectionState.Disconnected;
    this.connections.delete(connectionId);
  }

  /**
   * Send speech configuration message
   */
  private async sendSpeechConfig(
    connection: EdgeTTSConnection,
    requestId: string,
  ): Promise<void> {
    this.log(`Sending speech config for request ${requestId}`);

    const headers: EdgeTTSHeaders = {
      "X-RequestId": requestId,
      "X-Timestamp": generateTimestamp(),
      "Content-Type": CONTENT_TYPES.JSON,
      Path: MESSAGE_PATHS.SPEECH_CONFIG,
    };

    const configBody = {
      context: {
        synthesis: {
          audio: {
            metadataoptions: {
              sentenceBoundaryEnabled: false,
              wordBoundaryEnabled: true,
            },
            outputFormat: AUDIO_CONFIG.defaultFormat,
          },
        },
      },
    };

    const message = this.formatTextMessage(headers, JSON.stringify(configBody));
    await this.sendWebSocketMessage(connection, message);
  }

  /**
   * Send SSML synthesis request
   */
  private async sendSSMLRequest(
    connection: EdgeTTSConnection,
    session: SynthesisSession,
  ): Promise<void> {
    this.log(`Sending SSML request for ${session.request.requestId}`);

    // Use SSML directly from session text field (now contains SSML instead of text)
    const ssml = session.request.text;

    const headers: EdgeTTSHeaders = {
      "X-RequestId": session.request.requestId,
      "X-Timestamp": generateTimestamp(),
      "Content-Type": CONTENT_TYPES.SSML,
      Path: MESSAGE_PATHS.SSML,
    };

    const message = this.formatTextMessage(headers, ssml);
    await this.sendWebSocketMessage(connection, message);
  }

  /**
   * Format text message with headers
   */
  private formatTextMessage(headers: EdgeTTSHeaders, body: string): string {
    const headerLines = Object.entries(headers)
      .map(
        ([key, value]) =>
          `${key}${MESSAGE_FORMAT.HEADER_VALUE_SEPARATOR}${value}`,
      )
      .join(MESSAGE_FORMAT.LINE_ENDING);

    return `${headerLines}${MESSAGE_FORMAT.HEADER_SEPARATOR}${body}`;
  }

  /**
   * Send WebSocket message
   */
  private async sendWebSocketMessage(
    connection: EdgeTTSConnection,
    message: string,
  ): Promise<void> {
    if (!connection.websocket || connection.websocket.readyState !== WS_OPEN) {
      throw new WebSocketError("WebSocket is not connected");
    }

    try {
      connection.websocket.send(message);
      connection.lastActivity = new Date();
      this.log(`Sent message on connection ${connection.id}`);
    } catch (error) {
      throw new WebSocketError(`Failed to send WebSocket message: ${error}`);
    }
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  /**
   * Handle incoming WebSocket message
   */
  private handleWebSocketMessage(
    connection: EdgeTTSConnection, // This connection object contains the id we need
    event: WebSocketMessageEvent,
  ): void {
    try {
      if (typeof event.data === "string") {
        this.handleTextMessage(connection, event.data);
      } else if (event.data instanceof ArrayBuffer) {
        this.handleBinaryMessage(connection, event.data);
      } else {
        this.log(`Unknown message type from connection ${connection.id}`);
      }
    } catch (error) {
      this.log(
        `Error handling message from connection ${connection.id}:`,
        error,
      );
      this.handleConnectionError(connection, error as Error);
    }
  }

  /**
   * Handle text (JSON) message
   */
  private handleTextMessage(connection: EdgeTTSConnection, data: string): void {
    this.log(`Received text message on connection ${connection.id}`);

    try {
      // Parse message headers and body
      const headerEndIndex = data.indexOf(MESSAGE_FORMAT.HEADER_SEPARATOR);
      if (headerEndIndex === -1) {
        throw new UnexpectedResponse(
          "Invalid message format: missing header separator",
        );
      }

      const headerSection = data.substring(0, headerEndIndex);
      const bodySection = data.substring(
        headerEndIndex + MESSAGE_FORMAT.HEADER_SEPARATOR.length,
      );

      // Parse headers
      const headers: EdgeTTSHeaders = {} as any;
      const headerLines = headerSection.split(MESSAGE_FORMAT.LINE_ENDING);

      for (const line of headerLines) {
        const separatorIndex = line.indexOf(":");
        if (separatorIndex > 0) {
          const key = line.substring(0, separatorIndex).trim();
          const value = line.substring(separatorIndex + 1).trim();

          if (key.replace(/-/g, "").toLowerCase() === "xrequestid") {
            headers["X-RequestId"] = value;
          } else {
            headers[key] = value;
          }
        }
      }

      // Route message based on path
      const path = headers.Path;
      const requestId = headers["X-RequestId"];

      if (this.debugLog) {
        console.debug(
          `[NetworkService] Processing message: path=${path}, requestId=${requestId}`,
        );
      }

      switch (path) {
        case MESSAGE_PATHS.TURN_START:
          this.log(
            `Received Path:${MESSAGE_PATHS.TURN_START} for request (X-RequestId: ${requestId})`,
          );
          // Note: Connection buffer is created by ConnectionManager
          // to avoid duplicate buffer creation issues
          break;

        case MESSAGE_PATHS.AUDIO_METADATA:
          this.handleAudioMetadata(requestId, connection, bodySection);
          break;

        case MESSAGE_PATHS.RESPONSE:
          this.handleResponse(requestId, connection, bodySection);
          break;

        case MESSAGE_PATHS.TURN_END:
          this.handleTurnEnd(requestId, connection);
          break;

        default:
          this.log(`Unknown message path: ${path}`);
          break;
      }
    } catch (error) {
      throw new UnexpectedResponse(`Failed to parse text message: ${error}`);
    }
  }

  /**
   * Handle binary (audio) message
   */
  private handleBinaryMessage(
    connection: EdgeTTSConnection,
    data: ArrayBuffer,
  ): void {
    try {
      // Parse binary message structure
      const binaryMessage = parseEdgeTTSBinaryMessage(data);

      if (!binaryMessage) {
        throw new UnexpectedResponse(
          "Failed to parse binary message: invalid format",
        );
      }

      // Extract request ID from headers
      const requestId = binaryMessage.header["X-RequestId"];
      if (!requestId) {
        throw new UnexpectedResponse(
          "Binary message missing X-RequestId header",
        );
      }

      // Get session
      const session = this.activeSessions.get(requestId);
      if (!session) {
        this.log(
          `Received audio for unknown session. X-RequestId: ${requestId}`,
        );
        return;
      }

      this.log(
        `Received binary message for request ${requestId}, audio data length: ${binaryMessage.audioData.byteLength}`,
      );

      // Add audio chunk to session
      const audioChunk = new Uint8Array(binaryMessage.audioData);
      session.response.audioChunks.push(audioChunk);

      // Add audio chunk to storage buffer (ConnectionManager creates buffer)
      this.storageService.addAudioChunk(
        session.request.connectionId,
        audioChunk,
      );

      // this.log(
      //   `Added audio chunk for session ${requestId}, size: ${audioChunk.length}`,
      // );
    } catch (error) {
      throw new UnexpectedResponse(`Failed to parse binary message: ${error}`);
    }
  }

  /**
   * Handle turn start message
   */
  private handleTurnStart(
    requestId: string,
    connection: EdgeTTSConnection,
  ): void {
    const session = this.activeSessions.get(requestId);
    if (!session) {
      this.log(
        `No active session for turn.start with X-RequestId ${requestId}`,
      );
      return;
    }
    // console.log("called from handle turn start");
    this.log(`Turn started for X-RequestId ${requestId}`);

    connection.lastActivity = new Date();

    // // Initialize storage buffer for this connection
    // try {
    //   // console.log("called from handle turn start");
    //   this.storageService.createConnectionBuffer(session.request.connectionId);
    // } catch (error) {
    //   // Buffer might already exist, which is okay
    //   if (!(error as Error).message.includes("Buffer already exists")) {
    //     throw error;
    //   }
    // }
  }

  /**
   * Handle audio metadata (boundary events)
   */
  private handleAudioMetadata(
    requestId: string,
    connection: EdgeTTSConnection,
    bodyData: string,
  ): void {
    this.log(`Audio metadata for X-RequestId ${requestId}`);

    try {
      const session = this.activeSessions.get(requestId);
      if (!session) {
        this.log(
          `Received metadata for unknown request. X-RequestId ${requestId}`,
        );
        return;
      }

      connection.lastActivity = new Date();

      // Parse metadata JSON
      const metadata = JSON.parse(bodyData);
      if (metadata.Metadata && Array.isArray(metadata.Metadata)) {
        for (const boundaryData of metadata.Metadata) {
          if (boundaryData.Type === "WordBoundary") {
            // Initialize boundary position tracking if not set
            if (session.lastBoundaryPosition === undefined) {
              session.lastBoundaryPosition = 0;
            }

            // Process boundary event with original text and current position
            const result = this.processBoundaryEvent(
              boundaryData,
              session.request.text,
              session.lastBoundaryPosition,
            );

            // Extract the boundary and update position tracking
            const { boundary, nextPosition } = result;
            session.lastBoundaryPosition = nextPosition;

            // Add to session boundaries
            session.response.boundaries.push(boundary);

            // Call boundary callback if provided
            if (session.request.options.onBoundary) {
              session.request.options.onBoundary(boundary);
            }
          }
        }
      }
    } catch (error) {
      this.log(`Error processing audio metadata: ${error}`);
    }
  }

  /**
   * Handle response message
   */
  private handleResponse(
    requestId: string,
    connection: EdgeTTSConnection,
    bodyData: string,
  ): void {
    this.log(`Received Path:response for request (X-RequestId: ${requestId})`);

    try {
      const session = this.activeSessions.get(requestId);
      if (!session) {
        this.log(
          `Received response for unknown session. X-RequestId: ${requestId}`,
        );
        return;
      }

      connection.lastActivity = new Date();

      // Parse response JSON
      const responseData = JSON.parse(bodyData);

      // Log the response data for debugging
      this.log(`Path:response data:`, responseData);

      // The response message typically contains context and audio stream information
      // Based on the sample data: {"context":{"serviceTag":"..."},"audio":{"type":"inline","streamId":"..."}}
      // This is informational and doesn't require special handling beyond logging

      if (responseData.context?.serviceTag) {
        this.log(
          `Path:response Service tag: ${responseData.context.serviceTag}`,
        );
      }

      if (responseData.audio?.streamId) {
        this.log(
          `Path:response Audio stream ID: ${responseData.audio.streamId}`,
        );
      }
    } catch (error) {
      this.log(`Error processing response message: ${error}`);
    }
  }

  /**
   * Handle turn end message
   */
  private handleTurnEnd(
    requestId: string,
    connection: EdgeTTSConnection,
  ): void {
    this.log(`Turn end for X-RequestId ${requestId}`);

    const session = this.activeSessions.get(requestId);
    if (!session) {
      this.log(
        `Received turn end for unknown session. X-RequestId: ${requestId}`,
      );
      return;
    }

    connection.lastActivity = new Date();

    // Mark synthesis as completed
    session.response.completed = true;

    // Calculate total duration
    session.response.duration = this.calculateAudioDuration(
      session.response.audioChunks,
    );

    // Complete the synthesis
    this.completeSynthesis(requestId);
  }

  /**
   * Process boundary event data
   */
  private processBoundaryEvent(
    boundaryData: BoundaryEventData,
    originalText: string,
    currentPosition: number = 0,
  ): { boundary: WordBoundary; nextPosition: number } {
    // Extract word text from boundary data
    const wordText = boundaryData.Data.text?.Text || "";
    const wordLength = boundaryData.Data.text?.Length || wordText.length;

    // Find the word in the original text starting from current position
    const charIndex = this.findWordInText(
      originalText,
      wordText,
      currentPosition,
    );

    // Use the actual word length, but ensure it doesn't exceed text boundaries
    const charLength = Math.min(wordLength, originalText.length - charIndex);

    // Calculate next search position (after this word)
    const nextPosition = charIndex + charLength;

    return {
      boundary: {
        charIndex,
        charLength,
      },
      nextPosition,
    };
  }

  /**
   * Find the next occurrence of a word in text starting from a given position
   */
  private findWordInText(
    text: string,
    word: string,
    startPosition: number,
  ): number {
    if (!word || startPosition >= text.length) {
      return startPosition;
    }

    // Convert both to lowercase for case-insensitive matching
    const lowerText = text.toLowerCase();
    const lowerWord = word.toLowerCase();

    // Find the word starting from the current position
    const index = lowerText.indexOf(lowerWord, startPosition);

    if (index !== -1) {
      return index;
    }

    // If exact match fails, try to find the word ignoring punctuation
    // This handles cases where Edge TTS normalizes text differently
    for (let i = startPosition; i <= text.length - word.length; i++) {
      const textSegment = text.slice(i, i + word.length).toLowerCase();
      // Remove punctuation and whitespace for comparison
      const cleanTextSegment = textSegment.replace(/[^\w]/g, "");
      const cleanWord = lowerWord.replace(/[^\w]/g, "");

      if (cleanTextSegment === cleanWord) {
        return i;
      }
    }

    // If still no match found, return current position to avoid errors
    return startPosition;
  }

  /**
   * Calculate total audio duration
   */
  private calculateAudioDuration(audioChunks: Uint8Array[]): number {
    // Estimate duration based on audio format (MP3 24kHz)
    const totalBytes = audioChunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0,
    );
    const bitRate = AUDIO_CONFIG.bitRate * 1000; // Convert to bits per second
    const durationSeconds = (totalBytes * 8) / bitRate;
    return Math.round(durationSeconds * 1000); // Convert to milliseconds
  }

  // ===========================================================================
  // Synthesis Flow Management
  // ===========================================================================

  /**
   * Perform synthesis with retry logic
   */
  private async performSynthesisWithRetry(
    session: SynthesisSession,
    attempt: number,
  ): Promise<void> {
    const { requestId, connectionId } = session.request;
    this.log(
      `Attempt ${attempt + 1} for synthesis request ${requestId} using connection ${connectionId}`,
    );

    try {
      let connection = this.connections.get(connectionId);
      if (
        !connection ||
        !connection.websocket ||
        connection.websocket.readyState !== WS_OPEN
      ) {
        if (connection) {
          this.log(
            `Connection ${connectionId} exists but is not open (state: ${connection.websocket?.readyState}). Recreating.`,
          );
          if (connection.websocket) {
            connection.websocket.onopen = null;
            connection.websocket.onmessage = null;
            connection.websocket.onerror = null;
            connection.websocket.onclose = null;
            try {
              connection.websocket.close();
            } catch (e) {
              this.log(
                `Error closing stale websocket for ${connectionId}: ${e}`,
              );
            }
          }
          this.connections.delete(connectionId);
        }
        this.log(
          `Creating new connection ${connectionId} for request ${requestId}`,
        );
        connection = await this.createConnection(connectionId);
      } else {
        this.log(
          `Reusing existing open connection ${connectionId} for request ${requestId}`,
        );
      }

      // Send speech config message
      await this.sendSpeechConfig(connection, requestId);

      // Send SSML request
      await this.sendSSMLRequest(connection, session);

      // Set synthesis state
      connection.state = ConnectionState.Synthesizing;

      this.log(`Synthesis started for request ${requestId}`);
    } catch (error) {
      // Clean up connection on error
      await this.closeConnection(requestId);
      throw error;
    }
  }

  /**
   * Perform single synthesis attempt
   */
  private async performSynthesis(session: SynthesisSession): Promise<void> {
    const { request } = session;

    try {
      // Create connection
      const connection = await this.createConnection(request.connectionId);

      // Send speech configuration
      await this.sendSpeechConfig(connection, request.requestId);

      // Send SSML request
      await this.sendSSMLRequest(connection, session);

      // Set synthesis state
      connection.state = ConnectionState.Synthesizing;

      this.log(`Synthesis started for request ${request.requestId}`);
    } catch (error) {
      // Clean up connection on error
      await this.closeConnection(request.connectionId);
      throw error;
    }
  }

  /**
   * Complete synthesis and resolve promise
   */
  private completeSynthesis(requestId: string): void {
    const session = this.activeSessions.get(requestId);
    if (!session) return;

    this.log(`Completing synthesis for request ${requestId}`);

    // Clear timeout
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
    }

    // Check if we have audio data
    if (session.response.audioChunks.length === 0) {
      session.promise.reject(
        new NoAudioReceived("No audio data received from Edge TTS service"),
      );
      this.cleanupSession(requestId);
      return;
    }

    // Complete storage coordination
    this.storageService.markConnectionCompleted(session.request.connectionId);

    // Call completion callback
    if (session.request.options.onDone) {
      try {
        session.request.options.onDone();
      } catch (error) {
        this.log(`Error in onDone callback:`, error);
      }
    }

    // Resolve synthesis promise
    session.promise.resolve(session.response);

    // Cleanup
    this.cleanupSession(requestId);
  }

  /**
   * Handle synthesis timeout
   */
  private handleSynthesisTimeout(requestId: string): void {
    this.log(`Synthesis timeout for request ${requestId}`);

    const session = this.activeSessions.get(requestId);
    if (!session) return;

    session.promise.reject(
      new Error(
        `Synthesis timeout after ${CONNECTION_LIFECYCLE.TIMEOUTS.TOTAL_SYNTHESIS}ms`,
      ),
    );
    this.cleanupSession(requestId);
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(
    connection: EdgeTTSConnection,
    error: Error,
  ): void {
    this.log(`Connection error on ${connection.id}:`, error);

    // Find sessions using this connection
    for (const [requestId, session] of this.activeSessions.entries()) {
      if (session.request.connectionId === connection.id) {
        // Call error callback
        if (session.request.options.onError) {
          try {
            session.request.options.onError(error);
          } catch (callbackError) {
            this.log(`Error in onError callback:`, callbackError);
          }
        }

        // Reject synthesis promise
        session.promise.reject(error);
        this.cleanupSession(requestId);
      }
    }

    // Close connection
    this.closeConnection(connection.id).catch((closeError) => {
      this.log(`Error closing connection ${connection.id}:`, closeError);
    });
  }

  /**
   * Cleanup synthesis session
   */
  private cleanupSession(requestId: string): void {
    const session = this.activeSessions.get(requestId);
    if (!session) return;

    this.log(`Cleaning up session for request ${requestId}`);

    // Clear timeout
    if (session.timeoutHandle) {
      clearTimeout(session.timeoutHandle);
    }

    // Close connection
    this.closeConnection(session.request.connectionId).catch((error) => {
      this.log(`Error closing connection during cleanup:`, error);
    });

    // Remove from active sessions
    this.activeSessions.delete(requestId);
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Debug logging helper
   */
  private log(message: string, ...args: any[]): void {
    if (this.debugLog) {
      console.log(`[NetworkService] ${message}`, ...args);
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      activeSessions: this.activeSessions.size,
      activeConnections: this.connections.size,
      connections: Array.from(this.connections.values()).map((conn) => ({
        id: conn.id,
        state: conn.state,
        createdAt: conn.createdAt,
        lastActivity: conn.lastActivity,
      })),
    };
  }

  // ===========================================================================
  // StateManager Integration Methods
  // ===========================================================================

  /**
   * Initialize the service (for StateManager integration)
   */
  async initialize(): Promise<void> {
    this.log("NetworkService initialized");
    // No specific initialization needed for network service
  }

  /**
   * Cleanup the service (for StateManager integration)
   */
  async cleanup(): Promise<void> {
    this.log("NetworkService cleanup");
    await this.close();
  }

  /**
   * Register callback for connection state changes (for StateManager integration)
   */
  onConnectionStateChange(
    callback: (connectionId: string, state: ConnectionState) => void,
  ): void {
    this.onConnectionStateChangeCallback = callback;
  }

  // Callback for connection state changes
  private onConnectionStateChangeCallback:
    | ((connectionId: string, state: ConnectionState) => void)
    | null = null;

  /**
   * Set connection state and trigger StateManager callback
   */
  private setConnectionState(
    connection: EdgeTTSConnection,
    newState: ConnectionState,
  ): void {
    connection.state = newState;
    if (this.onConnectionStateChangeCallback) {
      this.onConnectionStateChangeCallback(connection.id, newState);
    }
  }
}

/**
 * Default network service instance
 */
export default NetworkService;
