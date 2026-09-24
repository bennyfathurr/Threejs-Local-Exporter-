import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { createTransformGizmo } from '../src/viewer/transformGizmo';

function createMockElement(tag = 'div'): any {
  const el: any = {
    tagName: tag.toUpperCase(),
    style: {},
    className: '',
    children: [] as any[],
    appendChild: (child: any) => {
      el.children.push(child);
      return child;
    },
    remove: vi.fn(),
    querySelector: () => createMockElement(),
    querySelectorAll: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    clientWidth: 800,
    clientHeight: 600,
  };
  return el;
}

describe('Unity-Style Transform Gizmo Manager', () => {
  beforeAll(() => {
    (globalThis as any).document = {
      createElement: (tag: string) => createMockElement(tag),
      activeElement: null,
    };
    (globalThis as any).window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
    };
  });

  afterAll(() => {
    delete (globalThis as any).document;
    delete (globalThis as any).window;
  });

  it('initializes and attaches to selected 3D mesh', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const domElement = createMockElement('canvas');
    const container = createMockElement('div');

    const mockOrbitControls = {
      enabled: true,
    } as any;

    const onModeChange = vi.fn();
    const onSpaceChange = vi.fn();

    const gizmo = createTransformGizmo({
      scene,
      cameraProvider: () => camera,
      domElement,
      orbitControls: mockOrbitControls,
      container,
      onModeChange,
      onSpaceChange,
    });

    expect(gizmo.mode).toBe('translate');
    expect(gizmo.space).toBe('world');
    expect(gizmo.snapEnabled).toBe(false);
    expect(gizmo.helper).toBeDefined();
    expect(gizmo.helper.userData.isEditorHelper).toBe(true);

    // Target mesh
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    scene.add(mesh);

    // Attach
    gizmo.attach(mesh);
    expect(gizmo.attachedObject).toBe(mesh);
    expect(gizmo.helper.visible).toBe(true);

    // Mode switching
    gizmo.setMode('rotate');
    expect(gizmo.mode).toBe('rotate');
    expect(onModeChange).toHaveBeenCalledWith('rotate');

    gizmo.setMode('scale');
    expect(gizmo.mode).toBe('scale');
    expect(onModeChange).toHaveBeenCalledWith('scale');

    gizmo.setMode('translate');
    expect(gizmo.mode).toBe('translate');

    // Space switching
    const nextSpace = gizmo.toggleSpace();
    expect(nextSpace).toBe('local');
    expect(gizmo.space).toBe('local');
    expect(onSpaceChange).toHaveBeenCalledWith('local');

    // Snapping toggle
    const snapActive = gizmo.toggleSnap();
    expect(snapActive).toBe(true);
    expect(gizmo.snapEnabled).toBe(true);

    // Detach
    gizmo.detach();
    expect(gizmo.attachedObject).toBeNull();
    expect(gizmo.helper.visible).toBe(false);

    gizmo.dispose();
  });
});
