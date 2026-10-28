// Publica dist/ en la rama gh-pages del repositorio (GitHub Pages sirve esa rama).
// Uso: npm run deploy   (compila, prueba y publica). No requiere GitHub Actions.
import { execSync } from 'node:child_process';
import { writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const run = (cmd, cwd = process.cwd()) => execSync(cmd, { stdio: 'inherit', cwd });
const remote = execSync('git remote get-url origin').toString().trim();
run('npm test');
run('npm run build');
const dist = join(process.cwd(), 'dist');
writeFileSync(join(dist, '.nojekyll'), '');
if (existsSync(join(dist, '.git'))) rmSync(join(dist, '.git'), { recursive: true, force: true });
run('git init -q -b gh-pages', dist);
run('git add -A', dist);
run(`git -c user.name="C2 Recall deploy" -c user.email="deploy@c2-recall.local" commit -q -m "Deploy ${new Date().toISOString()}"`, dist);
run(`git push -f "${remote}" gh-pages`, dist);
rmSync(join(dist, '.git'), { recursive: true, force: true });
console.log('Publicado en la rama gh-pages.');
