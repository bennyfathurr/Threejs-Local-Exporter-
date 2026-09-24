import * as THREE from 'three';

export interface SelectionManager {
  selectedObject: THREE.Object3D | null;
  selectObject: (object: THREE.Object3D | null) => void;
  selectParent: () => void;
  selectDescendants: () => THREE.Object3D[];
  hideSelected: () => void;
  toggleLockSelected: () => boolean;
  isLocked: (object: THREE.Object3D) => boolean;
  isSoloed: (object: THREE.Object3D) => boolean;
  soloObject: (object: THREE.Object3D | null) => void;
  refreshHighlight: () => void;
  dispose: () => void;
}

export function createSelectionManager(
  container: HTMLElement,
  cameraProvider: () => THREE.Camera,
  modelRootProvider: () => THREE.Object3D,
  scene: THREE.Scene,
  onSelectionChange: (object: THREE.Object3D | null) => void,
  isGizmoInteracting?: () => boolean
): SelectionManager {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let selectedObject: THREE.Object3D | null = null;
  let soloedObject: THREE.Object3D | null = null;
  const lockedUuids = new Set<string>();

  // Visual selection indicator using non-destructive BoxHelper
  let highlightBox: THREE.BoxHelper | null = null;

  const updateHighlight = () => {
    if (highlightBox) {
      scene.remove(highlightBox);
      highlightBox.dispose();
      highlightBox = null;
    }

    if (selectedObject && selectedObject.visible) {
      highlightBox = new THREE.BoxHelper(selectedObject, 0x38bdf8); // Vibrant cyan
      highlightBox.userData = { isEditorHelper: true };
      (highlightBox.material as THREE.LineBasicMaterial).depthTest = false;
      (highlightBox.material as THREE.LineBasicMaterial).transparent = true;
      (highlightBox.material as THREE.LineBasicMaterial).linewidth = 2;
      highlightBox.renderOrder = 999;
      scene.add(highlightBox);
    }
  };

  const selectObject = (object: THREE.Object3D | null) => {
    if (object && lockedUuids.has(object.uuid)) {
      // Locked objects cannot be clicked/selected directly
      return;
    }
    selectedObject = object;
    updateHighlight();
    onSelectionChange(selectedObject);
  };

  const isLocked = (object: THREE.Object3D): boolean => {
    return lockedUuids.has(object.uuid);
  };

  const toggleLockSelected = (): boolean => {
    if (!selectedObject) return false;
    if (lockedUuids.has(selectedObject.uuid)) {
      lockedUuids.delete(selectedObject.uuid);
      return false;
    } else {
      lockedUuids.add(selectedObject.uuid);
      return true;
    }
  };

  const isSoloed = (object: THREE.Object3D): boolean => {
    return soloedObject?.uuid === object.uuid;
  };

  const soloObject = (object: THREE.Object3D | null) => {
    const root = modelRootProvider();
    if (soloedObject?.uuid === object?.uuid || !object) {
      // Unsolo: restore all visibility
      soloedObject = null;
      root.traverse((obj) => {
        obj.visible = true;
      });
    } else {
      // Solo: hide everything except object and its ancestors/descendants
      soloedObject = object;
      const keepVisible = new Set<string>();

      // Ancestors
      let curr: THREE.Object3D | null = object;
      while (curr) {
        keepVisible.add(curr.uuid);
        curr = curr.parent;
      }

      // Descendants
      object.traverse((desc) => {
        keepVisible.add(desc.uuid);
      });

      root.traverse((obj) => {
        if (obj === root) return;
        obj.visible = keepVisible.has(obj.uuid);
      });
    }
    updateHighlight();
  };

  const selectParent = () => {
    if (!selectedObject || !selectedObject.parent) return;
    const modelRoot = modelRootProvider();
    if (selectedObject.parent === modelRoot || selectedObject === modelRoot) return;
    selectObject(selectedObject.parent);
  };

  const selectDescendants = (): THREE.Object3D[] => {
    if (!selectedObject) return [];
    const descendants: THREE.Object3D[] = [];
    selectedObject.traverse((child) => {
      if (child !== selectedObject) {
        descendants.push(child);
      }
    });
    return descendants;
  };

  const hideSelected = () => {
    if (!selectedObject) return;
    selectedObject.visible = !selectedObject.visible;
    updateHighlight();
  };

  const refreshHighlight = () => {
    if (highlightBox && selectedObject) {
      highlightBox.update();
    } else {
      updateHighlight();
    }
  };

  // Pointer event handling for 3D picking
  let pointerDownPos = { x: 0, y: 0 };
  const onPointerDown = (e: MouseEvent) => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: MouseEvent) => {
    if (isGizmoInteracting && isGizmoInteracting()) return;

    // Only register click if pointer did not drag
    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (dist > 5) return;

    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const camera = cameraProvider();
    raycaster.setFromCamera(mouse, camera);

    const modelRoot = modelRootProvider();
    const intersects = raycaster.intersectObject(modelRoot, true);

    const validHit = intersects.find((hit) => {
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        if (lockedUuids.has(node.uuid)) return false;
        node = node.parent;
      }
      return hit.object.visible && !hit.object.userData?.isEditorHelper;
    });

    if (validHit) {
      selectObject(validHit.object);
    } else {
      selectObject(null);
    }
  };

  container.addEventListener('mousedown', onPointerDown);
  container.addEventListener('mouseup', onPointerUp);

  const dispose = () => {
    container.removeEventListener('mousedown', onPointerDown);
    container.removeEventListener('mouseup', onPointerUp);
    if (highlightBox) {
      scene.remove(highlightBox);
      highlightBox.dispose();
    }
  };

  return {
    get selectedObject() {
      return selectedObject;
    },
    selectObject,
    selectParent,
    selectDescendants,
    hideSelected,
    toggleLockSelected,
    isLocked,
    isSoloed,
    soloObject,
    refreshHighlight,
    dispose,
  };
}
