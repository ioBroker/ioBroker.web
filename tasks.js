const { deleteFoldersRecursive, buildReact, npmInstall, patchHtmlFile, copyFiles } = require('@iobroker/build-tools');
const { copyFileSync, existsSync, mkdirSync } = require('node:fs');

async function copyAllFiles() {
    copyFiles(['src-admin/build/**/*', '!src-admin/build/index.html'], 'admin/');

    await patchHtmlFile(`${__dirname}/src-admin/build/index.html`);
    copyFileSync(`${__dirname}/src-admin/build/index.html`, `${__dirname}/admin/index_m.html`);
}

function buildLogin() {
    deleteFoldersRecursive('www/login');
    deleteFoldersRecursive('src-login/build');
    return npmInstall(`${__dirname}/src-login`)
        .then(() => buildReact(`${__dirname}/src-login`, { rootDir: `${__dirname}/src-login`, vite: true }))
        .then(() => {
            copyFiles(['src-login/build/**/*'], 'www/login/');
        });
}
function buildWww() {
    deleteFoldersRecursive('src-www/build');
    return npmInstall(`${__dirname}/src-www`)
        .then(() => buildReact(`${__dirname}/src-www`, { rootDir: `${__dirname}/src-www`, vite: true }))
        .then(() => {
            copyFiles(['src-www/build/**/*'], 'www/');
        });
}

if (process.argv.includes('--www')) {
    buildWww().catch(e => {
        console.log(`Cannot npm install: ${e}`);
        process.exit(2);
    });
} else if (process.argv.includes('--0-clean')) {
    deleteFoldersRecursive('admin', ['web.png', 'web.svg']);
    deleteFoldersRecursive('src-admin/build');
} else if (process.argv.includes('--1-npm')) {
    if (!existsSync(`${__dirname}/src-admin/node_modules`)) {
        npmInstall(`${__dirname}/src-admin`).catch(e => {
            console.log(`Cannot npm install: ${e}`);
            process.exit(2);
        });
    }
} else if (process.argv.includes('--2-build')) {
    buildReact(`${__dirname}/src-admin`, { rootDir: `${__dirname}/src-admin`, vite: true }).catch(e => {
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
    if (!existsSync(`${__dirname}/build`)) {
        mkdirSync(`${__dirname}/build`);
    }
    copyFiles(['src/i18n/**/*'], 'build/i18n/');
} else {
    deleteFoldersRecursive('admin', ['web.png', 'web.svg']);
    deleteFoldersRecursive('src-admin/build');
    return npmInstall(`${__dirname}/src-admin`)
        .then(() => buildReact(`${__dirname}/src-admin`, { rootDir: `${__dirname}/src-admin`, vite: true }))
        .then(() => copyAllFiles())
        .then(() => buildLogin())
        .then(() => buildWww())
        .catch(e => {
            console.log(`Cannot build: ${e}`);
            process.exit(2);
        });
}
