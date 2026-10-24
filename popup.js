(function () {
    "use strict";

    const { STORAGE_KEYS, normalizeHostname, findPausedRule, getSiteState } = NeatCapturePolicy;
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

    function setSwitch(element, checked) {
        element.setAttribute("aria-checked", String(Boolean(checked)));
    }

    function render() {
        setSwitch(globalToggle, globalEnabled);
        globalDescription.textContent = globalEnabled
            ? "Downloads can be handed to Neat Download Manager automatically."
            : "Automatic capture and video download bars are paused everywhere.";

        const siteState = getSiteState(globalEnabled, currentHost, pausedHosts);
        const exactPausedRule = findPausedRule(currentHost, pausedHosts);
        const pausedByParent = Boolean(exactPausedRule && normalizeHostname(exactPausedRule) !== currentHost);

        siteName.textContent = currentHost || "This page is not supported";
        setSwitch(siteToggle, !exactPausedRule);
        siteToggle.disabled = !currentHost || pausedByParent;

        siteStatus.classList.toggle("paused", !siteState.enabled);
        if (!currentHost) {
            siteStatus.textContent = "Unavailable";
            siteDescription.textContent = "Open a regular website to change its capture setting.";
        } else if (!globalEnabled) {
            siteStatus.textContent = "Paused globally";
            siteDescription.textContent = exactPausedRule
                ? "This site is also paused in your site list."
                : "This site will resume when global capture is enabled.";
        } else if (pausedByParent) {
            siteStatus.textContent = "Paused by site rule";
            siteDescription.textContent = `${exactPausedRule} also pauses its subdomains. Manage paused sites to change it.`;
        } else if (exactPausedRule) {
            siteStatus.textContent = "Paused here";
            siteDescription.textContent = "Downloads on this site stay in Chrome.";
        } else {
            siteStatus.textContent = "Active";
            siteDescription.textContent = "Downloads and the media panel are enabled here.";
        }
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
        render();
    });

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs && tabs[0];
        currentHost = normalizeHostname(tab && tab.url);
        chrome.storage.local.get([STORAGE_KEYS.globalEnabled, STORAGE_KEYS.pausedHosts], function (result) {
            globalEnabled = result[STORAGE_KEYS.globalEnabled] !== false;
            pausedHosts = Array.isArray(result[STORAGE_KEYS.pausedHosts])
                ? result[STORAGE_KEYS.pausedHosts]
                : [];
            render();
        });
    });

    render();
})();
