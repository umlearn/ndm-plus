(function () {
    "use strict";

    const { STORAGE_KEYS, normalizeHostname } = NeatCapturePolicy;
    const { STORAGE_KEY: LANGUAGE_KEY, localizeDocument, setLanguage, supportedLanguages, t } = NeatI18n;
    const globalToggle = document.getElementById("global-toggle");
    const languageSelect = document.getElementById("language-select");
    const siteCount = document.getElementById("site-count");
    const form = document.getElementById("add-site-form");
    const input = document.getElementById("new-host");
    const validation = document.getElementById("validation");
    const list = document.getElementById("blocked-list");
    const versionLabel = document.getElementById("extension-version");
    const checkUpdates = document.getElementById("check-updates");
    const updateStatus = document.getElementById("update-status");
    const updateLink = document.getElementById("update-link");
    const updateInstructions = document.getElementById("update-instructions");
    const currentVersion = chrome.runtime.getManifest().version;

    let globalEnabled = true;
    let pausedHosts = [];
    let languagePreference = "auto";
    let updateState = "idle";
    let latestRelease = null;

    function renderUpdates() {
        versionLabel.textContent = `NDM Plus v${currentVersion}`;
        checkUpdates.disabled = updateState === "checking";
        checkUpdates.textContent = t(updateState === "checking" ? "options.checkingUpdates" : "options.checkUpdates");
        const messages = {
            checking: "options.checkingUpdates", current: "options.upToDate",
            available: "options.updateAvailable", error: "options.updateFailed"
        };
        updateStatus.textContent = updateState === "idle" ? "" :
            t(messages[updateState], { version: latestRelease && latestRelease.version });
        const available = updateState === "available";
        updateLink.hidden = !available && updateState !== "error";
        updateLink.href = available ? latestRelease.url : NeatUpdates.RELEASES_URL;
        updateLink.textContent = t(available ? "options.viewUpdate" : "options.openReleases");
        updateInstructions.hidden = !available;
    }

    checkUpdates.addEventListener("click", async function () {
        if (updateState === "checking") return;
        updateState = "checking";
        latestRelease = null;
        renderUpdates();
        try {
            latestRelease = await NeatUpdates.check(currentVersion);
            updateState = latestRelease.available ? "available" : "current";
        } catch (error) {
            updateState = "error";
        }
        renderUpdates();
    });

    function setSwitch(checked) {
        globalToggle.setAttribute("aria-checked", String(Boolean(checked)));
    }

    function setValidation(message) {
        validation.textContent = message || "";
    }

    function populateLanguageSelect() {
        languageSelect.replaceChildren();
        const automatic = document.createElement("option");
        automatic.value = "auto";
        automatic.textContent = t("options.languageAuto");
        languageSelect.appendChild(automatic);
        for (const language of supportedLanguages()) {
            const option = document.createElement("option");
            option.value = language.code;
            option.textContent = language.name;
            languageSelect.appendChild(option);
        }
        languageSelect.value = languagePreference;
    }

    function render() {
        setSwitch(globalEnabled);
        globalToggle.setAttribute("aria-label", t("options.autoCaptureTitle"));
        siteCount.textContent = String(pausedHosts.length);
        list.replaceChildren();

        if (!pausedHosts.length) {
            const empty = document.createElement("li");
            empty.className = "empty-message";
            empty.textContent = t("options.noPausedSites");
            list.appendChild(empty);
            return;
        }

        for (const host of pausedHosts) {
            const item = document.createElement("li");
            const label = document.createElement("span");
            label.className = "site-host";
            label.textContent = host;

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "remove-button";
            remove.textContent = t("options.resume");
            remove.addEventListener("click", function () { removeHost(host); });

            item.append(label, remove);
            list.appendChild(item);
        }
    }

    function savePausedHosts(nextHosts) {
        pausedHosts = nextHosts;
        render();
        chrome.storage.local.set({ [STORAGE_KEYS.pausedHosts]: pausedHosts.slice() });
    }

    function addHost(event) {
        event.preventDefault();
        const host = normalizeHostname(input.value);
        if (!host) {
            setValidation(t("options.invalidSite"));
            return;
        }
        if (pausedHosts.some(item => normalizeHostname(item) === host)) {
            setValidation(t("options.alreadyPaused"));
            return;
        }
        savePausedHosts(pausedHosts.concat(host));
        input.value = "";
        setValidation("");
        input.focus();
    }

    function removeHost(host) {
        savePausedHosts(pausedHosts.filter(item => normalizeHostname(item) !== normalizeHostname(host)));
        setValidation("");
    }

    function applyLanguage() {
        setLanguage(languagePreference);
        languagePreference = NeatI18n.getPreference();
        localizeDocument(document);
        document.title = t("options.pageTitle");
        populateLanguageSelect();
        render();
        renderUpdates();
    }

    globalToggle.addEventListener("click", function () {
        globalEnabled = !globalEnabled;
        render();
        chrome.storage.local.set({ [STORAGE_KEYS.globalEnabled]: globalEnabled });
    });

    form.addEventListener("submit", addHost);
    input.addEventListener("input", function () { setValidation(""); });
    languageSelect.addEventListener("change", function () {
        languagePreference = languageSelect.value;
        chrome.storage.local.set({ [LANGUAGE_KEY]: languagePreference });
        setValidation("");
        applyLanguage();
    });

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
            setValidation("");
            applyLanguage();
        } else {
            render();
        }
    });

    chrome.storage.local.get([STORAGE_KEYS.globalEnabled, STORAGE_KEYS.pausedHosts, LANGUAGE_KEY], function (result) {
        globalEnabled = result[STORAGE_KEYS.globalEnabled] !== false;
        pausedHosts = Array.isArray(result[STORAGE_KEYS.pausedHosts])
            ? result[STORAGE_KEYS.pausedHosts]
            : [];
        languagePreference = result[LANGUAGE_KEY] || "auto";
        applyLanguage();
    });

    applyLanguage();
})();
