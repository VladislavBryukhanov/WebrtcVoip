import {customElement, html, LitElement, property, query} from 'lit-element';
import ConnectionManager from './services/connection-manager';
import SignalinService from './services/signaling';

const VERSION = '1.0';
const DEFAULT_CONNECTION_ACCESSOR = 'public';

@customElement('app-root')
export class App extends LitElement {
    @property()
    accessor: string = DEFAULT_CONNECTION_ACCESSOR;
    @property()
    communicationStart: boolean = false;

    @property()
    feedbackMessage: string;

    @property()
    localMediaStream?: MediaStream;
    @property()
    remoteMediaStream?: MediaStream;

    @query('#local-stream-view')
    localStreamVideo?: HTMLVideoElement;
    @query('#remote-stream-view')
    remoteStreamVideo?: HTMLVideoElement;

    signalingService?: SignalinService;
    connectionManager?: ConnectionManager;

    delayedIceCandidates: RTCIceCandidate[] = [];

    initiatorId?: string;
    connectionInited: boolean = false;

    async firstUpdated() {
        this.initiatorId = this.getInitiator();
    }

    updated(updates: Map<string, MediaStream | HTMLVideoElement | string>) {
        if (this.localStreamVideo && this.localMediaStream && !updates.get('localMediaStream')) {
            this.localStreamVideo.srcObject = this.localMediaStream;
        }

        if (this.remoteStreamVideo && this.remoteMediaStream && !updates.get('remoteMediaStream')) {
            this.remoteStreamVideo.srcObject = this.remoteMediaStream;
        }
    }

    async onListenConnection() {
        this.communicationStart = true;
        const signalingService = new SignalinService(this.accessor);
        signalingService.disposeConnection();

        const offer = await signalingService.listenConnectionUpdateOnce('offer');

        if (offer && !this.connectionInited) {
            this.onCameraStream();
        }
    }

    async onScreenStream() {
        this.communicationStart = true;
        // @ts-ignore
        this.localMediaStream = await navigator.mediaDevices.getDisplayMedia();
        await this.processConnection();
        await this.processIceCandidates();
    }

    async onCameraStream() {
        this.communicationStart = true;
        this.localMediaStream = await navigator.mediaDevices.getUserMedia({
            'video': true,
            'audio': true,
        });
        await this.processConnection();
        await this.processIceCandidates();
    }

    getInitiator() {
        let initiatorId = localStorage.getItem('initiator');

        if (!initiatorId) {
            initiatorId = Date.now().toString();
            localStorage.setItem('initiator', initiatorId);
        }

        return initiatorId;
    }
    
    // TODO incapsulate this.connectionManager.peerConnection, add DI to inject connectionManager
    subscribeICECandidateManagement() {
        const ignorableIceCandidates = new Map<string, RTCIceCandidate>();

        this.signalingService.listenConnection((connection) => {
            if (!connection) return;

            const {candidates: storedCandidates} = connection;

            if (storedCandidates) {
                storedCandidates.forEach(storedCandidate => {
                    if (!ignorableIceCandidates.has(storedCandidate.candidate)) {
                        ignorableIceCandidates.set(storedCandidate.candidate, storedCandidate);

                        if (this.connectionInited) {
                            return this.connectionManager.peerConnection.addIceCandidate(storedCandidate);
                        }

                        this.delayedIceCandidates.push(storedCandidate);
                    }
                });
            }
        });

        this.connectionManager.peerConnection.addEventListener('icecandidate', event => {
            if (event.candidate) {
                ignorableIceCandidates.set(event.candidate.candidate, event.candidate);
                this.signalingService.upsertIceCandidate(event.candidate);
            }
        });

        this.connectionManager.peerConnection.addEventListener('track', event => {
            if (!this.remoteMediaStream) {
                this.remoteMediaStream = new MediaStream();
            }   
            this.remoteMediaStream.addTrack(event.track);
        });

        this.connectionManager.peerConnection.addEventListener('connectionstatechange', (event) => {
            if (this.connectionManager.peerConnection.connectionState === 'connected') {
                this.signalingService.disposeConnection();
                this.feedbackMessage = '';
            }

            if (this.connectionManager.peerConnection.connectionState === 'failed') {
                this.signalingService.disposeConnection();
                this.feedbackMessage = 'Connection failed please reload page and try again';
            }
        });
    }
    
    async processIceCandidates() {
        await Promise.all([
            this.delayedIceCandidates.map(candidate =>
                this.connectionManager.peerConnection.addIceCandidate(candidate)
            )
        ]);
        this.delayedIceCandidates = [];
        this.connectionInited = true;
    }

    async processConnection() {
        this.feedbackMessage = 'Connection initializing...';

        this.signalingService = new SignalinService(this.accessor);
        this.connectionManager = new ConnectionManager();

        this.connectionManager.passTracks(this.localMediaStream);

        const connection = await this.signalingService.fetchConnection();

        if (connection) {
            const isExpired = connection.expiration_time < Date.now();
            const isCreatedByMe = connection.initiatorId === this.initiatorId;

            if (isCreatedByMe) {
                await this.signalingService.disposeConnection();
            }
    
            if (connection.offer && !isCreatedByMe && !isExpired) {
                this.subscribeICECandidateManagement();
                return this.connectExists(connection.offer);
            }
        }

        this.subscribeICECandidateManagement();
        this.createConnection();
    }

    async createConnection() {
        const offer = await this.connectionManager.initConnection();
        await this.signalingService.createConnectionOffer(offer, this.initiatorId);

        const {answer} = await this.signalingService.listenConnectionUpdateOnce('answer');
        await this.connectionManager.establishRemoteConnection(answer);
    }

    async connectExists(offer: RTCSessionDescriptionInit) {
        const answer = await this.connectionManager.connectExists(offer);
        await this.signalingService.createConnectionAnswer(answer);
    }
    
    render() {
        return html`
            <h1>WebRTC Video communication App v${VERSION}</h1>
            <input .value=${this.accessor} ?disabled=${!!this.localMediaStream} />

            <button ?disabled=${this.communicationStart} @click=${this.onListenConnection}>Waiting for connection</button>
            <button ?disabled=${this.communicationStart} @click=${this.onScreenStream}>Share screen</button>
            <button ?disabled=${this.communicationStart} @click=${this.onCameraStream}>Run camera</button>

            ${this.localMediaStream && html`
                <h3>Your translation:</h3>
                <video id="local-stream-view" height="300px" autoplay muted></video>
            `}
            
            ${this.feedbackMessage && html`<div>
                <hr>
                ${this.feedbackMessage}
                <hr>
            </div>`}

            ${this.remoteMediaStream && html`
                </hr>
                <h3>Interlocutor's translation:</h3>
                <video id="remote-stream-view" height="300px" autoplay></video>
            `}
        `;
    }
}
