# Configuration Guide

This document provides comprehensive guidance on configuring expo-edge-speech for different use cases and performance requirements.

## Overview

expo-edge-speech provides flexible configuration options to optimize performance, handle errors gracefully, and manage resources efficiently. Configuration can be applied at multiple levels to match your application's specific needs.

**Configuration Levels:**
1. **Speech Options** - Per-request configuration for voice, rate, pitch, and callbacks
2. **Global Configuration** - System-wide settings using the `configure()` method
3. **Platform Settings** - iOS and Android specific audio behavior

**When to Configure:**
- **Simple Apps**: Default settings work well for most use cases
- **High-Volume Apps**: Custom configuration improves performance and reliability
- **Resource-Constrained**: Optimize for memory and battery usage
- **Unreliable Networks**: Configure retry and circuit breaker behavior

## Quick Start Configuration

### Basic Usage (No Configuration Required)
```typescript
import * as Speech from 'expo-edge-speech';

// Works out of the box with optimal defaults
await Speech.speak('Hello world', {
  voice: 'en-US-AriaNeural',
  rate: 1.2
});
```

### Simple Configuration
```typescript
import { configure, speak } from 'expo-edge-speech';

// Configure once before any speech operations
configure({
  network: {
    maxRetries: 3,
    connectionTimeout: 8000
  },
  audio: {
    loadingTimeout: 5000
  }
});

// Now use with enhanced settings
await speak('Configured speech');
```

## Speech Options Configuration

The most common configuration involves setting speech synthesis parameters for individual requests:

```typescript
import * as Speech from 'expo-edge-speech';

// Basic speech options
await Speech.speak('Hello world', {
  voice: 'en-US-AriaNeural',
  rate: 1.2,
  pitch: 1.0,
  volume: 0.8,
  language: 'en-US'
});

// With comprehensive event handling
await Speech.speak('Text with full monitoring', {
  voice: 'en-US-JennyNeural',
  rate: 1.1,
  onStart: () => console.log('Speech started'),
  onDone: () => console.log('Speech completed'),
  onError: (error) => console.error('Speech error:', error),
  onBoundary: (boundary) => {
    console.log(`Word: "${boundary.text}" at position ${boundary.charIndex}`);
  }
});

// Voice selection with fallback
const voices = await Speech.getAvailableVoicesAsync();
const preferredVoice = voices.find(v => v.identifier === 'en-US-AriaNeural');

await Speech.speak('Smart voice selection', {
  voice: preferredVoice?.identifier || 'en-US-JennyNeural', // Fallback
  onError: (error) => {
    console.warn('Preferred voice failed, using default');
    // Library automatically retries with default voice
  }
});
```

## Global Configuration with `configure()`

Use the `configure()` method to set system-wide behavior before any speech operations:

### Network Configuration
```typescript
import { configure } from 'expo-edge-speech';

configure({
  network: {
    maxRetries: 3,              // Retry failed requests 3 times
    baseRetryDelay: 1000,       // Start with 1s delay between retries
    connectionTimeout: 8000,    // 8s timeout for connections
    enableDebugLogging: __DEV__ // Debug logging in development only
  }
});
```

### Audio Platform Configuration
```typescript
configure({
  audio: {
    loadingTimeout: 6000,       // 6s timeout for audio loading
    platformConfig: {
      ios: {
        playsInSilentModeIOS: true,      // Play even when device is silenced
        staysActiveInBackground: false    // Stop when app backgrounds
      },
      android: {
        shouldDuckAndroid: true,          // Lower volume for other audio
        playThroughEarpieceAndroid: false // Use speakers, not earpiece
      }
    }
  }
});
```

### Connection Management Configuration
```typescript
configure({
  connection: {
    maxConnections: 5,          // Limit concurrent connections
    poolingEnabled: true,       // Enable connection pooling for better performance
    circuitBreaker: {
      failureThreshold: 3,      // Open circuit after 3 failures
      recoveryTimeout: 15000,   // Test recovery after 15 seconds
      testRequestLimit: 2       // Close circuit after 2 successful tests
    }
  }
});
```

## Configuration Scenarios

### Scenario 1: Simple Mobile App
**Use Case:** Basic text-to-speech with minimal configuration

```typescript
// Default configuration is optimal - no setup needed
await Speech.speak('Welcome to our app!', {
  voice: 'en-US-AriaNeural',
  rate: 1.0,
  onDone: () => console.log('Welcome message completed')
});

// Library automatically uses:
// - Reasonable connection limits
// - Standard retry behavior
// - Platform-optimized audio settings
```

### Scenario 2: Educational App with Frequent TTS
**Use Case:** Many speech operations, needs reliable performance

```typescript
import { configure, speak } from 'expo-edge-speech';

// Configure for better performance and reliability
configure({
  network: {
    maxRetries: 3,
    connectionTimeout: 10000
  },
  connection: {
    maxConnections: 8,
    poolingEnabled: true        // Enable pooling for better throughput
  },
  audio: {
    loadingTimeout: 8000,
    platformConfig: {
      ios: { playsInSilentModeIOS: true }  // Play even if device is muted
    }
  }
});

// Process multiple speech requests efficiently
const lessons = ['Lesson 1 text', 'Lesson 2 text', 'Lesson 3 text'];

for (const lesson of lessons) {
  await speak(lesson, {
    voice: 'en-US-JennyNeural',
    onStart: () => console.log(`Starting: ${lesson.substring(0, 20)}...`),
    onDone: () => console.log('Lesson audio completed')
  });
}
```

### Scenario 3: Language Learning App
**Use Case:** Multiple languages, voice variety, offline considerations

```typescript
configure({
  network: {
    maxRetries: 5,              // More retries for better reliability
    baseRetryDelay: 1500
  },
  connection: {
    maxConnections: 6,
    poolingEnabled: true
  },
  voice: {
    cacheEnabled: true,         // Cache voice lists for offline access
    cacheTimeout: 86400000      // Cache for 24 hours
  }
});

// Multi-language speech with smart voice selection
const speakInLanguage = async (text: string, language: string) => {
  const voices = await Speech.getAvailableVoicesAsync();
  const languageVoices = voices.filter(v => v.language.startsWith(language));
  const selectedVoice = languageVoices[0]?.identifier;

  await speak(text, {
    voice: selectedVoice,
    language: language,
    onError: (error) => {
      console.warn(`Speech failed for ${language}, trying default`);
      // Fallback to default voice
      speak(text);
    }
  });
};

// Usage
await speakInLanguage('Hello world', 'en-US');
await speakInLanguage('Bonjour le monde', 'fr-FR');
await speakInLanguage('Hola mundo', 'es-ES');
```

### Scenario 4: High-Volume Server Application
**Use Case:** Maximum throughput, concurrent processing

```typescript
configure({
  network: {
    maxRetries: 2,              // Fewer retries for faster failures
    connectionTimeout: 6000     // Shorter timeout for faster detection
  },
  connection: {
    maxConnections: 12,         // Higher connection limit
    poolingEnabled: true,       // Essential for high volume
    circuitBreaker: {
      failureThreshold: 10,     // More tolerant of individual failures
      recoveryTimeout: 30000
    }
  }
});

// Process batch of texts concurrently
const processBatch = async (texts: string[]) => {
  const promises = texts.map((text, index) => 
    speak(text, {
      voice: 'en-US-AriaNeural',
      onDone: () => console.log(`Completed item ${index + 1}`),
      onError: (error) => console.error(`Failed item ${index + 1}:`, error)
    })
  );

  try {
    await Promise.allSettled(promises);
    console.log('Batch processing completed');
  } catch (error) {
    console.error('Batch processing failed:', error);
  }
};
```

### Scenario 5: Unreliable Network Environment
**Use Case:** Mobile app with poor connectivity

```typescript
configure({
  network: {
    maxRetries: 5,              // More retries for unreliable networks
    baseRetryDelay: 2000,       // Longer delays between retries
    connectionTimeout: 15000    // Longer timeout for slow networks
  },
  connection: {
    maxConnections: 3,          // Fewer concurrent connections
    poolingEnabled: false,      // Simpler connection management
    circuitBreaker: {
      failureThreshold: 2,      // Fail fast for unreliable networks
      recoveryTimeout: 60000,   // Longer recovery time
      testRequestLimit: 1       // Conservative recovery testing
    }
  }
});

// Robust error handling for poor connectivity
const speakWithRetry = async (text: string, maxAttempts = 3) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        Speech.speak(text, {
          onDone: () => resolve(),
          onError: (error) => reject(error)
        });
      });
      return; // Success
    } catch (error) {
      console.warn(`Speech attempt ${attempt} failed:`, error);
      if (attempt === maxAttempts) {
        throw error; // Final attempt failed
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
};
```
## Performance Optimization

### Memory Usage Optimization

**Low Memory Configuration (Resource-Constrained Devices):**
```typescript
configure({
  connection: {
    maxConnections: 2,          // Limit concurrent connections
    poolingEnabled: false       // Disable pooling to reduce memory
  },
  audio: {
    loadingTimeout: 8000        // Longer timeout for slower devices
  },
  storage: {
    maxCacheSize: 50,          // Limit voice cache size
    cleanupInterval: 300000     // Clean up every 5 minutes
  }
});
```

**High Performance Configuration (Powerful Devices):**
```typescript
configure({
  connection: {
    maxConnections: 10,         // Higher connection limit
    poolingEnabled: true        // Enable pooling for efficiency
  },
  audio: {
    loadingTimeout: 3000        // Faster timeout for responsive devices
  },
  storage: {
    maxCacheSize: 200,         // Larger cache for better performance
    cleanupInterval: 600000     // Less frequent cleanup
  }
});
```

### Network Optimization

**Slow Network Configuration:**
```typescript
configure({
  network: {
    connectionTimeout: 20000,   // Longer timeout for slow networks
    maxRetries: 5,              // More retries
    baseRetryDelay: 3000        // Longer delays between retries
  },
  connection: {
    maxConnections: 2,          // Fewer concurrent connections
    circuitBreaker: {
      failureThreshold: 2,      // Fail fast on slow networks
      recoveryTimeout: 90000    // Longer recovery period
    }
  }
});
```

**Fast Network Configuration:**
```typescript
configure({
  network: {
    connectionTimeout: 5000,    // Shorter timeout for fast networks
    maxRetries: 2,              // Fewer retries needed
    baseRetryDelay: 500         // Shorter delays
  },
  connection: {
    maxConnections: 8,          // More concurrent connections
    circuitBreaker: {
      failureThreshold: 5,      // More tolerant of occasional failures
      recoveryTimeout: 15000    // Faster recovery
    }
  }
});
```

### Battery Optimization

**Battery-Conscious Configuration:**
```typescript
configure({
  connection: {
    maxConnections: 1,          // Single connection to reduce radio usage
    poolingEnabled: false       // Simpler connection management
  },
  network: {
    connectionTimeout: 12000,   // Reasonable timeout
    maxRetries: 2               // Limit retries to save battery
  },
  audio: {
    platformConfig: {
      ios: {
        staysActiveInBackground: false  // Don't keep audio active in background
      },
      android: {
        shouldDuckAndroid: false       // Don't duck other audio to save processing
      }
    }
  }
});
```

## Error Handling and Recovery

### Comprehensive Error Handling
```typescript
const speakWithRobustErrorHandling = async (text: string) => {
  try {
    await new Promise<void>((resolve, reject) => {
      Speech.speak(text, {
        onStart: () => console.log('Speech synthesis started'),
        onDone: () => {
          console.log('Speech completed successfully');
          resolve();
        },
        onError: (error) => {
          console.error('Speech synthesis error:', error);
          
          // Handle specific error types
          if (error.message.includes('CONNECTION_LIMIT_EXCEEDED')) {
            console.warn('Too many concurrent requests, queuing...');
            setTimeout(() => speakWithRobustErrorHandling(text), 2000);
          } else if (error.message.includes('Circuit breaker')) {
            console.warn('Service temporarily unavailable');
            reject(new Error('TTS service unavailable, please try again later'));
          } else if (error.message.includes('NETWORK_ERROR')) {
            console.warn('Network error, retrying with fallback...');
            // Library will automatically retry
          } else {
            reject(error);
          }
        }
      });
    });
  } catch (error) {
    console.error('Final speech error:', error);
    throw error;
  }
};
```

### Graceful Degradation Strategies
```typescript
const speakWithFallback = async (text: string, options?: SpeechOptions) => {
  // Try with preferred configuration
  try {
    await Speech.speak(text, options);
    return { success: true, method: 'preferred' };
  } catch (error) {
    console.warn('Preferred speech failed, trying simplified version');
  }

  // Fallback to basic configuration
  try {
    await Speech.speak(text, {
      voice: undefined, // Use default voice
      rate: 1.0,        // Use default rate
      onError: (error) => console.error('Fallback speech error:', error)
    });
    return { success: true, method: 'fallback' };
  } catch (error) {
    console.error('All speech methods failed');
    return { success: false, error };
  }
};

// Usage with user notification
const result = await speakWithFallback('Important message', {
  voice: 'en-US-AriaNeural',
  rate: 1.2
});

if (!result.success) {
  // Show text-based notification instead
  showTextNotification('Important message');
}
```

### Circuit Breaker Monitoring
```typescript
// Monitor circuit breaker state for user feedback
const monitorCircuitBreaker = () => {
  Speech.speak('Test message', {
    onError: (error) => {
      if (error.message.includes('Circuit breaker is OPEN')) {
        showUserMessage('Speech service is temporarily unavailable. Please try again in a moment.');
      } else if (error.message.includes('Circuit breaker is HALF_OPEN')) {
        showUserMessage('Speech service is recovering. Some requests may fail temporarily.');
      }
    }
  });
};
```

## Monitoring and Debugging

### Performance Monitoring
```typescript
let speechMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  averageLatency: 0
};

const trackSpeechPerformance = (text: string) => {
  const startTime = Date.now();
  speechMetrics.totalRequests++;

  Speech.speak(text, {
    onStart: () => {
      const latency = Date.now() - startTime;
      speechMetrics.averageLatency = 
        (speechMetrics.averageLatency * (speechMetrics.totalRequests - 1) + latency) / 
        speechMetrics.totalRequests;
      console.log(`Speech synthesis latency: ${latency}ms`);
    },
    onDone: () => {
      speechMetrics.successfulRequests++;
      console.log('Speech metrics:', speechMetrics);
    },
    onError: (error) => {
      speechMetrics.failedRequests++;
      console.error('Speech failed:', error);
      console.log('Speech metrics:', speechMetrics);
    }
  });
};
```

### Debug Configuration
```typescript
// Enable comprehensive debugging in development
if (__DEV__) {
  configure({
    network: {
      enableDebugLogging: true,      // Enable network debug logs
      logRequestDetails: true,       // Log request/response details
      logRetryAttempts: true         // Log retry attempts
    },
    connection: {
      logConnectionEvents: true,     // Log connection pool events
      logCircuitBreakerEvents: true // Log circuit breaker state changes
    }
  });
}
```

## Configuration Best Practices

### 1. Start with Defaults
```typescript
// Begin with default configuration
await Speech.speak('Test message');

// Only configure when you identify specific needs
```

### 2. Environment-Specific Configuration
```typescript
const getConfigForEnvironment = () => {
  if (__DEV__) {
    return {
      network: { enableDebugLogging: true },
      connection: { maxConnections: 3 }  // Lower limit for development
    };
  }
  
  if (Platform.OS === 'ios') {
    return {
      audio: {
        platformConfig: {
          ios: { playsInSilentModeIOS: true }
        }
      }
    };
  }
  
  return {}; // Use defaults for production Android
};

configure(getConfigForEnvironment());
```

### 3. Progressive Configuration
```typescript
// Start with basic configuration
configure({
  network: { maxRetries: 3 }
});

// Add more configuration as needed
if (isHighVolumeApp) {
  configure({
    connection: { 
      maxConnections: 8,
      poolingEnabled: true 
    }
  });
}
```

### 4. Testing Configuration Changes
```typescript
const testConfiguration = async () => {
  const testTexts = [
    'Short test',
    'Medium length test message for evaluation',
    'Very long test message that exceeds normal usage patterns to evaluate performance under stress conditions'
  ];

  console.log('Testing current configuration...');
  
  for (const text of testTexts) {
    const startTime = Date.now();
    try {
      await new Promise<void>((resolve, reject) => {
        Speech.speak(text, {
          onDone: () => resolve(),
          onError: (error) => reject(error)
        });
      });
      console.log(`✅ "${text.substring(0, 20)}..." - ${Date.now() - startTime}ms`);
    } catch (error) {
      console.log(`❌ "${text.substring(0, 20)}..." - Failed: ${error.message}`);
    }
  }
};
```

## Troubleshooting Common Issues

### Issue: "CONNECTION_LIMIT_EXCEEDED" Errors
**Symptoms:** Frequent connection limit errors during normal usage

**Solutions:**
```typescript
// Option 1: Enable connection pooling
configure({
  connection: {
    poolingEnabled: true,
    maxConnections: 8
  }
});

// Option 2: Reduce concurrent requests
const speechQueue: string[] = [];
let isProcessing = false;

const addToSpeechQueue = async (text: string) => {
  speechQueue.push(text);
  if (!isProcessing) {
    await processSpeechQueue();
  }
};

const processSpeechQueue = async () => {
  isProcessing = true;
  while (speechQueue.length > 0) {
    const text = speechQueue.shift()!;
    await new Promise<void>((resolve) => {
      Speech.speak(text, {
        onDone: () => resolve(),
        onError: () => resolve() // Continue processing even on error
      });
    });
  }
  isProcessing = false;
};
```

### Issue: Frequent Circuit Breaker Activation
**Symptoms:** "Circuit breaker is OPEN" errors

**Solutions:**
```typescript
// Option 1: Adjust circuit breaker settings
configure({
  connection: {
    circuitBreaker: {
      failureThreshold: 10,     // Increase tolerance
      recoveryTimeout: 30000,   // Faster recovery
      testRequestLimit: 3       // More test requests
    }
  }
});

// Option 2: Implement exponential backoff
const speakWithBackoff = async (text: string, retryCount = 0) => {
  try {
    await Speech.speak(text);
  } catch (error) {
    if (error.message.includes('Circuit breaker') && retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      console.log(`Retrying in ${delay}ms...`);
      setTimeout(() => speakWithBackoff(text, retryCount + 1), delay);
    } else {
      throw error;
    }
  }
};
```

### Issue: High Memory Usage
**Symptoms:** App performance degrades over time, memory warnings

**Solutions:**
```typescript
// Configure for lower memory usage
configure({
  connection: {
    poolingEnabled: false,      // Disable pooling
    maxConnections: 2          // Reduce connections
  },
  storage: {
    maxCacheSize: 25,          // Smaller cache
    cleanupInterval: 60000     // More frequent cleanup
  }
});

// Implement manual cleanup
setInterval(() => {
  Speech.cleanup();
}, 300000); // Clean up every 5 minutes
```

### Issue: Slow Speech Synthesis
**Symptoms:** Long delays before speech begins

**Solutions:**
```typescript
// Optimize for faster response
configure({
  network: {
    connectionTimeout: 5000,    // Shorter timeout
    maxRetries: 2              // Fewer retries
  },
  connection: {
    maxConnections: 6,         // More concurrent connections
    poolingEnabled: true       // Enable pooling for reuse
  }
});

// Pre-warm connections
const preWarmConnections = async () => {
  try {
    await Speech.speak(' ', { volume: 0 }); // Silent speech to establish connection
  } catch (error) {
    // Ignore errors during pre-warming
  }
};
```

Remember to test configuration changes thoroughly in your specific environment and usage patterns. What works well for one application may not be optimal for another.
