import * as React from 'react';
import { Provider } from 'react-redux';
import { createStore } from './store/create-store';
import * as T from 'src/@types';
import { App } from 'src/components/App';
import { maybeMockGoogleAnalytics } from 'src/utils';
import { createRoot } from 'react-dom/client';

import * as A from 'src/store/actions';
import * as $ from 'src/store/selectors';
import { openIDBFS } from './logic/file-system/indexeddb-fs';

export * as A from 'src/store/actions';
export * as $ from 'src/store/selectors';
export * as T from 'src/@types';
export * as Hooks from 'src/hooks';

if (process.env.NODE_ENV !== 'test') {
  init().catch((error) => {
    console.error('Error during initialization', error);
  });
}

export async function init(): Promise<void> {
  maybeMockGoogleAnalytics();
  initServiceWorker();

  const store = createStore();

  Object.assign(window as any, {
    store,
    dispatch: store.dispatch,
    getState: store.getState,
    $,
    A,
    expireOauth() {
      const oauth = $.getDropboxOauth(store.getState());
      if (!oauth) {
        return;
      }
      store.dispatch(
        A.setDropboxAccessToken(oauth.accessToken, 0, oauth.refreshToken),
      );
    },
  });

  const cachePromise = $.getCurrentFSOrNull(store.getState())?.cachePromise;
  if (cachePromise) {
    await cachePromise;
  }
  const ipdbfs = await openIDBFS('browser-files');
  store.dispatch(A.connectIDBFS(ipdbfs));

  mountReact(store);
}

export function createRootApp(store: T.Store): JSX.Element {
  return (
    <Provider store={store as any}>
      <App key="app" />
    </Provider>
  );
}

function mountReact(store: T.Store): void {
  const mountElement = document.createElement('div');
  mountElement.className = 'appRoot';
  const body = document.body;
  if (!body) {
    throw new Error(
      'Attempting to mount the <App> React component but no document body was found.',
    );
  }
  body.appendChild(mountElement);
  const root = createRoot(mountElement);
  root.render(createRootApp(store));
}

function initServiceWorker() {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test'
  ) {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  window.addEventListener('load', async () => {
    try {
      const registration =
        await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service worker registered: ', registration);
    } catch (error) {
      console.log('Service worker registration failed:', error);
    }
  });
}
