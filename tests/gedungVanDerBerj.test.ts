import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createModel, createGedungVanDerBerjModel } from '../src/generated/createGedungVanDerBerjModel';
import { createGedungVanDerBerjModel as createEditableSourceModel } from '../src/models/createGedungVanDerBerjModel';
import { buildInventory } from '../src/model/inventory';
import { cloneForExport } from '../src/model/cloneForExport';
import { validateExport } from '../src/export/validation';

describe('Gedung Van der Berj Palembang 3D Environment Factory Tests', () => {
  it('creates Gedung Van der Berj root group with complete architectural hierarchy', () => {
    const root = createModel();

    expect(root).toBeInstanceOf(THREE.Group);
    expect(root.name).toBe('Gedung_Van_Der_Berj_Root');

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
    expect(groupNames).toContain('Building_Van_Der_Berj_Main');
    expect(groupNames).toContain('Building_Side_Annex');
    expect(groupNames).toContain('Modular_Window_Units');
    expect(groupNames).toContain('Street_Props_And_Lighting');
    expect(groupNames).toContain('Helpers_And_Anchors');

    // Check key architectural and urban elements
    expect(meshNames).toContain('Earth_Underside_Base');
    expect(meshNames).toContain('City_Road_Asphalt_Surface');
    expect(meshNames).toContain('Sidewalk_Concrete_Paving');
    expect(meshNames).toContain('Safety_Curb_Black');
    expect(meshNames).toContain('Safety_Curb_White');
    expect(meshNames).toContain('Zebra_Crosswalk_Stripes');
    expect(meshNames).toContain('Foundation_Plinth_Base');
    expect(meshNames).toContain('Main_Ground_Wainscot_Plinth');
    expect(meshNames).toContain('Main_Ground_Ochre_Wall');
    expect(meshNames).toContain('Intermediate_Eave_Awning_Roof');
    expect(meshNames).toContain('Main_Second_Floor_Wall');
    expect(meshNames).toContain('Building_Van_Der_Berj_Roof');
    expect(meshNames).toContain('Annex_Plinth');
    expect(meshNames).toContain('Annex_Wainscot_Plinth');
    expect(meshNames).toContain('Annex_Ochre_Wall');
    expect(meshNames).toContain('Annex_Sloped_Roof');
  });

  it('measures within target scale proportions matching the 4-view orthographic reference', () => {
    const root = createModel();
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Proposed display plinth / street bounds: 180 m (width, X) by 110 m (depth, Z)
    expect(size.x).toBeCloseTo(180, 1);
    expect(size.z).toBeCloseTo(110, 1);

    // Profile view specifies ~25m height to roof peak (with base plinth Y in [-0.6, 25.5])
    expect(size.y).toBeGreaterThan(23.0);
    expect(size.y).toBeLessThan(28.0);
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
      showAnnex: false,
      showStreetProps: false,
      showModularWindows: false,
      showEntranceDetails: false,
    });

    expect(root.getObjectByName('Building_Side_Annex')).toBeUndefined();
    expect(root.getObjectByName('Street_Props_And_Lighting')).toBeUndefined();
    expect(root.getObjectByName('Modular_Window_Units')).toBeUndefined();
    expect(root.getObjectByName('Main_Entrance_South')).toBeUndefined();
  });

  it('provides secondary createGedungVanDerBerjModel alias with identical structure', () => {
    const model = createGedungVanDerBerjModel();
    expect(model).toBeInstanceOf(THREE.Group);
    expect(model.name).toBe('Gedung_Van_Der_Berj_Root');
  });

  it('provides calibrated AR and educational anchors across the historic site', () => {
    const root = createModel();
    const expectedAnchors = [
      'Anchor_Main_Entrance_South',
      'Anchor_Building_Van_Der_Berj_Roof',
      'Anchor_Intermediate_Awning',
      'Anchor_Corner_Intersection',
      'Anchor_Side_Annex_Wing',
      'Anchor_Historical_Sign_Plaque',
    ];

    for (const name of expectedAnchors) {
      const anchor = root.getObjectByName(name);
      expect(anchor).toBeDefined();
    }

    // Verify key 3D coordinates
    const roofAnchor = root.getObjectByName('Anchor_Building_Van_Der_Berj_Roof')!;
    expect(roofAnchor.position.y).toBeCloseTo(25.0, 1);

    const cornerAnchor = root.getObjectByName('Anchor_Corner_Intersection')!;
    expect(cornerAnchor.position.x).toBeGreaterThan(30.0);
  });

  it('loads the editable source with shaped walls and tiled roof geometry', () => {
    const root = createEditableSourceModel();
    expect(root).toBeInstanceOf(THREE.Group);
    const cornerWall = root.getObjectByName('Main_Ground_Ochre_Wall') as THREE.Mesh;
    const mainRoof = root.getObjectByName('Building_Van_Der_Berj_Roof') as THREE.Mesh;
    const tileField = mainRoof.getObjectByName('Building_Van_Der_Berj_Roof_Raised_Terracotta_Tiles') as THREE.Mesh;
    expect(cornerWall.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(tileField.geometry.getAttribute('position').count).toBeGreaterThan(10000);
    expect(root.getObjectByName('Annex_Roof_Hip_Caps')).toBeDefined();
    expect(root.getObjectByName('Main_Entrance_South_Lettering_Relief')).toBeDefined();
  });

  it('features historic dual-tone ochre/brown facade and colonial blue doors', () => {
    const root = createModel();

    let hasPlinthBrown = false;
    let hasWallOchre = false;
    let hasDoorBlue = false;
    let hasIntermediateAwning = false;

    root.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat?.name === 'Van_Der_Berj_Plinth_Brown') hasPlinthBrown = true;
        if (mat?.name === 'Van_Der_Berj_Wall_Ochre') hasWallOchre = true;
        if (mat?.name === 'Colonial_Shutter_Door_Blue') hasDoorBlue = true;
        if (mesh.name === 'Intermediate_Eave_Awning_Roof') hasIntermediateAwning = true;
      }
    });

    expect(hasPlinthBrown).toBe(true);
    expect(hasWallOchre).toBe(true);
    expect(hasDoorBlue).toBe(true);
    expect(hasIntermediateAwning).toBe(true);
  });
});
