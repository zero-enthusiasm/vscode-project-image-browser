import { Uri, Webview } from "vscode"
import * as fs from 'fs'
import * as path from 'path'
import { ImageFileList, ImageFile } from "./protocol";

const SUPPORT_IMG_TYPES = ['.svg', '.png', '.jpeg', '.jpg', '.ico', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.apng', '.avif']

// Main search function used to collect all images in the given folders and form them into structured data while avoiding lengthy path repetition
export function imageSearchMultipleFolders(folders: string[], includeFolders: string[], excludeFolders: string[], webview: Webview): ImageFileList[] {
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

export function overridePathDeliminators(lists: ImageFileList[], pathDeliminator: string) {
    if (pathDeliminator != path.sep) {
        const regex = `/${path.sep}/g`;
        for (const projectDir of lists) {
            projectDir.base.replace(regex, pathDeliminator);
            for (const image of projectDir.imgs)
                image.path.replace(regex, pathDeliminator)
        }
    }
}

// Find the number of starting characters shared between the given paths
function getCommonBasePathLength(paths: string[][]): number {
    const minLength = paths.reduce((minLength, parts) => Math.min(parts.length, minLength), 32768) - 1;
    let i = 0;
    for (; i < minLength; ++i)
        for (let j = 1; j < paths.length; ++j)
            if (paths[j][i] != paths[0][i])
                break;
    return paths[0].slice(0, i).reduce((length, part) => length + part.length + 1, 0) - 1;
}

// Recursively search a folder for images and return structured data
function imageSearchFolder(basePath: string, includeFolders: string[], excludeFolders: string[], webview: Webview): ImageFile[] {
    const images: ImageFile[] = []
    const searchedFolders = new Set<string>();
    const searchPaths = includeFolders.length > 0 ? includeFolders.map(folder => path.join(basePath, trimSlashes(folder))).filter(fs.existsSync)
        : [basePath];

    try {
        while (searchPaths.length) {
            const folder = searchPaths.pop()!;
            const dirList = fs.readdirSync(folder);
            for (const name of dirList) {
                const fullPath = path.join(folder, name);
                const stats = fs.statSync(fullPath)
                if (stats.isDirectory()) {
                    if (excludeFolders.find(s => fullPath.endsWith(s)))
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
