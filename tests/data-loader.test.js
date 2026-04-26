const assert = require('assert');
const { loadMovies, normalizeMoviesPayload } = require('../data-loader');

async function run() {
    const fallbackMovies = {
        fallback: { id: 'fallback', name: 'Fallback Movie' }
    };

    const onlineMovies = {
        online: { id: 'online', name: 'Online Movie' }
    };

    assert.deepStrictEqual(normalizeMoviesPayload({ movies: onlineMovies }), onlineMovies);
    assert.deepStrictEqual(normalizeMoviesPayload(onlineMovies), onlineMovies);

    const loadedOnline = await loadMovies({
        dataUrl: 'https://example.test/movies.json',
        fallbackMovies,
        fetcher: async () => ({
            ok: true,
            json: async () => ({ movies: onlineMovies })
        })
    });
    assert.deepStrictEqual(loadedOnline, onlineMovies);

    const loadedFallback = await loadMovies({
        dataUrl: 'https://example.test/movies.json',
        fallbackMovies,
        fetcher: async () => {
            throw new Error('network down');
        }
    });
    assert.deepStrictEqual(loadedFallback, fallbackMovies);
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
