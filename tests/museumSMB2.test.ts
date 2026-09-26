import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createModel, createMuseumSMB2Model } from '../src/generated/createMuseumSMB2Model';
import { createMuseumSMB2Model as createEditableSourceModel } from '../src/models/createMuseumSMB2Model';
import { buildInventory } from '../src/model/inventory';
import { cloneForExport } from '../src/model/cloneForExport';
import { validateExport } from '../src/export/validation';

describe('Museum Sultan Mahmud Badaruddin II 3D Environment Factory Tests', () => {
  it('creates Museum SMB II root group with complete architectural hierarchy', () => {
    const root = createModel();

    expect(root).toBeInstanceOf(THREE.Group);
    expect(root.name).toBe('Museum_SMB2_Root');

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
    expect(groupNames).toContain('Plinth_And_Street_Environment');
    expect(groupNames).toContain('Building_Museum_SMB2_Main');
    expect(groupNames).toContain('Dual_Curved_Grand_Stairs');
    expect(groupNames).toContain('Central_Portal_Module');
    expect(groupNames).toContain('Upper_Colonnade_Gallery');
    expect(groupNames).toContain('Museum_Side_Wing');
    expect(groupNames).toContain('Plaza_Props_And_Figures');
    expect(groupNames).toContain('Scale_Human_Figures');
    expect(groupNames).toContain('Garden_Trees_And_Landscaping');
    expect(groupNames).toContain('Helpers_And_Anchors');

    // Check key architectural and urban elements
    expect(meshNames).toContain('Earth_Underside_Base');
    expect(meshNames).toContain('Plaza_Stone_Paving');
    expect(meshNames).toContain('City_Road_Asphalt_Surface');
    expect(meshNames).toContain('Safety_Curb_Black');
    expect(meshNames).toContain('Safety_Curb_White');
    expect(meshNames).toContain('Foundation_Plinth_Base');
    expect(meshNames).toContain('Main_Ground_Wainscot_Plinth');
    expect(meshNames).toContain('Main_Ground_Stucco_Wall');
    expect(meshNames).toContain('Curved_Stair_Treads');
    expect(meshNames).toContain('Curved_Stair_Balustrades');
    expect(meshNames).toContain('Portal_Red_Double_Doors');
    expect(meshNames).toContain('Portal_Museum_Sign_Letters');
    expect(meshNames).toContain('Building_Museum_SMB2_Roof');
    expect(meshNames).toContain('Main_Roof_Ridge_Cap');
    expect(meshNames).toContain('Side_Wing_Wainscot_Plinth');
  });

  it('measures within target scale proportions matching the 4-view orthographic reference', () => {
    const root = createModel();
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Proposed display plinth / street bounds: 180 m (width, X) by 110 m (depth, Z)
    expect(size.x).toBeCloseTo(180, 1);
    expect(size.z).toBeCloseTo(110, 1);

    // Profile view specifies ~25m height to roof peak (with base plinth Y in [-0.6, 25.9])
    expect(size.y).toBeGreaterThan(23.0);
    expect(size.y).toBeLessThan(28.0);
  });

  it('connects both stair starts to a solid landing and backs the upper facade glazing', () => {
    const root = createModel();
    const landing = root.getObjectByName('Stair_Top_Landing_Slab') as THREE.Mesh;
    const glazing = root.getObjectByName('Gallery_Glazing_Panes') as THREE.Mesh;
    const backing = root.getObjectByName('Upper_Gallery_Window_Backing') as THREE.Mesh;

    expect(landing).toBeDefined();
    expect(glazing).toBeDefined();
    expect(backing).toBeDefined();

    const landingBounds = new THREE.Box3().setFromObject(landing);
    expect(landingBounds.min.x).toBeLessThan(-7.7);
    expect(landingBounds.max.x).toBeGreaterThan(7.7);
    expect(landingBounds.max.z).toBeGreaterThan(11.05);

    const glassBounds = new THREE.Box3().setFromObject(glazing);
    const backingBounds = new THREE.Box3().setFromObject(backing);
    expect(backingBounds.max.z).toBeLessThan(glassBounds.min.z);
    expect((glazing.material as THREE.MeshStandardMaterial).opacity).toBeLessThan(1);
  });

  it('generates mid-poly triangle count within target budget (~110,000 tris) and passes export validation', () => {
    const root = createModel();
    const { stats } = buildInventory(root);

    // Target specification in reference sheet: ~110,000 triangles (budget between 15,000 and 130,000 tris)
    expect(stats.totalTriangles).toBeGreaterThan(15000);
    expect(stats.totalTriangles).toBeLessThanOrEqual(130000);

    // Validate GLB export readiness
    const cloned = cloneForExport({ targetNode: root, scope: 'full' });
    const validation = validateExport(cloned, 'glb', 'full');
    expect(validation.canExport).toBe(true);
    const errors = validation.issues.filter((i) => i.severity === 'error');
    expect(errors.length).toBe(0);
  });

  it('preserves procedural visibility options', () => {
    const root = createModel({
      showCurvedStairs: false,
      showSideWing: false,
      showHumanFigures: false,
      showColonnade: false,
      showGardens: false,
    });

    expect(root.getObjectByName('Dual_Curved_Grand_Stairs')).toBeUndefined();
    expect(root.getObjectByName('Museum_Side_Wing')).toBeUndefined();
    expect(root.getObjectByName('Scale_Human_Figures')).toBeUndefined();
    expect(root.getObjectByName('Upper_Colonnade_Gallery')).toBeUndefined();
    expect(root.getObjectByName('Garden_Trees_And_Landscaping')).toBeUndefined();
  });

  it('provides secondary createMuseumSMB2Model alias with identical structure', () => {
    const modelFromNamed = createMuseumSMB2Model();
    const modelFromSource = createEditableSourceModel();

    expect(modelFromNamed.name).toBe('Museum_SMB2_Root');
    expect(modelFromSource.name).toBe('Museum_SMB2_Root');
    expect(modelFromNamed.children.length).toBe(modelFromSource.children.length);
  });

  it('provides calibrated AR and educational anchors across the historic site', () => {
    const root = createModel();
    const anchors = root.getObjectByName('Helpers_And_Anchors') as THREE.Group;
    expect(anchors).toBeDefined();

    const anchorNames = anchors.children.map((child) => child.name);
    expect(anchorNames).toContain('Anchor_Curved_Grand_Stairs');
    expect(anchorNames).toContain('Anchor_Central_Portal_Museum');
    expect(anchorNames).toContain('Anchor_Second_Floor_Colonnade');
    expect(anchorNames).toContain('Anchor_Limas_Roof_Finials');
    expect(anchorNames).toContain('Anchor_Terrace_Flagpole');
    expect(anchorNames).toContain('Anchor_Museum_Side_Wing');
    expect(anchorNames).toContain('Anchor_Plaza_Visitor_Arrival');
  });

  it('features historic dual-tone facade, golden simbar finials, and classical Tuscan columns', () => {
    const root = createModel();
    const materials = new Set<string>();

    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => materials.add(m.name));
        } else {
          materials.add(mesh.material.name);
        }
      }
    });

    // Verify key historical materials
    expect(materials).toContain('Museum_Wainscot_Brown');
    expect(materials).toContain('Museum_Stucco_White');
    expect(materials).toContain('Palembang_Lacquer_Red');
    expect(materials).toContain('Tuscan_Column_White');
    expect(materials).toContain('Grand_Stairs_Dark_Stone');
    expect(materials).toContain('Palembang_Simbar_Gold');
    expect(materials).toContain('Museum_Sign_Gold_Text');
    expect(materials).toContain('Terracotta_Tile_Roof');
  });
});
