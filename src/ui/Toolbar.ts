import * as THREE from 'three';
import { PRESETS, loadGlbFromFile, loadModelFromTsJsFile } from '../model/loadFactory';
import { SceneContext } from '../viewer/createScene';

export interface ToolbarCallbacks {
  onModelLoaded: (root: THREE.Object3D) => void;
  onResetView: () => void;
  onOpenCodeEditor: () => void;
}

export class Toolbar {
  private container: HTMLElement;
  private sceneCtx: SceneContext;
  private callbacks: ToolbarCallbacks;
  private activePresetId: string = PRESETS[0]?.id || 'createmodel';

  constructor(container: HTMLElement, sceneCtx: SceneContext, callbacks: ToolbarCallbacks) {
    this.container = container;
    this.sceneCtx = sceneCtx;
    this.callbacks = callbacks;
    this.render();
  }

  public render() {
    this.container.className = 'app-header';
    this.container.innerHTML = `
      <!-- LEFT BRAND -->
      <div class="brand-section">
        <div class="brand-logo">▲</div>
        <div>
          <span class="brand-title">Three.js Local Exporter</span>
          <span class="badge-tag" style="margin-left: 6px;">img2threejs</span>
        </div>
      </div>

      <!-- CENTER MODEL SELECTOR & CODE BUTTONS -->
      <div class="model-switcher">
        <label style="font-size:11px; color:var(--text-muted); font-weight:600;">MODEL:</label>
        <select class="select-input" id="model-preset-select">
          ${PRESETS.map((p) => `<option value="${p.id}" ${p.id === this.activePresetId ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>

        <!-- Open In-Browser Code Editor -->
        <button class="btn btn-sm" id="btn-open-code-modal" style="margin-left: 4px;" title="Paste or edit TypeScript/JavaScript Three.js code">
          <span>⚡ Paste / Edit Code</span>
        </button>

        <!-- Direct Upload Button for TS, JS, GLB -->
        <label class="btn btn-sm" style="margin-left: 2px; cursor: pointer;" title="Upload custom .ts, .js, or .glb file">
          <span>📂 Upload File (.ts / .js / .glb)</span>
          <input type="file" id="universal-file-input" accept=".ts,.js,.tsx,.jsx,.glb,.gltf" style="display:none;" />
        </label>
      </div>

      <!-- RIGHT CONTROLS -->
      <div style="display:flex; align-items:center; gap:10px;">
        <!-- Background Color -->
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:11px; color:var(--text-muted);">BG:</span>
          <input type="color" id="bg-color-picker" value="#0f111a" style="width:24px; height:20px; border:none; background:transparent; cursor:pointer;" title="Viewport background color"/>
          <label class="checkbox-label" style="font-size:11px;">
            <input type="checkbox" id="chk-bg-transparent"/>
            Alpha
          </label>
        </div>

        <button class="btn btn-sm" id="btn-info" title="View Specification Info">ℹ️ Specs</button>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents() {
    const select = this.container.querySelector('#model-preset-select') as HTMLSelectElement;
    select.addEventListener('change', () => {
      this.activePresetId = select.value;
      const preset = PRESETS.find((p) => p.id === this.activePresetId);
      if (preset) {
        const model = preset.factory(preset.defaultSpec);
        this.callbacks.onModelLoaded(model);
      }
    });

    // Open Code Modal
    this.container.querySelector('#btn-open-code-modal')?.addEventListener('click', () => {
      this.callbacks.onOpenCodeEditor();
    });

    // Universal File Input (.ts, .js, .glb, .gltf)
    const fileInput = this.container.querySelector('#universal-file-input') as HTMLInputElement;
    fileInput.addEventListener('change', async () => {
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const ext = file.name.split('.').pop()?.toLowerCase();

        try {
          let model: THREE.Object3D;
          if (ext === 'glb' || ext === 'gltf') {
            model = await loadGlbFromFile(file);
          } else if (ext === 'ts' || ext === 'js' || ext === 'tsx' || ext === 'jsx') {
            model = await loadModelFromTsJsFile(file);
          } else {
            throw new Error(`Unsupported file extension: .${ext}. Please upload .ts, .js, or .glb.`);
          }

          this.callbacks.onModelLoaded(model);
        } catch (err) {
          alert(`Failed to load file "${file.name}":\n\n${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });

    const bgColorPicker = this.container.querySelector('#bg-color-picker') as HTMLInputElement;
    const chkTransparent = this.container.querySelector('#chk-bg-transparent') as HTMLInputElement;

    const updateBg = () => {
      this.sceneCtx.setBackgroundColor(bgColorPicker.value, chkTransparent.checked);
    };

    bgColorPicker.addEventListener('input', updateBg);
    chkTransparent.addEventListener('change', updateBg);

    this.container.querySelector('#btn-info')?.addEventListener('click', () => {
      alert(
        'Three.js Procedural Model Exporter\n\n' +
        '• Load procedural Three.js factories returning THREE.Group.\n' +
        '• Directly upload or paste .ts / .js code generated by img2threejs or AI.\n' +
        '• Multi-format export: GLB, glTF, USDZ (visionOS/iOS), OBJ+MTL (.zip), STL, PLY.\n' +
        '• Live scene inventory, raycast selection, solo/lock modes, and validation report.'
      );
    });
  }
}
