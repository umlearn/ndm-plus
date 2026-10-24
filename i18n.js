(function (root) {
    "use strict";

    const STORAGE_KEY = "uiLanguage";
    const DEFAULT_LANGUAGE = "en";
    const catalogs = new Map();
    let preference = "auto";
    let activeLanguage = DEFAULT_LANGUAGE;

    function normalizeLocale(value) {
        const language = String(value || "").trim().replace(/_/g, "-").toLowerCase();
        if (!language) return "";
        if (language === "zh" || language.startsWith("zh-")) return "zh-CN";
        if (language === "en" || language.startsWith("en-")) return "en";
        return language;
    }

    function browserLanguage() {
        try {
            const language = root.chrome && chrome.i18n && chrome.i18n.getUILanguage();
            if (language) return language;
        } catch (error) {
            // Fall back to the standard navigator language.
        }
        return root.navigator && root.navigator.language || DEFAULT_LANGUAGE;
    }

    function resolveLanguage(value) {
        const requested = value && value !== "auto" ? value : browserLanguage();
        const normalized = normalizeLocale(requested);
        if (catalogs.has(normalized)) return normalized;
        const base = normalized.split("-")[0];
        for (const locale of catalogs.keys()) {
            if (locale === base || locale.startsWith(`${base}-`)) return locale;
        }
        return DEFAULT_LANGUAGE;
    }

    function registerLocale(locale, messages) {
        const normalized = normalizeLocale(locale);
        if (!normalized || !messages || typeof messages !== "object") {
            throw new TypeError("A locale code and message object are required.");
        }
        const current = catalogs.get(normalized) || {};
        catalogs.set(normalized, Object.freeze({ ...current, ...messages }));
        activeLanguage = resolveLanguage(preference);
    }

    function format(message, values) {
        return String(message).replace(/\{(\w+)\}/g, function (match, key) {
            return values && Object.hasOwn(values, key) ? String(values[key]) : match;
        });
    }

    function t(key, values) {
        const catalog = catalogs.get(activeLanguage) || {};
        const fallback = catalogs.get(DEFAULT_LANGUAGE) || {};
        return format(catalog[key] ?? fallback[key] ?? key, values);
    }

    function setLanguage(value) {
        const requested = value || "auto";
        const normalized = normalizeLocale(requested);
        preference = requested === "auto" || !catalogs.has(normalized) ? "auto" : normalized;
        activeLanguage = resolveLanguage(preference);
        if (root.document && root.document.documentElement) {
            root.document.documentElement.lang = activeLanguage;
        }
        return activeLanguage;
    }

    function localizeDocument(scope) {
        const container = scope || root.document;
        if (!container || !container.querySelectorAll) return;
        container.querySelectorAll("[data-i18n]").forEach(function (element) {
            element.textContent = t(element.getAttribute("data-i18n"));
        });
        for (const [attribute, target] of [
            ["data-i18n-aria-label", "aria-label"],
            ["data-i18n-title", "title"],
            ["data-i18n-placeholder", "placeholder"]
        ]) {
            container.querySelectorAll(`[${attribute}]`).forEach(function (element) {
                element.setAttribute(target, t(element.getAttribute(attribute)));
            });
        }
    }

    function supportedLanguages() {
        return Array.from(catalogs.entries()).map(function ([code, messages]) {
            return { code: code, name: messages["language.name"] || code };
        });
    }

    root.NeatI18n = Object.freeze({
        STORAGE_KEY,
        registerLocale,
        resolveLanguage,
        setLanguage,
        getLanguage: () => activeLanguage,
        getPreference: () => preference,
        supportedLanguages,
        t,
        localizeDocument
    });

    registerLocale("en", {
        "language.name": "English",
        "action.on": "NDM Plus: Auto capture on",
        "action.paused": "NDM Plus: Auto capture paused",
        "context.download": "Download",
        "context.pauseSite": "Pause on this site",
        "context.resumeSite": "Resume on this site",
        "popup.subtitle": "Download capture",
        "popup.settings": "Open settings",
        "popup.globalEyebrow": "Global",
        "popup.globalTitle": "Automatic capture",
        "popup.globalOn": "Downloads can be handed to Neat Download Manager automatically.",
        "popup.globalOff": "Automatic capture and video download bars are paused everywhere.",
        "popup.currentWebsite": "Current website",
        "popup.checking": "Checking",
        "popup.siteTitle": "Capture on this site",
        "popup.siteToggle": "Capture downloads on this site",
        "popup.active": "Active",
        "popup.unavailable": "Unavailable",
        "popup.pausedGlobally": "Paused globally",
        "popup.pausedByRule": "Paused by site rule",
        "popup.pausedHere": "Paused here",
        "popup.siteUnsupported": "This page is not supported",
        "popup.siteChecking": "Checking this website’s setting.",
        "popup.siteUnavailableDescription": "Open a regular website to change its capture setting.",
        "popup.siteAlsoPaused": "This site is also paused in your site list.",
        "popup.siteWillResume": "This site will resume when global capture is enabled.",
        "popup.siteRuleDescription": "{domain} also pauses its subdomains. Manage paused sites to change it.",
        "popup.sitePausedDescription": "Downloads on this site stay in Chrome.",
        "popup.siteActiveDescription": "Downloads and the media panel are enabled here.",
        "popup.manageSites": "Manage paused sites",
        "options.pageTitle": "Neat Download Manager Settings",
        "options.brandEyebrow": "NDM Plus",
        "options.title": "Download capture settings",
        "options.languageTitle": "Language",
        "options.languageDescription": "Use your browser language or choose one for the extension interface.",
        "options.languageAuto": "Automatic (browser language)",
        "options.autoCaptureTitle": "Automatic capture",
        "options.autoCaptureDescription": "Hand downloadable files to Neat Download Manager and show media download panels on websites.",
        "options.pausedSitesTitle": "Paused sites",
        "options.pausedSitesDescription": "Automatic capture and video download panels stay off on these sites. Chrome handles downloads normally.",
        "options.siteLabel": "Website domain",
        "options.sitePlaceholder": "example.com",
        "options.pauseSite": "Pause site",
        "options.siteHint": "A domain also covers its subdomains. You can paste a full URL.",
        "options.noPausedSites": "No paused sites.",
        "options.resume": "Resume",
        "options.manualNote": "Manual “Download” actions remain available, even on paused sites.",
        "options.invalidSite": "Enter a valid website domain.",
        "options.alreadyPaused": "This site is already paused.",
        "options.githubProject": "github.com/umlearn/ndm-plus",
        "panel.label": "NDM Plus",
        "panel.showOptions": "Show video download options",
        "panel.hide": "Hide download panel",
        "panel.mediaList": "Downloadable media",
        "panel.connectionError": "NDM Plus cannot connect to Neat Download Manager.\n\n1. Check that Neat Download Manager is running.\n2. Hold Delete and click the download link.\n3. Temporarily disable NDM Plus."
    });

    registerLocale("zh-CN", {
        "language.name": "简体中文",
        "action.on": "NDM Plus：自动接管已开启",
        "action.paused": "NDM Plus：自动接管已暂停",
        "context.download": "下载",
        "context.pauseSite": "在此网站暂停接管",
        "context.resumeSite": "在此网站恢复接管",
        "popup.subtitle": "下载接管",
        "popup.settings": "打开设置",
        "popup.globalEyebrow": "全局",
        "popup.globalTitle": "自动接管下载",
        "popup.globalOn": "可将浏览器下载自动交给 Neat Download Manager。",
        "popup.globalOff": "已全局暂停自动接管下载和视频下载浮条。",
        "popup.currentWebsite": "当前网站",
        "popup.checking": "检查中",
        "popup.siteTitle": "在此网站接管下载",
        "popup.siteToggle": "在此网站接管下载",
        "popup.active": "已启用",
        "popup.unavailable": "不可用",
        "popup.pausedGlobally": "全局已暂停",
        "popup.pausedByRule": "网站规则已暂停",
        "popup.pausedHere": "此网站已暂停",
        "popup.siteUnsupported": "此页面不受支持",
        "popup.siteChecking": "正在检查此网站的设置。",
        "popup.siteUnavailableDescription": "请打开普通网页以修改接管设置。",
        "popup.siteAlsoPaused": "此网站同时位于暂停站点列表中。",
        "popup.siteWillResume": "开启全局接管后，此网站将恢复。",
        "popup.siteRuleDescription": "{domain} 同时会暂停其子域名。请前往暂停站点管理修改。",
        "popup.sitePausedDescription": "此网站的下载将继续由 Chrome 处理。",
        "popup.siteActiveDescription": "此网站的下载和媒体浮条已启用。",
        "popup.manageSites": "管理暂停站点",
        "options.pageTitle": "Neat Download Manager 设置",
        "options.brandEyebrow": "NDM Plus",
        "options.title": "下载接管设置",
        "options.languageTitle": "界面语言",
        "options.languageDescription": "可以跟随浏览器语言，也可以为扩展界面手动选择语言。",
        "options.languageAuto": "自动（跟随浏览器）",
        "options.autoCaptureTitle": "自动接管下载",
        "options.autoCaptureDescription": "将可下载文件交给 Neat Download Manager，并在网站上显示媒体下载浮条。",
        "options.pausedSitesTitle": "暂停站点",
        "options.pausedSitesDescription": "这些网站不会自动接管下载，也不会显示视频下载浮条。Chrome 会按正常方式处理下载。",
        "options.siteLabel": "网站域名",
        "options.sitePlaceholder": "example.com",
        "options.pauseSite": "暂停此网站",
        "options.siteHint": "域名同时覆盖其子域名，也可以直接粘贴完整网址。",
        "options.noPausedSites": "暂无暂停站点。",
        "options.resume": "恢复",
        "options.manualNote": "暂停网站不影响右键菜单中的手动“下载”操作。",
        "options.invalidSite": "请输入有效的网站域名。",
        "options.alreadyPaused": "此网站已在暂停列表中。",
        "options.githubProject": "github.com/umlearn/ndm-plus",
        "panel.label": "NDM Plus",
        "panel.showOptions": "显示视频下载选项",
        "panel.hide": "隐藏下载浮条",
        "panel.mediaList": "可下载媒体",
        "panel.connectionError": "NDM Plus 无法连接到 Neat Download Manager。\n\n1. 请确认 Neat Download Manager 正在运行。\n2. 或按住 Delete 键点击下载链接。\n3. 或临时禁用 NDM Plus。"
    });

    setLanguage("auto");
})(globalThis);
