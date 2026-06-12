import fs from 'fs/promises';
import path from 'path';

const EXCLUDED_DIRS = ['node_modules', '.git', '.next'];

async function getFileContent(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    return `Error reading file: ${error.message}`;
  }
}

async function getDirectoryTree(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map(async (dirent) => {
      const res = path.resolve(dir, dirent.name);
      if (EXCLUDED_DIRS.includes(dirent.name)) {
        return null;
      }
      if (dirent.isDirectory()) {
        return getDirectoryTree(res);
      }
      return res;
    })
  );
  return files.filter(Boolean).flat();
}

export async function getProjectContext() {
  const fileList = await getDirectoryTree('.');
  const projectContext = await Promise.all(
    fileList.map(async (filePath) => {
      const content = await getFileContent(filePath);
      return `File: ${filePath}\n${content}`;
    })
  );
  return projectContext.join('\n\n---\n\n');
}
