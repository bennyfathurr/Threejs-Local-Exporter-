import * as THREE from 'three';

export interface CloneOptions {
  targetNode: THREE.Object3D;
  scope: 'full' | 'subtree' | 'selectedOnly';
  excludeHidden?: boolean;
  preserveWorldTransform?: boolean;
}

/**
 * Deep clones the target subtree or single node for export,
 * stripping preview helpers and ensuring the live scene is untouched.
 */
export function cloneForExport(options: CloneOptions): THREE.Object3D {
  const { targetNode, scope, excludeHidden = false, preserveWorldTransform = true } = options;

  targetNode.updateMatrixWorld(true);

  let clonedRoot: THREE.Object3D;

  if (scope === 'selectedOnly') {
    // Clone single node without its children
    clonedRoot = targetNode.clone(false);
    if (preserveWorldTransform) {
      clonedRoot.applyMatrix4(targetNode.matrixWorld);
    }
  } else {
    // Clone node with all descendants
    clonedRoot = targetNode.clone(true);
    if (preserveWorldTransform && targetNode.parent) {
      // Re-apply world transform to cloned root so local coordinates match world space
      clonedRoot.position.setFromMatrixPosition(targetNode.matrixWorld);
      clonedRoot.quaternion.setFromRotationMatrix(targetNode.matrixWorld);
      clonedRoot.scale.setFromMatrixScale(targetNode.matrixWorld);
    }
  }

  // Filter out editor helpers or invisible items if required
  pruneExportTree(clonedRoot, excludeHidden);

  clonedRoot.updateMatrixWorld(true);
  return clonedRoot;
}

/**
 * Recursively prunes helper objects, cameras, lights (unless explicitly preserved),
 * and optionally hidden objects.
 */
function pruneExportTree(root: THREE.Object3D, excludeHidden: boolean) {
  const toRemove: THREE.Object3D[] = [];

  root.traverse((obj) => {
    // Don't remove the root itself here
    if (obj === root) return;

    if (obj.userData?.isEditorHelper || obj.name?.startsWith('__helper_')) {
      toRemove.push(obj);
      return;
    }

    if (excludeHidden && !obj.visible) {
      toRemove.push(obj);
      return;
    }
  });

  toRemove.forEach((obj) => {
    if (obj.parent) {
      obj.parent.remove(obj);
    }
  });
}
