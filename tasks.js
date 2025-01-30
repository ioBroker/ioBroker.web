const fs = require('fs');
const { deleteFoldersRecursive, buildReact, npmInstall, patchHtmlFile, copyFiles } = require('@iobroker/build-tools');
const { copyFileSync } = require('node:fs');

async function copyAllFiles() {
    copyFiles(['src-admin/build/**/*', '!src-admin/build/index.html'], 'admin/');

    await patchHtmlFile(`${__dirname}/src-admin/build/index.html`);
    copyFileSync(`${__dirname}/src-admin/build/index.html`, `${__dirname}/admin/index_m.html`);
}

if (process.argv.includes('--0-clean')) {
    deleteFoldersRecursive('admin', ['web.png']);
    deleteFoldersRecursive('src-admin/build');
} else if (process.argv.includes('--1-npm')) {
    if (!fs.existsSync(`${__dirname}/src-admin/node_modules`)) {
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
} else {
    deleteFoldersRecursive('admin', ['web.png']);
    deleteFoldersRecursive('src-admin/build');
    return npmInstall(`${__dirname}/src-admin`)
        .then(() => buildReact(`${__dirname}/src-admin`, { rootDir: `${__dirname}/src-admin`, vite: true }))
        .then(() => copyAllFiles())
        .catch(() => {
            console.log(`Cannot build: ${e}`);
            process.exit(2);
        });
}
