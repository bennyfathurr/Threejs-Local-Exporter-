import { describe, it, expect } from 'vitest';
import {
  IMG2THREEJS_SYSTEM_PROMPT,
  buildUserPrompt,
  extractCodeFromResponse,
} from '../src/ai/systemPrompt';
import { loadLlmConfig, saveLlmConfig } from '../src/ai/llmService';

describe('AI img2threejs Prompt Engineering & Parsing', () => {
  it('enforces real 3D geometry and no-billboard constraints in system prompt', () => {
    expect(IMG2THREEJS_SYSTEM_PROMPT).toContain('NEVER USE A SINGLE FLAT PLANE OR BILLBOARD');
    expect(IMG2THREEJS_SYSTEM_PROMPT).toContain('export function createModel');
    expect(IMG2THREEJS_SYSTEM_PROMPT).toContain('THREE.MeshStandardMaterial');
    expect(IMG2THREEJS_SYSTEM_PROMPT).toContain('AT LEAST 8 to 15 separately named meshes');
  });

  it('builds user prompt with optional instructions', () => {
    const defaultPrompt = buildUserPrompt();
    expect(defaultPrompt).toContain('proportions, colors, and separate physical components');

    const customPrompt = buildUserPrompt('Focus on the cantilever deck and solar panels');
    expect(customPrompt).toContain('Focus on the cantilever deck and solar panels');
  });

  it('extracts pure TypeScript code from markdown code blocks', () => {
    const rawResponse = `
Here is the procedural model for the uploaded architectural image:

\`\`\`ts
import * as THREE from 'three';

export function createModel() {
  const root = new THREE.Group();
  root.name = 'Test_Building';
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial());
  box.name = 'Main_Block';
  root.add(box);
  return root;
}
\`\`\`

Hope this helps! Let me know if you need changes.
`;

    const extracted = extractCodeFromResponse(rawResponse);
    expect(extracted).toContain('import * as THREE from \'three\';');
    expect(extracted).toContain('export function createModel()');
    expect(extracted).not.toContain('```');
    expect(extracted).not.toContain('Here is the procedural model');
  });

  it('handles raw code without markdown backticks gracefully', () => {
    const rawCode = `export function createModel() { return new THREE.Group(); }`;
    const extracted = extractCodeFromResponse(rawCode);
    expect(extracted).toBe(rawCode);
  });
});
