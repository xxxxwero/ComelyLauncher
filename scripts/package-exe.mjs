import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = join(root, 'release');
const archive = join(release, 'app-payload.zip');
const buildDir = join(release, 'installer-build');
const installer = join(root, 'installer');
const compiler = join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
const testBuild = process.argv.includes('--test-build');
const outputExe = join(testBuild ? join(release, 'installer-test') : release, 'ComelyLauncher-Setup.exe');
const uninstallerExe = join(buildDir, 'uninstall.exe');
const icon = join(root, 'assets', 'icons', 'comelylauncher-icon-256.png');

if (!existsSync(archive)) throw new Error('release/app-payload.zip is missing, run electron-builder first');
if (!existsSync(compiler)) throw new Error(`C# compiler not found: ${compiler}`);

rmSync(buildDir, { recursive: true, force: true });
mkdirSync(buildDir, { recursive: true });
mkdirSync(dirname(outputExe), { recursive: true });

function compile(output, resources, sourceFolders) {
  execFileSync(
    compiler,
    [
      '/nologo',
      '/optimize+',
      '/target:winexe',
      ...(testBuild ? ['/define:INSTALLER_TEST'] : []),
      `/out:${output}`,
      `/win32icon:${join(root, 'assets', 'icons', 'comelylauncher.ico')}`,
      `/win32manifest:${join(installer, 'app.manifest')}`,
      '/r:System.IO.Compression.dll',
      '/r:System.IO.Compression.FileSystem.dll',
      '/r:System.Windows.Forms.dll',
      '/r:System.Drawing.dll',
      '/r:System.Management.dll',
      ...resources.map(([file, name]) => `/resource:${file},${name}`),
      ...sourceFolders.map((folder) => join(installer, folder, '*.cs'))
    ],
    { stdio: 'inherit' }
  );
}

const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const versionFile = join(buildDir, 'version.txt');
writeFileSync(versionFile, version);

compile(uninstallerExe, [[icon, 'icon.png']], ['common', 'uninstall']);
rmSync(outputExe, { force: true });
compile(
  outputExe,
  [
    [archive, 'payload.zip'],
    [versionFile, 'version.txt'],
    [icon, 'icon.png'],
    [uninstallerExe, 'uninstall.exe']
  ],
  ['common', 'setup']
);

if (testBuild) copyFileSync(uninstallerExe, join(dirname(outputExe), 'Uninstall-direct.exe'));
rmSync(buildDir, { recursive: true, force: true });
if (!testBuild) rmSync(archive, { force: true });
console.log(`Built ${outputExe} (${version})`);
