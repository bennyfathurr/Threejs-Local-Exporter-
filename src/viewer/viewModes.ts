import * as THREE from 'three';

export type ViewMode = 'material' | 'wireframe' | 'solid' | 'normals';

const solidMaterial = new THREE.MeshLambertMaterial({
  color: 0x94a3b8,
  wireframe: false,
});

const normalMaterial = new THREE.MeshNormalMaterial({
  wireframe: false,
});

/**
 * Manages viewport rendering modes: Material (Lit PBR), Wireframe, Solid, and Normals.
 */
export function applyViewMode(root: THREE.Object3D, mode: ViewMode) {
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;

      // Cache original material if not cached yet
      if (!mesh.userData.__origMaterial) {
        mesh.userData.__origMaterial = mesh.material;
      }

      switch (mode) {
        case 'material':
          mesh.material = mesh.userData.__origMaterial;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => {
              if ('wireframe' in m) (m as { wireframe: boolean }).wireframe = false;
            });
          } else if ('wireframe' in mesh.material) {
            (mesh.material as { wireframe: boolean }).wireframe = false;
          }
          break;

        case 'wireframe':
          mesh.material = mesh.userData.__origMaterial;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => {
              if ('wireframe' in m) (m as { wireframe: boolean }).wireframe = true;
            });
          } else if ('wireframe' in mesh.material) {
            (mesh.material as { wireframe: boolean }).wireframe = true;
          }
          break;

        case 'solid':
          mesh.material = solidMaterial;
          break;

        case 'normals':
          mesh.material = normalMaterial;
          break;
      }
    }
  });
}
