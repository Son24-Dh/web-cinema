document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');

    const movies = await window.DauPhimData.loadConfiguredMovies();
    const movie = movies[movieId];

    if (!movie) {
        document.body.innerHTML = "<h1 style='color:white; text-align:center; margin-top:50px;'>Không tìm thấy phim này sếp ơi! 🍓</h1>";
        return;
    }

    // Set title and content
    document.title = `${movie.name} - Thông tin chi tiết - DâuPhim`;
    document.getElementById('detail-backdrop').style.backgroundImage = `url("${movie.poster}")`;
    const posterImg = document.getElementById('detail-poster');
    posterImg.src = movie.poster;
    posterImg.alt = movie.name;

    document.getElementById('detail-title').innerText = movie.name;
    document.getElementById('detail-desc').innerText = movie.description || 'Nội dung đang được cập nhật...';

    // Renders meta row
    const metaRow = document.getElementById('detail-meta');
    metaRow.innerHTML = '';

    const isSeries = movie.category === 'phim-bo';
    const epCountText = movie.episodes?.[0]?.name === 'Full' ? 'Full' : `${movie.episodes?.length || 1} Tập`;
    const categoryText = isSeries ? 'Phim Bộ' : 'Phim Lẻ';

    const tags = ['HD', movie.year, epCountText, categoryText];
    tags.forEach(tag => {
        const span = document.createElement('span');
        span.textContent = tag;
        metaRow.appendChild(span);
    });

    // Detect last watched progress or default to first episode
    let targetEpisode = movie.episodes?.[0];
    let isResume = false;
    let maxUpdatedAt = 0;

    if (movie.episodes && movie.episodes.length > 0) {
        movie.episodes.forEach(ep => {
            const progressKey = `dauphim-progress:${movie.id}:${ep.slug}`;
            try {
                const saved = localStorage.getItem(progressKey);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed && parsed.updatedAt > maxUpdatedAt) {
                        maxUpdatedAt = parsed.updatedAt;
                        targetEpisode = ep;
                        isResume = true;
                    }
                }
            } catch (e) {}
        });
    }

    const playBtnText = document.getElementById('play-btn-text');
    const playBtn = document.getElementById('detail-play-btn');

    if (isResume && targetEpisode) {
        playBtnText.innerText = `Tiếp tục xem tập ${targetEpisode.name}`;
        playBtn.href = `watch.html?id=${movie.id}&tap=${targetEpisode.slug}`;
    } else if (targetEpisode) {
        playBtnText.innerText = 'Xem Ngay';
        playBtn.href = `watch.html?id=${movie.id}&tap=${targetEpisode.slug}`;
    } else {
        playBtn.style.display = 'none';
    }

    // Render Episodes Grid
    const episodeGrid = document.getElementById('episode-grid');
    episodeGrid.innerHTML = '';

    if (movie.episodes && movie.episodes.length > 0) {
        movie.episodes.forEach(ep => {
            const a = document.createElement('a');
            a.href = `watch.html?id=${movie.id}&tap=${ep.slug}`;
            a.innerText = ep.name;
            a.className = 'ep-btn';
            a.addEventListener('click', () => {
                cancelAutoplay();
            });
            episodeGrid.appendChild(a);
        });
    } else {
        episodeGrid.innerHTML = '<p style="color: var(--muted); font-weight:700;">Danh sách tập đang được cập nhật...</p>';
    }

    // Autoplay redirection countdown logic
    let countdownSecs = 5.0;
    const countdownIntervalMs = 100;
    let autoplayTimer = null;
    const autoplayContainer = document.getElementById('autoplay-container');
    const autoplayLabel = document.getElementById('autoplay-label');
    const autoplayProgress = document.getElementById('autoplay-progress');
    const autoplayCancelBtn = document.getElementById('autoplay-cancel');

    function startAutoplayCountdown() {
        if (!targetEpisode) {
            autoplayContainer.style.display = 'none';
            return;
        }

        const labelPrefix = isResume ? `Tiếp tục xem tập ${targetEpisode.name}` : `Tự động phát tập ${targetEpisode.name}`;
        
        autoplayTimer = setInterval(() => {
            countdownSecs -= countdownIntervalMs / 1000;
            if (countdownSecs <= 0) {
                clearInterval(autoplayTimer);
                autoplayTimer = null;
                window.location.href = playBtn.href;
            } else {
                autoplayLabel.innerText = `${labelPrefix} sau ${Math.ceil(countdownSecs)} giây...`;
                const percent = (countdownSecs / 5.0) * 100;
                autoplayProgress.style.width = `${percent}%`;
            }
        }, countdownIntervalMs);
    }

    function cancelAutoplay() {
        if (autoplayTimer) {
            clearInterval(autoplayTimer);
            autoplayTimer = null;
            // Hide autoplay banner with styling animation or display none
            autoplayContainer.style.opacity = '0';
            setTimeout(() => {
                autoplayContainer.style.display = 'none';
            }, 200);
        }
    }

    if (autoplayCancelBtn) {
        autoplayCancelBtn.addEventListener('click', () => {
            cancelAutoplay();
        });
    }

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            cancelAutoplay();
        });
    }

    // Start countdown
    startAutoplayCountdown();

    // Link search to index page search logic or local filtering
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                const query = event.target.value.trim();
                window.location.href = `home.html?search=${encodeURIComponent(query)}`;
            }
        });
    }
});
