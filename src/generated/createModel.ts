import * as THREE from 'three';

export interface ModelSpec {
  scale?: number;
  buildingHeight?: number;
  hasPool?: boolean;
  hasSolarPanels?: boolean;
  accentColor?: number;
}

export interface ModelOptions {
  editable?: boolean;
  includeColliders?: boolean;
}

/**
 * Procedural Model Factory: Modern Architectural Villa & Pavilion
 * Returns a hierarchical THREE.Group with distinct named meshes,
 * materials, pivots, and parent-child relationships.
 */
export function createModel(spec?: ModelSpec, options?: ModelOptions): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Modern_Architectural_Compound';

  const cfg = {
    scale: spec?.scale ?? 1.0,
    buildingHeight: spec?.buildingHeight ?? 4.0,
    hasPool: spec?.hasPool ?? true,
    hasSolarPanels: spec?.hasSolarPanels ?? true,
    accentColor: spec?.accentColor ?? 0x2563eb, // Vibrant blue
  };

  // 1. Materials palette
  const concreteMat = new THREE.MeshStandardMaterial({
    name: 'Mat_SmoothConcrete',
    color: 0xd4d4d8,
    roughness: 0.85,
    metalness: 0.1,
  });

  const darkPlinthMat = new THREE.MeshStandardMaterial({
    name: 'Mat_BasaltPlinth',
    color: 0x27272a,
    roughness: 0.9,
    metalness: 0.2,
  });

  const wallMat = new THREE.MeshStandardMaterial({
    name: 'Mat_ExteriorPlaster',
    color: 0xf4f4f5,
    roughness: 0.75,
    metalness: 0.05,
  });

  const woodDeckMat = new THREE.MeshStandardMaterial({
    name: 'Mat_TeakDecking',
    color: 0x92400e,
    roughness: 0.6,
    metalness: 0.05,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    name: 'Mat_CurtainGlass',
    color: 0x93c5fd,
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.55,
  });

  const metalTrimMat = new THREE.MeshStandardMaterial({
    name: 'Mat_AnodizedAluminum',
    color: 0x3f3f46,
    roughness: 0.35,
    metalness: 0.85,
  });

  const waterMat = new THREE.MeshStandardMaterial({
    name: 'Mat_PoolWater',
    color: 0x0ea5e9,
    roughness: 0.15,
    metalness: 0.4,
    transparent: true,
    opacity: 0.8,
  });

  const solarMat = new THREE.MeshStandardMaterial({
    name: 'Mat_PhotovoltaicCell',
    color: 0x1e1b4b,
    roughness: 0.25,
    metalness: 0.9,
  });

  const grassMat = new THREE.MeshStandardMaterial({
    name: 'Mat_LandscapeGrass',
    color: 0x4d7c0f,
    roughness: 0.95,
    metalness: 0.0,
  });

  // 2. Foundation Plinth
  const plinthGeo = new THREE.BoxGeometry(20, 0.6, 16);
  const foundationPlinth = new THREE.Mesh(plinthGeo, darkPlinthMat);
  foundationPlinth.name = 'Foundation_Plinth';
  foundationPlinth.position.set(0, 0.3, 0);
  foundationPlinth.castShadow = true;
  foundationPlinth.receiveShadow = true;
  root.add(foundationPlinth);

  // Landscape surround
  const landscapeGeo = new THREE.BoxGeometry(26, 0.2, 22);
  const landscapeBed = new THREE.Mesh(landscapeGeo, grassMat);
  landscapeBed.name = 'Landscape_Surround';
  landscapeBed.position.set(0, 0.1, 0);
  landscapeBed.receiveShadow = true;
  root.add(landscapeBed);

  // 3. Main Villa Structure Group
  const villaGroup = new THREE.Group();
  villaGroup.name = 'Main_Villa_Structure';
  villaGroup.position.set(-2, 0.6, 0);

  // Ground Floor Living Wing
  const groundWallGeo = new THREE.BoxGeometry(10, 3.2, 8);
  const groundWalls = new THREE.Mesh(groundWallGeo, wallMat);
  groundWalls.name = 'Ground_Floor_Walls';
  groundWalls.position.set(0, 1.6, 0);
  groundWalls.castShadow = true;
  groundWalls.receiveShadow = true;
  villaGroup.add(groundWalls);

  // Glass Facade Curtain Wall
  const glassGeo = new THREE.BoxGeometry(0.15, 2.8, 6);
  const glassFacade = new THREE.Mesh(glassGeo, glassMat);
  glassFacade.name = 'Curtain_Glass_Facade';
  glassFacade.position.set(5.05, 1.6, 0);
  glassFacade.castShadow = false;
  villaGroup.add(glassFacade);

  // Upper Floor Cantilevered Wing
  const upperWingGeo = new THREE.BoxGeometry(11, 2.8, 7);
  const upperWing = new THREE.Mesh(upperWingGeo, concreteMat);
  upperWing.name = 'Upper_Floor_Cantilever';
  upperWing.position.set(1.5, 4.6, 0.5);
  upperWing.castShadow = true;
  upperWing.receiveShadow = true;
  villaGroup.add(upperWing);

  // Structural Support Columns
  const columnGeo = new THREE.CylinderGeometry(0.2, 0.2, 3.2, 16);
  const columnGroup = new THREE.Group();
  columnGroup.name = 'Structural_Columns_Pivot';

  const colA = new THREE.Mesh(columnGeo, metalTrimMat);
  colA.name = 'Column_Southeast';
  colA.position.set(6, 1.6, 3.2);
  colA.castShadow = true;
  columnGroup.add(colA);

  const colB = new THREE.Mesh(columnGeo, metalTrimMat);
  colB.name = 'Column_Northeast';
  colB.position.set(6, 1.6, -2.5);
  colB.castShadow = true;
  columnGroup.add(colB);

  villaGroup.add(columnGroup);
  root.add(villaGroup);

  // 4. Roof & Canopy Assembly
  const roofAssembly = new THREE.Group();
  roofAssembly.name = 'Roof_Assembly';
  roofAssembly.position.set(-0.5, 6.0, 0.5);

  const roofSlabGeo = new THREE.BoxGeometry(13, 0.4, 8.5);
  const roofSlab = new THREE.Mesh(roofSlabGeo, metalTrimMat);
  roofSlab.name = 'Overhang_Roof_Slab';
  roofSlab.position.set(0, 0.2, 0);
  roofSlab.castShadow = true;
  roofAssembly.add(roofSlab);

  if (cfg.hasSolarPanels) {
    const solarArray = new THREE.Group();
    solarArray.name = 'Photovoltaic_Array';
    solarArray.position.set(0, 0.45, 0);

    const panelGeo = new THREE.BoxGeometry(2.4, 0.08, 1.4);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const panel = new THREE.Mesh(panelGeo, solarMat);
        panel.name = `Solar_Module_R${i + 2}_C${j + 2}`;
        panel.position.set(i * 2.8, 0.05, j * 1.8);
        panel.rotation.x = -0.15; // Slanted towards sun
        panel.castShadow = true;
        solarArray.add(panel);
      }
    }
    roofAssembly.add(solarArray);
  }

  // Communications Antenna Mast
  const mastGeo = new THREE.CylinderGeometry(0.04, 0.08, 2.5, 8);
  const antennaMast = new THREE.Mesh(mastGeo, metalTrimMat);
  antennaMast.name = 'Communications_Mast';
  antennaMast.position.set(5.5, 1.4, -3.2);
  roofAssembly.add(antennaMast);

  root.add(roofAssembly);

  // 5. Outdoor Terrace & Reflecting Pool
  const terraceGroup = new THREE.Group();
  terraceGroup.name = 'Outdoor_Terrace_Zone';
  terraceGroup.position.set(6, 0.6, 0);

  // Wood Deck
  const deckGeo = new THREE.BoxGeometry(6.5, 0.15, 12);
  const deck = new THREE.Mesh(deckGeo, woodDeckMat);
  deck.name = 'Hardwood_Sun_Deck';
  deck.position.set(0, 0.08, 0);
  deck.receiveShadow = true;
  terraceGroup.add(deck);

  if (cfg.hasPool) {
    const poolGroup = new THREE.Group();
    poolGroup.name = 'Reflecting_Pool_Assembly';
    poolGroup.position.set(0.5, 0, 0);

    const basinBorderGeo = new THREE.BoxGeometry(4.2, 0.4, 7.2);
    const basinBorder = new THREE.Mesh(basinBorderGeo, darkPlinthMat);
    basinBorder.name = 'Pool_Coping_Border';
    basinBorder.position.set(0, 0.2, 0);
    poolGroup.add(basinBorder);

    const waterGeo = new THREE.PlaneGeometry(3.6, 6.6);
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.name = 'Water_Surface';
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(0, 0.38, 0);
    poolGroup.add(waterMesh);

    terraceGroup.add(poolGroup);
  }

  // Entrance Steps
  const stepsGroup = new THREE.Group();
  stepsGroup.name = 'Entrance_Staircase';
  const stepGeo = new THREE.BoxGeometry(1.2, 0.15, 3.5);
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(stepGeo, concreteMat);
    step.name = `Entry_Step_Tread_${s + 1}`;
    step.position.set(3.2 + s * 0.4, -s * 0.15, 0);
    step.receiveShadow = true;
    stepsGroup.add(step);
  }
  terraceGroup.add(stepsGroup);

  root.add(terraceGroup);

  // 6. Perimeter Landscape Pergola
  const pergola = new THREE.Group();
  pergola.name = 'Shade_Pergola_Pivots';
  pergola.position.set(4, 3.2, 4);

  const slatGeo = new THREE.BoxGeometry(0.12, 0.25, 4.5);
  for (let k = 0; k < 6; k++) {
    const slat = new THREE.Mesh(slatGeo, metalTrimMat);
    slat.name = `Pergola_Louver_${k + 1}`;
    slat.position.set((k - 2.5) * 0.7, 0, 0);
    slat.castShadow = true;
    pergola.add(slat);
  }
  root.add(pergola);

  // Apply scaling option
  if (cfg.scale !== 1.0) {
    root.scale.setScalar(cfg.scale);
  }

  return root;
}
