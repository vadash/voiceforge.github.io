import { render } from 'preact';
import { IntlProvider } from 'preact-i18n';
import { App } from './App';
import ru from './i18n/ru.json';
import './styles/global.css';
import './styles/theme.css';
import './styles/responsive.css';

const root = document.getElementById('root');
if (root) {
  render(
    <IntlProvider definition={ru}>
      <App />
    </IntlProvider>,
    root
  );
}
