import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createModel, createRumahDinasWalikotaModel } from '../src/generated/createRumahDinasWalikotaModel';
import { buildInventory } from '../src/model/inventory';
import { cloneForExport } from '../src/model/cloneForExport';
import { validateExport } from '../src/export/validation';

describe('Rumah Dinas Walikota Palembang 3D Environment Factory Tests', () => {
  it('creates Rumah Dinas Walikota root group with complete architectural hierarchy', () => {
    const root = createModel();

    expect(root).toBeInstanceOf(THREE.Group);
    expect(root.name).toBe('Rumah_Dinas_Walikota_Root');

    const groupNames: string[] = [];
    const meshNames: string[] = [];

    root.traverse((node) => {
      if (node.name) {
        if ((node as THREE.Mesh).isMesh) {
          meshNames.push(node.name);
        } else if (node.type === 'Group') {
          groupNames.push(node.name);
        }
      }
    });

    // Check core structural groups
    expect(groupNames).toContain('Plinth_And_Driveway_Court');
    expect(groupNames).toContain('Residence_Main_Building');
    expect(groupNames).toContain('Pavilion_Gateway_West');
    expect(groupNames).toContain('Pavilion_Gateway_East');
    expect(groupNames).toContain('Compound_Fence_And_Perimeter');
    expect(groupNames).toContain('Compound_Ceremonial_Flagpole');
    expect(groupNames).toContain('Compound_Gardens_And_Vegetation');
    expect(groupNames).toContain('Street_Props_And_Lighting');
    expect(groupNames).toContain('Official_Vehicles');
    expect(groupNames).toContain('Helpers_And_Anchors');

    // Check key architectural and compound elements
    expect(meshNames).toContain('Terrain_Underside_Base');
    expect(meshNames).toContain('Public_Road_Asphalt_Surface');
    expect(meshNames).toContain('Ceremonial_Driveway_Court');
    expect(meshNames).toContain('Residence_Foundation_Plinth');
    expect(meshNames).toContain('Porte_Cochere_Columns');
    expect(meshNames).toContain('Porte_Cochere_Roof');
    expect(meshNames).toContain('Residence_Central_Core_Body');
    expect(meshNames).toContain('Residence_Central_High_Roof');
    expect(meshNames).toContain('Residence_West_Wing_Body');
    expect(meshNames).toContain('Residence_West_Wing_Roof');
    expect(meshNames).toContain('Residence_East_Wing_Body');
    expect(meshNames).toContain('Residence_East_Wing_Roof');
    expect(meshNames).toContain('Residence_Rear_Wing_Body');
    expect(meshNames).toContain('Residence_Rear_Wing_Roof');
    expect(meshNames).toContain('Flag_Red_Half');
    expect(meshNames).toContain('Flag_White_Half');
    expect(meshNames).toContain('Fence_Concrete_Plinth');
    expect(meshNames).toContain('Fence_Wrought_Iron_Grilles');
  });

  it('measures within target scale proportions matching the 4-view orthographic reference', () => {
    const root = createModel();
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Proposed display plinth: 250 m (width, X) by 160 m (depth, Z)
    expect(size.x).toBeCloseTo(250, 1);
    expect(size.z).toBeCloseTo(160, 1);

    // Total height: ~15 m to 16 m (profile view specifies ~15m height to roof peak)
    expect(size.y).toBeGreaterThan(14.0);
    expect(size.y).toBeLessThan(18.0);
  });

  it('generates mid-poly triangle count within target budget and passes export validation', () => {
    const root = createModel();
    const { stats } = buildInventory(root);

    console.log(`Rumah Dinas Walikota stats: ${stats.totalTriangles} triangles, ${stats.meshCount} meshes, ${stats.materialCount} materials`);

    // Target specification in reference sheet: ~130,000 triangles (budget up to 150,000 tris)
    expect(stats.totalTriangles).toBeGreaterThan(15000);
    expect(stats.totalTriangles).toBeLessThanOrEqual(150000);

    // Validate GLB export readiness
    const cloned = cloneForExport({ targetNode: root, scope: 'full' });
    const validation = validateExport(cloned, 'glb', 'full');
    expect(validation.canExport).toBe(true);
    const errors = validation.issues.filter((i) => i.severity === 'error');
    expect(errors.length).toBe(0);
  });

  it('uses branching broadleaf trees and full surface palm fronds', () => {
    const root = createModel();
    const tree = root.getObjectByName('East_Grove_Tree_1')!;
    const palm = root.getObjectByName('Royal_Palm_1')!;
    expect(tree.getObjectByName('East_Grove_Tree_1_Primary_Branches')).toBeInstanceOf(THREE.Mesh);
    expect(tree.children.filter(child => child.name.includes('Canopy_Lobe')).length).toBeGreaterThan(6);
    const blades = palm.getObjectByName('Royal_Palm_1_Tapered_Frond_Blades') as THREE.Mesh;
    expect(blades).toBeInstanceOf(THREE.Mesh);
    expect(blades.geometry.getAttribute('position').count).toBeGreaterThan(1000);
    expect(palm.getObjectByName('Royal_Palm_1_Canopy_Core')).toBeUndefined();
  });

  it('preserves procedural visibility options', () => {
    const root = createModel({
      showGardens: false,
      showFenceAndGates: false,
      showStreetProps: false,
      showVehicles: false,
    });

    expect(root.getObjectByName('Compound_Gardens_And_Vegetation')).toBeUndefined();
    expect(root.getObjectByName('Pavilion_Gateway_West')).toBeUndefined();
    expect(root.getObjectByName('Pavilion_Gateway_East')).toBeUndefined();
    expect(root.getObjectByName('Compound_Fence_And_Perimeter')).toBeUndefined();
    expect(root.getObjectByName('Street_Props_And_Lighting')).toBeUndefined();
    expect(root.getObjectByName('Official_Vehicles')).toBeUndefined();
  });

  it('provides secondary createRumahDinasWalikotaModel alias with identical structure', () => {
    const model = createRumahDinasWalikotaModel();
    expect(model).toBeInstanceOf(THREE.Group);
    expect(model.name).toBe('Rumah_Dinas_Walikota_Root');
  });

  it('provides comprehensive calibrated AR & educational anchors across the residence complex', () => {
    const root = createModel();
    const expectedAnchors = [
      'Anchor_Main_Entrance_Porte_Cochere',
      'Anchor_Central_Residence_High_Roof',
      'Anchor_West_Wing_Terrace',
      'Anchor_East_Wing_Office',
      'Anchor_Ceremonial_Flagpole',
      'Anchor_West_Pavilion_Gateway',
      'Anchor_East_Pavilion_Gateway',
      'Anchor_Compound_Front_Boulevard',
    ];

    for (const name of expectedAnchors) {
      const anchor = root.getObjectByName(name);
      expect(anchor).toBeDefined();
    }

    // Verify key 3D coordinates
    const porticoAnchor = root.getObjectByName('Anchor_Main_Entrance_Porte_Cochere')!;
    expect(porticoAnchor.position.z).toBeGreaterThan(0); // In the front portico

    const highRoofAnchor = root.getObjectByName('Anchor_Central_Residence_High_Roof')!;
    expect(highRoofAnchor.position.y).toBeCloseTo(15.0, 1); // Peak height ~15m

    const flagAnchor = root.getObjectByName('Anchor_Ceremonial_Flagpole')!;
    expect(flagAnchor.position.z).toBeCloseTo(32.0, 1);
  });
});
