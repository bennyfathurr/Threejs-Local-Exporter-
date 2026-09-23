import * as THREE from 'three';
import { executeProceduralCode } from '../model/codeRunner';
import { loadModelFromTsJsFile, loadGlbFromFile } from '../model/loadFactory';

export interface CodeModalCallbacks {
  onModelLoaded: (model: THREE.Object3D) => void;
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
    this.modalEl.style.display = 'none';
    document.body.appendChild(this.modalEl);
    this.render();
  }

  public open(initialCode?: string) {
    if (initialCode) {
      this.currentCode = initialCode;
      const textarea = this.modalEl.querySelector('#code-editor-textarea') as HTMLTextAreaElement;
      if (textarea) textarea.value = initialCode;
    }
    this.clearError();
    this.modalEl.style.display = 'flex';
  }

  public close() {
    this.modalEl.style.display = 'none';
  }

  private render() {
    this.modalEl.className = 'modal-backdrop';
    this.modalEl.innerHTML = `
      <div class="modal-dialog">
        <!-- Header -->
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">⚡</span>
            <span style="font-weight:700; font-size:14px; color:#fff;">Load TypeScript / JavaScript Three.js Code</span>
            <span class="badge-tag">img2threejs</span>
          </div>
          <button class="btn-icon" id="btn-close-modal" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">✕</button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <!-- Quick Toolbar -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="display:flex; gap:8px; align-items:center;">
              <span style="font-size:11px; color:var(--text-secondary);">Upload File:</span>
              <label class="btn btn-sm" style="cursor:pointer;">
                <span>📂 Choose .ts / .js file</span>
                <input type="file" id="modal-file-input" accept=".ts,.js,.tsx,.jsx" style="display:none;" />
              </label>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm" id="btn-load-template" title="Reset to sample template">Sample Template</button>
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
                min-height: 280px;
                background: var(--bg-input);
                color: #e2e8f0;
                font-family: var(--font-mono);
                font-size: 12px;
                line-height: 1.5;
                padding: 12px;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                resize: none;
                outline: none;
                tab-size: 2;
                box-sizing: border-box;
              "
              placeholder="Paste your img2threejs or procedural Three.js TypeScript/JavaScript code here..."
            >${this.currentCode}</textarea>
          </div>

          <!-- Spec / Config JSON Parameters -->
          <div style="margin-top:10px;">
            <details>
              <summary style="font-size:11px; color:var(--text-secondary); cursor:pointer; font-weight:600;">
                ⚙️ Optional Spec / Config Parameters (JSON)
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
            <button class="btn btn-primary" id="btn-run-code">▶ Compile & Render Model</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    this.modalEl.querySelector('#btn-close-modal')?.addEventListener('click', () => this.close());
    this.modalEl.querySelector('#btn-cancel-modal')?.addEventListener('click', () => this.close());

    // Tab key support in textarea
    const textarea = this.modalEl.querySelector('#code-editor-textarea') as HTMLTextAreaElement;
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }
    });

    // File input
    const fileInput = this.modalEl.querySelector('#modal-file-input') as HTMLInputElement;
    fileInput.addEventListener('change', async () => {
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const content = await file.text();
        textarea.value = content;
        this.currentCode = content;
      }
    });

    // Sample template
    this.modalEl.querySelector('#btn-load-template')?.addEventListener('click', () => {
      textarea.value = DEFAULT_SAMPLE_CODE;
      this.currentCode = DEFAULT_SAMPLE_CODE;
      this.clearError();
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
      banner.textContent = `❌ ${msg}`;
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
