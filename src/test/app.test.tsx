import { createStore } from 'src/store/create-store';
import { App } from 'src/components/App';
import { render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { Provider } from 'react-redux';
import { mockDropboxAccessToken, mockDropboxListFolder } from './fixtures';

describe('app', () => {
  it('can render', async () => {
    const store = createStore();
    const { container } = render(
      <Provider store={store as any}>
        <App />
      </Provider>,
    );

    await waitFor(() => screen.getByText(/Browser Chords/));

    expect(container.firstChild).toMatchSnapshot();
  });

  it('can list files', async () => {
    const store = createStore();
    mockDropboxAccessToken(store);
    mockDropboxListFolder([
      { type: 'folder', path: '/My Cool Band' },
      { type: 'file', path: '/Clocks - Coldplay.chordpro' },
      { type: 'file', path: '/Mellow Yellow - Donovan.chordpro' },
    ]);

    render(
      <Provider store={store as any}>
        <App />
      </Provider>,
    );

    await waitFor(() => screen.getByText(/Coldplay/));
    await waitFor(() => screen.getByText(/Mellow Yellow/));

    const listFiles = screen.getByTestId('list-files');

    expect(listFiles).toMatchInlineSnapshot(`
      <div
        class="listFiles"
        data-testid="list-files"
      >
        <div
          class="listFilesFilter"
        >
          <input
            class="listFilesFilterInput"
            placeholder="Filter files"
            type="text"
          />
        </div>
        <div
          class="listFilesList"
        >
          <div
            class="listFilesFile"
          >
            <a
              class="listFilesFileLink"
              href="/folder/My Cool Band"
            >
              <span
                class="listFilesIcon"
              >
                📁
              </span>
              My Cool Band
            </a>
          </div>
          <div
            class="listFilesFile"
          >
            <div
              class="listFilesFileEmpty"
            >
              <span
                class="listFilesIcon"
              >
                📄
              </span>
              Clocks - Coldplay
              .
              <span
                class="listFilesExtension"
              >
                chordpro
              </span>
            </div>
          </div>
          <div
            class="listFilesFile"
          >
            <div
              class="listFilesFileEmpty"
            >
              <span
                class="listFilesIcon"
              >
                📄
              </span>
              Mellow Yellow - Donovan
              .
              <span
                class="listFilesExtension"
              >
                chordpro
              </span>
            </div>
          </div>
          <button
            class="button listFilesCreate"
            type="button"
          >
            Create ChordPro File
          </button>
        </div>
      </div>
    `);
  });
});
