/**
 * Dâu Cinema Watch Party — Protocol & Sync Engine
 * UMD module for message structures, serialization and drift calculation.
 */
(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        module.exports = factory();
    } else {
        const globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : root);
        globalScope.DauPhimProtocol = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const MESSAGE_TYPES = {
        JOIN: 'JOIN',
        ROOM_INFO: 'ROOM_INFO',
        HEARTBEAT: 'HEARTBEAT',
        PLAY: 'PLAY',
        PAUSE: 'PAUSE',
        SEEK: 'SEEK',
        CHANGE_EPISODE: 'CHANGE_EPISODE',
        CHANGE_SERVER: 'CHANGE_SERVER',
        REACTION: 'REACTION',
        CHAT: 'CHAT'
    };

    function createMessage(type, payload = {}) {
        return {
            type,
            payload,
            timestamp: Date.now()
        };
    }

    function parseMessage(raw) {
        try {
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (e) {
            return null;
        }
    }

    function calculateDriftAction(guestTime, hostTime) {
        const delta = hostTime - guestTime;
        const absDelta = Math.abs(delta);

        if (absDelta < 1.5) {
            return { action: 'ignore', delta };
        }
        if (absDelta <= 3.5) {
            return { action: 'speed_up', delta, playbackRate: delta > 0 ? 1.15 : 0.85 };
        }
        return { action: 'seek', delta, targetTime: hostTime };
    }

    function isHostActionAllowed(role, actionType) {
        if (role === 'host') return true;
        const guestAllowedActions = [MESSAGE_TYPES.REACTION, MESSAGE_TYPES.CHAT, MESSAGE_TYPES.JOIN];
        return guestAllowedActions.includes(actionType);
    }

    return {
        MESSAGE_TYPES,
        createMessage,
        parseMessage,
        calculateDriftAction,
        isHostActionAllowed
    };
}));
