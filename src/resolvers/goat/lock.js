const { Worker } = require('node:worker_threads');
const path = require('path');

const workerPath = path.join(__dirname, 'lock-worker.js');

function unlock(slot, goat, body) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerPath, {
            workerData: { slot, goat, bodyHex: body.toString('hex') }
        });
        worker.once('message', (msg) => {
            worker.terminate().catch(() => {});
            if (msg.ok) resolve(msg.url);
            else reject(new Error(msg.error || 'lock decrypt failed'));
        });
        worker.once('error', (err) => {
            worker.terminate().catch(() => {});
            reject(err);
        });
    });
}

module.exports = { unlock };