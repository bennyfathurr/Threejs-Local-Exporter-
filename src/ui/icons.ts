/**
 * Modern SVG Icon System for Three.js Model Studio
 * Crisp, scalable, cohesive geometric and UI icons.
 */

export const svgIcon = (content: string, size = 14, className = 'svg-icon'): string => `
  <svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; flex-shrink:0;">
    ${content}
  </svg>
`;

export const ICONS = {
  // Brand Logo
  logo: (size = 18): string => `
    <svg width="${size}" height="${size}" viewBox="0 0 28 28" fill="none" style="display:inline-block; vertical-align:middle; flex-shrink:0;">
      <defs>
        <linearGradient id="logo-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#6366f1"/>
        </linearGradient>
        <linearGradient id="logo-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#06b6d4"/>
          <stop offset="100%" stop-color="#3b82f6"/>
        </linearGradient>
      </defs>
      <!-- Top Face -->
      <polygon points="14,3 25,9 14,15 3,9" fill="url(#logo-grad-1)" opacity="0.95" />
      <!-- Left Face -->
      <polygon points="3,9 14,15 14,25 3,19" fill="url(#logo-grad-2)" opacity="0.8" />
      <!-- Right Face -->
      <polygon points="14,15 25,9 25,19 14,25" fill="#4338ca" opacity="0.9" />
      <!-- Core Coordinate Lines -->
      <line x1="14" y1="15" x2="14" y2="3" stroke="#ffffff" stroke-width="1.2" opacity="0.6" stroke-dasharray="2 2" />
    </svg>
  `,

  // Core Toolbar Actions
  undo: (size = 13): string => svgIcon(
    '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    size
  ),
  redo: (size = 13): string => svgIcon(
    '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"/>',
    size
  ),
  save: (size = 13): string => svgIcon(
    '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    size
  ),
  folder: (size = 13): string => svgIcon(
    '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
    size
  ),
  code: (size = 13): string => svgIcon(
    '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    size
  ),
  sparkles: (size = 13): string => svgIcon(
    '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M19 3v4"/><path d="M21 5h-4"/>',
    size
  ),
  info: (size = 13): string => svgIcon(
    '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    size
  ),
  trash: (size = 13): string => svgIcon(
    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    size
  ),
  copy: (size = 13): string => svgIcon(
    '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    size
  ),
  download: (size = 13): string => svgIcon(
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    size
  ),
  play: (size = 13): string => svgIcon(
    '<polygon points="6 3 20 12 6 21 6 3"/>',
    size
  ),
  plus: (size = 12): string => svgIcon(
    '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    size
  ),
  chevronDown: (size = 10): string => svgIcon(
    '<polyline points="6 9 12 15 18 9"/>',
    size
  ),
  chevronRight: (size = 10): string => svgIcon(
    '<polyline points="9 18 15 12 9 6"/>',
    size
  ),

  // Visibility & Lock
  eye: (size = 13): string => svgIcon(
    '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    size
  ),
  eyeOff: (size = 13): string => svgIcon(
    '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>',
    size
  ),
  lock: (size = 13): string => svgIcon(
    '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    size
  ),
  unlock: (size = 13): string => svgIcon(
    '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    size
  ),

  // Viewport Transform Gizmos
  move: (size = 13): string => svgIcon(
    '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>',
    size
  ),
  rotate: (size = 13): string => svgIcon(
    '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/>',
    size
  ),
  scale: (size = 13): string => svgIcon(
    '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
    size
  ),
  world: (size = 13): string => svgIcon(
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    size
  ),
  magnet: (size = 13): string => svgIcon(
    '<path d="m6 15-3-3 6.7-6.7a4 4 0 0 1 5.6 0l4.4 4.4a4 4 0 0 1 0 5.6L13 22l-3-3 4.7-4.7a1.5 1.5 0 0 0 0-2.1l-2.4-2.4a1.5 1.5 0 0 0-2.1 0L6 15Z"/><path d="m4.5 10.5 3 3"/><path d="m10.5 4.5 3 3"/>',
    size
  ),
  reset: (size = 13): string => svgIcon(
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/>',
    size
  ),

  // 3D Geometric Primitive Icons
  box: (size = 14): string => svgIcon(
    '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    size
  ),
  sphere: (size = 14): string => svgIcon(
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="9" ry="3.5"/><ellipse cx="12" cy="12" rx="3.5" ry="9"/>',
    size
  ),
  cylinder: (size = 14): string => svgIcon(
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/>',
    size
  ),
  cone: (size = 14): string => svgIcon(
    '<ellipse cx="12" cy="19" rx="8" ry="3"/><path d="m4 19 8-16 8 16"/>',
    size
  ),
  torus: (size = 14): string => svgIcon(
    '<ellipse cx="12" cy="12" rx="9" ry="5"/><ellipse cx="12" cy="12" rx="4.5" ry="2"/>',
    size
  ),
  plane: (size = 14): string => svgIcon(
    '<path d="m3 16 9 5 9-5-9-5-9 5Z"/><path d="m3 11 9 5 9-5"/><path d="m3 6 9 5 9-5"/>',
    size
  ),
  capsule: (size = 14): string => svgIcon(
    '<rect width="8" height="16" x="8" y="4" rx="4"/>',
    size
  ),
  group: (size = 14): string => svgIcon(
    '<rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="8.5" rx="1"/><path d="M10 12h4"/><path d="M17 10V7"/>',
    size
  ),
  mesh: (size = 14): string => svgIcon(
    '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="12"/><line x1="2" y1="8.5" x2="12" y2="12"/><line x1="22" y1="8.5" x2="12" y2="12"/>',
    size
  ),
};
