import {customElement, html, LitElement, property, query} from 'lit-element';
import ConnectionManager from './services/connection-manager';
import SignalinService from './services/signaling';

const VERSION = '1.0';
const DEFAULT_CONNECTION_ACCESSOR = 'public';

@customElement('app-root')
export class App extends LitElement {
    connectionManager?: ConnectionManager;
    signalingService?: SignalinService;

    initiatorId?: string;

    @property()
    accessor: string = DEFAULT_CONNECTION_ACCESSOR;

    @property()
    localMediaStream?: MediaStream;
    @property()
    remoteMediaStream?: MediaStream;

    @query('#local-stream-view')
    localStreamVideo?: HTMLVideoElement;
    @query('#remote-stream-view')
    remoteStreamVideo?: HTMLVideoElement;


    async firstUpdated() {
        this.initiatorId = this.getInitiator();

        // const permissions = await Notification.requestPermission();

        // this.signalingService = new SignalinService(this.accessor);
        // const offer = await this.signalingService.listenConnectionUpdateOnce('offer');

        // if (offer && permissions === 'granted') {
            // return new Notification('Incoming call', {
            //     body: 'please select button to start communication', 
            // });
        // }

        // Force call
        // this.onCameraStream();
    }

    updated(updates: Map<string, MediaStream | HTMLVideoElement>) {
        // TODO add WebRTC connection feedback

        // if (this.accessor !== updates.get('accessor')) {
        //     update connection
        // }
        if (this.localStreamVideo && this.localMediaStream && !updates.get('localMediaStream')) {
            this.localStreamVideo.srcObject = this.localMediaStream;
        }

        if (this.remoteStreamVideo && this.remoteMediaStream && !updates.get('remoteMediaStream')) {
            this.remoteStreamVideo.srcObject = this.remoteMediaStream;
        }
    }

    async onScreenStream() {
        // @ts-ignore
        this.localMediaStream = await navigator.mediaDevices.getDisplayMedia();
        await this.processConnection();
    }

    async onCameraStream() {
        this.localMediaStream = await navigator.mediaDevices.getUserMedia({
            'video': true,
            'audio': true,
        });
        await this.processConnection();
    }

    getInitiator() {
        let initiatorId = localStorage.getItem('initiator');

        if (!initiatorId) {
            initiatorId = Date.now().toString();
            localStorage.setItem('initiator', this.initiatorId);
        }

        return initiatorId;
    }
    
    // TODO incapsulate this.connectionManager.peerConnection, add DI to inject connectionManager
    subscribeICECandidateManagement() {
        const localIceCandidates = new Map<string, RTCIceCandidate>();

        this.signalingService.listenConnection(({candidate: storedCandidate}) => {
            if (storedCandidate && !localIceCandidates.has(storedCandidate.candidate)) {
                this.connectionManager.peerConnection.addIceCandidate(storedCandidate);
            }
        });

        this.connectionManager.peerConnection.addEventListener('icecandidate', event => {
            if (event.candidate) {
                localIceCandidates.set(event.candidate.candidate, event.candidate);
                this.signalingService.upsertIceCandidate(event.candidate);
            }
        });

        this.connectionManager.peerConnection.addEventListener('track', event => {
            this.remoteMediaStream = new MediaStream();
            this.remoteMediaStream.addTrack(event.track);
        });
    }

    async processConnection() {
        this.signalingService = new SignalinService(this.accessor);
        this.connectionManager = new ConnectionManager();

        this.connectionManager.passTracks(this.localMediaStream);
        this.subscribeICECandidateManagement();

        const connection = await this.signalingService.fetchConnection();
        const isExpired = connection.expiration_time < Date.now();
        const createdByMe = connection.initiatorId === this.initiatorId;

        if (connection && connection.offer && !createdByMe && !isExpired) {
            return this.connectExists(connection.offer);
        }

        this.createConnection();
    }

    async createConnection() {
        const offer = await this.connectionManager.initConnection();

        await this.signalingService.createConnectionOffer(offer, this.initiatorId);

        const {answer} = await this.signalingService.listenConnectionUpdateOnce('answer');

        await this.connectionManager.establishRemoteConnection(answer);
        // console.log(this.connectionManager.peerConnection);
    }

    async connectExists(offer: RTCSessionDescriptionInit) {
        const answer = await this.connectionManager.connectExists(offer);

        await this.signalingService.createConnectionAnswer(answer);
        // console.log(this.connectionManager.peerConnection);
    }
    
    render() {
        return html`
            <h1>WebRTC Video communication App v${VERSION}</h1>
            <input .value=${this.accessor} ?disabled=${!!this.localMediaStream} />

            <button @click=${this.onScreenStream}>Share screen</button>
            <button @click=${this.onCameraStream}>Run camera</button>

            ${this.localMediaStream && html`
                <h3>Your translation:</h3>
                <video id="local-stream-view" height="300px" autoplay></video>
            `}
            
            ${this.remoteMediaStream && html`
                </hr>
                <h3>Interlocutor's translation:</h3>
                <video id="remote-stream-view" height="300px" autoplay></video>
            `}
        `;
    }
}
