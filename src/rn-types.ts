// =============================================================================
// React Native WebSocket Type Declaration
// =============================================================================

/**
 * React Native WebSocket interface based on actual RN v0.76.9 source code.
 * React Native WebSocket differs from DOM WebSocket in several ways:
 * 1. Event objects have different shapes (no WebSocketMessageEvent, WebSocketCloseEvent etc.)
 * 2. Constructor accepts options parameter with headers
 * 3. Event handlers receive plain objects instead of DOM event instances
 * https://github.com/facebook/react-native/blob/v0.76.9/packages/react-native/Libraries/WebSocket/WebSocket.js
 */
export interface ReactNativeWebSocket extends EventTarget {
  readonly readyState: number;
  readonly url?: string;
  readonly protocol?: string;
  readonly extensions?: string;
  readonly bufferedAmount: number;

  constructor(
    url: string,
    protocols?: string | string[],
    options?: { headers?: { origin?: string } & {} },
  ): ReactNativeWebSocket;
  send(data: string | ArrayBuffer | ArrayBufferView | Blob): void;
  close(code?: number, reason?: string): void;
  ping(): void;

  get binaryType(): "blob" | "arraybuffer" | null;
  set binaryType(binaryType: "blob" | "arraybuffer");

  onopen: (() => void) | null;
  onmessage: ((event: WebSocketMessageEvent) => void) | null;
  onerror: ((event: WebSocketErrorEvent) => void) | null;
  onclose: ((event: WebSocketCloseEvent) => void) | null;
}
