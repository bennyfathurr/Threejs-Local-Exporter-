import * as THREE from 'three';
import { executeProceduralCode } from '../model/codeRunner';
import { getPresetSourceCode } from '../model/loadFactory';
import { generateModelTypeScript } from '../model/generateTypeScript';
import { downloadFile } from '../export/download';
import { ICONS } from './icons';
import { showToast } from './Toast';

export interface CodeModalCallbacks {
  onModelLoaded: (model: THREE.Object3D) => void;
  getCurrentModel?: () => THREE.Object3D;
  getCurrentPresetId?: () => string;
}

const DEFAULT_SAMPLE_CODE = `import * as THREE from 'three';

/**
 * Procedural Model Factory
 * You can paste any TypeScript or JavaScript code from img2threejs or custom generators!
 */
export function createModel(spec?: Record<string, any>, options?: Record<string, any>): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Procedural_Compound_Asset';

  // 1. Base platform
  const baseGeo = new THREE.BoxGeometry(10, 0.5, 10);
  const baseMat = new THREE.MeshStandardMaterial({ name: 'Mat_Base', color: 0x1e293b, roughness: 0.8 });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.name = 'Foundation_Platform';
  baseMesh.position.y = 0.25;
  root.add(baseMesh);

  // 2. Main structure
  const bodyGeo = new THREE.CylinderGeometry(3, 3.5, 5, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ name: 'Mat_Chassis', color: 0x0284c7, metalness: 0.5, roughness: 0.3 });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.name = 'Central_Core';
  bodyMesh.position.y = 3.0;
  root.add(bodyMesh);

  // 3. Accent dome
  const domeGeo = new THREE.SphereGeometry(2, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const domeMat = new THREE.MeshStandardMaterial({ name: 'Mat_DomeGlass', color: 0x38bdf8, transparent: true, opacity: 0.7 });
  const domeMesh = new THREE.Mesh(domeGeo, domeMat);
  domeMesh.name = 'Observatory_Dome';
  domeMesh.position.y = 5.5;
  root.add(domeMesh);

  return root;
}
`;

export class CodeModal {
  private modalEl: HTMLElement;
  private callbacks: CodeModalCallbacks;
  private currentCode: string = DEFAULT_SAMPLE_CODE;

  constructor(callbacks: CodeModalCallbacks) {
    this.callbacks = callbacks;
    this.modalEl = document.createElement('div');
    this.modalEl.id = 'code-importer-modal';
    this.modalEl.className = 'modal-backdrop';
    this.modalEl.style.display = 'none';
    document.body.appendChild(this.modalEl);
    this.render();
  }

  public open(initialCode?: string) {
    const textarea = this.modalEl.querySelector('#code-editor-textarea') as HTMLTextAreaElement;

    if (initialCode) {
      this.currentCode = initialCode;
      if (textarea) textarea.value = initialCode;
    } else {
      // Auto-load current model's code: either from preset source code or decompile live scene
      this.loadCurrentModelCode();
    }

    this.clearError();
    this.modalEl.style.display = 'flex';
  }

  public close() {
    this.modalEl.style.display = 'none';
  }

  private loadCurrentModelCode() {
    const textarea = this.modalEl.querySelector('#code-editor-textarea') as HTMLTextAreaElement;
    const presetId = this.callbacks.getCurrentPresetId?.();
    const currentModel = this.callbacks.getCurrentModel?.();

    let targetCode = '';

    // If active preset has raw source code, use it
    if (presetId) {
      const presetSource = getPresetSourceCode(presetId);
      if (presetSource && presetSource.trim()) {
        targetCode = presetSource;
      }
    }

    // Otherwise decompile the live scene graph
    if (!targetCode && currentModel) {
      targetCode = generateModelTypeScript(currentModel);
    }

    if (!targetCode) {
      targetCode = DEFAULT_SAMPLE_CODE;
    }

    this.currentCode = targetCode;
    if (textarea) textarea.value = targetCode;
  }

  private render() {
    this.modalEl.innerHTML = `
      <div class="modal-dialog" style="width: 820px; max-width: 94vw;">
        <!-- Header -->
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:var(--accent-cyan); display:flex; align-items:center;">${ICONS.code(18)}</span>
            <span style="font-weight:700; font-size:14px; color:#fff;">TypeScript / Three.js Code Studio</span>
            <span class="badge-tag">Runtime TS Compiler</span>
          </div>
          <button class="btn btn-sm" id="btn-close-modal" style="padding: 2px 7px;">✕</button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <!-- Quick Toolbar -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
              <button class="btn btn-sm" id="btn-load-current-code" style="background:rgba(6, 182, 212, 0.12); border-color:rgba(6, 182, 212, 0.4); color:var(--accent-cyan); font-weight:600;" title="View source code of current active model">
                ${ICONS.code(13)} <span>Active Model Source</span>
              </button>
              <button class="btn btn-sm" id="btn-decompile-scene" style="background:rgba(99, 102, 241, 0.12); border-color:rgba(99, 102, 241, 0.4); color:var(--accent-indigo); font-weight:600;" title="Decompile live scene graph (including newly added meshes & gizmo edits) into Three.js TypeScript code">
                ${ICONS.sparkles(13)} <span>Decompile Live Scene</span>
              </button>
              <label class="btn btn-sm" style="cursor:pointer;" title="Upload custom .ts / .js file">
                ${ICONS.folder(13)} <span>Open .ts File</span>
                <input type="file" id="modal-file-input" accept=".ts,.js,.tsx,.jsx" style="display:none;" />
              </label>
            </div>

            <div style="display:flex; gap:6px; align-items:center;">
              <button class="btn btn-sm" id="btn-copy-code" title="Copy code to clipboard">
                ${ICONS.copy(13)} <span>Copy</span>
              </button>
              <button class="btn btn-sm" id="btn-download-code" title="Download as .ts file">
                ${ICONS.download(13)} <span>Download .ts</span>
              </button>
              <button class="btn btn-sm" id="btn-load-template" title="Reset to sample template">Template</button>
              <button class="btn btn-sm" id="btn-clear-code" title="Clear editor">Clear</button>
            </div>
          </div>

          <!-- Code Editor Area -->
          <div style="position:relative; flex:1; display:flex; flex-direction:column;">
            <textarea
              id="code-editor-textarea"
              spellcheck="false"
              style="
                flex: 1;
                min-height: 320px;
                background: var(--bg-input);
                color: #e2e8f0;
                font-family: var(--font-mono);
                font-size: 12px;
                line-height: 1.5;
                padding: 12px;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                resize: vertical;
                outline: none;
                tab-size: 2;
                box-sizing: border-box;
              "
              placeholder="Paste your Three.js TypeScript/JavaScript procedural code here..."
            >${this.currentCode}</textarea>
          </div>

          <!-- Spec / Config JSON Parameters -->
          <div style="margin-top:10px;">
            <details>
              <summary style="font-size:11px; color:var(--text-secondary); cursor:pointer; font-weight:600;">
                Optional Spec / Config Parameters (JSON)
              </summary>
              <textarea
                id="spec-editor-textarea"
                spellcheck="false"
                style="
                  width: 100%;
                  height: 60px;
                  margin-top: 6px;
                  background: var(--bg-input);
                  color: #e2e8f0;
                  font-family: var(--font-mono);
                  font-size: 11px;
                  padding: 8px;
                  border: 1px solid var(--border-color);
                  border-radius: 6px;
                  outline: none;
                  box-sizing: border-box;
                "
                placeholder='{"scale": 1.0, "accentColor": "#0284c7"}'
              >{}</textarea>
            </details>
          </div>

          <!-- Error Console Banner -->
          <div id="modal-error-banner" style="display:none; margin-top:10px; padding:8px 12px; border-radius:6px; background:rgba(244, 63, 94, 0.15); border:1px solid rgba(244, 63, 94, 0.4); color:#fecdd3; font-size:11px; font-family:var(--font-mono); white-space:pre-wrap;"></div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <div style="font-size:11px; color:var(--text-muted);">
            Accepts <code style="color:var(--accent-blue);">export function createModel()</code> or <code style="color:var(--accent-blue);">export default</code>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn" id="btn-cancel-modal">Cancel</button>
            <button class="btn btn-primary" id="btn-run-code" style="background: linear-gradient(135deg, #0ea5e9, #6366f1); border:none; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
              ${ICONS.play(12)} <span>Compile & Render Model</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    this.modalEl.querySelector('#btn-close-modal')?.addEventListener('click', () => this.close());
    this.modalEl.querySelector('#btn-cancel-modal')?.addEventListener('click', () => this.close());

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    const textarea = this.modalEl.querySelector('#code-editor-textarea') as HTMLTextAreaElement;

    // Tab key support in textarea
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }
    });

    // Load active preset source code
    this.modalEl.querySelector('#btn-load-current-code')?.addEventListener('click', () => {
      this.clearError();
      this.loadCurrentModelCode();
      showToast('Loaded active model source code', '📄');
    });

    // Decompile live scene graph
    this.modalEl.querySelector('#btn-decompile-scene')?.addEventListener('click', () => {
      this.clearError();
      const currentModel = this.callbacks.getCurrentModel?.();
      if (currentModel) {
        const decompiled = generateModelTypeScript(currentModel);
        textarea.value = decompiled;
        this.currentCode = decompiled;
        showToast('Decompiled live scene graph to TypeScript', '✨');
      } else {
        showToast('No active model in viewport', '⚠️');
      }
    });

    // Copy code button
    this.modalEl.querySelector('#btn-copy-code')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(textarea.value);
        showToast('Code copied to clipboard!', '📋');
      } catch {
        showToast('Failed to copy to clipboard', '⚠️');
      }
    });

    // Download .ts file
    this.modalEl.querySelector('#btn-download-code')?.addEventListener('click', () => {
      const currentModel = this.callbacks.getCurrentModel?.();
      const baseName = (currentModel?.name || 'procedural_model')
        .replace(/[^a-zA-Z0-9_]/g, '_');
      downloadFile(textarea.value, `${baseName}.ts`, 'text/typescript');
      showToast(`Downloaded ${baseName}.ts`, '💾');
    });

    // File input
    const fileInput = this.modalEl.querySelector('#modal-file-input') as HTMLInputElement;
    fileInput.addEventListener('change', async () => {
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const content = await file.text();
        textarea.value = content;
        this.currentCode = content;
        showToast(`Loaded file: ${file.name}`, '📂');
      }
    });

    // Sample template
    this.modalEl.querySelector('#btn-load-template')?.addEventListener('click', () => {
      textarea.value = DEFAULT_SAMPLE_CODE;
      this.currentCode = DEFAULT_SAMPLE_CODE;
      this.clearError();
      showToast('Sample template loaded', '⚡');
    });

    // Clear
    this.modalEl.querySelector('#btn-clear-code')?.addEventListener('click', () => {
      textarea.value = '';
      this.currentCode = '';
      this.clearError();
    });

    // Run code
    this.modalEl.querySelector('#btn-run-code')?.addEventListener('click', () => {
      this.clearError();
      const code = textarea.value;
      const specText = (this.modalEl.querySelector('#spec-editor-textarea') as HTMLTextAreaElement).value.trim();

      let spec: unknown = {};
      if (specText) {
        try {
          spec = JSON.parse(specText);
        } catch (err) {
          this.showError(`Invalid Spec JSON: ${err instanceof Error ? err.message : String(err)}`);
          return;
        }
      }

      try {
        const result = executeProceduralCode(code, spec);
        this.callbacks.onModelLoaded(result.model);
        showToast(`Compiled & Rendered: ${result.model.name || 'Model'}`, '🚀');
        this.close();
      } catch (err) {
        this.showError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  private showError(msg: string) {
    const banner = this.modalEl.querySelector('#modal-error-banner') as HTMLElement;
    if (banner) {
      banner.style.display = 'block';
      banner.textContent = `Error: ${msg}`;
    }
  }

  private clearError() {
    const banner = this.modalEl.querySelector('#modal-error-banner') as HTMLElement;
    if (banner) {
      banner.style.display = 'none';
      banner.textContent = '';
    }
  }
}
