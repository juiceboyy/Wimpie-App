let participantsData = [];
let presenceState = {};

export function getParticipants() {
    return participantsData;
}

export function setParticipants(data) {
    participantsData = data;
}

export function getPresence() {
    return presenceState;
}

export function resetPresence() {
    presenceState = {};
}

export function setPresence(index, value) {
    presenceState[index] = value;
}

export function togglePresence(index) {
    presenceState[index] = !presenceState[index];
    return presenceState[index];
}