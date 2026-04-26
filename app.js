document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');
    const episodeSlug = urlParams.get('tap') || "1";
    let currentServerName = urlParams.get('sv');

    const movie = movies[movieId];
    const videoElement = document.getElementById('video-player');
    const episodeListContainer = document.getElementById('episode-list');
    const serverListContainer = document.getElementById('server-list');

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
    }

    // Hiển thị thông tin phim
    document.getElementById('movie-title').innerText = `${movie.name} - Tập ${episodeSlug}`;
    document.getElementById('movie-desc').innerText = movie.description;
    document.title = `Xem phim ${movie.name} - Tập ${episodeSlug} - DÂU CINEMA 🍓`;

    // Render danh sách tập
    movie.episodes.forEach(ep => {
        const btn = document.createElement('a');
        btn.href = `watch.html?id=${movieId}&tap=${ep.slug}${currentServerName ? '&sv=' + currentServerName : ''}`;
        btn.innerText = ep.name;
        btn.className = 'ep-btn';
        if (ep.slug === episodeSlug) btn.classList.add('active');
        episodeListContainer.appendChild(btn);
    });

    function initPlayer(m3u8Url) {
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(m3u8Url);
            hls.attachMedia(videoElement);
            hls.on(Hls.Events.MANIFEST_PARSED, () => videoElement.play());
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            videoElement.src = m3u8Url;
            videoElement.addEventListener('loadedmetadata', () => videoElement.play());
        }
    }
});