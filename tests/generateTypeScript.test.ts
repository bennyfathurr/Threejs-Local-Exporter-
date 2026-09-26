import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateModelTypeScript } from '../src/model/generateTypeScript';
import { executeProceduralCode } from '../src/model/codeRunner';

describe('TypeScript Code Generator & Decompiler Suite', () => {
  it('generates valid, compilable TypeScript code from a compound model', () => {
    const root = new THREE.Group();
    root.name = 'Test_Compound_Model';

    const baseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1, 10),
      new THREE.MeshStandardMaterial({ name: 'Mat_Base', color: 0x1e293b, roughness: 0.8 })
    );
    baseMesh.name = 'Base_Foundation';
    baseMesh.position.set(0, 0.5, 0);
    root.add(baseMesh);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 3, 16),
      new THREE.MeshStandardMaterial({ name: 'Mat_Pillar', color: 0xffffff, metalness: 0.2 })
    );
    pillar.name = 'Colonnade_Pillar_01';
    pillar.position.set(3, 2, 3);
    root.add(pillar);

    const tsCode = generateModelTypeScript(root, 'Test_Compound_Model');

    expect(tsCode).toBeDefined();
    expect(tsCode).toContain('export function createModel');
    expect(tsCode).toContain('new THREE.BoxGeometry(10, 1, 10)');
    expect(tsCode).toContain('new THREE.CylinderGeometry(0.5, 0.5, 3, 16)');
    expect(tsCode).toContain('Base_Foundation');
    expect(tsCode).toContain('Colonnade_Pillar_01');

    // Test that the generated code is directly executable by the browser codeRunner
    const executed = executeProceduralCode(tsCode);
    expect(executed.model).toBeDefined();
    expect(executed.model.name).toBe('Test_Compound_Model');

    const foundBase = executed.model.getObjectByName('Base_Foundation') as THREE.Mesh;
    expect(foundBase).toBeDefined();
    expect(foundBase.position.y).toBeCloseTo(0.5);

    const foundPillar = executed.model.getObjectByName('Colonnade_Pillar_01') as THREE.Mesh;
    expect(foundPillar).toBeDefined();
    expect(foundPillar.position.x).toBeCloseTo(3);
  });

  it('handles groups and nested hierarchy correctly', () => {
    const root = new THREE.Group();
    root.name = 'Nested_Parent';

    const subGroup = new THREE.Group();
    subGroup.name = 'Wing_A';
    subGroup.position.set(5, 0, 0);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x06b6d4 })
    );
    sphere.name = 'Finial_Orb';
    sphere.position.set(0, 4, 0);
    subGroup.add(sphere);

    root.add(subGroup);

    const tsCode = generateModelTypeScript(root, 'Nested_Parent');
    expect(tsCode).toContain('Wing_A');
    expect(tsCode).toContain('Finial_Orb');

    const executed = executeProceduralCode(tsCode);
    const sub = executed.model.getObjectByName('Wing_A');
    expect(sub).toBeDefined();
    const orb = sub?.getObjectByName('Finial_Orb');
    expect(orb).toBeDefined();
  });
});
