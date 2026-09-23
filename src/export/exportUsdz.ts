import * as THREE from 'three';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';

export interface UsdzExportOptions {
  maxTextureSize?: number;
  quickLookCompatible?: boolean;
}

/**
 * Prepares and exports a THREE.Object3D hierarchy to Apple USDZ format.
 * Converts any non-PBR or unsupported custom materials into compatible
 * MeshStandardMaterial instances to ensure Apple Quick Look compatibility.
 */
export async function exportUsdz(
  root: THREE.Object3D,
  options?: UsdzExportOptions
): Promise<Blob> {
  // USDZExporter requires world matrices to be current
  root.updateMatrixWorld(true);

  // Convert unsupported materials on a shallow copy of material refs
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => ensureUsdzMaterial(m));
      } else if (mesh.material) {
        mesh.material = ensureUsdzMaterial(mesh.material);
      }
    }
  });

  const exporter = new USDZExporter();
  const exporterOptions = {
    maxTextureSize: options?.maxTextureSize ?? 2048,
    quickLookCompatible: options?.quickLookCompatible ?? true,
  };

  const result = await exporter.parseAsync(root, exporterOptions);
  return new Blob([result as unknown as BlobPart], { type: 'model/vnd.usdz+zip' });
}

function ensureUsdzMaterial(material: THREE.Material): THREE.Material {
  if (material.type === 'MeshStandardMaterial' || material.type === 'MeshPhysicalMaterial') {
    return material;
  }

  // Convert Basic, Lambert, Phong, or custom ShaderMaterial to standard PBR
  const color = (material as unknown as { color?: THREE.Color }).color || new THREE.Color(0xcccccc);
  const opacity = material.opacity !== undefined ? material.opacity : 1.0;
  const transparent = material.transparent || opacity < 1.0;

  const pbr = new THREE.MeshStandardMaterial({
    name: `${material.name || 'Mat'}_PBR_Compat`,
    color: color,
    roughness: 0.5,
    metalness: 0.1,
    opacity: opacity,
    transparent: transparent,
  });

  return pbr;
}
