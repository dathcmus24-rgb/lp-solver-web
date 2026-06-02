import { lpExamples } from '../src/lib/examples';
import { solveLP } from '../src/lib/simplex';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const removedIds = new Set([
  'simplex-zero-b-degenerate',
  'special-unbounded',
  'special-alternate-optimum',
]);

for (const id of removedIds) {
  assert(!lpExamples.some((example) => example.id === id), `Example ${id} should be removed.`);
}

assert(lpExamples.length === 8, `Expected 8 examples, got ${lpExamples.length}`);

for (const example of lpExamples) {
  assert(example.input.c.length === example.input.n, `${example.id}: c length must equal n`);
  assert(example.input.A.length === example.input.m, `${example.id}: A rows must equal m`);
  assert(example.input.signs.length === example.input.m, `${example.id}: signs length must equal m`);
  assert(example.input.b.length === example.input.m, `${example.id}: b length must equal m`);
  assert(example.input.variableTypes.length === example.input.n, `${example.id}: variableTypes length must equal n`);

  const result = solveLP(example.input, example.method);
  assert(
    result.status === example.expectedStatus,
    `${example.id}: expected ${example.expectedStatus}, got ${result.status}. Message: ${result.message}`,
  );
}

console.log('✓ Examples list was replaced by the user-provided set');
console.log('✓ Removed examples are no longer present');
console.log('✓ Example dimensions are valid');
console.log('✓ Each example matches its expected status');
console.log('All example tests passed.');
