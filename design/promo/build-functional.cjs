const path = require('node:path');
const { spawnSync } = require('node:child_process');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
for (const entry of ['capture-ui.cjs', 'render-functional.cjs']) {
  if (entry === 'capture-ui.cjs' && process.argv.includes('--reuse-captures')) continue;
  const result = spawnSync(require('electron'), [path.join(__dirname, entry)], {
    cwd: path.resolve(__dirname, '../..'),
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
