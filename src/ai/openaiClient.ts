import { IMG2THREEJS_SYSTEM_PROMPT, buildUserPrompt, extractCodeFromResponse } from './systemPrompt';

export interface OpenAiGenerateOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  imageBase64: string;
  mimeType: string;
  userNotes?: string;
}

/**
 * Direct client for OpenAI and OpenRouter/custom multimodal vision endpoints.
 */
export async function generateWithOpenAi(options: OpenAiGenerateOptions): Promise<string> {
  const {
    apiKey,
    baseUrl = 'https://api.openai.com/v1',
    model = 'gpt-4o',
    imageBase64,
    mimeType,
    userNotes,
  } = options;

  if (!apiKey || !apiKey.trim()) {
    throw new Error('API key is required. Please provide your OpenAI or OpenRouter API key.');
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const userPrompt = buildUserPrompt(userNotes);

  const requestBody = {
    model,
    messages: [
      {
        role: 'system',
        content: IMG2THREEJS_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userPrompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
    temperature: 0.2,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMsg = errorData?.error?.message || response.statusText;
    throw new Error(`OpenAI API Error (${response.status}): ${errorMsg}`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;

  if (!rawText) {
    throw new Error('OpenAI returned an empty response. Please try again.');
  }

  return extractCodeFromResponse(rawText);
}
