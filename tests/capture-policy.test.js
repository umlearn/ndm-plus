const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = vm.createContext({ URL });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'capture-policy.js'), 'utf8'), context);
const policy = context.NeatCapturePolicy;

test('normalizes domains and URLs while preserving subdomain coverage', () => {
    assert.equal(policy.normalizeHostname(' Example.COM/path '), 'example.com');
    assert.equal(policy.normalizeHostname('*.media.example.com'), 'media.example.com');
    assert.equal(policy.normalizeHostname('https://www.example.com/watch'), 'www.example.com');
    assert.equal(policy.hostMatches('www.example.com', 'example.com'), true);
    assert.equal(policy.hostMatches('notexample.com', 'example.com'), false);
});

test('global state and paused sites resolve to one effective state', () => {
    assert.deepEqual({ ...policy.getSiteState(true, 'youtube.com', []) }, {
        enabled: true, host: 'youtube.com', pausedRule: '', reason: 'active'
    });
    assert.deepEqual({ ...policy.getSiteState(true, 'www.youtube.com', ['youtube.com']) }, {
        enabled: false, host: 'www.youtube.com', pausedRule: 'youtube.com', reason: 'site'
    });
    assert.deepEqual({ ...policy.getSiteState(false, 'youtube.com', []) }, {
        enabled: false, host: 'youtube.com', pausedRule: '', reason: 'global'
    });
});

test('requests are paused by either their destination or initiator', () => {
    assert.equal(policy.isRequestPaused('https://cdn.test/video.mp4', 'https://www.example.com/', ['example.com']), true);
    assert.equal(policy.isRequestPaused('https://cdn.test/video.mp4', 'https://other.test/', ['example.com']), false);
});
