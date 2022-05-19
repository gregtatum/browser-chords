import { Action, Thunk } from 'src/@types';
import * as React from 'react';
import { $, T } from 'src';
import { getGeneration, getProp } from 'src/utils';
import type { files } from 'dropbox';
import NoSleep from 'nosleep.js';

const DEFAULT_MESSAGE_DELAY = 3000;

export function setDropboxAccessToken(
  accessToken: string,
  expiresIn: number,
  refreshToken: string,
): Action {
  const expires =
    Date.now() + expiresIn * 1000 - 5 * 60 * 1000; /* subtract five minutes */

  const oauth: T.DropboxOauth = {
    accessToken,
    expires,
    refreshToken,
  };
  window.localStorage.setItem('dropboxOauth', JSON.stringify(oauth));

  return {
    type: 'set-dropbox-oauth',
    oauth,
  };
}

export function removeDropboxAccessToken(): Action {
  localStorage.clear();
  return { type: 'remove-dropbox-oauth' };
}

export function listFiles(path = ''): Thunk {
  return (dispatch, getState) => {
    let dropboxPath = path;
    if (path === '/') {
      // Dropbox doesn't like the root `/`.
      dropboxPath = '';
    }
    const generation = getGeneration();
    const args = { path };
    dispatch({ type: 'list-files-requested', generation, args });
    $.getDropbox(getState())
      .filesListFolder({ path: dropboxPath })
      .then((response) => {
        const value: Array<
          files.FileMetadataReference | files.FolderMetadataReference
        > = [];
        for (const entry of response.result.entries) {
          if (entry['.tag'] === 'file' || entry['.tag'] === 'folder') {
            value.push(entry);
          }
        }
        value.sort((a, b) => {
          // Sort folders first
          if (a['.tag'] === 'file' && b['.tag'] === 'folder') {
            return 1;
          }
          if (b['.tag'] === 'file' && a['.tag'] === 'folder') {
            return -1;
          }
          // Sort by file name second.
          return a.name.localeCompare(b.name);
        });
        dispatch({
          type: 'list-files-received',
          generation,
          args,
          value,
        });
      })
      .catch((error) => {
        const cache = $.getListFilesCache(getState()).get(path);

        dispatch({
          type: 'list-files-failed',
          generation,
          args,
          value:
            cache?.type === 'list-files-received' ||
            cache?.type === 'list-files-failed'
              ? cache.value
              : undefined,
          error: getProp(error, 'message') ?? 'There was a Dropbox API error',
        });
      });
  };
}

export function downloadFile(path: string): Thunk {
  return (dispatch, getState) => {
    const generation = getGeneration();
    const args = { path };
    dispatch({ type: 'download-file-requested', generation, args });
    $.getDropbox(getState())
      .filesDownload({ path })
      .then(async ({ result }) => {
        const { fileBlob } = result as T.DownloadFileResponse;
        // The file blob was left off of this type.
        delete (result as any).fileBlob;
        const value: T.DownloadedTextFile = {};
        value.metadata = result;
        try {
          value.text = await fileBlob.text();
        } catch (error) {
          value.error = error;
        }
        const action: T.Action = {
          type: 'download-file-received',
          generation,
          args,
          value,
        };
        dispatch(action);
      })
      .catch((error) => {
        const cache = $.getDownloadFileCache(getState()).get(path);
        const action: T.Action = {
          type: 'download-file-failed',
          generation,
          args,
          value:
            cache?.type === 'download-file-received' ||
            cache?.type === 'download-file-failed'
              ? cache.value
              : undefined,
          error:
            error?.message ??
            error?.toString() ??
            'There was a Dropbox API error',
        };
        dispatch(action);
      });
  };
}

export function downloadBlob(path: string): Thunk {
  return (dispatch, getState) => {
    const generation = getGeneration();
    const args = { path };
    dispatch({ type: 'download-blob-requested', generation, args });
    $.getDropbox(getState())
      .filesDownload({ path })
      .then(async (response) => {
        const file = response.result as T.DownloadFileResponse;
        const value: T.DownloadedBlob = {};
        try {
          value.fileBlob = file.fileBlob;
        } catch (error) {
          value.error = error;
        }
        const action: T.Action = {
          type: 'download-blob-received',
          generation,
          args,
          value,
        };
        dispatch(action);
      })
      .catch((error) => {
        const cache = $.getDownloadFileCache(getState()).get(path);
        const action: T.Action = {
          type: 'download-blob-failed',
          generation,
          args,
          value:
            cache?.type === 'download-file-received' ||
            cache?.type === 'download-file-failed'
              ? cache.value
              : undefined,
          error:
            error?.message ??
            error?.toString() ??
            'There was a Dropbox API error',
        };
        dispatch(action);
      });
  };
}

export function draggingSplitter(isDragging: boolean): Action {
  return { type: 'dragging-splitter', isDragging };
}

export function clearApiCache(): Action {
  return { type: 'clear-api-cache' };
}

export function changeActiveFile(path: string): Action {
  return { type: 'change-active-file', path };
}

export function modifyActiveFile(modifiedText: string): Action {
  return { type: 'modify-active-file', modifiedText };
}

export function viewListFiles(path: string): Action {
  return { type: 'view-list-files', path };
}

export function viewFile(path: string): Action {
  return { type: 'view-file', path };
}

export function viewPDF(path: string): Action {
  return { type: 'view-pdf', path };
}

export function viewLinkDropbox(): Action {
  return { type: 'view-link-dropbox' };
}

export function viewSettings(): Action {
  return { type: 'view-settings' };
}

export function viewPrivacy(): Action {
  return { type: 'view-privacy' };
}

export function saveFile(
  pathLowercase: string,
  contents: string,
  originalFileRequest: T.APICalls.DownloadFile,
): Thunk {
  return async (dispatch, getState) => {
    const dropbox = $.getDropbox(getState());
    if (originalFileRequest.type === 'download-file-requested') {
      throw new Error('Logic error, the download file is being requested');
    }
    const savePath =
      originalFileRequest.value?.metadata?.path_display ?? pathLowercase;

    const messageGeneration = dispatch(
      addMessage({
        message: (
          <>
            Saving <code>{savePath}</code>
          </>
        ),
      }),
    );
    return dropbox
      .filesUpload({
        path: savePath,
        contents,
        mode: {
          '.tag': 'overwrite',
        },
      })
      .then(
        () => {
          dispatch({
            type: 'download-file-received',
            generation: originalFileRequest.generation,
            args: originalFileRequest.args,
            value: {
              text: contents,
            },
          });
          dispatch(
            addMessage({
              message: (
                <>
                  Saved <code>{savePath}</code>
                </>
              ),
              generation: messageGeneration,
              timeout: true,
            }),
          );
        },
        (error) => {
          dispatch(
            addMessage({
              message: (
                <>
                  Unable to save <code>{savePath}</code>
                </>
              ),
              generation: messageGeneration,
            }),
          );
          console.error(error);
          return Promise.reject(
            new Error('Unable to save the file with Dropbox.'),
          );
        },
      );
  };
}

interface MessageArgs {
  message: React.ReactNode;
  // A unique generation number to identify a message, useful if
  // the message needs dismissing or can be replaced.
  generation?: number;
  // If a number, the number of milliseconds before hiding.
  // If `true`, then use the default delay.
  // If falsey, do not auto-hide the message.
  timeout?: number | boolean;
}

export function addMessage({
  message,
  generation = getGeneration(),
  timeout = false,
}: MessageArgs): Thunk<number> {
  return (dispatch) => {
    dispatch({
      type: 'add-message',
      message,
      generation,
    });
    if (timeout) {
      setTimeout(
        () => {
          dispatch(dismissMessage(generation));
        },
        typeof timeout === 'number' ? timeout : DEFAULT_MESSAGE_DELAY,
      );
    }
    return generation;
  };
}

export function dismissMessage(generation: number): T.Action {
  return {
    type: 'dismiss-message',
    generation,
  };
}

export function dismissAllMessages(): Thunk {
  return (dispatch, getState) => {
    const messages = $.getMessages(getState());
    if (messages.length > 0) {
      dispatch({
        type: 'dismiss-all-messages',
      });
    }
  };
}

export function hideEditor(flag: boolean): Action {
  return {
    type: 'hide-editor',
    flag,
  };
}

let _noSleep: NoSleep | undefined;
export function keepAwake(flag: boolean): Thunk {
  return (dispatch) => {
    if (!_noSleep) {
      _noSleep = new NoSleep();
    }
    if (flag === _noSleep.isEnabled) {
      return;
    }
    if (flag) {
      _noSleep.enable();
    } else {
      _noSleep.disable();
    }
    dispatch({ type: 'keep-awake', flag });
  };
}

/**
 * This is useful for testing purposes from the command line.
 *
 * dispatch($.forceExpiration())
 */
export function forceExpiration(): Thunk {
  return (dispatch, getState) => {
    const oauth = $.getDropboxOauth(getState());
    if (!oauth) {
      return;
    }
    dispatch(setDropboxAccessToken(oauth.accessToken, 0, oauth.refreshToken));
  };
}
