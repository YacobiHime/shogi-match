// Build a standalone Windows x64 exe with the entire offline game embedded.
// Requires Go 1.22+ (set GO_BINARY if `go` is not the compiler on PATH).
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('exhibit/', root);
const stage = new URL('.exe-build/', output);
const go = process.env.GO_BINARY || 'go';
const version = execFileSync(go, ['version'], { encoding: 'utf8' });
if (!version.startsWith('go version go')) throw new Error('GO_BINARY must point to the Go compiler.');
await stat(new URL('firebase-public/game.html', root));
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
try {
  await cp(new URL('scripts/exhibit/launcher/', root), stage, { recursive: true });
  await cp(new URL('firebase-public/', root), new URL('app/', stage), { recursive: true });
  for (const name of ['LICENSE', 'NOTICE.md', 'third_party']) {
    await cp(new URL(name, root), new URL(`app/${name}`, stage), { recursive: true });
  }
  const options = { cwd: fileURLToPath(stage), stdio: 'inherit', env: { ...process.env, CGO_ENABLED: '0' } };
  execFileSync(go, ['test', './...'], options);
  execFileSync(go, ['build', '-trimpath', '-ldflags=-s -w -H windowsgui', '-o', fileURLToPath(new URL('shogi-match-exhibit.exe', output)), '.'], {
    ...options, env: { ...options.env, GOOS: 'windows', GOARCH: 'amd64' },
  });
  // Also compile the identical server for local smoke testing when requested.
  if (process.env.EXHIBIT_BUILD_NATIVE === '1') {
    execFileSync(go, ['build', '-trimpath', '-o', fileURLToPath(new URL('shogi-match-exhibit-native', output)), '.'], options);
  }
  await cp(new URL('scripts/exhibit/README-exe.txt', root), new URL('README-exe.txt', output));
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fileURLToPath(root), encoding: 'utf8' }).trim();
  const notice = await readFile(new URL('NOTICE.md', root), 'utf8');
  await writeFile(new URL('LICENSE.txt', output), await readFile(new URL('LICENSE', root)));
  await writeFile(new URL('NOTICE.txt', output), `${notice}\n\nSource repository: https://github.com/YacobiHime/shogi-match\nBuild base commit: ${commit}\nInclude the accompanying source archive for this build.\n`);
  const sourcePaths = new Set(execFileSync('git', ['ls-files', '--cached'], { cwd: fileURLToPath(root), encoding: 'utf8' }).trim().split('\n'));
  for (const name of ['scripts/build-exhibit-exe.mjs', 'scripts/exhibit/README-exe.txt', 'scripts/exhibit/launcher/go.mod', 'scripts/exhibit/launcher/main.go', 'scripts/exhibit/launcher/main_test.go', 'scripts/exhibit/launcher/error_windows.go', 'scripts/exhibit/launcher/error_other.go']) sourcePaths.add(name);
  const existing = [];
  for (const name of sourcePaths) { try { if ((await stat(new URL(name, root))).isFile()) existing.push(name); } catch {} }
  const sourceZip = fileURLToPath(new URL('shogi-match-exhibit-source.zip', output));
  await rm(sourceZip, { force: true });
  execFileSync('zip', ['-q', sourceZip, '-@'], { cwd: fileURLToPath(root), input: existing.join('\n')+'\n' });
  const bundle = fileURLToPath(new URL('shogi-match-exhibit-windows-x64.zip', output));
  await rm(bundle, { force: true });
  execFileSync('zip', ['-q', bundle, 'shogi-match-exhibit.exe', 'README-exe.txt', 'LICENSE.txt', 'NOTICE.txt', 'shogi-match-exhibit-source.zip'], { cwd: fileURLToPath(output), stdio: 'inherit' });
  const { size } = await stat(new URL('shogi-match-exhibit.exe', output));
  console.log(`Windows x64: exhibit/shogi-match-exhibit.exe (${(size / 1024 / 1024).toFixed(1)}MB)`);
} finally {
  await rm(stage, { recursive: true, force: true });
}
