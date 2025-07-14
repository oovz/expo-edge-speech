# Usage Examples

Comprehensive examples and patterns for integrating text-to-speech functionality in your Expo apps using expo-edge-speech.

> **Prerequisites**: This guide assumes you have expo-edge-speech installed and configured in an Expo SDK 52+ project. See the [API Reference](./api-reference.md) for installation instructions.

## Quick Start Examples

### Basic Text-to-Speech

```typescript
import * as Speech from 'expo-edge-speech';

// Simple speech - uses default voice and settings
await Speech.speak('Hello, world!');

// With basic error handling
try {
  await Speech.speak('Welcome to my Expo app!');
  console.log('Speech completed successfully');
} catch (error) {
  console.error('Speech failed:', error);
}

// Using async/await pattern (recommended)
const speakText = async (text: string) => {
  try {
    await Speech.speak(text);
  } catch (error) {
    console.error('TTS Error:', error);
  }
};

await speakText('This is the recommended pattern for Expo apps');
```

### Voice Selection and Language Support

```typescript
// Get available voices and filter by language
const voices = await Speech.getAvailableVoicesAsync();

// Find English voices for your app
const englishVoices = voices.filter(voice => 
  voice.language.startsWith('en-')
);

// Select a specific voice by quality/preference
const preferredVoice = englishVoices.find(voice => 
  voice.identifier.includes('Neural')
) || englishVoices[0];

if (preferredVoice) {
  await Speech.speak('Hello in English!', {
    voice: preferredVoice.identifier
  });
}

// Multilingual support - great for international apps
const multilingualVoices = voices.filter(voice =>
  voice.identifier.includes('Multilingual')
);

if (multilingualVoices.length > 0) {
  await Speech.speak('Hello! Hola! Bonjour! 你好!', {
    voice: multilingualVoices[0].identifier
  });
}

// Language-specific voice selection helper
const findVoiceForLanguage = (languageCode: string) => {
  return voices.find(voice => voice.language === languageCode) ||
         voices.find(voice => voice.language.startsWith(languageCode.split('-')[0]));
};

const spanishVoice = findVoiceForLanguage('es-ES');
if (spanishVoice) {
  await Speech.speak('¡Hola mundo!', {
    voice: spanishVoice.identifier
  });
}
```

### Speech Parameters and Customization

```typescript
// Custom speech parameters for different use cases
await Speech.speak('This text has custom speech parameters', {
  voice: 'en-US-AriaNeural',
  rate: 1.2,    // 20% faster than normal (range: 0.1-3.0)
  pitch: 0.8,   // 20% lower pitch (range: 0.5-2.0)  
  volume: 0.9   // 90% volume (range: 0.0-1.0)
});

// Slow and clear speech for accessibility or important information
await Speech.speak('Important: Please read the terms carefully', {
  voice: 'en-US-ChristopherNeural',
  rate: 0.8,    // 20% slower for clarity
  pitch: 1.0,   // Normal pitch
  volume: 1.0   // Full volume
});

// Dynamic parameters based on user preferences
const userPreferences = {
  speechRate: 1.1,
  preferredVoice: 'en-US-JennyNeural',
  volume: 0.85
};

await Speech.speak('User-customized speech', {
  voice: userPreferences.preferredVoice,
  rate: userPreferences.speechRate,
  volume: userPreferences.volume
});

// Validation of parameters (automatic clamping by library)
await Speech.speak('Parameters are automatically validated', {
  rate: 5.0,    // Will be clamped to 3.0
  pitch: -1.0,  // Will be clamped to 0.5
  volume: 2.0   // Will be clamped to 1.0
});
```

### Event Handling and Monitoring

```typescript
// Comprehensive event handling for speech monitoring
const text = 'Text with complete event monitoring';
await Speech.speak(text, {
  voice: 'en-US-AriaNeural',
  onStart: () => {
    console.log('🎵 Speech synthesis started');
    // Update UI to show speech is active
  },
  onDone: () => {
    console.log('✅ Speech completed successfully');
    // Update UI to show completion
  },
  onError: (error) => {
    console.error('❌ Speech error:', error);
    // Handle error gracefully
  },
  onBoundary: (boundary) => {
    // Extract the current word from the original text
    const word = text.slice(boundary.charIndex, boundary.charIndex + boundary.charLength);
    console.log(`📍 Speaking word: "${word}" at position ${boundary.charIndex}`);
    // Use for real-time highlighting or progress tracking
  }
});

// Error-first event handling pattern
const speakWithRobustHandling = async (text: string, options = {}) => {
  return new Promise<void>((resolve, reject) => {
    Speech.speak(text, {
      ...options,
      onStart: () => console.log('Speech started'),
      onDone: () => {
        console.log('Speech completed');
        resolve();
      },
      onError: (error) => {
        console.error('Speech failed:', error);
        reject(error);
      }
    });
  });
};

// Usage
try {
  await speakWithRobustHandling('Reliable speech with promises');
} catch (error) {
  console.error('Handle speech failure:', error);
}
```

## Real-World Application Examples

### News Reader App

```typescript
import * as Speech from 'expo-edge-speech';
import { useState } from 'react';

function NewsReader({ article }) {
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const readArticle = async () => {
    try {
      setIsReading(true);
      
      // Use a clear, professional voice for news
      await Speech.speak(article.content, {
        voice: 'en-US-ChristopherNeural',
        rate: 1.0,  // Normal speed for news
        onStart: () => {
          console.log('Started reading article');
        },
        onDone: () => {
          setIsReading(false);
          setIsPaused(false);
          console.log('Finished reading article');
        },
        onError: (error) => {
          setIsReading(false);
          setIsPaused(false);
          console.error('Reading failed:', error);
        }
      });
    } catch (error) {
      setIsReading(false);
      console.error('Failed to start reading:', error);
    }
  };
  
  const pauseReading = async () => {
    try {
      await Speech.pause();
      setIsPaused(true);
    } catch (error) {
      console.error('Failed to pause:', error);
    }
  };
  
  const resumeReading = async () => {
    try {
      await Speech.resume();
      setIsPaused(false);
    } catch (error) {
      console.error('Failed to resume:', error);
    }
  };
  
  const stopReading = async () => {
    try {
      await Speech.stop();
      setIsReading(false);
      setIsPaused(false);
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  };
  
  return (
    <View>
      <Text>{article.title}</Text>
      <View style={{ flexDirection: 'row' }}>
        {!isReading && (
          <Button title="Read Article" onPress={readArticle} />
        )}
        {isReading && !isPaused && (
          <Button title="Pause" onPress={pauseReading} />
        )}
        {isReading && isPaused && (
          <Button title="Resume" onPress={resumeReading} />  
        )}
        {isReading && (
          <Button title="Stop" onPress={stopReading} />
        )}
      </View>
    </View>
  );
}
```

### Language Learning App

```typescript
import * as Speech from 'expo-edge-speech';

class LanguageLearning {
  private voices: { [language: string]: string } = {};
  
  async initialize() {
    const availableVoices = await Speech.getAvailableVoicesAsync();
    
    // Map languages to appropriate voices
    this.voices = {
      'en': availableVoices.find(v => v.identifier === 'en-US-AriaNeural')?.identifier || '',
      'es': availableVoices.find(v => v.identifier === 'es-ES-ElviraNeural')?.identifier || '',
      'fr': availableVoices.find(v => v.identifier === 'fr-FR-DeniseNeural')?.identifier || '',
      'de': availableVoices.find(v => v.identifier === 'de-DE-KatjaNeural')?.identifier || '',
    };
  }
  
  async pronounceWord(word: string, language: string) {
    const voice = this.voices[language];
    if (!voice) {
      throw new Error(`Voice not available for language: ${language}`);
    }
    
    // Slow pronunciation for learning
    await Speech.speak(word, {
      voice: voice,
      rate: 0.7,    // Slower for learning
      pitch: 1.0,
      volume: 1.0,
      onStart: () => console.log(`Pronouncing: ${word}`),
      onError: (error) => console.error('Pronunciation failed:', error)
    });
  }
  
  async pronounceSentence(sentence: string, language: string) {
    const voice = this.voices[language];
    if (!voice) {
      throw new Error(`Voice not available for language: ${language}`);
    }
    
    // Normal speed for sentences
    await Speech.speak(sentence, {
      voice: voice,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0
    });
  }
}

// Usage
const learningApp = new LanguageLearning();
await learningApp.initialize();
await learningApp.pronounceWord('Hola', 'es');
await learningApp.pronounceSentence('¿Cómo estás?', 'es');
```

### Accessibility Assistant

```typescript
import * as Speech from 'expo-edge-speech';

class AccessibilityAssistant {
  async announceScreenContent(content: string) {
    // Use clear, slightly slower speech for accessibility
    await Speech.speak(content, {
      voice: 'en-US-ChristopherNeural',
      rate: 0.9,    // Slightly slower for clarity  
      pitch: 1.0,
      volume: 1.0,
      onError: (error) => {
        console.error('Accessibility announcement failed:', error);
        // Fallback to shorter message
        Speech.speak('Content not available');
      }
    });
  }
  
  async announceNavigation(destination: string) {
    await Speech.speak(`Navigating to ${destination}`, {
      voice: 'en-US-AriaNeural',
      rate: 1.0,
      volume: 1.0
    });
  }
  
  async announceError(errorMessage: string) {
    // Higher pitch for alerts
    await Speech.speak(`Error: ${errorMessage}`, {
      voice: 'en-US-ChristopherNeural',
      rate: 1.0,
      pitch: 1.2,   // Higher pitch for attention
      volume: 1.0
    });
  }
}
```

## Error Handling Patterns

### Robust Error Handling

```typescript
import * as Speech from 'expo-edge-speech';

async function robustSpeak(text: string, options = {}) {
  try {
    await Speech.speak(text, {
      ...options,
      onError: (error) => {
        console.error('Speech error:', error);
        // Could implement fallback behavior here
      }
    });
  } catch (error) {
    console.error('Failed to start speech:', error);
    
    // Handle specific error types
    if (error.message.includes('network')) {
      console.log('Network issue - speech will retry when connection is restored');
    } else if (error.message.includes('voice')) {
      console.log('Voice issue - falling back to default voice');
      // Retry with default voice
      try {
        await Speech.speak(text, { ...options, voice: undefined });
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
    }
  }
}
```

### Connection State Management

```typescript
import * as Speech from 'expo-edge-speech';
import { useState, useEffect } from 'react';

function useSpeechWithState() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState(null);
  
  const speak = async (text: string, options = {}) => {
    try {
      setError(null);
      setIsSpeaking(true);
      
      await Speech.speak(text, {
        ...options,
        onStart: () => {
          setIsSpeaking(true);
          options.onStart?.();
        },
        onDone: () => {
          setIsSpeaking(false);
          setIsPaused(false);
          options.onDone?.();
        },
        onStopped: () => {
          setIsSpeaking(false);
          setIsPaused(false);
          options.onStopped?.();
        },
        onError: (err) => {
          setError(err);
          setIsSpeaking(false);
          setIsPaused(false);
          options.onError?.(err);
        }
      });
    } catch (err) {
      setError(err);
      setIsSpeaking(false);
      setIsPaused(false);
    }
  };
  
  const pause = async () => {
    if (isSpeaking && !isPaused) {
      try {
        await Speech.pause();
        setIsPaused(true);
      } catch (err) {
        setError(err);
      }
    }
  };
  
  const resume = async () => {
    if (isSpeaking && isPaused) {
      try {
        await Speech.resume();
        setIsPaused(false);
      } catch (err) {
        setError(err);
      }
    }
  };
  
  const stop = async () => {
    if (isSpeaking) {
      try {
        await Speech.stop();
        setIsSpeaking(false);
        setIsPaused(false);
      } catch (err) {
        setError(err);
      }
    }
  };
  
  return {
    isSpeaking,
    isPaused,
    error,
    speak,
    pause,
    resume,
    stop
  };
}
```

## Advanced Configuration Patterns

### Production Configuration

For production applications, use a configuration optimized for reliability and performance:

```typescript
import { configure } from 'expo-edge-speech';
import { InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

configure({
  network: {
    maxRetries: 3,
    connectionTimeout: 8000,
    enableDebugLogging: false  // Disable in production
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
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix
      },
      android: {
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix
      }
    }
  },
  storage: {
    maxBufferSize: 16 * 1024 * 1024,  // 16MB
    cleanupInterval: 30000
  }
});
```

For detailed configuration options, see the [Configuration Guide](./configuration.md).

### Multilingual Voice Usage

```typescript
// Using multilingual voices for mixed-language content
const voices = await Speech.getAvailableVoicesAsync();
const emmaVoice = voices.find(voice => 
  voice.identifier === 'en-US-EmmaMultilingualNeural'
);

if (emmaVoice) {
  // Emma can speak multiple languages naturally
  await Speech.speak('Hello, I can speak multiple languages!', {
    voice: emmaVoice.identifier,
    language: 'en-US'
  });
  
  // Same voice speaking French
  await Speech.speak('Bonjour, je peux parler français!', {
    voice: emmaVoice.identifier,
    language: 'fr-FR'
  });
  
  // Same voice speaking Spanish  
  await Speech.speak('Hola, ¿cómo estás hoy?', {
    voice: emmaVoice.identifier,
    language: 'es-ES'
  });
}
```

### Language Detection and Voice Selection

```typescript
async function speakInLanguage(text: string, languageCode: string) {
  const voices = await Speech.getAvailableVoicesAsync();
  
  // First try to find a multilingual voice
  let selectedVoice = voices.find(voice => 
    voice.identifier.includes('Multilingual') && 
    voice.language.startsWith(languageCode.split('-')[0])
  );
  
  // Fall back to language-specific voice
  if (!selectedVoice) {
    selectedVoice = voices.find(voice => 
      voice.language === languageCode
    );
  }
  
  // Use first available voice for language
  if (!selectedVoice) {
    selectedVoice = voices.find(voice => 
      voice.language.startsWith(languageCode.split('-')[0])
    );
  }
  
  if (selectedVoice) {
    Speech.speak(text, {
      voice: selectedVoice.identifier,
      language: languageCode
    });
  } else {
    console.warn(`No voice found for language: ${languageCode}`);
    Speech.speak(text); // Use default
  }
}

// Usage
await speakInLanguage('Hello world', 'en-US');
await speakInLanguage('Bonjour le monde', 'fr-FR');
await speakInLanguage('Hola mundo', 'es-ES');
```

## Word Boundary Events

### Text Highlighting During Speech

```typescript
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import * as Speech from 'expo-edge-speech';

function SpeechHighlighter() {
  const [text] = useState("This is a demonstration of word boundary highlighting during speech synthesis.");
  const [highlightedRange, setHighlightedRange] = useState<{start: number, length: number} | null>(null);

  const speakWithHighlight = () => {
    Speech.speak(text, {
      voice: 'en-US-AriaNeural',
      onBoundary: (boundary) => {
        setHighlightedRange({
          start: boundary.charIndex,
          length: boundary.charLength
        });
      },
      onDone: () => {
        setHighlightedRange(null); // Clear highlight when done
      }
    });
  };

  const renderHighlightedText = () => {
    if (!highlightedRange) {
      return <Text>{text}</Text>;
    }

    const { start, length } = highlightedRange;
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
      <Button title="Speak with Highlighting" onPress={speakWithHighlight} />
    </View>
  );
}
```

### Word-by-Word Progress Tracking

```typescript
interface WordProgress {
  word: string;
  position: number;
  timestamp: number;
}

class SpeechProgressTracker {
  private words: string[] = [];
  private progress: WordProgress[] = [];
  private startTime: number = 0;

  startTracking(text: string) {
    this.words = text.split(/\s+/);
    this.progress = [];
    this.startTime = Date.now();
    
    Speech.speak(text, {
      onStart: () => {
        console.log('Speech tracking started');
      },
      onBoundary: (boundary) => {
        const word = text.slice(boundary.charIndex, boundary.charIndex + boundary.charLength);
        const wordProgress: WordProgress = {
          word,
          position: boundary.charIndex,
          timestamp: Date.now() - this.startTime
        };
        
        this.progress.push(wordProgress);
        this.onWordProgress(wordProgress);
      },
      onDone: () => {
        this.onTrackingComplete();
      }
    });
  }

  private onWordProgress(progress: WordProgress) {
    console.log(`Word: "${progress.word}" at ${progress.timestamp}ms`);
    // Update UI, send analytics, etc.
  }

  private onTrackingComplete() {
    console.log('Speech tracking completed');
    console.log('Words per minute:', this.calculateWPM());
  }

  private calculateWPM(): number {
    if (this.progress.length === 0) return 0;
    
    const totalTimeMinutes = (this.progress[this.progress.length - 1].timestamp) / 60000;
    return Math.round(this.progress.length / totalTimeMinutes);
  }
}

// Usage
const tracker = new SpeechProgressTracker();
tracker.startTracking("This is a sample text for tracking speech progress word by word.");
```

## Voice Management

### Voice Discovery and Caching

```typescript
class VoiceManager {
  private voiceCache: EdgeSpeechVoice[] | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getVoices(forceRefresh = false): Promise<EdgeSpeechVoice[]> {
    const now = Date.now();
    
    if (!forceRefresh && this.voiceCache && now < this.cacheExpiry) {
      return this.voiceCache;
    }

    try {
      const voices = await Speech.getAvailableVoicesAsync();
      this.voiceCache = voices;
      this.cacheExpiry = now + this.CACHE_DURATION;
      return voices;
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      return this.voiceCache || [];
    }
  }

  async getVoicesByLanguage(languageCode: string): Promise<EdgeSpeechVoice[]> {
    const voices = await this.getVoices();
    return voices.filter(voice => voice.language === languageCode);
  }

  async getMultilingualVoices(): Promise<EdgeSpeechVoice[]> {
    const voices = await this.getVoices();
    return voices.filter(voice => voice.identifier.includes('Multilingual'));
  }

  async findBestVoice(preferences: {
    language?: string;
    gender?: 'Male' | 'Female';
    multilingual?: boolean;
  }): Promise<EdgeSpeechVoice | null> {
    const voices = await this.getVoices();
    
    let filtered = voices;
    
    if (preferences.language) {
      filtered = filtered.filter(voice => 
        voice.language.startsWith(preferences.language!.split('-')[0])
      );
    }
    
    if (preferences.multilingual) {
      filtered = filtered.filter(voice => 
        voice.identifier.includes('Multilingual')
      );
    }
    
    // For gender filtering, you'd need additional voice metadata
    // This is a simplified example
    
    return filtered[0] || null;
  }
}

// Usage
const voiceManager = new VoiceManager();

// Get voices for a specific language
const englishVoices = await voiceManager.getVoicesByLanguage('en-US');

// Find the best voice for requirements
const bestVoice = await voiceManager.findBestVoice({
  language: 'en-US',
  multilingual: true
});

if (bestVoice) {
  Speech.speak('Hello with the best voice!', {
    voice: bestVoice.identifier
  });
}
```

### Voice Comparison and Selection UI

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Button } from 'react-native';
import * as Speech from 'expo-edge-speech';

interface VoiceListProps {
  onVoiceSelect: (voice: EdgeSpeechVoice) => void;
}

function VoiceSelector({ onVoiceSelect }: VoiceListProps) {
  const [voices, setVoices] = useState<EdgeSpeechVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<EdgeSpeechVoice | null>(null);
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

  const testVoice = (voice: EdgeSpeechVoice) => {
    Speech.speak(`Hello, I am ${voice.name}`, {
      voice: voice.identifier
    });
  };

  const selectVoice = (voice: EdgeSpeechVoice) => {
    setSelectedVoice(voice);
    onVoiceSelect(voice);
  };

  const renderVoice = ({ item: voice }: { item: EdgeSpeechVoice }) => (
    <View style={{ 
      padding: 12, 
      borderBottomWidth: 1, 
      backgroundColor: selectedVoice?.identifier === voice.identifier ? '#e3f2fd' : 'white'
    }}>
      <Text style={{ fontWeight: 'bold' }}>{voice.name}</Text>
      <Text style={{ color: '#666' }}>{voice.language}</Text>
      <Text style={{ fontSize: 12, color: '#999' }}>{voice.identifier}</Text>
      
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        <TouchableOpacity 
          style={{ marginRight: 12, padding: 8, backgroundColor: '#2196f3', borderRadius: 4 }}
          onPress={() => testVoice(voice)}
        >
          <Text style={{ color: 'white' }}>Test</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={{ padding: 8, backgroundColor: '#4caf50', borderRadius: 4 }}
          onPress={() => selectVoice(voice)}
        >
          <Text style={{ color: 'white' }}>Select</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return <Text>Loading voices...</Text>;
  }

  return (
    <View>
      <Text style={{ fontSize: 18, fontWeight: 'bold', margin: 12 }}>
        Available Voices ({voices.length})
      </Text>
      
      <FlatList
        data={voices}
        renderItem={renderVoice}
        keyExtractor={(voice) => voice.identifier}
        style={{ maxHeight: 400 }}
      />
      
      {selectedVoice && (
        <View style={{ padding: 12, backgroundColor: '#f5f5f5' }}>
          <Text>Selected: {selectedVoice.name} ({selectedVoice.language})</Text>
        </View>
      )}
    </View>
  );
}
```

## Advanced Playback Control

### Queue Management

```typescript
class SpeechQueue {
  private queue: Array<{ text: string; options?: SpeechOptions }> = [];
  private isProcessing = false;

  add(text: string, options?: SpeechOptions) {
    this.queue.push({ text, options });
    this.processQueue();
  }

  clear() {
    this.queue = [];
    Speech.stop();
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      await this.speakItem(item.text, item.options);
      
      // Wait for speech to complete
      while (await Speech.isSpeakingAsync()) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.isProcessing = false;
  }

  private speakItem(text: string, options?: SpeechOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      Speech.speak(text, {
        ...options,
        onDone: () => resolve(),
        onError: (error) => reject(error)
      });
    });
  }
}

// Usage
const speechQueue = new SpeechQueue();

// Add multiple items to queue
speechQueue.add("First message");
speechQueue.add("Second message", { voice: 'en-US-AriaNeural' });
speechQueue.add("Third message", { rate: 1.5 });

// Clear queue if needed
speechQueue.clear();
```

### Pause and Resume with State Management

```typescript
class SpeechController {
  private isPaused = false;
  private currentText = '';
  private currentOptions: SpeechOptions = {};

  async speak(text: string, options: SpeechOptions = {}) {
    this.currentText = text;
    this.currentOptions = options;
    this.isPaused = false;

    Speech.speak(text, {
      ...options,
      onPause: () => {
        this.isPaused = true;
        options.onPause?.();
      },
      onResume: () => {
        this.isPaused = false;
        options.onResume?.();
      }
    });
  }

  async pause() {
    // Check if speech is actively playing before attempting pause
    // Pause only works during audio playback phase, not during synthesis
    if (await Speech.isSpeakingAsync() && !this.isPaused) {
      await Speech.pause();
    } else {
      console.log('Pause skipped - speech not currently playing or already paused');
    }
  }

  async resume() {
    // Resume only works if speech was previously paused during playback
    if (this.isPaused && await Speech.isSpeakingAsync()) {
      await Speech.resume();
    } else {
      console.log('Resume skipped - no paused speech to resume');
    }
  }

  async toggle() {
    if (this.isPaused) {
      await this.resume();
    } else if (await Speech.isSpeakingAsync()) {
      await this.pause();
    }
  }

  async stop() {
    await Speech.stop();
    this.isPaused = false;
  }

  getState() {
    return {
      isPaused: this.isPaused,
      currentText: this.currentText,
      isSupported: true
    };
  }
}

// Usage
const controller = new SpeechController();

// Speak with pause/resume support
await controller.speak("This is a long text that can be paused and resumed", {
  voice: 'en-US-AriaNeural'
});

// Control playback
await controller.pause();   // Pause speech
await controller.resume();  // Resume speech
await controller.toggle();  // Toggle pause/resume
await controller.stop();    // Stop completely
```

## Error Handling and Recovery

### Robust Speech with Fallbacks

```typescript
async function robustSpeak(text: string, options: SpeechOptions = {}) {
  const fallbackVoices = [
    'en-US-AriaNeural',
    'en-US-JennyNeural', 
    'en-US-ChristopherNeural'
  ];

  // Try with specified voice first
  if (options.voice) {
    try {
      await Speech.speak(text, options);
      return;
    } catch (error) {
      console.warn(`Failed with voice ${options.voice}:`, error);
    }
  }

  // Try fallback voices
  for (const fallbackVoice of fallbackVoices) {
    try {
      await Speech.speak(text, {
        ...options,
        voice: fallbackVoice
      });
      return;
    } catch (error) {
      console.warn(`Failed with fallback voice ${fallbackVoice}:`, error);
    }
  }

  // Final attempt with no voice specified
  try {
    await Speech.speak(text, {
      ...options,
      voice: undefined
    });
  } catch (error) {
    console.error('All speech attempts failed:', error);
    throw new Error('Speech synthesis completely failed');
  }
}

// Usage
await robustSpeak("This text will be spoken with fallback handling", {
  voice: 'invalid-voice-id', // This will fail and fallback
  rate: 1.2
});
```

### Network Recovery

```typescript
class NetworkAwareSpeech {
  private retryAttempts = 3;
  private retryDelay = 1000;

  async speakWithRetry(text: string, options: SpeechOptions = {}): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await this.attemptSpeak(text, options);
        return; // Success
      } catch (error) {
        lastError = error as Error;
        console.warn(`Speech attempt ${attempt} failed:`, error);
        
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw new Error(`Speech failed after ${this.retryAttempts} attempts: ${lastError?.message}`);
  }

  private attemptSpeak(text: string, options: SpeechOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Speech timeout'));
      }, 10000); // 10 second timeout

      Speech.speak(text, {
        ...options,
        onDone: () => {
          clearTimeout(timeout);
          resolve();
        },
        onError: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const networkSpeech = new NetworkAwareSpeech();

try {
  await networkSpeech.speakWithRetry("This will be retried if it fails");
} catch (error) {
  console.error('Speech completely failed:', error);
}
```

## Performance Optimization Examples

### Efficient Voice Preloading

```typescript
class OptimizedSpeechService {
  private preferredVoices: Map<string, string> = new Map();
  private voicesReady = false;

  async initialize() {
    // Preload and cache preferred voices for common languages
    const voices = await Speech.getAvailableVoicesAsync();
    
    const languagePreferences = {
      'en': voices.find(v => v.identifier === 'en-US-AriaNeural')?.identifier,
      'es': voices.find(v => v.identifier === 'es-ES-ElviraNeural')?.identifier,
      'fr': voices.find(v => v.identifier === 'fr-FR-DeniseNeural')?.identifier,
      'de': voices.find(v => v.identifier === 'de-DE-KatjaNeural')?.identifier,
    };

    Object.entries(languagePreferences).forEach(([lang, voice]) => {
      if (voice) {
        this.preferredVoices.set(lang, voice);
      }
    });

    this.voicesReady = true;
  }

  async speakOptimized(text: string, languageCode = 'en') {
    if (!this.voicesReady) {
      await this.initialize();
    }

    const voice = this.preferredVoices.get(languageCode);
    
    return Speech.speak(text, {
      voice,
      // Optimize for quick response
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0
    });
  }
}

// Initialize once at app startup
const speechService = new OptimizedSpeechService();
speechService.initialize();

// Fast speech throughout the app
await speechService.speakOptimized('Quick optimized speech');
```

### Batch Processing with Queues

```typescript
interface SpeechTask {
  id: string;
  text: string;
  options?: SpeechOptions;
  priority: 'high' | 'normal' | 'low';
}

class BatchSpeechProcessor {
  private highPriorityQueue: SpeechTask[] = [];
  private normalQueue: SpeechTask[] = [];
  private lowPriorityQueue: SpeechTask[] = [];
  private processing = false;

  addTask(task: SpeechTask) {
    switch (task.priority) {
      case 'high':
        this.highPriorityQueue.push(task);
        break;
      case 'normal':
        this.normalQueue.push(task);
        break;
      case 'low':
        this.lowPriorityQueue.push(task);
        break;
    }
    
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing) return;
    
    this.processing = true;

    while (this.hasTasksToProcess()) {
      const task = this.getNextTask();
      if (task) {
        await this.executeTask(task);
      }
    }

    this.processing = false;
  }

  private hasTasksToProcess(): boolean {
    return this.highPriorityQueue.length > 0 || 
           this.normalQueue.length > 0 || 
           this.lowPriorityQueue.length > 0;
  }

  private getNextTask(): SpeechTask | null {
    if (this.highPriorityQueue.length > 0) {
      return this.highPriorityQueue.shift()!;
    }
    if (this.normalQueue.length > 0) {
      return this.normalQueue.shift()!;
    }
    if (this.lowPriorityQueue.length > 0) {
      return this.lowPriorityQueue.shift()!;
    }
    return null;
  }

  private async executeTask(task: SpeechTask): Promise<void> {
    return new Promise((resolve, reject) => {
      Speech.speak(task.text, {
        ...task.options,
        onDone: () => resolve(),
        onError: (error) => reject(error)
      });
    });
  }
}

// Usage
const processor = new BatchSpeechProcessor();

processor.addTask({
  id: 'urgent-alert',
  text: 'Critical system alert!',
  priority: 'high',
  options: { voice: 'en-US-ChristopherNeural', rate: 1.2 }
});

processor.addTask({
  id: 'notification',
  text: 'You have a new message',
  priority: 'normal'
});
```

## Best Practices Summary

### 1. Error Handling
Always implement comprehensive error handling for production applications:

```typescript
// ✅ Good - Comprehensive error handling
try {
  await Speech.speak(text, {
    voice: selectedVoice,
    onError: (error) => {
      console.error('Speech synthesis error:', error);
      // Implement fallback behavior
    }
  });
} catch (error) {
  console.error('Failed to initiate speech:', error);
  // Handle initialization failures
}

// ❌ Bad - No error handling
Speech.speak(text); // Could fail silently
```

### 2. Voice Selection
Always check voice availability before using specific voices:

```typescript
// ✅ Good - Check availability
const voices = await Speech.getAvailableVoicesAsync();
const desiredVoice = voices.find(v => v.identifier === 'en-US-AriaNeural');

Speech.speak(text, {
  voice: desiredVoice?.identifier // Falls back to default if not available
});

// ❌ Bad - Assume voice exists
Speech.speak(text, {
  voice: 'en-US-AriaNeural' // May not be available
});
```

### 3. Resource Management
Clean up resources and handle interruptions properly:

```typescript
// ✅ Good - Proper cleanup
useEffect(() => {
  return () => {
    // Cleanup when component unmounts
    Speech.stop();
  };
}, []);

// Handle app state changes
useEffect(() => {
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background') {
      Speech.pause(); // Pause when app goes to background
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription?.remove();
}, []);
```

### 4. Performance Optimization
Optimize speech parameters for your use case:

```typescript
// For accessibility - clear and slow
const accessibilityOptions = {
  rate: 0.8,
  pitch: 1.0,
  volume: 1.0
};

// For quick notifications - faster
const notificationOptions = {
  rate: 1.3,
  pitch: 1.1,
  volume: 0.9
};

// For reading long content - comfortable pace
const readingOptions = {
  rate: 1.0,
  pitch: 1.0,
  volume: 0.8
};
```

### 5. User Experience
Always provide feedback and control options:

```typescript
function SpeechControls() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Button 
        title={isSpeaking ? 'Stop' : 'Speak'} 
        onPress={isSpeaking ? handleStop : handleSpeak}
      />
      
      {isSpeaking && (
        <Button 
          title={isPaused ? 'Resume' : 'Pause'} 
          onPress={isPaused ? handleResume : handlePause}
        />
      )}
      
      <Text style={{ alignSelf: 'center' }}>
        {isSpeaking ? (isPaused ? 'Paused' : 'Speaking...') : 'Ready'}
      </Text>
    </View>
  );
}
```

## Related Documentation

- **[API Reference](./api-reference.md)** - Complete function documentation and parameters
- **[Configuration Guide](./configuration.md)** - Setup and configuration options
- **[Configuration Guide](./configuration.md)** - Advanced configuration patterns
- **[Platform Considerations](./platform-considerations.md)** - Platform-specific requirements and optimizations
- **[TypeScript Interfaces](./typescript-interfaces.md)** - Type definitions and interfaces

## Troubleshooting Common Issues

### Speech Not Playing
1. Check device volume and mute settings
2. Verify voice availability with `getAvailableVoicesAsync()`
3. Ensure proper error handling is implemented
4. Check network connectivity for voice synthesis

### Performance Issues
1. Avoid blocking the main thread during speech operations
2. Use voice caching and preloading for frequently used voices
3. Implement proper queue management for multiple speech requests
4. Monitor memory usage with large text content

### Platform-Specific Issues
1. **iOS**: Check `playsInSilentModeIOS` configuration
2. **Android**: Verify audio focus and ducking settings
3. **Background playback**: Review platform background execution limitations

For more detailed troubleshooting, see the [Configuration Guide](./configuration.md#troubleshooting).
