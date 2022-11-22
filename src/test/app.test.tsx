import { createStore } from 'src/store/create-store';
import { App } from 'src/components/App';
import { render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { Provider } from 'react-redux';
import {
  mockDropboxAccessToken,
  mockDropboxFilesDownload,
  mockDropboxListFolder,
  spyOnDropboxFilesUpload,
} from './fixtures';
import { $ } from 'src';
import { ensureExists } from 'src/utils';
import { FilesIndex } from 'src/logic/files-index';

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
    mockDropboxFilesDownload([]);

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
              <span
                class="listFileDisplayName"
              >
                My Cool Band
              </span>
            </a>
            <button
              aria-label="File Menu"
              class="listFilesFileMenu"
              type="button"
            >
              <span
                class="listFilesFileMenuIcon"
              />
            </button>
          </div>
          <div
            class="listFilesFile"
          >
            <a
              class="listFilesFileLink"
              href="/file/Clocks - Coldplay.chordpro"
            >
              <span
                class="listFilesIcon"
              >
                🎵
              </span>
              <span
                class="listFileDisplayName"
              >
                Clocks - Coldplay
                .
                <span
                  class="listFilesExtension"
                >
                  chordpro
                </span>
              </span>
            </a>
            <button
              aria-label="File Menu"
              class="listFilesFileMenu"
              type="button"
            >
              <span
                class="listFilesFileMenuIcon"
              />
            </button>
          </div>
          <div
            class="listFilesFile"
          >
            <a
              class="listFilesFileLink"
              href="/file/Mellow Yellow - Donovan.chordpro"
            >
              <span
                class="listFilesIcon"
              >
                🎵
              </span>
              <span
                class="listFileDisplayName"
              >
                Mellow Yellow - Donovan
                .
                <span
                  class="listFilesExtension"
                >
                  chordpro
                </span>
              </span>
            </a>
            <button
              aria-label="File Menu"
              class="listFilesFileMenu"
              type="button"
            >
              <span
                class="listFilesFileMenuIcon"
              />
            </button>
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

  it('creates a files index', async () => {
    jest.useFakeTimers();
    const store = createStore();
    mockDropboxAccessToken(store);
    mockDropboxListFolder([
      { type: 'folder', path: '/My Cool Band' },
      { type: 'file', path: '/Clocks - Coldplay.chordpro' },
      { type: 'file', path: '/Mellow Yellow - Donovan.chordpro' },
    ]);
    mockDropboxFilesDownload([]);
    const uploads = spyOnDropboxFilesUpload();

    render(
      <Provider store={store as any}>
        <App />
      </Provider>,
    );

    const filesIndex = await waitFor(() =>
      ensureExists($.getFilesIndex(store.getState())),
    );
    expect(filesIndex).toMatchInlineSnapshot(`
      FilesIndex {
        "data": Object {
          "files": Array [
            Object {
              "directives": Object {},
              "lastRevRead": null,
              "metadata": Object {
                "clientModified": "2022-01-01T00:00:00Z",
                "hash": "0cae1bd6b2d4686a6389c6f0f7f41d42c4ab406a6f6c2af4dc084f1363617331",
                "id": "id:2",
                "isDownloadable": false,
                "name": "Clocks - Coldplay.chordpro",
                "path": "/Clocks - Coldplay.chordpro",
                "rev": "0123456789abcdef0123456789abcde",
                "serverModified": "2022-05-01T00:00:00Z",
                "size": 3103,
                "type": "file",
              },
            },
            Object {
              "directives": Object {},
              "lastRevRead": null,
              "metadata": Object {
                "clientModified": "2022-01-01T00:00:00Z",
                "hash": "0cae1bd6b2d4686a6389c6f0f7f41d42c4ab406a6f6c2af4dc084f1363617332",
                "id": "id:3",
                "isDownloadable": false,
                "name": "Mellow Yellow - Donovan.chordpro",
                "path": "/Mellow Yellow - Donovan.chordpro",
                "rev": "0123456789abcdef0123456789abcde",
                "serverModified": "2022-05-01T00:00:00Z",
                "size": 3103,
                "type": "file",
              },
            },
          ],
          "version": 1,
        },
      }
    `);

    jest.advanceTimersByTime(FilesIndex.timeout * 2);

    await waitFor(() => expect(uploads).toHaveLength(1));
    const [{ path, body }] = uploads;
    expect(path).toEqual('/.index.json');
    expect(JSON.parse(body)).toMatchInlineSnapshot(`
      Object {
        "files": Array [
          Object {
            "directives": Object {},
            "lastRevRead": null,
            "metadata": Object {
              "clientModified": "2022-01-01T00:00:00Z",
              "hash": "0cae1bd6b2d4686a6389c6f0f7f41d42c4ab406a6f6c2af4dc084f1363617331",
              "id": "id:2",
              "isDownloadable": false,
              "name": "Clocks - Coldplay.chordpro",
              "path": "/Clocks - Coldplay.chordpro",
              "rev": "0123456789abcdef0123456789abcde",
              "serverModified": "2022-05-01T00:00:00Z",
              "size": 3103,
              "type": "file",
            },
          },
          Object {
            "directives": Object {},
            "lastRevRead": null,
            "metadata": Object {
              "clientModified": "2022-01-01T00:00:00Z",
              "hash": "0cae1bd6b2d4686a6389c6f0f7f41d42c4ab406a6f6c2af4dc084f1363617332",
              "id": "id:3",
              "isDownloadable": false,
              "name": "Mellow Yellow - Donovan.chordpro",
              "path": "/Mellow Yellow - Donovan.chordpro",
              "rev": "0123456789abcdef0123456789abcde",
              "serverModified": "2022-05-01T00:00:00Z",
              "size": 3103,
              "type": "file",
            },
          },
        ],
        "version": 1,
      }
    `);
  });
});
