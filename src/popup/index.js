function getToken() {
    const token = document.cookie.split('xn_api_token=').at(1)?.split(';')?.at(0);
    if (!token) {
        // TODO: error handling
        console.warn('getToken: token not found in cookies');
        return null;
    }
    return token;
}

async function findVideoFrame(tabId) {
    const frames = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: () => ({ hostname: location.hostname, pathname: location.pathname })
    });
    const candidates = frames
        .filter(frame => frame.result?.hostname === 'commons.ssu.ac.kr')
        .sort((a, b) => Number(!a.result.pathname.startsWith('/em/'))
            - Number(!b.result.pathname.startsWith('/em/')));

    for (const frame of candidates) {
        try {
            const info = await sendMessageToVideoFrame(tabId, frame.frameId, 'get-video-info');
            if (info) return { frameId: frame.frameId, info };
        } catch (error) {
            console.debug('findVideoFrame: frame did not respond', frame.frameId, error);
        }
    }
    return null;
}

async function sendMessageToVideoFrame(tabId, frameId, type, data) {
    return await chrome.tabs.sendMessage(
        tabId,
        { target: 'video-iframe', type, data },
        { frameId }
    );
}

async function getVideoUrlFromFrame(tabId, frameId) {
    try {
        const response = await sendMessageToVideoFrame(tabId, frameId, 'get-video-url');
        return response?.videoUrl ?? null;
    } catch {
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    document.querySelector('h3').textContent = `Hack LMS v${chrome.runtime.getManifest().version}`;
    const mainContent = document.getElementById('mainContent');
    const errorContent = document.getElementById('errorContent');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || !tab.url.includes('canvas.ssu.ac.kr')) {
        mainContent.style.display = 'none';
        errorContent.style.display = 'block';
        return;
    }

    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getToken
    });
    const token = results[0].result;

    const videoFrame = await findVideoFrame(tab.id);
    if (!videoFrame) {
        mainContent.style.display = 'none';
        errorContent.style.display = 'block';
        return;
    }
    const { frameId, info } = videoFrame;
    const { title: videoTitle, targetUrl, courseId, itemId } = info;


    // 동영상 정보 표시
    document.getElementById('videoTitle').textContent = videoTitle || '제목 없음';

    // 동영상 URL 가져오기 및 표시
    // background의 webRequest listener가 캐시한 mp4 URL을 조회
    // 파일명/경로가 다양함 (screen.mp4, main_(uuid).mp4 / contents, contents31, ssu-toast vs ssuin-object 등)
    // 캐시 비어있으면 autoplay 트리거 후 일정시간 polling
    const videoUrlElement = document.getElementById('videoUrl');
    const downloadBtn = document.getElementById('downloadBtn');

    let videoUrl = await getVideoUrlFromFrame(tab.id, frameId) || await getCapturedMp4(tab.id);
    if (!videoUrl) {
        videoUrlElement.textContent = '영상 URL 캡처 중...';
        videoUrlElement.style.color = '#999';
        downloadBtn.disabled = true;
        downloadBtn.textContent = '대기 중...';
        try {
            const response = await sendMessageToVideoFrame(tab.id, frameId, 'trigger-autoplay');
            videoUrl = response?.videoUrl ?? null;
        } catch (e) { /* iframe missing — handled below */ }
        const start = Date.now();
        while (!videoUrl && Date.now() - start < 8000) {
            await new Promise(r => setTimeout(r, 300));
            videoUrl = await getVideoUrlFromFrame(tab.id, frameId) || await getCapturedMp4(tab.id);
        }
    }

    if (videoUrl) {
        videoUrlElement.textContent = videoUrl;
        downloadBtn.disabled = false;
        downloadBtn.addEventListener('click', async () => {
            const originalText = downloadBtn.textContent;
            const filename = `${videoTitle || 'video'}.mp4`;
            downloadBtn.disabled = true;
            try {
                downloadBtn.textContent = '다운로드 요청 중...';
                const response = await chrome.runtime.sendMessage({
                    target: 'background',
                    type: 'download-video',
                    data: { videoUrl, filename }
                });
                if (!response?.downloadId) {
                    throw new Error(response?.errorMessage || '다운로드를 시작하지 못했습니다.');
                }
                downloadBtn.textContent = '다운로드 시작됨';
            } catch (err) {
                alert(`다운로드 실패: ${err.message}`);
            } finally {
                downloadBtn.disabled = false;
                setTimeout(() => { downloadBtn.textContent = originalText; }, 1500);
            }
        });
        downloadBtn.textContent = '동영상 다운로드';
    } else {
        videoUrlElement.textContent = '영상 URL을 잡지 못했습니다. 페이지에서 영상을 한 번 재생한 뒤 popup을 다시 열어주세요.';
        videoUrlElement.style.cursor = 'default';
        videoUrlElement.style.color = '#999';
        videoUrlElement.style.textDecoration = 'none';
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'URL 없음';
    }

    const completeBtn = document.getElementById('completeBtn');
    if (targetUrl && courseId && itemId && token) {
        sendMessageToBackground('get-video-progress', {courseId, itemId, xn_api_token: token});

        completeBtn.addEventListener('click', () => {
            // TODO: 경고 멘트 추가
            if (document.getElementById('completionStatus').textContent.includes('학습 완료')
                && !confirm('이미 학습이 완료되었습니다. 그럼에도 실행하시겠습니까?')) return;
            sendMessageToBackground('complete-video-progress', {
                targetUrl,
                courseId,
                itemId,
                xn_api_token: token
            });
        });
    } else {
        document.getElementById('completionStatus').textContent = '진도 정보 없음';
        completeBtn.disabled = true;
        completeBtn.textContent = '학습 진도 조작 미지원';
    }

    // 배속 조절 이벤트
    const speedSlider = document.getElementById('playbackSpeed');
    const speedValue = document.getElementById('speedValue');
    const {playbackRate} = await sendMessageToVideoFrame(tab.id, frameId, 'get-video-playback-rate');
    speedSlider.value = playbackRate || 1.0;
    speedValue.textContent = playbackRate + 'x';
    speedSlider.addEventListener('input', () => {
        speedValue.textContent = speedSlider.value + 'x';
    });
    speedSlider.addEventListener('change', async (e) => {
        const newSpeed = parseFloat(e.target.value);
        const {success, errorMessage} = await sendMessageToVideoFrame(
            tab.id,
            frameId,
            'set-video-playback-rate',
            { playbackRate: newSpeed }
        );
        if (!success) {
            alert(`배속 조절 오류: ${errorMessage}`);
        }
    });
});

function formatSeconds(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const rounded = Math.floor(seconds);
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const secs = rounded % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

chrome.runtime.onMessage.addListener((message) => {
    console.log('popup received message:', message);
    if (message.target !== 'popup') return;

    switch (message.type) {
        case 'set-video-progress': {
            const percent = message.data.percent;
            const bar = document.getElementById('progressBar');
            const text = document.getElementById('percentText');
            const statusBadge = document.getElementById('completionStatus');
            bar.style.width = percent + '%';
            text.textContent = percent.toFixed(2) + '%';
            if (message.data.is_completed) {
                statusBadge.textContent = '학습 완료';
                statusBadge.style.backgroundColor = '#E8F5E9';
                statusBadge.style.color = '#2E7D32';
            } else {
                statusBadge.textContent = '미완료';
                statusBadge.style.backgroundColor = '#FFF3E0';
                statusBadge.style.color = '#EF6C00';
            }

            if (typeof message.data.duration === 'number') {
                document.getElementById('videoLength').textContent = formatSeconds(message.data.duration);
            }
            if (typeof message.data.progress === 'number') {
                document.getElementById('watchedLength').textContent = formatSeconds(message.data.progress);
            }
            break;
        }
        case 'complete-video-progress-error': {
            alert(`오류가 발생했습니다.\nmessage: ${message.data.errorMessage}, time: ${message.data.time}, delta: ${message.data.delta}`);
            break;
        }
        default:
            console.warn('popup received message with unknown type:', message);
            break;
    }
});

function sendMessageToBackground(type, data) {
    chrome.runtime.sendMessage({target: 'background', type, data});
}

function getCapturedMp4(tabId) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { target: 'background', type: 'get-captured-mp4', data: { tabId } },
            (resp) => resolve(resp?.videoUrl ?? null)
        );
    });
}
