const vscode = require('vscode');
const { analyze, COLORS } = require('./highlight');

function activate(context) {
  let decorations = {};
  const timers = new Map();
  const cache = new Map();
  const applied = new Map();
  const output = vscode.window.createOutputChannel('Julia Vivid');
  context.subscriptions.push(output);

  function rebuild() {
    for (const decoration of Object.values(decorations)) decoration.dispose();
    const config = vscode.workspace.getConfiguration('juliaVivid');
    decorations = Object.fromEntries(Object.entries(COLORS).map(([kind, color]) => [
      kind, vscode.window.createTextEditorDecorationType({
        color: config.get(`colors.${kind}`, color),
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      }),
    ]));
    cache.clear();
  }

  function update(editor) {
    const document = editor.document;
    const config = vscode.workspace.getConfiguration('juliaVivid', document.uri);
    const groups = Object.fromEntries(Object.keys(COLORS).map(kind => [kind, []]));
    if (document.languageId === 'julia' && config.get('enabled', true) && document.getText().length <= config.get('maxFileSize', 1000000)) {
      try {
        const key = document.uri.toString();
        let entry = cache.get(key);
        if (!entry || entry.version !== document.version) {
          entry = { version: document.version, marks: analyze(document.getText()) };
          cache.set(key, entry);
        }
        for (const mark of entry.marks) {
          groups[mark.kind].push(new vscode.Range(document.positionAt(mark.from), document.positionAt(mark.to)));
        }
      } catch (error) {
        output.appendLine(`Could not highlight ${document.uri}: ${error.message}`);
      }
    }
    for (const [kind, decoration] of Object.entries(decorations)) {
      editor.setDecorations(decoration, groups[kind]);
    }
    applied.set(document.uri.toString(), {
      version: document.version,
      counts: Object.fromEntries(Object.entries(groups).map(([kind, ranges]) => [kind, ranges.length])),
    });
  }

  function updateVisible() {
    for (const editor of vscode.window.visibleTextEditors) update(editor);
  }
  rebuild();
  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(updateVisible),
    vscode.workspace.onDidOpenTextDocument(updateVisible),
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.languageId !== 'julia') return;
      const key = event.document.uri.toString();
      clearTimeout(timers.get(key));
      timers.set(key, setTimeout(() => {
        timers.delete(key);
        for (const editor of vscode.window.visibleTextEditors) {
          if (editor.document === event.document) update(editor);
        }
      }, 80));
    }),
    vscode.workspace.onDidCloseTextDocument(document => {
      const key = document.uri.toString();
      cache.delete(key);
      applied.delete(key);
      clearTimeout(timers.get(key));
      timers.delete(key);
    }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('juliaVivid')) { rebuild(); updateVisible(); }
    }),
    vscode.commands.registerCommand('juliaVivid.toggle', async () => {
      const config = vscode.workspace.getConfiguration('juliaVivid');
      await config.update('enabled', !config.get('enabled', true), vscode.ConfigurationTarget.Global);
    }),
    { dispose() {
      for (const timer of timers.values()) clearTimeout(timer);
      for (const decoration of Object.values(decorations)) decoration.dispose();
      cache.clear();
      applied.clear();
    } },
  );
  updateVisible();
  return { analyze, refresh: updateVisible, getStatus: uri => applied.get(uri.toString()) };
}

module.exports = { activate };
