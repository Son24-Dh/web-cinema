(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        const protocol = require('./party-protocol');
        module.exports = factory(protocol);
    } else {
        root.DauPhimParty = factory(root.DauPhimProtocol);
    }
}(typeof self !== 'undefined' ? self : this, function (Protocol) {
    const { MESSAGE_TYPES, createMessage, parseMessage } = Protocol;

    class DauPhimPartyEngine {
        constructor(options = {}) {
            this.PeerClass = options.PeerClass || (typeof window !== 'undefined' ? window.Peer : null);
            this.peer = null;
            this.role = null; // 'host' | 'guest'
            this.roomId = null;
            this.userName = options.userName || 'Bạn';
            this.peers = []; // DataConnection instances
            this.callbacks = {
                onSync: () => {},
                onReaction: () => {},
                onChat: () => {},
                onStatusChange: () => {},
                onMemberChange: () => {}
            };
        }

        get isHost() {
            return this.role === 'host';
        }

        get isConnected() {
            return this.peers.length > 0;
        }

        createRoom(customRoomId) {
            return new Promise((resolve, reject) => {
                const id = customRoomId || 'dau-' + Math.random().toString(36).substring(2, 8);
                this.role = 'host';
                this.roomId = id;

                if (!this.PeerClass) {
                    return reject(new Error('PeerJS is not loaded'));
                }

                this.peer = new this.PeerClass(id);
                this.peer.on('open', (assignedId) => {
                    this.callbacks.onStatusChange({ status: 'waiting', roomId: assignedId, role: 'host' });
                    resolve(assignedId);
                });

                this.peer.on('connection', (conn) => {
                    this.handleIncomingConnection(conn);
                });

                this.peer.on('error', (err) => {
                    this.callbacks.onStatusChange({ status: 'error', error: err?.message || String(err) });
                    reject(err);
                });
            });
        }

        handleIncomingConnection(conn) {
            this.peers.push(conn);

            conn.on('open', () => {
                this.callbacks.onMemberChange({ count: this.peers.length, role: 'host' });
                if (typeof this.callbacks.onRequestInitialState === 'function') {
                    try {
                        const initialState = this.callbacks.onRequestInitialState();
                        if (initialState) {
                            conn.send(createMessage(MESSAGE_TYPES.HEARTBEAT, initialState));
                        }
                    } catch (e) {
                        console.warn('Failed to send initial state to new guest:', e);
                    }
                }
            });

            conn.on('data', (data) => {
                const msg = parseMessage(data);
                if (!msg) return;

                if (msg.type === MESSAGE_TYPES.REACTION) {
                    this.callbacks.onReaction(msg.payload);
                    this.peers.forEach(p => p !== conn && p.send(msg));
                } else if (msg.type === MESSAGE_TYPES.CHAT) {
                    this.callbacks.onChat(msg.payload);
                    this.peers.forEach(p => p !== conn && p.send(msg));
                }
            });

            conn.on('close', () => {
                this.peers = this.peers.filter(p => p !== conn);
                this.callbacks.onMemberChange({ count: this.peers.length, role: 'host' });
            });
        }

        joinRoom(roomId, userName) {
            return new Promise((resolve, reject) => {
                this.role = 'guest';
                this.roomId = roomId;
                this.userName = userName || 'Khách';

                if (!this.PeerClass) {
                    return reject(new Error('PeerJS is not loaded'));
                }

                this.peer = new this.PeerClass();
                this.peer.on('open', () => {
                    const hostConn = this.peer.connect(roomId, { reliable: true });
                    hostConn.on('open', () => {
                        this.peers = [hostConn];
                        hostConn.send(createMessage(MESSAGE_TYPES.JOIN, { name: this.userName }));
                        this.callbacks.onStatusChange({ status: 'connected', roomId, role: 'guest' });
                        resolve(roomId);
                    });

                    hostConn.on('data', (data) => {
                        const msg = parseMessage(data);
                        if (!msg) return;

                        if (msg.type === MESSAGE_TYPES.REACTION) {
                            this.callbacks.onReaction(msg.payload);
                        } else if (msg.type === MESSAGE_TYPES.CHAT) {
                            this.callbacks.onChat(msg.payload);
                        } else {
                            this.callbacks.onSync(msg);
                        }
                    });

                    hostConn.on('close', () => {
                        this.peers = [];
                        this.callbacks.onStatusChange({ status: 'disconnected', role: 'guest' });
                    });
                });

                this.peer.on('error', (err) => {
                    this.callbacks.onStatusChange({ status: 'error', error: err?.message || String(err) });
                    reject(err);
                });
            });
        }

        broadcast(type, payload) {
            if (!this.isHost) return;
            const message = createMessage(type, payload);
            this.peers.forEach(conn => {
                try { conn.send(message); } catch (e) {}
            });
        }

        sendReaction(emoji) {
            const msg = createMessage(MESSAGE_TYPES.REACTION, { emoji, sender: this.userName });
            this.callbacks.onReaction(msg.payload);
            this.peers.forEach(p => {
                try { p.send(msg); } catch (e) {}
            });
        }

        sendChat(text) {
            const msg = createMessage(MESSAGE_TYPES.CHAT, { text, sender: this.userName, timestamp: Date.now() });
            this.callbacks.onChat(msg.payload);
            this.peers.forEach(p => {
                try { p.send(msg); } catch (e) {}
            });
        }

        triggerFloatingEmoji(emoji) {
            if (typeof document === 'undefined') return;
            const container = document.getElementById('floating-emoji-container');
            if (!container) return;

            const span = document.createElement('span');
            span.className = 'floating-emoji';
            span.textContent = emoji || '🍓';
            const leftPercent = 45 + Math.random() * 40;
            span.style.left = `${leftPercent}%`;

            container.appendChild(span);
            span.addEventListener('animationend', () => span.remove());
            setTimeout(() => span.remove(), 2600);
        }

        leaveRoom() {
            if (this.peer) {
                this.peer.destroy();
                this.peer = null;
            }
            this.peers = [];
            this.role = null;
            this.roomId = null;
            this.callbacks.onStatusChange({ status: 'idle' });
        }

        setupPartyUI() {
            if (typeof document === 'undefined') return;

            const modal = document.getElementById('party-modal');
            const btnWatchParty = document.getElementById('btn-watch-party');
            const closeBtn = document.getElementById('party-close-btn');
            const createBtn = document.getElementById('party-create-btn');
            const joinBtn = document.getElementById('party-join-btn');
            const roomInput = document.getElementById('party-room-input');
            const copyLinkBtn = document.getElementById('party-copy-link-btn');
            const leaveBtn = document.getElementById('party-leave-btn');
            const statusDot = document.getElementById('party-status-dot');
            const viewIdle = document.getElementById('party-view-idle');
            const viewConnected = document.getElementById('party-view-connected');
            const roomCodeDisplay = document.getElementById('party-room-code-display');
            const roleDesc = document.getElementById('party-role-desc');
            const membersCount = document.getElementById('party-members-count');
            const quickStatus = document.getElementById('party-quick-status');
            const reactionBar = document.getElementById('party-reaction-bar');
            const chatDrawer = document.getElementById('party-chat-drawer');
            const chatCloseBtn = document.getElementById('chat-close-btn');
            const toggleChatBtn = document.getElementById('toggle-chat-btn');
            const chatForm = document.getElementById('chat-form');
            const chatInput = document.getElementById('chat-input');
            const chatMessages = document.getElementById('chat-messages');
            const chatUnreadBadge = document.getElementById('chat-unread-badge');
            let unreadCount = 0;

            if (!modal || !btnWatchParty) return;

            const toggleModal = (show) => {
                if (show === undefined) {
                    modal.classList.toggle('hidden');
                } else if (show) {
                    modal.classList.remove('hidden');
                } else {
                    modal.classList.add('hidden');
                }
            };

            btnWatchParty.addEventListener('click', () => toggleModal());
            if (closeBtn) closeBtn.addEventListener('click', () => toggleModal(false));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) toggleModal(false);
            });

            // Update UI based on engine status
            const prevOnStatusChange = this.callbacks.onStatusChange;
            this.callbacks.onStatusChange = (statusObj) => {
                prevOnStatusChange(statusObj);
                if (statusObj.status === 'waiting' || statusObj.status === 'connected') {
                    if (viewIdle) viewIdle.classList.add('hidden');
                    if (viewConnected) viewConnected.classList.remove('hidden');
                    if (roomCodeDisplay) roomCodeDisplay.textContent = this.roomId || '---';
                    if (statusDot) {
                        statusDot.className = 'status-dot ' + (statusObj.status === 'waiting' ? 'waiting' : 'connected');
                    }
                    if (roleDesc) {
                        roleDesc.textContent = this.isHost
                            ? 'Bạn là: 👑 Chủ phòng (Toàn quyền điều khiển)'
                            : 'Bạn là: 👤 Khách xem (Đồng bộ theo Chủ phòng)';
                    }
                    if (quickStatus) {
                        quickStatus.textContent = this.isHost ? '👑 Chủ phòng' : '👥 Đang xem chung';
                    }
                    if (reactionBar) reactionBar.classList.remove('hidden');
                } else {
                    if (viewIdle) viewIdle.classList.remove('hidden');
                    if (viewConnected) viewConnected.classList.add('hidden');
                    if (statusDot) statusDot.className = 'status-dot';
                    if (quickStatus) quickStatus.textContent = '';
                    if (reactionBar) reactionBar.classList.add('hidden');
                    if (chatDrawer) chatDrawer.classList.add('hidden');
                }
            };

            // Wire reaction buttons
            document.querySelectorAll('.party-reaction-bar .emoji-btn[data-emoji]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const emoji = btn.getAttribute('data-emoji');
                    if (emoji) this.sendReaction(emoji);
                });
            });

            // Wire reaction callback
            const prevOnReaction = this.callbacks.onReaction;
            this.callbacks.onReaction = (payload) => {
                prevOnReaction(payload);
                this.triggerFloatingEmoji(payload.emoji);
            };

            // Toggle chat drawer
            if (toggleChatBtn && chatDrawer) {
                toggleChatBtn.addEventListener('click', () => {
                    const isOpening = chatDrawer.classList.contains('hidden');
                    chatDrawer.classList.toggle('hidden');
                    if (isOpening) {
                        unreadCount = 0;
                        if (chatUnreadBadge) chatUnreadBadge.classList.add('hidden');
                        if (chatInput) chatInput.focus();
                    }
                });
            }

            if (chatCloseBtn && chatDrawer) {
                chatCloseBtn.addEventListener('click', () => {
                    chatDrawer.classList.add('hidden');
                });
            }

            // Wire chat submit
            if (chatForm && chatInput) {
                chatForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const text = chatInput.value.trim();
                    if (!text) return;
                    this.sendChat(text);
                    chatInput.value = '';
                });
            }

            // Wire chat message callback
            const prevOnChat = this.callbacks.onChat;
            this.callbacks.onChat = (payload) => {
                prevOnChat(payload);
                if (!chatMessages) return;

                const row = document.createElement('div');
                const isMine = payload.sender === this.userName;
                row.className = 'chat-msg-row ' + (isMine ? 'mine' : 'partner');

                const senderSpan = document.createElement('span');
                senderSpan.className = 'chat-msg-sender';
                senderSpan.textContent = isMine ? 'Bạn' : (payload.sender || 'Bạn');

                const bubbleDiv = document.createElement('div');
                bubbleDiv.className = 'chat-bubble';
                bubbleDiv.textContent = payload.text;

                const timeSpan = document.createElement('span');
                timeSpan.className = 'chat-msg-time';
                const d = new Date(payload.timestamp || Date.now());
                timeSpan.textContent = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');

                row.appendChild(senderSpan);
                row.appendChild(bubbleDiv);
                row.appendChild(timeSpan);
                chatMessages.appendChild(row);
                chatMessages.scrollTop = chatMessages.scrollHeight;

                if (chatDrawer && chatDrawer.classList.contains('hidden') && !isMine) {
                    unreadCount++;
                    if (chatUnreadBadge) {
                        chatUnreadBadge.textContent = unreadCount;
                        chatUnreadBadge.classList.remove('hidden');
                    }
                }
            };

            const prevOnMemberChange = this.callbacks.onMemberChange;
            this.callbacks.onMemberChange = (memberObj) => {
                prevOnMemberChange(memberObj);
                if (membersCount) {
                    const total = (memberObj.count || 0) + 1; // self + connected
                    membersCount.textContent = `👥 Đang kết nối: ${total} người`;
                }
                if (statusDot && this.isHost) {
                    statusDot.className = 'status-dot ' + (memberObj.count > 0 ? 'connected' : 'waiting');
                }
            };

            if (createBtn) {
                createBtn.addEventListener('click', async () => {
                    createBtn.disabled = true;
                    createBtn.textContent = 'Đang khởi tạo phòng...';
                    try {
                        await this.createRoom();
                    } catch (e) {
                        alert('Không thể tạo phòng WebRTC: ' + (e?.message || e));
                    } finally {
                        createBtn.disabled = false;
                        createBtn.textContent = 'Tạo Phòng Mới (Chủ Phòng 👑)';
                    }
                });
            }

            if (joinBtn && roomInput) {
                joinBtn.addEventListener('click', async () => {
                    const code = roomInput.value.trim();
                    if (!code) return alert('Vui lòng nhập mã phòng!');
                    joinBtn.disabled = true;
                    joinBtn.textContent = 'Đang kết nối...';
                    try {
                        await this.joinRoom(code, 'Phương Nhi');
                        toggleModal(false);
                    } catch (e) {
                        alert('Không thể kết nối phòng: ' + (e?.message || e));
                    } finally {
                        joinBtn.disabled = false;
                        joinBtn.textContent = 'Vào Phòng';
                    }
                });
            }

            if (copyLinkBtn) {
                copyLinkBtn.addEventListener('click', () => {
                    if (!this.roomId) return;
                    const url = new URL(window.location.href);
                    url.searchParams.set('room', this.roomId);
                    navigator.clipboard.writeText(url.toString()).then(() => {
                        const original = copyLinkBtn.textContent;
                        copyLinkBtn.textContent = 'Đã sao chép! 🍓';
                        setTimeout(() => { copyLinkBtn.textContent = original; }, 2000);
                    }).catch(() => {
                        prompt('Sao chép link này gửi bạn bè:', url.toString());
                    });
                });
            }

            if (leaveBtn) {
                leaveBtn.addEventListener('click', () => {
                    this.leaveRoom();
                    toggleModal(false);
                });
            }

            // Auto-join from URL parameter ?room=...
            const urlParams = new URLSearchParams(window.location.search);
            const autoRoom = urlParams.get('room');
            if (autoRoom && !this.isConnected && !this.isHost) {
                this.joinRoom(autoRoom, 'Phương Nhi').catch(err => {
                    console.warn('Auto-join party room failed:', err);
                });
            }
        }
    }

    if (typeof window !== 'undefined') {
        const instance = new DauPhimPartyEngine();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => instance.setupPartyUI());
        } else {
            instance.setupPartyUI();
        }
        return instance;
    }

    return { DauPhimPartyEngine };
}));
