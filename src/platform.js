// Shared by popup, content scripts and background contexts (no DOM dependencies).
export const platform = (() => {
    const usesBrowserNamespace = typeof browser !== 'undefined';
    const api = usesBrowserNamespace ? browser : chrome;

    function sendMessage(message) {
        if (usesBrowserNamespace) return api.runtime.sendMessage(message);
        return new Promise((resolve, reject) => {
            api.runtime.sendMessage(message, response => {
                const error = api.runtime.lastError;
                if (error) reject(new Error(error.message));
                else resolve(response);
            });
        });
    }

    async function download(options) {
        if (!api.downloads?.download) return downloadUnsupported(options);
        if (usesBrowserNamespace) {
            try {
                const downloadId = await api.downloads.download(options);
                return { downloadId: downloadId ?? null, errorMessage: null };
            } catch (error) {
                return { downloadId: null, errorMessage: error.message };
            }
        }
        return new Promise(resolve => {
            api.downloads.download(options, downloadId => {
                const errorMessage = api.runtime.lastError?.message ?? null;
                resolve({ downloadId: downloadId ?? null, errorMessage });
            });
        });
    }

    function downloadUnsupported(options) {
        // TODO: Implement a download path for browsers without the downloads API.
        return { downloadId: null, errorMessage: '이 브라우저의 다운로드 기능은 아직 구현되지 않았습니다.' };
    }

    function updateDynamicRules(rules) {
        if (api.declarativeNetRequest?.updateDynamicRules) {
            return api.declarativeNetRequest.updateDynamicRules(rules);
        }
        return updateDynamicRulesUnsupported(rules);
    }

    function updateDynamicRulesUnsupported(rules) {
        // TODO: Implement Referer handling where declarativeNetRequest is unavailable.
    }

    function onBeforeRequest(listener, filter) {
        if (api.webRequest?.onBeforeRequest) {
            api.webRequest.onBeforeRequest.addListener(listener, filter);
        } else {
            onBeforeRequestUnsupported(listener, filter);
        }
    }

    function onBeforeRequestUnsupported(listener, filter) {
        // TODO: Implement request capture where webRequest is unavailable.
    }

    const sessionStorage = api.storage?.session ?? {
        // TODO: Implement session storage where storage.session is unavailable.
        async get() { return {}; },
        async set() {},
        async remove() {}
    };

    return { api, sendMessage, download, updateDynamicRules, onBeforeRequest, sessionStorage };
})();
