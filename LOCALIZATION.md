# Adding a language

The extension uses `NeatI18n.registerLocale(locale, messages)` for interface
translations. English is the fallback catalog, so a new language only needs to
override the keys it translates.

1. Add a language block next to the existing `en` and `zh-CN` catalogs in
   `i18n.js`.
2. Use a BCP 47 language code such as `fr`, `de`, or `pt-BR`.
3. Always include `language.name` with the language's native name.
4. Copy the keys from the English catalog and translate the user-facing values.
5. Add a test in `tests/i18n.test.js` for language selection and a few important
   strings.

Example:

```js
registerLocale("fr", {
    "language.name": "Français",
    "popup.globalTitle": "Capture automatique",
    "popup.siteTitle": "Capturer sur ce site"
});
```

Registered languages automatically appear in the language selector. Missing
keys fall back to English, which makes incremental translation safe.
