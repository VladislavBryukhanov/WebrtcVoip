import {customElement, html, LitElement, property, query} from 'lit-element';
import ConnectionManager from './services/connection-manager';
import SignalinService from './services/signaling';

const VERSION = '1.0';

@customElement('app-root')
export class App extends LitElement {
    connectionManager?: ConnectionManager;
    signalingService?: SignalinService;

    @property()
    accessor: string = 'public';

    @property()
    mediaStream?: MediaStream;

    @query('#video-view')
    videoElement?: HTMLVideoElement;


    // async firstUpdated() {
    //     this.signalingService = new SignalinService(this.accessor);
    //     const offer = await this.signalingService.listenUpdates();
    // }

    updated(updates: Map<string, MediaStream | HTMLVideoElement>) {
        // if (this.accessor !== updates.get('accessor')) {
        //     this.
        // }
        if (this.videoElement && this.mediaStream && !updates.get('mediaStream')) {
            this.videoElement.srcObject = this.mediaStream;
        }
    }

    async onScreenStream() {
        // @ts-ignore
        this.mediaStream = await navigator.mediaDevices.getDisplayMedia();
    }

    async onCameraStream() {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            'video': true,
            'audio': true,
        });
    }

    async onCreateConnection() {
        this.connectionManager = new ConnectionManager();
        this.signalingService = new SignalinService(this.accessor);
        const offer = await this.connectionManager.initConnection();

        await this.signalingService.createConnectionOffer(offer);

        const {answer} = await this.signalingService.listenReaction('answer');

        return this.connectionManager.establishRemoteConnection(answer);
    }

    async onConnectExists() {
        this.connectionManager = new ConnectionManager();
        this.signalingService = new SignalinService(this.accessor);

        const {offer} = await this.signalingService.fetchConnection();
        const answer = await this.connectionManager.connectExists(offer);

        return this.signalingService.createConnectionAnswer(answer);
    }
    
    render() {
        return html`
            <h1>WebRTC Video communication App v${VERSION}</h1>
            <input .value=${this.accessor} />

            <button @click=${this.onScreenStream}>Share screen</button>
            <button @click=${this.onCameraStream}>Run camera</button>

            <button @click=${this.onCreateConnection}>Create connection with interlocutor</button>
            <button @click=${this.onConnectExists}>Connect interlocutor</button>

            ${this.mediaStream && html`<video id="video-view" autoplay></video>`}
        `;
    }
}
