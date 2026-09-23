import * as THREE from 'three';
import { SceneContext } from '../viewer/createScene';
import { ViewMode, applyViewMode } from '../viewer/viewModes';

export class ViewportOverlay {
  private container: HTMLElement;
  private sceneCtx: SceneContext;
  private currentMode: ViewMode = 'material';
  private referenceOpacity: number = 0.5;
  private referenceVisible: boolean = false;
  private refImgEl: HTMLImageElement | null = null;

  constructor(container: HTMLElement, sceneCtx: SceneContext) {
    this.container = container;
    this.sceneCtx = sceneCtx;
    this.render();
  }

  public render() {
    // 1. Top floating viewport toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'viewport-toolbar';
    toolbar.innerHTML = `
      <!-- Camera Mode -->
      <div class="toolbar-group">
        <button class="tool-btn active" id="btn-cam-persp" title="Perspective Camera">Persp</button>
        <button class="tool-btn" id="btn-cam-ortho" title="Orthographic Camera">Ortho</button>
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
        <button class="tool-btn" id="btn-reset-view" title="Reset Camera View">⟲ Reset</button>
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
}
