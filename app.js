document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');
    const episodeSlug = urlParams.get('tap') || "1";
    let currentServerName = urlParams.get('sv');

    const movies = await window.DauPhimData.loadConfiguredMovies();
    const movie = movies[movieId];
    const videoElement = document.getElementById('video-player');
    const playerSection = document.querySelector('.player-section');
    const episodeListContainer = document.getElementById('episode-list');
    const serverListContainer = document.getElementById('server-list');
    let hlsInstance = null;
    let currentPlaylistObjectUrl = null;
    let playerLoadToken = 0;
    let resumePromptShown = false;
    let lastProgressSave = 0;
    let gestureState = null;
    let gestureHudTimer = null;
    let webBrightnessPercent = 100;
    const resumeThreshold = 20;
    const completedBuffer = 30;
    const gestureActivationDistance = 10;

    videoElement.autoplay = false;
    videoElement.removeAttribute('autoplay');

    if (!movie) {
        document.body.innerHTML = "<h1 style='color:white; text-align:center; margin-top:50px;'>Không tìm thấy phim này sếp ơi! 🍓</h1>";
        return;
    }

    const currentEpisode = movie.episodes.find(ep => ep.slug === episodeSlug);

    if (currentEpisode) {
        // Render danh sách Server
        const serverNames = Object.keys(currentEpisode.servers);
        if (!currentServerName || !currentEpisode.servers[currentServerName]) {
            currentServerName = serverNames[0]; // Mặc định server đầu tiên
        }

        serverNames.forEach(svName => {
            const btn = document.createElement('button');
            btn.innerText = svName;
            btn.className = 'sv-btn';
            if (svName === currentServerName) btn.classList.add('active');
            
            btn.onclick = () => {
                // Đổi server
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('sv', svName);
                window.history.pushState({}, '', newUrl);
                
                // Cập nhật giao diện nút
                document.querySelectorAll('.sv-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Load link mới
                initPlayer(currentEpisode.servers[svName]);
            };
            serverListContainer.appendChild(btn);
        });

        // Khởi tạo Player
        initPlayer(currentEpisode.servers[currentServerName]);
        renderAndroidPipButton();
        renderWebPipButton();
    }

    // Hiển thị thông tin phim
    document.getElementById('movie-title').innerText = `${movie.name} - Tập ${episodeSlug}`;
    document.getElementById('movie-desc').innerText = movie.description;
    document.title = `Xem phim ${movie.name} - Tập ${episodeSlug} - DâuPhim`;

    // Render danh sách tập
    movie.episodes.forEach(ep => {
        const btn = document.createElement('a');
        btn.href = `watch.html?id=${movieId}&tap=${ep.slug}${currentServerName ? '&sv=' + currentServerName : ''}`;
        btn.innerText = ep.name;
        btn.className = 'ep-btn';
        if (ep.slug === episodeSlug) btn.classList.add('active');
        episodeListContainer.appendChild(btn);
    });

    async function initPlayer(m3u8Url) {
        const loadToken = ++playerLoadToken;

        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }

        if (currentPlaylistObjectUrl) {
            URL.revokeObjectURL(currentPlaylistObjectUrl);
            currentPlaylistObjectUrl = null;
        }

        resumePromptShown = false;
        videoElement.removeAttribute('src');
        videoElement.load();

        const playableUrl = await preparePlayableUrl(m3u8Url);
        if (loadToken !== playerLoadToken) {
            if (playableUrl !== m3u8Url) URL.revokeObjectURL(playableUrl);
            return;
        }
        if (playableUrl !== m3u8Url) {
            currentPlaylistObjectUrl = playableUrl;
        }

        if (Hls.isSupported()) {
            hlsInstance = new Hls();
            hlsInstance.loadSource(playableUrl);
            hlsInstance.attachMedia(videoElement);
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => handlePlayerReady());
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            videoElement.src = playableUrl;
            videoElement.addEventListener('loadedmetadata', handlePlayerReady, { once: true });
        }
    }

    async function preparePlayableUrl(m3u8Url) {
        if (!m3u8Url.includes('.m3u8')) {
            return m3u8Url;
        }

        try {
            const masterPlaylist = await fetchPlaylistText(m3u8Url);
            const mediaPlaylistUrl = getFirstVariantUrl(masterPlaylist, m3u8Url) || m3u8Url;
            const mediaPlaylist = mediaPlaylistUrl === m3u8Url
                ? masterPlaylist
                : await fetchPlaylistText(mediaPlaylistUrl);

            const cleanPlaylist = cleanAdSegments(mediaPlaylist, mediaPlaylistUrl);
            
            if (cleanPlaylist.length === mediaPlaylist.length) {
                return m3u8Url;
            }

            return URL.createObjectURL(new Blob([cleanPlaylist], {
                type: 'application/vnd.apple.mpegurl'
            }));
        } catch (error) {
            console.warn('Using original playlist because ad cleanup failed.', error);
            return m3u8Url;
        }
    }

    async function fetchPlaylistText(url) {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Cannot load playlist: ${response.status}`);
        }
        return response.text();
    }

    function getFirstVariantUrl(playlist, baseUrl) {
        const lines = playlist.split(/\r?\n/);
        for (let index = 0; index < lines.length; index += 1) {
            if (lines[index].startsWith('#EXT-X-STREAM-INF')) {
                const variantPath = lines[index + 1]?.trim();
                if (variantPath && !variantPath.startsWith('#')) {
                    return new URL(variantPath, baseUrl).href;
                }
            }
        }
        return null;
    }

    function cleanAdSegments(playlist, baseUrl) {
        const lines = playlist.split(/\r?\n/);
        const cleanLines = [];
        
        let baseHostname;
        try {
            baseHostname = new URL(baseUrl).hostname;
        } catch (e) {
            baseHostname = '';
        }

        function isAdSegment(urlStr) {
            if (!urlStr || urlStr.startsWith('#')) return false;
            if (urlStr.includes('/adjump/')) return true;
            
            try {
                const segmentUrl = new URL(urlStr, baseUrl);
                if (segmentUrl.hostname !== baseHostname && !segmentUrl.hostname.endsWith('.' + baseHostname)) {
                    return true;
                }
            } catch (e) {
            }
            return false;
        }

        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index];
            const trimmed = line.trim();
            const nextLine = lines[index + 1]?.trim() || '';

            if (trimmed === '#EXT-X-DISCONTINUITY') {
                continue;
            }

            if (trimmed.startsWith('#EXTINF')) {
                if (isAdSegment(nextLine)) {
                    index += 1;
                    continue;
                }
            }

            if (isAdSegment(trimmed)) {
                continue;
            }

            if (trimmed && !trimmed.startsWith('#')) {
                try {
                    cleanLines.push(new URL(trimmed, baseUrl).href);
                } catch (e) {
                    cleanLines.push(trimmed);
                }
                continue;
            }

            cleanLines.push(line.replace(/URI="([^"]+)"/g, (_, uri) => {
                if (isAdSegment(uri)) {
                    return 'URI=""';
                }
                try {
                    return `URI="${new URL(uri, baseUrl).href}"`;
                } catch (e) {
                    return `URI="${uri}"`;
                }
            }));
        }

        return cleanLines.join('\n');
    }

    function progressKey() {
        return `dauphim-progress:${movieId}:${episodeSlug}`;
    }

    function getSavedProgress() {
        try {
            const progress = JSON.parse(localStorage.getItem(progressKey()));
            if (!progress || !Number.isFinite(progress.time)) {
                return null;
            }
            return progress;
        } catch (error) {
            return null;
        }
    }

    function clearSavedProgress() {
        localStorage.removeItem(progressKey());
    }

    function saveProgress() {
        const currentTime = videoElement.currentTime || 0;
        const duration = videoElement.duration || 0;
        if (currentTime < 5 || !Number.isFinite(duration) || duration <= 0) {
            return;
        }

        if (duration - currentTime <= completedBuffer) {
            clearSavedProgress();
            return;
        }

        const now = Date.now();
        if (now - lastProgressSave < 5000) {
            return;
        }

        lastProgressSave = now;
        localStorage.setItem(progressKey(), JSON.stringify({
            time: Math.floor(currentTime),
            duration: Math.floor(duration),
            updatedAt: now
        }));
    }

    function formatTime(seconds) {
        const safeSeconds = Math.max(0, Math.floor(seconds || 0));
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);
        const secs = safeSeconds % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${minutes}:${String(secs).padStart(2, '0')}`;
    }

    function playVideo() {
        const playPromise = videoElement.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }
    }

    function seekAndPlay(time) {
        videoElement.currentTime = Math.max(0, time);
        playVideo();
    }

    function setupMediaSession() {
        if (!('mediaSession' in navigator)) {
            return;
        }

        navigator.mediaSession.metadata = new MediaMetadata({
            title: movie.name,
            artist: `Tập ${episodeSlug}`,
        });

        const seekStep = 10;
        navigator.mediaSession.setActionHandler('play', () => playVideo());
        navigator.mediaSession.setActionHandler('pause', () => videoElement.pause());
        navigator.mediaSession.setActionHandler('seekbackward', ({ seekOffset }) => {
            videoElement.currentTime = Math.max(0, videoElement.currentTime - (seekOffset || seekStep));
        });
        navigator.mediaSession.setActionHandler('seekforward', ({ seekOffset }) => {
            const duration = videoElement.duration || 0;
            videoElement.currentTime = Math.min(duration, videoElement.currentTime + (seekOffset || seekStep));
        });
        navigator.mediaSession.setActionHandler('seekto', ({ seekTime }) => {
            videoElement.currentTime = seekTime;
        });
    }

    function updateMediaSessionPosition() {
        if (!('mediaSession' in navigator)) {
            return;
        }

        const duration = videoElement.duration;
        if (!Number.isFinite(duration) || duration <= 0) {
            return;
        }

        try {
            navigator.mediaSession.setPositionState({
                duration,
                playbackRate: videoElement.playbackRate || 1,
                position: videoElement.currentTime || 0,
            });
        } catch (_) {}
    }

    function handlePlayerReady() {
        setupMediaSession();

        const savedProgress = getSavedProgress();
        const duration = videoElement.duration || savedProgress?.duration || 0;
        const canResume = savedProgress
            && savedProgress.time >= resumeThreshold
            && (!duration || savedProgress.time < duration - completedBuffer);

        if (canResume && !resumePromptShown) {
            showResumePrompt(savedProgress.time);
            return;
        }

        playVideo();
    }

    function showResumePrompt(savedTime) {
        resumePromptShown = true;
        const prompt = createResumePrompt(savedTime);
        playerSection.appendChild(prompt);

        prompt.querySelector('[data-resume-play]').addEventListener('click', () => {
            prompt.remove();
            seekAndPlay(savedTime);
        });

        prompt.querySelector('[data-resume-restart]').addEventListener('click', () => {
            prompt.remove();
            clearSavedProgress();
            seekAndPlay(0);
        });
    }

    function createResumePrompt(savedTime) {
        const prompt = document.createElement('div');
        prompt.className = 'resume-prompt';
        prompt.innerHTML = `
            <div class="resume-card">
                <span class="resume-kicker">Đang xem dở</span>
                <strong>Xem tiếp từ ${formatTime(savedTime)}?</strong>
                <div class="resume-actions">
                    <button type="button" class="resume-primary" data-resume-play>Xem tiếp</button>
                    <button type="button" class="resume-secondary" data-resume-restart>Xem lại từ đầu</button>
                </div>
            </div>
        `;
        return prompt;
    }

    function renderWebPipButton() {
        if (window.DauPhimAndroid || !document.pictureInPictureEnabled) {
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sv-btn pip-btn';
        button.innerText = 'Pop-up';
        button.setAttribute('aria-label', 'Mở video dạng pop-up');
        button.addEventListener('click', () => {
            videoElement.requestPictureInPicture();
        });
        serverListContainer.appendChild(button);
    }

    function renderAndroidPipButton() {
        const androidBridge = window.DauPhimAndroid;
        if (!androidBridge || !androidBridge.isPictureInPictureSupported()) {
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sv-btn pip-btn';
        button.innerText = 'Pop-up';
        button.setAttribute('aria-label', 'Mở video dạng pop-up');
        button.addEventListener('click', () => {
            androidBridge.enterPictureInPicture();
        });
        serverListContainer.appendChild(button);
    }

    function clampPercent(value) {
        return Math.max(0, Math.min(100, Math.round(value)));
    }

    function getAndroidBridge() {
        return window.DauPhimAndroid || null;
    }

    function getCurrentVolumePercent() {
        const androidBridge = getAndroidBridge();
        if (androidBridge && typeof androidBridge.getVolumePercent === 'function') {
            return clampPercent(androidBridge.getVolumePercent());
        }
        return clampPercent(videoElement.volume * 100);
    }

    function setVolumePercent(percent) {
        const safePercent = clampPercent(percent);
        const androidBridge = getAndroidBridge();
        if (androidBridge && typeof androidBridge.setVolumePercent === 'function') {
            androidBridge.setVolumePercent(safePercent);
            return safePercent;
        }

        videoElement.muted = false;
        videoElement.volume = safePercent / 100;
        return safePercent;
    }

    function getCurrentBrightnessPercent() {
        const androidBridge = getAndroidBridge();
        if (androidBridge && typeof androidBridge.getBrightnessPercent === 'function') {
            return clampPercent(androidBridge.getBrightnessPercent());
        }
        return webBrightnessPercent;
    }

    function setBrightnessPercent(percent) {
        const safePercent = Math.max(5, clampPercent(percent));
        const androidBridge = getAndroidBridge();
        if (androidBridge && typeof androidBridge.setBrightnessPercent === 'function') {
            androidBridge.setBrightnessPercent(safePercent);
            return safePercent;
        }

        webBrightnessPercent = safePercent;
        playerSection.style.setProperty('--video-brightness', `${safePercent}%`);
        return safePercent;
    }

    function createGestureHud() {
        const hud = document.createElement('div');
        hud.className = 'gesture-hud';
        hud.innerHTML = `
            <span class="gesture-hud-icon"></span>
            <strong class="gesture-hud-label"></strong>
            <span class="gesture-hud-bar"><span></span></span>
            <small class="gesture-hud-value"></small>
        `;
        playerSection.appendChild(hud);
        return hud;
    }

    function showGestureHud(type, percent) {
        const hud = playerSection.querySelector('.gesture-hud') || createGestureHud();
        hud.classList.add('visible');
        hud.dataset.type = type;
        hud.querySelector('.gesture-hud-icon').textContent = type === 'volume' ? 'Âm' : 'Sáng';
        hud.querySelector('.gesture-hud-label').textContent = type === 'volume' ? 'Âm lượng' : 'Ánh sáng';
        hud.querySelector('.gesture-hud-value').textContent = `${percent}%`;
        hud.querySelector('.gesture-hud-bar span').style.width = `${percent}%`;

        clearTimeout(gestureHudTimer);
        gestureHudTimer = setTimeout(() => {
            hud.classList.remove('visible');
        }, 850);
    }

    function startGesture(event) {
        if (!event.touches || event.touches.length !== 1 || event.target.closest('.resume-prompt')) {
            return;
        }

        const touch = event.touches[0];
        const bounds = playerSection.getBoundingClientRect();
        const type = touch.clientX - bounds.left > bounds.width / 2 ? 'volume' : 'brightness';
        gestureState = {
            type,
            startY: touch.clientY,
            height: Math.max(bounds.height, 1),
            started: false,
            initialPercent: type === 'volume' ? getCurrentVolumePercent() : getCurrentBrightnessPercent()
        };
    }

    function moveGesture(event) {
        if (!gestureState || !event.touches || event.touches.length !== 1) {
            return;
        }

        const touch = event.touches[0];
        const deltaY = gestureState.startY - touch.clientY;
        if (!gestureState.started && Math.abs(deltaY) < gestureActivationDistance) {
            return;
        }

        gestureState.started = true;
        event.preventDefault();

        const deltaPercent = (deltaY / gestureState.height) * 120;
        const targetPercent = gestureState.initialPercent + deltaPercent;
        const appliedPercent = gestureState.type === 'volume'
            ? setVolumePercent(targetPercent)
            : setBrightnessPercent(targetPercent);
        showGestureHud(gestureState.type, appliedPercent);
    }

    function endGesture() {
        gestureState = null;
    }

    playerSection.addEventListener('touchstart', startGesture, { passive: true });
    playerSection.addEventListener('touchmove', moveGesture, { passive: false });
    playerSection.addEventListener('touchend', endGesture);
    playerSection.addEventListener('touchcancel', endGesture);

    videoElement.addEventListener('timeupdate', () => { saveProgress(); updateMediaSessionPosition(); });
    videoElement.addEventListener('pause', saveProgress);
    videoElement.addEventListener('ended', clearSavedProgress);
    window.addEventListener('pagehide', saveProgress);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveProgress(); });
});
