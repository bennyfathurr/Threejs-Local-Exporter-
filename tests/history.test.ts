import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  HistoryManager,
  captureTransform,
  applyTransform,
  transformsEqual,
  HistoryEvent,
} from '../src/model/history';

describe('HistoryManager (Undo & Redo System)', () => {
  it('initializes with empty stacks and correct flags', () => {
    const history = new HistoryManager();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undoCount).toBe(0);
    expect(history.redoCount).toBe(0);
  });

  it('records actions, executes undo and redo, and updates flags', () => {
    const history = new HistoryManager();
    const target = new THREE.Object3D();
    target.position.set(0, 0, 0);

    const prevPos = target.position.clone();
    target.position.set(10, 5, 2);
    const newPos = target.position.clone();

    const undoFn = vi.fn(() => target.position.copy(prevPos));
    const redoFn = vi.fn(() => target.position.copy(newPos));

    history.push({
      name: 'Move Object',
      undo: undoFn,
      redo: redoFn,
    });

    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    expect(history.undoCount).toBe(1);

    // Undo
    const undoSuccess = history.undo();
    expect(undoSuccess).toBe(true);
    expect(undoFn).toHaveBeenCalledTimes(1);
    expect(target.position.x).toBe(0);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);

    // Redo
    const redoSuccess = history.redo();
    expect(redoSuccess).toBe(true);
    expect(redoFn).toHaveBeenCalledTimes(1);
    expect(target.position.x).toBe(10);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it('clears redo stack when a new action is pushed after an undo', () => {
    const history = new HistoryManager();
    history.push({ name: 'Action 1', undo: () => {}, redo: () => {} });
    history.push({ name: 'Action 2', undo: () => {}, redo: () => {} });
    expect(history.undoCount).toBe(2);

    history.undo();
    expect(history.canRedo).toBe(true);
    expect(history.redoCount).toBe(1);

    // Push new action: Redo stack must be purged
    history.push({ name: 'Action 3', undo: () => {}, redo: () => {} });
    expect(history.canRedo).toBe(false);
    expect(history.redoCount).toBe(0);
    expect(history.undoCount).toBe(2);
  });

  it('caps undo history at maxStackSize', () => {
    const history = new HistoryManager(3);
    for (let i = 1; i <= 5; i++) {
      history.push({ name: `Action ${i}`, undo: () => {}, redo: () => {} });
    }
    expect(history.undoCount).toBe(3);
  });

  it('notifies listeners on push, undo, redo, and clear', () => {
    const history = new HistoryManager();
    const events: HistoryEvent[] = [];
    const unsubscribe = history.addListener((e) => events.push(e));

    history.push({ name: 'Move', undo: () => {}, redo: () => {} });
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('push');
    expect(events[0].actionName).toBe('Move');

    history.undo();
    expect(events.length).toBe(2);
    expect(events[1].type).toBe('undo');

    history.redo();
    expect(events.length).toBe(3);
    expect(events[2].type).toBe('redo');

    history.clear();
    expect(events.length).toBe(4);
    expect(events[3].type).toBe('clear');
    expect(history.canUndo).toBe(false);

    unsubscribe();
    history.push({ name: 'After Unsubscribe', undo: () => {}, redo: () => {} });
    expect(events.length).toBe(4);
  });

  it('accurately captures, compares, and restores 3D object transforms', () => {
    const obj = new THREE.Object3D();
    obj.position.set(1.5, 2.5, 3.5);
    obj.rotation.set(0.1, 0.2, 0.3);
    obj.scale.set(1.2, 1.2, 1.2);

    const snapshot1 = captureTransform(obj);
    expect(snapshot1.position.x).toBeCloseTo(1.5);
    expect(snapshot1.scale.x).toBeCloseTo(1.2);

    // Modify
    obj.position.set(10, 20, 30);
    const snapshot2 = captureTransform(obj);
    expect(transformsEqual(snapshot1, snapshot2)).toBe(false);

    // Restore
    applyTransform(obj, snapshot1);
    expect(obj.position.x).toBeCloseTo(1.5);
    expect(obj.position.y).toBeCloseTo(2.5);
    expect(obj.position.z).toBeCloseTo(3.5);

    const snapshot3 = captureTransform(obj);
    expect(transformsEqual(snapshot1, snapshot3)).toBe(true);
  });
});
