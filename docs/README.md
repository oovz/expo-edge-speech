# expo-edge-speech Documentation

Welcome to the expo-edge-speech documentation! This guide will help you get started with high-quality text-to-speech synthesis using Microsoft Edge TTS in your Expo and React Native applications.

## 📚 Documentation Overview

### Essential Reading
1. **[API Reference](./api-reference.md)** - Complete function documentation and core concepts
2. **[Usage Examples](./usage-examples.md)** - Practical examples and common patterns
3. **[Configuration Guide](./configuration.md)** - Setup and performance optimization

### Advanced Topics
4. **[Platform Considerations](./platform-considerations.md)** - iOS/Android specific requirements
5. **[TypeScript Interfaces](./typescript-interfaces.md)** - Type definitions and interfaces

### Developer Resources
6. **[Development Workflow](./DEVELOPMENT-workflow.md)** - Internal implementation details (for contributors)

## 🚀 Quick Start

1. **Install the library:**
   ```bash
   npx expo install expo-edge-speech
   ```

2. **Basic usage:**
   ```typescript
   import * as Speech from 'expo-edge-speech';
   
   await Speech.speak('Hello, world!');
   ```

3. **With options:**
   ```typescript
   await Speech.speak('Welcome to my app!', {
     voice: 'en-US-AriaNeural',
     rate: 1.2,
     onDone: () => console.log('Speech completed')
   });
   ```

## 🎯 Key Features

- **Drop-in replacement** for expo-speech with identical API
- **Enhanced voice quality** through Microsoft Edge TTS service
- **400+ natural voices** with multilingual support
- **Cross-platform pause/resume** support (including Android)
- **Word boundary events** for real-time text highlighting
- **Advanced configuration** for performance optimization
- **Comprehensive error handling** and recovery mechanisms

## 📱 Platform Support

- **iOS:** 15.1+ (Expo SDK 52+)
- **Android:** API 24+ (Expo SDK 52+)
- **React Native:** 0.76.9+

## 🔧 Configuration

For most apps, the default configuration works perfectly:

```typescript
import * as Speech from 'expo-edge-speech';

// Works out of the box
await Speech.speak('Hello, world!');
```

For advanced use cases, see the [Configuration Guide](./configuration.md) for optimization options.

## 📖 Documentation Structure

- **Getting Started:** Start with the [API Reference](./api-reference.md)
- **Examples:** See [Usage Examples](./usage-examples.md) for common patterns
- **Performance:** Check [Configuration Guide](./configuration.md) for optimization
- **Platform Issues:** Review [Platform Considerations](./platform-considerations.md)
- **TypeScript:** See [TypeScript Interfaces](./typescript-interfaces.md) for type safety

## 🆘 Troubleshooting

Common issues and solutions:

1. **Speech not playing:** Check device volume, verify voice availability
2. **Performance issues:** See configuration guide for optimization
3. **Platform-specific issues:** Review platform considerations document
4. **TypeScript errors:** Check interface documentation

For detailed troubleshooting, see the respective documentation files.

## 🔗 Related Links

- [expo-speech API](https://docs.expo.dev/versions/latest/sdk/speech/) - Original Expo speech API
- [expo-av](https://docs.expo.dev/versions/latest/sdk/av/) - Audio/video functionality
- [Microsoft Edge TTS](https://azure.microsoft.com/services/cognitive-services/text-to-speech/) - Voice synthesis service

## 📄 License

This project is licensed under the MIT License.