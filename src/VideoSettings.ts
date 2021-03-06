import {css, customElement, html, LitElement, property} from 'lit-element';

@customElement('video-settings')
export class Settings extends LitElement {
    screenWidth = window.screen.availWidth;
    scale = 100;

    @property()
    isSettingsOpen?: boolean;

    @property()
    widthResolution = this.screenWidth;

    static get styles() {
        return css`
            .settings-block {
                display: inline-flex;
                align-items: flex-end;
            }
            .resolution-settings {
                width: 24vw;
            }
            .resolution-info {
                display: flex;
                justify-content: space-between;
            }
            .active-value {
                color: var(--mdc-theme-secondary);
                font-weight: 500;
            }
            mwc-slider {
                width: 100%;
            }
            mwc-fab {
                margin: 1vw;
            }
        `;
    }

    onResolutionUpdated(event: Event) {
        this.scale = parseInt((<HTMLInputElement>event.target)['value']);
        this.widthResolution = Math.floor(this.screenWidth * (this.scale / 100));

        const customEvent = new CustomEvent('setHorizontalResolution', {
            detail: {message: this.widthResolution}
        });
        this.dispatchEvent(customEvent);
    }

    renderSettings() {
        if (this.isSettingsOpen) {
            return html`
                <div class="resolution-settings">
                    <div class="resolution-info">
                        <span>Horizontal resolution of video:</span>
                        <span class="active-value">${this.widthResolution}</span>
                    </div>
                    <mwc-slider
                        pin
                        markers 
                        step="5"
                        min="5" 
                        max="100"
                        value=${this.scale}
                        @change=${this.onResolutionUpdated}
                    ></mwc-slider>
                </div>
            `;
        }
    }
    
    render() {
        return html`
            <div class="settings-block">
                <mwc-fab icon="settings" @click=${() => this.isSettingsOpen = !this.isSettingsOpen}></mwc-fab>
                ${this.renderSettings()}
            </div>
        `;
    }
}