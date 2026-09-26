import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface SceneContext {
  scene: THREE.Scene;
  modelGroup: THREE.Group;
  renderer: THREE.WebGLRenderer;
  perspectiveCamera: THREE.PerspectiveCamera;
  orthographicCamera: THREE.OrthographicCamera;
  activeCamera: THREE.Camera;
  controls: OrbitControls;
  gridHelper: THREE.GridHelper;
  axesHelper: THREE.AxesHelper;
  dirLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  setCameraType: (type: 'perspective' | 'orthographic') => void;
  resetCamera: () => void;
  setViewDirection: (view: 'top' | 'bottom' | 'left' | 'right') => void;
  frameObject: (object: THREE.Object3D) => void;
  setGridVisible: (visible: boolean) => void;
  setAxesVisible: (visible: boolean) => void;
  setShadowsEnabled: (enabled: boolean) => void;
  setBackgroundColor: (color: string, transparent: boolean) => void;
  addCameraChangeListener: (listener: (camera: THREE.Camera) => void) => () => void;
  dispose: () => void;
}

export function createScene(container: HTMLElement): SceneContext {
  // 1. Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f111a);

  // Group that holds the active procedural model
  const modelGroup = new THREE.Group();
  modelGroup.name = 'Procedural_Model_Container';
  scene.add(modelGroup);

  // 2. Camera setup
  const aspect = container.clientWidth / container.clientHeight;
  const perspectiveCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  perspectiveCamera.position.set(15, 12, 18);

  const frustumSize = 25;
  let currentOrthoHeight = frustumSize;
  const orthographicCamera = new THREE.OrthographicCamera(
    (-frustumSize * aspect) / 2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    -frustumSize / 2,
    0.1,
    1000
  );
  orthographicCamera.position.set(15, 12, 18);

  let activeCamera: THREE.Camera = perspectiveCamera;
  let lastPerspectivePosition = perspectiveCamera.position.clone();
  let lastPerspectiveTarget = new THREE.Vector3(0, 2, 0);

  // 3. Renderer setup
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  container.appendChild(renderer.domElement);

  // 4. Orbit Controls
  const controls = new OrbitControls(activeCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxDistance = 500;
  controls.minDistance = 0.5;
  controls.target.set(0, 2, 0);
  controls.update();

  // 5. Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.9);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
  dirLight.position.set(20, 35, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 150;
  dirLight.shadow.camera.left = -25;
  dirLight.shadow.camera.right = 25;
  dirLight.shadow.camera.top = 25;
  dirLight.shadow.camera.bottom = -25;
  dirLight.shadow.bias = -0.0002;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
  fillLight.position.set(-20, 15, -20);
  scene.add(fillLight);

  // 6. Helpers
  const gridHelper = new THREE.GridHelper(40, 40, 0x6366f1, 0x1e293b);
  gridHelper.position.y = 0;
  gridHelper.userData = { isEditorHelper: true };
  scene.add(gridHelper);

  const axesHelper = new THREE.AxesHelper(3);
  axesHelper.position.y = 0.01;
  axesHelper.userData = { isEditorHelper: true };
  scene.add(axesHelper);

  const cameraListeners = new Set<(camera: THREE.Camera) => void>();
  const notifyCameraChange = () => {
    for (const listener of cameraListeners) {
      listener(activeCamera);
    }
  };

  const addCameraChangeListener = (listener: (camera: THREE.Camera) => void) => {
    cameraListeners.add(listener);
    return () => {
      cameraListeners.delete(listener);
    };
  };

  // Helper methods
  const setCameraType = (type: 'perspective' | 'orthographic') => {
    const prevPos = activeCamera.position.clone();
    const prevTarget = controls.target.clone();

    if (type === 'orthographic') {
      if (activeCamera === perspectiveCamera) {
        lastPerspectivePosition = perspectiveCamera.position.clone();
        lastPerspectiveTarget = controls.target.clone();
      }
      const currentAspect = container.clientWidth / container.clientHeight;
      orthographicCamera.left = (-currentOrthoHeight * currentAspect) / 2;
      orthographicCamera.right = (currentOrthoHeight * currentAspect) / 2;
      orthographicCamera.top = currentOrthoHeight / 2;
      orthographicCamera.bottom = -currentOrthoHeight / 2;
      orthographicCamera.updateProjectionMatrix();

      orthographicCamera.position.copy(prevPos);
      activeCamera = orthographicCamera;
    } else {
      perspectiveCamera.position.copy(lastPerspectivePosition);
      activeCamera = perspectiveCamera;
      controls.target.copy(lastPerspectiveTarget);
    }

    controls.object = activeCamera;
    if (type === 'orthographic') controls.target.copy(prevTarget);
    controls.update();
    notifyCameraChange();
  };

  const setViewDirection = (view: 'top' | 'bottom' | 'left' | 'right') => {
    if (activeCamera === perspectiveCamera) {
      lastPerspectivePosition = perspectiveCamera.position.clone();
      lastPerspectiveTarget = controls.target.clone();
    }
    const box = new THREE.Box3().setFromObject(modelGroup);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const currentAspect = Math.max(container.clientWidth / container.clientHeight, 0.1);
    const topOrBottom = view === 'top' || view === 'bottom';
    const visibleWidth = size.x;
    const visibleHeight = topOrBottom ? size.z : size.y;
    const height = Math.max(visibleHeight * 1.18, visibleWidth / currentAspect * 1.18, 5);
    currentOrthoHeight = height;
    orthographicCamera.zoom = 1;
    orthographicCamera.left = -height * currentAspect / 2;
    orthographicCamera.right = height * currentAspect / 2;
    orthographicCamera.top = height / 2;
    orthographicCamera.bottom = -height / 2;
    orthographicCamera.updateProjectionMatrix();
    orthographicCamera.up.set(0, topOrBottom ? 0 : 1, view === 'top' ? -1 : view === 'bottom' ? 1 : 0);
    const offset = view === 'top' ? new THREE.Vector3(0, 100, 0)
      : view === 'bottom' ? new THREE.Vector3(0, -100, 0)
        : view === 'left' ? new THREE.Vector3(0, 0, -100)
          : new THREE.Vector3(0, 0, 100);
    orthographicCamera.position.copy(center).add(offset);
    orthographicCamera.lookAt(center);
    activeCamera = orthographicCamera;
    controls.object = activeCamera;
    controls.target.copy(center);
    controls.update();
    notifyCameraChange();
  };

  const resetCamera = () => {
    activeCamera.position.set(15, 12, 18);
    controls.target.set(0, 2, 0);
    if (activeCamera === perspectiveCamera) {
      lastPerspectivePosition = perspectiveCamera.position.clone();
      lastPerspectiveTarget = controls.target.clone();
    }
    controls.update();
    notifyCameraChange();
  };

  const frameObject = (object: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (perspectiveCamera.fov * Math.PI) / 180;
    let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
    cameraDistance = Math.max(cameraDistance, 3);

    const requested = object.userData.preferredViewDirection as number[] | undefined;
    const direction = requested?.length === 3 && requested.every(Number.isFinite)
      ? new THREE.Vector3(requested[0], requested[1], requested[2]).normalize()
      : new THREE.Vector3(1, 0.7, 1).normalize();
    activeCamera.position.copy(center).addScaledVector(direction, cameraDistance);
    controls.target.copy(center);
    controls.update();
  };

  const setGridVisible = (visible: boolean) => {
    gridHelper.visible = visible;
  };

  const setAxesVisible = (visible: boolean) => {
    axesHelper.visible = visible;
  };

  const setShadowsEnabled = (enabled: boolean) => {
    dirLight.castShadow = enabled;
    renderer.shadowMap.enabled = enabled;
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = enabled;
        obj.receiveShadow = enabled;
      }
    });
  };

  const setBackgroundColor = (color: string, transparent: boolean) => {
    if (transparent) {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
    } else {
      scene.background = new THREE.Color(color);
      renderer.setClearColor(new THREE.Color(color), 1);
    }
  };

  // Resize handler
  const handleResize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    const newAspect = width / height;
    perspectiveCamera.aspect = newAspect;
    perspectiveCamera.updateProjectionMatrix();

    orthographicCamera.left = (-currentOrthoHeight * newAspect) / 2;
    orthographicCamera.right = (currentOrthoHeight * newAspect) / 2;
    orthographicCamera.top = currentOrthoHeight / 2;
    orthographicCamera.bottom = -currentOrthoHeight / 2;
    orthographicCamera.updateProjectionMatrix();

    renderer.setSize(width, height);
  };

  window.addEventListener('resize', handleResize);

  // Animation render loop
  let animationFrameId: number;
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, activeCamera);
  };
  animate();

  const dispose = () => {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', handleResize);
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  };

  return {
    scene,
    modelGroup,
    renderer,
    perspectiveCamera,
    orthographicCamera,
    get activeCamera() { return activeCamera; },
    controls,
    gridHelper,
    axesHelper,
    dirLight,
    hemiLight,
    setCameraType,
    resetCamera,
    setViewDirection,
    frameObject,
    setGridVisible,
    setAxesVisible,
    setShadowsEnabled,
    setBackgroundColor,
    addCameraChangeListener,
    dispose,
  };
}
