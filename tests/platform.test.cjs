const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/platform.js'), 'utf8');

async function load(namespace, api) {
    const context = vm.createContext({ [namespace]: api });
    const module = new vm.SourceTextModule(source, { context });
    await module.link(() => { throw new Error('Unexpected import'); });
    await module.evaluate();
    assert.equal(context.platform, undefined);
    return { context, module, platform: module.namespace.platform };
}

async function loadBackground(context, platformModule) {
    const module = new vm.SourceTextModule(
        fs.readFileSync(path.join(__dirname, '../src/background.js'), 'utf8'), { context });
    await module.link(specifier => {
        assert.equal(specifier, './platform.js');
        return platformModule;
    });
    await module.evaluate();
}

test('Chrome callbacks preserve download result, options and runtime errors', async () => {
    const options = { url: 'https://example.test/video.mp4', saveAs: true };
    const api = { runtime: {}, downloads: { download(input, callback) {
        assert.equal(input, options);
        callback(12);
    } } };
    const { platform } = await load('chrome', api);
    assert.equal((await platform.download(options)).downloadId, 12);
    api.downloads.download = (_, callback) => {
        api.runtime.lastError = { message: 'cancelled' };
        callback();
        delete api.runtime.lastError;
    };
    const result = await platform.download(options);
    assert.equal(result.downloadId, null);
    assert.equal(result.errorMessage, 'cancelled');
});

test('browser namespace uses Promise download and messaging APIs', async () => {
    const api = { runtime: { sendMessage: async message => message },
        downloads: { download: async () => 24 } };
    const { platform } = await load('browser', api);
    assert.equal(platform.api, api);
    assert.equal((await platform.download({})).downloadId, 24);
    assert.equal((await platform.sendMessage({ type: 'fixture' })).type, 'fixture');
    api.downloads.download = async () => { throw new Error('denied'); };
    assert.equal((await platform.download({})).errorMessage, 'denied');
});

test('Chrome callback messaging is converted to a Promise', async () => {
    const api = { runtime: { sendMessage: (message, callback) => callback(message) } };
    const { platform } = await load('chrome', api);
    assert.equal((await platform.sendMessage({ type: 'fixture' })).type, 'fixture');
    api.runtime.sendMessage = (_, callback) => {
        api.runtime.lastError = { message: 'no receiver' };
        callback();
    };
    await assert.rejects(platform.sendMessage({}), /no receiver/);
});

test('supported rule, request and storage APIs are passed through unchanged', async () => {
    let rules, listener, filter;
    const storage = { get: async () => ({ fixture: 'url' }) };
    const api = { storage: { session: storage },
        declarativeNetRequest: { updateDynamicRules: async value => { rules = value; } },
        webRequest: { onBeforeRequest: { addListener: (fn, value) => { listener = fn; filter = value; } } } };
    const { platform } = await load('chrome', api);
    const expectedRules = { removeRuleIds: [1] }, expectedFilter = { urls: ['https://example.test/*'] };
    const fn = () => {};
    await platform.updateDynamicRules(expectedRules);
    platform.onBeforeRequest(fn, expectedFilter);
    assert.equal(rules, expectedRules);
    assert.equal(listener, fn);
    assert.equal(filter, expectedFilter);
    assert.equal(platform.sessionStorage, storage);
});

test('missing APIs use explicit placeholders and background still registers listeners', async () => {
    const callbacks = [];
    const event = { addListener: callback => callbacks.push(callback) };
    const api = { runtime: { onInstalled: event, onStartup: event, onMessage: event },
        tabs: { onRemoved: event, onUpdated: event } };
    const { context, module, platform } = await load('browser', api);
    const result = await platform.download({});
    assert.equal(result.downloadId, null);
    assert.match(result.errorMessage, /아직 구현되지/);
    await platform.updateDynamicRules({});
    platform.onBeforeRequest(() => {}, {});
    await platform.sessionStorage.set({ key: 'url' });
    assert.equal((await platform.sessionStorage.get('key')).key, undefined);
    await platform.sessionStorage.remove('key');
    await loadBackground(context, module);
    assert.equal(callbacks.length, 3);
    await callbacks[0]();
});

test('Chrome worker imports platform and preserves download message response', async () => {
    const event = { addListener() {} };
    let receive, options;
    const api = {
        runtime: { onInstalled: event, onStartup: event,
            onMessage: { addListener: fn => { receive = fn; } } },
        tabs: { onRemoved: event, onUpdated: event },
        webRequest: { onBeforeRequest: event },
        storage: { session: {} },
        downloads: { download: (value, callback) => { options = value; callback(42); } }
    };
    const { context, module } = await load('chrome', api);
    context.URL = URL;
    await loadBackground(context, module);
    let response;
    const keepAlive = receive({ target: 'background', type: 'download-video', data: {
        videoUrl: 'https://example.test/main.mp4', filename: 'a/b.mp4'
    } }, {}, result => { response = result; });
    assert.equal(keepAlive, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(response.downloadId, 42);
    assert.equal(options.filename, 'a_b.mp4');
    assert.equal(options.saveAs, true);
    assert.equal(options.conflictAction, 'uniquify');
});

test('optional capture module registers on import and stores, restores and clears URLs', async () => {
    const requests = [];
    const stored = {};
    let removed, updated;
    const api = {
        runtime: {},
        webRequest: { onBeforeRequest: { addListener: (listener, filter) => requests.push({ listener, filter }) } },
        tabs: {
            onRemoved: { addListener: listener => { removed = listener; } },
            onUpdated: { addListener: listener => { updated = listener; } }
        },
        storage: { session: {
            async get(key) { return { [key]: stored[key] }; },
            async set(values) { Object.assign(stored, values); },
            async remove(key) { delete stored[key]; }
        } }
    };
    const { context, module: platformModule } = await load('chrome', api);
    context.URL = URL;
    const capture = new vm.SourceTextModule(
        fs.readFileSync(path.join(__dirname, '../src/video-url-capture.js'), 'utf8'), { context });
    await capture.link(specifier => {
        assert.equal(specifier, './platform.js');
        return platformModule;
    });
    await capture.evaluate();
    assert.equal(requests.length, 2);
    const url = 'https://cdn.commonscdn.com/media_files/main.mp4';
    requests[0].listener({ tabId: 1, url });
    assert.equal(stored['capturedMp4:1'], url);
    assert.equal(await capture.namespace.getCapturedMp4(1), url);
    stored['capturedMp4:2'] = url;
    assert.equal(await capture.namespace.getCapturedMp4(2), url);
    requests[0].listener({ tabId: 3, url: 'https://cdn.commonscdn.com/uniplayer/intro.mp4' });
    assert.equal(await capture.namespace.getCapturedMp4(3), null);
    updated(1, { url: 'https://canvas.ssu.ac.kr/courses/2' });
    assert.equal(await capture.namespace.getCapturedMp4(1), null);
    removed(2);
    assert.equal(await capture.namespace.getCapturedMp4(2), null);
    requests[0].listener({ tabId: 4, url });
    requests[1].listener({ tabId: 4 });
    assert.equal(await capture.namespace.getCapturedMp4(4), null);
});
