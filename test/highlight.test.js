const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../src/highlight');

function tokens(source) {
  return analyze(source).map(t => [source.slice(t.from, t.to), t.kind]);
}

test('XPBD declarations, parameters, properties and calls', () => {
  const source = `mutable struct Particle
    position::Vector{Float64}
end
function solve_distance!(particles, c, h)
    delta = particles[c.b].position
    distance = norm(delta)
    alpha = c.compliance / h^2
end`;
  const result = tokens(source);
  for (const expected of [['Particle', 'type'], ['position', 'property'], ['Vector', 'type'],
    ['Float64', 'type'], ['solve_distance!', 'function'], ['particles', 'parameter'],
    ['c', 'parameter'], ['h', 'parameter'], ['b', 'property'], ['norm', 'function'], ['compliance', 'property']]) {
    assert.ok(result.some(t => t[0] === expected[0] && t[1] === expected[1]), expected.join(':'));
  }
  assert.equal(result.filter(t => t[0] === 'c' && t[1] === 'parameter').length, 3);
});

test('comments, literal strings and quoted symbols are untouched; interpolation is code', () => {
  const source = 'function f(x)\n# x.field norm(x)\n"x.field norm(x) $(x.field)"\n:x\nend';
  const result = tokens(source);
  assert.equal(result.filter(t => t[0] === 'field').length, 1);
  assert.equal(result.filter(t => t[0] === 'x').length, 2);
  assert.ok(!result.some(t => t[0] === 'norm'));
});

test('nested scopes do not leak into the enclosing function', () => {
  const result = tokens('function outer(x)\ninner(y) = x + y\ny\nend\nx');
  assert.equal(result.filter(t => t[0] === 'y').length, 2);
  assert.equal(result.filter(t => t[0] === 'x').length, 2);
});

test('typed, default, destructured, splat and keyword parameters', () => {
  const result = tokens('f(x::Float64, (a,b), ys...; opt=true) = x + a + b + opt');
  for (const name of ['x', 'a', 'b', 'ys', 'opt']) {
    assert.ok(result.some(t => t[0] === name && t[1] === 'parameter'), name);
  }
  assert.ok(result.some(t => t[0] === 'Float64' && t[1] === 'type'));
});

test('arrow functions, do blocks, qualified/broadcast calls and macros', () => {
  const result = tokens('map(x -> x.a, xs)\nmap(xs) do y\ny.a\nend\nrl.draw.(xs)\n@sprintf("%d", 1)');
  for (const name of ['x', 'y']) assert.equal(result.filter(t => t[0] === name).length, 2);
  assert.ok(result.some(t => t[0] === 'draw' && t[1] === 'function'));
  assert.ok(result.some(t => t[0] === 'sprintf' && t[1] === 'macro'));
});

test('constants, Unicode, UTF-16 offsets, malformed edits and non-overlap', () => {
  const source = 'const gravity = 9.81\nconst CLOTH_ROWS = 17\n"😀"\nf(δλ) = δλ + obj.θέση\nfunction unfinished(';
  const marks = analyze(source);
  const result = tokens(source);
  assert.ok(result.some(t => t[0] === 'gravity' && t[1] === 'constant'));
  assert.equal(result.filter(t => t[0] === 'δλ').length, 2);
  assert.ok(result.some(t => t[0] === 'θέση' && t[1] === 'property'));
  for (let i = 1; i < marks.length; i++) assert.ok(marks[i - 1].to <= marks[i].from);
});

test('parametric constructors retain both the callee and type argument colors', () => {
  const result = tokens('Vector{Float64}(undef, 2)\nBase.Vector{Int}(xs)');
  assert.equal(result.filter(t => t[0] === 'Vector' && t[1] === 'type').length, 2);
  for (const name of ['Float64', 'Int']) assert.ok(result.some(t => t[0] === name && t[1] === 'type'));
});
