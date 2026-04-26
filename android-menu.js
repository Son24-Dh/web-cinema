(function () {
    const googleSearchUrl = 'https://www.google.com/search?q=';

    function getAndroidBridge() {
        return window.DauPhimAndroid && typeof window.DauPhimAndroid.openUrl === 'function'
            ? window.DauPhimAndroid
            : null;
    }

    function initAndroidMenu() {
        const bridge = getAndroidBridge();
        if (!bridge || document.querySelector('.apk-nav-link')) {
            return;
        }

        const nav = document.querySelector('.nav-links');
        if (!nav) return;

        document.body.classList.add('android-app-shell');

        const googleButton = document.createElement('button');
        googleButton.type = 'button';
        googleButton.className = 'apk-nav-link';
        googleButton.textContent = 'Google Search';
        googleButton.setAttribute('aria-label', 'Mở Google Search trong app');
        googleButton.addEventListener('click', () => {
            bridge.openUrl(googleSearchUrl);
        });

        nav.appendChild(googleButton);
    }

    window.DauPhimAndroidMenu = {
        init: initAndroidMenu
    };

    document.addEventListener('DOMContentLoaded', initAndroidMenu);
})();
