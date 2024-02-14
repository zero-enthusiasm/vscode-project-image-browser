import * as vscode from "vscode";
import * as path from "path"
import { ImageBrowserPanel, ImageUriResult } from "./panels/ImageBrowserPanel";
import { MenuContext } from "./protocol";
import { openFileLocation, openInApp } from "./utilities";


export const EXTENSION_ID = "project-image-browser";

export function activate(context: vscode.ExtensionContext) {
    // Show the webview
    const viewImagesCommand = vscode.commands.registerCommand(EXTENSION_ID + ".ViewImages", () => {
        ImageBrowserPanel.show(context.extensionUri);
    });
    context.subscriptions.push(viewImagesCommand);

    // Image context menu
    const contextMenu: { [key: string]: (result: ImageUriResult) => void } = {
        "CopyName": result => vscode.env.clipboard.writeText(result.image.name),
        "CopyRelativePath": result => vscode.env.clipboard.writeText(joinPath(result.image.path, result.image.name)),
        "CopyFullPath": result => vscode.env.clipboard.writeText(joinPath(result.projectDir, result.image.path, result.image.name)),

        "OpenImageFile": result => openInApp(path.join(result.projectDir, result.image.path, result.image.name)),
        "OpenImageLocation": result => openFileLocation(path.join(result.projectDir, result.image.path)),
    };

    Object.keys(contextMenu).forEach(name => {
        const command = vscode.commands.registerCommand(EXTENSION_ID + "." + name, (context: MenuContext) => {
            if (ImageBrowserPanel.instance) {
                const result = ImageBrowserPanel.instance.findImageFromUri(context.imageUri);
                if (result)
                    contextMenu[name](result);
            }
        });
        context.subscriptions.push(command);
    });
}

// Join path parts while replacing separator with configured one if necessary
function joinPath(...paths: string[]) {
    const sep = vscode.workspace.getConfiguration(EXTENSION_ID).get("pathDeliminator", "Default");
    const fullPath = path.join(...paths);
    return sep == "Default" ? fullPath : fullPath.replace(new RegExp('\\' + path.sep, 'g'), sep);
}