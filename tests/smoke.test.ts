import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createModel } from '../src/generated/createModel';
import { createDroneModel } from '../src/generated/createDroneModel';
import { createModel as createLakesideModel } from '../src/generated/createLakesideTownModel';
import { buildInventory } from '../src/model/inventory';
import { cloneForExport } from '../src/model/cloneForExport';
import { normalizeTransforms } from '../src/model/normalizeTransforms';
import { validateExport } from '../src/export/validation';
import { exportObjWithMtl } from '../src/export/exportObj';
import { exportStl } from '../src/export/exportStl';
import { exportPly } from '../src/export/exportPly';
import { executeProceduralCode } from '../src/model/codeRunner';
import JSZip from 'jszip';

describe('Procedural Model Factories Smoke Tests', () => {
  it('loads sample createModel() factory and returns a real scene hierarchy with >= 5 named parts', () => {
    const root = createModel();

    expect(root).toBeInstanceOf(THREE.Group);
    expect(root.name).toBe('Modern_Architectural_Compound');

    const namedMeshes: string[] = [];
    const namedGroups: string[] = [];

    root.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        namedMeshes.push(node.name);
        expect((node as THREE.Mesh).geometry).toBeDefined();
        expect((node as THREE.Mesh).material).toBeDefined();
      } else if (node.type === 'Group') {
        namedGroups.push(node.name);
      }
    });

    // Check requirement: at least 5 separately named parts
    expect(namedMeshes.length).toBeGreaterThanOrEqual(5);
    expect(namedGroups.length).toBeGreaterThanOrEqual(2);

    // Verify key expected named parts are present
    expect(namedMeshes).toContain('Foundation_Plinth');
    expect(namedMeshes).toContain('Ground_Floor_Walls');
    expect(namedMeshes).toContain('Curtain_Glass_Facade');
    expect(namedMeshes).toContain('Upper_Floor_Cantilever');
    expect(namedMeshes).toContain('Overhang_Roof_Slab');
  });

  it('loads secondary createDroneModel() factory with articulated pivots and sensor gimbal', () => {
    const drone = createDroneModel();

    expect(drone).toBeInstanceOf(THREE.Group);
    expect(drone.name).toBe('Autonomous_Survey_Drone');

    const parts: string[] = [];
    drone.traverse((node) => {
      if (node.name) parts.push(node.name);
    });

    expect(parts.length).toBeGreaterThanOrEqual(10);
    expect(parts).toContain('Central_Fuselage_Core');
    expect(parts).toContain('Chassis_Aerodynamic_Shell');
    expect(parts).toContain('MultiSensor_Gimbal_Assembly');
  });

  it('loads the four-view lakeside study with a dominant lake and shaped scene geometry', () => {
    const lakeside = createLakesideModel();
    expect(lakeside).toBeInstanceOf(THREE.Group);
    expect(lakeside.name).toBe('Kambang_Iwak_Draft_Model');

    const waterMesh = lakeside.getObjectByName('Lake_Water_Surface') as THREE.Mesh;
    const ground = lakeside.getObjectByName('Ground_Plate') as THREE.Mesh;
    expect(waterMesh).toBeDefined();
    expect((waterMesh.material as THREE.Material).side).toBe(THREE.DoubleSide);
    expect(waterMesh.position.y).toBeLessThan(ground.position.y);
    const landShape = (ground.geometry as THREE.ExtrudeGeometry).parameters.shapes as THREE.Shape;
    expect(landShape.holes.length).toBe(1);
    const facade = lakeside.getObjectByName('Northwest_Block_A_Recessed_Facade') as THREE.Mesh;
    const facadeShape = (facade.geometry as THREE.ExtrudeGeometry).parameters.shapes as THREE.Shape;
    expect(facadeShape.holes.length).toBeGreaterThan(2);
    const canopy = lakeside.getObjectByName('Peninsula_Tree_1_Canopy_Lobe_1') as THREE.Mesh;
    expect(canopy.geometry.type).toBe('BufferGeometry');
    expect(canopy.geometry.getAttribute('normal').count).toBeGreaterThan(100);

    const lakeGeometry = waterMesh.geometry as THREE.BufferGeometry;
    expect(lakeGeometry.getAttribute('position').count).toBeGreaterThan(100);
    expect(lakeside.getObjectByName('Continuous_Pedestrian_Loop')).toBeDefined();
    expect(lakeside.getObjectByName('Tree_Peninsula')).toBeDefined();
    expect(lakeside.getObjectByName('Bridge_Cambered_Deck')).toBeDefined();
    expect(lakeside.getObjectByName('Northwest_Block_A_Roof')).toBeDefined();
    expect(lakeside.getObjectByName('Peninsula_Tree_1_Canopy_Lobe_1')).toBeDefined();
    expect(lakeside.getObjectByName('Northwest_Block_A_Recessed_Facade')).toBeDefined();
    expect(lakeside.getObjectByName('Bridge_Deck_Plank_1')).toBeDefined();

    const buildings = lakeside.getObjectByName('Perimeter_Buildings') as THREE.Group;
    const trees = lakeside.getObjectByName('Tree_Canopies') as THREE.Group;
    expect(buildings.children.length).toBeGreaterThanOrEqual(20);
    expect(trees.children.length).toBeGreaterThan(55);
    const bounds = new THREE.Box3().setFromObject(lakeside);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(56, 0);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(30, 0);
    const stats = buildInventory(lakeside).stats;
    expect(stats.totalTriangles).toBeGreaterThan(85_000);
    expect(stats.totalTriangles).toBeLessThan(105_000);
    expect(stats.meshCount).toBeLessThan(1_300);
    expect(buildInventory(createLakesideModel()).stats.totalTriangles).toBe(stats.totalTriangles);
  });

  it('compiles and runs arbitrary user-supplied TypeScript code with THREE in browser sandbox', () => {
    const userTsCode = `
      import * as THREE from 'three';
      export function createModel(spec?: { parts?: number }) {
        const group = new THREE.Group();
        group.name = 'User_Generated_Compound';
        const count = spec?.parts ?? 3;
        for (let i = 0; i < count; i++) {
          const m = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ name: 'Mat_' + i, color: 0xff0000 })
          );
          m.name = 'Procedural_Part_' + (i + 1);
          m.position.x = i * 2;
          group.add(m);
        }
        return group;
      }
    `;

    const result = executeProceduralCode(userTsCode, { parts: 4 });

    expect(result.model).toBeInstanceOf(THREE.Group);
    expect(result.model.name).toBe('User_Generated_Compound');
    expect(result.model.children).toHaveLength(4);
    expect(result.model.children[0].name).toBe('Procedural_Part_1');
  });

});

describe('Hierarchy Inventory & Statistics Extraction', () => {
  it('builds full inventory with UUIDs, transforms, vertices, and triangle counts', () => {
    const root = createModel();
    const { items, rootUuid, stats } = buildInventory(root);

    expect(rootUuid).toBe(root.uuid);
    expect(items.size).toBeGreaterThan(10);
    expect(stats.meshCount).toBeGreaterThanOrEqual(5);
    expect(stats.totalVertices).toBeGreaterThan(100);
    expect(stats.totalTriangles).toBeGreaterThan(50);
    expect(stats.materialCount).toBeGreaterThanOrEqual(3);

    // Bounding box dimensions
    expect(stats.boundingBox.size[0]).toBeGreaterThan(0);
    expect(stats.boundingBox.size[1]).toBeGreaterThan(0);
    expect(stats.boundingBox.size[2]).toBeGreaterThan(0);

    // Verify inventory item shape matches spec
    const firstMeshUuid = Array.from(items.values()).find((i) => i.isMesh)?.uuid;
    expect(firstMeshUuid).toBeDefined();

    const item = items.get(firstMeshUuid!);
    expect(item).toBeDefined();
    expect(item?.uuid).toBe(firstMeshUuid);
    expect(item?.name).toBeTruthy();
    expect(item?.position).toHaveLength(3);
    expect(item?.rotation).toHaveLength(3);
    expect(item?.scale).toHaveLength(3);
    expect(item?.vertexCount).toBeGreaterThan(0);
    expect(item?.triangleCount).toBeGreaterThan(0);
  });
});

describe('Export Preparation & Transformation Normalization', () => {
  it('clones subtree non-destructively and strips preview helpers', () => {
    const root = createModel();
    const helperObj = new THREE.Object3D();
    helperObj.name = '__helper_grid';
    helperObj.userData = { isEditorHelper: true };
    root.add(helperObj);

    const cloned = cloneForExport({
      targetNode: root,
      scope: 'full',
      excludeHidden: false,
    });

    // Original scene retains helper
    expect(root.children.some((c) => c.userData.isEditorHelper)).toBe(true);

    // Cloned export root has helper stripped
    let hasHelperInClone = false;
    cloned.traverse((node) => {
      if (node.userData?.isEditorHelper || node.name?.startsWith('__helper_')) {
        hasHelperInClone = true;
      }
    });
    expect(hasHelperInClone).toBe(false);
  });

  it('normalizes transforms: centers origin, grounds base at Y=0, and applies unit scale', () => {
    const root = createModel();
    const normalized = normalizeTransforms(root, {
      centerModel: true,
      groundBase: true,
      unitScale: 'centimeters', // 100x scale
    });

    const box = new THREE.Box3().setFromObject(normalized);
    // Y min should be grounded at 0 (or close within floating point precision)
    expect(box.min.y).toBeCloseTo(0, 1);
    expect(normalized.scale.x).toBe(100);
  });
});

describe('Multi-Format Exporter Execution & ZIP Generation', () => {
  it('exports OBJ + companion MTL bundled into a ZIP archive', async () => {
    const root = createModel();
    const zipBlob = await exportObjWithMtl(root, 'villa_model');

    expect(zipBlob).toBeInstanceOf(Blob);
    expect(zipBlob.size).toBeGreaterThan(500);

    // Unpack ZIP to verify entries
    const zip = await JSZip.loadAsync(zipBlob);
    expect(zip.file('villa_model.obj')).not.toBeNull();
    expect(zip.file('villa_model.mtl')).not.toBeNull();

    const objContent = await zip.file('villa_model.obj')!.async('text');
    const mtlContent = await zip.file('villa_model.mtl')!.async('text');

    // OBJ must reference mtllib and have object records 'o' or group records 'g'
    expect(objContent).toContain('mtllib villa_model.mtl');
    expect(objContent).toMatch(/(o|g)\s+/);
    expect(objContent).toContain('o Foundation_Plinth');

    // MTL must contain material definitions
    expect(mtlContent).toContain('newmtl ');
    expect(mtlContent).toContain('Kd ');
  });

  it('exports binary STL', () => {
    const root = createModel();
    const stlBlob = exportStl(root, { binary: true });

    expect(stlBlob).toBeInstanceOf(Blob);
    expect(stlBlob.size).toBeGreaterThan(100);
  });

  it('exports binary PLY', () => {
    const root = createModel();
    const plyBlob = exportPly(root, { binary: true });

    expect(plyBlob).toBeInstanceOf(Blob);
    expect(plyBlob.size).toBeGreaterThan(100);
  });

  it('validates pre-export model and flags warnings', () => {
    const root = createModel();
    const reportGlb = validateExport(root, 'glb', 'full');
    expect(reportGlb.canExport).toBe(true);
    expect(reportGlb.stats.meshCount).toBeGreaterThan(0);

    const reportObj = validateExport(root, 'obj', 'full');
    expect(reportObj.canExport).toBe(true);
    // Check that OBJ hierarchy warning is present
    expect(reportObj.issues.some((i) => i.title.includes('Hierarchy'))).toBe(true);
  });
});
