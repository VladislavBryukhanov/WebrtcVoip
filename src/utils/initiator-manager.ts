export default {
    getLocalInitiator() {
        return localStorage.getItem('initiator');
    },
    generateAndSaveLocalInitiator() {
        const initiatorId = Date.now().toString();
        localStorage.setItem('initiator', initiatorId);
        return initiatorId;
    }
}