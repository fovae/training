import { dismissIosHint, iosHintVisible } from '../../features/install';
import { Icon } from './Icon';

export function IosInstallSteps() {
  return (
    <ol class="steps">
      <li>
        Нажми{' '}
        <span class="kbd">
          <Icon name="share" size={16} /> Поделиться
        </span>{' '}
        в панели Safari.
      </li>
      <li>
        Выбери <b>«На экран „Домой“»</b> (если не видно — пролистай список вниз).
      </li>
      <li>
        Нажми <b>«Добавить»</b>. Приложение откроется на весь экран и будет работать офлайн.
      </li>
    </ol>
  );
}

/** Подсказка установки: один раз, только Safari на iOS, только вне standalone */
export function InstallHint() {
  if (!iosHintVisible.value) return null;
  return (
    <aside class="install-hint" aria-label="Установка на iPhone">
      <div class="install-hint-h">
        <b>Установи на экран «Домой»</b>
        <button
          type="button"
          class="icon-btn"
          aria-label="Закрыть подсказку навсегда"
          onClick={dismissIosHint}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <IosInstallSteps />
    </aside>
  );
}
