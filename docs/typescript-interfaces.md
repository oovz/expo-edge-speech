# TypeScript Interfaces

This document provides comprehensive TypeScript interface documentation for expo-edge-speech, ensuring full type safety and excellent developer experience.

## Overview

expo-edge-speech is fully typed with comprehensive TypeScript interfaces that provide:

- 🎯 **Complete Type Safety** - Compile-time error checking and IDE support
- 🔧 **API Compatibility** - 100% compatible with expo-speech interfaces
- 📚 **Rich Documentation** - Detailed interface descriptions and usage examples
- 🚀 **Modern TypeScript** - Latest TypeScript features and best practices

**Key Interface Categories:**
- 🎙️ **Core Interfaces** - Main API types (`SpeechOptions`, `EdgeSpeechVoice`, `WordBoundary`)
- ⚙️ **Configuration Interfaces** - Service configuration types (`SpeechAPIConfig`)
- 🔧 **Utility Types** - Helper types and callbacks
- 🌐 **Platform Types** - Platform-specific configurations
- ❌ **Error Types** - Speech-specific error handling interfaces

## Core Interfaces

### `SpeechOptions`

Primary interface for speech synthesis configuration, fully compatible with expo-speech API.

```typescript
interface SpeechOptions {
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
```

#### Property Details

**`language?: string`**
- Language code for speech synthesis (IETF BCP 47 format)
- Examples: `'en-US'`, `'fr-FR'`, `'de-DE'`, `'zh-CN'`
- Used for automatic voice selection when `voice` is not specified
- Supports regional variants (e.g., `'en-GB'` vs `'en-US'`)
- Especially useful with multilingual voices that support multiple languages

**`voice?: string`**
- Unique voice identifier for speech synthesis
- Format: `'{language}-{voiceName}Neural'` or `'{language}-{voiceName}MultilingualNeural'`
- Examples: `'en-US-AriaNeural'`, `'fr-FR-DeniseNeural'`, `'en-US-EmmaMultilingualNeural'`
- Overrides `language` selection when specified
- Use `getAvailableVoicesAsync()` to get valid identifiers

**`pitch?: number`**
- Voice pitch modification
- Range: 0.5 (lowest) to 2.0 (highest)
- Default: 1.0 (normal pitch)
- Values outside range are automatically clamped by the library
- Useful for creating different character voices or accessibility needs

**`rate?: number`**
- Speech rate modification  
- Range: 0.1 (slowest) to 3.0 (fastest)
- Default: 1.0 (normal speed)
- Values outside range are automatically clamped by the library
- Ideal for accessibility applications or language learning

**`volume?: number`**
- Audio volume level
- Range: 0.0 (muted) to 1.0 (maximum)
- Default: 1.0 (full volume)
- Values outside range are automatically clamped by the library
- Note: System audio settings also affect final output volume

#### Event Callbacks

All event callbacks are optional and provide hooks into the speech synthesis lifecycle.

**`onStart?: (() => void) | SpeechEventCallback`**
- Called when audio playback begins (not when synthesis starts)
- Fired after audio setup is complete and actual playback starts
- Use for UI updates to show "speaking" state
- Ideal for updating progress indicators or button states

**`onDone?: (() => void) | SpeechEventCallback`**  
- Called when speech synthesis completes successfully
- Fired after all audio has finished playing
- Use for cleanup, chaining multiple speech operations, or UI updates
- Only called for successful completion (not for stops or errors)

**`onError?: ((error: Error) => void) | SpeechEventCallback`**
- Called when an error occurs during synthesis or playback
- Receives Error object with detailed failure information
- Essential for robust error handling and fallback strategies
- Can be used for retry logic or user notifications

**`onStopped?: (() => void) | SpeechEventCallback`**
- Called when speech is stopped via `stop()` function
- Different from `onDone` which indicates natural completion
- Use for handling user-initiated cancellation
- Not called for errors or natural completion

**`onBoundary?: ((boundary: WordBoundary) => void) | SpeechEventCallback`**
- Called for each word boundary during speech synthesis
- Provides character position and length for text synchronization
- Essential for real-time text highlighting during speech
- Enables karaoke-style word highlighting effects

**`onPause?: SpeechEventCallback | null`**
- Called when speech is paused via `pause()` function
- **Important**: Only works during audio playback phase, not during network synthesis
- Use for updating UI to show paused state
- Platform-dependent functionality

**`onResume?: SpeechEventCallback | null`**
- Called when speech is resumed from pause via `resume()` function
- **Important**: Only works during audio playback phase, not during network synthesis
- Use for updating UI to show resumed state
- Platform-dependent functionality

**`onMark?: SpeechEventCallback | null`**
- Reserved for SSML mark events (future enhancement)
- Currently not implemented in Edge TTS integration
- Included for future compatibility with SSML features

#### Usage Examples

**Basic Configuration:**
```typescript
const basicOptions: SpeechOptions = {
  voice: 'en-US-AriaNeural',
  rate: 1.2,
  pitch: 1.0,
  volume: 0.8
};

await Speech.speak('Hello world', basicOptions);
```

**Advanced with All Callbacks:**
```typescript
const advancedOptions: SpeechOptions = {
  voice: 'en-US-ChristopherNeural',
  rate: 1.0,
  pitch: 1.1,
  volume: 0.9,
  onStart: () => {
    console.log('Speech started');
    updateUI({ status: 'speaking' });
  },
  onDone: () => {
    console.log('Speech completed');
    updateUI({ status: 'completed' });
  },
  onError: (error) => {
    console.error('Speech error:', error);
    updateUI({ status: 'error', error: error.message });
  },
  onStopped: () => {
    console.log('Speech stopped by user');
    updateUI({ status: 'stopped' });
  },
  onBoundary: (boundary) => {
    console.log(`Word at position ${boundary.charIndex}`);
    highlightText(boundary.charIndex, boundary.charLength);
  },
  onPause: () => {
    console.log('Speech paused');
    updateUI({ status: 'paused' });
  },
  onResume: () => {
    console.log('Speech resumed');
    updateUI({ status: 'speaking' });
  }
};

await Speech.speak('This is a comprehensive example', advancedOptions);
```

**Language Learning Example:**
```typescript
const languageLearningOptions: SpeechOptions = {
  voice: 'es-ES-ElviraNeural',
  rate: 0.7,        // Slower for learning
  pitch: 1.0,
  volume: 1.0,
  language: 'es-ES',
  onBoundary: (boundary) => {
    // Highlight current word for language learning
    highlightSpanishWord(boundary);
  }
};

await Speech.speak('Hola, ¿cómo estás?', languageLearningOptions);
```

---

### `EdgeSpeechVoice`

Interface representing a voice available from the Microsoft Edge TTS service. This is the standard voice interface used throughout the library.

```typescript
interface EdgeSpeechVoice {
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
```

#### Property Details

**`identifier: string`**
- Unique voice identifier for use in `SpeechOptions.voice`
- Format: `{language}-{voiceName}Neural` or `{language}-{voiceName}MultilingualNeural`
- Examples: `'en-US-AriaNeural'`, `'en-US-EmmaMultilingualNeural'`, `'fr-FR-DeniseNeural'`
- This exact string must be used in speech options for voice selection

**`name: string`**
- Human-readable voice name for display in user interfaces
- Examples: `'Microsoft Aria Online (Natural) - English (United States)'`
- Suitable for user-facing voice selection lists and accessibility descriptions

**`language: string`**
- Primary language/locale code for the voice (IETF BCP 47 format)
- Examples: `'en-US'`, `'fr-FR'`, `'de-DE'`, `'zh-CN'`
- **Note**: Multilingual voices may support additional languages beyond their primary

**`gender: "Male" | "Female"`**
- Voice gender classification
- Provides consistent gender information for voice filtering and selection
- Useful for applications requiring specific gender preferences

**`contentCategories: string[]`**
- Array of content categories this voice is optimized for
- Common values: `['General']`, `['News', 'Novel']`, `['Conversation', 'Copilot']`
- Helps select appropriate voices for specific content types and use cases

**`voicePersonalities: string[]`**
- Array of personality traits and characteristics associated with this voice
- Common values: `['Friendly', 'Positive']`, `['Warm', 'Confident']`, `['Clear', 'Professional']`
- Provides additional voice characteristics for more nuanced selection

#### Voice Selection Examples

**Filter by Language:**
```typescript
const voices = await Speech.getAvailableVoicesAsync();

// Find all English voices
const englishVoices = voices.filter(voice => 
  voice.language.startsWith('en-')
);

// Find specific regional variant
const britishVoices = voices.filter(voice =>
  voice.language === 'en-GB'
);

// Find American English voices
const americanVoices = voices.filter(voice =>
  voice.language === 'en-US'
);
```

**Filter by Gender:**
```typescript
// Find female voices
const femaleVoices = voices.filter(voice =>
  voice.gender === 'Female'
);

// Find male voices for specific language
const maleFrenchVoices = voices.filter(voice =>
  voice.language === 'fr-FR' && voice.gender === 'Male'
);
```

**Filter by Capabilities:**
```typescript
// Find multilingual voices
const multilingualVoices = voices.filter(voice =>
  voice.identifier.includes('Multilingual')
);

// Find voices suitable for news reading
const newsVoices = voices.filter(voice =>
  voice.contentCategories.includes('News')
);

// Find friendly, conversational voices
const friendlyVoices = voices.filter(voice =>
  voice.voicePersonalities.includes('Friendly') &&
  voice.contentCategories.includes('Conversation')
);
```

**Smart Voice Selection:**
```typescript
function selectOptimalVoice(
  voices: EdgeSpeechVoice[], 
  language: string, 
  gender?: 'Male' | 'Female',
  contentType?: string
): EdgeSpeechVoice | null {
  
  // Priority 1: Multilingual voices for the language
  let candidates = voices.filter(voice =>
    voice.language === language &&
    voice.identifier.includes('Multilingual')
  );
  
  if (candidates.length === 0) {
    // Priority 2: Regular voices for the language  
    candidates = voices.filter(voice => voice.language === language);
  }
  
  if (candidates.length === 0) {
    // Priority 3: Any voice with similar language (e.g., en-GB for en-US)
    const languageCode = language.split('-')[0];
    candidates = voices.filter(voice => 
      voice.language.startsWith(languageCode + '-')
    );
  }
  
  // Filter by gender if specified
  if (gender) {
    const genderFiltered = candidates.filter(voice => voice.gender === gender);
    if (genderFiltered.length > 0) {
      candidates = genderFiltered;
    }
  }
  
  // Filter by content type if specified
  if (contentType) {
    const contentFiltered = candidates.filter(voice =>
      voice.contentCategories.includes(contentType)
    );
    if (contentFiltered.length > 0) {
      candidates = contentFiltered;
    }
  }
  
  return candidates.length > 0 ? candidates[0] : null;
}

// Usage
const voice = selectOptimalVoice(voices, 'en-US', 'Female', 'News');
if (voice) {
  await Speech.speak('Breaking news...', { voice: voice.identifier });
}
```

**Voice Caching Pattern:**
```typescript
class VoiceManager {
  private voiceCache: EdgeSpeechVoice[] | null = null;
  private languageMap: Map<string, EdgeSpeechVoice[]> = new Map();
  
  async getVoices(): Promise<EdgeSpeechVoice[]> {
    if (!this.voiceCache) {
      this.voiceCache = await Speech.getAvailableVoicesAsync();
      this.buildLanguageMap();
    }
    return this.voiceCache;
  }
  
  private buildLanguageMap() {
    if (!this.voiceCache) return;
    
    for (const voice of this.voiceCache) {
      const existing = this.languageMap.get(voice.language) || [];
      existing.push(voice);
      this.languageMap.set(voice.language, existing);
    }
  }
  
  async getVoicesForLanguage(language: string): Promise<EdgeSpeechVoice[]> {
    await this.getVoices(); // Ensure cache is loaded
    return this.languageMap.get(language) || [];
  }
  
  async findVoice(identifier: string): Promise<EdgeSpeechVoice | null> {
    const voices = await this.getVoices();
    return voices.find(voice => voice.identifier === identifier) || null;
  }
}

// Usage
const voiceManager = new VoiceManager();
const englishVoices = await voiceManager.getVoicesForLanguage('en-US');
```

---

### `WordBoundary`

Interface for word boundary events during speech synthesis, providing precise timing information for text synchronization.

```typescript
interface WordBoundary {
  /** Zero-based character index where the word starts in the original text */
  charIndex: number;
  /** Length of the word in characters */
  charLength: number;
}
```

#### Properties

**`charIndex: number`**
- Zero-based character index where the word starts in the original text
- Used for calculating word position in the source text
- Essential for text highlighting and synchronization features

**`charLength: number`**
- Length of the word in characters
- Used to determine word end position: `charIndex + charLength`
- Enables precise word selection and highlighting

#### Usage Examples

```typescript
const text = "Hello beautiful world";

Speech.speak(text, {
  onBoundary: (boundary) => {
    // Extract the current word being spoken
    const word = text.slice(boundary.charIndex, boundary.charIndex + boundary.charLength);
    console.log(`Speaking word: "${word}" at position ${boundary.charIndex}`);
    
    // Highlight word in UI
    highlightText(boundary.charIndex, boundary.charLength);
  }
});

// Implementation for real-time text highlighting
function highlightText(start: number, length: number) {
  const element = document.getElementById('speech-text');
  if (element) {
    // Clear previous highlights
    element.innerHTML = text;
    
    // Add highlight to current word
    const before = text.slice(0, start);
    const word = text.slice(start, start + length);
    const after = text.slice(start + length);
    
    element.innerHTML = `${before}<mark>${word}</mark>${after}`;
  }
}

// React Native implementation
function ReactNativeHighlighter({ text }: { text: string }) {
  const [currentWord, setCurrentWord] = useState<{ start: number; length: number } | null>(null);

  const renderHighlightedText = () => {
    if (!currentWord) {
      return <Text>{text}</Text>;
    }

    const { start, length } = currentWord;
    const before = text.slice(0, start);
    const highlighted = text.slice(start, start + length);
    const after = text.slice(start + length);

    return (
      <Text>
        {before}
        <Text style={{ backgroundColor: 'yellow' }}>{highlighted}</Text>
        {after}
      </Text>
    );
  };

  return (
    <View>
      {renderHighlightedText()}
      <Button
        title="Speak with Highlighting"
        onPress={() => {
          Speech.speak(text, {
            onBoundary: (boundary) => {
              setCurrentWord({ start: boundary.charIndex, length: boundary.charLength });
            },
            onDone: () => {
              setCurrentWord(null); // Clear highlight when done
            }
          });
        }}
      />
    </View>
  );
}
```

### `SpeechError`

Interface for speech synthesis error handling with detailed error information.

```typescript
interface SpeechError {
  /** Error type identifier */
  name: string;
  /** Human-readable error description */
  message: string;
  /** Optional error code for programmatic handling */
  code?: string | number;
}
```

#### Properties

**`name: string`**
- Error type identifier for categorizing errors
- Common values: `'SpeechError'`, `'NetworkError'`, `'AudioError'`
- Useful for error logging and analytics

**`message: string`**
- Human-readable error description providing details about the failure
- Should be descriptive enough for debugging but not expose sensitive information
- Examples: `'Voice not available'`, `'Network connection failed'`, `'Audio playback failed'`

**`code?: string | number`**
- Optional error code for programmatic error handling
- Enables specific error handling strategies based on error type
- Common codes: `'NETWORK_ERROR'`, `'INVALID_VOICE'`, `'AUDIO_ERROR'`

#### Error Handling Examples

```typescript
Speech.speak('Test text', {
  onError: (error) => {
    const speechError = error as SpeechError;
    
    // Handle specific error types
    switch (speechError.code) {
      case 'NETWORK_ERROR':
        console.log('Network issue - check internet connection');
        showRetryOption();
        break;
      case 'INVALID_VOICE':
        console.log('Voice not available - using default');
        retryWithDefaultVoice();
        break;
      case 'AUDIO_ERROR':
        console.log('Audio playback failed - check device settings');
        showAudioTroubleshooting();
        break;
      default:
        console.log('Speech error:', speechError.message);
        showGenericError(speechError.message);
    }
  }
});

// Comprehensive error handling with fallbacks
const speakWithErrorHandling = async (text: string, options: SpeechOptions = {}) => {
  try {
    await new Promise<void>((resolve, reject) => {
      Speech.speak(text, {
        ...options,
        onDone: () => resolve(),
        onError: (error) => {
          const speechError = error as SpeechError;
          
          // Log error for debugging
          console.error('Speech Error:', {
            name: speechError.name,
            message: speechError.message,
            code: speechError.code,
            timestamp: new Date().toISOString()
          });
          
          reject(speechError);
        }
      });
    });
  } catch (error) {
    // Implement fallback strategies
    const speechError = error as SpeechError;
    
    if (speechError.code === 'INVALID_VOICE') {
      // Retry with default voice
      return speakWithErrorHandling(text, { ...options, voice: undefined });
    } else if (speechError.code === 'NETWORK_ERROR') {
      // Show offline message
      showOfflineMessage();
    } else {
      // Show generic error
      showErrorNotification(speechError.message);
    }
  }
};
```

## Type Aliases

### `SpeechEventCallback`

```typescript
type SpeechEventCallback = () => void;
```

Basic callback type for speech events with no parameters.

### `SpeechErrorCallback`

```typescript
type SpeechErrorCallback = (error: Error) => void;
```

Callback type for error events with Error parameter.

### `SpeechBoundaryCallback`

```typescript
type SpeechBoundaryCallback = (boundary: WordBoundary) => void;
```

Callback type for word boundary events with WordBoundary parameter.

## Advanced Types

### Edge TTS Specific Types

These types are used internally but may be useful for advanced use cases:

```typescript
interface EdgeSpeechVoice {
  identifier: string;
  name: string;
  language: string;
  gender: 'Male' | 'Female';
  contentCategories: string[];
  voicePersonalities: string[];
}
```

## Speech API Configuration

### `SpeechAPIConfig`

Main configuration interface for creating Speech instances with custom settings for all internal services.

```typescript
interface SpeechAPIConfig {
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
}
```

#### Properties

**`network?: SpeechNetworkConfig`**
- Configuration for network service that handles Edge TTS communication
- Controls retries, timeouts, and debugging
- See `SpeechNetworkConfig` below for details

**`audio?: SpeechAudioConfig`**
- Configuration for audio service that handles platform-specific playback
- Controls loading timeouts and platform-specific audio settings
- See `SpeechAudioConfig` below for details

**`storage?: SpeechStorageConfig`**
- Configuration for storage service that manages memory buffering
- Controls buffer sizes and cleanup behavior
- See `SpeechStorageConfig` below for details

**`connection?: SpeechConnectionConfig`**
- Configuration for connection manager that coordinates synthesis operations
- Controls connection pooling and circuit breaker settings
- See `SpeechConnectionConfig` below for details

**`voice?: SpeechVoiceConfig`**
- Configuration for voice service that handles voice list caching
- Controls caching behavior and voice list management
- See `SpeechVoiceConfig` below for details

#### Usage Examples

```typescript
import { Speech, SpeechAPIConfig } from 'expo-edge-speech';

// Basic configuration
const config: SpeechAPIConfig = {
  network: {
    maxRetries: 3,
    connectionTimeout: 8000
  },
  connection: {
    maxConnections: 5,
    poolingEnabled: true
  }
};

// Create Speech instance with configuration
const speech = new Speech(config);

// Use configured instance
speech.speak('Hello world', {
  voice: 'en-US-AriaNeural'
});
```

**Backward Compatibility:**
- All configuration is optional
- Existing code works without modification
- Default Speech instance uses optimized settings

---

### `SpeechNetworkConfig`

Configuration interface for the network service that handles Edge TTS communication.

```typescript
interface SpeechNetworkConfig {
  maxRetries?: number;
  baseRetryDelay?: number;
  maxRetryDelay?: number;
  connectionTimeout?: number;
  gracefulCloseTimeout?: number;
  enableDebugLogging?: boolean;
}
```

#### Properties

**`maxRetries?: number`**
- Maximum number of retry attempts for failed requests
- Default: 3
- Range: 0-10 (higher values may delay error reporting)

**`baseRetryDelay?: number`**
- Initial retry delay in milliseconds
- Default: 1000 (1 second)
- Exponential backoff starts from this value

**`maxRetryDelay?: number`**
- Maximum retry delay in milliseconds
- Default: 10000 (10 seconds)
- Caps exponential backoff growth

**`connectionTimeout?: number`**
- Connection establishment timeout in milliseconds
- Default: 10000 (10 seconds)
- Adjust based on network conditions

**`gracefulCloseTimeout?: number`**
- Graceful connection close timeout in milliseconds
- Default: 5000 (5 seconds)
- Time to wait for clean connection closure

**`enableDebugLogging?: boolean`**
- Enable detailed network debug logging
- Default: false
- Useful for development and troubleshooting

---

### `SpeechAudioConfig`

Configuration interface for the audio service that handles platform-specific playback.

```typescript
interface SpeechAudioConfig {
  loadingTimeout?: number;
  autoInitializeAudioSession?: boolean;
  platformConfig?: {
    ios?: {
      allowsRecordingIOS?: boolean;
      staysActiveInBackground?: boolean;
      playsInSilentModeIOS?: boolean;
      interruptionModeIOS?: number;
    };
    android?: {
      staysActiveInBackground?: boolean;
      shouldDuckAndroid?: boolean;
      playThroughEarpieceAndroid?: boolean;
      interruptionModeAndroid?: number;
    };
    web?: {
      staysActiveInBackground?: boolean;
    };
  };
}
```

#### Properties

**`loadingTimeout?: number`**
- Audio loading timeout in milliseconds
- Default: 5000 (5 seconds)
- Adjust for slower networks or devices

**`autoInitializeAudioSession?: boolean`**
- Whether to automatically initialize audio session
- Default: true
- Required for most platforms

**`platformConfig?.ios`**
- iOS-specific audio configuration using expo-av settings
- Controls silent mode behavior, background playback, and interruption handling

**`platformConfig?.android`**
- Android-specific audio configuration using expo-av settings
- Controls background playback, ducking, and audio routing

---

### `SpeechStorageConfig`

Configuration interface for the storage service that manages memory buffering.

```typescript
interface SpeechStorageConfig {
  maxBufferSize?: number;
  cleanupInterval?: number;
  warningThreshold?: number;
}
```

#### Properties

**`maxBufferSize?: number`**
- Maximum buffer size per connection in bytes
- Default: 16777216 (16MB)
- Adjust based on available memory and content length

**`cleanupInterval?: number`**
- Buffer cleanup interval in milliseconds
- Default: 30000 (30 seconds)
- More frequent cleanup reduces memory usage

**`warningThreshold?: number`**
- Warning threshold as percentage (0.0 to 1.0)
- Default: 0.8 (80%)
- Logs warnings when buffer usage exceeds threshold

---

### `SpeechConnectionConfig`

Configuration interface for the connection manager that coordinates synthesis operations.

```typescript
interface SpeechConnectionConfig {
  maxConnections?: number;
  connectionTimeout?: number;
  poolingEnabled?: boolean;
  circuitBreaker?: {
    failureThreshold?: number;
    recoveryTimeout?: number;
    testRequestLimit?: number;
  };
}
```

#### Properties

**`maxConnections?: number`**
- Maximum concurrent connections to Edge TTS service
- Default: 5
- Higher values may improve throughput but increase resource usage

**`connectionTimeout?: number`**
- Connection timeout in milliseconds
- Default: 10000 (10 seconds)
- Should match network configuration timeout

**`poolingEnabled?: boolean`**
- Enable connection pooling for improved performance
- Default: false
- See [Configuration Guide](./configuration.md) for detailed explanation

**`circuitBreaker`**
- Circuit breaker configuration for fault tolerance
- Prevents cascade failures and enables automatic recovery

---

### `SpeechVoiceConfig`

Configuration interface for the voice service that handles voice list caching.

```typescript
interface SpeechVoiceConfig {
  cacheTTL?: number;
  maxCacheSize?: number;
  enableCaching?: boolean;
}
```

#### Properties

**`cacheTTL?: number`**
- Voice cache time-to-live in milliseconds
- Default: 3600000 (1 hour)
- Longer values reduce API calls but may miss voice updates

**`maxCacheSize?: number`**
- Maximum number of cached voice lists
- Default: 10
- Higher values use more memory but improve performance

**`enableCaching?: boolean`**
- Enable voice list caching
- Default: true
- Disable for testing or when voice lists change frequently

## Advanced Configuration Types

### `SpeechStateConfig`

Configuration interface for speech state management and event handling.

```typescript
interface SpeechStateConfig {
  /** Initial speech state */
  initialState?: ConnectionState;
  /** Enable/disable event logging */
  enableLogging?: boolean;
  /** Custom event handlers */
  eventHandlers?: {
    onStateChange?: (newState: ConnectionState, oldState: ConnectionState) => void;
    onError?: (error: SpeechError) => void;
  };
}
```

#### Properties

**`initialState?: ConnectionState`**
- Initial connection state for new Speech instances
- Default: `ConnectionState.Disconnected`
- Useful for testing or custom initialization logic

**`enableLogging?: boolean`**
- Enable detailed event logging for debugging
- Default: false
- Helps troubleshoot connection and synthesis issues

**`eventHandlers?: object`**
- Custom event handlers for state changes and errors
- Provides hooks into internal state machine
- Useful for monitoring and analytics

### `PlatformAudioConfig`

Platform-specific audio configuration for expo-av integration.

```typescript
interface PlatformAudioConfig {
  ios: {
    staysActiveInBackground?: boolean;
    playsInSilentModeIOS?: boolean;
    interruptionModeIOS: InterruptionModeIOS;
  };
  android: {
    staysActiveInBackground?: boolean;
    shouldDuckAndroid?: boolean;
    playThroughEarpieceAndroid?: boolean;
    interruptionModeAndroid: InterruptionModeAndroid;
  };
}
```

#### Properties

**iOS Configuration:**
- `staysActiveInBackground`: Keep audio session active in background (not available in Expo Go)
- `playsInSilentModeIOS`: Play audio when device is in silent mode
- `interruptionModeIOS`: How to handle audio interruptions (required)

**Android Configuration:**
- `staysActiveInBackground`: Keep audio session active in background
- `shouldDuckAndroid`: Lower other audio while TTS is playing
- `playThroughEarpieceAndroid`: Route audio through phone earpiece
- `interruptionModeAndroid`: How to handle audio interruptions (required)

---

## Best Practices

### Type Safety

**Use Strict Typing:**
```typescript
// Good: Strict typing with interfaces
const options: SpeechOptions = {
  voice: 'en-US-AriaNeural',
  rate: 1.0,
  pitch: 1.0,
  volume: 0.8
};

// Avoid: Loose typing
const options = {
  voice: 'en-US-AriaNeural',
  rate: 1.0
};
```

**Leverage Union Types:**
```typescript
// Use proper union types for configuration
const config: SpeechAPIConfig = {
  connection: {
    maxConnections: 5,
    poolingEnabled: true
  },
  audio: {
    platformConfig: {
      ios: {
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        playsInSilentModeIOS: true
      },
      android: {
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: true
      }
    }
  }
};
```

### Error Handling

**Implement Comprehensive Error Handling:**
```typescript
const handleSpeechError = (error: unknown) => {
  if (error instanceof Error) {
    const speechError = error as SpeechError;
    
    switch (speechError.code) {
      case 'NETWORK_ERROR':
        // Handle network issues
        break;
      case 'INVALID_VOICE':
        // Handle voice availability issues
        break;
      default:
        // Handle generic errors
        console.error('Speech error:', speechError.message);
    }
  }
};
```

### Performance Optimization

**Use Voice Caching:**
```typescript
class VoiceCache {
  private static instance: VoiceCache;
  private voices: EdgeSpeechVoice[] | null = null;
  
  static getInstance(): VoiceCache {
    if (!VoiceCache.instance) {
      VoiceCache.instance = new VoiceCache();
    }
    return VoiceCache.instance;
  }
  
  async getVoices(): Promise<EdgeSpeechVoice[]> {
    if (!this.voices) {
      this.voices = await Speech.getAvailableVoicesAsync();
    }
    return this.voices;
  }
}
```

**Optimize Configuration:**
```typescript
// Reuse configuration objects
const optimizedConfig: SpeechAPIConfig = {
  connection: {
    maxConnections: 3,
    poolingEnabled: true,
    connectionTimeout: 8000
  },
  network: {
    maxRetries: 2,
    connectionTimeout: 8000
  },
  voice: {
    cacheTTL: 3600000, // 1 hour
    enableDebugLogging: false
  }
};

// Create Speech instance once and reuse
const speech = new Speech(optimizedConfig);
```

---

## Migration Guide

### From v1.x to v2.x

**Updated Configuration:**
```typescript
// v1.x - Basic configuration
const speech = new Speech();

// v2.x - Enhanced configuration
const speech = new Speech({
  connection: {
    maxConnections: 5,
    poolingEnabled: true
  },
  audio: {
    loadingTimeout: 5000,
    autoInitializeAudioSession: true
  }
});
```

**Enhanced Error Handling:**
```typescript
// v1.x - Basic error handling
Speech.speak(text, {
  onError: (error) => console.error(error)
});

// v2.x - Detailed error handling
Speech.speak(text, {
  onError: (error) => {
    const speechError = error as SpeechError;
    handleErrorByCode(speechError.code, speechError.message);
  }
});
```

---

## Integration Examples

### React Native Component

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, Button, FlatList } from 'react-native';
import { Speech, EdgeSpeechVoice, SpeechOptions } from 'expo-edge-speech';

interface VoiceSelectorProps {
  onVoiceSelect: (voice: EdgeSpeechVoice) => void;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ onVoiceSelect }) => {
  const [voices, setVoices] = useState<EdgeSpeechVoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    try {
      const availableVoices = await Speech.getAvailableVoicesAsync();
      setVoices(availableVoices);
    } catch (error) {
      console.error('Failed to load voices:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderVoice = ({ item }: { item: EdgeSpeechVoice }) => (
    <Button
      title={`${item.name} (${item.gender})`}
      onPress={() => onVoiceSelect(item)}
    />
  );

  if (loading) {
    return <Text>Loading voices...</Text>;
  }

  return (
    <FlatList
      data={voices}
      renderItem={renderVoice}
      keyExtractor={(item) => item.identifier}
    />
  );
};
```

### Expo SDK 52 Integration

```typescript
import { Audio } from 'expo-av';
import { Speech, SpeechAPIConfig } from 'expo-edge-speech';
import { InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

// Configure for Expo SDK 52
const config: SpeechAPIConfig = {
  audio: {
    autoInitializeAudioSession: true,
    loadingTimeout: 5000,
    platformConfig: {
      ios: {
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false // Not available in Expo Go
      },
      android: {
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: true,
        staysActiveInBackground: true
      }
    }
  },
  connection: {
    maxConnections: 3,
    poolingEnabled: true
  }
};

// Initialize Speech with configuration
const speech = new Speech(config);

// Use in Expo component
export default function App() {
  const speakText = async (text: string) => {
    try {
      await speech.speak(text, {
        voice: 'en-US-AriaNeural',
        rate: 1.0,
        onStart: () => console.log('Started speaking'),
        onDone: () => console.log('Finished speaking'),
        onError: (error) => console.error('Speech error:', error)
      });
    } catch (error) {
      console.error('Failed to speak:', error);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Button title="Speak Text" onPress={() => speakText('Hello, Expo!')} />
    </View>
  );
}
```

---

For complete configuration examples and advanced usage patterns, see the [Configuration Guide](./configuration.md) and [Usage Examples](./usage-examples.md).
