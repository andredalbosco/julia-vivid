const path = require('node:path');
const fs = require('node:fs');
const { runTests } = require('@vscode/test-electron');

const root = path.resolve(__dirname, '..');
const profile = path.join(root, '.vscode-test/profile');
fs.mkdirSync(path.join(profile, 'User'), { recursive: true });
fs.writeFileSync(path.join(profile, 'User/settings.json'), JSON.stringify({
  'workbench.colorTheme': 'Default Dark Modern',
  'workbench.startupEditor': 'none',
  'window.titleBarStyle': 'custom',
  'editor.fontSize': 17,
  'editor.minimap.enabled': false,
  'zenMode.centerLayout': false,
  'zenMode.fullScreen': false,
  'editor.semanticHighlighting.enabled': false,
  'telemetry.telemetryLevel': 'off',
  'julia.enableTelemetry': false,
  'julia.enableCrashReporter': false,
  'julia.symbolCacheDownload': false,
}));
runTests({
  vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH || '/usr/share/code/code',
  extensionDevelopmentPath: root,
  extensionTestsPath: path.join(__dirname, 'editor.js'),
  launchArgs: ['--no-sandbox', '--disable-gpu', '--ozone-platform=x11', '--skip-welcome', '--skip-release-notes',
    ...(process.env.JULIA_VIVID_SCREENSHOT ? ['--remote-debugging-port=9345'] : []),
    '--user-data-dir', profile, '--extensions-dir', path.join(root, '.vscode-test/extensions')],
}).catch(error => { console.error(error); process.exitCode = 1; });
