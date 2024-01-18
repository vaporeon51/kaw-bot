/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const fs = require('fs');

function findFileWithExtension (baseName, extensions) {
    for (const extension of extensions) {
        const filePath = path.resolve(__dirname, `${baseName}.${extension}`);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    return null;
}

if (findFileWithExtension('worker', ['ts']) !== null) {
    require('ts-node').register();
    require(path.resolve(__dirname, 'worker.ts'));
} else if (findFileWithExtension('worker', ['js']) !== null) {
    require(path.resolve(__dirname, 'worker.js'));
} else {
    throw new Error('Cannot find worker file');
}
