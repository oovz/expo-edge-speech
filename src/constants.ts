// =============================================================================
// expo-speech Parameter Validation Ranges
// =============================================================================

/**
 * Parameter validation ranges for user-facing API options.
 * These define the numeric input ranges for rate, pitch, and volume.
 * Conversion to SSML percentage strings is handled elsewhere (e.g., ssmlUtils.ts).
 */
export const PARAMETER_RANGES = Object.freeze({
  rate: Object.freeze({
    min: 0.0, // Corresponds to -100% in SSML
    max: 2.0, // Corresponds to +100% in SSML
    default: 1.0, // Corresponds to +0% in SSML
  }),
  pitch: Object.freeze({
    min: 0.0, // Corresponds to -100% in SSML
    max: 2.0, // Corresponds to +100% in SSML
    default: 1.0, // Corresponds to +0% in SSML
  }),
  volume: Object.freeze({
    min: 0.0, // Corresponds to -100% (mute) in SSML
    max: 2.0, // Corresponds to +100% in SSML
    default: 1.0, // Corresponds to +0% in SSML
  }),
});

/**
 * Default voice to use if not specified by the user.
 * Using multilingual Emma as the default voice.
 */
export const DEFAULT_VOICE = "en-US-EmmaMultilingualNeural";

// =============================================================================
// Basic Default Values
// =============================================================================

/**
 * Default timeout for speech operations (5000ms)
 */
export const DEFAULT_TIMEOUT = 5000;

/**
 * Maximum text length for speech input (1000 characters).
 * This is a client-side limit for the input string to the speak method.
 * The Edge TTS service itself handles further chunking based on byte length
 * and SSML overhead.
 */
export const MAX_TEXT_LENGTH = 1000;

// =============================================================================
// Edge TTS Protocol Constants
// =============================================================================

/**
 * Edge TTS Trusted Client Token
 */
export const EDGE_TTS_TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";

/**
 * Edge TTS WebSocket URL template with required query parameters
 * Includes all required authentication and connection parameters
 */
export const EDGE_TTS_WEBSOCKET_URL_TEMPLATE =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&Sec-MS-GEC={secMsGec}&Sec-MS-GEC-Version={secMsGecVersion}&ConnectionId={connectionId}";

/**
 * Base URL for Edge TTS services
 */
export const EDGE_TTS_BASE_URL =
  "speech.platform.bing.com/consumer/speech/synthesize/readaloud";

/**
 * Chromium version for Sec-MS-GEC-Version header
 */
export const CHROMIUM_VERSION = "130.0.2849.68";

/**
 * SEC-MS-GEC version format template
 */
export const SEC_MS_GEC_VERSION = `1-${CHROMIUM_VERSION}`;

/**
 * Edge TTS Voice List API endpoint
 */
export const EDGE_TTS_VOICE_LIST_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${EDGE_TTS_TRUSTED_CLIENT_TOKEN}`;

/**
 * Required WebSocket message headers
 */
export const WEBSOCKET_HEADERS = Object.freeze({
  REQUEST_ID: "X-RequestId",
  TIMESTAMP: "X-Timestamp",
  CONTENT_TYPE: "Content-Type",
  PATH: "Path",
});

/**
 * Connection ID generation format
 * Note: this can be any random 32-character string. We choose to use UUIDv4 without dashes here.
 * Format: UUID v4 without dashes (32-character hexadecimal string)
 * Example: a1b2c3d4e5f67890abcdef1234567890
 */
export const CONNECTION_ID_FORMAT = Object.freeze({
  TYPE: "UUID_V4_NO_DASHES",
  LENGTH: 32,
  FORMAT: "hex",
  DESCRIPTION: "Random UUID v4 without dashes used for connection tracking",
});

/**
 * WebSocket message paths
 */
export const MESSAGE_PATHS = Object.freeze({
  SPEECH_CONFIG: "speech.config",
  SSML: "ssml",
  RESPONSE: "response", // General response, not explicitly used for specific actions in rany2/edge-tts
  TURN_START: "turn.start",
  TURN_END: "turn.end",
  AUDIO_METADATA: "audio.metadata",
});

/**
 * Content types for WebSocket messages
 */
export const CONTENT_TYPES = Object.freeze({
  JSON: "application/json; charset=utf-8",
  SSML: "application/ssml+xml",
});

/**
 * Default audio format for Edge TTS
 * This is the only format supported by Edge TTS for this endpoint.
 */
export const DEFAULT_AUDIO_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

/**
 * Supported audio formats for Edge TTS
 * Edge TTS only supports MP3 at 24kHz 48kbps mono
 */
export const AUDIO_FORMATS = Object.freeze({
  MP3_24KHZ_48KBPS: "audio-24khz-48kbitrate-mono-mp3",
});

/**
 * Edge TTS connection configuration
 */
export const EDGE_TTS_CONFIG = Object.freeze({
  connectionTimeout: 10000,
  audioTimeout: 5000,
  maxRetries: 3,
  retryDelay: 1000,
  connectionPoolSize: 1, // Edge TTS uses single connection per synthesis
  maxConcurrentConnections: 1,
  keepAliveInterval: 30000, // 30 seconds
});

/**
 * Voice caching configuration
 */
export const VOICE_CACHING = Object.freeze({
  VOICE_LIST_TTL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  VOICE_LIST_REFRESH_INTERVAL: 6 * 60 * 60 * 1000, // 6 hours refresh interval
  MAX_CACHE_SIZE: 1000, // Maximum number of voices to cache
  ENABLE_FALLBACK_CACHE: true, // Allow using expired cache as fallback
});

/**
 * Timestamp format constants for Edge TTS WebSocket messages
 */
export const TIMESTAMP_FORMAT = Object.freeze({
  REQUIRED_SUFFIX: "Z", // All timestamps must end with 'Z'
  MICROSECOND_PRECISION: true, // Timestamps use microsecond precision
  MULTIPLIER: 1000000, // Convert seconds to microseconds
  EXAMPLE: "1234567890123456Z", // Example format: microseconds + Z
});

/**
 * Enhanced authentication constants from corrected protocol
 */
export const AUTHENTICATION = Object.freeze({
  TRUSTED_CLIENT_TOKEN: "6A5AA1D4EAFF4E9FB37E23D68491D6F4",
  SEC_MS_GEC_VERSION_TEMPLATE: "1-{version}", // Template for version header
  CHROME_VERSION_CURRENT: CHROMIUM_VERSION,
  CHROME_VERSION_EDGE_TESTED: "91.0.864.41", // Version tested with Edge TTS protocol
  ORIGIN_EXTENSION: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold", // Required origin
});

/**
 * WebSocket message configuration
 */
export const WEBSOCKET_CONFIG = Object.freeze({
  binaryType: "arraybuffer" as BinaryType,
  protocols: [],
  closeTimeout: 5000,
});

/**
 * Audio processing configuration
 */
export const AUDIO_CONFIG = Object.freeze({
  defaultFormat: DEFAULT_AUDIO_FORMAT,
  enableWordBoundary: true,
  enableSentenceBoundary: false,
  bufferSize: 4096, // Default buffer size for audio chunks
  maxBufferSize: 65536, // 64KB maximum buffer size
  minBufferSize: 1024, // 1KB minimum buffer size
  streamingChunkSize: 8192, // Preferred chunk size for streaming
  sampleRate: 24000, // Edge TTS fixed sample rate (24kHz)
  bitRate: 48000, // Edge TTS fixed bit rate (48kbps)
  channels: 1, // Edge TTS mono audio
});

/**
 * Enhanced audio streaming and buffer management constants
 */
export const AUDIO_STREAMING = Object.freeze({
  CHUNK_PROCESSING: {
    MIN_CHUNK_SIZE: 256, // Minimum audio chunk size for processing
    MAX_CHUNK_SIZE: 32768, // Maximum audio chunk size (32KB)
    PREFERRED_CHUNK_SIZE: 8192, // Preferred chunk size for optimal performance
    BUFFER_THRESHOLD: 16384, // Buffer threshold before playback
  },
  PLAYBACK_BUFFER: {
    PRELOAD_SIZE: 4096, // Preload buffer size for smooth playback
    UNDERRUN_THRESHOLD: 1024, // Buffer underrun detection threshold
    OVERRUN_PROTECTION: 131072, // Maximum buffer size to prevent memory issues (128KB)
  },
  STREAMING_TIMEOUT: {
    CHUNK_TIMEOUT: 2000, // Timeout for individual chunk (2 seconds)
    TOTAL_TIMEOUT: 30000, // Total streaming timeout (30 seconds)
    SILENCE_TIMEOUT: 5000, // Timeout for silence detection (5 seconds)
  },
});

/**
 * Message formatting requirements
 */
export const MESSAGE_FORMAT = Object.freeze({
  LINE_ENDING: "\r\n",
  HEADER_SEPARATOR: "\r\n\r\n",
  HEADER_VALUE_SEPARATOR: ":", // check text-message.txt for example
});

/**
 * Binary message structure constants
 */
export const BINARY_MESSAGE = Object.freeze({
  HEADER_LENGTH_BYTES: 2,
  HEADER_LENGTH_TYPE: "Int16",
  AUDIO_FORMAT: "MP3",
});

/**
 * Enhanced binary message parsing constants with specific endianness details
 */
export const BINARY_MESSAGE_PARSING = Object.freeze({
  HEADER: {
    LENGTH_BYTES: 2, // Header length stored in first 2 bytes
    LENGTH_TYPE: "Int16", // 16-bit integer
    ENDIANNESS: "big", // Big-endian byte order (corrected from protocol)
    ENCODING: "utf-8", // Header JSON encoding
  },
  AUDIO: {
    FORMAT: "audio/mpeg", // MIME type for audio content
    ENCODING: "mp3", // Audio encoding format
    EXPECTED_MAGIC: [0xff, 0xfb], // MP3 frame header magic bytes (common)
  },
  VALIDATION: {
    MIN_HEADER_LENGTH: 10, // Minimum valid header length
    MAX_HEADER_LENGTH: 1024, // Maximum expected header length
    MIN_AUDIO_LENGTH: 32, // Minimum valid audio chunk length
  },
});

/**
 * Message path validation constants
 */
export const MESSAGE_PATH_VALIDATION = Object.freeze({
  VALID_PATHS: [
    "speech.config",
    "ssml",
    "response",
    "turn.start",
    "turn.end",
    "audio.metadata",
    "audio",
  ],
  REQUIRED_PATHS: ["speech.config", "ssml"], // Paths that must be sent
  RESPONSE_PATHS: [
    "response",
    "turn.start",
    "turn.end",
    "audio.metadata",
    "audio",
  ], // Expected response paths
  PATH_SEPARATOR: ".", // Separator used in path names
});

/**
 * Content type validation constants
 */
export const CONTENT_TYPE_VALIDATION = Object.freeze({
  VALID_TYPES: [
    "application/json; charset=utf-8",
    "application/ssml+xml",
    "audio/mpeg",
  ],
  CHARSET_REQUIRED: ["application/json"], // Content types that require charset
  DEFAULT_CHARSET: "utf-8", // Default charset when required
});

// =============================================================================
// Additional Edge TTS Protocol Constants
// =============================================================================

/**
 * SSML namespace requirement
 */
export const SSML_NAMESPACE = "http://www.w3.org/2001/10/synthesis";

/**
 * Voice name format pattern for Microsoft Edge TTS
 * Format: "Microsoft Server Speech Text to Speech Voice (lang-region, NameNeural)"
 */
export const VOICE_NAME_FORMAT = Object.freeze({
  PREFIX: "Microsoft Server Speech Text to Speech Voice",
  PATTERN:
    "Microsoft Server Speech Text to Speech Voice ({lang}-{region}, {name})",
  EXAMPLE: "Microsoft Server Speech Text to Speech Voice (en-US, AriaNeural)",
});

/**
 * Required WebSocket connection headers
 */
export const WSS_HEADERS = Object.freeze({
  USER_AGENT:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  ORIGIN: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
  PRAGMA: "no-cache",
  CACHE_CONTROL: "no-cache",
  ACCEPT_ENCODING: "gzip, deflate, br",
  ACCEPT_LANGUAGE: "en-US,en;q=0.9",
});

/**
 * Enhanced connection lifecycle constants
 */
export const CONNECTION_LIFECYCLE = Object.freeze({
  TIMEOUTS: {
    CONNECTION_ESTABLISHMENT: 10000, // WebSocket connection timeout (10s)
    MESSAGE_RESPONSE: 5000, // Individual message response timeout (5s)
    TOTAL_SYNTHESIS: 30000, // Total synthesis operation timeout (30s)
    TURN_END_WAIT: 3000, // Wait for turn.end message timeout (3s)
    GRACEFUL_CLOSE: 2000, // Graceful connection close timeout (2s)
  },
  RETRY_LIMITS: {
    CONNECTION_ATTEMPTS: 3, // Maximum connection retry attempts
    AUTH_FAILURES: 2, // Maximum authentication retry attempts
    MESSAGE_RESENDS: 1, // Maximum message resend attempts
    CLOCK_SKEW_ADJUSTMENTS: 3, // Maximum clock skew adjustment attempts
  },
  POOL_MANAGEMENT: {
    MAX_POOL_SIZE: 1, // Edge TTS uses single connection per synthesis
    CONNECTION_REUSE: false, // Do not reuse connections for new synthesis
    IDLE_TIMEOUT: 60000, // Connection idle timeout (60s)
    CLEANUP_INTERVAL: 30000, // Pool cleanup interval (30s)
  },
});

/**
 * Enhanced SSML validation and processing constants
 */
export const SSML_VALIDATION = Object.freeze({
  REQUIRED_ATTRIBUTES: {
    SPEAK: ["version", "xmlns", "xml:lang"], // Required attributes for <speak>
    VOICE: ["name"], // Required attributes for <voice>
  },
  NAMESPACE_VALIDATION: {
    REQUIRED_NAMESPACE: "http://www.w3.org/2001/10/synthesis",
    NAMESPACE_PREFIX: "xmlns",
    VALIDATION_REQUIRED: true,
  },
  PROSODY_RANGES: {
    RATE: {
      MIN_RELATIVE: -50, // Minimum relative rate (-50%)
      MAX_RELATIVE: 100, // Maximum relative rate (+100%)
      UNIT: "percent",
      RELATIVE_PATTERN: /^[+-]\d+%$/,
    },
    PITCH: {
      MIN_RELATIVE: -50, // Minimum relative pitch (-50%)
      MAX_RELATIVE: 100, // Maximum relative pitch (+100%)
      UNIT: "percent",
      RELATIVE_PATTERN: /^[+-]\d+%$/,
      HZ_PATTERN: /^[+-]\d+Hz$/,
    },
    VOLUME: {
      MIN_RELATIVE: -50, // Minimum relative volume (-50%)
      MAX_RELATIVE: 100, // Maximum relative volume (+100%)
      UNIT: "percent",
      RELATIVE_PATTERN: /^[+-]\d+%$/,
    },
  },
  TEXT_LIMITS: {
    MAX_SSML_LENGTH: 8000, // Maximum SSML document length
    // SSML generation might have its own effective limits due to overhead.
    MAX_VOICE_ELEMENTS: 5, // Maximum number of voice elements
    MAX_PROSODY_NESTING: 3, // Maximum prosody element nesting depth
  },
});

/**
 * Sec-MS-GEC token generation constants
 */
export const SEC_MS_GEC_GENERATION = Object.freeze({
  WIN_EPOCH: 11644473600, // Windows file time epoch offset
  S_TO_NS: 1e9, // Seconds to nanoseconds conversion
  CLOCK_SKEW_MINUTES: 5, // 5-minute clock skew for rounding
  CLOCK_SKEW_SECONDS: 300, // 5 minutes in seconds
  CLOCK_SKEW_TICKS: 3000000000, // 5 minutes in ticks (3,000,000,000 ticks)
  HASH_INPUT_FORMAT: "{ticks}MSEdgeSpeechTTS", // Format: windowsFileTimeTicks + "MSEdgeSpeechTTS"
  HASH_ALGORITHM: "SHA-256", // Hash algorithm for token generation
  RESULT_FORMAT: "uppercase", // Result must be uppercase hexadecimal
});

/**
 * Word boundary offset padding compensation
 * Used to compensate for Edge TTS service padding in word boundary events
 */
export const WORD_BOUNDARY_OFFSET_COMPENSATION = 8_750_000; // ticks

/**
 * Timing conversion constants for Edge TTS
 */
export const TIMING_CONVERSION = Object.freeze({
  TICKS_PER_MILLISECOND: 10000, // 10,000 ticks = 1 millisecond
  TICKS_PER_SECOND: 10_000_000, // 10 million ticks = 1 second
  MS_TO_TICKS_MULTIPLIER: 10000,
  TICKS_TO_MS_DIVISOR: 10000,
});

/**
 * Edge TTS Exception types
 */
export const EDGE_TTS_EXCEPTIONS = Object.freeze({
  NO_AUDIO_RECEIVED: "NoAudioReceived",
  UNEXPECTED_RESPONSE: "UnexpectedResponse",
  UNKNOWN_RESPONSE: "UnknownResponse",
  WEBSOCKET_ERROR: "WebSocketError",
  SKEW_ADJUSTMENT_ERROR: "SkewAdjustmentError",
});

/**
 * Enhanced error handling and diagnostic constants
 */
export const ERROR_HANDLING = Object.freeze({
  EXCEPTION_CATEGORIES: {
    AUTHENTICATION: ["SKEW_ADJUSTMENT_ERROR", "WEBSOCKET_ERROR"],
    NETWORK: ["WEBSOCKET_ERROR", "UNEXPECTED_RESPONSE"],
    PROTOCOL: ["UNKNOWN_RESPONSE", "UNEXPECTED_RESPONSE"],
    AUDIO: ["NO_AUDIO_RECEIVED"],
  },
  RETRY_STRATEGIES: {
    AUTHENTICATION_ERRORS: {
      MAX_RETRIES: 2,
      BACKOFF_MS: [1000, 2000], // Exponential backoff
      RESET_TOKEN: true, // Regenerate Sec-MS-GEC token
    },
    NETWORK_ERRORS: {
      MAX_RETRIES: 3,
      BACKOFF_MS: [500, 1000, 2000],
      RESET_CONNECTION: true,
    },
    PROTOCOL_ERRORS: {
      MAX_RETRIES: 1, // Protocol errors rarely benefit from retry
      BACKOFF_MS: [1000],
      RESET_CONNECTION: true,
    },
  },
  DIAGNOSTIC_INFO: {
    INCLUDE_HEADERS: true, // Include WebSocket headers in error info
    INCLUDE_TIMESTAMP: true, // Include timing information
    INCLUDE_CONNECTION_ID: true, // Include connection tracking info
    TRUNCATE_LARGE_PAYLOADS: 1000, // Truncate payloads larger than 1KB
  },
});

/**
 * Protocol compliance validation constants
 */
export const PROTOCOL_COMPLIANCE = Object.freeze({
  WEBSOCKET_SUBPROTOCOLS: [], // Edge TTS doesn't use subprotocols
  REQUIRED_MESSAGE_HEADERS: [
    "X-RequestId",
    "X-Timestamp",
    "Content-Type",
    "Path",
  ],
  OPTIONAL_MESSAGE_HEADERS: ["Content-Length"], // May be present in some messages
  HEADER_VALIDATION: {
    REQUEST_ID_FORMAT: /^[a-f0-9]{32}$/, // 32-character hex (connection ID)
    TIMESTAMP_FORMAT: /^\d{16}Z$/, // 16-digit microsecond timestamp + Z
    CONTENT_TYPE_STRICT: true, // Validate content-type matches expected values
    PATH_CASE_SENSITIVE: true, // Path validation is case-sensitive
  },
  MESSAGE_ORDER: {
    REQUIRED_SEQUENCE: ["speech.config", "ssml"], // Required message order
    EXPECTED_RESPONSES: ["turn.start", "audio.metadata", "audio", "turn.end"],
    VALIDATE_ORDER: true, // Enforce message ordering
  },
});

/**
 * Binary message parsing format constants
 */
export const BINARY_PARSING = Object.freeze({
  HEADER_LENGTH_BYTES: 2,
  HEADER_ENCODING: "big", // big-endian for Int16 (corrected from protocol analysis)
  CONTENT_TYPE_AUDIO: "audio/mpeg",
  PATH_AUDIO: "audio",
});
