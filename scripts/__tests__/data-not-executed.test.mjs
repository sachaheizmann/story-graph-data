// Sécurité : un fichier déposé dans data/ (par exemple data/evil.test.mjs, dans une Pull Request) ne doit JAMAIS
// être exécuté. « node --test » sans argument cherche des fichiers de test partout ; c'est pourquoi le script
// « test » de package.json désigne explicitement scripts/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ROOT_DIR } from '../lib/paths.mjs';
import { checkDataset } from '../lib/check.mjs';
import { assertIssue, makeDataset } from './helpers.mjs';

const pkg = JSON.parse(readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
const skip = process.platform === 'win32' ? 'ce test utilise bash' : false;

// Des fichiers que la découverte automatique de « node --test » exécute (voir la doc de Node : *.test.*, *-test.*,
// test-*.*, test.*, et tout ce qui est dans un dossier « test »).
const EVIL_FILES = [
  'data/evil.test.mjs',
  'data/nested/deep/evil.test.js',
  'data/evil-test.mjs',
  'data/test-evil.mjs',
  'data/test/evil.mjs',
];

/** Un mini-projet : le vrai package.json, un test légitime dans scripts/ et des fichiers piégés dans data/. */
function makeProject() {
  const dir = mkdtempSync(path.join(tmpdir(), 'book-tree-evil-'));
  const put = (rel, text) => { mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); writeFileSync(path.join(dir, rel), text); };
  put('package.json', readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  put('scripts/__tests__/legit.test.mjs',
    "import { test } from 'node:test';\nimport { appendFileSync } from 'node:fs';\ntest('légitime', () => { appendFileSync(process.env.MARKER_FILE, 'OK\\n'); });\n");
  for (const rel of EVIL_FILES) {
    put(rel, `import { appendFileSync } from 'node:fs';\nappendFileSync(process.env.MARKER_FILE, 'EVIL ${rel}\\n');\n`);
  }
  put('data/evil.test.cjs', "require('node:fs').appendFileSync(process.env.MARKER_FILE, 'EVIL data/evil.test.cjs\\n');\n");
  return { dir, marker: path.join(dir, 'markers.txt') };
}

const run = (project, command) => {
  const env = { ...process.env, MARKER_FILE: project.marker };
  // Lancé depuis un test, « node --test » hériterait de cette variable et se prendrait pour un sous-processus :
  // il ne chercherait plus aucun fichier. On repart d'un environnement « normal ».
  delete env.NODE_TEST_CONTEXT;
  return spawnSync('bash', ['-c', command], { cwd: project.dir, encoding: 'utf8', env });
};
const markers = (project) => (existsSync(project.marker) ? readFileSync(project.marker, 'utf8').trim().split('\n') : []);
const node = JSON.stringify(process.execPath);

test('contrôle négatif : « node --test » sans argument EXÉCUTE bien les fichiers piégés de data/ (le danger est réel)', { skip }, () => {
  const project = makeProject();
  try {
    run(project, `${node} --test`);
    const executed = markers(project).filter((line) => line.startsWith('EVIL'));
    assert.ok(executed.includes('EVIL data/evil.test.mjs'), `fichiers exécutés : ${executed.join(', ') || '(aucun)'}`);
    assert.ok(executed.length >= 3, 'plusieurs formes de noms sont exécutées par la découverte automatique');
  } finally { rmSync(project.dir, { recursive: true, force: true }); }
});

test('le script « test » de package.json n\'exécute aucun fichier de data/ (data/evil.test.mjs ne tourne pas)', { skip }, () => {
  const project = makeProject();
  try {
    assert.match(pkg.scripts.test, /^node --test /, 'le script commence par « node --test »');
    const result = run(project, pkg.scripts.test.replace(/^node /, `${node} `));
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const lines = markers(project);
    assert.deepEqual(lines.filter((line) => line.startsWith('EVIL')), [], 'aucun fichier de data/ n\'a été exécuté');
    assert.deepEqual(lines, ['OK'], 'seul le test légitime de scripts/ a tourné');
  } finally { rmSync(project.dir, { recursive: true, force: true }); }
});

test('package.json : le script « test » désigne scripts/ et n\'est pas un « node --test » nu', () => {
  assert.notEqual(pkg.scripts.test.trim(), 'node --test');
  assert.match(pkg.scripts.test, /scripts\//);
  assert.doesNotMatch(pkg.scripts.test, /\bdata\b/);
});

test('deuxième ligne de défense : « npm run check » refuse un fichier .mjs déposé dans data/', () => {
  const dataset = makeDataset((d) => d.writeText('mini-saga/evil.test.mjs', 'process.exit(0);\n'));
  try {
    const { errors } = checkDataset(dataset.dataDir);
    assertIssue(errors, 'files.unexpected', /ni du JSON ni du Markdown/, { file: 'evil.test.mjs' });
  } finally { dataset.cleanup(); }
});
