/*
import { platform } from './platform.js';

// background.js에서 이 모듈을 import하면 캡처와 캐시 정리를 등록한다.
// === Captured MP4 URL cache (tabId → URL) ===
// MV3 service worker가 종료되어도 캐시가 유지되도록 storage.session에도 보관한다.
const capturedMp4Urls = new Map();
const CAPTURED_MP4_KEY_PREFIX = 'capturedMp4:';

const PLAYER_ASSET_PATTERN = /\/uniplayer\/(?:intro|preloader)\.mp4(?:[?#]|$)/i;
const MP4_PATTERN = /\.mp4(?:[?#]|$)/i;
const MAIN_VIDEO_PATTERN = /\/media_files\/.+\.mp4(?:[?#]|$)/i;

function capturedMp4Key(tabId) {
    return `${CAPTURED_MP4_KEY_PREFIX}${tabId}`;
}

function isDownloadableMp4(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:'
            && MP4_PATTERN.test(parsed.href)
            && !PLAYER_ASSET_PATTERN.test(parsed.href);
    } catch {
        return false;
    }
}

function isCapturableMainVideo(url) {
    return isDownloadableMp4(url) && MAIN_VIDEO_PATTERN.test(url);
}

function storeCapturedMp4(tabId, url) {
    capturedMp4Urls.set(tabId, url);
    platform.sessionStorage.set({ [capturedMp4Key(tabId)]: url });
}

export async function getCapturedMp4(tabId) {
    const memoryValue = capturedMp4Urls.get(tabId);
    if (memoryValue && isDownloadableMp4(memoryValue)) return memoryValue;
    if (memoryValue) capturedMp4Urls.delete(tabId);

    const key = capturedMp4Key(tabId);
    const stored = await platform.sessionStorage.get(key);
    const url = stored[key] ?? null;
    if (url && isDownloadableMp4(url)) {
        capturedMp4Urls.set(tabId, url);
        return url;
    }
    if (url) await platform.sessionStorage.remove(key);
    return null;
}

function clearCapturedMp4(tabId) {
    capturedMp4Urls.delete(tabId);
    platform.sessionStorage.remove(capturedMp4Key(tabId));
}

platform.onBeforeRequest(
    (details) => {
        const { tabId, url } = details;
        if (tabId < 0) return;
        if (!isCapturableMainVideo(url)) return;
        // Range request는 무시하되, 같은 탭이 다른 강의로 이동하면 새 URL로 교체한다.
        if (capturedMp4Urls.get(tabId) === url) return;
        storeCapturedMp4(tabId, url);
    },
    { urls: ['*://*.commonscdn.com/*'] }
);

// canvas 페이지가 새 main_frame 로드되면 그 탭 캐시 클리어
platform.onBeforeRequest(
    (details) => {
        if (details.tabId >= 0) clearCapturedMp4(details.tabId);
    },
    { urls: ['*://canvas.ssu.ac.kr/*'], types: ['main_frame'] }
);

platform.api.tabs.onRemoved.addListener((tabId) => {
    clearCapturedMp4(tabId);
});

// Canvas가 SPA 방식으로 다른 강의로 이동해도 이전 영상 URL을 사용하지 않는다.
platform.api.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url?.startsWith('https://canvas.ssu.ac.kr/')) {
        clearCapturedMp4(tabId);
    }
});

*/