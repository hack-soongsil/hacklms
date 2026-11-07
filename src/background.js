import { platform } from './platform.js';
// import { getCapturedMp4 } from './video-url-capture.js';

const REFERER_RULE_ID = 1;

async function setupRefererRule() {
    await platform.updateDynamicRules({
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

platform.api.runtime.onInstalled.addListener(setupRefererRule);
platform.api.runtime.onStartup.addListener(setupRefererRule);

const PLAYER_ASSET_PATTERN = /\/uniplayer\/(?:intro|preloader)\.mp4(?:[?#]|$)/i;
const MP4_PATTERN = /\.mp4(?:[?#]|$)/i;
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

function sanitizeDownloadFilename(name) {
    return (name || 'video.mp4')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 204) || 'video.mp4';
}

platform.api.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
        // case 'get-captured-mp4': {
        //     const tabId = message.data?.tabId;
        //     getCapturedMp4(tabId)
        //         .then(videoUrl => sendResponse({ videoUrl }))
        //         .catch(error => sendResponse({ videoUrl: null, errorMessage: error.message }));
        //     return true;
        // }
        case 'download-video': {
            const videoUrl = message.data?.videoUrl;
            const filename = sanitizeDownloadFilename(message.data?.filename);
            if (!isDownloadableMp4(videoUrl)) {
                sendResponse({ downloadId: null, errorMessage: '지원하지 않는 영상 URL입니다.' });
                return;
            }
            platform.download({
                url: videoUrl,
                filename,
                saveAs: true,
                conflictAction: 'uniquify'
            }).then(sendResponse);
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
    platform.api.runtime.sendMessage({target: 'popup', type, data});
}

// file
// POST https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/794190/progress/forceSubmit?user_id=37567&user_login=20222904&content_id=${content_id}&content_type=file
