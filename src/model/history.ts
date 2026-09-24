import * as THREE from 'three';

export interface HistoryAction {
  name: string;
  undo: () => void;
  redo: () => void;
}

export interface TransformSnapshot {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

export function captureTransform(object: THREE.Object3D): TransformSnapshot {
  return {
    position: object.position.clone(),
    rotation: object.rotation.clone(),
    scale: object.scale.clone(),
  };
}

export function transformsEqual(a: TransformSnapshot, b: TransformSnapshot, epsilon = 0.0001): boolean {
  return (
    a.position.distanceTo(b.position) < epsilon &&
    Math.abs(a.rotation.x - b.rotation.x) < epsilon &&
    Math.abs(a.rotation.y - b.rotation.y) < epsilon &&
    Math.abs(a.rotation.z - b.rotation.z) < epsilon &&
    a.scale.distanceTo(b.scale) < epsilon
  );
}

export function applyTransform(object: THREE.Object3D, snapshot: TransformSnapshot): void {
  object.position.copy(snapshot.position);
  object.rotation.copy(snapshot.rotation);
  object.scale.copy(snapshot.scale);
  object.updateMatrixWorld(true);
}

export interface HistoryEvent {
  type: 'push' | 'undo' | 'redo' | 'clear';
  actionName?: string;
  canUndo: boolean;
  canRedo: boolean;
}

export class HistoryManager {
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];
  private maxStackSize: number;
  private listeners: Set<(event: HistoryEvent) => void> = new Set();

  constructor(maxStackSize = 50) {
    this.maxStackSize = maxStackSize;
  }

  public get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public get undoCount(): number {
    return this.undoStack.length;
  }

  public get redoCount(): number {
    return this.redoStack.length;
  }

  public push(action: HistoryAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
    this.notify({
      type: 'push',
      actionName: action.name,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
    });
  }

  public undo(): boolean {
    if (!this.canUndo) return false;
    const action = this.undoStack.pop()!;
    action.undo();
    this.redoStack.push(action);
    this.notify({
      type: 'undo',
      actionName: action.name,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
    });
    return true;
  }

  public redo(): boolean {
    if (!this.canRedo) return false;
    const action = this.redoStack.pop()!;
    action.redo();
    this.undoStack.push(action);
    this.notify({
      type: 'redo',
      actionName: action.name,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
    });
    return true;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify({
      type: 'clear',
      canUndo: false,
      canRedo: false,
    });
  }

  public addListener(listener: (event: HistoryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(event: HistoryEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
