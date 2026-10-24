(function () {
    "use strict";

    const { STORAGE_KEYS, normalizeHostname } = NeatCapturePolicy;
    const globalToggle = document.getElementById("global-toggle");
    const siteCount = document.getElementById("site-count");
    const form = document.getElementById("add-site-form");
    const input = document.getElementById("new-host");
    const validation = document.getElementById("validation");
    const list = document.getElementById("blocked-list");

    let globalEnabled = true;
    let pausedHosts = [];

    function setSwitch(checked) {
        globalToggle.setAttribute("aria-checked", String(Boolean(checked)));
    }

    function setValidation(message) {
        validation.textContent = message || "";
    }

    function render() {
        setSwitch(globalEnabled);
        siteCount.textContent = String(pausedHosts.length);
        list.replaceChildren();

        if (!pausedHosts.length) {
            const empty = document.createElement("li");
            empty.className = "empty-message";
            empty.textContent = "No paused sites.";
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
            remove.textContent = "Resume";
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
            setValidation("Enter a valid website domain.");
            return;
        }
        if (pausedHosts.some(item => normalizeHostname(item) === host)) {
            setValidation("This site is already paused.");
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

    globalToggle.addEventListener("click", function () {
        globalEnabled = !globalEnabled;
        render();
        chrome.storage.local.set({ [STORAGE_KEYS.globalEnabled]: globalEnabled });
    });

    form.addEventListener("submit", addHost);
    input.addEventListener("input", function () { setValidation(""); });

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

    chrome.storage.local.get([STORAGE_KEYS.globalEnabled, STORAGE_KEYS.pausedHosts], function (result) {
        globalEnabled = result[STORAGE_KEYS.globalEnabled] !== false;
        pausedHosts = Array.isArray(result[STORAGE_KEYS.pausedHosts])
            ? result[STORAGE_KEYS.pausedHosts]
            : [];
        render();
    });
})();
