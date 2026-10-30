const assert = require('assert');
const {
    MESSAGE_TYPES,
    createMessage,
    parseMessage,
    calculateDriftAction,
    isHostActionAllowed
} = require('../party-protocol');

async function runTests() {
    // 1. Message creation and parsing
    const msg = createMessage(MESSAGE_TYPES.HEARTBEAT, {
        time: 120.5,
        state: 'playing',
        movieId: 'film-1',
        epSlug: 'tap-1',
        server: 'Vietsub #1'
    });
    assert.strictEqual(msg.type, 'HEARTBEAT');
    assert.strictEqual(msg.payload.time, 120.5);

    const serialized = JSON.stringify(msg);
    const parsed = parseMessage(serialized);
    assert.deepStrictEqual(parsed, msg);

    // 2. Drift calculation thresholds
    // Delta < 1.5s -> ignore (smooth playback)
    const driftSmall = calculateDriftAction(100.0, 100.8);
    assert.strictEqual(driftSmall.action, 'ignore');

    // 1.5s <= Delta <= 3.5s -> speed_up (catch-up gently)
    const driftMedium = calculateDriftAction(100.0, 102.2);
    assert.strictEqual(driftMedium.action, 'speed_up');
    assert.strictEqual(driftMedium.playbackRate, 1.15);

    // Delta > 3.5s -> hard seek
    const driftLarge = calculateDriftAction(100.0, 115.0);
    assert.strictEqual(driftLarge.action, 'seek');
    assert.strictEqual(driftLarge.targetTime, 115.0);

    // 3. Host Permission Enforcement
    assert.strictEqual(isHostActionAllowed('host', 'PLAY'), true);
    assert.strictEqual(isHostActionAllowed('host', 'SEEK'), true);
    assert.strictEqual(isHostActionAllowed('host', 'CHANGE_EPISODE'), true);
    assert.strictEqual(isHostActionAllowed('guest', 'PLAY'), false);
    assert.strictEqual(isHostActionAllowed('guest', 'SEEK'), false);
    assert.strictEqual(isHostActionAllowed('guest', 'CHANGE_EPISODE'), false);
    assert.strictEqual(isHostActionAllowed('guest', 'REACTION'), true);
    assert.strictEqual(isHostActionAllowed('guest', 'CHAT'), true);

    console.log('✅ Task 1: Protocol tests passed!');
}

runTests().catch((err) => {
    console.error('❌ Task 1 failed:', err);
    process.exit(1);
});
