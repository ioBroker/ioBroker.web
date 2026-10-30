const path = require('node:path');
const { tests } = require('@iobroker/testing');

// Validate package.json and io-package.json (incl. the io-package.json schema of js-controller)
tests.packageFiles(path.join(__dirname, '..'));
