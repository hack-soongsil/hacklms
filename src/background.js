const REFERER_RULE_ID = 1;

async function setupRefererRule() {
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [REFERER_RULE_ID],
        addRules: [{
            id: REFERER_RULE_ID,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [
                    { header: 'Referer', operation: 'set', value: 'https://commons.ssu.ac.kr/' }
                ]
            },
            condition: {
                urlFilter: '||commonscdn.com/',
                resourceTypes: ['xmlhttprequest', 'media', 'other', 'main_frame', 'sub_frame']
            }
        }]
    });
}

chrome.runtime.onInstalled.addListener(setupRefererRule);
chrome.runtime.onStartup.addListener(setupRefererRule);

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
    chrome.storage.session.set({ [capturedMp4Key(tabId)]: url });
}

async function getCapturedMp4(tabId) {
    const memoryValue = capturedMp4Urls.get(tabId);
    if (memoryValue && isDownloadableMp4(memoryValue)) return memoryValue;
    if (memoryValue) capturedMp4Urls.delete(tabId);

    const key = capturedMp4Key(tabId);
    const stored = await chrome.storage.session.get(key);
    const url = stored[key] ?? null;
    if (url && isDownloadableMp4(url)) {
        capturedMp4Urls.set(tabId, url);
        return url;
    }
    if (url) await chrome.storage.session.remove(key);
    return null;
}

function clearCapturedMp4(tabId) {
    capturedMp4Urls.delete(tabId);
    chrome.storage.session.remove(capturedMp4Key(tabId));
}

function sanitizeDownloadFilename(name) {
    return (name || 'video.mp4')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 204) || 'video.mp4';
}

chrome.webRequest.onBeforeRequest.addListener(
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
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.tabId >= 0) clearCapturedMp4(details.tabId);
    },
    { urls: ['*://canvas.ssu.ac.kr/*'], types: ['main_frame'] }
);

chrome.tabs.onRemoved.addListener((tabId) => {
    clearCapturedMp4(tabId);
});

// Canvas가 SPA 방식으로 다른 강의로 이동해도 이전 영상 URL을 사용하지 않는다.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url?.startsWith('https://canvas.ssu.ac.kr/')) {
        clearCapturedMp4(tabId);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('background received message:', message);
    if (message.target !== 'background') return;

    switch (message.type) {
        case 'complete-video-progress': {
            completeVideoProgress(message.data);
            return;
        }
        case 'get-video-progress': {
            const {courseId, itemId, xn_api_token} = message.data;
            getVideoStatus(courseId, itemId, xn_api_token).then(status => {
                sendMessageToPopup('set-video-progress', {
                    percent: status.progress / status.duration * 100,
                    is_completed: status.is_completed,
                    duration: status.duration,
                    progress: status.progress,
                });
            });
            return;
        }
        case 'get-captured-mp4': {
            const tabId = message.data?.tabId;
            getCapturedMp4(tabId)
                .then(videoUrl => sendResponse({ videoUrl }))
                .catch(error => sendResponse({ videoUrl: null, errorMessage: error.message }));
            return true;
        }
        case 'download-video': {
            const videoUrl = message.data?.videoUrl;
            const filename = sanitizeDownloadFilename(message.data?.filename);
            if (!isDownloadableMp4(videoUrl)) {
                sendResponse({ downloadId: null, errorMessage: '지원하지 않는 영상 URL입니다.' });
                return;
            }
            chrome.downloads.download({
                url: videoUrl,
                filename,
                saveAs: true,
                conflictAction: 'uniquify'
            }, (downloadId) => {
                const errorMessage = chrome.runtime.lastError?.message ?? null;
                sendResponse({ downloadId: downloadId ?? null, errorMessage });
            });
            return true;
        }
        default:
            console.warn('background received message with unknown type:', message);
            return;
    }
});

async function getVideoStatus(courseId, itemId, token) {
    const res = await fetch(`https://canvas.ssu.ac.kr/learningx/api/v1/courses/${courseId}/attendance_items/${itemId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!res.ok) {
        console.warn('check: response failed', res);
        // TODO: error handling
        return null;
    }
    const json = await res.json();
    const duration = json.item_content_data?.duration ?? 1; // 1 이상의 값이어야 함
    const progress = json.attendance_data?.progress ?? 0;
    const is_completed = json.attendance_data?.completed ?? false;
    return { duration, progress, is_completed };
}

async function completeVideoProgress(data) {
    const {targetUrl, courseId, itemId, xn_api_token} = data;
    console.assert(targetUrl && courseId && itemId && xn_api_token, 'these params shoud be exist');

    const {duration, progress} = await getVideoStatus(courseId, itemId, xn_api_token);
    let time = progress;
    let delta = 60;
    do {
        time += delta;
        if (time > duration) time = duration;
        
        const res = await fetch(`${targetUrl}&callback=aaa&state=8&duration=${duration}&currentTime=${time}&cumulativeTime=${time}`); // todo: duration 정하기
        if (!res.ok) {
            sendMessageToPopup('complete-video-progress-error', {errorMessage: 'response failed', time, delta});
            break;
        }
        const text = await res.text();
        const json = JSON.parse(text.replace('aaa(', '').replace(')', ''));
        if (json.error_code) {
            // console.warn('error:', json.error_code, {time});
            time -= delta;
            delta = 60;
        } else {
            delta += 60;
        }

        const status = await getVideoStatus(courseId, itemId, xn_api_token);
        sendMessageToPopup('set-video-progress', {
            percent: time / duration * 100,
            is_completed: status.is_completed,
            duration: status.duration,
            progress: status.progress,
        });
        console.log(`${time / duration * 100}% 완료`, {time, delta});
    } while (time < duration);
}

function sendMessageToPopup(type, data) {
    chrome.runtime.sendMessage({target: 'popup', type, data});
}

// file
// POST https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/794190/progress/forceSubmit?user_id=37567&user_login=20222904&content_id=${content_id}&content_type=file
