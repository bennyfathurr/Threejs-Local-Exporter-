import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

export interface StlExportOptions {
  binary?: boolean;
}

/**
 * Exports a THREE.Object3D hierarchy to STL format (binary or ASCII).
 */
export function exportStl(
  root: THREE.Object3D,
  options?: StlExportOptions
): Blob {
  const exporter = new STLExporter();
  const binary = options?.binary ?? true;
  const result = exporter.parse(root, { binary });

  if (binary) {
    const buffer = result instanceof DataView ? result.buffer : (result as unknown as ArrayBuffer);
    return new Blob([buffer as ArrayBuffer], { type: 'application/octet-stream' });
  } else {
    return new Blob([result as string], { type: 'text/plain' });
  }
}
