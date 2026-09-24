import * as THREE from 'three';
import {
  LlmConfig,
  ImagePayload,
  loadLlmConfig,
  saveLlmConfig,
  fileToImagePayload,
  generateProceduralCodeFromImage,
} from '../ai/llmService';
import { executeProceduralCode } from '../model/codeRunner';

export interface AiGenerateCallbacks {
  onSuccess: (model: THREE.Object3D, generatedCode: string, imagePayload: ImagePayload) => void;
  onOpenCodeEditor: (code: string) => void;
}

export class AiGenerateModal {
  private modalEl: HTMLElement;
  private callbacks: AiGenerateCallbacks;
  private config: LlmConfig;
  private currentImage: ImagePayload | null = null;
  private isGenerating = false;
  private lastGeneratedCode = '';

  constructor(callbacks: AiGenerateCallbacks) {
    this.callbacks = callbacks;
    this.config = loadLlmConfig();

    this.modalEl = document.createElement('div');
    this.modalEl.id = 'ai-generate-modal';
    this.modalEl.style.display = 'none';
    document.body.appendChild(this.modalEl);

    this.render();
  }

  public open() {
    this.modalEl.style.display = 'flex';
    this.clearStatus();
  }

  public close() {
    if (this.isGenerating) return;
    this.modalEl.style.display = 'none';
  }

  private render() {
    this.modalEl.className = 'modal-backdrop';
    this.modalEl.innerHTML = `
      <div class="modal-dialog" style="width: 780px;">
        <!-- Header -->
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">✨</span>
            <div>
              <span style="font-weight:700; font-size:14px; color:#fff;">img2threejs AI 3D Generator</span>
              <span class="badge-tag" style="margin-left:6px;">Multimodal Vision</span>
            </div>
          </div>
          <button class="btn-icon" id="btn-ai-close" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">✕</button>
        </div>

        <!-- Body -->
        <div class="modal-body" style="gap:16px;">
          <!-- Top Columns: Left Image Upload / Right Settings -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
            <!-- Left: Image Upload & Preview -->
            <div style="display:flex; flex-direction:column; gap:8px;">
              <span style="font-weight:600; font-size:11px; text-transform:uppercase; color:var(--text-secondary); letter-spacing:0.5px;">
                1. Reference Image
              </span>

              <!-- Drop Zone -->
              <div id="ai-dropzone" style="
                border: 2px dashed var(--border-color);
                border-radius: 8px;
                padding: 16px;
                text-align: center;
                background: var(--bg-card);
                cursor: pointer;
                min-height: 180px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 8px;
                position: relative;
                overflow: hidden;
              ">
                <input type="file" id="ai-image-input" accept="image/png,image/jpeg,image/webp" style="display:none;" />
                
                <div id="dropzone-empty-state">
                  <div style="font-size:32px;">📸</div>
                  <div style="font-weight:600; color:var(--text-primary); font-size:12px;">Drop photo or click to browse</div>
                  <div style="font-size:11px; color:var(--text-muted);">Supports JPG, PNG, WebP</div>
                </div>

                <img id="ai-image-preview" style="display:none; max-width:100%; max-height:160px; object-fit:contain; border-radius:6px;" />
              </div>

              <!-- Quick Sample Button -->
              <button class="btn btn-sm" id="btn-use-sample-image" style="align-self:flex-start;">
                🖼️ Use Sample Aerial Villa Photo
              </button>
            </div>

            <!-- Right: Provider & Credentials -->
            <div style="display:flex; flex-direction:column; gap:10px;">
              <span style="font-weight:600; font-size:11px; text-transform:uppercase; color:var(--text-secondary); letter-spacing:0.5px;">
                2. AI Model Provider
              </span>

              <!-- Provider Picker -->
              <div class="form-row">
                <label class="form-label">Provider</label>
                <select class="select-input" id="ai-provider-select" style="flex:1;">
                  <option value="gemini" ${this.config.provider === 'gemini' ? 'selected' : ''}>Google Gemini (Recommended)</option>
                  <option value="openai" ${this.config.provider === 'openai' ? 'selected' : ''}>OpenAI (ChatGPT)</option>
                  <option value="openrouter" ${this.config.provider === 'openrouter' ? 'selected' : ''}>OpenRouter / Custom</option>
                </select>
              </div>

              <!-- Model Picker -->
              <div class="form-row">
                <label class="form-label">Model</label>
                <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                  <select class="select-input" id="ai-model-select" style="width:100%;"></select>
                  <input
                    type="text"
                    id="ai-custom-model-input"
                    class="text-input"
                    placeholder="e.g. gemini-3.6-flash"
                    style="display:none; font-size:11px; padding:3px 8px;"
                  />
                </div>
              </div>

              <!-- API Key Input -->
              <div style="display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <label class="form-label" id="lbl-api-key">API Key</label>
                  <span style="font-size:10px; color:var(--accent-emerald);">🔒 Stored only in browser localStorage</span>
                </div>
                <input
                  type="password"
                  id="ai-api-key-input"
                  class="text-input"
                  placeholder="Enter your API key..."
                  value="${this.config.provider === 'gemini' ? this.config.geminiKey : this.config.openaiKey}"
                />
              </div>

              <!-- Optional Custom Endpoint for OpenRouter -->
              <div id="custom-endpoint-group" style="display:${this.config.provider === 'openrouter' ? 'flex' : 'none'}; flex-direction:column; gap:4px;">
                <label class="form-label">Custom Base URL</label>
                <input
                  type="text"
                  id="ai-baseurl-input"
                  class="text-input"
                  placeholder="https://openrouter.ai/api/v1"
                  value="${this.config.customBaseUrl || 'https://openrouter.ai/api/v1'}"
                />
              </div>
            </div>
          </div>

          <!-- Bottom: Prompt Guidance -->
          <div style="display:flex; flex-direction:column; gap:6px;">
            <label class="form-label" style="font-weight:600;">3. Optional Modeling Guidance / Focus</label>
            <input
              type="text"
              id="ai-notes-input"
              class="text-input"
              placeholder="e.g. Focus on the rooftop solar panels, cantilever wing, and swimming pool."
            />
          </div>

          <!-- Status / Progress Banner -->
          <div id="ai-status-banner" style="display:none; padding:10px 14px; border-radius:6px; font-size:11px; align-items:center; gap:8px;"></div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="btn btn-sm" id="btn-ai-open-editor" style="display:none;">
              📝 Inspect Code in Editor
            </button>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn" id="btn-ai-cancel">Cancel</button>
            <button class="btn btn-primary" id="btn-ai-submit" style="background: linear-gradient(135deg, #06b6d4, #6366f1); border:none; box-shadow: 0 0 16px rgba(6, 182, 212, 0.4);">
              ✨ Generate 3D Model
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.updateModelOptions();
  }

  private bindEvents() {
    this.modalEl.querySelector('#btn-ai-close')?.addEventListener('click', () => this.close());
    this.modalEl.querySelector('#btn-ai-cancel')?.addEventListener('click', () => this.close());

    // Image upload handlers
    const dropzone = this.modalEl.querySelector('#ai-dropzone') as HTMLElement;
    const fileInput = this.modalEl.querySelector('#ai-image-input') as HTMLInputElement;

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      if (fileInput.files && fileInput.files[0]) {
        await this.handleImageFile(fileInput.files[0]);
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--accent-blue)';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'var(--border-color)';
    });

    dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--border-color)';
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        await this.handleImageFile(e.dataTransfer.files[0]);
      }
    });

    // Sample image button
    this.modalEl.querySelector('#btn-use-sample-image')?.addEventListener('click', async () => {
      try {
        const res = await fetch('/reference/aerial_reference.jpg');
        const blob = await res.blob();
        const file = new File([blob], 'aerial_reference.jpg', { type: 'image/jpeg' });
        await this.handleImageFile(file);
      } catch (err) {
        alert('Could not load sample image');
      }
    });

    // Provider select
    const providerSelect = this.modalEl.querySelector('#ai-provider-select') as HTMLSelectElement;
    providerSelect.addEventListener('change', () => {
      this.config.provider = providerSelect.value as any;
      this.updateModelOptions();
      this.updateApiKeyInput();

      const customGroup = this.modalEl.querySelector('#custom-endpoint-group') as HTMLElement;
      customGroup.style.display = this.config.provider === 'openrouter' ? 'flex' : 'none';
    });

    // Model select & custom model input
    const modelSelect = this.modalEl.querySelector('#ai-model-select') as HTMLSelectElement;
    const customModelInput = this.modalEl.querySelector('#ai-custom-model-input') as HTMLInputElement;

    modelSelect.addEventListener('change', () => {
      if (modelSelect.value === 'custom') {
        customModelInput.style.display = 'block';
        customModelInput.focus();
        this.config.model = customModelInput.value.trim() || (this.config.provider === 'gemini' ? 'gemini-3.6-flash' : 'gpt-4o');
      } else {
        customModelInput.style.display = 'none';
        this.config.model = modelSelect.value;
      }
      saveLlmConfig(this.config);
    });

    customModelInput.addEventListener('input', () => {
      this.config.model = customModelInput.value.trim();
      saveLlmConfig(this.config);
    });

    // API key input
    const apiKeyInput = this.modalEl.querySelector('#ai-api-key-input') as HTMLInputElement;
    apiKeyInput.addEventListener('input', () => {
      if (this.config.provider === 'gemini') {
        this.config.geminiKey = apiKeyInput.value.trim();
      } else {
        this.config.openaiKey = apiKeyInput.value.trim();
      }
      saveLlmConfig(this.config);
    });

    // Custom Base URL
    const baseUrlInput = this.modalEl.querySelector('#ai-baseurl-input') as HTMLInputElement;
    baseUrlInput.addEventListener('input', () => {
      this.config.customBaseUrl = baseUrlInput.value.trim();
      saveLlmConfig(this.config);
    });

    // Open in editor button
    const openEditorBtn = this.modalEl.querySelector('#btn-ai-open-editor') as HTMLElement;
    openEditorBtn.addEventListener('click', () => {
      if (this.lastGeneratedCode) {
        this.callbacks.onOpenCodeEditor(this.lastGeneratedCode);
        this.close();
      }
    });

    // Generate Submit Button
    this.modalEl.querySelector('#btn-ai-submit')?.addEventListener('click', () => {
      this.executeGeneration();
    });
  }

  private async handleImageFile(file: File) {
    try {
      this.currentImage = await fileToImagePayload(file);

      const preview = this.modalEl.querySelector('#ai-image-preview') as HTMLImageElement;
      const emptyState = this.modalEl.querySelector('#dropzone-empty-state') as HTMLElement;

      preview.src = this.currentImage.dataUrl;
      preview.style.display = 'block';
      emptyState.style.display = 'none';
      this.clearStatus();
    } catch (err) {
      alert(`Failed to read image file: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private updateModelOptions() {
    const modelSelect = this.modalEl.querySelector('#ai-model-select') as HTMLSelectElement;
    const customModelInput = this.modalEl.querySelector('#ai-custom-model-input') as HTMLInputElement;
    modelSelect.innerHTML = '';

    const options =
      this.config.provider === 'gemini'
        ? [
            { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (New - Recommended)' },
            { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro (Deep Multimodal Reasoning)' },
            { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (Fast & Lightweight)' },
            { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
            { id: 'custom', name: '✏️ Custom Model ID...' },
          ]
        : this.config.provider === 'openrouter'
        ? [
            { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (via OpenRouter)' },
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (via OpenRouter)' },
            { id: 'custom', name: '✏️ Custom Model ID...' },
          ]
        : [
            { id: 'gpt-4o', name: 'GPT-4o (High Precision Vision)' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast)' },
            { id: 'custom', name: '✏️ Custom Model ID...' },
          ];

    const isCustom = !options.some((o) => o.id === this.config.model && o.id !== 'custom');

    options.forEach((opt) => {
      const el = document.createElement('option');
      el.value = opt.id;
      el.textContent = opt.name;
      if (opt.id === this.config.model || (opt.id === 'custom' && isCustom)) {
        el.selected = true;
      }
      modelSelect.appendChild(el);
    });

    if (isCustom) {
      customModelInput.style.display = 'block';
      customModelInput.value = this.config.model || '';
    } else {
      customModelInput.style.display = 'none';
    }

    if (!this.config.model) {
      this.config.model = options[0].id;
    }
    saveLlmConfig(this.config);
  }

  private updateApiKeyInput() {
    const apiKeyInput = this.modalEl.querySelector('#ai-api-key-input') as HTMLInputElement;
    const key = this.config.provider === 'gemini' ? this.config.geminiKey : this.config.openaiKey;
    apiKeyInput.value = key || '';
  }

  private async executeGeneration() {
    if (this.isGenerating) return;

    if (!this.currentImage) {
      this.showStatus('error', 'Please upload or choose a reference image first.');
      return;
    }

    const currentKey = this.config.provider === 'gemini' ? this.config.geminiKey : this.config.openaiKey;
    if (!currentKey || !currentKey.trim()) {
      this.showStatus(
        'error',
        `Please enter your ${this.config.provider === 'gemini' ? 'Google Gemini' : 'OpenAI'} API key above.`
      );
      return;
    }

    this.isGenerating = true;
    const submitBtn = this.modalEl.querySelector('#btn-ai-submit') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Analyzing & Generating 3D Scene...';

    this.showStatus('loading', 'Sending image to vision LLM and building procedural Three.js geometry...');

    try {
      const notes = (this.modalEl.querySelector('#ai-notes-input') as HTMLInputElement).value;
      const generatedCode = await generateProceduralCodeFromImage(
        this.currentImage,
        this.config,
        notes
      );

      this.lastGeneratedCode = generatedCode;

      // Compile & mount model in Three.js
      this.showStatus('loading', 'Compiling TypeScript code & constructing 3D scene graph...');
      const runResult = executeProceduralCode(generatedCode);

      this.showStatus(
        'success',
        `✅ Success! Generated "${runResult.model.name}" with ${runResult.model.children.length} primary components.`
      );

      // Show Inspect Code button in footer
      const openEditorBtn = this.modalEl.querySelector('#btn-ai-open-editor') as HTMLElement;
      openEditorBtn.style.display = 'inline-flex';

      // Dispatch to main app (mounts model & sets reference overlay)
      this.callbacks.onSuccess(runResult.model, generatedCode, this.currentImage);

      // Auto-close after brief delay so user sees success confirmation
      setTimeout(() => {
        this.close();
      }, 1200);
    } catch (err) {
      console.error('AI Generation Failed:', err);
      this.showStatus('error', err instanceof Error ? err.message : String(err));
      if (this.lastGeneratedCode) {
        const openEditorBtn = this.modalEl.querySelector('#btn-ai-open-editor') as HTMLElement;
        openEditorBtn.style.display = 'inline-flex';
      }
    } finally {
      this.isGenerating = false;
      submitBtn.disabled = false;
      submitBtn.textContent = '✨ Generate 3D Model';
    }
  }

  private showStatus(type: 'loading' | 'success' | 'error', message: string) {
    const banner = this.modalEl.querySelector('#ai-status-banner') as HTMLElement;
    banner.style.display = 'flex';

    if (type === 'loading') {
      banner.style.background = 'rgba(56, 189, 248, 0.15)';
      banner.style.border = '1px solid rgba(56, 189, 248, 0.35)';
      banner.style.color = '#bae6fd';
      banner.innerHTML = `<span style="animation:spin 1s linear infinite; display:inline-block;">⚙️</span> <span>${message}</span>`;
    } else if (type === 'success') {
      banner.style.background = 'rgba(16, 185, 129, 0.15)';
      banner.style.border = '1px solid rgba(16, 185, 129, 0.35)';
      banner.style.color = '#a7f3d0';
      banner.innerHTML = `<span>${message}</span>`;
    } else {
      banner.style.background = 'rgba(244, 63, 94, 0.15)';
      banner.style.border = '1px solid rgba(244, 63, 94, 0.35)';
      banner.style.color = '#fecdd3';
      banner.innerHTML = `<span>❌ ${message}</span>`;
    }
  }

  private clearStatus() {
    const banner = this.modalEl.querySelector('#ai-status-banner') as HTMLElement;
    banner.style.display = 'none';
  }
}
