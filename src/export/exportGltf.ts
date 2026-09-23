import * as THREE from 'three';
import { GLTFExporter, GLTFExporterOptions } from 'three/addons/exporters/GLTFExporter.js';

export interface GltfExportOptions {
  onlyVisible?: boolean;
  truncateDrawRange?: boolean;
  embedImages?: boolean;
}

/**
 * Exports a THREE.Object3D hierarchy to formatted JSON .gltf Blob.
 */
export async function exportGltf(
  root: THREE.Object3D,
  options?: GltfExportOptions
): Promise<Blob> {
  const exporter = new GLTFExporter();
  const exporterOptions: GLTFExporterOptions = {
    binary: false,
    onlyVisible: options?.onlyVisible ?? false,
    truncateDrawRange: options?.truncateDrawRange ?? true,
    embedImages: options?.embedImages ?? true,
  };

  const result = await exporter.parseAsync(root, exporterOptions);
  const jsonString = JSON.stringify(result, null, 2);
  return new Blob([jsonString], { type: 'model/gltf+json' });
}
