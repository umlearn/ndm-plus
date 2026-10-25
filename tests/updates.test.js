const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function setup(fetch) {
    let timeout, cleared = false;
    const context = vm.createContext({ fetch, AbortController,
        setTimeout(fn, delay) { assert.equal(delay, 10000); timeout = fn; return 1; },
        clearTimeout(id) { assert.equal(id, 1); cleared = true; }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'updates.js'), 'utf8'), context);
    return { updates: context.NeatUpdates, expire: () => timeout(), cleared: () => cleared };
}

const response = release => ({ ok: true, json: async () => release });

test('compares numeric version components and ignores v prefix and trailing zeroes', () => {
    const { compareVersions } = setup().updates;
    for (const [left, right, expected] of [
        ['2.0.10', '2.0.9', 1], ['v2.1.0', '2.0.99', 1], ['2.0.1', '2.0.1.0', 0],
        ['2.0.1', '3.0.0', -1], ['2.0', '2.0.0', 0]
    ]) assert.equal(compareVersions(left, right), expected);
    for (const invalid of ['', null, '2.1-beta', '2.0.0.0.1', 'latest', '2.0<script>']) {
        assert.throws(() => compareVersions(invalid, '2.0.1'));
    }
});

test('queries latest official release without credentials and constructs a trusted release link', async () => {
    const { updates, cleared } = setup(async (url, options) => {
        assert.equal(url, 'https://api.github.com/repos/umlearn/ndm-plus/releases/latest');
        assert.equal(options.credentials, 'omit');
        assert.equal(options.cache, 'no-store');
        assert.ok(options.signal);
        return response({ tag_name: 'v2.0.2', draft: false, prerelease: false, html_url: 'https://untrusted.test/' });
    });
    const result = await updates.check('2.0.1');
    assert.equal(result.available, true);
    assert.equal(result.version, '2.0.2');
    assert.equal(result.url, 'https://github.com/umlearn/ndm-plus/releases/tag/v2.0.2');
    assert.equal(cleared(), true);
});

test('equal or older releases do not offer a downgrade', async () => {
    for (const tag_name of ['v2.0.1', 'v2.0.0']) {
        assert.equal((await setup(async () => response({ tag_name })).updates.check('2.0.1')).available, false);
    }
});

test('HTTP errors, invalid JSON, malformed versions, drafts, prereleases, and network failures reject cleanly', async () => {
    for (const fetch of [
        async () => ({ ok: false, status: 403 }),
        async () => ({ ok: false, status: 404 }),
        async () => ({ ok: true, json: async () => { throw new Error('Invalid JSON'); } }),
        async () => response({ tag_name: 'latest' }),
        async () => response({ tag_name: 'v3.0.0', draft: true }),
        async () => response({ tag_name: 'v3.0.0', prerelease: true }),
        async () => response(null),
        async () => { throw new Error('Offline'); }
    ]) {
        const state = setup(fetch);
        await assert.rejects(state.updates.check('2.0.1'));
        assert.equal(state.cleared(), true);
    }
});

test('a stalled request is aborted after the timeout and cleans up', async () => {
    const state = setup((_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('Aborted')));
    }));
    const pending = state.updates.check('2.0.1');
    state.expire();
    await assert.rejects(pending, /Aborted/);
    assert.equal(state.cleared(), true);
});

function optionsPage(check) {
    function element() {
        return { listeners: {}, value: '', textContent: '', hidden: false,
            addEventListener(type, callback) { this.listeners[type] = callback; },
            replaceChildren() {}, appendChild() {}, setAttribute() {}
        };
    }
    const elements = new Map();
    const document = {
        documentElement: {}, querySelectorAll: () => [], createElement: element,
        getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }
    };
    const context = vm.createContext({ document, navigator: { language: 'en' },
        chrome: {
            runtime: { getManifest: () => ({ version: '2.0.1' }) },
            storage: { local: { get(_keys, callback) { callback({}); }, set() {} }, onChanged: { addListener() {} } }
        },
        NeatUpdates: { RELEASES_URL: 'https://github.com/umlearn/ndm-plus/releases/latest', check }
    });
    for (const file of ['i18n.js', 'capture-policy.js', 'options.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
    }
    return { get: id => document.getElementById(id) };
}

test('settings only checks on click, prevents duplicates, and keeps results translated on language change', async () => {
    let calls = 0, resolve;
    const page = optionsPage(() => { calls++; return new Promise(done => { resolve = done; }); });
    const button = page.get('check-updates');
    assert.equal(page.get('extension-version').textContent, 'NDM Plus v2.0.1');
    assert.equal(calls, 0);
    assert.equal(page.get('update-link').hidden, true);
    const pending = button.listeners.click();
    assert.equal(button.disabled, true);
    await button.listeners.click();
    assert.equal(calls, 1);
    page.get('language-select').value = 'zh-CN';
    page.get('language-select').listeners.change();
    assert.equal(button.textContent, '正在检查更新…');
    resolve({ available: true, version: '2.0.2', url: 'https://github.com/umlearn/ndm-plus/releases/tag/v2.0.2' });
    await pending;
    assert.equal(button.disabled, false);
    assert.equal(page.get('update-status').textContent, '发现新版本 v2.0.2');
    assert.equal(page.get('update-link').hidden, false);
    assert.equal(page.get('update-instructions').hidden, false);
});

test('settings shows error fallback, allows retry, and hides stale update links on success', async () => {
    let calls = 0;
    const page = optionsPage(async () => {
        if (calls++ === 0) throw new Error('Offline');
        return { available: false, version: '2.0.1' };
    });
    const button = page.get('check-updates');
    await button.listeners.click();
    assert.equal(button.disabled, false);
    assert.match(page.get('update-status').textContent, /Could not check/);
    assert.equal(page.get('update-link').hidden, false);
    assert.equal(page.get('update-link').href, 'https://github.com/umlearn/ndm-plus/releases/latest');
    await button.listeners.click();
    assert.equal(page.get('update-status').textContent, 'You’re up to date.');
    assert.equal(page.get('update-link').hidden, true);
    assert.equal(page.get('update-instructions').hidden, true);
});
