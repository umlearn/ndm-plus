const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function setup(language = 'en-US') {
    const context = vm.createContext({
        navigator: { language },
        chrome: { i18n: { getUILanguage: () => language } }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'i18n.js'), 'utf8'), context);
    return context;
}

test('automatic language follows Chrome and maps Chinese locales', () => {
    const context = setup('zh-CN');
    assert.equal(context.NeatI18n.getLanguage(), 'zh-CN');
    assert.equal(context.NeatI18n.t('popup.siteTitle'), '在此网站接管下载');
});

test('manual language overrides browser language and supports interpolation', () => {
    const context = setup('zh-CN');
    context.NeatI18n.setLanguage('en');
    assert.equal(context.NeatI18n.getLanguage(), 'en');
    assert.equal(context.NeatI18n.t('popup.siteRuleDescription', { domain: 'example.com' }),
        'example.com also pauses its subdomains. Manage paused sites to change it.');
});

test('new locale catalogs can be registered without changing translation consumers', () => {
    const context = setup('en-US');
    context.NeatI18n.registerLocale('fr', {
        'language.name': 'Français',
        'popup.siteTitle': 'Capturer sur ce site'
    });
    context.NeatI18n.setLanguage('fr');
    assert.equal(context.NeatI18n.t('popup.siteTitle'), 'Capturer sur ce site');
    assert.equal(context.NeatI18n.t('popup.active'), 'Active');
    assert.deepEqual(
        Array.from(context.NeatI18n.supportedLanguages(), language => language.code),
        ['en', 'zh-CN', 'fr']
    );
});

test('every static UI translation key has an English message', () => {
    const context = setup('en-US');
    const files = ['popup.html', 'options.html', 'popup.js', 'options.js', 'bg.js', 'ct.js'];
    const keys = new Set();
    for (const file of files) {
        const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
        for (const match of source.matchAll(
            /(?:data-i18n(?:-[a-z-]+)?=|(?:NeatI18n\.)?t\()(["'])([a-z][a-z0-9-]*\.[a-z0-9.-]+)\1/g
        )) keys.add(match[2]);
    }
    for (const key of keys) {
        assert.notEqual(context.NeatI18n.t(key), key, `Missing translation for ${key}`);
    }
});
