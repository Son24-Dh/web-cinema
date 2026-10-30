const assert = require('assert');
const { DauPhimPartyEngine } = require('../party');

class MockPeer {
    constructor(id) {
        this.id = id || 'mock-peer-' + Math.floor(Math.random() * 1000);
        this.handlers = {};
        this.connections = [];
    }

    on(event, handler) {
        this.handlers[event] = handler;
        if (event === 'open') setTimeout(() => handler(this.id), 5);
    }

    connect(targetId) {
        const conn = new MockConnection(targetId);
        this.connections.push(conn);
        setTimeout(() => conn.trigger('open'), 5);
        return conn;
    }

    destroy() {
        this.connections.forEach(c => c.close());
    }
}

class MockConnection {
    constructor(peerId) {
        this.peer = peerId;
        this.handlers = {};
        this.sentData = [];
    }

    on(event, handler) {
        this.handlers[event] = handler;
    }

    trigger(event, data) {
        if (this.handlers[event]) this.handlers[event](data);
    }

    send(data) {
        this.sentData.push(data);
    }

    close() {
        if (this.handlers['close']) this.handlers['close']();
    }
}

async function runTests() {
    const engine = new DauPhimPartyEngine({
        PeerClass: MockPeer
    });

    // 1. Test Host room creation
    const roomId = await engine.createRoom('dau-test-room');
    assert.strictEqual(engine.isHost, true);
    assert.strictEqual(engine.roomId, 'dau-test-room');

    // 2. Test Host handling incoming guest connection & initial state delivery
    engine.callbacks.onRequestInitialState = () => ({
        time: 120,
        paused: false,
        movieId: 'film-1',
        epSlug: '1',
        server: 'Server 1'
    });
    const guestConn = new MockConnection('guest-1');
    engine.handleIncomingConnection(guestConn);
    guestConn.trigger('open');
    assert.strictEqual(engine.peers.length, 1);
    assert.strictEqual(guestConn.sentData.length, 1);
    assert.strictEqual(guestConn.sentData[0].type, 'HEARTBEAT');
    assert.strictEqual(guestConn.sentData[0].payload.time, 120);

    // 3. Test Host broadcasting messages
    engine.broadcast('PLAY', { time: 50 });
    assert.strictEqual(guestConn.sentData.length, 2);
    assert.strictEqual(guestConn.sentData[1].type, 'PLAY');
    assert.strictEqual(guestConn.sentData[1].payload.time, 50);

    // 4. Test Guest join room
    const guestEngine = new DauPhimPartyEngine({ PeerClass: MockPeer });
    await guestEngine.joinRoom('dau-test-room', 'Phương Nhi');
    assert.strictEqual(guestEngine.isHost, false);
    assert.strictEqual(guestEngine.role, 'guest');
    assert.strictEqual(guestEngine.peers.length, 1);

    // 5. Test reaction & chat callbacks
    let receivedReaction = null;
    let receivedChat = null;
    engine.callbacks.onReaction = (r) => { receivedReaction = r; };
    engine.callbacks.onChat = (c) => { receivedChat = c; };

    guestConn.trigger('data', { type: 'REACTION', payload: { emoji: '🍓', sender: 'Phương Nhi' } });
    assert.strictEqual(receivedReaction?.emoji, '🍓');
    assert.strictEqual(receivedReaction?.sender, 'Phương Nhi');

    guestConn.trigger('data', { type: 'CHAT', payload: { text: 'Hello', sender: 'Phương Nhi' } });
    assert.strictEqual(receivedChat?.text, 'Hello');

    // 6. Test leave room
    engine.leaveRoom();
    assert.strictEqual(engine.role, null);
    assert.strictEqual(engine.roomId, null);
    assert.strictEqual(engine.peers.length, 0);

    console.log('✅ Task 2: P2P Room Manager tests passed!');
}

runTests().catch(err => {
    console.error('❌ Task 2 failed:', err);
    process.exit(1);
});
