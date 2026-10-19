const { parser } = require('@plutojl/lezer-julia');

const COLORS = {
  parameter: '#FFB454',
  property: '#73DACA',
  function: '#C099FF',
  type: '#2EE6D6',
  constant: '#82CFFF',
  macro: '#F78CDA',
};

function children(node) {
  const result = [];
  for (let child = node.firstChild; child; child = child.nextSibling) result.push(child);
  return result;
}

function analyze(source) {
  const tree = parser.parse(source);
  const marks = new Map();
  const text = node => source.slice(node.from, node.to);
  const mark = (node, kind, priority = 1) => {
    if (!node || node.name !== 'Identifier') return;
    const old = marks.get(node.from);
    if (!old || priority > old.priority) {
      marks.set(node.from, { from: node.from, to: node.to, kind, priority });
    }
  };
  const identifiers = node => {
    if (!node) return [];
    if (node.name === 'Identifier') return [node];
    return children(node).flatMap(identifiers);
  };
  // Only the binding side of annotations/defaults is a parameter.
  function bindings(node) {
    if (!node) return [];
    if (node.name === 'Identifier') return [node];
    if (['BinaryExpression', 'KwArg', 'Assignment', 'SplatExpression'].includes(node.name)) {
      return bindings(node.firstChild);
    }
    if (['Arguments', 'Parameters', 'KeywordArguments', 'TupleExpression', 'OpenTuple', 'ParenExpression'].includes(node.name)) {
      return children(node).flatMap(bindings);
    }
    return [];
  }
  function signatureCall(node) {
    if (!node) return null;
    if (node.name === 'CallExpression') return node;
    if (['Signature', 'BinaryExpression', 'ParametrizedExpression'].includes(node.name)) {
      return signatureCall(node.firstChild);
    }
    return null;
  }
  function visit(node, parameters = new Set(), inType = false) {
    if (node.name === 'Symbol') return;
    let scope = parameters;
    let signature = null;
    if (node.name === 'FunctionDefinition') {
      signature = signatureCall(children(node).find(c => c.name === 'Signature'));
    } else if (node.name === 'Assignment') {
      signature = signatureCall(node.firstChild);
    }
    if (signature || node.name === 'ArrowFunctionExpression' || node.name === 'DoClause') {
      const args = signature
        ? children(signature).find(c => c.name === 'Arguments')
        : node.name === 'DoClause'
          ? children(node).find(c => c.name === 'Parameters')
          : node.firstChild;
      scope = new Set(parameters);
      for (const param of bindings(args)) {
        scope.add(text(param));
        mark(param, 'parameter', 5);
      }
    }
    if (node.name === 'Identifier') {
      if (inType) mark(node, 'type', 4);
      else if (scope.has(text(node))) mark(node, 'parameter');
      else if (/^[\p{Lu}_][\p{Lu}\p{N}_]*$/u.test(text(node))) mark(node, 'constant');
    }
    if (node.name === 'Field') {
      for (const id of identifiers(node)) mark(id, 'property', 3);
    }
    if (node.name === 'MacroIdentifier') {
      for (const id of identifiers(node)) mark(id, 'macro', 6);
    }
    if (node.name === 'ConstStatement') {
      const assignment = children(node).find(c => c.name === 'Assignment');
      for (const id of bindings(assignment)) mark(id, 'constant', 4);
    }
    if (node.name === 'CallExpression') {
      let callee = node.firstChild;
      if (callee && callee.name === 'ParametrizedExpression') callee = callee.firstChild;
      const ids = identifiers(callee);
      const id = ids.at(-1);
      if (id) mark(id, /^\p{Lu}/u.test(text(id)) ? 'type' : 'function', 6);
    }
    if (['StructDefinition', 'AbstractDefinition', 'PrimitiveDefinition'].includes(node.name)) {
      const head = children(node).find(c => c.name === 'TypeHead');
      for (const id of identifiers(head)) mark(id, 'type', 4);
      for (const child of children(node)) {
        if (child.name === 'BinaryExpression' || child.name === 'Identifier') {
          mark(child.name === 'Identifier' ? child : child.firstChild, 'property', 3);
        }
      }
    }
    for (const child of children(node)) {
      // Types are explicit syntax; ordinary uppercase variables are not guessed to be types.
      visit(child, scope, inType || node.name === 'Type' || node.name === 'TypeHead'
        || (node.name === 'ParametrizedExpression' && child.name === 'BraceExpression'));
    }
  }
  visit(tree.topNode);
  return [...marks.values()].sort((a, b) => a.from - b.from);
}

module.exports = { analyze, COLORS };
