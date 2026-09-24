import * as THREE from 'three';
import { PRESETS, loadGlbFromFile, loadModelFromTsJsFile } from '../model/loadFactory';
import { SceneContext } from '../viewer/createScene';
import { PRIMITIVE_DEFINITIONS, PrimitiveType } from '../model/meshOperations';

export interface ToolbarCallbacks {
  onModelLoaded: (root: THREE.Object3D, referenceImage?: string) => void;
  onResetView: () => void;
  onOpenCodeEditor: () => void;
  onOpenAiGenerator: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCreateMesh?: (type: PrimitiveType) => void;
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

        <!-- Undo / Redo Buttons -->
        <div style="display:flex; align-items:center; gap:3px; margin-left: 4px; padding: 0 4px; border-left: 1px solid var(--border-color); border-right: 1px solid var(--border-color);">
          <button class="btn btn-sm" id="btn-undo" title="Undo (Ctrl+Z / ⌘Z)" disabled>
            <span>↶</span> Undo
          </button>
          <button class="btn btn-sm" id="btn-redo" title="Redo (Ctrl+Y / ⌘⇧Z)" disabled>
            <span>↷</span> Redo
          </button>
        </div>

        <!-- Add Primitive Mesh Dropdown -->
        <div class="dropdown-wrapper" style="position:relative; margin-left: 4px;">
          <button class="btn btn-sm" id="btn-tb-add-mesh" style="background: rgba(14, 165, 233, 0.12); border-color: rgba(14, 165, 233, 0.35); color: var(--accent-cyan); font-weight:600;" title="Create a new 3D mesh primitive">
            <span>+ Add Mesh ▾</span>
          </button>
          <div class="mesh-create-dropdown" id="tb-mesh-dropdown" style="display:none; position:absolute; top:calc(100% + 6px); left:0; z-index:1000;">
            ${PRIMITIVE_DEFINITIONS.map(
              (p) => `
              <button class="mesh-dropdown-item" data-type="${p.type}">
                <span class="mesh-item-icon">${p.icon}</span>
                <div class="mesh-item-text">
                  <span class="mesh-item-title">${p.label}</span>
                  <span class="mesh-item-desc">${p.description}</span>
                </div>
              </button>
            `
            ).join('')}
          </div>
        </div>

        <!-- Open In-Browser Code Editor -->
        <button class="btn btn-sm" id="btn-open-code-modal" style="margin-left: 4px;" title="Paste or edit TypeScript/JavaScript Three.js code">
          <span>⚡ Paste / Edit Code</span>
        </button>

        <!-- Direct Upload Button for TS, JS, GLB -->
        <label class="btn btn-sm" style="margin-left: 2px; cursor: pointer;" title="Upload custom .ts, .js, or .glb file">
          <span>📂 Upload File</span>
          <input type="file" id="universal-file-input" accept=".ts,.js,.tsx,.jsx,.glb,.gltf" style="display:none;" />
        </label>

        <!-- AI Generate Button -->
        <button class="btn btn-sm btn-primary" id="btn-open-ai-modal" style="margin-left: 6px; background: linear-gradient(135deg, #06b6d4, #6366f1); border:none; box-shadow: 0 0 12px rgba(6, 182, 212, 0.4); font-weight:600;" title="Generate 3D procedural model directly from an image using Gemini / OpenAI">
          <span>✨ AI Generate (img2threejs)</span>
        </button>
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
        this.callbacks.onModelLoaded(model, preset.referenceImage);
      }
    });

    // Open Code Modal
    this.container.querySelector('#btn-open-code-modal')?.addEventListener('click', () => {
      this.callbacks.onOpenCodeEditor();
    });

    // Open AI Generate Modal
    this.container.querySelector('#btn-open-ai-modal')?.addEventListener('click', () => {
      this.callbacks.onOpenAiGenerator();
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

    // Undo / Redo
    this.container.querySelector('#btn-undo')?.addEventListener('click', () => {
      this.callbacks.onUndo?.();
    });
    this.container.querySelector('#btn-redo')?.addEventListener('click', () => {
      this.callbacks.onRedo?.();
    });

    // Add Mesh Dropdown
    const btnAddMesh = this.container.querySelector('#btn-tb-add-mesh') as HTMLButtonElement | null;
    const dropdownAddMesh = this.container.querySelector('#tb-mesh-dropdown') as HTMLElement | null;

    if (btnAddMesh && dropdownAddMesh) {
      btnAddMesh.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = dropdownAddMesh.style.display === 'flex';
        dropdownAddMesh.style.display = isShown ? 'none' : 'flex';
      });

      dropdownAddMesh.querySelectorAll('.mesh-dropdown-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const type = (item as HTMLElement).getAttribute('data-type') as PrimitiveType;
          if (type) {
            this.callbacks.onCreateMesh?.(type);
          }
          dropdownAddMesh.style.display = 'none';
        });
      });

      window.addEventListener('click', () => {
        dropdownAddMesh.style.display = 'none';
      });
    }

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

  public updateHistoryState(canUndo: boolean, canRedo: boolean) {
    const btnUndo = this.container.querySelector('#btn-undo') as HTMLButtonElement | null;
    const btnRedo = this.container.querySelector('#btn-redo') as HTMLButtonElement | null;
    if (btnUndo) btnUndo.disabled = !canUndo;
    if (btnRedo) btnRedo.disabled = !canRedo;
  }
}
