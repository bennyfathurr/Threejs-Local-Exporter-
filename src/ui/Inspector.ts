import * as THREE from 'three';
import { SelectionManager } from '../viewer/selection';
import { HistoryAction, captureTransform, applyTransform, transformsEqual } from '../model/history';

export interface InspectorCallbacks {
  onFrameObject: (object: THREE.Object3D) => void;
  onTransformChange: (object: THREE.Object3D) => void;
  onExportSubtree: (object: THREE.Object3D) => void;
  onRefreshTree: () => void;
  onGizmoModeChange?: (mode: 'translate' | 'rotate' | 'scale') => void;
  onGizmoSpaceToggle?: () => void;
  getGizmoMode?: () => 'translate' | 'rotate' | 'scale';
  getGizmoSpace?: () => 'world' | 'local';
  onRecordAction?: (action: HistoryAction) => void;
  onDelete?: (object: THREE.Object3D) => void;
}

export class Inspector {
  private container: HTMLElement;
  private selectionManager: SelectionManager;
  private callbacks: InspectorCallbacks;

  constructor(
    container: HTMLElement,
    selectionManager: SelectionManager,
    callbacks: InspectorCallbacks
  ) {
    this.container = container;
    this.selectionManager = selectionManager;
    this.callbacks = callbacks;
  }

  public update() {
    const obj = this.selectionManager.selectedObject;
    this.container.innerHTML = '';

    if (!obj) {
      this.container.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 28px; margin-bottom: 8px;">🎯</div>
          <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">No Part Selected</div>
          <div style="font-size: 11px;">Click any 3D mesh in the viewport or pick from the Scene Tree to inspect and transform.</div>
        </div>
      `;
      return;
    }

    const isMesh = (obj as THREE.Mesh).isMesh;

    // Header Card
    const headerCard = document.createElement('div');
    headerCard.className = 'inspector-section';
    headerCard.innerHTML = `
      <div class="section-title">
        <span>Part Overview</span>
        <span class="badge-tag">${obj.type}</span>
      </div>
      <div class="section-body">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <input type="text" class="text-input" id="inspector-name-input" value="${obj.name || ''}" style="flex:1; font-weight:600;" placeholder="Object Name"/>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
          <button class="btn btn-sm" id="btn-focus-obj" title="Frame camera on this part">🎯 Focus</button>
          <button class="btn btn-sm" id="btn-select-parent" title="Select parent group">⬆ Parent</button>
          <button class="btn btn-sm" id="btn-solo-obj" title="Solo this part">👁️ Solo</button>
          <button class="btn btn-sm" id="btn-hide-obj" title="Toggle visibility">${obj.visible ? 'Hide' : 'Show'}</button>
          <button class="btn btn-sm" id="btn-delete-obj" style="color:var(--accent-rose); border-color: rgba(244, 63, 94, 0.35);" title="Delete selected object (Delete / Backspace)">🗑️ Delete</button>
        </div>
      </div>
    `;
    this.container.appendChild(headerCard);

    // Wire header action buttons
    headerCard.querySelector('#btn-delete-obj')?.addEventListener('click', () => {
      this.callbacks.onDelete?.(obj);
    });
    const nameInput = headerCard.querySelector('#inspector-name-input') as HTMLInputElement;
    nameInput.addEventListener('change', () => {
      const prevName = obj.name;
      const newName = nameInput.value.trim() || obj.name;
      if (prevName !== newName) {
        obj.name = newName;
        this.callbacks.onRecordAction?.({
          name: `Rename "${prevName}" to "${newName}"`,
          undo: () => {
            obj.name = prevName;
            this.update();
            this.callbacks.onRefreshTree();
          },
          redo: () => {
            obj.name = newName;
            this.update();
            this.callbacks.onRefreshTree();
          },
        });
        this.callbacks.onRefreshTree();
      }
    });

    headerCard.querySelector('#btn-focus-obj')?.addEventListener('click', () => {
      this.callbacks.onFrameObject(obj);
    });

    headerCard.querySelector('#btn-select-parent')?.addEventListener('click', () => {
      this.selectionManager.selectParent();
      this.update();
      this.callbacks.onRefreshTree();
    });

    headerCard.querySelector('#btn-solo-obj')?.addEventListener('click', () => {
      this.selectionManager.soloObject(obj);
      this.callbacks.onRefreshTree();
    });

    headerCard.querySelector('#btn-hide-obj')?.addEventListener('click', () => {
      const prevVisible = obj.visible;
      this.selectionManager.hideSelected();
      const newVisible = obj.visible;
      this.callbacks.onRecordAction?.({
        name: `${newVisible ? 'Show' : 'Hide'} "${obj.name}"`,
        undo: () => {
          obj.visible = prevVisible;
          this.update();
          this.callbacks.onRefreshTree();
        },
        redo: () => {
          obj.visible = newVisible;
          this.update();
          this.callbacks.onRefreshTree();
        },
      });
      this.update();
      this.callbacks.onRefreshTree();
    });

    // Transform Section
    const transformSection = document.createElement('div');
    transformSection.className = 'inspector-section';

    const currentMode = this.callbacks.getGizmoMode ? this.callbacks.getGizmoMode() : 'translate';
    const currentSpace = this.callbacks.getGizmoSpace ? this.callbacks.getGizmoSpace() : 'world';

    transformSection.innerHTML = `
      <div class="section-title" style="display:flex; align-items:center; justify-content:space-between;">
        <span>Transform (Axis Gizmo)</span>
        <button class="btn btn-xs" id="btn-copy-pos" title="Copy hotspot anchor string (e.g. '13.5m 0.65m 1.0m')">📋 Copy Vector</button>
      </div>
      <div class="section-body">
        <!-- Unity Gizmo Mode & Space Switcher -->
        <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; margin-bottom:8px;">
          <div style="display:flex; gap:3px;">
            <button class="btn btn-xs ${currentMode === 'translate' ? 'active' : ''}" id="btn-insp-mode-trans" title="Move Tool (Shortcut: W)">✛ Move</button>
            <button class="btn btn-xs ${currentMode === 'rotate' ? 'active' : ''}" id="btn-insp-mode-rot" title="Rotate Tool (Shortcut: E)">🔄 Rotate</button>
            <button class="btn btn-xs ${currentMode === 'scale' ? 'active' : ''}" id="btn-insp-mode-scale" title="Scale Tool (Shortcut: R)">⤢ Scale</button>
          </div>
          <button class="btn btn-xs" id="btn-insp-space-toggle" title="Toggle Coordinate Space: World / Local (Shortcut: X)">🌐 ${currentSpace === 'world' ? 'World' : 'Local'}</button>
        </div>

        <!-- Position -->
        <div class="vec3-row">
          <span class="vec3-label">Position</span>
          <div class="vec3-inputs">
            <div class="vec3-input-wrapper"><span class="axis-tag x">X</span><input type="number" step="0.1" id="pos-x" value="${obj.position.x.toFixed(2)}"/></div>
            <div class="vec3-input-wrapper"><span class="axis-tag y">Y</span><input type="number" step="0.1" id="pos-y" value="${obj.position.y.toFixed(2)}"/></div>
            <div class="vec3-input-wrapper"><span class="axis-tag z">Z</span><input type="number" step="0.1" id="pos-z" value="${obj.position.z.toFixed(2)}"/></div>
          </div>
        </div>

        <!-- Rotation (Degrees) -->
        <div class="vec3-row">
          <span class="vec3-label">Rotation</span>
          <div class="vec3-inputs">
            <div class="vec3-input-wrapper"><span class="axis-tag x">X</span><input type="number" step="1" id="rot-x" value="${THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1)}"/></div>
            <div class="vec3-input-wrapper"><span class="axis-tag y">Y</span><input type="number" step="1" id="rot-y" value="${THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1)}"/></div>
            <div class="vec3-input-wrapper"><span class="axis-tag z">Z</span><input type="number" step="1" id="rot-z" value="${THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1)}"/></div>
          </div>
        </div>

        <!-- Scale -->
        <div class="vec3-row">
          <span class="vec3-label">Scale</span>
          <div class="vec3-inputs">
            <div class="vec3-input-wrapper"><span class="axis-tag x">X</span><input type="number" step="0.05" id="scl-x" value="${obj.scale.x.toFixed(2)}"/></div>
            <div class="vec3-input-wrapper"><span class="axis-tag y">Y</span><input type="number" step="0.05" id="scl-y" value="${obj.scale.y.toFixed(2)}"/></div>
            <div class="vec3-input-wrapper"><span class="axis-tag z">Z</span><input type="number" step="0.05" id="scl-z" value="${obj.scale.z.toFixed(2)}"/></div>
          </div>
        </div>

        <!-- Reset buttons -->
        <div style="display:flex; gap:4px; margin-top:8px;">
          <button class="btn btn-xs" id="btn-reset-pos" style="flex:1;" title="Reset Position to (0, 0, 0)">↺ Pos</button>
          <button class="btn btn-xs" id="btn-reset-rot" style="flex:1;" title="Reset Rotation to (0, 0, 0)">↺ Rot</button>
          <button class="btn btn-xs" id="btn-reset-scl" style="flex:1;" title="Reset Scale to (1, 1, 1)">↺ Scale</button>
        </div>
      </div>
    `;
    this.container.appendChild(transformSection);

    // Wire mode buttons
    const btnTrans = transformSection.querySelector('#btn-insp-mode-trans') as HTMLButtonElement | null;
    const btnRot = transformSection.querySelector('#btn-insp-mode-rot') as HTMLButtonElement | null;
    const btnScale = transformSection.querySelector('#btn-insp-mode-scale') as HTMLButtonElement | null;
    const btnSpace = transformSection.querySelector('#btn-insp-space-toggle') as HTMLButtonElement | null;

    btnTrans?.addEventListener('click', () => {
      this.callbacks.onGizmoModeChange?.('translate');
      this.updateModeButtons('translate');
    });
    btnRot?.addEventListener('click', () => {
      this.callbacks.onGizmoModeChange?.('rotate');
      this.updateModeButtons('rotate');
    });
    btnScale?.addEventListener('click', () => {
      this.callbacks.onGizmoModeChange?.('scale');
      this.updateModeButtons('scale');
    });
    btnSpace?.addEventListener('click', () => {
      this.callbacks.onGizmoSpaceToggle?.();
      const nextSpace = this.callbacks.getGizmoSpace ? this.callbacks.getGizmoSpace() : 'world';
      if (btnSpace) btnSpace.textContent = `🌐 ${nextSpace === 'world' ? 'World' : 'Local'}`;
    });

    // Wire Copy Vector button
    const btnCopyPos = transformSection.querySelector('#btn-copy-pos') as HTMLButtonElement | null;
    btnCopyPos?.addEventListener('click', () => {
      const worldPos = obj.getWorldPosition(new THREE.Vector3());
      const vectorStr = `${worldPos.x.toFixed(2)}m ${worldPos.y.toFixed(2)}m ${worldPos.z.toFixed(2)}m`;
      navigator.clipboard.writeText(vectorStr).then(() => {
        if (btnCopyPos) {
          const original = btnCopyPos.textContent;
          btnCopyPos.textContent = '✓ Copied!';
          btnCopyPos.style.color = 'var(--accent-emerald)';
          setTimeout(() => {
            if (btnCopyPos) {
              btnCopyPos.textContent = original;
              btnCopyPos.style.color = '';
            }
          }, 1500);
        }
      });
    });

    // Wire Reset buttons
    transformSection.querySelector('#btn-reset-pos')?.addEventListener('click', () => {
      const prev = captureTransform(obj);
      obj.position.set(0, 0, 0);
      const next = captureTransform(obj);
      if (!transformsEqual(prev, next)) {
        this.callbacks.onRecordAction?.({
          name: `Reset Position "${obj.name}"`,
          undo: () => {
            applyTransform(obj, prev);
            this.updateTransformFields(obj);
            this.callbacks.onTransformChange(obj);
            this.selectionManager.refreshHighlight();
          },
          redo: () => {
            applyTransform(obj, next);
            this.updateTransformFields(obj);
            this.callbacks.onTransformChange(obj);
            this.selectionManager.refreshHighlight();
          },
        });
      }
      this.updateTransformFields(obj);
      this.callbacks.onTransformChange(obj);
      this.selectionManager.refreshHighlight();
    });
    transformSection.querySelector('#btn-reset-rot')?.addEventListener('click', () => {
      const prev = captureTransform(obj);
      obj.rotation.set(0, 0, 0);
      const next = captureTransform(obj);
      if (!transformsEqual(prev, next)) {
        this.callbacks.onRecordAction?.({
          name: `Reset Rotation "${obj.name}"`,
          undo: () => {
            applyTransform(obj, prev);
            this.updateTransformFields(obj);
            this.callbacks.onTransformChange(obj);
            this.selectionManager.refreshHighlight();
          },
          redo: () => {
            applyTransform(obj, next);
            this.updateTransformFields(obj);
            this.callbacks.onTransformChange(obj);
            this.selectionManager.refreshHighlight();
          },
        });
      }
      this.updateTransformFields(obj);
      this.callbacks.onTransformChange(obj);
      this.selectionManager.refreshHighlight();
    });
    transformSection.querySelector('#btn-reset-scl')?.addEventListener('click', () => {
      const prev = captureTransform(obj);
      obj.scale.set(1, 1, 1);
      const next = captureTransform(obj);
      if (!transformsEqual(prev, next)) {
        this.callbacks.onRecordAction?.({
          name: `Reset Scale "${obj.name}"`,
          undo: () => {
            applyTransform(obj, prev);
            this.updateTransformFields(obj);
            this.callbacks.onTransformChange(obj);
            this.selectionManager.refreshHighlight();
          },
          redo: () => {
            applyTransform(obj, next);
            this.updateTransformFields(obj);
            this.callbacks.onTransformChange(obj);
            this.selectionManager.refreshHighlight();
          },
        });
      }
      this.updateTransformFields(obj);
      this.callbacks.onTransformChange(obj);
      this.selectionManager.refreshHighlight();
    });

    // Hook inputs
    let focusSnapshot = captureTransform(obj);
    const onFocus = () => {
      focusSnapshot = captureTransform(obj);
    };
    const onCommit = () => {
      const currentSnapshot = captureTransform(obj);
      if (!transformsEqual(focusSnapshot, currentSnapshot)) {
        const start = focusSnapshot;
        const end = currentSnapshot;
        this.callbacks.onRecordAction?.({
          name: `Edit Transform "${obj.name}"`,
          undo: () => {
            applyTransform(obj, start);
            this.updateTransformFields(obj);
            this.callbacks.onTransformChange(obj);
            this.selectionManager.refreshHighlight();
          },
          redo: () => {
            applyTransform(obj, end);
            this.updateTransformFields(obj);
            this.callbacks.onTransformChange(obj);
            this.selectionManager.refreshHighlight();
          },
        });
        focusSnapshot = currentSnapshot;
      }
    };

    const bindVec3 = (
      xId: string,
      yId: string,
      zId: string,
      getter: () => THREE.Vector3 | THREE.Euler,
      setter: (x: number, y: number, z: number) => void,
      isDegrees = false
    ) => {
      const elX = transformSection.querySelector(`#${xId}`) as HTMLInputElement;
      const elY = transformSection.querySelector(`#${yId}`) as HTMLInputElement;
      const elZ = transformSection.querySelector(`#${zId}`) as HTMLInputElement;

      const apply = () => {
        let vx = parseFloat(elX.value) || 0;
        let vy = parseFloat(elY.value) || 0;
        let vz = parseFloat(elZ.value) || 0;
        if (isDegrees) {
          vx = THREE.MathUtils.degToRad(vx);
          vy = THREE.MathUtils.degToRad(vy);
          vz = THREE.MathUtils.degToRad(vz);
        }
        setter(vx, vy, vz);
        this.callbacks.onTransformChange(obj);
        this.selectionManager.refreshHighlight();
      };

      elX.addEventListener('focus', onFocus);
      elY.addEventListener('focus', onFocus);
      elZ.addEventListener('focus', onFocus);

      elX.addEventListener('input', apply);
      elY.addEventListener('input', apply);
      elZ.addEventListener('input', apply);

      elX.addEventListener('change', onCommit);
      elY.addEventListener('change', onCommit);
      elZ.addEventListener('change', onCommit);
    };

    bindVec3(
      'pos-x', 'pos-y', 'pos-z',
      () => obj.position,
      (x, y, z) => obj.position.set(x, y, z)
    );

    bindVec3(
      'rot-x', 'rot-y', 'rot-z',
      () => obj.rotation,
      (x, y, z) => obj.rotation.set(x, y, z),
      true
    );

    bindVec3(
      'scl-x', 'scl-y', 'scl-z',
      () => obj.scale,
      (x, y, z) => obj.scale.set(x, y, z)
    );

    // Mesh Geometry & Material Stats
    if (isMesh) {
      const mesh = obj as THREE.Mesh;
      let vertexCount = 0;
      let triangleCount = 0;

      if (mesh.geometry) {
        const pos = mesh.geometry.getAttribute('position');
        if (pos) {
          vertexCount = pos.count;
          triangleCount = mesh.geometry.index ? Math.floor(mesh.geometry.index.count / 3) : Math.floor(pos.count / 3);
        }
      }

      const geomSection = document.createElement('div');
      geomSection.className = 'inspector-section';
      geomSection.innerHTML = `
        <div class="section-title">Geometry & Materials</div>
        <div class="section-body">
          <div class="stat-grid">
            <div class="stat-chip">
              <div class="stat-chip-label">Vertices</div>
              <div class="stat-chip-val">${vertexCount.toLocaleString()}</div>
            </div>
            <div class="stat-chip">
              <div class="stat-chip-label">Triangles</div>
              <div class="stat-chip-val">${triangleCount.toLocaleString()}</div>
            </div>
          </div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">
            <div><strong>Geometry:</strong> <span style="font-family:var(--font-mono); font-size:10px;">${mesh.geometry ? mesh.geometry.type : 'None'}</span></div>
          </div>
        </div>
      `;
      this.container.appendChild(geomSection);

      // Material details
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (mat) {
        const matSection = document.createElement('div');
        matSection.className = 'inspector-section';
        const color = (mat as unknown as { color?: THREE.Color }).color;
        const hexColor = color ? `#${color.getHexString()}` : '#cccccc';

        matSection.innerHTML = `
          <div class="section-title">Material Properties</div>
          <div class="section-body">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="font-size:11px; font-weight:600;">${mat.name || 'Unnamed Material'}</span>
              <span class="badge-tag">${mat.type}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="color" id="mat-color-picker" value="${hexColor}" style="width:28px; height:24px; border:none; background:transparent; cursor:pointer;" />
              <span style="font-family:var(--font-mono); font-size:11px;">${hexColor.toUpperCase()}</span>
            </div>
          </div>
        `;

        const colorPicker = matSection.querySelector('#mat-color-picker') as HTMLInputElement;
        colorPicker.addEventListener('input', () => {
          if (color) {
            color.set(colorPicker.value);
          }
        });

        this.container.appendChild(matSection);
      }
    }
  }

  public updateModeButtons(mode: 'translate' | 'rotate' | 'scale') {
    const btnTrans = this.container.querySelector('#btn-insp-mode-trans');
    const btnRot = this.container.querySelector('#btn-insp-mode-rot');
    const btnScale = this.container.querySelector('#btn-insp-mode-scale');
    btnTrans?.classList.toggle('active', mode === 'translate');
    btnRot?.classList.toggle('active', mode === 'rotate');
    btnScale?.classList.toggle('active', mode === 'scale');
  }

  public updateTransformFields(object?: THREE.Object3D | null) {
    const obj = object || this.selectionManager.selectedObject;
    if (!obj) return;

    const posX = this.container.querySelector('#pos-x') as HTMLInputElement | null;
    const posY = this.container.querySelector('#pos-y') as HTMLInputElement | null;
    const posZ = this.container.querySelector('#pos-z') as HTMLInputElement | null;
    if (posX && posY && posZ && document.activeElement !== posX && document.activeElement !== posY && document.activeElement !== posZ) {
      posX.value = obj.position.x.toFixed(2);
      posY.value = obj.position.y.toFixed(2);
      posZ.value = obj.position.z.toFixed(2);
    }

    const rotX = this.container.querySelector('#rot-x') as HTMLInputElement | null;
    const rotY = this.container.querySelector('#rot-y') as HTMLInputElement | null;
    const rotZ = this.container.querySelector('#rot-z') as HTMLInputElement | null;
    if (rotX && rotY && rotZ && document.activeElement !== rotX && document.activeElement !== rotY && document.activeElement !== rotZ) {
      rotX.value = THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(1);
      rotY.value = THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(1);
      rotZ.value = THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(1);
    }

    const sclX = this.container.querySelector('#scl-x') as HTMLInputElement | null;
    const sclY = this.container.querySelector('#scl-y') as HTMLInputElement | null;
    const sclZ = this.container.querySelector('#scl-z') as HTMLInputElement | null;
    if (sclX && sclY && sclZ && document.activeElement !== sclX && document.activeElement !== sclY && document.activeElement !== sclZ) {
      sclX.value = obj.scale.x.toFixed(2);
      sclY.value = obj.scale.y.toFixed(2);
      sclZ.value = obj.scale.z.toFixed(2);
    }
  }
}
