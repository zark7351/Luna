const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(root, '../Claudie-Promo/functional-captures');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const entries = fs.existsSync(path.join(output, 'manifest.json'))
  ? ['render-short.cjs']
  : ['capture-ui.cjs', 'render-short.cjs'];
for (const entry of entries) {
  const result = spawnSync(require('electron'), [path.join(__dirname, entry)], {
    cwd: root,
    env,
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
