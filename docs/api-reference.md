# API Reference

This document provides comprehensive documentation for all public APIs in expo-edge-speech.

## Overview

expo-edge-speech provides a complete text-to-speech solution using Microsoft's Edge TTS service. The library offers full compatibility with the expo-speech module API while delivering enhanced functionality, better voice quality, and improved cross-platform support.

**Key Features:**
- **Drop-in replacement** for expo-speech with identical API
- **Enhanced voice quality** through Microsoft Edge TTS service
- **Cross-platform pause/resume** support (including Android)
- **Word boundary events** with precise timing
- **Advanced configuration** options for performance optimization
- **Comprehensive error handling** and recovery mechanisms

For advanced configuration options including connection pooling, circuit breaker settings, platform-specific audio configurations, memory management, and service optimizations, see the [Configuration Guide](./configuration.md) and [TypeScript Interfaces](./typescript-interfaces.md#speech-api-configuration).

## Installation

```bash
npx expo install expo-edge-speech
```

**Dependencies:** The library automatically includes all required dependencies for Expo SDK 52.

## Quick Start

```typescript
import * as Speech from 'expo-edge-speech';

// Basic text-to-speech
await Speech.speak('Hello, world!');

// With options
await Speech.speak('Hello with options', {
  voice: 'en-US-AriaNeural',
  rate: 1.2,
  onDone: () => console.log('Speech completed')
});

// Get available voices
const voices = await Speech.getAvailableVoicesAsync();
console.log(`Available voices: ${voices.length}`);
```

## Core Functions

### `speak(text, options?)`

Converts text to speech and plays it using the specified options.

**Parameters:**
- `text` (string): The text to be spoken. Cannot be longer than `maxSpeechInputLength` (1000 characters).
- `options` (SpeechOptions, optional): Configuration options for speech synthesis.

**Returns:** `void`

**Examples:**

```typescript
import * as Speech from 'expo-edge-speech';

// Basic usage with default voice
await Speech.speak('Hello, world!');

// With custom voice parameters
await Speech.speak('Custom speech parameters', {
  voice: 'en-US-AriaNeural',
  rate: 1.2,
  pitch: 1.0,
  volume: 0.8
});

// With event callbacks for monitoring
await Speech.speak('Speech with events', {
  voice: 'en-US-JennyNeural',
  onStart: () => console.log('Speech started'),
  onDone: () => console.log('Speech completed'),
  onError: (error) => console.error('Speech error:', error),
  onBoundary: (boundary) => {
    console.log(`Word: "${boundary.text}" at ${boundary.charIndex}`);
  }
});

// Multilingual voice for mixed language content
await Speech.speak('Hello world! Bonjour le monde! 你好世界!', {
  voice: 'en-US-EmmaMultilingualNeural',
  language: 'en-US'
});

// Error handling pattern
try {
  await Speech.speak('Important message', {
    voice: 'en-US-AriaNeural',
    onError: (error) => {
      console.error('Speech synthesis failed:', error);
      // Fallback to default voice
      Speech.speak('Important message'); // Uses default voice
    }
  });
} catch (error) {
  console.error('Critical speech error:', error);
}
```

**Error Handling:**
- Throws `SpeechError` if text is empty or exceeds maximum length
- Throws `SpeechError` if parameters are invalid (wrong types or out of range)
- Calls `onError` callback if synthesis or playback fails
- Automatic parameter validation and clamping for rate, pitch, and volume

---

### `getAvailableVoicesAsync()`

Returns a list of all available voices from the Edge TTS service. Voices are automatically cached for improved performance.

**Parameters:** None

**Returns:** `Promise<EdgeSpeechVoice[]>`

**Examples:**

```typescript
// Get all available voices
const voices = await Speech.getAvailableVoicesAsync();
console.log(`Found ${voices.length} voices`);

// Filter voices by language
const englishVoices = voices.filter(voice => 
  voice.language.startsWith('en-')
);
console.log(`English voices: ${englishVoices.length}`);

// Find specific voice
const ariaVoice = voices.find(voice => 
  voice.identifier === 'en-US-AriaNeural'
);

// Group voices by language
const voicesByLanguage = voices.reduce((acc, voice) => {
  const lang = voice.language;
  if (!acc[lang]) acc[lang] = [];
  acc[lang].push(voice);
  return acc;
}, {} as Record<string, EdgeSpeechVoice[]>);

// Select random voice for variety
const randomVoice = voices[Math.floor(Math.random() * voices.length)];
await Speech.speak('Random voice selection', {
  voice: randomVoice.identifier
});

// Find voices by characteristics
const femaleVoices = voices.filter(voice => voice.gender === 'Female');
const newsVoices = voices.filter(voice => 
  voice.contentCategories.includes('News')
);
const friendlyVoices = voices.filter(voice =>
  voice.voicePersonalities.includes('Friendly')
);
```

**Voice Object Structure:**
```typescript
interface EdgeSpeechVoice {
  identifier: string;        // "en-US-AriaNeural"
  name: string;             // "Microsoft Aria Online (Natural) - English (United States)"
  language: string;         // "en-US"
  gender: string;           // "Female" | "Male"
  contentCategories: string[];    // ["News", "Novel"]
  voicePersonalities: string[];   // ["Friendly", "Positive"]
}
```

**Language Code Support:**
expo-edge-speech supports comprehensive BCP 47 language tag formats:
- **Standard codes**: `en-US`, `fr-FR`, `zh-CN`, `ja-JP`
- **3-letter codes**: `fil-PH` (Filipino), `umb-AO` (Umbundu)
- **Script variants**: `iu-Latn-CA` (Inuktitut Latin), `iu-Cans-CA` (Inuktitut Syllabics)
- **Regional dialects**: `zh-CN-liaoning`, `zh-CN-shaanxi`

---

### `stop()`

Stops all current speech synthesis and clears the queue.

**Parameters:** None

**Returns:** `Promise<void>`

**Examples:**

```typescript
// Stop current speech immediately
await Speech.stop();

// Stop with error handling
try {
  await Speech.stop();
  console.log('Speech stopped successfully');
} catch (error) {
  console.error('Failed to stop speech:', error);
}

// Stop with cleanup and notification
await Speech.stop();
console.log('All speech operations terminated');
```

**Behavior:**
- Immediately stops audio playback if active
- Cancels ongoing network synthesis operations
- Clears any queued speech operations
- Resets internal state to ready for new operations

---

### `pause()`

Pauses the currently playing speech.

**Cross-Platform Support:** ✅ **Available on all platforms** (iOS, Android)
- **Enhanced Android Support:** Unlike expo-speech, pause operations work reliably on Android

**Phase Availability:** ⚠️ **Only available during audio playback phase**
- Pause operations work only when audio is actively playing (`isSpeakingAsync()` returns `true`)
- Not available during network synthesis phase (while speech is being generated)
- Always check speech state before calling pause to avoid errors

**Parameters:** None

**Returns:** `Promise<void>`

**Examples:**

```typescript
// Proper state checking before pause
const isSpeaking = await Speech.isSpeakingAsync();
if (isSpeaking) {
  await Speech.pause();
  console.log('Speech paused successfully');
} else {
  console.log('No active speech to pause');
}

// Comprehensive error handling pattern
try {
  const isSpeaking = await Speech.isSpeakingAsync();
  if (isSpeaking) {
    await Speech.pause();
    console.log('Speech paused successfully');
  } else {
    console.log('Pause skipped - speech not currently playing');
  }
} catch (error) {
  console.error('Failed to pause speech:', error);
}

// User interaction pause pattern
const handlePauseButton = async () => {
  try {
    if (await Speech.isSpeakingAsync()) {
      await Speech.pause();
      setPauseButtonText('Resume');
    } else {
      console.log('No speech to pause');
    }
  } catch (error) {
    console.error('Pause operation failed:', error);
  }
};
```

---

### `resume()`

Resumes previously paused speech.

**Cross-Platform Support:** ✅ **Available on all platforms** (iOS, Android)  
- **Enhanced Android Support:** Unlike expo-speech, resume operations work reliably on Android

**Phase Availability:** ⚠️ **Only available during audio playback phase** 
- Resume operations work only when speech is paused during playback
- Not available during network synthesis phase or when no speech is active
- Always check speech state before calling resume to avoid errors

**Parameters:** None

**Returns:** `Promise<void>`

**Examples:**

```typescript
// Proper state checking before resume
const isSpeaking = await Speech.isSpeakingAsync();
if (isSpeaking) {
  await Speech.resume();
  console.log('Speech resumed successfully');
} else {
  console.log('No paused speech to resume');
}

// Complete pause/resume cycle with state management
const handlePauseResumeToggle = async () => {
  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.pause();
      console.log('Speech paused');
      
      // Store paused state for UI
      setPaused(true);
      
      // Later, resume when needed
      setTimeout(async () => {
        if (await Speech.isSpeakingAsync()) {
          await Speech.resume();
          console.log('Speech resumed');
          setPaused(false);
        }
      }, 3000);
    }
  } catch (error) {
    console.error('Pause/resume operation failed:', error);
  }
};

// User interface integration
const handleResumeButton = async () => {
  try {
    if (await Speech.isSpeakingAsync()) {
      await Speech.resume();
      setPauseButtonText('Pause');
    } else {
      console.log('No speech to resume');
    }
  } catch (error) {
    console.error('Resume operation failed:', error);
  }
};
```

---

### `isSpeakingAsync()`

Determines whether text-to-speech is currently active. Returns `true` if speech is playing or paused.

**expo-speech Compatibility:** Returns `true` even when speech is paused (matches expo-speech behavior exactly)

**Parameters:** None

**Returns:** `Promise<boolean>`

**Examples:**

```typescript
// Check if currently speaking
const isActive = await Speech.isSpeakingAsync();
console.log(`Speech active: ${isActive}`);

// Wait for speech to complete
const waitForSpeechCompletion = async () => {
  while (await Speech.isSpeakingAsync()) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.log('Speech completed');
};

// Conditional speech with queue management
const speakIfNotBusy = async (text: string) => {
  if (!(await Speech.isSpeakingAsync())) {
    await Speech.speak(text);
  } else {
    console.log('Speech in progress, queuing for later');
    // Implement custom queue logic if needed
  }
};

// UI state synchronization
const updateSpeechUI = async () => {
  const isSpeaking = await Speech.isSpeakingAsync();
  setSpeechButtonEnabled(!isSpeaking);
  setSpeechStatusText(isSpeaking ? 'Speaking...' : 'Ready');
};

// Polling for real-time UI updates
useEffect(() => {
  const interval = setInterval(async () => {
    const isSpeaking = await Speech.isSpeakingAsync();
    setIsSpeaking(isSpeaking);
  }, 500);
  
  return () => clearInterval(interval);
}, []);
```

---

### `cleanup()`

Cleans up all resources and stops services. This method should be called to prevent memory leaks and ensure proper resource disposal.

**Parameters:** None

**Returns:** `Promise<void>`

**Examples:**

```typescript
// Component cleanup pattern
import { useEffect } from 'react';

const SpeechComponent = () => {
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      Speech.cleanup();
    };
  }, []);
  
  // Component implementation...
};

// App lifecycle cleanup
import { AppState } from 'react-native';

const setupAppStateHandling = () => {
  AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'background') {
      Speech.cleanup();
    }
  });
};

// Manual cleanup with error handling
const performCleanup = async () => {
  try {
    await Speech.cleanup();
    console.log('Speech resources cleaned up successfully');
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
};

// Navigation cleanup (React Navigation)
useFocusEffect(
  useCallback(() => {
    return () => {
      // Cleanup when navigating away
      Speech.cleanup();
    };
  }, [])
);
```

**Important Notes:**
- This method is specific to expo-edge-speech and is not part of the standard expo-speech API
- Recommended for preventing memory leaks in long-running applications
- Should be called during component unmounts and app state changes
- Safe to call multiple times

## Constants

### `maxSpeechInputLength`

The maximum number of characters that can be passed to the `speak()` function.

**Type:** `number`
**Value:** `1000` (conservative limit for Edge TTS service reliability)

**Examples:**

```typescript
// Check text length before speaking
const validateAndSpeak = async (text: string) => {
  if (text.length <= Speech.maxSpeechInputLength) {
    await Speech.speak(text);
  } else {
    console.warn(`Text too long: ${text.length} > ${Speech.maxSpeechInputLength}`);
    
    // Automatic text chunking
    const chunks = [];
    for (let i = 0; i < text.length; i += Speech.maxSpeechInputLength) {
      chunks.push(text.slice(i, i + Speech.maxSpeechInputLength));
    }
    
    // Speak each chunk sequentially
    for (const chunk of chunks) {
      await Speech.speak(chunk);
      // Wait for chunk completion before next
      while (await Speech.isSpeakingAsync()) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
};

// Smart text splitting at sentence boundaries
const smartTextSplit = (text: string): string[] => {
  if (text.length <= Speech.maxSpeechInputLength) {
    return [text];
  }
  
  const sentences = text.split(/[.!?]+/);
  const chunks = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= Speech.maxSpeechInputLength) {
      currentChunk += sentence + '.';
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence + '.';
    }
  }
  
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
};
```

## Parameter Validation

All speech parameters are automatically validated and clamped to valid ranges to ensure reliable operation:

### Rate Parameter
- **Range:** 0.1 to 3.0 (extended range for Edge TTS)
- **Default:** 1.0 (normal speed)
- **Behavior:** Values outside range are automatically clamped
- **Recommended:** 0.5 to 2.0 for natural speech

### Pitch Parameter  
- **Range:** 0.5 to 2.0 (optimized for Edge TTS)
- **Default:** 1.0 (normal pitch)
- **Behavior:** Values outside range are automatically clamped
- **Recommended:** 0.8 to 1.2 for natural variation

### Volume Parameter
- **Range:** 0.0 to 1.0 (standard audio range)
- **Default:** 1.0 (maximum volume)
- **Behavior:** Values outside range are automatically clamped
- **Note:** System volume controls final output level

**Examples:**

```typescript
// Valid parameters - used as specified
await Speech.speak('Normal parameters', {
  rate: 1.2,
  pitch: 0.9,
  volume: 0.8
});

// Invalid parameters - automatically clamped
await Speech.speak('Clamped parameters', {
  rate: 5.0,    // Clamped to 3.0
  pitch: -0.5,  // Clamped to 0.5  
  volume: 2.0   // Clamped to 1.0
});

// Parameter validation example
const validateSpeechParams = (options: SpeechOptions) => {
  const clampedOptions = {
    ...options,
    rate: Math.max(0.1, Math.min(3.0, options.rate || 1.0)),
    pitch: Math.max(0.5, Math.min(2.0, options.pitch || 1.0)),
    volume: Math.max(0.0, Math.min(1.0, options.volume || 1.0))
  };
  
  return clampedOptions;
};
```

## Import Patterns

The library supports multiple import patterns for flexibility:

### Named Import (Recommended)
```typescript
import * as Speech from 'expo-edge-speech';

await Speech.speak('Hello world');
const voices = await Speech.getAvailableVoicesAsync();
```

### Default Import
```typescript
import Speech from 'expo-edge-speech';

await Speech.speak('Hello world');
const voices = await Speech.getAvailableVoicesAsync();
```

### Selective Import
```typescript
import { speak, getAvailableVoicesAsync, configure } from 'expo-edge-speech';

await speak('Hello world');
const voices = await getAvailableVoicesAsync();
```

### TypeScript Import with Types
```typescript
import * as Speech from 'expo-edge-speech';
import type { SpeechOptions, EdgeSpeechVoice, SpeechAPIConfig } from 'expo-edge-speech';

const options: SpeechOptions = {
  voice: 'en-US-AriaNeural',
  rate: 1.2
};

await Speech.speak('Typed example', options);
```

## Migration from expo-speech

expo-edge-speech is designed as a drop-in replacement for expo-speech with full API compatibility:

### Basic Migration
```typescript
// Before (expo-speech)
import * as Speech from 'expo-speech';

// After (expo-edge-speech) - identical API
import * as Speech from 'expo-edge-speech';

// All existing code works without changes
await Speech.speak('Hello world', {
  voice: 'en-US-AriaNeural',
  rate: 1.2,
  onDone: () => console.log('Completed')
});
```

### Enhanced Features Available
```typescript
// Additional features (optional to use)
import { configure, cleanup } from 'expo-edge-speech';

// Advanced configuration
configure({
  network: { maxRetries: 3 },
  audio: { loadingTimeout: 5000 }
});

// Resource cleanup
await cleanup();

// Enhanced voice selection
const voices = await Speech.getAvailableVoicesAsync();
const multilingualVoices = voices.filter(v => 
  v.identifier.includes('Multilingual')
);
```

### Key Improvements Over expo-speech
- **Better Android Support:** Full pause/resume functionality
- **Enhanced Voice Quality:** Microsoft Edge TTS service
- **More Voice Options:** Extensive voice library with personality traits
- **Word Boundaries:** Precise timing events for word highlighting
- **Connection Management:** Built-in retry and error recovery
- **Configuration Options:** Performance tuning and optimization

## Configuration

### `configure(config)`

Configure Speech API services before initialization. This method allows you to customize all internal services (AudioService, VoiceService, NetworkService, StorageService, ConnectionManager) before any Speech API methods are called.

**Parameters:**
- `config` (SpeechAPIConfig): Configuration options for all Speech API services

**Returns:** `void`

**Important:** Must be called before any other Speech API methods. Configuration is locked after first Speech API method call.

**Examples:**

```typescript
import { configure, speak } from 'expo-edge-speech';

// Basic configuration for better performance
configure({
  network: {
    maxRetries: 3,
    connectionTimeout: 8000,
    enableDebugLogging: __DEV__ // Enable in development only
  },
  connection: {
    maxConnections: 5,
    poolingEnabled: true,
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeout: 15000
    }
  },
  audio: {
    loadingTimeout: 6000,
    platformConfig: {
      ios: { 
        playsInSilentModeIOS: true,
        staysActiveInBackground: false 
      },
      android: { 
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      }
    }
  }
});

// Now use Speech API with custom configuration
await speak('Hello, configured world!');
```

**Configuration Categories:**

- **network**: Network service configuration (retries, timeouts, debugging)
- **connection**: Connection manager configuration (pooling, circuit breaker)
- **audio**: Audio service configuration (platform settings, timeouts)
- **storage**: Storage service configuration (memory limits, cleanup)
- **voice**: Voice service configuration (caching, fetching)

For detailed configuration options, see the [Configure API Guide](./configure-api.md).

**Error Handling:**

```typescript
try {
  configure({
    network: { maxRetries: 3 },
    audio: { loadingTimeout: 5000 }
  });
  console.log('Configuration applied successfully');
} catch (error) {
  console.error('Configuration failed:', error);
}

// Invalid usage patterns
configure({}); // ✅ Valid: empty config uses defaults
configure(null); // ❌ Error: Configuration must be a valid object

// Configuration after initialization
configure({ network: { maxRetries: 3 } });
await speak("Hello"); // Initializes Speech API
configure({ network: { maxRetries: 5 } }); // ❌ Error: Cannot change after initialization
```

## Error Handling Patterns

### Comprehensive Error Handling
```typescript
try {
  await Speech.speak('Important message', {
    voice: 'en-US-AriaNeural',
    onError: (error) => {
      console.error('Speech synthesis error:', error);
      // Fallback strategy
      Speech.speak('Important message'); // Use default voice
    },
    onStart: () => console.log('Speech started successfully'),
    onDone: () => console.log('Speech completed successfully')
  });
} catch (error) {
  console.error('Critical speech error:', error);
  // Handle critical failures
}
```

### Network Error Recovery
```typescript
const speakWithRetry = async (text: string, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await Speech.speak(text);
      return; // Success
    } catch (error) {
      console.warn(`Speech attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) {
        throw new Error(`Speech failed after ${maxRetries} attempts`);
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};
```

### Graceful Degradation
```typescript
const speakWithFallback = async (text: string, preferredVoice?: string) => {
  try {
    // Try with preferred voice
    await Speech.speak(text, { voice: preferredVoice });
  } catch (error) {
    console.warn('Preferred voice failed, using default:', error);
    try {
      // Fallback to default voice
      await Speech.speak(text);
    } catch (fallbackError) {
      console.error('All speech options failed:', fallbackError);
      // Final fallback - silent failure or user notification
      alert('Speech synthesis is currently unavailable');
    }
  }
};
```
