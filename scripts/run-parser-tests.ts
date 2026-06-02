import { parseLPText } from '../src/lib/parser';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const basic = parseLPText(`max z = 3x1 + 5x2
x1 <= 4
2x2 <= 12
3x1 + 2x2 <= 18
x1, x2 >= 0`);

assert(basic.ok, 'Basic case must parse');
if (basic.ok) {
  assert(basic.input.optimization === 'max', 'Basic optimization must be max');
  assert(basic.input.n === 2, `Basic n must be 2, got ${basic.input.n}`);
  assert(basic.input.m === 3, `Basic m must be 3, got ${basic.input.m}`);
  assert(JSON.stringify(basic.input.c) === JSON.stringify([3, 5]), 'Basic c must be [3,5]');
  assert(JSON.stringify(basic.input.b) === JSON.stringify([4, 12, 18]), 'Basic b must be [4,12,18]');
}

const twoPhase = parseLPText(`max z = 2x1 - 6x2
-x1 + x2 - x3 <= -2
2x1 - x2 + x3 <= 1
x1, x2, x3 >= 0`);

assert(twoPhase.ok, 'Two-Phase case must parse');
if (twoPhase.ok) {
  assert(twoPhase.input.n === 3, 'Two-Phase n must be 3');
  assert(JSON.stringify(twoPhase.input.b) === JSON.stringify([-2, 1]), 'Two-Phase b must be [-2,1]');
}

const minFree = parseLPText(`min z = x1 - x2
x1 + x2 = 4
x1 >= 0
x2 free`);

assert(minFree.ok, 'Free variable case must parse');
if (minFree.ok) {
  assert(minFree.input.optimization === 'min', 'Free case must be min');
  assert(minFree.input.variableTypes[1] === 'free', 'x2 must be free');
}

const vietnameseFree = parseLPText(`min z = x1 - x2
x1 + x2 = 4
x2 tự do`);

assert(!vietnameseFree.ok, 'Vietnamese free format should not be supported in math-only parser');

console.log('✓ Parser reads basic Simplex case');
console.log('✓ Parser reads Two-Phase case with negative b');
console.log('✓ Parser reads free variables with English "free"');
console.log('✓ Parser rejects Vietnamese variable format');
console.log('All parser tests passed.');
