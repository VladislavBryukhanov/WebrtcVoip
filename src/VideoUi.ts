import {LitElement, customElement, html, property, query, css} from 'lit-element';
import {ifDefined} from 'lit-html/directives/if-defined';

enum ViewViews {
    REMOTE = 'remote',
    LOCAL = 'local',
}

@customElement('video-ui')
export class VideoUi extends LitElement {
    @property()
    communicationStart: boolean = false;
    @property()
    feedbackMessage: string;
    @property()
    primaryVideoView: ViewViews = ViewViews.REMOTE;

    @property()
    localMediaStream?: MediaStream;
    @property()
    remoteMediaStream?: MediaStream;

    @query('#local-stream-view')
    localStreamVideo?: HTMLVideoElement;
    @query('#remote-stream-view')
    remoteStreamVideo?: HTMLVideoElement;

    static get styles() {
        return css`
            mwc-button {
                margin: 1vw 1vw 1vw 0;
            }
            video {
                border-radius: 12px;
                box-shadow: 8px 7px 16px -7px;
                min-width: 320px;
                max-height: 52vh;
            }
            .secondary-view {
                position: absolute;
                z-index: 1;
                cursor: pointer;
                border: 2px solid white;
                min-width: 100px;
                max-height: 12vh;
                max-width: 15vw;
            }
            .video-view-area {
                max-height: 60vh;
                width: 100%;
                display: flex;
                justify-content: center;
                margin-top: 4vh;
            }
            .actions {
                margin-top: 4vh;
            }
        `;
    }

    updated(updates: Map<string, MediaStream | HTMLVideoElement | string>) {
        if (this.localStreamVideo && this.localMediaStream && !updates.get('localMediaStream')) {
            this.localStreamVideo.srcObject = this.localMediaStream;
        }

        if (this.remoteStreamVideo && this.remoteMediaStream && !updates.get('remoteMediaStream')) {
            this.remoteStreamVideo.srcObject = this.remoteMediaStream;
        }
    }

    async onStart(eventName: string) {
        this.communicationStart = true;
        this.dispatchEvent(new Event(eventName));
    }

    onSwitchPrimaryView(target: ViewViews) {
        if (target !== this.primaryVideoView) {
            this.primaryVideoView = target;
        }
    }
    
    render() {
        return html`
            ${this.feedbackMessage && html`<div>
                <hr>
                ${this.feedbackMessage}
                <hr>
            </div>`}

            <div class="video-view-area">
                ${this.remoteMediaStream && html`
                    <video 
                        id="remote-stream-view" 
                        autoplay 
                        class=${ifDefined(this.primaryVideoView !== ViewViews.REMOTE && 'secondary-view')}
                        @click=${() => this.onSwitchPrimaryView(ViewViews.REMOTE)}
                    ></video>
                `}

                ${this.localMediaStream && html`
                    <video 
                        id="local-stream-view" 
                        autoplay 
                        muted 
                        class=${ifDefined(this.primaryVideoView !== ViewViews.LOCAL && !!this.remoteMediaStream && 'secondary-view')}
                        @click=${() => this.onSwitchPrimaryView(ViewViews.LOCAL)}
                    ></video>
                `}
            </div>

            <div class="actions">
                <mwc-button
                    extended
                    icon="meeting_room"
                    label="incoming Video call"
                    ?disabled=${this.communicationStart} 
                    @click=${() => this.onStart('listen-connection')}
                ></mwc-button>

                <mwc-button 
                    extended
                    label="Share Screen"
                    icon="screen_share"
                    ?disabled=${this.communicationStart} 
                    @click=${() => this.onStart('share-screen')}
                ></mwc-button >

                <mwc-button 
                    extended
                    icon="video_camera_front"
                    label="Video Call" 
                    ?disabled=${this.communicationStart} 
                    @click=${() => this.onStart('run-camera')}
                ></mwc-button>
            </div>
        `;
    }
}
