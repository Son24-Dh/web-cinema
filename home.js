document.addEventListener('DOMContentLoaded', async () => {
    const movies = await window.DauPhimData.loadConfiguredMovies();
    const allMovies = Object.values(movies);
    const heroMovies = allMovies.slice(0, 6);
    const movieGrid = document.getElementById('movie-grid');
    const featuredRow = document.getElementById('featured-row');
    const heroBackdrop = document.getElementById('hero-backdrop');
    const heroTitle = document.getElementById('hero-title');
    const heroKicker = document.getElementById('hero-kicker');
    const heroTags = document.getElementById('hero-tags');
    const heroDesc = document.getElementById('hero-desc');
    const heroPlay = document.getElementById('hero-play');
    const heroThumbs = document.getElementById('hero-thumbs');
    const searchInput = document.getElementById('search-input');
    const favoriteButton = document.getElementById('favorite-button');

    let currentFilter = 'all';
    let searchTerm = '';
    let activeHeroId = heroMovies[0]?.id;

    function episodeLabel(movie) {
        const firstEpisode = movie.episodes?.[0];
        return firstEpisode?.name === 'Full' ? 'Full' : `PĐ. ${movie.episodes?.length || 1}`;
    }

    function movieUrl(movie) {
        const firstSlug = movie.episodes?.[0]?.slug || '1';
        return `watch.html?id=${movie.id}&tap=${firstSlug}`;
    }

    function createMovieCard(movie, index, compact = false) {
        const card = document.createElement('a');
        card.className = compact ? 'poster-card compact' : 'poster-card';
        card.href = movieUrl(movie);
        card.style.animationDelay = `${Math.min(index, 8) * 70}ms`;

        const badge = document.createElement('span');
        badge.className = 'poster-badge';
        badge.textContent = episodeLabel(movie);

        const image = document.createElement('img');
        image.src = movie.poster;
        image.alt = movie.name;
        image.loading = 'lazy';

        const body = document.createElement('span');
        body.className = 'poster-info';

        const title = document.createElement('strong');
        title.textContent = movie.name;

        const meta = document.createElement('small');
        meta.textContent = `${movie.year} • ${movie.category === 'phim-bo' ? 'Phim Bộ' : 'Phim Lẻ'}`;

        body.append(title, meta);
        card.append(badge, image, body);
        return card;
    }

    function renderMovieGrid() {
        const filteredMovies = allMovies.filter((movie) => {
            const matchesFilter = currentFilter === 'all' || movie.category === currentFilter;
            const matchesSearch = movie.name.toLowerCase().includes(searchTerm);
            return matchesFilter && matchesSearch;
        });

        movieGrid.innerHTML = '';
        filteredMovies.forEach((movie, index) => {
            movieGrid.appendChild(createMovieCard(movie, index));
        });
    }

    function renderFeaturedRow() {
        featuredRow.innerHTML = '';
        allMovies.forEach((movie, index) => {
            featuredRow.appendChild(createMovieCard(movie, index, true));
        });
    }

    function setHero(movie) {
        activeHeroId = movie.id;
        heroBackdrop.style.backgroundImage = `url("${movie.poster}")`;
        heroTitle.textContent = movie.name;
        heroKicker.textContent = movie.id === 'loi-hoi-dap-1988' ? 'Bộ phim Phương Nhi sẽ thích' : 'Tonight with Nhi';
        heroDesc.textContent = movie.description || 'Nội dung đang được cập nhật...';
        heroPlay.href = movieUrl(movie);
        heroTags.innerHTML = '';

        ['HD', 'Vietsub', movie.episodes?.[0]?.name === 'Full' ? 'Full' : `${movie.episodes.length} Tập`, movie.category === 'phim-bo' ? 'Phim Bộ' : 'Phim Lẻ'].forEach((tag) => {
            const item = document.createElement('span');
            item.textContent = tag;
            heroTags.appendChild(item);
        });

        document.querySelectorAll('.hero-thumb').forEach((button) => {
            button.classList.toggle('active', button.dataset.movieId === activeHeroId);
        });
    }

    function renderHeroThumbs() {
        heroThumbs.innerHTML = '';
        heroMovies.forEach((movie) => {
            const button = document.createElement('button');
            button.className = 'hero-thumb';
            button.type = 'button';
            button.dataset.movieId = movie.id;
            button.setAttribute('aria-label', `Chọn ${movie.name}`);

            const image = document.createElement('img');
            image.src = movie.poster;
            image.alt = '';
            image.loading = 'lazy';

            button.appendChild(image);
            button.addEventListener('click', () => setHero(movie));
            heroThumbs.appendChild(button);
        });
    }

    document.querySelectorAll('.filter-btn').forEach((button) => {
        button.addEventListener('click', () => {
            currentFilter = button.dataset.filter;
            document.querySelectorAll('.filter-btn').forEach((item) => {
                item.classList.toggle('active', item === button);
            });
            renderMovieGrid();
        });
    });

    document.querySelectorAll('[data-filter-link]').forEach((link) => {
        link.addEventListener('click', () => {
            const targetFilter = link.dataset.filterLink;
            document.querySelector(`.filter-btn[data-filter="${targetFilter}"]`)?.click();
        });
    });

    document.querySelectorAll('[data-topic]').forEach((topic) => {
        topic.addEventListener('click', () => {
            const targetFilter = topic.dataset.topic === 'series' ? 'phim-bo' : topic.dataset.topic === 'full' ? 'phim-le' : 'all';
            document.querySelector(`.filter-btn[data-filter="${targetFilter}"]`)?.click();
        });
    });

    searchInput.addEventListener('input', (event) => {
        searchTerm = event.target.value.trim().toLowerCase();
        renderMovieGrid();
    });

    favoriteButton.addEventListener('click', () => {
        favoriteButton.classList.toggle('active');
    });

    renderHeroThumbs();
    renderFeaturedRow();
    renderMovieGrid();
    if (heroMovies[0]) setHero(heroMovies[0]);
});
