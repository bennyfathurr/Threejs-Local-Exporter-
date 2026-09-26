import * as THREE from 'three';
import { PRESETS } from '../model/loadFactory';
import { SceneContext } from '../viewer/createScene';
import { PRIMITIVE_DEFINITIONS, PrimitiveType } from '../model/meshOperations';
import {
  loadModelFromAnyFile,
  hasModelDraftInStorage,
  getModelDraftMetadata,
} from '../model/projectSaveLoad';
import { showToast } from './Toast';
import { ICONS } from './icons';

export interface ToolbarCallbacks {
  onModelLoaded: (root: THREE.Object3D, referenceImage?: string) => void;
  onResetView: () => void;
  onOpenCodeEditor: () => void;
  onOpenAiGenerator: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCreateMesh?: (type: PrimitiveType) => void;
  onQuickSave?: () => void;
  onSaveGlb?: () => void;
  onSaveProjectJson?: () => void;
  onOpenSaveModal?: () => void;
  onSaveDraft?: () => void;
  onRestoreDraft?: () => void;
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

  public getActivePresetId(): string {
    return this.activePresetId;
  }

  public render() {
    this.container.className = 'app-header';
    this.container.innerHTML = `
      <!-- LEFT BRAND -->
      <div class="brand-section">
        <div class="brand-logo" style="background:transparent; box-shadow:none;">
          ${ICONS.logo(26)}
        </div>
        <div>
          <span class="brand-title">Three.js Model Studio</span>
          <span class="badge-tag" style="margin-left: 6px;">Studio</span>
        </div>
      </div>

      <!-- CENTER MODEL SELECTOR & ACTION BUTTONS -->
      <div class="model-switcher">
        <label style="font-size:11px; color:var(--text-muted); font-weight:600;">MODEL:</label>
        <select class="select-input" id="model-preset-select">
          ${PRESETS.map((p) => `<option value="${p.id}" ${p.id === this.activePresetId ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>

        <!-- Undo / Redo Buttons -->
        <div style="display:flex; align-items:center; gap:3px; margin-left: 4px; padding: 0 4px; border-left: 1px solid var(--border-color); border-right: 1px solid var(--border-color);">
          <button class="btn btn-sm" id="btn-undo" title="Undo (Ctrl+Z / ⌘Z)" disabled>
            ${ICONS.undo(12)} <span>Undo</span>
          </button>
          <button class="btn btn-sm" id="btn-redo" title="Redo (Ctrl+Y / ⌘⇧Z)" disabled>
            ${ICONS.redo(12)} <span>Redo</span>
          </button>
        </div>

        <!-- Add Primitive Mesh Dropdown -->
        <div class="dropdown-wrapper" style="position:relative; margin-left: 4px;">
          <button class="btn btn-sm" id="btn-tb-add-mesh" style="background: rgba(14, 165, 233, 0.12); border-color: rgba(14, 165, 233, 0.35); color: var(--accent-cyan); font-weight:600;" title="Create a new 3D mesh primitive">
            ${ICONS.box(13)} <span>+ Add Mesh</span> <span style="font-size:9px;">▼</span>
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

        <!-- SAVE FEATURE DROPDOWN -->
        <div class="dropdown-wrapper" style="position:relative; margin-left: 4px;">
          <div style="display:flex; align-items:stretch;">
            <button class="btn btn-sm" id="btn-tb-quick-save" style="border-top-right-radius:0; border-bottom-right-radius:0; background: rgba(16, 185, 129, 0.14); border-color: rgba(16, 185, 129, 0.45); color: #34d399; font-weight:600; padding-right:8px;" title="Save Model & Project (Ctrl+S / ⌘S)">
              ${ICONS.save(13)} <span>Save</span>
            </button>
            <button class="btn btn-sm" id="btn-tb-save-dropdown-toggle" style="border-top-left-radius:0; border-bottom-left-radius:0; border-left:none; padding:3px 6px; background: rgba(16, 185, 129, 0.14); border-color: rgba(16, 185, 129, 0.45); color: #34d399;" title="More save options">
              <span style="font-size:9px;">▼</span>
            </button>
          </div>
          <div class="mesh-create-dropdown" id="tb-save-dropdown" style="display:none; position:absolute; top:calc(100% + 6px); left:0; min-width:230px; z-index:1000;">
            <button class="mesh-dropdown-item" id="btn-save-opt-glb">
              <span class="mesh-item-icon" style="color:var(--accent-cyan);">${ICONS.box(15)}</span>
              <div class="mesh-item-text">
                <span class="mesh-item-title">Save 3D Model (.glb)</span>
                <span class="mesh-item-desc">Binary 3D asset for AR & Web</span>
              </div>
            </button>
            <button class="mesh-dropdown-item" id="btn-save-opt-json">
              <span class="mesh-item-icon" style="color:var(--accent-blue);">${ICONS.save(15)}</span>
              <div class="mesh-item-text">
                <span class="mesh-item-title">Save Project File (.json)</span>
                <span class="mesh-item-desc">Full editable Three.js scene</span>
              </div>
            </button>
            <button class="mesh-dropdown-item" id="btn-save-opt-dialog">
              <span class="mesh-item-icon" style="color:var(--accent-indigo);">${ICONS.sparkles(15)}</span>
              <div class="mesh-item-text">
                <span class="mesh-item-title">Save Dialog & Options...</span>
                <span class="mesh-item-desc">Center, ground, customize</span>
              </div>
            </button>
            <div style="border-top:1px solid var(--border-color); margin:4px 0;"></div>
            <button class="mesh-dropdown-item" id="btn-save-opt-draft">
              <span class="mesh-item-icon" style="color:var(--accent-emerald);">${ICONS.download(15)}</span>
              <div class="mesh-item-text">
                <span class="mesh-item-title">Save to Browser Storage</span>
                <span class="mesh-item-desc">Local auto-recovery draft</span>
              </div>
            </button>
            <button class="mesh-dropdown-item" id="btn-restore-opt-draft">
              <span class="mesh-item-icon" style="color:var(--accent-amber);">${ICONS.reset(15)}</span>
              <div class="mesh-item-text">
                <span class="mesh-item-title">Restore Browser Draft</span>
                <span class="mesh-item-desc" id="lbl-restore-draft-desc">No draft found</span>
              </div>
            </button>
          </div>
        </div>

        <!-- OPEN / LOAD FILE BUTTON (JSON, GLB, GLTF, TS, JS) -->
        <label class="btn btn-sm" style="margin-left: 2px; cursor: pointer; background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.35); color: var(--accent-blue);" title="Open or load saved 3D model (.glb), project file (.json), or procedural code (.ts, .js)">
          ${ICONS.folder(13)} <span>Open / Load</span>
          <input type="file" id="universal-file-input" accept=".json,.glb,.gltf,.ts,.js,.tsx,.jsx" style="display:none;" />
        </label>

        <!-- Open In-Browser Code Editor -->
        <button class="btn btn-sm" id="btn-open-code-modal" style="margin-left: 4px;" title="View or edit TypeScript/JavaScript Three.js code">
          ${ICONS.code(13)} <span>Code</span>
        </button>

        <!-- AI Generate Button -->
        <button class="btn btn-sm btn-primary" id="btn-open-ai-modal" style="margin-left: 6px; background: linear-gradient(135deg, #06b6d4, #6366f1); border:none; box-shadow: 0 0 12px rgba(6, 182, 212, 0.4); font-weight:600;" title="Generate 3D procedural model directly from an image using Gemini / OpenAI">
          ${ICONS.sparkles(13)} <span>AI Generate</span>
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

        <button class="btn btn-sm" id="btn-info" title="View Studio Specification Info">
          ${ICONS.info(13)} <span>Specs</span>
        </button>
      </div>
    `;

    this.bindEvents();
    this.updateDraftState();
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

    // Universal File Input (.json, .glb, .gltf, .ts, .js)
    const fileInput = this.container.querySelector('#universal-file-input') as HTMLInputElement;
    fileInput.addEventListener('change', async () => {
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        try {
          const result = await loadModelFromAnyFile(file);
          this.callbacks.onModelLoaded(result.model);
          showToast(`Loaded ${result.fileType.toUpperCase()}: ${result.name}`, '📂');
        } catch (err) {
          alert(`Failed to load file "${file.name}":\n\n${err instanceof Error ? err.message : String(err)}`);
        } finally {
          fileInput.value = '';
        }
      }
    });

    // Save Feature Handlers
    const btnQuickSave = this.container.querySelector('#btn-tb-quick-save') as HTMLButtonElement | null;
    const btnSaveDropdownToggle = this.container.querySelector('#btn-tb-save-dropdown-toggle') as HTMLButtonElement | null;
    const dropdownSave = this.container.querySelector('#tb-save-dropdown') as HTMLElement | null;

    btnQuickSave?.addEventListener('click', () => {
      this.callbacks.onQuickSave?.();
    });

    if (btnSaveDropdownToggle && dropdownSave) {
      btnSaveDropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = dropdownSave.style.display === 'flex';
        dropdownSave.style.display = isShown ? 'none' : 'flex';
        this.updateDraftState();
      });

      this.container.querySelector('#btn-save-opt-glb')?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownSave.style.display = 'none';
        this.callbacks.onSaveGlb?.();
      });

      this.container.querySelector('#btn-save-opt-json')?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownSave.style.display = 'none';
        this.callbacks.onSaveProjectJson?.();
      });

      this.container.querySelector('#btn-save-opt-dialog')?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownSave.style.display = 'none';
        this.callbacks.onOpenSaveModal?.();
      });

      this.container.querySelector('#btn-save-opt-draft')?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownSave.style.display = 'none';
        this.callbacks.onSaveDraft?.();
        this.updateDraftState();
      });

      this.container.querySelector('#btn-restore-opt-draft')?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownSave.style.display = 'none';
        this.callbacks.onRestoreDraft?.();
      });

      window.addEventListener('click', () => {
        dropdownSave.style.display = 'none';
      });
    }

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
        '• Save models as binary .glb or editable .json project files.\n' +
        '• Drag-and-drop or load .glb, .gltf, .json, .ts, or .js files.\n' +
        '• Press Ctrl+S / ⌘S anytime for Quick Save.\n' +
        '• Multi-format export: GLB, glTF, USDZ (visionOS/iOS), OBJ+MTL (.zip), STL, PLY.\n' +
        '• Live scene inventory, raycast selection, solo/lock modes, and validation report.'
      );
    });
  }

  public updateDraftState() {
    const btnRestore = this.container.querySelector('#btn-restore-opt-draft') as HTMLButtonElement | null;
    const lblDesc = this.container.querySelector('#lbl-restore-draft-desc') as HTMLElement | null;

    if (btnRestore && lblDesc) {
      const hasDraft = hasModelDraftInStorage();
      btnRestore.disabled = !hasDraft;
      if (hasDraft) {
        const meta = getModelDraftMetadata();
        if (meta) {
          const timeAgo = Math.round((Date.now() - meta.timestamp) / 60000);
          const timeStr = timeAgo <= 1 ? 'just now' : `${timeAgo}m ago`;
          lblDesc.textContent = `"${meta.name}" (${timeStr})`;
        } else {
          lblDesc.textContent = 'Restore saved scene';
        }
      } else {
        lblDesc.textContent = 'No draft found';
      }
    }
  }

  public updateHistoryState(canUndo: boolean, canRedo: boolean) {
    const btnUndo = this.container.querySelector('#btn-undo') as HTMLButtonElement | null;
    const btnRedo = this.container.querySelector('#btn-redo') as HTMLButtonElement | null;
    if (btnUndo) btnUndo.disabled = !canUndo;
    if (btnRedo) btnRedo.disabled = !canRedo;
  }
}
