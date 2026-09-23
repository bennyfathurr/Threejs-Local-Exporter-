import * as THREE from 'three';
import { transform } from 'sucrase';

export interface CodeRunResult {
  model: THREE.Object3D;
  exportedNames: string[];
}

/**
 * Compiles and executes arbitrary TypeScript or JavaScript procedural model code
 * directly in the browser using Sucrase, providing THREE in the sandbox scope.
 */
export function executeProceduralCode(
  code: string,
  spec: unknown = {},
  options: unknown = {}
): CodeRunResult {
  if (!code || !code.trim()) {
    throw new Error('Code is empty. Please provide TypeScript or JavaScript code.');
  }

  // 1. Transpile TS + ESM syntax to CommonJS
  let jsCode: string;
  try {
    jsCode = transform(code, {
      transforms: ['typescript', 'imports'],
    }).code;
  } catch (err) {
    throw new Error(`TypeScript Compilation Error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Prepare Sandbox Scope
  const exportsObj: Record<string, unknown> = {};
  const moduleObj = { exports: exportsObj };

  const customRequire = (moduleName: string) => {
    if (moduleName === 'three' || moduleName.startsWith('three/')) {
      return THREE;
    }
    throw new Error(
      `Module "${moduleName}" is not available in the browser sandbox. Only "three" is supported.`
    );
  };

  // 3. Execute
  try {
    const fn = new Function('require', 'exports', 'module', 'THREE', jsCode);
    fn(customRequire, exportsObj, moduleObj, THREE);
  } catch (err) {
    throw new Error(`Runtime Execution Error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const exported = moduleObj.exports as Record<string, unknown>;
  const exportedNames = Object.keys(exported);

  let modelResult: THREE.Object3D | null = null;

  // Strategy A: Known factory function names
  const candidateFunctions = ['createModel', 'default', 'generateModel', 'buildModel'];
  for (const fnName of candidateFunctions) {
    if (typeof exported[fnName] === 'function') {
      try {
        const res = (exported[fnName] as (spec?: unknown, opt?: unknown) => unknown)(spec, options);
        if (res instanceof THREE.Object3D) {
          modelResult = res;
          break;
        }
      } catch (err) {
        throw new Error(`Error executing "${fnName}()": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // Strategy B: Object3D instance directly exported
  if (!modelResult) {
    if (exported.default instanceof THREE.Object3D) {
      modelResult = exported.default;
    } else {
      for (const key of exportedNames) {
        if (exported[key] instanceof THREE.Object3D) {
          modelResult = exported[key] as THREE.Object3D;
          break;
        }
      }
    }
  }

  // Strategy C: Any exported function that returns an Object3D
  if (!modelResult) {
    for (const key of exportedNames) {
      if (typeof exported[key] === 'function') {
        try {
          const res = (exported[key] as (spec?: unknown, opt?: unknown) => unknown)(spec, options);
          if (res instanceof THREE.Object3D) {
            modelResult = res;
            break;
          }
        } catch {
          // Ignore and continue checking
        }
      }
    }
  }

  if (!modelResult) {
    throw new Error(
      'No valid 3D model found. Your code must export a function (e.g. "export function createModel(spec?, options?): THREE.Group") that returns a THREE.Object3D or THREE.Group.'
    );
  }

  if (!modelResult.name) {
    modelResult.name = 'Custom_Procedural_Model';
  }

  return {
    model: modelResult,
    exportedNames,
  };
}
