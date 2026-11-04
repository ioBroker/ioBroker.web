import { deleteFoldersRecursive, buildReact, npmInstall, patchHtmlFile, copyFiles } from '@iobroker/build-tools';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const rootDir = import.meta.dirname;

/**
 * React 19 and 18 as one ES module each, served as `/lib/esm/react-<major>.js`: a web component written with React
 * imports it from there instead of bringing its own (see @iobroker/web-components)
 */
function copyReactModules(): void {
    const require = createRequire(import.meta.url);
    mkdirSync(`${rootDir}/www/lib/esm`, { recursive: true });
    for (const file of ['react-19.js', 'react-18.js']) {
        copyFileSync(require.resolve(`@iobroker/web-components/esm/${file}`), `${rootDir}/www/lib/esm/${file}`);
    }
}

async function copyAllFiles(): Promise<void> {
    copyFiles(['src-admin/build/**/*', '!src-admin/build/index.html'], 'admin/');

    await patchHtmlFile(`${rootDir}/src-admin/build/index.html`);
    copyFileSync(`${rootDir}/src-admin/build/index.html`, `${rootDir}/admin/index_m.html`);
}

async function buildLogin(): Promise<void> {
    deleteFoldersRecursive('www/login');
    deleteFoldersRecursive('src-login/build');
    await npmInstall(`${rootDir}/src-login`);
    await buildReact(`${rootDir}/src-login`, { rootDir: `${rootDir}/src-login`, vite: true });
    copyFiles(['src-login/build/**/*'], 'www/login/');
}

async function buildWww(): Promise<void> {
    deleteFoldersRecursive('src-www/build');
    await npmInstall(`${rootDir}/src-www`);
    await buildReact(`${rootDir}/src-www`, { rootDir: `${rootDir}/src-www`, vite: true });
    copyFiles(['src-www/build/**/*'], 'www/');
    copyReactModules();
}

if (process.argv.includes('--www')) {
    buildWww().catch(e => {
        console.log(`Cannot npm install: ${e}`);
        process.exit(2);
    });
} else if (process.argv.includes('--react-esm')) {
    copyReactModules();
} else if (process.argv.includes('--0-clean')) {
    deleteFoldersRecursive('admin', ['web.png', 'web.svg']);
    deleteFoldersRecursive('src-admin/build');
} else if (process.argv.includes('--1-npm')) {
    if (!existsSync(`${rootDir}/src-admin/node_modules`)) {
        npmInstall(`${rootDir}/src-admin`).catch(e => {
            console.log(`Cannot npm install: ${e}`);
            process.exit(2);
        });
    }
} else if (process.argv.includes('--2-build')) {
    buildReact(`${rootDir}/src-admin`, { rootDir: `${rootDir}/src-admin`, vite: true }).catch(e => {
        console.log(`Cannot build: ${e}`);
        process.exit(2);
    });
} else if (process.argv.includes('--3-copy')) {
    copyAllFiles().catch(e => {
        console.log(`Cannot copy: ${e}`);
        process.exit(2);
    });
} else if (process.argv.includes('--4-login')) {
    buildLogin().catch(e => {
        console.log(`Cannot build login: ${e}`);
        process.exit(2);
    });
} else if (process.argv.includes('--5-post-backend')) {
    if (!existsSync(`${rootDir}/build`)) {
        mkdirSync(`${rootDir}/build`);
    }
    copyFiles(['src/i18n/**/*'], 'build/i18n/');
} else {
    deleteFoldersRecursive('admin', ['web.png', 'web.svg']);
    deleteFoldersRecursive('src-admin/build');
    npmInstall(`${rootDir}/src-admin`)
        .then(() => buildReact(`${rootDir}/src-admin`, { rootDir: `${rootDir}/src-admin`, vite: true }))
        .then(() => copyAllFiles())
        .then(() => buildLogin())
        .then(() => buildWww())
        .catch(e => {
            console.log(`Cannot build: ${e}`);
            process.exit(2);
        });
}
