(function () {
    const googleSearchUrl = 'https://www.google.com/search?q=';
    const savedLinks = [
        {
            title: 'MissAV Tiếng Việt',
            meta: 'missav.ai/dm193/vi',
            url: 'https://missav.ai/dm193/vi'
        }
    ];

    function getAndroidBridge() {
        return window.DauPhimAndroid && typeof window.DauPhimAndroid.openUrl === 'function'
            ? window.DauPhimAndroid
            : null;
    }

    function openInApp(url) {
        const bridge = getAndroidBridge();
        if (!bridge) return;
        bridge.openUrl(url);
    }

    function createButton(className, label, ariaLabel) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        if (ariaLabel) {
            button.setAttribute('aria-label', ariaLabel);
        }
        return button;
    }

    function createLinkSheet() {
        const sheet = document.createElement('div');
        sheet.className = 'link-sheet';
        sheet.hidden = true;
        sheet.innerHTML = `
            <div class="link-sheet-backdrop" data-link-sheet-close></div>
            <section class="link-sheet-panel" aria-label="Danh sách link linh tinh">
                <div class="link-sheet-head">
                    <span>
                        <small>Link Linh Tinh</small>
                        <strong>Chọn trang muốn mở</strong>
                    </span>
                    <button type="button" class="link-sheet-close" data-link-sheet-close aria-label="Đóng">×</button>
                </div>
                <div class="link-sheet-list"></div>
            </section>
        `;

        const list = sheet.querySelector('.link-sheet-list');
        savedLinks.forEach((item) => {
            const linkButton = createButton('link-sheet-item', '', `Mở ${item.title}`);
            linkButton.innerHTML = `
                <span class="link-sheet-icon">↗</span>
                <span class="link-sheet-copy">
                    <strong>${item.title}</strong>
                    <small>${item.meta}</small>
                </span>
                <span class="link-sheet-arrow">›</span>
            `;
            linkButton.addEventListener('click', () => openInApp(item.url));
            list.appendChild(linkButton);
        });

        sheet.addEventListener('click', (event) => {
            if (event.target.closest('[data-link-sheet-close]')) {
                sheet.hidden = true;
                document.body.classList.remove('link-sheet-open');
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !sheet.hidden) {
                sheet.hidden = true;
                document.body.classList.remove('link-sheet-open');
            }
        });

        document.body.appendChild(sheet);
        return sheet;
    }

    function initAndroidMenu() {
        if (!getAndroidBridge() || document.querySelector('.apk-menu')) {
            return;
        }

        const header = document.querySelector('.site-header');
        const memberPill = document.querySelector('.member-pill');
        if (!header) return;

        document.body.classList.add('android-app-shell');

        const sheet = createLinkSheet();
        const menu = document.createElement('div');
        menu.className = 'apk-menu';

        const trigger = createButton('apk-menu-trigger', 'Link Linh Tinh', 'Mở menu Link Linh Tinh');
        const dropdown = document.createElement('div');
        dropdown.className = 'apk-menu-dropdown';

        const googleButton = createButton('apk-menu-item', 'Google Search', 'Mở Google Search trong app');
        const linkButton = createButton('apk-menu-item', 'Link', 'Mở danh sách link');

        googleButton.addEventListener('click', () => openInApp(googleSearchUrl));
        linkButton.addEventListener('click', () => {
            sheet.hidden = false;
            document.body.classList.add('link-sheet-open');
        });

        dropdown.append(googleButton, linkButton);
        menu.append(trigger, dropdown);

        if (memberPill) {
            header.insertBefore(menu, memberPill);
        } else {
            header.appendChild(menu);
        }

        trigger.addEventListener('click', () => {
            menu.classList.toggle('open');
        });

        document.addEventListener('click', (event) => {
            if (!menu.contains(event.target)) {
                menu.classList.remove('open');
            }
        });
    }

    window.DauPhimAndroidMenu = {
        init: initAndroidMenu
    };

    document.addEventListener('DOMContentLoaded', initAndroidMenu);
})();
