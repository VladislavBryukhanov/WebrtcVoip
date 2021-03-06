// TODO to .env
const configuration = {
    iceServers: [{
        urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
            'stun:stun3.l.google.com:19302',
            'stun:stun4.l.google.com:19302',
        ]
    }]
};

export default class ConnectionManager {
    peerConnection: RTCPeerConnection;

    constructor() {
        this.peerConnection = new RTCPeerConnection(configuration);
    }

    async initConnection() {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        return offer;
    }

    async establishRemoteConnection(description: RTCSessionDescriptionInit) {
        const formattedDescription = new RTCSessionDescription(description);
        await this.peerConnection.setRemoteDescription(formattedDescription);
    }

    async acceptConnection(offer: RTCSessionDescriptionInit) {
        await this.establishRemoteConnection(offer);

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        return answer;
    }
}
