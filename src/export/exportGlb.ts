import * as THREE from 'three';
import { GLTFExporter, GLTFExporterOptions } from 'three/addons/exporters/GLTFExporter.js';

export interface GlbExportOptions {
  onlyVisible?: boolean;
  truncateDrawRange?: boolean;
  binary?: boolean;
  maxTextureSize?: number;
}

/**
 * Exports a THREE.Object3D hierarchy to a binary .glb Blob.
 */
export async function exportGlb(
  root: THREE.Object3D,
  options?: GlbExportOptions
): Promise<Blob> {
  const exporter = new GLTFExporter();
  const exporterOptions: GLTFExporterOptions = {
    binary: true,
    onlyVisible: options?.onlyVisible ?? false,
    truncateDrawRange: options?.truncateDrawRange ?? true,
    maxTextureSize: options?.maxTextureSize ?? 4096,
  };

  const result = await exporter.parseAsync(root, exporterOptions);
  return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
}
