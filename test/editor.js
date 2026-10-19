const vscode = require('vscode');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

exports.run = async function () {
  const extension = vscode.extensions.getExtension('andredalbosco.julia-vivid');
  assert.ok(extension, 'extension discovered');
  const api = await extension.activate();
  const sample = path.resolve(__dirname, '../examples/xpbd.jl');
  const document = await vscode.workspace.openTextDocument(sample);
  assert.equal(document.languageId, 'julia');
  await vscode.window.showTextDocument(document);
  for (let attempt = 0; attempt < 50 && !vscode.window.visibleTextEditors.some(e => e.document === document); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
  assert.ok(editor, 'document visible');
  const counts = () => Object.values(api.getStatus(document.uri).counts);
  api.refresh();
  assert.equal(counts().length, 6);
  assert.ok(counts().every(count => count > 0), 'all six categories rendered');
  assert.ok(api.analyze(document.getText()).length > 20);
  const config = vscode.workspace.getConfiguration('juliaVivid');
  await config.update('enabled', false, vscode.ConfigurationTarget.Global);
  api.refresh();
  assert.ok(counts().every(count => count === 0), 'disable clears decorations');
  await config.update('enabled', true, vscode.ConfigurationTarget.Global);
  await vscode.languages.setTextDocumentLanguage(document, 'plaintext');
  api.refresh();
  assert.ok(counts().every(count => count === 0), 'changing language clears decorations');
  await vscode.languages.setTextDocumentLanguage(document, 'julia');
  api.refresh();
  await editor.edit(edit => edit.insert(new vscode.Position(0, 0), '# Edit refresh check\n'));
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.ok(counts().some(count => count > 0), 'editing reapplies decorations');
  assert.equal(api.getStatus(document.uri).version, document.version, 'edit event refreshed the parsed version');
  await vscode.commands.executeCommand('workbench.action.files.revert');
  await vscode.commands.executeCommand('workbench.action.closeSidebar');
  await vscode.commands.executeCommand('workbench.action.closePanel');
  await vscode.commands.executeCommand('workbench.action.toggleZenMode');
  editor.revealRange(new vscode.Range(0, 0, 0, 0), vscode.TextEditorRevealType.AtTop);
  await new Promise(resolve => setTimeout(resolve, 1500));
  if (process.env.JULIA_VIVID_SCREENSHOT) {
    const destination = path.resolve(process.env.JULIA_VIVID_SCREENSHOT);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const { chromium } = require('playwright-core');
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9345');
    try {
      const page = browser.contexts().flatMap(context => context.pages())
        .find(page => page.url().includes('workbench'));
      assert.ok(page, 'VS Code renderer available');
      await page.setViewportSize({ width: 1400, height: 1100 });
      await page.screenshot({ path: destination });
    } finally {
      await browser.close();
    }
  }
  console.log('Editor integration passed: activation, all categories, toggle, language change, editing.');
};
