// Shared by popup, content scripts and background contexts (no DOM dependencies).
export const platform = (() => {
    const usesBrowserNamespace = typeof browser !== 'undefined';
    const api = usesBrowserNamespace ? browser : chrome;

    async function download(options) {
        if (!api.downloads?.download) {
            return { downloadId: null, errorMessage: '다운로드 API를 지원하지 않는 브라우저입니다.' };
        }
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

    async function openVideoPopup(options) {
    }

    // function onBeforeRequest(listener, filter) {
    //     if (api.webRequest?.onBeforeRequest) {
    //         api.webRequest.onBeforeRequest.addListener(listener, filter);
    //     } else {
    //         onBeforeRequestUnsupported(listener, filter);
    //     }
    // }

    // function onBeforeRequestUnsupported(listener, filter) {
    //     // TODO: Implement request capture where webRequest is unavailable.
    // }

    // const sessionStorage = api.storage?.session ?? {
    //     // TODO: Implement session storage where storage.session is unavailable.
    //     async get() { return {}; },
    //     async set() {},
    //     async remove() {}
    // };

    // return { api, sendMessage, download, updateDynamicRules, onBeforeRequest, sessionStorage };
    return { api, download };
})();
