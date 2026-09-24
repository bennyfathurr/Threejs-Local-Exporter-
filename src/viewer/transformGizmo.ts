import * as THREE from 'three';
import { TransformControls, TransformControlsMode } from 'three/addons/controls/TransformControls.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface TransformGizmoOptions {
  scene: THREE.Scene;
  cameraProvider: () => THREE.Camera;
  domElement: HTMLElement;
  orbitControls: OrbitControls;
  container: HTMLElement;
  onTransformStart?: (object: THREE.Object3D) => void;
  onTransformChange?: (object: THREE.Object3D) => void;
  onTransformEnd?: (object: THREE.Object3D) => void;
  onModeChange?: (mode: TransformControlsMode) => void;
  onSpaceChange?: (space: 'world' | 'local') => void;
}

export interface TransformGizmoManager {
  readonly controls: TransformControls;
  readonly helper: THREE.Object3D;
  readonly mode: TransformControlsMode;
  readonly space: 'world' | 'local';
  readonly snapEnabled: boolean;
  readonly isDragging: boolean;
  readonly isHovered: boolean;
  readonly attachedObject: THREE.Object3D | null;

  attach: (object: THREE.Object3D | null) => void;
  detach: () => void;
  setMode: (mode: TransformControlsMode) => void;
  setSpace: (space: 'world' | 'local') => void;
  toggleSpace: () => 'world' | 'local';
  setSnapEnabled: (enabled: boolean) => void;
  toggleSnap: () => boolean;
  setVisible: (visible: boolean) => void;
  updateCamera: (camera: THREE.Camera) => void;
  isInteracting: () => boolean;
  dispose: () => void;
}

export function createTransformGizmo(options: TransformGizmoOptions): TransformGizmoManager {
  const {
    scene,
    cameraProvider,
    domElement,
    orbitControls,
    container,
    onTransformStart,
    onTransformChange,
    onTransformEnd,
    onModeChange,
    onSpaceChange,
  } = options;

  let currentMode: TransformControlsMode = 'translate';
  let currentSpace: 'world' | 'local' = 'world';
  let snapEnabled = false;
  let isDragging = false;
  let isHovered = false;
  let attachedObject: THREE.Object3D | null = null;
  let isGizmoVisible = true;

  // Snapping constants
  const TRANSLATE_SNAP = 0.5; // 0.5 scene units
  const ROTATE_SNAP = THREE.MathUtils.degToRad(15); // 15 degrees
  const SCALE_SNAP = 0.25;

  // 1. Initialize Three.js TransformControls
  const tc = new TransformControls(cameraProvider(), domElement);
  tc.size = 0.85;
  tc.setSpace(currentSpace);
  tc.setMode(currentMode);

  // Modern Three.js returns a TransformControlsRoot via getHelper()
  const helper = tc.getHelper();
  helper.userData = { isEditorHelper: true };
  scene.add(helper);

  // 2. Create Floating Realtime Drag HUD
  const hud = document.createElement('div');
  hud.className = 'gizmo-drag-hud';
  hud.style.display = 'none';
  hud.innerHTML = `
    <div class="hud-mode-badge" id="hud-badge">✛ MOVE</div>
    <div class="hud-axis-tag" id="hud-axis">X</div>
    <div class="hud-coords" id="hud-coords">X: 0.00m Y: 0.00m Z: 0.00m</div>
  `;
  container.appendChild(hud);

  const hudBadge = hud.querySelector('#hud-badge') as HTMLElement;
  const hudAxis = hud.querySelector('#hud-axis') as HTMLElement;
  const hudCoords = hud.querySelector('#hud-coords') as HTMLElement;
  let hudHideTimeout: number | null = null;

  const updateHud = () => {
    if (!attachedObject) return;
    const axis = tc.axis || 'XYZ';
    hudAxis.textContent = axis;
    hudAxis.className = `hud-axis-tag axis-${axis.toLowerCase()}`;

    if (currentMode === 'translate') {
      hudBadge.innerHTML = '✛ MOVE';
      const pos = attachedObject.position;
      hudCoords.innerHTML = `<span class="val-x">X: ${pos.x.toFixed(2)}m</span> <span class="val-y">Y: ${pos.y.toFixed(2)}m</span> <span class="val-z">Z: ${pos.z.toFixed(2)}m</span>`;
    } else if (currentMode === 'rotate') {
      hudBadge.innerHTML = '🔄 ROTATE';
      const degX = THREE.MathUtils.radToDeg(attachedObject.rotation.x).toFixed(1);
      const degY = THREE.MathUtils.radToDeg(attachedObject.rotation.y).toFixed(1);
      const degZ = THREE.MathUtils.radToDeg(attachedObject.rotation.z).toFixed(1);
      hudCoords.innerHTML = `<span class="val-x">X: ${degX}°</span> <span class="val-y">Y: ${degY}°</span> <span class="val-z">Z: ${degZ}°</span>`;
    } else if (currentMode === 'scale') {
      hudBadge.innerHTML = '⤢ SCALE';
      const scl = attachedObject.scale;
      hudCoords.innerHTML = `<span class="val-x">X: ${scl.x.toFixed(2)}</span> <span class="val-y">Y: ${scl.y.toFixed(2)}</span> <span class="val-z">Z: ${scl.z.toFixed(2)}</span>`;
    }
  };

  const showHud = () => {
    if (hudHideTimeout) {
      clearTimeout(hudHideTimeout);
      hudHideTimeout = null;
    }
    updateHud();
    hud.style.display = 'flex';
    hud.style.opacity = '1';
  };

  const hideHud = () => {
    hudHideTimeout = window.setTimeout(() => {
      hud.style.opacity = '0';
      setTimeout(() => {
        if (!isDragging) hud.style.display = 'none';
      }, 200);
    }, 400);
  };

  // 3. Event Listeners on TransformControls
  tc.addEventListener('dragging-changed', (event: { value: unknown }) => {
    isDragging = Boolean(event.value);
    orbitControls.enabled = !isDragging; // Prevent orbiting camera while dragging gizmo

    if (isDragging) {
      showHud();
      if (attachedObject) onTransformStart?.(attachedObject);
    } else {
      hideHud();
      if (attachedObject) onTransformEnd?.(attachedObject);
    }
  });

  tc.addEventListener('change', () => {
    if (attachedObject && isDragging) {
      updateHud();
      onTransformChange?.(attachedObject);
    }
  });

  tc.addEventListener('axis-changed', (event: { value: unknown }) => {
    isHovered = event.value !== null && event.value !== undefined;
  });

  // 4. Snapping helper
  const applySnapping = () => {
    if (snapEnabled) {
      tc.setTranslationSnap(TRANSLATE_SNAP);
      tc.setRotationSnap(ROTATE_SNAP);
      tc.setScaleSnap(SCALE_SNAP);
    } else {
      tc.setTranslationSnap(null);
      tc.setRotationSnap(null);
      tc.setScaleSnap(null);
    }
  };

  // 5. Operations
  const attach = (object: THREE.Object3D | null) => {
    if (object && object.visible && isGizmoVisible) {
      attachedObject = object;
      tc.attach(object);
      helper.visible = true;
    } else {
      attachedObject = null;
      tc.detach();
      helper.visible = false;
      hud.style.display = 'none';
    }
  };

  const detach = () => {
    attach(null);
  };

  const setMode = (mode: TransformControlsMode) => {
    currentMode = mode;
    tc.setMode(mode);
    onModeChange?.(mode);
    if (isDragging) updateHud();
  };

  const setSpace = (space: 'world' | 'local') => {
    currentSpace = space;
    tc.setSpace(space);
    onSpaceChange?.(space);
  };

  const toggleSpace = (): 'world' | 'local' => {
    const next = currentSpace === 'world' ? 'local' : 'world';
    setSpace(next);
    return next;
  };

  const setSnapEnabled = (enabled: boolean) => {
    snapEnabled = enabled;
    applySnapping();
  };

  const toggleSnap = (): boolean => {
    setSnapEnabled(!snapEnabled);
    return snapEnabled;
  };

  const setVisible = (visible: boolean) => {
    isGizmoVisible = visible;
    if (!visible) {
      tc.detach();
      helper.visible = false;
    } else if (attachedObject) {
      tc.attach(attachedObject);
      helper.visible = true;
    }
  };

  const updateCamera = (camera: THREE.Camera) => {
    tc.camera = camera;
  };

  const isInteracting = (): boolean => {
    return isDragging || isHovered || tc.axis !== null;
  };

  // 6. Global Unity Hotkeys (W, E, R, X, Q, Escape)
  const onKeyDown = (e: KeyboardEvent) => {
    const activeEl = document.activeElement;
    const tag = activeEl?.tagName?.toLowerCase();
    if (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      (activeEl as HTMLElement)?.isContentEditable
    ) {
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.key.toLowerCase()) {
      case 'w':
        setMode('translate');
        break;
      case 'e':
        setMode('rotate');
        break;
      case 'r':
        setMode('scale');
        break;
      case 'x':
        toggleSpace();
        break;
      case 'q':
        setVisible(!isGizmoVisible);
        break;
    }
  };

  window.addEventListener('keydown', onKeyDown);

  const dispose = () => {
    window.removeEventListener('keydown', onKeyDown);
    if (hudHideTimeout) clearTimeout(hudHideTimeout);
    hud.remove();
    tc.detach();
    tc.dispose();
    scene.remove(helper);
  };

  return {
    get controls() {
      return tc;
    },
    get helper() {
      return helper;
    },
    get mode() {
      return currentMode;
    },
    get space() {
      return currentSpace;
    },
    get snapEnabled() {
      return snapEnabled;
    },
    get isDragging() {
      return isDragging;
    },
    get isHovered() {
      return isHovered;
    },
    get attachedObject() {
      return attachedObject;
    },
    attach,
    detach,
    setMode,
    setSpace,
    toggleSpace,
    setSnapEnabled,
    toggleSnap,
    setVisible,
    updateCamera,
    isInteracting,
    dispose,
  };
}
