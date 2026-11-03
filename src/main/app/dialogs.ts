import { dialog, type BrowserWindow, type FileFilter } from 'electron';

export async function pickFile(window: BrowserWindow | null, filters: FileFilter[]): Promise<string | null> {
  const options = { properties: ['openFile' as const], filters };
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  return result.canceled ? null : result.filePaths[0] ?? null;
}

export async function pickFiles(window: BrowserWindow | null, filters: FileFilter[]): Promise<string[]> {
  const options = { properties: ['openFile' as const, 'multiSelections' as const], filters };
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  return result.canceled ? [] : result.filePaths;
}

export async function pickSaveFile(window: BrowserWindow | null, defaultPath: string, filters: FileFilter[]): Promise<string | null> {
  const options = { defaultPath, filters };
  const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
  return result.canceled ? null : result.filePath ?? null;
}

export async function pickDirectory(window: BrowserWindow | null, defaultPath?: string): Promise<string | null> {
  const options = { properties: ['openDirectory' as const, 'createDirectory' as const], defaultPath };
  const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  return result.canceled ? null : result.filePaths[0] ?? null;
}
