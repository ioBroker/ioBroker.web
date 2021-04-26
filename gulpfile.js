'use strict';

const gulp      = require('gulp');
const fs        = require('fs');
const del       = require('del');
const pkg       = require('./package.json');
const ioPackage = require('./io-package.json');
const version   = (pkg && pkg.version) ? pkg.version : ioPackage.common.version;
const cp        = require('child_process');

gulp.task('updatePackages', done => {
    ioPackage.common.version = pkg.version;
    ioPackage.common.news = ioPackage.common.news || {};
    if (!ioPackage.common.news[pkg.version]) {
        const news = ioPackage.common.news;
        const newNews = {};

        newNews[pkg.version] = {
            en: 'news',
            de: 'neues',
            ru: 'новое',
            'zh-cn': '消息'
        };
        ioPackage.common.news = Object.assign(newNews, news);
    }
    fs.writeFileSync('io-package.json', JSON.stringify(ioPackage, null, 4));
    done();
});

gulp.task('updateReadme', done => {
    const readme = fs.readFileSync('README.md').toString();
    const pos = readme.indexOf('## Changelog\n');
    if (pos !== -1) {
        const readmeStart = readme.substring(0, pos + '## Changelog\n'.length);
        const readmeEnd   = readme.substring(pos + '## Changelog\n'.length);

        if (readme.indexOf(version) === -1) {
            const timestamp = new Date();
            const date = timestamp.getFullYear() + '-' +
                ('0' + (timestamp.getMonth() + 1).toString(10)).slice(-2) + '-' +
                ('0' + (timestamp.getDate()).toString(10)).slice(-2);

            let news = '';
            if (ioPackage.common.news && ioPackage.common.news[pkg.version]) {
                news += '* ' + ioPackage.common.news[pkg.version].en;
            }

            fs.writeFileSync('README.md', `${readmeStart}### ${version} (${date})\n${news ? news + '\n\n' : '\n'}${readmeEnd}`);
        }
    }
    done();
});

gulp.task('clean', () =>
    del(['admin/*/**', 'admin/*', '!admin/web.png']));

function npmInstall() {
    return new Promise((resolve, reject) => {
        // Install node modules
        const cwd = __dirname.replace(/\\/g, '/') + '/src/';

        const cmd = `npm install`;
        console.log(`"${cmd} in ${cwd}`);

        // System call used for update of js-controller itself,
        // because during installation npm packet will be deleted too, but some files must be loaded even during the install process.
        const exec = require('child_process').exec;
        const child = exec(cmd, {cwd});

        child.stderr.pipe(process.stderr);
        child.stdout.pipe(process.stdout);

        child.on('exit', (code /* , signal */) => {
            // code 1 is strange error that cannot be explained. Everything is installed but error :(
            if (code && code !== 1) {
                reject('Cannot install: ' + code);
            } else {
                console.log(`"${cmd} in ${cwd} finished.`);
                // command succeeded
                resolve();
            }
        });
    });
}

gulp.task('2-npm', () => {
    if (fs.existsSync(__dirname + '/src/node_modules')) {
        return Promise.resolve();
    } else {
        return npmInstall();
    }
});

gulp.task('2-npm-dep', gulp.series('clean', '2-npm'));

function build() {
    return new Promise((resolve, reject) => {
        const options = {
            stdio: 'pipe',
            cwd:   __dirname + '/src/'
        };

        const version = JSON.parse(fs.readFileSync(__dirname + '/package.json').toString('utf8')).version;
        const data = JSON.parse(fs.readFileSync(__dirname + '/src/package.json').toString('utf8'));
        data.version = version;
        fs.writeFileSync(__dirname + '/src/package.json', JSON.stringify(data, null, 4));

        console.log(options.cwd);

        let script = __dirname + '/src/node_modules/react-scripts/scripts/build.js';
        if (!fs.existsSync(script)) {
            script = __dirname + '/node_modules/react-scripts/scripts/build.js';
        }
        if (!fs.existsSync(script)) {
            console.error('Cannot find execution file: ' + script);
            reject('Cannot find execution file: ' + script);
        } else {
            const child = cp.fork(script, [], options);
            child.stdout.on('data', data => console.log(data.toString()));
            child.stderr.on('data', data => console.log(data.toString()));
            child.on('close', code => {
                console.log(`child process exited with code ${code}`);
                code ? reject('Exit code: ' + code) : resolve();
            });
        }
    });
}

gulp.task('3-build', () => build());

gulp.task('3-build-dep', gulp.series('2-npm-dep', '3-build'));

gulp.task('5-copy', () =>
    gulp.src(['src/build/*/**', 'src/build/*'])
        .pipe(gulp.dest('admin/')));

gulp.task('5-copy-dep', gulp.series('3-build-dep', '5-copy'));

gulp.task('6-patch', () => new Promise(resolve => {
    if (fs.existsSync(__dirname + '/admin/index.html')) {
        let code = fs.readFileSync(__dirname + '/admin/index.html').toString('utf8');
        code = code.replace(/<script>var script=document\.createElement\("script"\)[^<]+<\/script>/,
            `<script type="text/javascript" src="./../../lib/js/socket.io.js"></script>`);

        fs.unlinkSync(__dirname + '/admin/index.html');
        fs.writeFileSync(__dirname + '/admin/index_m.html', code);
    }
    if (fs.existsSync(__dirname + '/src/build/index.html')) {
        let code = fs.readFileSync(__dirname + '/src/build/index.html').toString('utf8');
        code = code.replace(/<script>var script=document\.createElement\("script"\)[^<]+<\/script>/,
            `<script type="text/javascript" src="./../../lib/js/socket.io.js"></script>`);

        fs.writeFileSync(__dirname + '/src/build/index.html', code);
    }
    resolve();
}));

gulp.task('6-patch-dep',  gulp.series('5-copy-dep', '6-patch'));

gulp.task('default', gulp.series('6-patch-dep'));
