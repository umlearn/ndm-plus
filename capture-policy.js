(function (root) {
    "use strict";

    const STORAGE_KEYS = Object.freeze({
        globalEnabled: "autoCaptureEnabled",
        pausedHosts: "blockedHosts"
    });

    function normalizeHostname(value) {
        let input = String(value || "").trim().toLowerCase();
        if (!input) return "";
        if (input.startsWith("*.")) input = input.slice(2);
        try {
            const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`);
            if (url.protocol !== "http:" && url.protocol !== "https:") return "";
            return url.hostname.replace(/\.$/, "");
        } catch (error) {
            return "";
        }
    }

    function hostMatches(hostname, rule) {
        const host = normalizeHostname(hostname);
        const paused = normalizeHostname(rule);
        if (!host || !paused) return false;
        return host === paused || host.endsWith(`.${paused}`);
    }

    function findPausedRule(hostname, pausedHosts) {
        if (!Array.isArray(pausedHosts)) return "";
        return pausedHosts.find(rule => hostMatches(hostname, rule)) || "";
    }

    function getSiteState(globalEnabled, hostname, pausedHosts) {
        const host = normalizeHostname(hostname);
        const pausedRule = findPausedRule(host, pausedHosts);
        const enabled = globalEnabled !== false && Boolean(host) && !pausedRule;
        return {
            enabled,
            host,
            pausedRule,
            reason: !host ? "unavailable" : globalEnabled === false ? "global" : pausedRule ? "site" : "active"
        };
    }

    function isRequestPaused(url, initiator, pausedHosts) {
        for (const value of [url, initiator]) {
            try {
                if (value && findPausedRule(new URL(value).hostname, pausedHosts)) return true;
            } catch (error) {
                // Ignore malformed request metadata and continue with the other URL.
            }
        }
        return false;
    }

    root.NeatCapturePolicy = Object.freeze({
        STORAGE_KEYS,
        normalizeHostname,
        hostMatches,
        findPausedRule,
        getSiteState,
        isRequestPaused
    });
})(globalThis);
