const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(os.tmpdir(), 'lp-solver-web-test-dist');
fs.rmSync(outDir, { recursive: true, force: true });

const files = [
  'src/lib/simplex.ts',
  'src/lib/geometry.ts',
  'src/lib/standardize.ts',
  'src/lib/format.ts',
  'src/lib/types.ts',
];

const localTscJs = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const command = fs.existsSync(localTscJs) ? process.execPath : 'tsc';
const commandArgs = fs.existsSync(localTscJs) ? [localTscJs] : [];
execFileSync(command, [
  ...commandArgs,
  '--ignoreConfig',
  ...files,
  '--target', 'ES2020',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--ignoreDeprecations', '6.0',
  '--skipLibCheck',
  '--outDir', outDir,
  '--esModuleInterop',
  '--strict',
], { cwd: root, stdio: 'inherit' });

const { solveLP } = require(path.join(outDir, 'simplex.js'));
const { solveGeometric } = require(path.join(outDir, 'geometry.js'));

const lp = (overrides) => ({
  optimization: 'max',
  n: 2,
  m: 0,
  c: [1, 1],
  A: [],
  signs: [],
  b: [],
  variableTypes: ['nonnegative', 'nonnegative'],
  ...overrides,
});

function expectStatus(name, actual, expected) {
  assert.strictEqual(actual, expected, `${name}: expected ${expected}, got ${actual}`);
  console.log(`✓ ${name}`);
}

let result;

result = solveLP(lp({
  m: 3,
  c: [3, 5],
  A: [[1, 0], [0, 2], [3, 2]],
  signs: ['<=', '<=', '<='],
  b: [4, 12, 18],
}), 'two-phase');
expectStatus('Two-Phase giải đúng bài max mẫu', result.status, 'optimal');
assert.strictEqual(result.optimalValue, 36);
assert.deepStrictEqual(result.solutionOriginal, [2, 6]);

result = solveLP(lp({
  m: 1,
  c: [1, 1],
  A: [[1, -1]],
  signs: ['>='],
  b: [1],
}), 'two-phase');
expectStatus('Two-Phase phát hiện unbounded', result.status, 'unbounded');

result = solveLP(lp({
  m: 2,
  A: [[1, 0], [1, 0]],
  signs: ['<=', '>='],
  b: [1, 2],
}), 'two-phase');
expectStatus('Two-Phase phát hiện infeasible', result.status, 'infeasible');

result = solveGeometric(lp({
  m: 0,
  c: [1, 1],
  A: [],
  signs: [],
  b: [],
}));
expectStatus('Hình học phát hiện góc phần tư không bị chặn', result.status, 'unbounded');

result = solveGeometric(lp({
  m: 3,
  c: [3, 5],
  A: [[1, 0], [0, 2], [3, 2]],
  signs: ['<=', '<=', '<='],
  b: [4, 12, 18],
}));
expectStatus('Hình học giải đúng bài max mẫu', result.status, 'optimal');
assert(result.optimalPoint, 'Expected optimal point');
assert.strictEqual(result.optimalPoint.value, 36);

result = solveGeometric(lp({
  m: 2,
  A: [[1, 0], [1, 0]],
  signs: ['<=', '>='],
  b: [1, 2],
}));
expectStatus('Hình học phát hiện infeasible', result.status, 'infeasible');

console.log('All solver tests passed.');
