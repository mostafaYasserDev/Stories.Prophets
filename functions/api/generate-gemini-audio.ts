/**
 * Cloudflare Pages Function: /api/generate-gemini-audio
 * Server-side endpoint to generate Gemini Studio Audio.
 */

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const body = await context.request.json();
    const { text, voiceName = 'Charon', dialect = 'fusha', apiKey } = body;

    const defaultFallbackKey = typeof atob !== 'undefined'
      ? atob('QVEuQWI4Uk42STF3Y180elQ0NjlmVF9aX19Zd1h4QTdGdC1TYmxvWkdPWWlfdEhoQ3ZnQ1E=')
      : '';
    const key = apiKey || context.env?.GEMINI_API_KEY || defaultFallbackKey;

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'النص مطلوب' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(
      key.trim()
    )}`;

    let promptText = `اقرأ هذا المقطع من السيرة النبوية الشريفة باللغة العربية الفصحى التامة وبأسلوب إيماني وقور:\n\n${text}`;
    if (dialect === 'egyptian') {
      promptText = `اقرأ هذا المقطع من السيرة النبوية بنطق مصري طبيعي وسلس ومتقن، مع قراءة الآيات الكريمة والأحاديث بالفصحى التامة والخشوع:\n\n${text}`;
    } else if (dialect === 'mixed') {
      promptText = `اقرأ هذا المقطع من السيرة النبوية بأسلوب سردي رصين ومتوازن؛ السرد بنبرة دافئة حيوية، والآيات والأحاديث بفصاحة وجلال تام:\n\n${text}`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: err }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data: any = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
