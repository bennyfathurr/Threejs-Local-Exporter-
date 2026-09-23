import * as THREE from 'three';
import { SelectionManager } from '../viewer/selection';

export interface InspectorCallbacks {
  onFrameObject: (object: THREE.Object3D) => void;
  onTransformChange: (object: THREE.Object3D) => void;
  onExportSubtree: (object: THREE.Object3D) => void;
  onRefreshTree: () => void;
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
        </div>
      </div>
    `;
    this.container.appendChild(headerCard);

    // Wire header action buttons
    const nameInput = headerCard.querySelector('#inspector-name-input') as HTMLInputElement;
    nameInput.addEventListener('change', () => {
      obj.name = nameInput.value.trim() || obj.name;
      this.callbacks.onRefreshTree();
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
      this.selectionManager.hideSelected();
      this.update();
      this.callbacks.onRefreshTree();
    });

    // Transform Section
    const transformSection = document.createElement('div');
    transformSection.className = 'inspector-section';
    transformSection.innerHTML = `
      <div class="section-title">Transform</div>
      <div class="section-body">
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
      </div>
    `;
    this.container.appendChild(transformSection);

    // Hook inputs
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
      };

      elX.addEventListener('input', apply);
      elY.addEventListener('input', apply);
      elZ.addEventListener('input', apply);
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
}
