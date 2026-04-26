(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
        return;
    }

    root.DauPhimData = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
    function normalizeMoviesPayload(payload) {
        if (!payload || typeof payload !== 'object') {
            return {};
        }

        return payload.movies && typeof payload.movies === 'object' ? payload.movies : payload;
    }

    async function loadMovies(options = {}) {
        const dataUrl = options.dataUrl;
        const fallbackMovies = options.fallbackMovies || {};
        const fetcher = options.fetcher || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);

        if (!dataUrl || !fetcher) {
            return fallbackMovies;
        }

        try {
            const response = await fetcher(dataUrl, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Movie data request failed: ${response.status}`);
            }

            const payload = await response.json();
            const onlineMovies = normalizeMoviesPayload(payload);
            return Object.keys(onlineMovies).length > 0 ? onlineMovies : fallbackMovies;
        } catch (error) {
            console.warn('Using bundled movie data fallback.', error);
            return fallbackMovies;
        }
    }

    async function loadConfiguredMovies() {
        const fallbackMovies = globalThis.DEFAULT_MOVIES || {};
        const dataUrl = globalThis.DAU_PHIM_DATA_URL || 'data.json';
        return loadMovies({ dataUrl, fallbackMovies });
    }

    return {
        loadConfiguredMovies,
        loadMovies,
        normalizeMoviesPayload
    };
});
