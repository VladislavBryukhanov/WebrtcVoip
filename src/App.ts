import {customElement, html, LitElement, property} from 'lit-element';
import ConnectionManager from './services/connection-manager';
import SignalinService from './services/signaling';
import initiatorManager from './utils/initiator-manager';

const VERSION = '1.0';
const DEFAULT_CONNECTION_ACCESSOR = 'public';

@customElement('app-root')
export class App extends LitElement {
    @property()
    accessor: string = DEFAULT_CONNECTION_ACCESSOR;
    @property()
    feedbackMessage?: string;

    @property()
    localMediaStream?: MediaStream;
    @property()
    remoteMediaStream?: MediaStream;


    signalingService?: SignalinService;
    connectionManager?: ConnectionManager;

    delayedIceCandidates: RTCIceCandidate[] = [];

    initiatorId?: string;
    connectionInited?: boolean;

    async firstUpdated() {
        if (!this.initiatorId) {
            this.initiatorId = initiatorManager.getLocalInitiator() || initiatorManager.generateAndSaveLocalInitiator();
        }
    }

    async onListenConnection() {
        this.signalingService = new SignalinService(this.accessor);
        this.signalingService.disposeConnection();

        const offer = await this.signalingService.listenConnectionUpdateOnce('offer');

        if (offer && !this.connectionInited) {
            this.onCameraStream();
        }
    }

    async onScreenStream() {
        // @ts-ignore
        this.localMediaStream = await navigator.mediaDevices.getDisplayMedia();
        await this.processConnection();
        await this.processIceCandidates();
    }

    async onCameraStream() {
        this.localMediaStream = await navigator.mediaDevices.getUserMedia({
            'video': true,
            'audio': true,
        });
        await this.processConnection();
        await this.processIceCandidates();
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
                this.feedbackMessage = '';
                this.signalingService.disposeConnection();
            }

            if (this.connectionManager.peerConnection.connectionState === 'failed') {
                this.feedbackMessage = 'Connection failed please reload page and try again';
                this.signalingService.disposeConnection();
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
            <video-ui
                .feedbackMessage=${this.feedbackMessage}
                .localMediaStream=${this.localMediaStream}
                .remoteMediaStream=${this.remoteMediaStream}
                @listen-connection=${this.onListenConnection}
                @share-screen=${this.onScreenStream}
                @run-camera=${this.onCameraStream}
            ></video-ui>
        `;
    }
}
