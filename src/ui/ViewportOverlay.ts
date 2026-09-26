import * as THREE from 'three';
import { SceneContext } from '../viewer/createScene';
import { ViewMode, applyViewMode } from '../viewer/viewModes';
import { TransformGizmoManager } from '../viewer/transformGizmo';
import { HistoryManager } from '../model/history';
import { ICONS } from './icons';

export class ViewportOverlay {
  private container: HTMLElement;
  private sceneCtx: SceneContext;
  private transformGizmo?: TransformGizmoManager;
  private historyManager?: HistoryManager;
  private currentMode: ViewMode = 'material';
  private referenceOpacity: number = 0.5;
  private referenceVisible: boolean = false;
  private refImgEl: HTMLImageElement | null = null;

  constructor(
    container: HTMLElement,
    sceneCtx: SceneContext,
    transformGizmo?: TransformGizmoManager,
    historyManager?: HistoryManager
  ) {
    this.container = container;
    this.sceneCtx = sceneCtx;
    this.transformGizmo = transformGizmo;
    this.historyManager = historyManager;
    this.render();
  }

  public render() {
    // 1. Top floating viewport toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'viewport-toolbar';
    toolbar.innerHTML = `
      <!-- Unity Transform Gizmo Tools -->
      <div class="toolbar-group transform-tools" aria-label="Transform Tools">
        <button class="tool-btn active" id="btn-gizmo-trans" title="Move Tool (Shortcut: W) - Drag red/green/blue axis or plane to translate">
          ${ICONS.move(12)} <span>Move</span>
        </button>
        <button class="tool-btn" id="btn-gizmo-rot" title="Rotate Tool (Shortcut: E) - Drag rings to rotate">
          ${ICONS.rotate(12)} <span>Rotate</span>
        </button>
        <button class="tool-btn" id="btn-gizmo-scale" title="Scale Tool (Shortcut: R) - Drag handles to scale">
          ${ICONS.scale(12)} <span>Scale</span>
        </button>
        <button class="tool-btn" id="btn-gizmo-space" title="Toggle Coordinate Space: World / Local (Shortcut: X)">
          ${ICONS.world(12)} <span id="lbl-gizmo-space">World</span>
        </button>
        <button class="tool-btn" id="btn-gizmo-snap" title="Toggle Snapping (0.5m / 15°)">
          ${ICONS.magnet(12)} <span>Snap</span>
        </button>
      </div>

      <!-- Camera Mode -->
      <div class="toolbar-group">
        <button class="tool-btn active" id="btn-cam-persp" title="Perspective Camera">Persp</button>
        <button class="tool-btn" id="btn-cam-ortho" title="Orthographic Camera">Ortho</button>
      </div>

      <!-- Orthographic reference directions -->
      <div class="toolbar-group" aria-label="Orthographic views">
        <button class="tool-btn" id="btn-view-top" title="Top orthographic view">Top</button>
        <button class="tool-btn" id="btn-view-bottom" title="Bottom orthographic view">Bottom</button>
        <button class="tool-btn" id="btn-view-left" title="Left profile view">Left</button>
        <button class="tool-btn" id="btn-view-right" title="Right profile view">Right</button>
      </div>

      <!-- View Modes -->
      <div class="toolbar-group">
        <button class="tool-btn active" id="btn-mode-mat" title="PBR Material Mode">Lit</button>
        <button class="tool-btn" id="btn-mode-wire" title="Wireframe Mode">Wire</button>
        <button class="tool-btn" id="btn-mode-solid" title="Solid Flat Mode">Solid</button>
        <button class="tool-btn" id="btn-mode-norm" title="Surface Normals Mode">Norm</button>
      </div>

      <!-- Helpers & Shadows -->
      <div class="toolbar-group">
        <button class="tool-btn active" id="btn-toggle-grid" title="Toggle Grid">Grid</button>
        <button class="tool-btn active" id="btn-toggle-axes" title="Toggle Axes">Axes</button>
        <button class="tool-btn active" id="btn-toggle-shadows" title="Toggle Shadows">Shadow</button>
      </div>

      <!-- Actions -->
      <div class="toolbar-group">
        <button class="tool-btn" id="btn-vp-undo" title="Undo (Ctrl+Z / ⌘Z)" disabled>${ICONS.undo(12)}</button>
        <button class="tool-btn" id="btn-vp-redo" title="Redo (Ctrl+Y / ⌘⇧Z)" disabled>${ICONS.redo(12)}</button>
        <button class="tool-btn" id="btn-reset-view" title="Reset Camera View">${ICONS.reset(12)} <span>Reset</span></button>
      </div>
    `;
    this.container.appendChild(toolbar);

    // 2. Reference image comparison container over canvas
    const refContainer = document.createElement('div');
    refContainer.className = 'reference-overlay-container';
    this.refImgEl = document.createElement('img');
    this.refImgEl.className = 'reference-image';
    this.refImgEl.src = '/reference/aerial_reference.jpg';
    this.refImgEl.style.opacity = '0';
    this.refImgEl.style.display = 'none';
    refContainer.appendChild(this.refImgEl);
    this.container.appendChild(refContainer);

    // 3. Floating Reference Overlay HUD control (bottom-left of viewport)
    const refHud = document.createElement('div');
    refHud.className = 'reference-overlay-hud';
    refHud.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
        <span style="font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-secondary);">
          🖼️ Reference Overlay
        </span>
        <label class="checkbox-label" style="font-size:11px;">
          <input type="checkbox" id="chk-ref-enable"/>
          Show
        </label>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:10px; color:var(--text-muted);">Opacity</span>
        <input type="range" id="rng-ref-opacity" min="0" max="100" value="50" style="flex:1; accent-color:var(--accent-blue);" disabled/>
        <span id="lbl-ref-val" style="font-family:var(--font-mono); font-size:10px; width:28px;">50%</span>
      </div>
    `;
    this.container.appendChild(refHud);

    this.bindEvents(toolbar, refHud);
  }

  private bindEvents(toolbar: HTMLElement, refHud: HTMLElement) {
    // Transform Gizmo Tool Toggles
    const btnGizmoTrans = toolbar.querySelector('#btn-gizmo-trans') as HTMLButtonElement | null;
    const btnGizmoRot = toolbar.querySelector('#btn-gizmo-rot') as HTMLButtonElement | null;
    const btnGizmoScale = toolbar.querySelector('#btn-gizmo-scale') as HTMLButtonElement | null;
    const btnGizmoSpace = toolbar.querySelector('#btn-gizmo-space') as HTMLButtonElement | null;
    const btnGizmoSnap = toolbar.querySelector('#btn-gizmo-snap') as HTMLButtonElement | null;

    btnGizmoTrans?.addEventListener('click', () => {
      this.transformGizmo?.setMode('translate');
      this.updateGizmoMode('translate');
    });
    btnGizmoRot?.addEventListener('click', () => {
      this.transformGizmo?.setMode('rotate');
      this.updateGizmoMode('rotate');
    });
    btnGizmoScale?.addEventListener('click', () => {
      this.transformGizmo?.setMode('scale');
      this.updateGizmoMode('scale');
    });
    btnGizmoSpace?.addEventListener('click', () => {
      if (this.transformGizmo) {
        const nextSpace = this.transformGizmo.toggleSpace();
        this.updateGizmoSpace(nextSpace);
      }
    });
    btnGizmoSnap?.addEventListener('click', () => {
      if (this.transformGizmo) {
        const snap = this.transformGizmo.toggleSnap();
        this.updateGizmoSnap(snap);
      }
    });

    // Camera toggles
    const btnPersp = toolbar.querySelector('#btn-cam-persp') as HTMLButtonElement;
    const btnOrtho = toolbar.querySelector('#btn-cam-ortho') as HTMLButtonElement;

    btnPersp.addEventListener('click', () => {
      btnPersp.classList.add('active');
      btnOrtho.classList.remove('active');
      this.sceneCtx.setCameraType('perspective');
    });

    btnOrtho.addEventListener('click', () => {
      btnOrtho.classList.add('active');
      btnPersp.classList.remove('active');
      this.sceneCtx.setCameraType('orthographic');
    });

    for (const view of ['top', 'bottom', 'left', 'right'] as const) {
      toolbar.querySelector(`#btn-view-${view}`)?.addEventListener('click', () => {
        btnOrtho.classList.add('active');
        btnPersp.classList.remove('active');
        this.sceneCtx.setViewDirection(view);
      });
    }

    // View modes
    const modeBtns = {
      material: toolbar.querySelector('#btn-mode-mat') as HTMLButtonElement,
      wireframe: toolbar.querySelector('#btn-mode-wire') as HTMLButtonElement,
      solid: toolbar.querySelector('#btn-mode-solid') as HTMLButtonElement,
      normals: toolbar.querySelector('#btn-mode-norm') as HTMLButtonElement,
    };

    const setMode = (mode: ViewMode) => {
      this.currentMode = mode;
      Object.values(modeBtns).forEach((b) => b.classList.remove('active'));
      modeBtns[mode].classList.add('active');
      applyViewMode(this.sceneCtx.modelGroup, mode);
    };

    modeBtns.material.addEventListener('click', () => setMode('material'));
    modeBtns.wireframe.addEventListener('click', () => setMode('wireframe'));
    modeBtns.solid.addEventListener('click', () => setMode('solid'));
    modeBtns.normals.addEventListener('click', () => setMode('normals'));

    // Helpers
    let gridOn = true;
    const btnGrid = toolbar.querySelector('#btn-toggle-grid') as HTMLButtonElement;
    btnGrid.addEventListener('click', () => {
      gridOn = !gridOn;
      this.sceneCtx.setGridVisible(gridOn);
      btnGrid.classList.toggle('active', gridOn);
    });

    let axesOn = true;
    const btnAxes = toolbar.querySelector('#btn-toggle-axes') as HTMLButtonElement;
    btnAxes.addEventListener('click', () => {
      axesOn = !axesOn;
      this.sceneCtx.setAxesVisible(axesOn);
      btnAxes.classList.toggle('active', axesOn);
    });

    let shadowsOn = true;
    const btnShadows = toolbar.querySelector('#btn-toggle-shadows') as HTMLButtonElement;
    btnShadows.addEventListener('click', () => {
      shadowsOn = !shadowsOn;
      this.sceneCtx.setShadowsEnabled(shadowsOn);
      btnShadows.classList.toggle('active', shadowsOn);
    });

    // Undo / Redo
    const btnVpUndo = toolbar.querySelector('#btn-vp-undo') as HTMLButtonElement | null;
    const btnVpRedo = toolbar.querySelector('#btn-vp-redo') as HTMLButtonElement | null;

    btnVpUndo?.addEventListener('click', () => {
      this.historyManager?.undo();
    });
    btnVpRedo?.addEventListener('click', () => {
      this.historyManager?.redo();
    });

    if (this.historyManager) {
      this.historyManager.addListener((e) => {
        if (btnVpUndo) btnVpUndo.disabled = !e.canUndo;
        if (btnVpRedo) btnVpRedo.disabled = !e.canRedo;
      });
    }

    // Reset View
    toolbar.querySelector('#btn-reset-view')?.addEventListener('click', () => {
      this.sceneCtx.resetCamera();
    });

    // Reference Overlay
    const chkRef = refHud.querySelector('#chk-ref-enable') as HTMLInputElement;
    const rngRef = refHud.querySelector('#rng-ref-opacity') as HTMLInputElement;
    const lblRef = refHud.querySelector('#lbl-ref-val') as HTMLSpanElement;

    chkRef.addEventListener('change', () => {
      this.referenceVisible = chkRef.checked;
      rngRef.disabled = !this.referenceVisible;
      if (this.refImgEl) {
        this.refImgEl.style.display = this.referenceVisible ? 'block' : 'none';
        this.refImgEl.style.opacity = this.referenceVisible ? (this.referenceOpacity).toString() : '0';
      }
    });

    rngRef.addEventListener('input', () => {
      this.referenceOpacity = parseInt(rngRef.value, 10) / 100;
      lblRef.textContent = `${rngRef.value}%`;
      if (this.refImgEl && this.referenceVisible) {
        this.refImgEl.style.opacity = this.referenceOpacity.toString();
      }
    });
  }

  public setReferenceImage(src: string, autoEnable = true) {
    if (this.refImgEl) {
      this.refImgEl.src = src;
      if (autoEnable) {
        this.referenceVisible = true;
        this.refImgEl.style.display = 'block';
        this.refImgEl.style.opacity = this.referenceOpacity.toString();

        const chkRef = this.container.querySelector('#chk-ref-enable') as HTMLInputElement;
        const rngRef = this.container.querySelector('#rng-ref-opacity') as HTMLInputElement;
        if (chkRef) chkRef.checked = true;
        if (rngRef) rngRef.disabled = false;
      }
    }
  }

  public updateGizmoMode(mode: 'translate' | 'rotate' | 'scale') {
    const btnTrans = this.container.querySelector('#btn-gizmo-trans');
    const btnRot = this.container.querySelector('#btn-gizmo-rot');
    const btnScale = this.container.querySelector('#btn-gizmo-scale');
    btnTrans?.classList.toggle('active', mode === 'translate');
    btnRot?.classList.toggle('active', mode === 'rotate');
    btnScale?.classList.toggle('active', mode === 'scale');
  }

  public updateGizmoSpace(space: 'world' | 'local') {
    const lblSpace = this.container.querySelector('#lbl-gizmo-space');
    if (lblSpace) lblSpace.textContent = space === 'world' ? 'World' : 'Local';
  }

  public updateGizmoSnap(snap: boolean) {
    const btnSnap = this.container.querySelector('#btn-gizmo-snap');
    btnSnap?.classList.toggle('active', snap);
  }

  public updateHistoryState(canUndo: boolean, canRedo: boolean) {
    const btnUndo = this.container.querySelector('#btn-vp-undo') as HTMLButtonElement | null;
    const btnRedo = this.container.querySelector('#btn-vp-redo') as HTMLButtonElement | null;
    if (btnUndo) btnUndo.disabled = !canUndo;
    if (btnRedo) btnRedo.disabled = !canRedo;
  }
}
