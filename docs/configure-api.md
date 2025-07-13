# Configure API Documentation

The Speech API provides a comprehensive configuration system for customizing all internal services before initialization. This enables fine-grained control over performance, behavior, and platform-specific settings optimized for your application needs.

## Overview

The `configure()` method must be called **before** any other Speech API methods. Once initialized, configuration becomes immutable to ensure consistent behavior across your application.

**Key Benefits:**
- 🚀 **Performance Optimization** - Fine-tune for your specific use case
- 🔄 **Connection Management** - Connection pooling and circuit breaker patterns  
- 📱 **Platform Integration** - Native audio behavior customization
- 🛡️ **Reliability** - Advanced error recovery and retry strategies
- 🎛️ **Resource Management** - Memory and cleanup optimization
- ⚡ **Developer Experience** - TypeScript support with full IntelliSense

## Quick Start

```typescript
import { configure, speak } from 'expo-edge-speech';

// Configure before first use
configure({
  network: {
    maxRetries: 3,
    connectionTimeout: 8000
  },
  connection: {
    maxConnections: 5,
    poolingEnabled: true
  }
});

// Use Speech API with optimized settings
await speak('Hello, optimized world!');
```

## Configuration Presets

### 📱 Mobile-Optimized (Recommended)

Balanced performance and battery efficiency for mobile applications:

```typescript
import { configure } from 'expo-edge-speech';
import { InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

configure({
  network: {
    maxRetries: 3,
    baseRetryDelay: 1000,
    connectionTimeout: 8000,
    enableDebugLogging: false
  },
  connection: {
    maxConnections: 3,        // Conservative for mobile
    poolingEnabled: true,
    connectionTimeout: 8000,
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeout: 15000,
      testRequestLimit: 2
    }
  },
  audio: {
    loadingTimeout: 6000,
    autoInitializeAudioSession: true,
    platformConfig: {
      ios: {
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,  // Battery-friendly
        interruptionModeIOS: InterruptionModeIOS.DoNotMix
      },
      android: {
        shouldDuckAndroid: true,
        staysActiveInBackground: false,  // Battery-friendly
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix
      }
    }
  },
  storage: {
    maxBufferSize: 8 * 1024 * 1024,   // 8MB for mobile
    cleanupInterval: 20000,
    warningThreshold: 0.75
  },
  voice: {
    cacheTTL: 3600000,        // 1 hour
    enableCaching: true
  }
});
```

### ⚡ High-Performance

Maximum throughput for applications requiring fast synthesis:

```typescript
configure({
  network: {
    maxRetries: 2,
    baseRetryDelay: 500,
    maxRetryDelay: 3000,
    connectionTimeout: 5000,     // Faster timeout
    gracefulCloseTimeout: 2000
  },
  connection: {
    maxConnections: 8,           // More concurrent connections
    poolingEnabled: true,
    connectionTimeout: 5000,
    circuitBreaker: {
      failureThreshold: 10,      // More tolerant
      recoveryTimeout: 30000,
      testRequestLimit: 5
    }
  },
  storage: {
    maxBufferSize: 32 * 1024 * 1024, // 32MB for high performance
    cleanupInterval: 60000,
    warningThreshold: 0.9
  },
  voice: {
    cacheTTL: 7200000,          // 2 hours cache
    enableCaching: true
  }
});
```

### 🐛 Development & Debug

Optimized for development with detailed logging and fast failure detection:

```typescript
configure({
  network: {
    enableDebugLogging: true,   // Detailed network logs
    maxRetries: 1,              // Fail fast for debugging
    baseRetryDelay: 200,
    connectionTimeout: 3000
  },
  connection: {
    maxConnections: 2,          // Simpler connection management
    poolingEnabled: false,      // Easier to track individual requests
    circuitBreaker: {
      failureThreshold: 1,      // Immediate circuit breaker
      recoveryTimeout: 5000,
      testRequestLimit: 1
    }
  },
  voice: {
    enableDebugLogging: true,
    cacheTTL: 30000,            // Short cache for testing
    enableCaching: true
  },
  storage: {
    maxBufferSize: 4 * 1024 * 1024,  // 4MB for development
    cleanupInterval: 10000,
    warningThreshold: 0.6      // Early warnings
  }
});
```

### 🌐 Web-Optimized

Optimized for web browsers with appropriate limitations:

```typescript
configure({
  network: {
    maxRetries: 2,
    connectionTimeout: 10000,   // Web connections can be slower
    enableDebugLogging: false
  },
  connection: {
    maxConnections: 4,          // Browser connection limits
    poolingEnabled: true,
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 20000
    }
  },
  audio: {
    loadingTimeout: 10000,      // Web audio can take longer
    autoInitializeAudioSession: false,  // Manual control for web
    platformConfig: {
      web: {
        staysActiveInBackground: false  // Browser tab management
      }
    }
  },
  storage: {
    maxBufferSize: 16 * 1024 * 1024,  // 16MB for web
    cleanupInterval: 45000
  }
});
```

## Configuration Reference

### Network Service Configuration

Controls Edge TTS WebSocket communication and retry behavior:

```typescript
interface SpeechNetworkConfig {
  maxRetries?: number;                 // Default: 3
  baseRetryDelay?: number;            // Default: 1000 (1 second)
  maxRetryDelay?: number;             // Default: 10000 (10 seconds)
  connectionTimeout?: number;          // Default: 10000 (10 seconds)
  gracefulCloseTimeout?: number;       // Default: 5000 (5 seconds)
  enableDebugLogging?: boolean;        // Default: false
}
```

**Configuration Details:**

| Property | Description | Range | Notes |
|----------|-------------|-------|-------|
| `maxRetries` | Automatic retry attempts on failures | 0-10 | Higher values delay error reporting |
| `baseRetryDelay` | Initial retry delay with exponential backoff | 100-5000ms | Starting point for backoff calculation |
| `maxRetryDelay` | Maximum delay cap for exponential backoff | 1000-30000ms | Prevents excessive delays |
| `connectionTimeout` | WebSocket connection establishment timeout | 1000-60000ms | Adjust based on network conditions |
| `gracefulCloseTimeout` | Time to wait for clean connection closure | 1000-15000ms | Ensures proper cleanup |
| `enableDebugLogging` | Detailed network activity logging | boolean | Enable for troubleshooting |

**Example Usage:**
```typescript
// Aggressive retry for unreliable networks
configure({
  network: {
    maxRetries: 5,
    baseRetryDelay: 500,
    maxRetryDelay: 8000,
    connectionTimeout: 12000,
    enableDebugLogging: true
  }
});
```

---

### Connection Manager Configuration

Controls connection pooling, circuit breaker, and resource management:

```typescript
interface SpeechConnectionConfig {
  maxConnections?: number;             // Default: 5
  connectionTimeout?: number;          // Default: 10000
  poolingEnabled?: boolean;            // Default: false
  circuitBreaker?: CircuitBreakerConfig;
}

interface CircuitBreakerConfig {
  failureThreshold?: number;           // Default: 5
  recoveryTimeout?: number;            // Default: 30000
  testRequestLimit?: number;           // Default: 3
}
```

**Connection Pooling:**
- **Enabled**: Requests queue when max connections reached
- **Disabled**: Requests fail immediately when max connections reached
- **Recommendation**: Enable for production, disable for debugging

**Circuit Breaker States:**
1. **Closed** (Normal): All requests proceed normally
2. **Open** (Failing): All requests fail immediately after threshold
3. **Half-Open** (Testing): Limited requests test service recovery

**Example Usage:**
```typescript
// Production configuration with circuit breaker
configure({
  connection: {
    maxConnections: 6,
    poolingEnabled: true,
    circuitBreaker: {
      failureThreshold: 8,      // Allow more failures
      recoveryTimeout: 45000,   // Longer recovery time
      testRequestLimit: 5       // More test requests
    }
  }
});
```

---

### Audio Service Configuration

Controls audio playback and platform-specific behavior:

```typescript
interface SpeechAudioConfig {
  loadingTimeout?: number;             // Default: 5000
  autoInitializeAudioSession?: boolean; // Default: true
  platformConfig?: PlatformAudioConfig;
}

interface PlatformAudioConfig {
  ios?: {
    staysActiveInBackground?: boolean;
    playsInSilentModeIOS?: boolean;
    interruptionModeIOS: InterruptionModeIOS;  // Required
  };
  android?: {
    staysActiveInBackground?: boolean;
    shouldDuckAndroid?: boolean;
    playThroughEarpieceAndroid?: boolean;
    interruptionModeAndroid: InterruptionModeAndroid;  // Required
  };
  web?: {
    staysActiveInBackground?: boolean;
  };
}
```

**Platform-Specific Notes:**

**iOS Configuration:**
- `staysActiveInBackground`: Not available in Expo Go
- `playsInSilentModeIOS`: Essential for accessibility apps
- `interruptionModeIOS`: Required by expo-av, controls audio mixing

**Android Configuration:**
- `shouldDuckAndroid`: Lowers other audio during TTS
- `playThroughEarpieceAndroid`: For private listening
- `interruptionModeAndroid`: Required by expo-av, controls audio mixing

**Example Usage:**
```typescript
import { InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

// Accessibility-focused configuration
configure({
  audio: {
    loadingTimeout: 8000,
    autoInitializeAudioSession: true,
    platformConfig: {
      ios: {
        playsInSilentModeIOS: true,          // Critical for accessibility
        staysActiveInBackground: true,        // Background reading
        interruptionModeIOS: InterruptionModeIOS.DuckOthers
      },
      android: {
        shouldDuckAndroid: true,             // Lower other audio
        staysActiveInBackground: true,        // Background reading
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers
      }
    }
  }
});
```

---

### Storage Service Configuration

Controls memory management, buffering, and cleanup:

```typescript
interface SpeechStorageConfig {
  maxBufferSize?: number;              // Default: 16777216 (16MB)
  cleanupInterval?: number;            // Default: 30000 (30 seconds)
  warningThreshold?: number;           // Default: 0.8 (80%)
}
```

**Memory Management Guidelines:**

| Device Type | Recommended Buffer Size | Cleanup Interval | Notes |
|-------------|------------------------|------------------|-------|
| Mobile | 8-16MB | 20-30 seconds | Balance memory and performance |
| Tablet | 16-32MB | 30-60 seconds | More resources available |
| Web | 16-24MB | 30-45 seconds | Browser memory limits |
| Desktop | 32-64MB | 60-120 seconds | Maximum performance |

**Example Usage:**
```typescript
// Memory-constrained environment
configure({
  storage: {
    maxBufferSize: 4 * 1024 * 1024,    // 4MB
    cleanupInterval: 15000,             // 15 seconds
    warningThreshold: 0.6               // 60% warning
  }
});
```

---

### Voice Service Configuration

Controls voice list caching and fetching behavior:

```typescript
interface SpeechVoiceConfig {
  cacheTTL?: number;                   // Default: 3600000 (1 hour)
  enableCaching?: boolean;             // Default: true
  enableDebugLogging?: boolean;        // Default: false
  networkTimeout?: number;             // Default: 10000
}
```

**Caching Strategy:**
- **Short TTL** (15-30 minutes): Development and testing
- **Medium TTL** (1-2 hours): Production applications
- **Long TTL** (4-24 hours): Stable voice requirements

**Example Usage:**
```typescript
// Aggressive caching for stable production
configure({
  voice: {
    cacheTTL: 4 * 60 * 60 * 1000,     // 4 hours
    enableCaching: true,
    enableDebugLogging: false,
    networkTimeout: 8000
  }
});
```

## Advanced Configuration Patterns

### Dynamic Configuration

```typescript
// Environment-based configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

configure({
  network: {
    enableDebugLogging: isDevelopment,
    maxRetries: isDevelopment ? 1 : 3,
    connectionTimeout: isDevelopment ? 3000 : 8000
  },
  connection: {
    maxConnections: isDevelopment ? 2 : 5,
    poolingEnabled: isProduction
  },
  voice: {
    cacheTTL: isDevelopment ? 30000 : 3600000,
    enableDebugLogging: isDevelopment
  }
});
```

### Feature-Based Configuration

```typescript
// Configuration for different app features
const configureForFeature = (feature: 'accessibility' | 'gaming' | 'education') => {
  const baseConfig = {
    network: { maxRetries: 3, connectionTimeout: 8000 },
    connection: { maxConnections: 5, poolingEnabled: true }
  };

  switch (feature) {
    case 'accessibility':
      return {
        ...baseConfig,
        audio: {
          platformConfig: {
            ios: {
              playsInSilentModeIOS: true,
              staysActiveInBackground: true,
              interruptionModeIOS: InterruptionModeIOS.DuckOthers
            },
            android: {
              shouldDuckAndroid: true,
              staysActiveInBackground: true,
              interruptionModeAndroid: InterruptionModeAndroid.DuckOthers
            }
          }
        }
      };
    
    case 'gaming':
      return {
        ...baseConfig,
        network: { ...baseConfig.network, maxRetries: 2 },
        connection: { ...baseConfig.connection, maxConnections: 8 },
        storage: { maxBufferSize: 32 * 1024 * 1024 }
      };
    
    case 'education':
      return {
        ...baseConfig,
        storage: { maxBufferSize: 24 * 1024 * 1024 },
        voice: { cacheTTL: 7200000 }  // 2 hours
      };
  }
};

configure(configureForFeature('accessibility'));
```

### Performance Monitoring

```typescript
// Configuration with performance monitoring
const performanceConfig = {
  network: {
    enableDebugLogging: true,
    maxRetries: 3,
    connectionTimeout: 8000
  },
  connection: {
    maxConnections: 5,
    poolingEnabled: true,
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 30000,
      testRequestLimit: 3
    }
  },
  storage: {
    maxBufferSize: 16 * 1024 * 1024,
    cleanupInterval: 30000,
    warningThreshold: 0.75  // Monitor memory usage
  }
};

configure(performanceConfig);

// Monitor performance (if debugging enabled)
Speech.on('networkEvent', (event) => {
  console.log('Network event:', event);
});

Speech.on('memoryWarning', (usage) => {
  console.warn('Memory usage:', usage);
});
```

## Troubleshooting

### Common Configuration Issues

**1. Configuration After Initialization**
```typescript
// ❌ Wrong: Configure after first use
await speak('Hello');
configure({ network: { maxRetries: 5 } }); // Error!

// ✅ Correct: Configure before first use
configure({ network: { maxRetries: 5 } });
await speak('Hello');
```

**2. Invalid Platform Configuration**
```typescript
// ❌ Wrong: Missing required interruption modes
configure({
  audio: {
    platformConfig: {
      ios: {
        playsInSilentModeIOS: true
        // Missing interruptionModeIOS - Required!
      }
    }
  }
});

// ✅ Correct: Include required platform settings
configure({
  audio: {
    platformConfig: {
      ios: {
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix
      }
    }
  }
});
```

**3. Resource Configuration Issues**
```typescript
// ❌ Wrong: Excessive resource allocation
configure({
  connection: { maxConnections: 50 },      // Too many for mobile
  storage: { maxBufferSize: 500 * 1024 * 1024 }  // 500MB - too much!
});

// ✅ Correct: Reasonable resource limits
configure({
  connection: { maxConnections: 5 },       // Reasonable for mobile
  storage: { maxBufferSize: 16 * 1024 * 1024 }   // 16MB - appropriate
});
```

### Debug Configuration

```typescript
// Comprehensive debug configuration
configure({
  network: {
    enableDebugLogging: true,
    maxRetries: 1,                    // Fail fast
    connectionTimeout: 5000
  },
  connection: {
    maxConnections: 2,                // Simple tracking
    poolingEnabled: false,            // No queuing complexity
    circuitBreaker: {
      failureThreshold: 1,            // Immediate detection
      recoveryTimeout: 10000,
      testRequestLimit: 1
    }
  },
  voice: {
    enableDebugLogging: true,
    cacheTTL: 60000                   // 1 minute for testing
  },
  storage: {
    maxBufferSize: 4 * 1024 * 1024,  // 4MB
    cleanupInterval: 10000,           // Frequent cleanup
    warningThreshold: 0.5             // Early warnings
  }
});
```

### Performance Optimization

**For High-Frequency Usage:**
```typescript
configure({
  connection: {
    maxConnections: 8,
    poolingEnabled: true,
    circuitBreaker: {
      failureThreshold: 10,           // More tolerant
      recoveryTimeout: 60000
    }
  },
  storage: {
    maxBufferSize: 32 * 1024 * 1024, // 32MB
    cleanupInterval: 120000          // Less frequent cleanup
  },
  voice: {
    cacheTTL: 7200000                // 2 hours
  }
});
```

**For Memory-Constrained Environments:**
```typescript
configure({
  connection: {
    maxConnections: 2,
    poolingEnabled: false
  },
  storage: {
    maxBufferSize: 4 * 1024 * 1024,  // 4MB
    cleanupInterval: 15000,          // Frequent cleanup
    warningThreshold: 0.6            // Early warnings
  },
  voice: {
    cacheTTL: 300000                 // 5 minutes
  }
});
```

## Best Practices

### 1. Use Configuration Presets
Start with a preset and customize as needed rather than building from scratch.

### 2. Environment-Specific Configuration
Use different configurations for development, staging, and production.

### 3. Monitor Resource Usage
Enable debug logging during development to understand resource consumption.

### 4. Test Circuit Breaker Behavior
Verify circuit breaker settings work correctly for your network conditions.

### 5. Platform-Specific Testing
Test audio configuration on actual devices for each target platform.

### 6. Gradual Optimization
Start with conservative settings and optimize based on real usage patterns.

---

For complete configuration examples and integration patterns, see the [Configuration Guide](./configuration.md) and [Usage Examples](./usage-examples.md).

## TypeScript Support

Full TypeScript support with comprehensive type definitions and IntelliSense:

```typescript
import type { 
  SpeechAPIConfig,
  SpeechNetworkConfig,
  SpeechAudioConfig,
  SpeechConnectionConfig,
  SpeechStorageConfig,
  SpeechVoiceConfig,
  CircuitBreakerConfig,
  PlatformAudioConfig
} from 'expo-edge-speech';

// Full type checking and IDE support
const config: SpeechAPIConfig = {
  network: {
    maxRetries: 3,                    // IntelliSense shows: number
    enableDebugLogging: true          // IntelliSense shows: boolean
  },
  connection: {
    maxConnections: 5,                // IntelliSense shows: number
    poolingEnabled: true,             // IntelliSense shows: boolean
    circuitBreaker: {
      failureThreshold: 5,            // IntelliSense shows: number
      recoveryTimeout: 30000,         // IntelliSense shows: number
      testRequestLimit: 3             // IntelliSense shows: number
    }
  }
};

configure(config);
```
