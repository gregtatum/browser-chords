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
import { $, T } from 'src';
import { ensureExists } from 'src/utils';
import { FilesIndex } from 'src/logic/files-index';
import { stripIndent } from 'common-tags';
import type { FetchMockSandbox } from 'fetch-mock';

const coldplayChordProText = stripIndent`
  {title: Clocks}
  {artist: Coldplay}
  {key: Ebmaj}

  [D]Lights go out and I ca[Am]n't be saved
  tides that I tried to sw[Em]im against
`;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  // Clears dropbox refresh token timeouts.
  jest.clearAllTimers();
  (window.fetch as FetchMockSandbox).restore();
});

describe('App', () => {
  function setup() {
    const store = createStore();
    mockDropboxAccessToken(store);
    const listFiles = mockDropboxListFolder([
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

    /**
     * A test utility to ge the file metadata from the current state.
     */
    function getFileMetadata(path: string): T.FileMetadata {
      const file = ensureExists(
        listFiles.find((file) => file.path === path),
        'Failed to find the file.',
      );
      if (file.type !== 'file') {
        throw new Error('Found a folder not a file.');
      }
      return file;
    }

    return { store, getFileMetadata };
  }

  it('can list files', async () => {
    setup();
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
            placeholder="Search"
            type="text"
            value=""
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
    const { store } = setup();

    const uploads = spyOnDropboxFilesUpload();
    const filesIndex = await waitFor(() =>
      ensureExists($.getFilesIndex(store.getState())),
    );

    expect(filesIndex).toMatchInlineSnapshot(`
      FilesIndex {
        "data": {
          "files": [
            {
              "directives": {},
              "lastRevRead": null,
              "metadata": {
                "clientModified": "2022-01-01T00:00:00Z",
                "hash": "0cae1bd6b2d4686a6389c6f0f7f41d42c4ab406a6f6c2af4dc084f1363617331",
                "id": "id:CREATEFILEMETADATAREFERENCE2",
                "isDownloadable": false,
                "name": "Clocks - Coldplay.chordpro",
                "path": "/Clocks - Coldplay.chordpro",
                "rev": "0123456789abcdef0123456789abcde",
                "serverModified": "2022-05-01T00:00:00Z",
                "size": 3103,
                "type": "file",
              },
            },
            {
              "directives": {},
              "lastRevRead": null,
              "metadata": {
                "clientModified": "2022-01-01T00:00:00Z",
                "hash": "0cae1bd6b2d4686a6389c6f0f7f41d42c4ab406a6f6c2af4dc084f1363617332",
                "id": "id:CREATEFILEMETADATAREFERENCE3",
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
      {
        "files": [
          {
            "directives": {},
            "lastRevRead": null,
            "metadata": {
              "clientModified": "2022-01-01T00:00:00Z",
              "hash": "0cae1bd6b2d4686a6389c6f0f7f41d42c4ab406a6f6c2af4dc084f1363617331",
              "id": "id:CREATEFILEMETADATAREFERENCE2",
              "isDownloadable": false,
              "name": "Clocks - Coldplay.chordpro",
              "path": "/Clocks - Coldplay.chordpro",
              "rev": "0123456789abcdef0123456789abcde",
              "serverModified": "2022-05-01T00:00:00Z",
              "size": 3103,
              "type": "file",
            },
          },
          {
            "directives": {},
            "lastRevRead": null,
            "metadata": {
              "clientModified": "2022-01-01T00:00:00Z",
              "hash": "0cae1bd6b2d4686a6389c6f0f7f41d42c4ab406a6f6c2af4dc084f1363617332",
              "id": "id:CREATEFILEMETADATAREFERENCE3",
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

  it('will index directives when viewing a file', async () => {
    const { store, getFileMetadata } = setup();

    const filesIndex = await waitFor(() =>
      ensureExists($.getFilesIndex(store.getState())),
    );

    const coldplay = await waitFor(() => screen.getByText(/Coldplay/));

    // The file has not been viewed yet.
    expect(
      filesIndex.getFileByPath('/Clocks - Coldplay.chordpro')?.directives,
    ).toEqual({});

    mockDropboxFilesDownload([
      {
        metadata: getFileMetadata('/Clocks - Coldplay.chordpro'),
        text: coldplayChordProText,
      },
    ]);

    coldplay.click();
    await waitFor(() => screen.getByText(/Lights go out and/));

    expect(
      filesIndex.getFileByPath('/Clocks - Coldplay.chordpro')?.directives,
    ).toEqual({
      artist: 'Coldplay',
      key: 'Ebmaj',
      title: 'Clocks',
    });
  });

  it('will index directives when viewing already viewing a file', async () => {
    const { store, getFileMetadata } = setup();
    mockDropboxFilesDownload([
      {
        metadata: getFileMetadata('/Clocks - Coldplay.chordpro'),
        text: coldplayChordProText,
      },
    ]);

    const coldplay = await waitFor(() => screen.getByText(/Coldplay/));

    coldplay.click();
    await waitFor(() => screen.getByText(/Lights go out and/));

    const filesIndex = await waitFor(() =>
      ensureExists($.getFilesIndex(store.getState())),
    );

    // The file index should already be up to date.
    expect(
      filesIndex.getFileByPath('/Clocks - Coldplay.chordpro')?.directives,
    ).toEqual({
      artist: 'Coldplay',
      key: 'Ebmaj',
      title: 'Clocks',
    });
  });
});
