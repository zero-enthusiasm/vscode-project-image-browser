import { Uri, Webview } from "vscode"
import * as fs from 'fs'
import * as path from 'path'
import { ProjectDir, ImageFile, ProjectDirCollection } from "./protocol";
import { getCommonBasePathLength } from "./common";

const SUPPORT_IMG_TYPES = ['.svg', '.png', '.jpeg', '.jpg', '.ico', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.apng', '.avif']

// Main search function used to collect all images in the given folders and form them into structured data while avoiding lengthy path repetition
export function imageSearchMultipleFolders(folders: string[], includeFolders: string[], excludeFolders: string[], webview: Webview): ProjectDirCollection {
    const dirs: ProjectDir[] = [];
    for (const base of folders) {
        const imgs = imageSearchFolder(base, includeFolders, excludeFolders, webview);
        if (imgs.length)
            dirs.push({ base, imgs });
    }

    // Find common base path of project dirs
    const commonLength = getCommonBasePathLength(dirs.map(item => item.base));
    const commonBase = dirs[0].base.slice(0, commonLength);
    dirs.forEach(dir => dir.base = dir.base.slice(commonLength));

    return { commonBase, dirs };
}

// Recursively search a folder for images and return structured data
function imageSearchFolder(basePath: string, includeFolders: string[], excludeFolders: string[], webview: Webview): ImageFile[] {
    const images: ImageFile[] = []
    const searchedFolders = new Set<string>();
    const searchPaths = includeFolders.length > 0 ? includeFolders.map(folder => path.join(basePath, folder)).filter(fs.existsSync)
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

