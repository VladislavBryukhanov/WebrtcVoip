import {customElement, html, LitElement, property, css} from 'lit-element';
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
    videoWidthResolution: number;

    static get styles() {
        return css`
            h1 {
                font-weight: 400;
                margin-bottom: 6vh;
            }
        `;
    }

    async firstUpdated() {
        if (!this.initiatorId) {
            this.initiatorId = initiatorManager.getLocalInitiator() || initiatorManager.generateAndSaveLocalInitiator();
        }
    }

    onSetHorizontalResolution(event: CustomEvent) {
        this.videoWidthResolution = event.detail.message;
    }

    async onListenConnection() {
        this.signalingService = new SignalinService(this.accessor);
        this.signalingService.disposeConnection();

        const offer = await this.signalingService.listenConnectionUpdateOnce('offer');

        if (offer && !this.connectionInited) {
            this.onStartStream('camera');
        }
    }

    async onStartStream(type: 'camera' | 'screen') {
        const streamingMethod = {
            camera: 'getUserMedia',
            screen: 'getDisplayMedia',
        }[type];

        // @ts-ignore
        this.localMediaStream = await navigator.mediaDevices[streamingMethod]({
            video: {
                width: this.videoWidthResolution
            },
            audio: true,
        });

        this.feedbackMessage = 'Connection initializing...';
        this.signalingService = new SignalinService(this.accessor);
        this.connectionManager = new ConnectionManager();

        this.connectionManager.passTracks(this.localMediaStream);

        this.runStreamingStatusWatcher();
        this.subscribeICECandidateManagement();

        await this.processConnection();
        await this.processIceCandidates();

        this.connectionInited = true;
    }

    runStreamingStatusWatcher() {
        this.connectionManager.peerConnection.addEventListener('connectionstatechange', (e) => {
            if (this.connectionManager.peerConnection.connectionState === 'connected') {
                this.feedbackMessage = 'Connection established';
                this.signalingService.disposeConnection();
            }

            if (this.connectionManager.peerConnection.connectionState === 'failed') {
                this.feedbackMessage = 'Connection failed please reload page and try again';
                this.signalingService.disposeConnection();
            }
        });
    }

    // TODO incapsulate this.connectionManager.peerConnection, add DI to inject connectionManager
    subscribeICECandidateManagement() {
        const localIceCandidates = new Map<string, RTCIceCandidate>();

        this.signalingService.listenConnection((connection) => {
            if (!connection || !connection.candidates) return;

            connection.candidates.forEach(storedCandidate => {
                if (!localIceCandidates.has(storedCandidate.candidate)) {
                    localIceCandidates.set(storedCandidate.candidate, storedCandidate);

                    if (this.connectionInited) {
                        return this.connectionManager.peerConnection.addIceCandidate(storedCandidate);
                    }

                    this.delayedIceCandidates.push(storedCandidate);
                }
            });
        });

        this.connectionManager.peerConnection.addEventListener('icecandidate', event => {
            if (event.candidate) {
                localIceCandidates.set(event.candidate.candidate, event.candidate);
                this.signalingService.upsertIceCandidate(event.candidate);
            }
        });

        this.connectionManager.peerConnection.addEventListener('track', event => {
            if (!this.remoteMediaStream) {
                this.remoteMediaStream = new MediaStream();
            }   
            this.remoteMediaStream.addTrack(event.track);
        });
    }

    async processIceCandidates() {
        await Promise.all(
            this.delayedIceCandidates.map(candidate =>
                this.connectionManager.peerConnection.addIceCandidate(candidate)
            )
        );
        this.delayedIceCandidates = [];
    }

    async processConnection() {
        const connection = await this.signalingService.fetchConnection();

        if (connection) {
            const isExpired = connection.expiration_time < Date.now();
            const isCreatedByMe = connection.initiatorId === this.initiatorId;

            if (isCreatedByMe) {
                await this.signalingService.disposeConnection();
            }
    
            // Accept connection
            if (connection.offer && !isCreatedByMe && !isExpired) {
                const answer = await this.connectionManager.acceptConnection(connection.offer);
                return this.signalingService.createConnectionAnswer(answer);
            }
        }

        // Create connection

        const offer = await this.connectionManager.initConnection();
        await this.signalingService.createConnectionOffer(offer, this.initiatorId);

        const {answer} = await this.signalingService.listenConnectionUpdateOnce('answer');
        await this.connectionManager.establishRemoteConnection(answer);
    }

    render() {
        return html`
            <h1>WebRTC Video communication App v${VERSION}</h1>
            <mwc-textfield
                outlined
                required
                label="Room Name"
                .value=${this.accessor} 
                ?disabled=${!!this.localMediaStream}
            ></mwc-textfield>
            <video-settings @setHorizontalResolution=${this.onSetHorizontalResolution}></video-settings>
            <video-ui
                .feedbackMessage=${this.feedbackMessage}
                .localMediaStream=${this.localMediaStream}
                .remoteMediaStream=${this.remoteMediaStream}
                @listen-connection=${this.onListenConnection}
                @share-screen=${() => this.onStartStream('screen')}
                @run-camera=${() => this.onStartStream('camera')}
            ></video-ui>
        `;
    }
}
