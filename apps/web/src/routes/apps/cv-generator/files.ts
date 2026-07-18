import { parseCvFile, safeFilename, type CvDocument } from './model';

type WritableHandle = {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
};

type PickerWindow = Window &
  typeof globalThis & {
    showOpenFilePicker?: (options: object) => Promise<WritableHandle[]>;
    showSaveFilePicker?: (options: object) => Promise<WritableHandle>;
  };

export type OpenedCv = { document: CvDocument; handle: WritableHandle | null; filename: string };
export type SavedCv = { handle: WritableHandle | null; filename: string };

const pickerOptions = {
  types: [
    {
      description: 'e7g.eu CV document',
      accept: { 'application/json': ['.json'] },
    },
  ],
  excludeAcceptAllOption: false,
};

export function supportsWritableFiles(): boolean {
  const pickerWindow = window as PickerWindow;
  return Boolean(pickerWindow.showOpenFilePicker && pickerWindow.showSaveFilePicker);
}

export async function openCv(): Promise<OpenedCv | null> {
  const pickerWindow = window as PickerWindow;
  if (pickerWindow.showOpenFilePicker) {
    try {
      const [handle] = await pickerWindow.showOpenFilePicker(pickerOptions);
      if (!handle) return null;
      const file = await handle.getFile();
      return { document: parseCvFile(await file.text()), handle, filename: handle.name };
    } catch (error) {
      if (isAbort(error)) return null;
      throw error;
    }
  }
  const file = await chooseFile();
  if (!file) return null;
  return { document: parseCvFile(await file.text()), handle: null, filename: file.name };
}

export async function saveCv(
  document: CvDocument,
  currentHandle: WritableHandle | null,
  saveAs = false,
): Promise<SavedCv | null> {
  const pickerWindow = window as PickerWindow;
  let handle = saveAs ? null : currentHandle;
  if (!handle && pickerWindow.showSaveFilePicker) {
    try {
      handle = await pickerWindow.showSaveFilePicker({
        ...pickerOptions,
        suggestedName: safeFilename(document.title),
      });
    } catch (error) {
      if (isAbort(error)) return null;
      throw error;
    }
  }
  const contents = new Blob([`${JSON.stringify(document, null, 2)}\n`], {
    type: 'application/json',
  });
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
    return { handle, filename: handle.name };
  }
  const filename = safeFilename(document.title);
  const url = URL.createObjectURL(contents);
  const link = documentElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return { handle: null, filename };
}

function chooseFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = documentElement('input');
    input.type = 'file';
    input.accept = '.json,.cv.json,application/json';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

function documentElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
  return window.document.createElement(tag);
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
