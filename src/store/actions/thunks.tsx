import { Thunk } from 'src/@types';
import * as React from 'react';
import { $, T } from 'src';
import { dropboxErrorMessage, getDirName, getGeneration } from 'src/utils';
import * as Plain from './plain';
import { fixupFileMetadata, fixupMetadata } from 'src/logic/offline-db';

/**
 * This file contains all of the thunk actions, that contain extra logic,
 * such as conditional dispatches, and multiple async calls.
 */

const DEFAULT_MESSAGE_DELAY = 3000;

/**
 * Plain actions defined in thunks.tsx should either be APICalls, or internal.
 * These will all be collected on the global `T` export in `src`.
 */
export type PlainActions =
  // See PlainActions in src/@types/index.ts for details on this next line.
  T.Values<{
    [FnName in keyof typeof PlainInternal]: ReturnType<
      typeof PlainInternal[FnName]
    >;
  }>;

/**
 * These should only be used internally in thunks.
 */
namespace PlainInternal {
  export function addMessage(message: React.ReactNode, generation: number) {
    return { type: 'add-message' as const, message, generation };
  }

  export function dismissAllMessages() {
    return { type: 'dismiss-all-messages' as const };
  }

  export function listFilesRequested(path: string) {
    return { type: 'list-files-requested' as const, path };
  }

  export function listFilesReceived(
    path: string,
    files: Array<T.FileMetadata | T.FolderMetadata>,
  ) {
    return { type: 'list-files-received' as const, path, files };
  }

  export function listFilesError(path: string, error: string) {
    return { type: 'list-files-error' as const, path, error };
  }

  export function downloadFileRequested(path: string) {
    return { type: 'download-file-requested' as const, path };
  }

  export function downloadFileReceived(path: string, file: T.StoredTextFile) {
    return { type: 'download-file-received' as const, path, file };
  }

  export function downloadFileError(path: string, error: string) {
    return { type: 'download-file-error' as const, path, error };
  }

  export function downloadBlobRequested(path: string) {
    return { type: 'download-blob-requested' as const, path };
  }

  export function downloadBlobReceived(
    path: string,
    blobFile: T.StoredBlobFile,
  ) {
    return { type: 'download-blob-received' as const, path, blobFile };
  }
}

export function listFiles(path = ''): Thunk {
  return async (dispatch, getState) => {
    let dropboxPath = path;
    if (path === '/') {
      // Dropbox doesn't like the root `/`.
      dropboxPath = '';
    }

    dispatch(PlainInternal.listFilesRequested(path));

    const db = $.getOfflineDB(getState());
    if (db) {
      try {
        const offlineListing = await db.getFolderListing(path);
        if (offlineListing) {
          dispatch(PlainInternal.listFilesReceived(path, offlineListing.files));
        }
      } catch (error) {
        console.error('Error with indexeddb', error);
      }
    }

    try {
      const response = await $.getDropbox(getState()).filesListFolder({
        path: dropboxPath,
      });
      const files: Array<T.FileMetadata | T.FolderMetadata> = [];
      for (const entry of response.result.entries) {
        if (entry['.tag'] === 'file' || entry['.tag'] === 'folder') {
          files.push(fixupMetadata(entry));
        }
      }
      files.sort((a, b) => {
        // Sort folders first
        if (a.type === 'file' && b.type === 'folder') {
          return 1;
        }
        if (b.type === 'file' && a.type === 'folder') {
          return -1;
        }
        // Sort by file name second.
        return a.name.localeCompare(b.name);
      });
      dispatch(PlainInternal.listFilesReceived(path, files));
      if (db) {
        db.addFolderListing(path, files);
      }
    } catch (response) {
      dispatch(
        PlainInternal.listFilesError(path, dropboxErrorMessage(response)),
      );
    }
  };
}

export function downloadFile(path: string): Thunk {
  return async (dispatch, getState) => {
    dispatch(PlainInternal.downloadFileRequested(path));

    const handleFile = (file: T.StoredTextFile) => {
      dispatch(PlainInternal.downloadFileReceived(path, file));

      // For things like back and next, ensure we have a copy of the prev/next
      // songs in the folder.
      const listFilesCache = $.getListFilesCache(getState());
      const folder = getDirName(path);
      if (!listFilesCache.get(folder)) {
        dispatch(listFiles(folder));
      }
    };

    let offlineFile: T.FileRow | undefined;

    const db = $.getOfflineDB(getState());
    if (db) {
      try {
        offlineFile = await db.getFile(path);
        if (offlineFile?.type === 'text') {
          handleFile(offlineFile);
        }
      } catch (error) {
        console.error('Error with indexeddb', error);
      }
    }

    // Kick off the request, even if an offline version was found.
    try {
      const { result } = await $.getDropbox(getState()).filesDownload({ path });
      // The file blob was left off of this type.
      const fileBlob: Blob = (result as any).fileBlob;
      const metadata = fixupFileMetadata(result);
      if (offlineFile?.metadata.hash === metadata.hash) {
        // The files are the same.
        return;
      }

      let text;
      try {
        text = await fileBlob.text();
      } catch (error) {
        dispatch(
          PlainInternal.downloadFileError(
            path,
            'Failed to get the text from the downloaded file.',
          ),
        );
        return;
      }

      if (db) {
        db.addTextFile(metadata, text);
      }

      handleFile({
        metadata,
        storedAt: new Date(),
        type: 'text',
        text,
      });
    } catch (response) {
      let error;
      if ((response as any)?.error?.error?.path['.tag'] === 'not_found') {
        error = 'The file does not exist. ' + path;
      } else {
        error = dropboxErrorMessage(response);
      }
      dispatch(PlainInternal.downloadFileError(path, error));
    }
  };
}

export function downloadBlob(path: string): Thunk {
  return async (dispatch, getState) => {
    dispatch(PlainInternal.downloadBlobRequested(path));

    const handleBlob = (blobFile: T.StoredBlobFile) => {
      dispatch(PlainInternal.downloadBlobReceived(path, blobFile));

      // For things like back and next, ensure we have a copy of the prev/next
      // songs in the folder.
      const cache = $.getListFilesCache(getState());
      const folder = getDirName(path);
      if (!cache.get(folder)) {
        dispatch(listFiles(folder));
      }
    };

    const db = $.getOfflineDB(getState());
    if (db) {
      try {
        const file = await db.getFile(path);
        if (file?.type === 'blob') {
          handleBlob(file);
        }
      } catch (error) {
        console.error('Error with indexeddb', error);
      }
    }

    try {
      const response = await $.getDropbox(getState()).filesDownload({ path });
      const file = response.result;
      const blob = (file as any).fileBlob;
      const metadata = fixupFileMetadata(file);
      const value: T.StoredBlobFile = {
        metadata,
        storedAt: new Date(),
        type: 'blob',
        blob,
      };

      handleBlob(value);

      if (db) {
        db.addBlobFile(metadata, blob);
      }
    } catch (error) {
      dispatch(
        PlainInternal.downloadFileError(path, dropboxErrorMessage(error)),
      );
    }
  };
}

export function saveFile(path: string, text: string): Thunk {
  return async (dispatch, getState) => {
    const dropbox = $.getDropbox(getState());

    const messageGeneration = dispatch(
      addMessage({
        message: (
          <>
            Saving <code>{path}</code>
          </>
        ),
      }),
    );
    try {
      const { result } = await dropbox.filesUpload({
        path,
        contents: text,
        mode: {
          '.tag': 'overwrite',
        },
      });
      dispatch(
        PlainInternal.downloadFileReceived(path, {
          metadata: fixupFileMetadata(result),
          storedAt: new Date(),
          type: 'text',
          text,
        }),
      );
      dispatch(
        addMessage({
          message: (
            <>
              Saved <code>{path}</code>
            </>
          ),
          generation: messageGeneration,
          timeout: true,
        }),
      );

      // Save the updated file to the offline db.
      const db = $.getOfflineDB(getState());
      if (db) {
        await db.addTextFile(fixupFileMetadata(result), text);
      }
      return result;
    } catch (error) {
      dispatch(
        addMessage({
          message: (
            <>
              Unable to save <code>{path}</code>
            </>
          ),
          generation: messageGeneration,
        }),
      );
      console.error(error);
      return Promise.reject(new Error('Unable to save the file with Dropbox.'));
    }
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
    dispatch(PlainInternal.addMessage(message, generation));
    if (timeout) {
      setTimeout(
        () => {
          dispatch(Plain.dismissMessage(generation));
        },
        typeof timeout === 'number' ? timeout : DEFAULT_MESSAGE_DELAY,
      );
    }
    return generation;
  };
}

export function dismissAllMessages(): Thunk {
  return (dispatch, getState) => {
    const messages = $.getMessages(getState());
    if (messages.length > 0) {
      dispatch(PlainInternal.dismissAllMessages());
    }
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
    dispatch(
      Plain.setDropboxAccessToken(oauth.accessToken, 0, oauth.refreshToken),
    );
  };
}

export function createInitialFiles(): Thunk<Promise<void>> {
  return async (dispatch, getState) => {
    const dropbox = $.getDropbox(getState());
    const files = ['Getting started.chopro'];
    let hasFailure = false;
    let dropboxError: string = '';

    for (const file of files) {
      // Load the file locally first.
      let contents: string;
      try {
        const response = await fetch('/guide/' + file);
        contents = await response.text();
      } catch (error) {
        hasFailure = true;
        console.error(error);
        continue;
      }

      // Upload it Dropbox.
      try {
        await dropbox.filesUpload({
          path: '/' + file,
          contents,
          mode: { '.tag': 'add' },
        });
      } catch (error) {
        console.error(error);
        hasFailure = true;
        dropboxError = dropboxErrorMessage(error);
      }
    }
    if (hasFailure) {
      dispatch(
        addMessage({
          message: `Could not create the initial demo files. ${dropboxError}`,
        }),
      );
    }
    dispatch(Plain.invalidatePath('/'));
  };
}
