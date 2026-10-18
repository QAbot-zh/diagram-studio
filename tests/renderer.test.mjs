import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../diagram-renderer.js', import.meta.url), 'utf8');
const options = { renderer: 'pele', id: 'test-svg', config: { look: 'classic', theme: 'default' }, fontFamily: 'Arial' };

async function harness(overrides = {}) {
  const loads = [];
  const calls = [];
  const pele = {
    supports: () => true,
    render: (text, config) => { calls.push({ engine: 'pele', text, config }); return { svg: '<svg class="pele"/>' }; },
    ...overrides.pele,
  };
  const mermaid = {
    initialize: (config) => calls.push({ engine: 'initialize', config }),
    render: async (id, text) => { calls.push({ engine: 'mermaid', id, text }); return { svg: '<svg/>' }; },
    ...overrides.mermaid,
  };
  let clock = 0;
  const context = vm.createContext({ performance: { now: overrides.now || (() => clock++) } });
  const module = new vm.SourceTextModule(source, {
    context,
    importModuleDynamically: async (specifier) => {
      loads.push(specifier);
      await overrides.beforeLoad?.(specifier);
      const exports = specifier.includes('/pele@') ? pele : { default: mermaid };
      const dependency = new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
      }, { context });
      await dependency.link(() => {});
      await dependency.evaluate();
      return dependency;
    },
  });
  await module.link(() => {});
  await module.evaluate();
  return { ...module.namespace, loads, calls };
}

test('Pele loads alone and preserves the source direction and font', async () => {
  const h = await harness();
  const result = await h.renderDiagram('flowchart LR\n A --> B', options);
  assert.equal(result.renderer, 'pele');
  assert.equal(result.durationMs, 1);
  assert.equal(h.loads.length, 1);
  assert.match(h.loads[0], /pele@1\.6\.0/);
  assert.equal(h.calls[0].config.autoDirection, false);
  assert.equal(h.calls[0].config.responsive, false);
  assert.equal(h.calls[0].config.fontFamily, 'Arial');
  await h.renderDiagram('flowchart TD\n A --> C', options);
  assert.equal(h.loads.length, 1);
});

test('Mermaid selection does not download Pele', async () => {
  const h = await harness();
  const result = await h.renderDiagram('flowchart TD\n A --> B', { ...options, renderer: 'mermaid' });
  assert.equal(result.renderer, 'mermaid');
  assert.equal(result.durationMs, 1);
  assert.equal(h.loads.length, 1);
  assert.match(h.loads[0], /mermaid@11/);
});

test('Pele rejects hand-drawn configuration without loading another engine', async () => {
  const h = await harness();
  await assert.rejects(h.renderDiagram('flowchart TD\n A --> B', { ...options, config: { look: 'handDrawn' } }),
    (error) => error.code === 'unsupported-config' && /Pele 不支持手绘/.test(error.message));
  assert.equal(h.loads.length, 0);
});

test('unsupported source configuration is reported without switching engines', async () => {
  const h = await harness();
  for (const config of [
    '---\nconfig:\n  theme: forest\n---\n',
    '\n---\r\nconfig:\r\n  look: handDrawn\r\n---\r\n',
    '%%{init: {"themeVariables": {"primaryColor": "#f00"}}}%%\n',
    "%%{init: {'look': 'handDrawn'}}%%\n",
  ]) {
    await assert.rejects(h.renderDiagram(config + 'flowchart TD\n A --> B', options),
      (error) => error.code === 'unsupported-config' && /Pele 不支持/.test(error.message));
  }
  assert.equal(h.loads.length, 0);
});

test('configuration words inside labels do not reject valid diagrams', async () => {
  const h = await harness();
  const result = await h.renderDiagram('flowchart TD\n A["theme: forest; look: handDrawn"]', options);
  assert.equal(result.renderer, 'pele');
});

test('unsupported diagrams and parser failures never load Mermaid', async () => {
  for (const pele of [
    { supports: () => false },
    { render: () => { throw Object.assign(new Error('Pele parser difference'), { line: 2 }); } },
  ]) {
    const h = await harness({ pele });
    await assert.rejects(h.renderDiagram('some diagram', options));
    assert.equal(h.loads.length, 1);
    assert.match(h.loads[0], /pele@/);
    assert.equal(h.calls.some((call) => call.engine === 'mermaid'), false);
  }
});

test('invalid source keeps Pele’s original line and column', async () => {
  const positionedError = Object.assign(new Error('Invalid node'), { line: 2, column: 5 });
  const h = await harness({
    pele: { render: () => { throw positionedError; } },
    mermaid: { render: async () => { throw new Error('Mermaid parse error'); } },
  });
  await assert.rejects(h.renderDiagram('flowchart TD\n A[', options), (error) => error === positionedError);
  assert.equal(h.loads.some((url) => url.includes('/mermaid@')), false);
});

test('failed library loading can be retried on the next render', async () => {
  let first = true;
  const h = await harness({ beforeLoad: (url) => {
    if (first && url.includes('/pele@')) { first = false; throw new Error('Network unavailable'); }
  } });
  await assert.rejects(h.renderDiagram('flowchart TD\n A --> B', options), /Network unavailable/);
  assert.equal((await h.renderDiagram('flowchart TD\n A --> C', options)).renderer, 'pele');
  assert.equal(h.loads.some((url) => url.includes('/mermaid@')), false);
});

test('render duration excludes the initial engine download', async () => {
  for (const renderer of ['pele', 'mermaid']) {
    let clock = 0;
    const render = () => { clock += 7; return { svg: '<svg/>' }; };
    const h = await harness({
      now: () => clock,
      beforeLoad: () => { clock += 1000; },
      pele: { render },
      mermaid: { render },
    });
    const result = await h.renderDiagram('flowchart TD\n A --> B', { ...options, renderer });
    assert.equal(result.durationMs, 7);
    assert.equal(clock, 1007);
  }
});

test('concurrent Mermaid renders do not overwrite each other’s configuration', async () => {
  let activeTheme;
  const themes = [];
  const h = await harness({ mermaid: {
    initialize: (config) => { activeTheme = config.theme; },
    render: async () => { await Promise.resolve(); themes.push(activeTheme); return { svg: '<svg/>' }; },
  } });
  await Promise.all(['forest', 'dark'].map((theme) => h.renderDiagram('flowchart TD\n A --> B', {
    ...options, renderer: 'mermaid', config: { theme },
  })));
  assert.deepEqual(themes, ['forest', 'dark']);
});

test('all five palettes supply standalone colors and invalid themes use the default', async () => {
  const h = await harness();
  const palettes = ['default', 'neutral', 'dark', 'forest', 'base'].map(h.getPeleTheme);
  assert.equal(new Set(palettes.map((palette) => JSON.stringify(palette))).size, 5);
  for (const palette of palettes) {
    assert.equal(Object.keys(palette).length, 8);
    for (const color of Object.values(palette)) assert.match(color, /^#[0-9a-f]{6}$/i);
  }
  assert.deepEqual(h.getPeleTheme('unknown'), h.getPeleTheme('default'));
});
