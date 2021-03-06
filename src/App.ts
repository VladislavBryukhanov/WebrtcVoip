import {customElement, html, LitElement, property, css} from 'lit-element';
import ConnectionManager from './services/connection-manager';
import SignalinService from './services/signaling';
import initiatorManager from './utils/initiator-manager';

const VERSION = '1.0';
const DEFAULT_CONNECTION_ACCESSOR = 'public';

enum StreamType {
    SCREEN = 'screen',
    CAMERA = 'camera',
}

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

        if (this.localMediaStream) {
            const [videoTrack] = this.localMediaStream.getVideoTracks();
            videoTrack.applyConstraints({
                width: this.videoWidthResolution
            });
        }
    }

    async onListenConnection() {
        this.signalingService = new SignalinService(this.accessor);
        this.signalingService.disposeConnection();

        const offer = await this.signalingService.listenConnectionUpdateOnce('offer');

        if (offer && !this.connectionInited) {
            this.onStartStream(StreamType.CAMERA);
        }
    }

    async onStartStream(type: StreamType) {
        this.feedbackMessage = 'Connection initializing...';
        this.signalingService = new SignalinService(this.accessor);
        this.connectionManager = new ConnectionManager();

        await this.initializeLocalStream(type);

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

    async initializeLocalStream(type: StreamType) {
        const streamConstraints = {
            video: {
                width: this.videoWidthResolution
            },
            audio: true,
        };

        switch(type) {
            case StreamType.CAMERA: {
                this.localMediaStream = await navigator.mediaDevices.getUserMedia(streamConstraints);
                this.localMediaStream.getTracks().forEach(track => 
                    this.connectionManager.peerConnection.addTrack(track, this.localMediaStream)
                );
                break;
            }
            case StreamType.SCREEN: {
                // @ts-ignore
                this.localMediaStream = await navigator.mediaDevices.getDisplayMedia(streamConstraints);
                const audioStream = await navigator.mediaDevices.getUserMedia({audio: true});

                const tracks = [
                    ...this.localMediaStream.getTracks(),
                    ...audioStream.getTracks(),
                ];

                tracks.forEach(track => 
                    this.connectionManager.peerConnection.addTrack(track, this.localMediaStream)
                );
                break;
            }
        }
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
                @share-screen=${() => this.onStartStream(StreamType.SCREEN)}
                @run-camera=${() => this.onStartStream(StreamType.CAMERA)}
            ></video-ui>
        `;
    }
}
