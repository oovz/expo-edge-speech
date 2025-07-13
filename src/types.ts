/**
 * Type definitions for expo-edge-speech
 * Compatible with expo-speech API
 */

import type { InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

// ============================================================================
// Enums
// ============================================================================

// ============================================================================
// Callback Types
// ============================================================================

/**
 * Basic speech event callback type (no parameters)
 */
export type SpeechEventCallback = () => void;

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Word boundary event data
 * Matches expo-speech onBoundary callback data
 */
export interface WordBoundary {
  charIndex: number;
  charLength: number;
}

/**
 * Speech error interface
 * Basic error information for speech operations
 */
export interface SpeechError {
  name: string;
  message: string;
  code?: string | number;
}

/**
 * Speech options interface
 * Matches expo-speech SpeechOptions interface exactly
 */
export interface SpeechOptions {
  language?: string;
  voice?: string;
  pitch?: number;
  rate?: number;
  volume?: number;
  onStart?: (() => void) | SpeechEventCallback;
  onDone?: (() => void) | SpeechEventCallback;
  onError?: ((error: Error) => void) | SpeechEventCallback;
  onStopped?: (() => void) | SpeechEventCallback;
  onBoundary?: ((boundary: WordBoundary) => void) | SpeechEventCallback;
  onMark?: SpeechEventCallback | null;
  onPause?: SpeechEventCallback | null;
  onResume?: SpeechEventCallback | null;
}

/**
 * Edge Speech Voice interface for Microsoft Edge TTS
 * Enhanced interface representing a voice available from the Edge Speech service
 * This is now the standard interface used throughout the project
 */
export interface EdgeSpeechVoice {
  /** Unique voice identifier (e.g., "en-US-AriaNeural") */
  identifier: string;

  /** Human-readable display name */
  name: string;

  /** Language/locale code (e.g., "en-US") */
  language: string;

  /** Voice gender ("Male" or "Female") */
  gender: "Male" | "Female";

  /** Content categories this voice is suitable for */
  contentCategories: string[];

  /** Voice personality traits */
  voicePersonalities: string[];
}

// ============================================================================
// Edge TTS Protocol Types
// ============================================================================

/**
 * Boundary event data interface
 * Based on actual Edge TTS structure
 */
export interface BoundaryEventData {
  Type: "WordBoundary";
  Data: {
    Offset: number;
    Duration: number;
    text: {
      Text: string;
      Length: number;
      BoundaryType: "WordBoundary";
    };
  };
}

/**
 * Speech configuration interface
 * Edge TTS specific configuration sections
 */
export interface SpeechConfiguration {
  /** Audio format configuration (MP3 only for Edge TTS) */
  audioFormat: {
    format: "audio-24khz-48kbitrate-mono-mp3";
    sampleRate: 24000;
    bitRate: 48000;
    channels: 1;
  };
  /** Connection pooling settings */
  connectionPooling: {
    maxConnections: number;
    connectionTimeout: number;
    reuseConnections: boolean;
  };
  /** Word boundary settings */
  wordBoundary: {
    enabled: boolean;
    offsetCompensation: number; // 8,750,000 ticks padding
  };
}

// ============================================================================
// Edge TTS WebSocket Message Types
// ============================================================================

/**
 * Edge TTS WebSocket headers
 */
export interface EdgeTTSHeaders {
  "X-RequestId": string;
  "X-Timestamp": string;
  "Content-Type": string;
  Path: string;
}

/**
 * Edge TTS text message (JSON)
 */
export interface EdgeTTSTextMessage {
  headers: EdgeTTSHeaders;
  body: string | object;
}

/**
 * Edge TTS binary message structure
 */
export interface EdgeTTSBinaryMessage {
  headers: EdgeTTSHeaders;
  audioData: Uint8Array;
}

/**
 * Binary audio message parsing structure
 */
export interface BinaryAudioMessage {
  headerLength: number;
  header: object;
  audioData: Uint8Array;
}

// ============================================================================
// Edge TTS Error Types
// ============================================================================

/**
 * No audio data received from Edge TTS service
 */
export class NoAudioReceived extends Error {
  constructor(message = "No audio data received from Edge TTS service") {
    super(message);
    this.name = "NoAudioReceived";
  }
}

/**
 * Unexpected response format from Edge TTS
 */
export class UnexpectedResponse extends Error {
  constructor(message = "Received unexpected response from Edge TTS") {
    super(message);
    this.name = "UnexpectedResponse";
  }
}

/**
 * Unknown response path from Edge TTS
 */
export class UnknownResponse extends Error {
  constructor(message = "Received response with unknown path") {
    super(message);
    this.name = "UnknownResponse";
  }
}

/**
 * WebSocket connection or communication error
 */
export class WebSocketError extends Error {
  constructor(message = "WebSocket connection error") {
    super(message);
    this.name = "WebSocketError";
  }
}

/**
 * Clock skew adjustment error for Sec-MS-GEC token
 */
export class SkewAdjustmentError extends Error {
  constructor(message = "Failed to adjust clock skew for authentication") {
    super(message);
    this.name = "SkewAdjustmentError";
  }
}

// ============================================================================
// Edge TTS Voice Types
// ============================================================================

/**
 * Edge TTS voice from voice list API
 */
export interface EdgeVoice {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  SuggestedCodec: string;
  Status: string;
}

// ============================================================================
// Connection Management Types
// ============================================================================

/**
 * Connection state enumeration
 */
export enum ConnectionState {
  Disconnected = "disconnected",
  Connecting = "connecting",
  Connected = "connected",
  Synthesizing = "synthesizing",
  Error = "error",
}

/**
 * Edge TTS connection interface
 */
export interface EdgeTTSConnection {
  /** Connection ID: 32-character lowercase string (UUID without dashes) */
  id: string;
  /** WebSocket connection instance */
  websocket: WebSocket | null;
  /** Current connection state */
  state: ConnectionState;
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivity: Date;
}

// ============================================================================
// SSML Generation Types
// ============================================================================

/**
 * SSML configuration with Edge TTS requirements
 */
export interface SSMLConfig {
  /** SSML namespace (required): http://www.w3.org/2001/10/synthesis */
  namespace: "http://www.w3.org/2001/10/synthesis";
  /** Voice name format: Microsoft Server Speech Text to Speech Voice (language, voiceName) */
  voiceNameFormat: string;
  /** Maximum text length for Edge TTS */
  maxTextLength: number;
}

/**
 * SSML prosody options
 */
export interface SSMLProsody {
  rate?: string; // e.g., "+10%", "medium", "slow"
  pitch?: string; // e.g., "+10%", "high", "low"
  volume?: string; // e.g., "+10%", "loud", "soft"
}

// ============================================================================
// Word Boundary Timing Types
// ============================================================================

/**
 * Word boundary timing with offset compensation
 */
export interface WordBoundaryTiming {
  /** Raw offset from Edge TTS (in ticks) */
  rawOffset: number;
  /** Adjusted offset with padding compensation (8,750,000 ticks = 875ms) */
  adjustedOffset: number;
  /** Offset in milliseconds */
  offsetMs: number;
  /** Duration in ticks */
  duration: number;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Timing conversion utilities
 */
export interface TimingConverter {
  /** Convert ticks to milliseconds (10,000 ticks = 1ms) */
  ticksToMs: (ticks: number) => number;
  /** Convert milliseconds to ticks */
  msToTicks: (ms: number) => number;
  /** Apply offset compensation for word boundaries */
  compensateOffset: (rawOffset: number) => number;
}

// ============================================================================
// Authentication and Security Types
// ============================================================================

/**
 * Sec-MS-GEC token generation parameters
 */
export interface SecMSGECToken {
  /** Current time in Windows file time format (100-nanosecond intervals since 1601-01-01) */
  ticks: number;
  /** Clock skew adjustment in ticks (5 minutes = 3,000,000,000 ticks) */
  skewAdjustment: number;
  /** Hash input format: {ticks}MSEdgeSpeechTTS */
  hashInput: string;
  /** Generated token (uppercase SHA256 hex) */
  token: string;
}

/**
 * Authentication headers for Edge TTS
 */
export interface EdgeTTSAuthHeaders {
  "User-Agent": string;
  Origin: string;
  "Sec-MS-GEC": string;
  "Sec-MS-GEC-Version": string;
}

// ============================================================================
// Message Path and Protocol Constants
// ============================================================================

/**
 * Edge TTS WebSocket message paths
 */
export enum MessagePath {
  SpeechConfig = "speech.config",
  SSML = "ssml",
  TurnStart = "turn.start",
  AudioMetadata = "audio.metadata",
  TurnEnd = "turn.end",
}

/**
 * Content types for Edge TTS messages
 */
export enum ContentType {
  JSON = "application/json; charset=utf-8",
  SSML = "application/ssml+xml",
}

// ============================================================================
// Enhanced Audio Configuration Types
// ============================================================================

/**
 * Metadata options for audio synthesis
 */
export interface MetadataOptions {
  /** Enable sentence boundary events */
  sentenceBoundaryEnabled: boolean;
  /** Enable word boundary events */
  wordBoundaryEnabled: boolean;
}

/**
 * Complete synthesis context configuration
 */
export interface SynthesisContext {
  synthesis: {
    audio: {
      metadataoptions: MetadataOptions;
      outputFormat: string;
    };
  };
}

// ============================================================================
// Request/Response Message Types
// ============================================================================

/**
 * SSML synthesis request message
 */
export interface SSMLRequest {
  headers: {
    "X-RequestId": string;
    "X-Timestamp": string;
    "Content-Type": "application/ssml+xml";
    Path: "ssml";
  };
  body: string; // SSML XML content
}

// ============================================================================
// Speech API Configuration Types
// ============================================================================

/**
 * Platform-specific audio configuration for expo-av Audio.setAudioModeAsync()
 * Supports iOS and Android platforms only
 */
export interface PlatformAudioConfig {
  ios: {
    /** Whether audio stays active in background - not available in Expo Go for iOS */
    staysActiveInBackground?: boolean;
    /** Whether audio plays when device is in silent mode - iOS only */
    playsInSilentModeIOS?: boolean;
    /** Audio interruption mode for iOS - required */
    interruptionModeIOS: InterruptionModeIOS;
  };
  android: {
    /** Whether audio stays active in background */
    staysActiveInBackground?: boolean;
    /** Whether TTS should lower other audio while playing - Android only */
    shouldDuckAndroid?: boolean;
    /** Whether audio plays through earpiece - Android only */
    playThroughEarpieceAndroid?: boolean;
    /** Audio interruption mode for Android - required */
    interruptionModeAndroid: InterruptionModeAndroid;
  };
}

/**
 * Audio service configuration interface
 */
export interface SpeechAudioConfig {
  /** Platform-specific audio configurations */
  platformConfig?: PlatformAudioConfig;
  /** Audio loading timeout in milliseconds */
  loadingTimeout?: number;
  /** Whether to initialize audio session automatically */
  autoInitializeAudioSession?: boolean;
}

/**
 * Network service configuration interface
 */
export interface SpeechNetworkConfig {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base retry delay in milliseconds */
  baseRetryDelay?: number;
  /** Maximum retry delay in milliseconds */
  maxRetryDelay?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Graceful close timeout in milliseconds */
  gracefulCloseTimeout?: number;
  /** Enable debug logging */
  enableDebugLogging?: boolean;
}

/**
 * Storage service configuration interface
 */
export interface SpeechStorageConfig {
  /** Maximum buffer size per connection (16MB) */
  maxBufferSize?: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
  /** Memory usage warning threshold (80% of limit) */
  warningThreshold?: number;
}

/**
 * Voice service configuration interface
 */
export interface SpeechVoiceConfig {
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Enable debug logging */
  enableDebugLogging?: boolean;
  /** Network timeout for voice list fetching */
  networkTimeout?: number;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Failure threshold to open circuit */
  failureThreshold?: number;
  /** Recovery timeout before testing */
  recoveryTimeout?: number;
  /** Number of test requests in half-open state */
  testRequestLimit?: number;
}

/**
 * Connection manager configuration interface
 */
export interface SpeechConnectionConfig {
  /** Maximum concurrent connections */
  maxConnections?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
  /** Enable connection pooling for performance */
  poolingEnabled?: boolean;
}

/**
 * Main Speech API configuration interface
 * New in v2.0: Allows configuration of all internal services before initialization
 */
export interface SpeechAPIConfig {
  /** Network service configuration */
  network?: SpeechNetworkConfig;
  /** Audio service configuration */
  audio?: SpeechAudioConfig;
  /** Storage service configuration */
  storage?: SpeechStorageConfig;
  /** Connection manager configuration */
  connection?: SpeechConnectionConfig;
  /** Voice service configuration */
  voice?: SpeechVoiceConfig;
  /** Optional state configuration */
  state?: SpeechStateConfig;
}

/**
 * Speech state configuration interface
 */
export interface SpeechStateConfig {
  /** Initial speech state */
  initialState?: ConnectionState;
  /** Enable/disable event logging */
  enableLogging?: boolean;
  /** Custom event handlers */
  eventHandlers?: {
    onStateChange?: (
      newState: ConnectionState,
      oldState: ConnectionState,
    ) => void;
    onError?: (error: SpeechError) => void;
  };
}
