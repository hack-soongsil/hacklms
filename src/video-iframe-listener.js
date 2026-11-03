function getVideoInfo() {
    // window.location.href ex) https://commons.ssu.ac.kr/em/69bd616f92eb6?startat=0.00&endat=0.00&TargetUrl=https%3A%2F%2Fcanvas.ssu.ac.kr%2Flearningx%2Fapi%2Fv1%2Fcourses%2F44036%2Fsections%2F0%2Fcomponents%2F794113%2Fprogress%3Fuser_id%3D20222904%26content_id%3D69bd616f92eb6%26content_type%3Dmovie&sl=1&pr=1&mxpr=1.00&lg=ko
    // targetUrl            ex) https://canvas.ssu.ac.kr/learningx/api/v1/courses/44036/sections/0/components/794113/progress?user_id=20222904&content_id=69bd616f92eb6&content_type=movie
    const pageUrl = new URL(window.location.href);
    const targetEntry = [...pageUrl.searchParams.entries()].find(([key]) => {
        const normalized = key.toLowerCase().replaceAll('_', '');
        return normalized === 'targeturl';
    });
    const targetUrl = targetEntry?.[1] || null;
    const parsedTargetUrl = parseUrl(targetUrl);
    const targetPath = parsedTargetUrl?.pathname || '';
    const contentId = parsedTargetUrl?.searchParams.get('content_id')
        || pageUrl.pathname.match(/\/em\/([^/?#]+)/)?.[1]
        || null;
    const courseId = targetPath.match(/\/courses\/([^/]+)/)?.[1]
        || parsedTargetUrl?.searchParams.get('course_id')
        || null;
    const itemId = targetPath.match(/\/(?:components|attendance_items)\/([^/]+)/)?.[1]
        || parsedTargetUrl?.searchParams.get('component_id')
        || parsedTargetUrl?.searchParams.get('item_id')
        || null;
    const title = document.querySelector('title')?.textContent?.trim();

    // 일부 강의는 진도 API 메타데이터가 없어도 실제 플레이어는 존재한다.
    if (!targetUrl && !getVideoElement() && !document.querySelector('#front-screen')) {
        return null;
    }

    return { title, targetUrl, contentId, courseId, itemId };
}

function parseUrl(value) {
    if (!value) return null;
    try {
        return new URL(value, window.location.href);
    } catch {
        try {
            return new URL(decodeURIComponent(value), window.location.href);
        } catch {
            return null;
        }
    }
}

const VIDEO_SELECTOR = '#video-play-video1 > div.vc-vplay-container.non-selectable > video';
const PLAYER_ASSET_PATTERN = /\/uniplayer\/(?:intro|preloader)\.mp4(?:[?#]|$)/i;
const MP4_PATTERN = /\.mp4(?:[?#]|$)/i;

function getVideoElement() {
    return document.querySelector(VIDEO_SELECTOR) || document.querySelector('video');
}

function normalizeVideoUrl(candidate) {
    const parsed = parseUrl(candidate);
    if (!parsed || parsed.protocol !== 'https:') return null;
    if (PLAYER_ASSET_PATTERN.test(parsed.href) || !MP4_PATTERN.test(parsed.href)) return null;
    return parsed.href;
}

function videoUrlScore(url) {
    let score = 0;
    if (/\/media_files\//i.test(url)) score += 100;
    if (/\.commonscdn\.com\//i.test(url)) score += 50;
    if (/\/(?:screen|main[^/]*)\.mp4(?:[?#]|$)/i.test(url)) score += 20;
    return score;
}

function getVideoUrl() {
    const video = getVideoElement();
    const sources = video?.querySelectorAll ? [...video.querySelectorAll('source')] : [];
    const sourceUrls = sources.map(source => source.src || source.getAttribute('src'));
    const resourceUrls = typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function'
        ? performance.getEntriesByType('resource').map(entry => entry.name)
        : [];
    const candidates = [
        video?.currentSrc,
        video?.src,
        video?.getAttribute('src'),
        ...sourceUrls,
        ...resourceUrls
    ];
    const matched = candidates
        .map(normalizeVideoUrl)
        .filter(Boolean)
        .map((url, index) => ({ url, index, score: videoUrlScore(url) }))
        .sort((a, b) => b.score - a.score || b.index - a.index);
    if (matched.length > 0) {
        return matched[0].url;
    }
    return null;
}

// ratechange 이벤트가 전파되지 않도록 막는 가드 함수
const guard = (e) => { e.stopImmediatePropagation(); };

// popup을 반복해 열어도 재생 클릭을 지나치게 자주 보내지 않는다.
let lastAutoPlayAttempt = 0;

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.target !== 'video-iframe') return;
    switch (message.type) {
        case "get-video-info": {
            const info = getVideoInfo();
            if (info) {
                sendResponse(info);
            }
            break;
        }
        case "get-video-url": {
            sendResponse({ videoUrl: getVideoUrl() });
            break;
        }
        case "trigger-autoplay": {
            // background webRequest listener가 mp4 패킷을 캡처하도록 재생 버튼 클릭
            const directUrl = getVideoUrl();
            if (directUrl) {
                sendResponse({ triggered: false, videoUrl: directUrl });
                break;
            }
            if (Date.now() - lastAutoPlayAttempt < 10000) {
                sendResponse({ triggered: false });
                break;
            }
            // front-screen이 숨김/부재이면 이미 재생이 시작된 상태 — click 시 인트로 재시작될 수 있어 skip
            const frontScreen = document.querySelector('#front-screen');
            if (!frontScreen || frontScreen.offsetParent === null) {
                sendResponse({ triggered: false, videoUrl: getVideoUrl() });
                break;
            }
            const playButton = document.querySelector('#front-screen > div > div.vc-front-screen-btn-container > div.vc-front-screen-btn-wrapper.video1-btn > div')
                || frontScreen.querySelector('.video1-btn [role="button"], .video1-btn, button');
            playButton?.click();
            lastAutoPlayAttempt = Date.now();
            sendResponse({ triggered: Boolean(playButton), videoUrl: getVideoUrl() });
            break;
        }
        case "get-video-playback-rate": {
            const video = getVideoElement();
            if (video) {
                sendResponse({ playbackRate: video.playbackRate });
            } else {
                sendResponse({ playbackRate: 1.0 });
            }
            break;
        }
        case "set-video-playback-rate": {
            const video = getVideoElement();
            if (video) {
                video.removeEventListener('ratechange', guard, true);
                video.addEventListener('ratechange', guard, true);
                video.playbackRate = message.data.playbackRate;
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, errorMessage: 'video element not found' });
            }
            break;
        }
        default:
            console.warn('video-iframe received message with unknown type:', message);
            break;
    }
    // TODO: error handling
});
