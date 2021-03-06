const STORAGE_KEY = 'initiator';

export default {
    getLocalInitiator() {
        return localStorage.getItem(STORAGE_KEY);
    },
    generateAndSaveLocalInitiator() {
        const initiatorId = Date.now().toString();
        localStorage.setItem(STORAGE_KEY, initiatorId);
        return initiatorId;
    }
}