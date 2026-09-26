import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createModel, createMenaraLedengModel } from '../src/generated/createMenaraLedengModel';
import { buildInventory } from '../src/model/inventory';
import { cloneForExport } from '../src/model/cloneForExport';
import { validateExport } from '../src/export/validation';

describe('Menara Ledeng 3D Environment Factory Tests', () => {
  it('creates Menara Ledeng root group with complete architectural hierarchy and flat cube water tank', () => {
    const root = createModel();

    expect(root).toBeInstanceOf(THREE.Group);
    expect(root.name).toBe('Menara_Ledeng_Root');

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
    expect(groupNames).toContain('Plinth_And_Street_Grid');
    expect(groupNames).toContain('Menara_Ledeng_Complex');
    expect(groupNames).toContain('Kantor_Walikota_Base_Building');
    expect(groupNames).toContain('Tower_Skeletal_Framework');
    expect(groupNames).toContain('Tower_Water_Tank_Reservoir');
    expect(groupNames).toContain('Waterways_And_River_Network');
    expect(groupNames).toContain('Jembatan_Sekanak');
    expect(groupNames).toContain('City_Context_Buildings');
    expect(groupNames).toContain('Street_Props_And_Lighting');
    expect(groupNames).toContain('Park_And_Street_Vegetation');

    // Park has been removed as requested
    expect(groupNames).not.toContain('Civic_Plaza_And_Park');

    // Check key architectural and flat cube elements (NO house roof)
    expect(meshNames).toContain('Terrain_Underside_Base');
    expect(meshNames).toContain('Ground_Asphalt_Surface');
    expect(meshNames).toContain('Street_Lane_Markings_And_Crosswalks');
    expect(meshNames).toContain('Kantor_Walikota_Central_Core');
    expect(meshNames).toContain('Kantor_Walikota_Entrance_Canopy');
    expect(meshNames).toContain('Tower_Main_Columns');
    expect(meshNames).toContain('Tower_Horizontal_Tie_Beams');
    expect(meshNames).toContain('Tower_Main_Riser_Pipe');
    expect(meshNames).toContain('Tower_Water_Tank_Body');
    expect(meshNames).toContain('Tower_Catwalk_Deck');
    expect(meshNames).toContain('Tower_Balcony_Railings');
    expect(meshNames).toContain('Tower_Tank_Top_Corbels');
    expect(meshNames).toContain('Tower_Tank_Top_Cornice');
    expect(meshNames).toContain('Tower_Upper_Balcony_Railings');
    expect(meshNames).toContain('Tower_Upper_Loggia_Columns');
    expect(meshNames).toContain('Tower_Loggia_Roof_Slab');
    expect(meshNames).toContain('Tower_Roof_Pillar_Pylons');
    expect(meshNames).toContain('Tower_Crown_Stepped_Pylons');
    expect(meshNames).toContain('Tower_Apex_Lightning_Spire');
    expect(meshNames).toContain('Sungai_Musi_Water');
    expect(meshNames).toContain('Sungai_Musi_Embankment_Wall');
    expect(meshNames).toContain('Sungai_Musi_Riverside_Promenade');
    expect(meshNames).toContain('Sungai_Sekanak_Canal_Water');
    expect(meshNames).toContain('Jembatan_Sekanak_Roadway');

    // Verify there is NO glass cutaway on the water tank (solid masonry - full tembok!)
    expect(meshNames).not.toContain('Tower_Reservoir_Cutaway_Window');
    expect(meshNames).not.toContain('Tower_Cutaway_Frame');

    // Verify there is NO house/pitched roof on the water tank
    expect(meshNames).not.toContain('Tower_Tank_Faceted_Roof');
    expect(meshNames).not.toContain('Tower_Roof_Apex_Cupola');
  });

  it('correctly aligns building orientation: entrance faces North (-Z) and Sungai Musi is at South (+Z)', () => {
    const root = createModel();

    // 1. Kantor Walikota Main Entrance Portico is at the North (-Z)
    const entranceCanopy = root.getObjectByName('Kantor_Walikota_Entrance_Canopy')!;
    expect(entranceCanopy).toBeDefined();
    expect(entranceCanopy.position.z).toBeLessThan(0); // North (-Z)!

    // 2. Sungai Musi flows along the South (+Z, behind the building)
    const musiWater = root.getObjectByName('Sungai_Musi_Water')!;
    expect(musiWater).toBeDefined();
    expect(musiWater.position.z).toBeGreaterThan(45); // South (+Z, opposite of entrance)!

    // 3. Sungai Sekanak flows along the West (-X)
    const sekanakWater = root.getObjectByName('Sungai_Sekanak_Canal_Water')!;
    expect(sekanakWater).toBeDefined();
    expect(sekanakWater.position.x).toBeLessThan(-75); // West (-X)!

    // 4. Jembatan Sekanak crosses Sungai Sekanak on the North Avenue (-Z)
    const bridge = root.getObjectByName('Jembatan_Sekanak')!;
    expect(bridge).toBeDefined();
    expect(bridge.position.z).toBeLessThan(0);
    expect(bridge.position.x).toBeLessThan(-75);
  });

  it('measures within target scale proportions matching the 4-view orthographic reference', () => {
    const root = createModel();
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Proposed display plinth: 200 m (width, X) by 150 m (depth, Z)
    expect(size.x).toBeCloseTo(200, 1);
    expect(size.z).toBeCloseTo(150, 1);

    // Total height from base to water tower lightning spire: ~60 m (sheet specifies ~60m height)
    expect(size.y).toBeGreaterThan(58);
    expect(size.y).toBeLessThan(65);
  });

  it('generates mid-poly triangle count within target budget and passes export validation', () => {
    const root = createModel();
    const { stats } = buildInventory(root);

    console.log(`Menara Ledeng stats: ${stats.totalTriangles} triangles, ${stats.meshCount} meshes, ${stats.materialCount} materials`);

    // Target specification in reference sheet: ~150,000 triangles maximum
    expect(stats.totalTriangles).toBeGreaterThan(15000);
    expect(stats.totalTriangles).toBeLessThanOrEqual(150000);

    // Validate GLB export readiness
    const cloned = cloneForExport({ targetNode: root, scope: 'full' });
    const validation = validateExport(cloned, 'glb', 'full');
    expect(validation.canExport).toBe(true);
    const errors = validation.issues.filter((i) => i.severity === 'error');
    expect(errors.length).toBe(0);
  });

  it('preserves procedural visibility options including waterways', () => {
    const root = createModel({
      showSurroundingCity: false,
      showParkVegetation: false,
      showStreetProps: false,
      showWaterways: false,
    });

    expect(root.getObjectByName('City_Context_Buildings')).toBeUndefined();
    expect((root.getObjectByName('Park_And_Street_Vegetation') as THREE.Group).children).toHaveLength(0);
    expect(root.getObjectByName('Street_Props_And_Lighting')).toBeUndefined();
    expect(root.getObjectByName('Waterways_And_River_Network')).toBeUndefined();
  });

  it('provides secondary createMenaraLedengModel alias with identical structure', () => {
    const model = createMenaraLedengModel();
    expect(model).toBeInstanceOf(THREE.Group);
    expect(model.name).toBe('Menara_Ledeng_Root');
  });

  it('provides the 5 AR ETNO-STEM educational anchors matching the concept diagram', () => {
    const root = createModel();
    const expectedEtnoStemAnchors = [
      'Anchor_ML_01_Etno_Sungai_Musi',
      'Anchor_ML_02_Sains_Tekanan_Hidrostatis',
      'Anchor_ML_03_Teknologi_Distribusi_Air',
      'Anchor_ML_04_Rekayasa_Struktur_Fondasi',
      'Anchor_ML_05_Matematika_Geometri_Volume',
    ];

    for (const name of expectedEtnoStemAnchors) {
      const anchor = root.getObjectByName(name);
      expect(anchor).toBeDefined();
    }

    // Verify key anchor 3D positions
    const anchorMusi = root.getObjectByName('Anchor_ML_01_Etno_Sungai_Musi')!;
    expect(anchorMusi.position.z).toBeGreaterThan(45); // In Sungai Musi zone (South)

    const anchorRiser = root.getObjectByName('Anchor_ML_02_Sains_Tekanan_Hidrostatis')!;
    expect(anchorRiser.position.y).toBeCloseTo(28.0, 1); // Along the central riser pipe

    const anchorTech = root.getObjectByName('Anchor_ML_03_Teknologi_Distribusi_Air')!;
    expect(anchorTech.position.y).toBeGreaterThan(45); // At reservoir manifold

    const anchorEng = root.getObjectByName('Anchor_ML_04_Rekayasa_Struktur_Fondasi')!;
    expect(anchorEng.position.y).toBeGreaterThan(40); // At top structural corbels/columns

    const anchorMath = root.getObjectByName('Anchor_ML_05_Matematika_Geometri_Volume')!;
    expect(anchorMath.position.y).toBeCloseTo(24.0, 1); // At elevation geometry
  });

  it('provides comprehensive backward-compatible architectural anchors across the complex', () => {
    const root = createModel();
    const expectedAnchors = [
      'Anchor_Menara_Ledeng_Apex_Spire',
      'Anchor_Menara_Ledeng_Water_Tank_Catwalk',
      'Anchor_Menara_Ledeng_Structural_Framework',
      'Anchor_Kantor_Walikota_Entrance_Portico',
      'Anchor_City_Avenue_Intersection',
    ];

    for (const name of expectedAnchors) {
      expect(root.getObjectByName(name)).toBeDefined();
    }
  });
});
