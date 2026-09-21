// Garde-fous sur les workflows GitHub : on ne peut pas les lancer ici, alors on vérifie leurs propriétés de sécurité
// et on exécute pour de vrai le script de notification contre un faux serveur local.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { ROOT_DIR } from '../lib/paths.mjs';

const read = (name) => readFileSync(path.join(ROOT_DIR, '.github', 'workflows', name), 'utf8');
const validate = read('validate.yml');
const notify = read('notify-deploy.yml');

const indent = (line) => line.match(/^ */)[0].length;
const isComment = (line) => line.trim().startsWith('#');

/** Toutes les commandes « run: » d'un workflow : [{ step, script }]. Petit analyseur maison (pas de dépendance YAML). */
function runBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let stepName = '';
  for (let i = 0; i < lines.length; i += 1) {
    const name = lines[i].match(/^\s*- name: (.+)$/);
    if (name) stepName = name[1];
    const run = lines[i].match(/^(\s*)run: (.*)$/);
    if (!run) continue;
    if (run[2] === '|') {
      const body = [];
      for (let j = i + 1; j < lines.length && (lines[j].trim() === '' || indent(lines[j]) > run[1].length); j += 1) body.push(lines[j].slice(run[1].length + 2));
      blocks.push({ step: stepName, script: body.join('\n').trim() });
    } else {
      blocks.push({ step: stepName, script: run[2] });
    }
  }
  return blocks;
}
const codeLines = (text) => text.split('\n').filter((line) => !isComment(line));

// ------------------------------------------------------------------ validate.yml
test('validate : utilise « pull_request » et jamais « pull_request_target » ni « workflow_run »', () => {
  const code = codeLines(validate).join('\n');
  assert.match(code, /^\s*pull_request:\s*$/m);
  assert.doesNotMatch(code, /pull_request_target/);
  assert.doesNotMatch(code, /workflow_run/);
});

test('validate : jeton en lecture seule (aucune permission d\'écriture)', () => {
  assert.match(validate, /^permissions:\n  contents: read$/m);
  assert.doesNotMatch(codeLines(validate).join('\n'), /: write\b/);
});

test('validate : le job s\'appelle « validate » (nom du contrôle à rendre obligatoire)', () => {
  assert.match(validate, /^ {2}validate:\n {4}name: validate$/m);
});

test('validate : toutes les actions sont épinglées par une empreinte de commit de 40 caractères', () => {
  const uses = [...validate.matchAll(/^\s*uses: (\S+)/gm)].map((m) => m[1]);
  assert.ok(uses.length >= 3);
  for (const action of uses) assert.match(action, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, action);
});

test('validate : chaque récupération du dépôt (checkout) ne garde pas le jeton (persist-credentials: false)', () => {
  const checkouts = (validate.match(/uses: actions\/checkout@/g) ?? []).length;
  const safe = (validate.match(/persist-credentials: false/g) ?? []).length;
  assert.equal(checkouts, 2);
  assert.equal(safe, checkouts);
});

test('validate : le contrôle de périmètre vient d\'une copie de main récupérée dans un dossier à part', () => {
  assert.match(validate, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}\n\s+path: trusted/);
  const scope = runBlocks(validate).find((b) => /périmètre/.test(b.step));
  assert.ok(scope, 'une étape de contrôle de périmètre existe');
  assert.match(scope.script, /node \.\.\/trusted\/scripts\/check-scope\.mjs/);
  assert.doesNotMatch(scope.script, /node (\.\/)?(pr\/)?scripts\/check-scope/, 'jamais la copie de la PR');
  assert.match(scope.script, /git diff --name-only --no-renames -z HEAD\^1 HEAD/, 'les renommages comptent comme une modification de l\'ancien chemin');
});

test('validate : le contrôle de périmètre passe AVANT l\'installation des dépendances', () => {
  const steps = [...validate.matchAll(/^\s*- name: (.+)$/gm)].map((m) => m[1]);
  const scope = steps.findIndex((s) => /périmètre/.test(s));
  const install = steps.findIndex((s) => /Installer les dépendances/.test(s));
  assert.ok(scope >= 0 && install > scope, `ordre des étapes : ${steps.join(' | ')}`);
});

test('validate : le périmètre et la copie de main ne concernent que les Pull Requests', () => {
  for (const title of ['copie de confiance', 'Contrôle de périmètre']) {
    const step = validate.split(/^\s*- name: /m).find((chunk) => chunk.startsWith(title) || chunk.includes(title));
    assert.match(step, /if: github\.event_name == 'pull_request'/, title);
  }
});

test('validate : les dépendances s\'installent sans scripts d\'installation, et les 3 contrôles sont lancés', () => {
  const scripts = runBlocks(validate).map((b) => b.script);
  assert.ok(scripts.includes('npm ci --ignore-scripts'));
  assert.ok(scripts.includes('npm test'));
  assert.ok(scripts.includes('npm run check'));
  assert.ok(scripts.includes('npm run format -- --check'));
});

test('validate : rien venu de la Pull Request n\'est écrit directement dans une commande « run »', () => {
  for (const { step, script } of runBlocks(validate)) {
    assert.doesNotMatch(script, /\$\{\{/, `l'étape « ${step} » insère une expression dans son script : passez par « env: »`);
  }
});

test('validate : aucun secret n\'est utilisé (le code des PR ne doit pas pouvoir les voir)', () => {
  assert.doesNotMatch(codeLines(validate).join('\n'), /secrets\./);
});

// ------------------------------------------------------------------ notify-deploy.yml
test('notify-deploy : se lance sur push vers main (et à la demande), sans aucun droit sur le dépôt', () => {
  assert.match(notify, /^on:\n {2}push:\n {4}branches: \[main\]\n/m);
  assert.match(notify, /^permissions: \{\}$/m);
  assert.doesNotMatch(codeLines(notify).join('\n'), /pull_request/);
});

test('notify-deploy : le secret n\'est lu que par une variable d\'environnement, jamais dans un script', () => {
  const code = codeLines(notify).join('\n');
  const uses = code.split('\n').filter((line) => line.includes('secrets.'));
  assert.deepEqual(uses.map((l) => l.trim()), ['DEPLOY_HOOK_URL: ${{ secrets.DEPLOY_HOOK_URL }}']);
  for (const { script } of runBlocks(notify)) assert.doesNotMatch(script, /\$\{\{/);
});

test('notify-deploy : le script n\'affiche jamais l\'adresse (pas d\'écho, de trace, de mode verbeux)', () => {
  const [{ script }] = runBlocks(notify);
  assert.doesNotMatch(script, /set -x|set -o xtrace|--verbose|\bcurl\b[^\n]* -v\b|--trace|url_effective|printenv|\benv\b|--show-error|--fail-with-body/);
  for (const line of script.split('\n')) {
    if (/\becho\b/.test(line)) assert.doesNotMatch(line, /\$\{?DEPLOY_HOOK_URL/, `écho de l'adresse : ${line}`);
  }
  assert.match(script, /2> \/dev\/null/, 'les messages de curl (qui peuvent citer l\'adresse) sont supprimés');
  assert.match(script, /--fail/);
  assert.match(script, /--max-time/);
});

// ------------------------------------------------------------------ le script de notification, pour de vrai
const [{ script: notifyScript }] = runBlocks(notify);
const runNotify = (env) => new Promise((resolve) => {
  const child = spawn('bash', ['-e', '-c', notifyScript], { env: { PATH: process.env.PATH, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  child.on('close', (status) => resolve({ status, stdout, stderr }));
});
const withServer = async (handler, fn) => {
  const requests = [];
  const server = createServer((req, res) => { requests.push({ method: req.method, url: req.url }); handler(req, res); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { return await fn(`http://127.0.0.1:${server.address().port}/hooks/SECRET-TOKEN-4242`, requests); } finally { server.close(); }
};

test('notify-deploy (exécution) : sans secret, se termine proprement sans erreur', async () => {
  for (const env of [{}, { DEPLOY_HOOK_URL: '' }]) {
    const result = await runNotify(env);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /DEPLOY_HOOK_URL n'existe pas : rien à faire/);
  }
});

test('notify-deploy (exécution) : envoie un POST à l\'adresse du secret sans jamais l\'afficher', async () => {
  await withServer((req, res) => { res.statusCode = 200; res.end('ok'); }, async (url, requests) => {
    const result = await runNotify({ DEPLOY_HOOK_URL: url });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(requests, [{ method: 'POST', url: '/hooks/SECRET-TOKEN-4242' }]);
    assert.match(result.stdout, /L'hébergeur du site a été prévenu/);
    const output = `${result.stdout}${result.stderr}`;
    assert.equal(output.includes('SECRET-TOKEN-4242'), false);
    assert.equal(output.includes('127.0.0.1'), false);
  });
});

test('notify-deploy (exécution) : si l\'hébergeur refuse, le workflow échoue SANS afficher l\'adresse', async () => {
  await withServer((req, res) => { res.statusCode = 500; res.end('boom'); }, async (url) => {
    const result = await runNotify({ DEPLOY_HOOK_URL: url });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /::error title=Notification du site::L'appel au deploy hook a échoué \(code \d+\)/);
    const output = `${result.stdout}${result.stderr}`;
    assert.equal(output.includes('SECRET-TOKEN-4242'), false);
    assert.equal(output.includes('127.0.0.1'), false);
  });
});

test('notify-deploy (exécution) : une adresse injoignable échoue aussi sans l\'afficher', async () => {
  const result = await runNotify({ DEPLOY_HOOK_URL: 'http://127.0.0.1:9/hooks/SECRET-TOKEN-4242' });
  assert.equal(result.status, 1);
  assert.equal(`${result.stdout}${result.stderr}`.includes('SECRET-TOKEN-4242'), false);
});
