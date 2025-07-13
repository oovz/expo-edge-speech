/**
 * Main library entry point
 *
 * Provides clean public interface with complete exports from all components.
 * Hides internal implementation details behind the public API layer.
 * Compatible with TypeScript and JavaScript projects across different module systems.
 */
export {
  configure,
  speak,
  getAvailableVoicesAsync,
  stop,
  pause,
  resume,
  isSpeakingAsync,
  cleanup,
  maxSpeechInputLength,
  default as Speech,
} from "./Speech";

export type {
  SpeechOptions,
  EdgeSpeechVoice,
  SpeechError,
  WordBoundary,
  SpeechEventCallback,
  SpeechAPIConfig,
  SpeechAudioConfig,
  SpeechNetworkConfig,
  SpeechStorageConfig,
  SpeechVoiceConfig,
  SpeechConnectionConfig,
  CircuitBreakerConfig,
  PlatformAudioConfig,
} from "./types";

export { AudioPlaybackState, UserActionState } from "./services/audioService";

export {
  PARAMETER_RANGES,
  DEFAULT_TIMEOUT,
  MAX_TEXT_LENGTH,
} from "./constants";

export { default } from "./Speech";
