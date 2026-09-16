/**
 * Cloudflare Pages Function: /api/tts
 * Connects directly to Microsoft Edge Speech Neural TTS on the Edge.
 * Provides high-fidelity, human-like Arabic & Egyptian neural voices for free.
 */

const DEFAULT_VOICE = 'ar-EG-ShakirNeural';

const READALOUD_BASE = 'speech.platform.bing.com/consumer/speech/synthesize/readaloud';
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR_VERSION = '143';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;

const BASE_HEADERS = {
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
  'Accept-Language': 'ar-EG,ar;q=0.9,en;q=0.8',
};

const UPGRADE_HEADERS = {
  ...BASE_HEADERS,
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  Pragma: 'no-cache',
  'Cache-Control': 'no-cache',
  'Sec-WebSocket-Version': '13',
  Upgrade: 'websocket',
};

function escapeXml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function removeInvalidXmlCharacters(text: string) {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ' ');
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.]/g, '').slice(0, -1);
}

function makeConnectionId() {
  return crypto.randomUUID().replace(/-/g, '');
}

function makeMuid() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function makeSecMsGec() {
  const winEpoch = 11644473600;
  const secondsToNs = 1e9;
  let ticks = Date.now() / 1000;
  ticks += winEpoch;
  ticks -= ticks % 300;
  ticks *= secondsToNs / 100;
  const payload = `${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function buildSynthesisUrl(secMsGec: string, connectionId: string) {
  const url = new URL(`https://${READALOUD_BASE}/edge/v1`);
  url.searchParams.set('TrustedClientToken', TRUSTED_CLIENT_TOKEN);
  url.searchParams.set('Sec-MS-GEC', secMsGec);
  url.searchParams.set('Sec-MS-GEC-Version', SEC_MS_GEC_VERSION);
  url.searchParams.set('ConnectionId', connectionId);
  return url.toString();
}

function buildSpeechConfigMessage() {
  return (
    `X-Timestamp:${timestamp()}\r\n` +
    'Content-Type:application/json; charset=utf-8\r\n' +
    'Path:speech.config\r\n\r\n' +
    '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n'
  );
}

function buildSsmlMessage(requestId: string, voice: string, text: string) {
  const ssml =
    "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ar-EG'>" +
    `<voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapeXml(
      removeInvalidXmlCharacters(text)
    )}</prosody></voice></speak>`;

  return (
    `X-RequestId:${requestId}\r\n` +
    'Content-Type:application/ssml+xml\r\n' +
    `X-Timestamp:${timestamp()}Z\r\n` +
    'Path:ssml\r\n\r\n' +
    ssml
  );
}

function parseBinaryAudioFrame(data: Uint8Array) {
  if (data.length < 2) {
    throw new Error('binary frame missing header');
  }
  const headerLength = (data[0] << 8) | data[1];
  if (data.length < 2 + headerLength) {
    throw new Error('binary frame truncated');
  }
  const headerText = new TextDecoder().decode(data.slice(2, 2 + headerLength));
  const headers: Record<string, string> = {};
  for (const line of headerText.split('\r\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      headers[line.slice(0, idx)] = line.slice(idx + 1).trim();
    }
  }
  return {
    headers,
    body: data.slice(2 + headerLength),
  };
}

function parseTextHeaders(message: string) {
  const separator = message.indexOf('\r\n\r\n');
  const headerText = separator >= 0 ? message.slice(0, separator) : message;
  const headers: Record<string, string> = {};
  for (const line of headerText.split('\r\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      headers[line.slice(0, idx)] = line.slice(idx + 1).trim();
    }
  }
  return headers;
}

function createReadableAudioStream(socket: WebSocket, text: string, voice: string, requestId: string) {
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let audioReceived = false;
  let settled = false;

  const cleanup = () => {
    socket.removeEventListener('message', onMessage);
    socket.removeEventListener('close', onClose);
    socket.removeEventListener('error', onError);
  };

  const finish = () => {
    if (settled) return;
    settled = true;
    cleanup();
    controllerRef?.close();
  };

  const finishWithError = (err: unknown) => {
    if (settled) return;
    settled = true;
    cleanup();
    controllerRef?.error(err instanceof Error ? err : new Error(String(err)));
  };

  const onMessage = (event: MessageEvent) => {
    if (settled) return;
    const data = event.data;

    if (typeof data === 'string') {
      const headers = parseTextHeaders(data);
      if (headers.Path === 'turn.end') {
        try {
          socket.close();
        } catch {}
        finish();
        return;
      }
      return;
    }

    const binary = data instanceof ArrayBuffer ? new Uint8Array(data) : (data as Uint8Array);
    try {
      const { headers, body } = parseBinaryAudioFrame(binary);
      if (headers.Path === 'audio' && body.length > 0) {
        audioReceived = true;
        controllerRef?.enqueue(body);
      }
    } catch {}
  };

  const onClose = () => {
    if (!audioReceived) {
      finishWithError(new Error('no audio received'));
      return;
    }
    finish();
  };

  const onError = (e: Event) => {
    finishWithError(e);
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      socket.addEventListener('message', onMessage as any);
      socket.addEventListener('close', onClose);
      socket.addEventListener('error', onError);
      (socket as any).accept();
      socket.send(buildSpeechConfigMessage());
      socket.send(buildSsmlMessage(requestId, voice, text));
    },
    cancel() {
      settled = true;
      cleanup();
      try {
        socket.close(1000, 'cancelled');
      } catch {}
    },
  });
}

async function synthesizeToStream(text: string, voice: string): Promise<ReadableStream<Uint8Array>> {
  const secMsGec = await makeSecMsGec();
  const connectionId = makeConnectionId();
  const websocketUrl = buildSynthesisUrl(secMsGec, connectionId);

  const response = (await fetch(websocketUrl, {
    headers: {
      ...UPGRADE_HEADERS,
      Cookie: `muid=${makeMuid()};`,
    },
  })) as Response & { webSocket?: WebSocket };

  if (response.status !== 101 || !response.webSocket) {
    throw new Error(`WebSocket upgrade failed with status ${response.status}`);
  }

  return createReadableAudioStream(response.webSocket, text, voice, makeConnectionId());
}

export async function onRequestGet(context: { request: Request }) {
  const url = new URL(context.request.url);
  const text = url.searchParams.get('text');
  const voice = url.searchParams.get('voice') || DEFAULT_VOICE;

  if (!text || text.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Text query param is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const stream = await synthesizeToStream(text.trim(), voice);
    return new Response(stream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Synthesis failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

export async function onRequestPost(context: { request: Request }) {
  try {
    const body = (await context.request.json()) as { text?: string; voice?: string };
    const text = body.text;
    const voice = body.voice || DEFAULT_VOICE;

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const stream = await synthesizeToStream(text.trim(), voice);
    return new Response(stream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Synthesis failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
