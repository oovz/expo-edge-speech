# expo-edge-speech
*Microsoft Edge text-to-speech for Expo and React Native*

![Version](https://img.shields.io/npm/v/expo-edge-speech)
![License](https://img.shields.io/npm/l/expo-edge-speech)
![Downloads](https://img.shields.io/npm/dm/expo-edge-speech)

## Description

expo-edge-speech is a text-to-speech library for Expo and React Native applications that provides high-quality voice synthesis using Microsoft's Edge TTS service. It offers a drop-in replacement for expo-speech with enhanced features including 400+ natural voices, better voice quality, word boundary events, and cross-platform support for both iOS and Android.

## Installation

### For Expo Projects

```bash
npm install expo-edge-speech
```

### For React Native Projects

React Native projects need Expo to use this library (and its dependencies):

```bash
# Install Expo (if not already installed)
npm install expo@sdk-52

# Install the library
npm install expo-edge-speech
```

### Requirements

- **Expo SDK 52** or higher
- **iOS 15.1+** / **Android API 24+**
- **React Native 0.76.9+**

## Usage

```typescript
import * as Speech from 'expo-edge-speech';

// Basic text-to-speech
await Speech.speak('Hello world');

// With options
await Speech.speak('Welcome to my app!', {
  voice: 'en-US-AriaNeural',
  rate: 1.2,
  onDone: () => console.log('Speech completed')
});
```

## Development

To contribute to this project:

```bash
# Clone the repository
git clone https://github.com/oovz/expo-edge-speech.git

# Install dependencies
cd expo-edge-speech
yarn install

# Run development server (tsc:watch)
yarn dev

# Run example app
cd example-app
npx expo start
```

## Credit

**Created by** [Otaro](https://github.com/oovz)

**Built with:**
- [expo-av](https://docs.expo.dev/versions/latest/sdk/av/) - Audio playback functionality
- [expo-crypto](https://docs.expo.dev/versions/latest/sdk/crypto/) - Cryptographic operations
- [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/) - File management and caching
- [edge-tts](https://github.com/rany2/edge-tts) - Edge TTS Python library

## License

This project is licensed under the MIT License.
