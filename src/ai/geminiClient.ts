import { IMG2THREEJS_SYSTEM_PROMPT, buildUserPrompt, extractCodeFromResponse } from './systemPrompt';

export interface GeminiGenerateOptions {
  apiKey: string;
  model?: string;
  imageBase64: string;
  mimeType: string;
  userNotes?: string;
}

/**
 * Direct client for Google Gemini multimodal vision models.
 */
export async function generateWithGemini(options: GeminiGenerateOptions): Promise<string> {
  const { apiKey, model = 'gemini-3.8-flash', imageBase64, mimeType, userNotes } = options;

  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API key is required. Please enter your Google AI Studio API key.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
  const userPrompt = buildUserPrompt(userNotes);

  const requestBody = {
    system_instruction: {
      parts: [{ text: IMG2THREEJS_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
          {
            text: userPrompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMsg = errorData?.error?.message || response.statusText;
    throw new Error(`Gemini API Error (${response.status}): ${errorMsg}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Gemini returned an empty response. Please try again with a different image or prompt.');
  }

  return extractCodeFromResponse(rawText);
}
