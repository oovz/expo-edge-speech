# Platform-Specific Considerations

This document covers platform-specific configurations, optimizations, and considerations for expo-edge-speech across iOS and Android platforms.

## Minimum Platform Requirements

**Expo SDK 52 Requirements:**
- **iOS**: iOS 15.1+ (minimum deployment target raised from iOS 13.4)
- **Android**: API level 24+ / Android 7.0+ (minSdkVersion raised from 23)

These requirements are enforced by Expo SDK 52 and React Native 0.76.9. Applications targeting older platform versions will need to use an earlier version of expo-edge-speech compatible with previous Expo SDK versions.

**Required Dependencies:**
- **expo**: ~52.0.47
- **expo-av**: ~15.0.2 (for audio playback)
- **react-native**: 0.76.9

## Platform Support Matrix

| Feature | iOS | Android | Notes |
|---------|-----|---------|-------|
| Speech Synthesis | ✅ | ✅ | Full compatibility with Microsoft Edge TTS |
| Background Playback | ⚠️* | ✅ | *iOS restrictions in Expo Go environment |
| Word Boundaries | ✅ | ✅ | Real-time word boundary events |
| Audio Queue Management | ✅ | ✅ | Intelligent queue handling |
| Offline Playback | ✅ | ✅ | Cached audio playback without network |
| Voice Caching | ✅ | ✅ | Automatic voice list caching |
| Network Recovery | ✅ | ✅ | Automatic retry with circuit breaker |
| Pause/Resume | ✅ | ✅ | Enhanced Android support vs expo-speech |

## expo-speech API Compatibility

expo-edge-speech provides full compatibility with the expo-speech API while offering enhanced functionality and improved cross-platform behavior.

### Usage Pattern

```typescript
import * as Speech from 'expo-edge-speech';

// Works consistently across all platforms (iOS, Android)
await Speech.speak("Hello world", {
  onStart: () => console.log("Speech started"),
  onDone: () => console.log("Speech completed"),
  onError: (error) => console.error("Speech error:", error),
});

// Enhanced pause/resume operations
await Speech.pause();   // ✅ Works on Android (unlike expo-speech)
await Speech.resume();  // ✅ Works on Android (unlike expo-speech)

// State checking
const isSpeaking = await Speech.isSpeakingAsync();
console.log(`Currently speaking: ${isSpeaking}`);
```

## Architecture and State Management

**Two-Phase Synthesis Architecture:**
expo-edge-speech uses a sophisticated two-phase workflow that ensures reliable audio delivery:

### Phase 1: Network Synthesis
- Text is processed and complete audio is generated on Microsoft's servers
- Audio data is fully downloaded and cached locally
- No audio playback occurs during this phase
- `isSpeakingAsync()` returns `false`
- Pause/resume operations are not available

### Phase 2: Local Playback  
- Complete audio file is played locally using expo-av
- High-quality playback with full control capabilities
- `isSpeakingAsync()` returns `true` during active playback
- Pause/resume operations are fully available
- Word boundary events are fired in real-time

**API Behavior:**
- `isSpeakingAsync()` returns `true` even when speech is paused (matches expo-speech behavior)
- Pause/resume operations only function during the local playback phase
- State transitions are consistent across iOS and Android platforms
- Always check `isSpeakingAsync()` before calling pause/resume operations

**Architectural Advantages:**
- **Better Audio Quality**: Complete synthesis before playback ensures optimal audio fidelity
- **Reliable Cross-Platform Behavior**: Consistent experience across iOS and Android
- **Enhanced Android Support**: Full pause/resume functionality that expo-speech cannot provide
- **Network Resilience**: Complete download before playback prevents interruptions

## Background Playback Considerations

**iOS Background Playback:**
- Supported in standalone apps with proper configuration
- **Not supported in Expo Go** due to platform restrictions
- Requires background audio capability in app.json configuration
- See [expo-av AudioMode documentation](https://docs.expo.dev/versions/v52.0.0/sdk/audio-av/#audiomode) for implementation details

**Android Background Playback:**
- Fully supported in both Expo Go and standalone apps
- No additional configuration required for basic background playback
- Enhanced control capabilities compared to expo-speech

## Platform-Specific Optimizations

**iOS Optimizations:**
- Intelligent memory management for audio caching
- Optimized for iOS audio session management
- Efficient handling of audio interruptions

**Android Optimizations:**
- Enhanced audio focus management
- Optimized for Android audio routing
- Better integration with system audio controls

**Cross-Platform Features:**
- Consistent voice caching behavior
- Unified error handling and recovery
- Standardized word boundary event timing