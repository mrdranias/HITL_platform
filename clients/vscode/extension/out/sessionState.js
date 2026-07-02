"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentLandmark = currentLandmark;
function currentLandmark(state) {
    if (state.landmarks.length === 0) {
        return null;
    }
    const idx = Math.min(state.interactionCount, state.landmarks.length - 1);
    return state.landmarks[idx];
}
//# sourceMappingURL=sessionState.js.map