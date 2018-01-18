/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');


Error.stackTraceLimit = Infinity;

const compilerOptions = ts.readConfigFile(path.join(__dirname, '../tsconfig.json'), p => {
    return fs.readFileSync(p, 'utf-8');
}).config;


const oldRequireTs = require.extensions['.ts'];
require.extensions['.ts'] = function (m, filename) {
    // If we're in node module, either call the old hook or simply compile the
    // file without transpilation. We do not touch node_modules/**.
    // We do touch `Angular DevK` files anywhere though.
    if (!filename.match(/@angular\/cli\b/) && filename.match(/node_modules/)) {
        if (oldRequireTs) {
            return oldRequireTs(m, filename);
        }
        return m._compile(fs.readFileSync(filename), filename);
    }

    // Node requires all require hooks to be sync.
    const source = fs.readFileSync(filename).toString();

    try {
        let result = ts.transpile(source, compilerOptions['compilerOptions'], filename);

        // Send it to node to execute.
        return m._compile(result, filename);
    } catch (err) {
        console.error('Error while running script "' + filename + '":');
        console.error(err.stack);
        throw err;
    }
};
