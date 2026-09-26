import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createModel, createBentengKutoBesakModel } from '../src/generated/createBentengKutoBesakModel';
import { buildInventory } from '../src/model/inventory';
import { cloneForExport } from '../src/model/cloneForExport';
import { validateExport } from '../src/export/validation';

describe('Benteng Kuto Besak Mid-Poly Model Factory Tests', () => {
  it('creates Benteng Kuto Besak root group with complete architectural hierarchy', () => {
    const root = createModel();

    expect(root).toBeInstanceOf(THREE.Group);
    expect(root.name).toBe('Benteng_Kuto_Besak_Root');

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

    // Check key structural groups
    expect(groupNames).toContain('Terrain_And_Water_Base');
    expect(groupNames).toContain('Fort_Defensive_Perimeter');
    expect(groupNames).toContain('Palace_Complex_Dalem_Kuto_Besak');
    expect(groupNames).toContain('Outside_Fort_Buildings');
    expect(groupNames).toContain('Opposite_Riverbank_Houses');
    expect(groupNames).toContain('River_Settlement_Musi_Life');
    expect(groupNames).toContain('Rampart_Cannons_Artillery');
    expect(groupNames).toContain('Courtyard_Landscaping_Vegetation');
    expect(groupNames).toContain('Helpers_And_Anchors');

    // Check key architectural meshes & parts
    expect(meshNames).toContain('Musi_River_Water');
    expect(meshNames).toContain('Riverbank_Embankment');
    expect(meshNames).toContain('River_Stone_Edge');
    expect(meshNames).toContain('Wall_Front_West_Span');
    expect(meshNames).toContain('Wall_Front_East_Span');
    expect(meshNames).toContain('Wall_Flank_West_Span');
    expect(meshNames).toContain('Wall_Flank_East_Span');
    expect(meshNames).toContain('Gate_Triple_Arch_Portal');
    expect(meshNames).toContain('Gate_Pediment');
    expect(meshNames).toContain('Gate_Sultanate_Crest_Medallion');
    expect(meshNames).toContain('Dalem_Keraton_Main_Palace_Limasan_Roof');
    expect(meshNames).toContain('West_Pavilion_Gedung_Prajurit_Limasan_Roof');
    expect(meshNames).toContain('East_Pavilion_Gedung_Tamu_Limasan_Roof');

    // Must have rich mid-poly structure: >= 40 meshes
    expect(meshNames.length).toBeGreaterThanOrEqual(40);
  });

  it('faces the three open entrance arches toward the river', () => {
    const root = createModel();
    root.updateMatrixWorld(true);
    const river = root.getObjectByName('Musi_River_Water') as THREE.Mesh;
    const gateway = root.getObjectByName('Gate_Triple_Arch_Portal') as THREE.Mesh;
    const gateZ = gateway.getWorldPosition(new THREE.Vector3()).z;
    expect(river.position.z).toBeLessThan(gateZ);
    expect(gateZ).toBeLessThan(-50);
    const crest = root.getObjectByName('Gate_Sultanate_Crest_Medallion') as THREE.Mesh;
    expect(crest.getWorldPosition(new THREE.Vector3()).z).toBeLessThan(gateZ);
    for (const x of [-8.1, 0, 8.1]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 2.5, -75), new THREE.Vector3(0, 0, 1), 0, 35);
      expect(ray.intersectObject(gateway)).toHaveLength(0);
    }
    const pierRay = new THREE.Raycaster(new THREE.Vector3(4.3, 2.5, -75), new THREE.Vector3(0, 0, 1), 0, 35);
    expect(pierRay.intersectObject(gateway).length).toBeGreaterThan(0);
  });

  it('adds editable structures on both sides of the fort and more river boats', () => {
    const root = createModel();
    const exterior = root.getObjectByName('Outside_Fort_Buildings') as THREE.Group;
    const farBank = root.getObjectByName('Opposite_Riverbank_Houses') as THREE.Group;
    const boats = root.getObjectByName('River_Settlement_Musi_Life') as THREE.Group;
    expect(exterior.children.length).toBeGreaterThanOrEqual(12);
    expect(farBank.children.some(child => child.name.includes('Stilt_House'))).toBe(true);
    expect(boats.children.length).toBeGreaterThanOrEqual(10);
    expect(root.getObjectByName('Dalem_Keraton_Main_Palace_Roof_Tile_Courses')).toBeDefined();
    expect(root.getObjectByName('Perahu_Getek_1_Custom_Hull')).toBeDefined();
  });

  it('preserves procedural visibility options', () => {
    const root = createModel({ showRiverSettlement: false, showInnerVegetation: false, showCannons: false });
    expect((root.getObjectByName('River_Settlement_Musi_Life') as THREE.Group).children).toHaveLength(0);
    expect((root.getObjectByName('Opposite_Riverbank_Houses') as THREE.Group).children).toHaveLength(0);
    expect((root.getObjectByName('Courtyard_Landscaping_Vegetation') as THREE.Group).children).toHaveLength(0);
    expect((root.getObjectByName('Rampart_Cannons_Artillery') as THREE.Group).children).toHaveLength(0);
  });

  it('provides secondary createBentengKutoBesakModel alias with identical structure', () => {
    const model = createBentengKutoBesakModel();
    expect(model).toBeInstanceOf(THREE.Group);
    expect(model.name).toBe('Benteng_Kuto_Besak_Root');
  });

  it('measures within target scale proportions matching the 4-view reference sheet', () => {
    const root = createModel();
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Proposed display slab dimensions on the sheet.
    expect(size.x).toBeCloseTo(320, 1);

    expect(size.z).toBeCloseTo(270, 1);

    // Height from water to palace roof crest: ~15-20m
    expect(size.y).toBeGreaterThan(10);
    expect(size.y).toBeLessThan(30);
  });

  it('generates mid-poly triangle count within target budget and passes export validation', () => {
    const root = createModel();
    const { items, stats } = buildInventory(root);

    console.log(`Benteng Kuto Besak stats: ${stats.totalTriangles} triangles, ${stats.meshCount} meshes, ${stats.materialCount} materials`);

    // The reference proposes roughly 110k triangles as an upper target.
    expect(stats.totalTriangles).toBeGreaterThan(10000);
    expect(stats.totalTriangles).toBeLessThanOrEqual(110000);

    // Validate export readiness
    const cloned = cloneForExport({ targetNode: root, scope: 'full' });
    const validation = validateExport(cloned, 'glb', 'full');
    expect(validation.canExport).toBe(true);
    const errors = validation.issues.filter((i) => i.severity === 'error');
    expect(errors.length).toBe(0);
  });

  it('forms seamless 90-degree corners with zero gap between wall spans', () => {
    const root = createModel();
    root.updateMatrixWorld(true);

    const westWall = root.getObjectByName('Wall_Flank_West_Span') as THREE.Mesh;
    const eastWall = root.getObjectByName('Wall_Flank_East_Span') as THREE.Mesh;
    const frontWestWall = root.getObjectByName('Wall_Front_West_Span') as THREE.Mesh;
    const frontEastWall = root.getObjectByName('Wall_Front_East_Span') as THREE.Mesh;
    const rearWestWall = root.getObjectByName('Wall_North_Rear_West_Span') as THREE.Mesh;
    const rearEastWall = root.getObjectByName('Wall_North_Rear_East_Span') as THREE.Mesh;

    expect(westWall).toBeDefined();
    expect(eastWall).toBeDefined();
    expect(frontWestWall).toBeDefined();
    expect(frontEastWall).toBeDefined();
    expect(rearWestWall).toBeDefined();
    expect(rearEastWall).toBeDefined();

    // The long side walls and front spans meet at the shared rectangular perimeter.
    const westBox = new THREE.Box3().setFromObject(westWall);
    const frontWestBox = new THREE.Box3().setFromObject(frontWestWall);

    // Coping projects 0.09 beyond the 234 m outer wall span.
    expect(westBox.min.x).toBeCloseTo(-117.09, 2);
    expect(westBox.max.z).toBeCloseTo(68.09, 2);
    expect(frontWestBox.max.z).toBeCloseTo(68.09, 2);

    // Check SE Corner
    const eastBox = new THREE.Box3().setFromObject(eastWall);
    const frontEastBox = new THREE.Box3().setFromObject(frontEastWall);
    expect(eastBox.max.x).toBeCloseTo(117.09, 2);
    expect(eastBox.max.z).toBeCloseTo(68.09, 2);
    expect(frontEastBox.max.z).toBeCloseTo(68.09, 2);

    // Check NW Corner
    const rearWestBox = new THREE.Box3().setFromObject(rearWestWall);
    expect(westBox.min.z).toBeCloseTo(-57.09, 2);
    expect(rearWestBox.min.z).toBeCloseTo(-57.09, 2);

    // Check NE Corner
    const rearEastBox = new THREE.Box3().setFromObject(rearEastWall);
    expect(eastBox.min.z).toBeCloseTo(-57.09, 2);
    expect(rearEastBox.min.z).toBeCloseTo(-57.09, 2);
  });

  it('incorporates historical corner bastion modules with watch pavilions and artillery at all 4 corners', () => {
    const root = createModel();
    const bastionNames = [
      'Bastion_River_West',
      'Bastion_River_East',
      'Bastion_Inland_West',
      'Bastion_Inland_East',
    ];

    for (const name of bastionNames) {
      const bastion = root.getObjectByName(name) as THREE.Group;
      expect(bastion).toBeDefined();

      // Check structural parts
      expect(root.getObjectByName(`${name}_Base`)).toBeDefined();
      expect(root.getObjectByName(`${name}_Coping`)).toBeDefined();
      expect(root.getObjectByName(`${name}_Parapet_Flank`)).toBeDefined();
      expect(root.getObjectByName(`${name}_Parapet_Front`)).toBeDefined();

      // Check Watch Pavilion (Pos Pengawas)
      const pavilion = root.getObjectByName(`${name}_Watch_Pavilion`) as THREE.Group;
      expect(pavilion).toBeDefined();
      expect(root.getObjectByName(`${name}_Pavilion_Walls`)).toBeDefined();
      expect(root.getObjectByName(`${name}_Pavilion_Limasan_Roof`)).toBeDefined();

      // Check Bastion Artillery
      expect(root.getObjectByName(`${name}_Cannon_Salient`)).toBeDefined();
      expect(root.getObjectByName(`${name}_Cannon_Flank`)).toBeDefined();
    }

    // Projections extend beyond outer perimeter
    const riverWest = root.getObjectByName('Bastion_River_West') as THREE.Group;
    const rwBox = new THREE.Box3().setFromObject(riverWest);
    expect(rwBox.min.x).toBeLessThan(-117);
    expect(rwBox.min.z).toBeLessThan(-57);

    const inlandEast = root.getObjectByName('Bastion_Inland_East') as THREE.Group;
    const ieBox = new THREE.Box3().setFromObject(inlandEast);
    expect(ieBox.max.x).toBeGreaterThan(117);
    expect(ieBox.max.z).toBeGreaterThan(68);

    // Visibility toggle test
    const noCannons = createModel({ showCannons: false });
    expect(noCannons.getObjectByName('Bastion_River_West_Cannon_Salient')).toBeUndefined();
  });

  it('provides the 6 AR ETNO-STEM educational anchors spaced across all architectural zones', () => {
    const root = createModel();
    const anchors = root.getObjectByName('Helpers_And_Anchors') as THREE.Group;
    expect(anchors).toBeDefined();

    const expectedAnchors = [
      'Anchor_BKB_01_Ethno_Sejarah_Keraton',
      'Anchor_BKB_02_Sains_Material_Tembok',
      'Anchor_BKB_03_Teknologi_Pertahanan_Gerbang',
      'Anchor_BKB_04_Rekayasa_Konstruksi_Bastion',
      'Anchor_BKB_05_Matematika_Ruang_Denah',
      'Anchor_BKB_06_Sains_Lingkungan_Sungai',
    ];

    for (const name of expectedAnchors) {
      const anchor = root.getObjectByName(name) as THREE.Group;
      expect(anchor).toBeDefined();
    }

    // Verify spatial dispersion (anchors are not clustered in one spot)
    const p1 = (root.getObjectByName('Anchor_BKB_01_Ethno_Sejarah_Keraton') as THREE.Group).position;
    const p2 = (root.getObjectByName('Anchor_BKB_02_Sains_Material_Tembok') as THREE.Group).position;
    const p3 = (root.getObjectByName('Anchor_BKB_03_Teknologi_Pertahanan_Gerbang') as THREE.Group).position;
    const p4 = (root.getObjectByName('Anchor_BKB_04_Rekayasa_Konstruksi_Bastion') as THREE.Group).position;
    const p5 = (root.getObjectByName('Anchor_BKB_05_Matematika_Ruang_Denah') as THREE.Group).position;
    const p6 = (root.getObjectByName('Anchor_BKB_06_Sains_Lingkungan_Sungai') as THREE.Group).position;

    // Distances between any pair of distinct anchors must be at least 25 meters
    const all = [p1, p2, p3, p4, p5, p6];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(all[i].distanceTo(all[j])).toBeGreaterThan(25);
      }
    }
  });
});


