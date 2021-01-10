import {LitElement, customElement, html, property, query} from 'lit-element';

@customElement('video-ui')
export class VideoUi extends LitElement {
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

    updated(updates: Map<string, MediaStream | HTMLVideoElement | string>) {
        if (this.localStreamVideo && this.localMediaStream && !updates.get('localMediaStream')) {
            this.localStreamVideo.srcObject = this.localMediaStream;
        }

        if (this.remoteStreamVideo && this.remoteMediaStream && !updates.get('remoteMediaStream')) {
            this.remoteStreamVideo.srcObject = this.remoteMediaStream;
        }
    }

    async onStart (eventName: string) {
        this.communicationStart = true;
        this.dispatchEvent(new Event(eventName));
    }
    
    render() {
        return html`
            <button 
                ?disabled=${this.communicationStart} 
                @click=${() => this.onStart('listen-connection')}
            >
                Waiting for connection
            </button>

            <button 
                ?disabled=${this.communicationStart} 
                @click=${() => this.onStart('share-screen')}
            >
                Share screen
            </button>

            <button 
                ?disabled=${this.communicationStart} 
                @click=${() => this.onStart('run-camera')}
            >
                Run camera
            </button>

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
