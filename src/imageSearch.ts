import { Uri, Webview } from "vscode"
import * as fs from 'fs'
import * as path from 'path'
import { ImageFileList, ImageFile } from "./protocol";

const SUPPORT_IMG_TYPES = ['.svg', '.png', '.jpeg', '.jpg', '.ico', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.apng', '.avif']

export function imageSearchMultipleFolders(folders: string[], includeFolders: string[], excludeFolders: string[], webview: Webview) {
    const lists: ImageFileList[] = [];
    for (const base of folders) {
        const imgs = imageSearchFolder(base, includeFolders, excludeFolders, webview);
        if (imgs.length)
            lists.push({ base, imgs });
    }

    // Find common base path of project dirs
    if (lists.length > 1) {
        const commonLength = getCommonBasePathLength(lists.map(item => item.base.split(path.sep)));
        lists.forEach(list => list.base = list.base.slice(commonLength));
    }

    return lists;
}

function getCommonBasePathLength(paths: string[][]) {
    const minLength = paths.reduce((minLength, parts) => Math.min(parts.length, minLength), 32768) - 1;
    let i = 0;
    for (; i < minLength; ++i)
        for (let j = 1; j < paths.length; ++j)
            if (paths[j][i] != paths[0][i])
                break;
    return paths[0].slice(0, i).reduce((length, part) => length + part.length + 1, 0) - 1;
}

export function imageSearchFolder(basePath: string, includeFolders: string[], excludeFolders: string[], webview: Webview) {
    const images: ImageFile[] = []
    const searchPaths = includeFolders.length > 0 ? includeFolders.map(folder => path.join(basePath, trimSlashes(folder))) : [basePath];
    const excludePaths = excludeFolders.map(folder => path.join(basePath, trimSlashes(folder)))
    const searchedFolders = new Set<string>();

    try {
        while (searchPaths.length) {
            const folder = searchPaths.pop()!;
            const dirList = fs.readdirSync(folder);
            for (const name of dirList) {
                const fullPath = path.join(folder, name);
                const stats = fs.statSync(fullPath)
                if (stats.isDirectory()) {
                    if (excludePaths.includes(fullPath))
                        continue;
                    if (searchedFolders.has(fullPath))
                        continue;
                    searchPaths.push(fullPath);
                }
                else if (stats.isFile()) {
                    if (SUPPORT_IMG_TYPES.includes(path.extname(name)))
                        images.push({
                            name,
                            path: folder.slice(basePath.length),
                            uri: webview.asWebviewUri(Uri.file(fullPath)).toString(),
                        });
                }
            }
        }
    } catch (e) {
        console.log(e)
    }
    return images;
}

/**
 * remove first/last slash of file path
 */
const trimLastSlash = (path: string) => path.endsWith('/') ? path.slice(0, -1) : path
const trimFirstSlash = (path: string) => path.startsWith('/') ? path.slice(1) : path
const trimSlashes = (path: string) => trimLastSlash(trimFirstSlash(path))
