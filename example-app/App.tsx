import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Picker } from '@react-native-picker/picker';
import * as Speech from 'expo-edge-speech';
import { configure } from 'expo-edge-speech';
import type { EdgeSpeechVoice, SpeechAPIConfig } from '../src/types';
import type { ReactNativeWebSocket } from '../src/rn-types';
import { InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

export default function App() {
  // Voice management state
  const [voices, setVoices] = useState<EdgeSpeechVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [loadingVoices, setLoadingVoices] = useState(false);

  // Text and speech settings
  const [text, setText] = useState('I bought a new smartphone yesterday.我昨天买了一部新的smartphone。昨日新しいスマートフォンを買いました。');
  const [pitch, setPitch] = useState(1.0); // Default 1.0 = normal pitch (range: 0.0-2.0)
  const [rate, setRate] = useState(1.0);   // Default 1.0 = normal speed (range: 0.0-2.0)
  const [volume, setVolume] = useState(1.0); // Updated to 1.0 for better default experience with 0.0-2.0 range

  // Speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready');

  // WebSocket test state
  const [isTestingWebSocket, setIsTestingWebSocket] = useState(false);
  const [webSocketTestResult, setWebSocketTestResult] = useState<string>('Not tested');
  const [webSocketTestStatus, setWebSocketTestStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');

  // UI state
  const [isAudioSettingsMinimized, setIsAudioSettingsMinimized] = useState(true);

  // Timeout ref for starting state
  const startingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor state changes for debugging
  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] State change - isSpeaking: ${isSpeaking}, isStarting: ${isStarting}, isPaused: ${isPaused}`);
  }, [isSpeaking, isStarting, isPaused]);

  // Helper function for intelligent voice selection
  const selectOptimalVoice = (voices: EdgeSpeechVoice[]): EdgeSpeechVoice | null => {
    // Priority 1: Multilingual voices
    const multilingualVoices = voices.filter(v => 
      v.identifier.toLowerCase().includes('multilingual') ||
      v.name.toLowerCase().includes('multilingual')
    );
    
    if (multilingualVoices.length > 0) {
      return multilingualVoices[0];
    }
    
    // Priority 2: English voices
    const englishVoices = voices.filter(v => v.language.startsWith('en-'));
    if (englishVoices.length > 0) {
      return englishVoices[0];
    }
    
    // Fallback: any available voice
    return voices.length > 0 ? voices[0] : null;
  };

  // Configure Speech API with debug output
  useEffect(() => {
    const speechConfig: SpeechAPIConfig = {
      network: {
        maxRetries: 3,
        connectionTimeout: 8000,
        enableDebugLogging: true  // Enable debug output
      },
      connection: {
        maxConnections: 5,
        poolingEnabled: true
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
            playThroughEarpieceAndroid: false,
            interruptionModeAndroid: InterruptionModeAndroid.DoNotMix
          }
        }
      }
    };

    try {
      configure(speechConfig);
      setStatusMessage('Speech API configured with debug logging');
      console.log('✅ Speech API configured with debug output enabled');
    } catch (error) {
      console.error('❌ Failed to configure Speech API:', error);
      setStatusMessage('Failed to configure Speech API');
    }
  }, []);

  // Fetch available voices
  const fetchVoices = async () => {
    setLoadingVoices(true);
    setStatusMessage('Fetching voices...');
    
    try {
      const availableVoices = await Speech.getAvailableVoicesAsync();
      setVoices(availableVoices);
      
      // Use intelligent voice selection to prioritize multilingual voices
      const optimalVoice = selectOptimalVoice(availableVoices);
      if (optimalVoice) {
        setSelectedVoice(optimalVoice.identifier);
        
        // Provide enhanced status feedback
        const isMultilingual = optimalVoice.identifier.toLowerCase().includes('multilingual') ||
                              optimalVoice.name.toLowerCase().includes('multilingual');
        setStatusMessage(`Loaded ${availableVoices.length} voices - Auto-selected ${isMultilingual ? 'multilingual' : ''} voice: ${optimalVoice.name}`);
      } else {
        setStatusMessage(`Loaded ${availableVoices.length} voices`);
      }
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      Alert.alert('Error', 'Failed to fetch voices. Please try again.');
      setStatusMessage('Error fetching voices');
    } finally {
      setLoadingVoices(false);
    }
  };

  // Speak the text
  const speakText = async () => {
    if (!text.trim()) {
      Alert.alert('Error', 'Please enter some text to speak');
      return;
    }

    try {
      console.log('Starting speech synthesis - setting isStarting to true');
      setIsStarting(true);
      setIsPaused(false);
      
      // Timeout fallback to reset starting state
      startingTimeoutRef.current = setTimeout(() => {
        console.log('Starting timeout reached - resetting isStarting state');
        setIsStarting(false);
        setStatusMessage('Speech start timeout - please try again');
      }, 5000);
      
      // Provide status feedback based on voice selection
      if (selectedVoice) {
        setStatusMessage('Preparing speech with selected voice...');
      } else {
        setStatusMessage('Preparing speech with automatic voice selection...');
      }

      await Speech.speak(text, {
        voice: selectedVoice || undefined,  // Pass voice only if selected, allow automatic resolution
        rate: rate,
        pitch: pitch,
        volume: volume,
        onStart: () => {
          console.log('Speech actually started - setting isSpeaking to true, isStarting to false');
          if (startingTimeoutRef.current) clearTimeout(startingTimeoutRef.current);
          setIsSpeaking(true);
          setIsStarting(false);
          setStatusMessage('Speech started');
        },
        onDone: () => {
          console.log('Speech completed - resetting all states');
          if (startingTimeoutRef.current) clearTimeout(startingTimeoutRef.current);
          setIsSpeaking(false);
          setIsStarting(false);
          setIsPaused(false);
          setStatusMessage('Speech completed');
        },
        onStopped: () => {
          console.log('Speech stopped via onStopped callback - resetting all states');
          if (startingTimeoutRef.current) clearTimeout(startingTimeoutRef.current);
          setIsSpeaking(false);
          setIsStarting(false);
          setIsPaused(false);
          setStatusMessage('Speech stopped');
        },
        onError: (error: any) => {
          console.error('Speech error - resetting all states:', error);
          if (startingTimeoutRef.current) clearTimeout(startingTimeoutRef.current);
          setIsSpeaking(false);
          setIsStarting(false);
          setIsPaused(false);
          setStatusMessage('Speech error occurred');
          Alert.alert('Speech Error', error.message);
        },
        onPause: () => {
          console.log('Speech paused via onPause callback');
          setIsPaused(true);
          setStatusMessage('Speech paused');
        },
        onResume: () => {
          console.log('Speech resumed via onResume callback');
          setIsPaused(false);
          setStatusMessage('Speech resumed');
        },
        onBoundary: (boundary: any) => {
          // Optional: Could highlight words as they're spoken
          // console.log('Word boundary:', boundary);
        }
      });
    } catch (error) {
      console.error('Failed to speak - resetting all states:', error);
      if (startingTimeoutRef.current) clearTimeout(startingTimeoutRef.current);
      setIsSpeaking(false);
      setIsStarting(false);
      setIsPaused(false);
      setStatusMessage('Failed to start speech');
      Alert.alert('Error', 'Failed to start speech synthesis');
    }
  };

  // Stop speech
  const stopSpeech = useCallback(async () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] stopSpeech called - isSpeaking: ${isSpeaking}, isStarting: ${isStarting}, isPaused: ${isPaused}`);
    try {
      await Speech.stop();
      console.log(`[${timestamp}] Speech.stop() completed successfully`);
      if (startingTimeoutRef.current) clearTimeout(startingTimeoutRef.current);
      setIsSpeaking(false);
      setIsStarting(false);
      setIsPaused(false);
      setStatusMessage('Speech stopped');
    } catch (error) {
      console.error(`[${timestamp}] Failed to stop speech:`, error);
      Alert.alert('Error', 'Failed to stop speech');
    }
  }, [isSpeaking, isStarting, isPaused]);

  // Pause speech
  const pauseSpeech = async () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] pauseSpeech called - isSpeaking: ${isSpeaking}, isPaused: ${isPaused}`);
    
    // NOTE: Pause only works during audio playback phase, not during network synthesis.
    // The pause/resume buttons are properly disabled during network requests (when isLoading=true)
    // to prevent attempting pause operations during the synthesis phase.
    // This demonstrates proper phase-aware implementation as recommended in the documentation.
    
    try {
      await Speech.pause();
      console.log(`[${timestamp}] Speech.pause() completed successfully`);
      // State updates handled by onPause callback
    } catch (error) {
      console.error(`[${timestamp}] Failed to pause speech:`, error);
      Alert.alert('Error', 'Failed to pause speech');
    }
  };

  // Resume speech
  const resumeSpeech = async () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] resumeSpeech called - isSpeaking: ${isSpeaking}, isPaused: ${isPaused}`);
    
    // NOTE: Resume only works during audio playback phase, not during network synthesis.
    // Proper state checking ensures resume is only called when speech is actually paused
    // and during the playback phase. The UI state management demonstrates the recommended
    // pattern of relying on onPause/onResume callbacks for state synchronization.
    
    try {
      await Speech.resume();
      console.log(`[${timestamp}] Speech.resume() completed successfully`);
      // State updates handled by onResume callback
    } catch (error) {
      console.error(`[${timestamp}] Failed to resume speech:`, error);
      Alert.alert('Error', 'Failed to resume speech');
    }
  };

  // Test WebSocket connection to echo server
  const testWebSocketConnection = async () => {
    if (isTestingWebSocket) return;
    
    setIsTestingWebSocket(true);
    setWebSocketTestStatus('connecting');
    setWebSocketTestResult('Connecting to WebSocket echo server...');

    try {
      const ws = new WebSocket('wss://echo.websocket.org/', undefined, {
        headers: {
          Origin: 'https://websocket.org',
        },
      }) as ReactNativeWebSocket;
      const testMessage = 'Hello';
      let testCompleted = false;
      let receivedWelcome = false;
      
      // Set timeout for the test
      const timeout = setTimeout(() => {
        if (!testCompleted) {
          testCompleted = true;
          ws.close();
          setWebSocketTestStatus('error');
          setWebSocketTestResult('Test timed out after 5 seconds');
          setIsTestingWebSocket(false);
        }
      }, 5000);

      ws.onopen = () => {
        setWebSocketTestResult('Connected! Waiting for welcome message...');
      };

      ws.onmessage = (event) => {
        if (testCompleted) return;
        
        const message = event.data;
        
        if (!receivedWelcome) {
          // First message should be the welcome message
          if (typeof message === 'string' && message.startsWith('Request served by ')) {
            receivedWelcome = true;
            setWebSocketTestResult(`Welcome received: "${message}". Sending test message...`);
            ws.send(testMessage);
          } else {
            testCompleted = true;
            clearTimeout(timeout);
            setWebSocketTestStatus('error');
            setWebSocketTestResult(`Error: Expected welcome message starting with "Request served by ", got "${message}"`);
            ws.close();
            setIsTestingWebSocket(false);
          }
        } else {
          // Second message should be our echo
          testCompleted = true;
          clearTimeout(timeout);
          
          if (message === testMessage) {
            setWebSocketTestStatus('success');
            setWebSocketTestResult(`Success! Welcome and echo test passed. Echo received: "${message}"`);
          } else {
            setWebSocketTestStatus('error');
            setWebSocketTestResult(`Error: Expected echo "${testMessage}", got "${message}"`);
          }
          
          ws.close();
          setIsTestingWebSocket(false);
        }
      };

      ws.onerror = (error) => {
        if (!testCompleted) {
          testCompleted = true;
          clearTimeout(timeout);
          setWebSocketTestStatus('error');
          setWebSocketTestResult(`Connection error: ${error}`);
          setIsTestingWebSocket(false);
        }
      };

      ws.onclose = (event) => {
        if (!testCompleted) {
          testCompleted = true;
          clearTimeout(timeout);
          setWebSocketTestStatus('error');
          setWebSocketTestResult(`Connection closed unexpectedly: ${event.code} ${event.reason}`);
          setIsTestingWebSocket(false);
        }
      };

    } catch (error) {
      setWebSocketTestStatus('error');
      setWebSocketTestResult(`Failed to create WebSocket: ${error}`);
      setIsTestingWebSocket(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Expo Edge Speech Demo</Text>
          <Text style={styles.subtitle}>Microsoft Edge TTS Integration</Text>
          <View style={styles.debugIndicator}>
            <Text style={styles.debugText}>🔧 Debug Output Enabled</Text>
          </View>
        </View>

        {/* Voice Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Selection</Text>
          
          <TouchableOpacity style={styles.button} onPress={fetchVoices} disabled={loadingVoices}>
            {loadingVoices ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Fetch Voices</Text>
            )}
          </TouchableOpacity>

          {voices.length > 0 && (
            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Select Voice:</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedVoice}
                  onValueChange={setSelectedVoice}
                  style={styles.picker}
                >
                  {voices.map((voice) => (
                    <Picker.Item
                      key={voice.identifier}
                      label={`${voice.name} (${voice.language})`}
                      value={voice.identifier}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          )}
        </View>

        {/* Text Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Text to Speak</Text>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder="Enter text to speak..."
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Audio Controls */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setIsAudioSettingsMinimized(!isAudioSettingsMinimized)}
          >
            <Text style={styles.sectionTitle}>Audio Settings</Text>
            <Text style={styles.minimizeIcon}>
              {isAudioSettingsMinimized ? '▼' : '▲'}
            </Text>
          </TouchableOpacity>
          
          {!isAudioSettingsMinimized && (
            <>
              <View style={styles.parameterInfo}>
                <Text style={styles.parameterInfoText}>
                  📊 Parameter Ranges: All values range from 0.0 to 2.0, where 1.0 represents normal/default settings.
                </Text>
                <TouchableOpacity 
                  style={styles.resetButton}
                  onPress={() => {
                    setPitch(1.0);
                    setRate(1.0);
                    setVolume(1.0);
                  }}
                >
                  <Text style={styles.resetButtonText}>🔄 Reset to Normal</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>Pitch: {pitch.toFixed(1)} <Text style={styles.rangeHint}>(0.0-2.0, normal: 1.0)</Text></Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0.0}
                  maximumValue={2.0}
                  value={pitch}
                  onValueChange={setPitch}
                  step={0.1}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#E0E0E0"
                />
              </View>

              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>Rate: {rate.toFixed(1)} <Text style={styles.rangeHint}>(0.0-2.0, normal: 1.0)</Text></Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0.0}
                  maximumValue={2.0}
                  value={rate}
                  onValueChange={setRate}
                  step={0.1}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#E0E0E0"
                />
              </View>

              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>Volume: {volume.toFixed(1)} <Text style={styles.rangeHint}>(0.0-2.0, normal: 1.0)</Text></Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0.0}
                  maximumValue={2.0}
                  value={volume}
                  onValueChange={setVolume}
                  step={0.1}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#E0E0E0"
                />
              </View>
            </>
          )}
        </View>

        {/* Speech Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Speech Controls</Text>
          
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[styles.controlButton, styles.speakButton]}
              onPress={speakText}
              disabled={isSpeaking && !isPaused}
            >
              <Text style={styles.controlButtonText}>Speak</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlButton, 
                styles.stopButton, 
                (!isSpeaking && !isStarting) && styles.buttonDisabled,
                isStarting && { backgroundColor: '#FF9500' }
              ]}
              onPress={stopSpeech}
              disabled={!isSpeaking && !isStarting}
            >
              <Text style={[
                styles.controlButtonText, 
                (!isSpeaking && !isStarting) && { color: '#999' }
              ]}>
                {isStarting ? 'Starting...' : 'Stop'}
              </Text>
            </TouchableOpacity>

            {isSpeaking && !isPaused && (
              <TouchableOpacity
                style={[styles.controlButton, styles.pauseButton]}
                onPress={pauseSpeech}
              >
                <Text style={styles.controlButtonText}>Pause</Text>
              </TouchableOpacity>
            )}

            {isSpeaking && isPaused && (
              <TouchableOpacity
                style={[styles.controlButton, styles.resumeButton]}
                onPress={resumeSpeech}
              >
                <Text style={styles.controlButtonText}>Resume</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>{statusMessage}</Text>
            {isSpeaking && <ActivityIndicator size="small" color="#007AFF" />}
          </View>
        </View>

        {/* WebSocket Test */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WebSocket Connection Test</Text>
          
          <TouchableOpacity
            style={[styles.button, isTestingWebSocket && styles.buttonDisabled]}
            onPress={testWebSocketConnection}
            disabled={isTestingWebSocket}
          >
            {isTestingWebSocket ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Test WebSocket Connection</Text>
            )}
          </TouchableOpacity>

          <View style={styles.testResultContainer}>
            <Text style={styles.testResultLabel}>Test Result:</Text>
            <Text style={[
              styles.testResultText,
              webSocketTestStatus === 'success' && styles.testResultSuccess,
              webSocketTestStatus === 'error' && styles.testResultError,
            ]}>
              {webSocketTestResult}
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    marginTop: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 10,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    overflow: 'hidden',
  },
  picker: {
    backgroundColor: 'transparent',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  minimizeIcon: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  sliderContainer: {
    marginBottom: 20,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 10,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  controlsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  controlButton: {
    flex: 1,
    marginHorizontal: 5,
    marginVertical: 5,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  speakButton: {
    backgroundColor: '#34C759',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  pauseButton: {
    backgroundColor: '#FF9500',
  },
  resumeButton: {
    backgroundColor: '#007AFF',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusText: {
    fontSize: 16,
    color: '#333',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  testResultContainer: {
    marginTop: 15,
  },
  testResultLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  testResultText: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  testResultSuccess: {
    borderColor: '#34C759',
    backgroundColor: '#f0fff4',
    color: '#2d5a2d',
  },
  testResultError: {
    borderColor: '#FF3B30',
    backgroundColor: '#fff5f5',
    color: '#d32f2f',
  },
  debugIndicator: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 16,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  parameterInfo: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  parameterInfoText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  rangeHint: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'normal',
  },
  resetButton: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dee2e6',
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500',
  },
});
