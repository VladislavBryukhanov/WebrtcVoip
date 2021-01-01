

import {html, render} from 'lit-html';

import './App';

const helloTemplate = (name: string) => html`<div>Hello ${name}!</div>`;
render(helloTemplate('test'), document.getElementById('root'));
 