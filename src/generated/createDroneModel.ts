import * as THREE from 'three';

export interface DroneSpec {
  scale?: number;
  rotorArmCount?: number;
  colorScheme?: 'stealth' | 'industrial' | 'arctic';
}

/**
 * Procedural Model Factory: Modular Autonomous Survey Drone
 * Features 15+ named separate components, motor pivots, sensor gimbal, and landing gear.
 */
export function createDroneModel(spec?: DroneSpec): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Autonomous_Survey_Drone';

  const cfg = {
    scale: spec?.scale ?? 1.0,
    colorScheme: spec?.colorScheme ?? 'industrial',
  };

  const bodyColor = cfg.colorScheme === 'stealth' ? 0x18181b : cfg.colorScheme === 'arctic' ? 0xf8fafc : 0x0284c7;
  const accentColor = cfg.colorScheme === 'industrial' ? 0xf59e0b : 0xef4444;

  const carbonFiberMat = new THREE.MeshStandardMaterial({
    name: 'Mat_CarbonFiberWeave',
    color: 0x1f2937,
    roughness: 0.4,
    metalness: 0.6,
  });

  const chassisMat = new THREE.MeshStandardMaterial({
    name: 'Mat_AnodizedAlloy',
    color: bodyColor,
    roughness: 0.3,
    metalness: 0.7,
  });

  const hazardAccentMat = new THREE.MeshStandardMaterial({
    name: 'Mat_HazardAccent',
    color: accentColor,
    roughness: 0.25,
    metalness: 0.4,
  });

  const rotorMat = new THREE.MeshStandardMaterial({
    name: 'Mat_PolycarbonateRotor',
    color: 0x111827,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });

  const lensMat = new THREE.MeshStandardMaterial({
    name: 'Mat_OpticsGlass',
    color: 0x06b6d4,
    roughness: 0.05,
    metalness: 0.9,
  });

  // 1. Central Core Fuselage
  const coreGroup = new THREE.Group();
  coreGroup.name = 'Central_Fuselage_Core';

  const mainBodyGeo = new THREE.CylinderGeometry(1.2, 1.5, 0.8, 8);
  const mainBody = new THREE.Mesh(mainBodyGeo, chassisMat);
  mainBody.name = 'Chassis_Aerodynamic_Shell';
  mainBody.position.y = 1.6;
  mainBody.castShadow = true;
  coreGroup.add(mainBody);

  const topCapGeo = new THREE.SphereGeometry(0.8, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const topCap = new THREE.Mesh(topCapGeo, carbonFiberMat);
  topCap.name = 'Avionics_Dome';
  topCap.position.y = 2.0;
  coreGroup.add(topCap);

  // Status LED ring
  const ledGeo = new THREE.TorusGeometry(0.85, 0.06, 8, 24);
  const ledRing = new THREE.Mesh(ledGeo, hazardAccentMat);
  ledRing.name = 'Status_Indicator_Ring';
  ledRing.rotation.x = Math.PI / 2;
  ledRing.position.y = 1.95;
  coreGroup.add(ledRing);

  root.add(coreGroup);

  // 2. Motor Arms & Rotors (4 Quadrants)
  const armConfigs = [
    { name: 'Front_Right', angle: Math.PI * 0.25, dir: 1 },
    { name: 'Front_Left', angle: Math.PI * 0.75, dir: -1 },
    { name: 'Rear_Left', angle: Math.PI * 1.25, dir: 1 },
    { name: 'Rear_Right', angle: Math.PI * 1.75, dir: -1 },
  ];

  armConfigs.forEach((cfg) => {
    const armPivot = new THREE.Group();
    armPivot.name = `Arm_Pivot_${cfg.name}`;
    armPivot.position.set(0, 1.6, 0);
    armPivot.rotation.y = cfg.angle;

    // Structural boom
    const boomGeo = new THREE.BoxGeometry(2.4, 0.18, 0.25);
    const boom = new THREE.Mesh(boomGeo, carbonFiberMat);
    boom.name = `Spar_Boom_${cfg.name}`;
    boom.position.set(1.4, 0, 0);
    boom.castShadow = true;
    armPivot.add(boom);

    // Motor Pod
    const motorPodGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.5, 16);
    const motorPod = new THREE.Mesh(motorPodGeo, hazardAccentMat);
    motorPod.name = `Motor_Nacelle_${cfg.name}`;
    motorPod.position.set(2.6, 0.15, 0);
    motorPod.castShadow = true;
    armPivot.add(motorPod);

    // Rotor Hub Assembly
    const rotorHub = new THREE.Group();
    rotorHub.name = `Rotor_Hub_${cfg.name}`;
    rotorHub.position.set(2.6, 0.45, 0);

    const bladeGeo = new THREE.BoxGeometry(2.2, 0.04, 0.22);
    const blade1 = new THREE.Mesh(bladeGeo, rotorMat);
    blade1.name = `Rotor_Blade_A_${cfg.name}`;
    blade1.castShadow = true;
    rotorHub.add(blade1);

    const blade2 = new THREE.Mesh(bladeGeo, rotorMat);
    blade2.name = `Rotor_Blade_B_${cfg.name}`;
    blade2.rotation.y = Math.PI / 2;
    blade2.castShadow = true;
    rotorHub.add(blade2);

    armPivot.add(rotorHub);
    root.add(armPivot);
  });

  // 3. Sensor Gimbal Assembly
  const gimbalGroup = new THREE.Group();
  gimbalGroup.name = 'MultiSensor_Gimbal_Assembly';
  gimbalGroup.position.set(0, 1.1, 0.4);

  const yokeGeo = new THREE.TorusGeometry(0.5, 0.08, 8, 16, Math.PI);
  const yoke = new THREE.Mesh(yokeGeo, carbonFiberMat);
  yoke.name = 'Gimbal_Pitch_Yoke';
  yoke.rotation.z = Math.PI;
  gimbalGroup.add(yoke);

  const cameraGeo = new THREE.SphereGeometry(0.35, 16, 16);
  const cameraBall = new THREE.Mesh(cameraGeo, chassisMat);
  cameraBall.name = 'Optical_Camera_Sphere';
  cameraBall.position.set(0, -0.2, 0);
  cameraBall.castShadow = true;

  const lensGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.15, 16);
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.name = 'HighRes_Optical_Lens';
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0, 0.3);
  cameraBall.add(lens);

  gimbalGroup.add(cameraBall);
  root.add(gimbalGroup);

  // 4. Landing Gear Skids
  const landingGear = new THREE.Group();
  landingGear.name = 'Carbon_Landing_Gear';

  const skidGeo = new THREE.BoxGeometry(0.12, 0.12, 3.6);
  const strutGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8);

  ['Port', 'Starboard'].forEach((side, idx) => {
    const sideSign = idx === 0 ? -1 : 1;
    const skidSide = new THREE.Group();
    skidSide.name = `Landing_Assembly_${side}`;

    const runner = new THREE.Mesh(skidGeo, carbonFiberMat);
    runner.name = `Skid_Runner_${side}`;
    runner.position.set(sideSign * 1.5, 0.1, 0);
    runner.castShadow = true;
    skidSide.add(runner);

    const strutFwd = new THREE.Mesh(strutGeo, carbonFiberMat);
    strutFwd.name = `Skid_Strut_Fwd_${side}`;
    strutFwd.position.set(sideSign * 1.1, 0.7, 0.9);
    strutFwd.rotation.z = sideSign * 0.45;
    strutFwd.castShadow = true;
    skidSide.add(strutFwd);

    const strutAft = new THREE.Mesh(strutGeo, carbonFiberMat);
    strutAft.name = `Skid_Strut_Aft_${side}`;
    strutAft.position.set(sideSign * 1.1, 0.7, -0.9);
    strutAft.rotation.z = sideSign * 0.45;
    strutAft.castShadow = true;
    skidSide.add(strutAft);

    landingGear.add(skidSide);
  });

  root.add(landingGear);

  if (cfg.scale !== 1.0) {
    root.scale.setScalar(cfg.scale);
  }

  return root;
}
