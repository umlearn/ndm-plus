(function (root) {
    "use strict";

    const RELEASES_URL = "https://github.com/umlearn/ndm-plus/releases/latest";
    const API_URL = "https://api.github.com/repos/umlearn/ndm-plus/releases/latest";

    function versionParts(value) {
        if (typeof value !== "string" || !/^v?\d+(?:\.\d+){0,3}$/.test(value)) {
            throw new Error("Invalid release version");
        }
        const parts = value.replace(/^v/, "").split(".").map(Number);
        if (parts.some(part => !Number.isSafeInteger(part))) throw new Error("Invalid release version");
        return parts;
    }

    function compareVersions(left, right) {
        const a = versionParts(left), b = versionParts(right);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const difference = (a[i] || 0) - (b[i] || 0);
            if (difference) return Math.sign(difference);
        }
        return 0;
    }

    async function check(currentVersion) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(API_URL, {
                signal: controller.signal,
                credentials: "omit",
                cache: "no-store",
                headers: { Accept: "application/vnd.github+json" }
            });
            if (!response.ok) throw new Error("Release request failed");
            const release = await response.json();
            if (!release || release.draft || release.prerelease) throw new Error("Invalid release");
            const comparison = compareVersions(release.tag_name, currentVersion);
            return {
                available: comparison > 0,
                version: release.tag_name.replace(/^v/, ""),
                url: "https://github.com/umlearn/ndm-plus/releases/tag/" + encodeURIComponent(release.tag_name)
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    root.NeatUpdates = Object.freeze({ RELEASES_URL, compareVersions, check });
})(globalThis);
