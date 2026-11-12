import { render } from 'preact';
import '@fontsource-variable/manrope/wght.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/features.css';
import './styles/layout.css';

import { App } from './ui/App';
import { initApp } from './state/app';
import { installAudioUnlock } from './features/audio';
import { installWakeLock } from './features/wakelock';
import { initInstallPrompt } from './features/install';
import { initSW } from './features/update';

initInstallPrompt();
installAudioUnlock();

render(<App />, document.getElementById('app')!);
void initApp().then(() => installWakeLock());
void initSW();
