import * as THREE from 'three';
import { exportGlb, GlbExportOptions } from '../export/exportGlb';
import { downloadFile } from '../export/download';
import { loadGlbFromFile, loadModelFromTsJsFile } from './loadFactory';
import { buildInventory } from './inventory';

export interface ThreejsProjectManifest {
  format: 'threejs-local-exporter-project';
  version: 1;
  generator: string;
  name: string;
  timestamp: number;
  metadata: {
    meshCount: number;
    nodeCount: number;
    triangles: number;
    materials: number;
    dimensions: [number, number, number];
    [key: string]: unknown;
  };
  scene: Record<string, unknown>;
}

export const STORAGE_DRAFT_KEY = 'threejs_exporter_autosave_draft';
export const STORAGE_METADATA_KEY = 'threejs_exporter_autosave_meta';

/**
 * Serializes a Three.js Object3D scene hierarchy to a formatted JSON project manifest.
 */
export function exportModelToProjectJSON(
  root: THREE.Object3D,
  customMetadata: Record<string, unknown> = {}
): string {
  const { stats } = buildInventory(root);
  const sceneJson = root.toJSON() as unknown as Record<string, unknown>;

  const manifest: ThreejsProjectManifest = {
    format: 'threejs-local-exporter-project',
    version: 1,
    generator: 'Three.js Local Exporter',
    name: root.name || 'Procedural_Model',
    timestamp: Date.now(),
    metadata: {
      meshCount: stats.meshCount,
      nodeCount: stats.totalObjects,
      triangles: stats.totalTriangles,
      materials: stats.materialCount,
      dimensions: stats.boundingBox.size,
      ...customMetadata,
    },
    scene: sceneJson,
  };

  return JSON.stringify(manifest, null, 2);
}

/**
 * Loads and reconstructs a THREE.Object3D hierarchy from a project JSON string or Object3D JSON object.
 */
export function loadModelFromProjectJSON(
  input: string | Record<string, unknown> | object
): THREE.Object3D {
  let parsed: Record<string, unknown>;

  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input) as Record<string, unknown>;
    } catch (err) {
      throw new Error(`Invalid JSON format: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    parsed = input as Record<string, unknown>;
  }

  // Check if this is a ThreejsProjectManifest or direct Three.js scene/object JSON
  let scenePayload: Record<string, unknown>;
  let modelName = 'Imported_Project_Model';

  if (parsed.format === 'threejs-local-exporter-project' && parsed.scene) {
    scenePayload = parsed.scene as Record<string, unknown>;
    if (typeof parsed.name === 'string' && parsed.name.trim()) {
      modelName = parsed.name.trim();
    }
  } else if (parsed.object || parsed.geometries || parsed.materials) {
    // Direct Three.js Object3D/Scene JSON
    scenePayload = parsed;
    const innerObj = parsed.object as Record<string, unknown> | undefined;
    if (innerObj && typeof innerObj.name === 'string' && innerObj.name.trim()) {
      modelName = innerObj.name.trim();
    }
  } else {
    throw new Error('Unrecognized JSON 3D format. Expected Three.js Object3D or Project JSON.');
  }

  const loader = new THREE.ObjectLoader();
  const loadedObject = loader.parse(scenePayload);

  if (!loadedObject.name || loadedObject.name === 'Scene') {
    loadedObject.name = modelName;
  }

  return loadedObject;
}

/**
 * Triggers a browser download of the current scene as a .project.json file.
 */
export function downloadModelAsProjectFile(
  root: THREE.Object3D,
  filename?: string,
  metadata?: Record<string, unknown>
): void {
  const jsonString = exportModelToProjectJSON(root, metadata);
  const baseName = (filename || root.name || 'procedural_model')
    .replace(/\s+/g, '_')
    .replace(/\.json$/i, '');
  downloadFile(jsonString, `${baseName}.project.json`, 'application/json');
}

/**
 * Triggers a browser download of the current scene as a binary .glb file.
 */
export async function downloadModelAsGlb(
  root: THREE.Object3D,
  filename?: string,
  options?: GlbExportOptions
): Promise<void> {
  const blob = await exportGlb(root, options);
  const baseName = (filename || root.name || 'procedural_model')
    .replace(/\s+/g, '_')
    .replace(/\.glb$/i, '');
  downloadFile(blob, `${baseName}.glb`, 'model/gltf-binary');
}

/**
 * Saves the current model state into localStorage as a recovery draft.
 */
export function saveModelDraftToStorage(root: THREE.Object3D): {
  success: boolean;
  timestamp: number;
  error?: string;
} {
  try {
    const jsonString = exportModelToProjectJSON(root);
    const meta = {
      name: root.name || 'Draft_Model',
      timestamp: Date.now(),
      sizeBytes: jsonString.length,
    };

    localStorage.setItem(STORAGE_DRAFT_KEY, jsonString);
    localStorage.setItem(STORAGE_METADATA_KEY, JSON.stringify(meta));

    return { success: true, timestamp: meta.timestamp };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Failed to save draft to localStorage:', msg);
    return { success: false, timestamp: Date.now(), error: msg };
  }
}

/**
 * Checks whether a saved draft exists in localStorage.
 */
export function hasModelDraftInStorage(): boolean {
  try {
    return Boolean(localStorage.getItem(STORAGE_DRAFT_KEY));
  } catch {
    return false;
  }
}

/**
 * Retrieves the draft metadata without parsing the entire scene.
 */
export function getModelDraftMetadata(): { name: string; timestamp: number; sizeBytes: number } | null {
  try {
    const metaStr = localStorage.getItem(STORAGE_METADATA_KEY);
    if (!metaStr) return null;
    return JSON.parse(metaStr);
  } catch {
    return null;
  }
}

/**
 * Restores a saved draft from localStorage.
 */
export function loadModelDraftFromStorage(): {
  model: THREE.Object3D;
  name: string;
  timestamp: number;
} | null {
  try {
    const draftJson = localStorage.getItem(STORAGE_DRAFT_KEY);
    if (!draftJson) return null;

    const model = loadModelFromProjectJSON(draftJson);
    const meta = getModelDraftMetadata();

    return {
      model,
      name: meta?.name || model.name || 'Draft_Model',
      timestamp: meta?.timestamp || Date.now(),
    };
  } catch (err) {
    console.error('Failed to load draft from localStorage:', err);
    return null;
  }
}

/**
 * Clears the draft from localStorage.
 */
export function clearModelDraftInStorage(): void {
  try {
    localStorage.removeItem(STORAGE_DRAFT_KEY);
    localStorage.removeItem(STORAGE_METADATA_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Loads a model from any supported file (.json, .glb, .gltf, .ts, .js, .tsx, .jsx).
 */
export async function loadModelFromAnyFile(file: File): Promise<{
  model: THREE.Object3D;
  fileType: 'json' | 'glb' | 'gltf' | 'code';
  name: string;
}> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const cleanName = file.name.replace(/\.[^/.]+$/, '');

  if (ext === 'json') {
    const text = await file.text();
    const model = loadModelFromProjectJSON(text);
    if (!model.name || model.name === 'Imported_Project_Model' || model.name === 'Scene') {
      model.name = cleanName;
    }
    return { model, fileType: 'json', name: model.name };
  }

  if (ext === 'glb' || ext === 'gltf') {
    const model = await loadGlbFromFile(file);
    if (!model.name) model.name = cleanName;
    return { model, fileType: ext, name: model.name };
  }

  if (ext === 'ts' || ext === 'js' || ext === 'tsx' || ext === 'jsx') {
    const model = await loadModelFromTsJsFile(file);
    if (!model.name || model.name === 'Custom_Procedural_Model') {
      model.name = cleanName;
    }
    return { model, fileType: 'code', name: model.name };
  }

  throw new Error(
    `Unsupported file format ".${ext}". Please choose a 3D model (.glb, .gltf), project file (.json), or procedural script (.ts, .js).`
  );
}
