(function () {
    "use strict";

    const { STORAGE_KEYS, normalizeHostname, findPausedRule, getSiteState } = NeatCapturePolicy;
    const { STORAGE_KEY: LANGUAGE_KEY, localizeDocument, setLanguage, t } = NeatI18n;
    const globalToggle = document.getElementById("global-toggle");
    const siteToggle = document.getElementById("site-toggle");
    const globalDescription = document.getElementById("global-description");
    const siteName = document.getElementById("site-name");
    const siteDescription = document.getElementById("site-description");
    const siteStatus = document.getElementById("site-status");
    const settingsButton = document.getElementById("settings-button");
    const manageSites = document.getElementById("manage-sites");

    let globalEnabled = true;
    let pausedHosts = [];
    let currentHost = "";
    let languagePreference = "auto";

    function setSwitch(element, checked) {
        element.setAttribute("aria-checked", String(Boolean(checked)));
    }

    function render() {
        setSwitch(globalToggle, globalEnabled);
        globalDescription.textContent = globalEnabled
            ? t("popup.globalOn")
            : t("popup.globalOff");
        globalToggle.setAttribute("aria-label", t("popup.globalTitle"));
        siteToggle.setAttribute("aria-label", t("popup.siteToggle"));

        const siteState = getSiteState(globalEnabled, currentHost, pausedHosts);
        const exactPausedRule = findPausedRule(currentHost, pausedHosts);
        const pausedByParent = Boolean(exactPausedRule && normalizeHostname(exactPausedRule) !== currentHost);

        siteName.textContent = currentHost || t("popup.siteUnsupported");
        setSwitch(siteToggle, !exactPausedRule);
        siteToggle.disabled = !currentHost || pausedByParent;

        siteStatus.classList.toggle("paused", !siteState.enabled);
        if (!currentHost) {
            siteStatus.textContent = t("popup.unavailable");
            siteDescription.textContent = t("popup.siteUnavailableDescription");
        } else if (!globalEnabled) {
            siteStatus.textContent = t("popup.pausedGlobally");
            siteDescription.textContent = exactPausedRule
                ? t("popup.siteAlsoPaused")
                : t("popup.siteWillResume");
        } else if (pausedByParent) {
            siteStatus.textContent = t("popup.pausedByRule");
            siteDescription.textContent = t("popup.siteRuleDescription", { domain: exactPausedRule });
        } else if (exactPausedRule) {
            siteStatus.textContent = t("popup.pausedHere");
            siteDescription.textContent = t("popup.sitePausedDescription");
        } else {
            siteStatus.textContent = t("popup.active");
            siteDescription.textContent = t("popup.siteActiveDescription");
        }
    }

    function applyLanguage() {
        setLanguage(languagePreference);
        languagePreference = NeatI18n.getPreference();
        localizeDocument(document);
        render();
    }

    function save(changes) {
        chrome.storage.local.set(changes);
    }

    function openOptions() {
        chrome.runtime.openOptionsPage();
        window.close();
    }

    globalToggle.addEventListener("click", function () {
        globalEnabled = !globalEnabled;
        render();
        save({ [STORAGE_KEYS.globalEnabled]: globalEnabled });
    });

    siteToggle.addEventListener("click", function () {
        if (!currentHost || siteToggle.disabled) return;
        const index = pausedHosts.findIndex(host => normalizeHostname(host) === currentHost);
        if (index === -1) pausedHosts.push(currentHost);
        else pausedHosts.splice(index, 1);
        render();
        save({ [STORAGE_KEYS.pausedHosts]: pausedHosts.slice() });
    });

    settingsButton.addEventListener("click", openOptions);
    manageSites.addEventListener("click", openOptions);

    chrome.storage.onChanged.addListener(function (changes, namespace) {
        if (namespace !== "local") return;
        if (changes[STORAGE_KEYS.globalEnabled]) {
            globalEnabled = changes[STORAGE_KEYS.globalEnabled].newValue !== false;
        }
        if (changes[STORAGE_KEYS.pausedHosts]) {
            pausedHosts = Array.isArray(changes[STORAGE_KEYS.pausedHosts].newValue)
                ? changes[STORAGE_KEYS.pausedHosts].newValue
                : [];
        }
        if (changes[LANGUAGE_KEY]) {
            languagePreference = changes[LANGUAGE_KEY].newValue || "auto";
            applyLanguage();
        } else {
            render();
        }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs && tabs[0];
        currentHost = normalizeHostname(tab && tab.url);
        chrome.storage.local.get([STORAGE_KEYS.globalEnabled, STORAGE_KEYS.pausedHosts, LANGUAGE_KEY], function (result) {
            globalEnabled = result[STORAGE_KEYS.globalEnabled] !== false;
            pausedHosts = Array.isArray(result[STORAGE_KEYS.pausedHosts])
                ? result[STORAGE_KEYS.pausedHosts]
                : [];
            languagePreference = result[LANGUAGE_KEY] || "auto";
            applyLanguage();
        });
    });

    applyLanguage();
})();
