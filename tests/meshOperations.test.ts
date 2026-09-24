import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createPrimitiveObject,
  generateUniqueName,
  detachObject,
  attachObjectAt,
  PRIMITIVE_DEFINITIONS,
  PrimitiveType,
} from '../src/model/meshOperations';
import { HistoryManager } from '../src/model/history';

describe('Mesh Operations Unit Tests', () => {
  it('creates valid meshes for all defined primitive types', () => {
    for (const def of PRIMITIVE_DEFINITIONS) {
      const obj = createPrimitiveObject(def.type, `Test_${def.type}`);
      expect(obj).toBeDefined();
      expect(obj.name).toBe(`Test_${def.type}`);

      if (def.type === 'group') {
        expect(obj).toBeInstanceOf(THREE.Group);
      } else {
        expect(obj).toBeInstanceOf(THREE.Mesh);
        const mesh = obj as THREE.Mesh;
        expect(mesh.geometry).toBeDefined();
        expect(mesh.material).toBeDefined();
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
      }
    }
  });

  it('generates non-colliding unique names within a scene graph', () => {
    const root = new THREE.Group();
    const box1 = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    box1.name = 'Box_1';
    const box2 = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    box2.name = 'Box_2';
    root.add(box1);
    root.add(box2);

    const nextBoxName = generateUniqueName('Box', root);
    expect(nextBoxName).toBe('Box_3');

    const nextSphereName = generateUniqueName('Sphere', root);
    expect(nextSphereName).toBe('Sphere_1');
  });

  it('detaches and restores an object at the exact child index', () => {
    const root = new THREE.Group();
    const childA = new THREE.Group();
    childA.name = 'A';
    const childB = new THREE.Group();
    childB.name = 'B';
    const childC = new THREE.Group();
    childC.name = 'C';

    root.add(childA);
    root.add(childB);
    root.add(childC);

    expect(root.children.map((c) => c.name)).toEqual(['A', 'B', 'C']);

    // Detach childB
    const location = detachObject(childB);
    expect(location).not.toBeNull();
    expect(location!.parent).toBe(root);
    expect(location!.index).toBe(1);
    expect(root.children.map((c) => c.name)).toEqual(['A', 'C']);

    // Reattach childB at its original index 1
    attachObjectAt(childB, location!.parent, location!.index);
    expect(root.children.map((c) => c.name)).toEqual(['A', 'B', 'C']);
  });

  it('integrates mesh creation and deletion with HistoryManager (Undo/Redo)', () => {
    const root = new THREE.Group();
    root.name = 'Scene_Root';
    const history = new HistoryManager(10);

    // 1. Create a Cylinder
    const cylinder = createPrimitiveObject('cylinder', 'My_Cylinder');
    const parent = root;
    const insertIndex = root.children.length;
    attachObjectAt(cylinder, parent, insertIndex);

    history.push({
      name: `Create "${cylinder.name}"`,
      undo: () => {
        detachObject(cylinder);
      },
      redo: () => {
        attachObjectAt(cylinder, parent, insertIndex);
      },
    });

    expect(root.children.length).toBe(1);
    expect(root.children[0].name).toBe('My_Cylinder');

    // 2. Undo creation
    expect(history.canUndo).toBe(true);
    history.undo();
    expect(root.children.length).toBe(0);

    // 3. Redo creation
    expect(history.canRedo).toBe(true);
    history.redo();
    expect(root.children.length).toBe(1);
    expect(root.children[0].name).toBe('My_Cylinder');

    // 4. Delete the mesh
    const loc = detachObject(cylinder);
    expect(loc).not.toBeNull();

    history.push({
      name: `Delete "${cylinder.name}"`,
      undo: () => {
        attachObjectAt(cylinder, loc!.parent, loc!.index);
      },
      redo: () => {
        detachObject(cylinder);
      },
    });

    expect(root.children.length).toBe(0);

    // 5. Undo deletion
    history.undo();
    expect(root.children.length).toBe(1);
    expect(root.children[0].name).toBe('My_Cylinder');

    // 6. Redo deletion
    history.redo();
    expect(root.children.length).toBe(0);
  });

  it('safely handles detachObject when object has no parent', () => {
    const orphan = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    expect(orphan.parent).toBeNull();
    const result = detachObject(orphan);
    expect(result).toBeNull();
  });

  it('correctly updates scene inventory when meshes are added and removed', () => {
    const sceneRoot = new THREE.Group();
    sceneRoot.name = 'Test_Scene';

    const box = createPrimitiveObject('box', 'Box_A');
    const sphere = createPrimitiveObject('sphere', 'Sphere_B');
    const group = createPrimitiveObject('group', 'Group_Folder');

    sceneRoot.add(box);
    sceneRoot.add(sphere);
    sceneRoot.add(group);

    const subCylinder = createPrimitiveObject('cylinder', 'Cylinder_C');
    group.add(subCylinder);

    // Initial check
    expect(sceneRoot.children.length).toBe(3);
    let meshCount = 0;
    sceneRoot.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) meshCount++;
    });
    expect(meshCount).toBe(3); // box, sphere, subCylinder

    // Delete sphere
    detachObject(sphere);
    meshCount = 0;
    sceneRoot.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) meshCount++;
    });
    expect(meshCount).toBe(2);

    // Delete group (removes group and all nested children)
    detachObject(group);
    meshCount = 0;
    sceneRoot.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) meshCount++;
    });
    expect(meshCount).toBe(1); // only box remains
  });
});
