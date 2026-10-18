// Keep both engines optional so selecting Pele does not download Mermaid.
let pelePromise;
let mermaidPromise;
let mermaidQueue = Promise.resolve();

function loadPele() {
  if (!pelePromise) {
    pelePromise = import('https://cdn.jsdelivr.net/npm/pele@1.6.0/dist/pele.js')
      .catch((error) => { pelePromise = null; throw error; });
  }
  return pelePromise;
}

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
      .catch((error) => { mermaidPromise = null; throw error; });
  }
  return mermaidPromise;
}

function renderWithMermaid(source, id, config) {
  // Mermaid has global configuration; initialize and render together in order.
  const result = mermaidQueue.then(async () => {
    const { default: mermaid } = await loadMermaid();
    const startedAt = performance.now();
    mermaid.initialize(config);
    const result = await mermaid.render(id, source);
    return { ...result, renderer: 'mermaid', durationMs: performance.now() - startedAt };
  });
  mermaidQueue = result.catch(() => {});
  return result;
}

function sourceCompatibilityReason(source) {
  const frontmatter = source.trimStart().match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const directives = [...source.matchAll(/^\s*%%\{init\s*:([\s\S]*?)\}%%/gm)];
  const config = [frontmatter?.[1] || '', ...directives.map((match) => match[1])].join('\n');
  if (/["']?look["']?\s*:\s*["']?handDrawn\b/.test(config)) return '手绘风格';
  if (/["']?theme(?:Variables)?["']?\s*:/.test(config)) return '源码主题配置';
  return '';
}

export async function renderDiagram(source, { renderer, id, config, fontFamily }) {
  if (renderer !== 'pele') {
    return renderWithMermaid(source, id, config);
  }
  const unsupportedConfig = config.look === 'handDrawn' ? '手绘风格' : sourceCompatibilityReason(source);
  if (unsupportedConfig) {
    throw Object.assign(new Error(`Pele 不支持${unsupportedConfig}，请修改配置或手动选择 Mermaid。`), {
      code: 'unsupported-config',
    });
  }
  const pele = await loadPele();
  if (!pele.supports(source)) {
    throw Object.assign(new Error('Pele 不支持此图表类型，请手动选择 Mermaid。'), {
      code: 'unsupported-diagram',
    });
  }
  const startedAt = performance.now();
  const result = pele.render(source, {
    idPrefix: id,
    fontFamily,
    responsive: false,
    autoDirection: false,
  });
  return { ...result, renderer: 'pele', durationMs: performance.now() - startedAt };
}

// These palettes approximate the familiar Mermaid themes in Pele's own style.
const palettes = {
  default: ['#ffffff', '#333333', '#666666', '#333333', '#ececff', '#ffffde', '#9370db', '#6366f1'],
  neutral: ['#ffffff', '#333333', '#666666', '#333333', '#eeeeee', '#f7f7f7', '#666666', '#555555'],
  dark: ['#1f2029', '#eeeeee', '#b8bac4', '#dddddd', '#30334a', '#252838', '#9298b8', '#a5adff'],
  forest: ['#ffffff', '#16351f', '#526658', '#315a3c', '#cde8c8', '#edf5df', '#4b8148', '#2f855a'],
  base: ['#ffffff', '#333333', '#666666', '#555555', '#fff4dd', '#fff9eb', '#aa9670', '#b7791f'],
};
const paletteVariables = ['bg', 'fg', 'muted', 'line', 'surface', 'surface-alt', 'border', 'accent'];

export function getPeleTheme(theme) {
  const values = palettes[theme] || palettes.default;
  return Object.fromEntries(paletteVariables.map((name, index) => [`--pele-${name}`, values[index]]));
}
