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
    }

    if (typeof window !== 'undefined') {
        return new DauPhimPartyEngine();
    }

    return { DauPhimPartyEngine };
}));
