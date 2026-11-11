import { render } from 'preact';
import '@fontsource-variable/manrope/wght.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/layout.css';

import { App } from './ui/App';
import { initWorkouts } from './state/workout';
import { installAudioUnlock } from './features/audio';
import { installWakeLock } from './features/wakelock';
import { initInstallPrompt, initIosHint } from './features/install';
import { initSW } from './features/update';

initInstallPrompt();
initIosHint();
installAudioUnlock();

void initWorkouts().then(() => installWakeLock());
void initSW();

render(<App />, document.getElementById('app')!);
