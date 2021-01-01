import {customElement, html, LitElement} from 'lit-element';

@customElement('my-element')
export class App extends LitElement {
    render() {
        return html`<h1>HelloWorld</h1>`
    }
}
