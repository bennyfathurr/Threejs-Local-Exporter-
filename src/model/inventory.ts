import * as THREE from 'three';

export interface ModelInventoryItem {
  uuid: string;
  name: string;
  type: string;
  parentUuid?: string;
  visible: boolean;
  isMesh: boolean;
  isSkinnedMesh: boolean;
  geometryUuid?: string;
  materialUuids: string[];
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  vertexCount?: number;
  triangleCount?: number;
  childrenUuids: string[];
}

export interface ModelSceneStats {
  totalObjects: number;
  groupCount: number;
  meshCount: number;
  skinnedMeshCount: number;
  materialCount: number;
  textureCount: number;
  totalVertices: number;
  totalTriangles: number;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
}

/**
 * Builds an inventory and statistical summary of a THREE.Object3D hierarchy.
 */
export function buildInventory(root: THREE.Object3D): {
  items: Map<string, ModelInventoryItem>;
  rootUuid: string;
  stats: ModelSceneStats;
} {
  const items = new Map<string, ModelInventoryItem>();
  const uniqueMaterials = new Set<string>();
  const uniqueTextures = new Set<string>();

  let totalVertices = 0;
  let totalTriangles = 0;
  let groupCount = 0;
  let meshCount = 0;
  let skinnedMeshCount = 0;

  root.traverse((obj) => {
    const isMesh = (obj as THREE.Mesh).isMesh === true;
    const isSkinnedMesh = (obj as THREE.SkinnedMesh).isSkinnedMesh === true;

    if (obj.type === 'Group') {
      groupCount++;
    }
    if (isMesh) {
      meshCount++;
    }
    if (isSkinnedMesh) {
      skinnedMeshCount++;
    }

    let vertexCount = 0;
    let triangleCount = 0;
    let geometryUuid: string | undefined;
    const materialUuids: string[] = [];

    if (isMesh) {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) {
        geometryUuid = mesh.geometry.uuid;
        const posAttr = mesh.geometry.getAttribute('position');
        if (posAttr) {
          vertexCount = posAttr.count;
          if (mesh.geometry.index) {
            triangleCount = Math.floor(mesh.geometry.index.count / 3);
          } else {
            triangleCount = Math.floor(posAttr.count / 3);
          }
          totalVertices += vertexCount;
          totalTriangles += triangleCount;
        }
      }

      // Collect materials and textures
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (mat) {
          materialUuids.push(mat.uuid);
          uniqueMaterials.add(mat.uuid);

          // Check standard texture maps
          const stdMat = mat as unknown as Record<string, unknown>;
          ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach((prop) => {
            const tex = stdMat[prop] as THREE.Texture | undefined;
            if (tex && tex.isTexture) {
              uniqueTextures.add(tex.uuid);
            }
          });
        }
      });
    }

    const item: ModelInventoryItem = {
      uuid: obj.uuid,
      name: obj.name || `Object_${obj.id}`,
      type: obj.type,
      parentUuid: obj.parent ? obj.parent.uuid : undefined,
      visible: obj.visible,
      isMesh,
      isSkinnedMesh,
      geometryUuid,
      materialUuids,
      position: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      vertexCount: isMesh ? vertexCount : undefined,
      triangleCount: isMesh ? triangleCount : undefined,
      childrenUuids: obj.children.map((c) => c.uuid),
    };

    items.set(obj.uuid, item);
  });

  // Calculate overall bounding box
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);

  const stats: ModelSceneStats = {
    totalObjects: items.size,
    groupCount,
    meshCount,
    skinnedMeshCount,
    materialCount: uniqueMaterials.size,
    textureCount: uniqueTextures.size,
    totalVertices,
    totalTriangles,
    boundingBox: {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
      size: [size.x, size.y, size.z],
    },
  };

  return {
    items,
    rootUuid: root.uuid,
    stats,
  };
}
