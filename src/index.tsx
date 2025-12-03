import { render } from 'preact';
import { IntlProvider } from 'preact-i18n';
import { App } from './App';
import { StoreProvider, createStores, initializeStores } from './stores';
import { ServiceProvider, createProductionContainer } from './di';
import en from './i18n/en.json';
import './styles/global.css';
import './styles/theme.css';
import './styles/responsive.css';

// Create stores and container
const stores = createStores();
const container = createProductionContainer();

// Initialize app
async function init() {
  // Load persisted state
  await initializeStores(stores);

  const root = document.getElementById('root');
  if (root) {
    render(
      <ServiceProvider container={container}>
        <StoreProvider stores={stores}>
          <IntlProvider definition={en}>
            <App />
          </IntlProvider>
        </StoreProvider>
      </ServiceProvider>,
      root
    );
  }
}

init().catch(console.error);
