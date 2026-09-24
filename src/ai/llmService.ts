import { generateWithGemini } from './geminiClient';
import { generateWithOpenAi } from './openaiClient';

export type LlmProviderType = 'gemini' | 'openai' | 'openrouter';

export interface LlmConfig {
  provider: LlmProviderType;
  geminiKey: string;
  openaiKey: string;
  model: string;
  customBaseUrl?: string;
}

const STORAGE_KEY = 'img2threejs_llm_config';

export function loadLlmConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const cfg = JSON.parse(raw);
      // Migrate deprecated models to Gemini 3.8 Flash
      if (
        !cfg.model ||
        cfg.model === 'gemini-2.5-flash' ||
        cfg.model === 'gemini-3.6-flash' ||
        cfg.model === 'gemini-1.5-flash'
      ) {
        cfg.model = 'gemini-3.8-flash';
      }
      return cfg;
    }
  } catch {
    // fallback
  }

  return {
    provider: 'gemini',
    geminiKey: '',
    openaiKey: '',
    model: 'gemini-3.8-flash',
  };
}

export function saveLlmConfig(config: LlmConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save LLM config to localStorage:', err);
  }
}

export interface ImagePayload {
  base64: string;
  mimeType: string;
  dataUrl: string;
  fileName: string;
}

/**
 * Converts a browser File to base64 payload.
 */
export async function fileToImagePayload(file: File): Promise<ImagePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || file.type || 'image/jpeg';

      resolve({
        base64,
        mimeType,
        dataUrl,
        fileName: file.name,
      });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Unified model generation dispatcher from an image.
 */
export async function generateProceduralCodeFromImage(
  image: ImagePayload,
  config: LlmConfig,
  userNotes?: string
): Promise<string> {
  if (config.provider === 'gemini') {
    return generateWithGemini({
      apiKey: config.geminiKey,
      model: config.model || 'gemini-3.8-flash',
      imageBase64: image.base64,
      mimeType: image.mimeType,
      userNotes,
    });
  } else {
    // OpenAI or OpenRouter
    const baseUrl = config.provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1'
      : (config.customBaseUrl || 'https://api.openai.com/v1');

    return generateWithOpenAi({
      apiKey: config.openaiKey,
      baseUrl,
      model: config.model || (config.provider === 'openrouter' ? 'anthropic/claude-3.5-sonnet' : 'gpt-4o'),
      imageBase64: image.base64,
      mimeType: image.mimeType,
      userNotes,
    });
  }
}
