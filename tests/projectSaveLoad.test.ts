import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  exportModelToProjectJSON,
  loadModelFromProjectJSON,
  saveModelDraftToStorage,
  hasModelDraftInStorage,
  getModelDraftMetadata,
  loadModelDraftFromStorage,
  clearModelDraftInStorage,
  STORAGE_DRAFT_KEY,
  STORAGE_METADATA_KEY,
} from '../src/model/projectSaveLoad';
import { createMuseumSMB2Model } from '../src/models/createMuseumSMB2Model';
import { validateExport } from '../src/export/validation';

describe('Project & Model Save / Load Suite', () => {
  // In-memory localStorage mock for node test environment
  const storageMap = new Map<string, string>();

  beforeEach(() => {
    storageMap.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storageMap.get(key) || null,
      setItem: (key: string, val: string) => storageMap.set(key, val),
      removeItem: (key: string) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serializes a model to a structured project JSON manifest', () => {
    const group = new THREE.Group();
    group.name = 'Test_Save_Compound';

    const mesh1 = new THREE.Mesh(
      new THREE.BoxGeometry(2, 4, 6),
      new THREE.MeshStandardMaterial({ name: 'Mat_Wall', color: 0x38bdf8 })
    );
    mesh1.name = 'Wall_Segment_Alpha';
    mesh1.position.set(1, 2, 3);
    group.add(mesh1);

    const jsonString = exportModelToProjectJSON(group, { author: 'Unit_Tester' });
    expect(jsonString).toBeDefined();

    const parsed = JSON.parse(jsonString);
    expect(parsed.format).toBe('threejs-local-exporter-project');
    expect(parsed.version).toBe(1);
    expect(parsed.name).toBe('Test_Save_Compound');
    expect(parsed.metadata.meshCount).toBe(1);
    expect(parsed.metadata.author).toBe('Unit_Tester');
    expect(parsed.scene).toBeDefined();
    expect(parsed.scene.object).toBeDefined();
  });

  it('restores a model from project JSON manifest with 100% hierarchy and transform fidelity', () => {
    const original = new THREE.Group();
    original.name = 'Monument_Root';

    const baseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1, 10),
      new THREE.MeshStandardMaterial({ name: 'Mat_Base', color: 0x1e293b, roughness: 0.9 })
    );
    baseMesh.name = 'Plaza_Base';
    original.add(baseMesh);

    const columnMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 4, 16),
      new THREE.MeshStandardMaterial({ name: 'Mat_Col', color: 0xffffff, metalness: 0.1 })
    );
    columnMesh.name = 'Pillar_01';
    columnMesh.position.set(3, 2, 3);
    columnMesh.rotation.y = Math.PI / 4;
    original.add(columnMesh);

    const jsonString = exportModelToProjectJSON(original);
    const restored = loadModelFromProjectJSON(jsonString);

    expect(restored).toBeInstanceOf(THREE.Object3D);
    expect(restored.name).toBe('Monument_Root');

    const restoredPillar = restored.getObjectByName('Pillar_01') as THREE.Mesh;
    expect(restoredPillar).toBeDefined();
    expect(restoredPillar.position.x).toBeCloseTo(3, 3);
    expect(restoredPillar.position.y).toBeCloseTo(2, 3);
    expect(restoredPillar.position.z).toBeCloseTo(3, 3);
    expect(restoredPillar.rotation.y).toBeCloseTo(Math.PI / 4, 3);

    const mat = restoredPillar.material as THREE.MeshStandardMaterial;
    expect(mat.name).toBe('Mat_Col');
  });

  it('deserializes raw Three.js Object3D JSON cleanly', () => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 16),
      new THREE.MeshStandardMaterial({ name: 'Mat_Sphere', color: 0x10b981 })
    );
    mesh.name = 'StandAlone_Sphere';

    const rawJson = mesh.toJSON();
    const loaded = loadModelFromProjectJSON(rawJson);

    expect(loaded).toBeDefined();
    expect(loaded.name).toBe('StandAlone_Sphere');
    expect((loaded as THREE.Mesh).geometry).toBeDefined();
  });

  it('handles procedural heritage model Museum SMB II serialization round-trip', () => {
    const museum = createMuseumSMB2Model();
    const initialMeshCount = museum.children.flatMap((c) => {
      const meshes: THREE.Mesh[] = [];
      c.traverse((n) => {
        if ((n as THREE.Mesh).isMesh) meshes.push(n as THREE.Mesh);
      });
      return meshes;
    }).length;

    const json = exportModelToProjectJSON(museum);
    const restored = loadModelFromProjectJSON(json);

    let restoredMeshCount = 0;
    restored.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) restoredMeshCount++;
    });

    expect(restoredMeshCount).toBeGreaterThanOrEqual(100);
    expect(restored.name).toBe('Museum_SMB2_Root');
  });

  it('saves and restores drafts to localStorage', () => {
    const model = new THREE.Group();
    model.name = 'Palembang_Waterfront_Draft';
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5));
    mesh.name = 'Box_Main';
    model.add(mesh);

    expect(hasModelDraftInStorage()).toBe(false);
    expect(loadModelDraftFromStorage()).toBeNull();

    const saveResult = saveModelDraftToStorage(model);
    expect(saveResult.success).toBe(true);
    expect(hasModelDraftInStorage()).toBe(true);

    const meta = getModelDraftMetadata();
    expect(meta).not.toBeNull();
    expect(meta?.name).toBe('Palembang_Waterfront_Draft');
    expect(meta?.sizeBytes).toBeGreaterThan(0);

    const restoredDraft = loadModelDraftFromStorage();
    expect(restoredDraft).not.toBeNull();
    expect(restoredDraft?.name).toBe('Palembang_Waterfront_Draft');
    expect(restoredDraft?.model.getObjectByName('Box_Main')).toBeDefined();

    clearModelDraftInStorage();
    expect(hasModelDraftInStorage()).toBe(false);
    expect(loadModelDraftFromStorage()).toBeNull();
  });

  it('validates export using the new json format option', () => {
    const model = new THREE.Group();
    model.name = 'JSON_Export_Target';
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    model.add(mesh);

    const report = validateExport(model, 'json', 'full');
    expect(report.canExport).toBe(true);
    expect(report.format).toBe('json');
    expect(report.issues.some((i) => i.title.includes('Three.js Project'))).toBe(true);
  });

  it('throws informative error when parsing corrupted JSON', () => {
    expect(() => loadModelFromProjectJSON('invalid { json')).toThrow(/Invalid JSON/);
    expect(() => loadModelFromProjectJSON('{"randomKey": 123}')).toThrow(/Unrecognized JSON 3D format/);
  });
});
