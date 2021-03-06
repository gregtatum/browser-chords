import { A, T } from 'src';
import { type files } from 'dropbox';
import { ensureExists, UnhandledCaseError } from '../utils';
import type { FetchMockSandbox } from 'fetch-mock';

export function createMetadata(name: string, path: string): T.FileMetadata {
  return {
    type: 'file',
    name,
    path,
    id: 'id:AAAAAAAAAAAAAAAAAAAAAA',
    clientModified: '2022-05-08T15:20:46Z',
    serverModified: '2022-05-15T13:31:17Z',
    rev: '0123456789abcdef0123456789abcde',
    size: 3103,
    isDownloadable: true,
    hash: '0cae1bd6b2d4686a6389c6f0f7f41d42c4ab406a6f6c2af4dc084f1363617336',
  };
}

type MockedListFolderItem = {
  type: 'file' | 'folder';
  path: string;
};

export function mockDropboxListFolder(items: MockedListFolderItem[]) {
  (window.fetch as FetchMockSandbox)
    .catch(404)
    .mock('https://api.dropboxapi.com/2/files/list_folder', () => {
      return createListFolderResponse(items);
    });
}

export function createListFolderResponse(
  items: MockedListFolderItem[],
): Response {
  const entries: Array<
    files.FileMetadataReference | files.FolderMetadataReference
  > = [];
  const response = {
    entries,
    cursor: 'FAKE_CURSOR',
    has_more: false,
  };

  for (const { type, path } of items) {
    switch (type) {
      case 'file':
        entries.push(createFileMetadataReference(path));
        break;
      case 'folder':
        entries.push(createFolderMetadataReference(path));
        break;
      default:
        throw new UnhandledCaseError(type, 'file | folder');
    }
  }

  return new Response(JSON.stringify(response), { status: 200 });
}

export function createFileMetadataReference(
  path: string,
): files.FileMetadataReference {
  const parts = path.split('/');
  return {
    '.tag': 'file',
    name: ensureExists(parts.pop()),
    path_lower: path.toLowerCase(),
    path_display: path,
    id: 'id:' + getTestGeneration('id'),
    client_modified: '2022-01-01T00:00:00Z',
    server_modified: '2022-05-01T00:00:00Z',
    rev: '0123456789abcdef0123456789abcde',
    size: 3103,
    content_hash:
      '0cae1bd6b2d4686a6389c6f0f7f41d42c4ab406a6f6c2af4dc084f136361733' +
      getTestGeneration('content_hash'),
  };
}

export function createFolderMetadataReference(
  path: string,
): files.FolderMetadataReference {
  const parts = path.split('/');
  return {
    '.tag': 'folder',
    name: ensureExists(parts.pop()),
    path_lower: path.toLowerCase(),
    path_display: path,
    id: 'id:' + getTestGeneration('id'),
  };
}

export function mockDropboxAccessToken(store: T.Store) {
  const accessToken = 'faketoken';
  const expiresIn = Infinity;
  const refreshToken = 'refreshToken';
  store.dispatch(A.setDropboxAccessToken(accessToken, expiresIn, refreshToken));
}

let generations = new Map();
export function getTestGeneration(name: string) {
  const generation = (generations.get(name) ?? 0) + 1;
  generations.set(name, generation);
  return generation;
}

export function resetTestGeneration() {
  generations = new Map();
}
