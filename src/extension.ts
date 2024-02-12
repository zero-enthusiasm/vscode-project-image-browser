import * as vscode from "vscode";
import * as path from "path"
import { ImageBrowserPanel } from "./panels/ImageBrowserPanel";
import { MenuContext } from "./protocol";
import { openInApp } from "./utilities";


export const EXTENSION_ID = "vscode-project-image-browser";

// Join path parts while replacing separator with configured one if necessary
function joinPath(...paths: string[]) {
    const sep = vscode.workspace.getConfiguration(EXTENSION_ID).get("pathDeliminator", "Default");
    const fullPath = path.join(...paths);
    return sep == "Default" ? fullPath : fullPath.replace(new RegExp('\\' + path.sep, 'g'), sep);
}

export function activate(context: vscode.ExtensionContext) {
    // Show the webview
    const viewImagesCommand = vscode.commands.registerCommand(EXTENSION_ID + ".ViewImages", () => {
        ImageBrowserPanel.show(context.extensionUri);
    });
    context.subscriptions.push(viewImagesCommand);

    // Context menu: copy image name to clipboard
    const copyName = vscode.commands.registerCommand(EXTENSION_ID + ".CopyName", (context: MenuContext) => {
        if (ImageBrowserPanel.instance) {
            const result = ImageBrowserPanel.instance.findImageFromUri(context.imageUri);
            if (result)
                vscode.env.clipboard.writeText(result.image.name);
        }
    });
    context.subscriptions.push(copyName);

    // Context menu: copy image name to clipboard
    const copyRelativePath = vscode.commands.registerCommand(EXTENSION_ID + ".CopyRelativePath", (context: MenuContext) => {
        if (ImageBrowserPanel.instance) {
            const result = ImageBrowserPanel.instance.findImageFromUri(context.imageUri);
            if (result)
                vscode.env.clipboard.writeText(joinPath(result.image.path, result.image.name));
        }
    });
    context.subscriptions.push(copyRelativePath);

    // Context menu: copy image name to clipboard
    const copyFullPath = vscode.commands.registerCommand(EXTENSION_ID + ".CopyFullPath", (context: MenuContext) => {
        if (ImageBrowserPanel.instance) {
            const result = ImageBrowserPanel.instance.findImageFromUri(context.imageUri);
            if (result)
                vscode.env.clipboard.writeText(joinPath(result.projectDir, result.image.path, result.image.name));
        }
    });
    context.subscriptions.push(copyFullPath);

    // Context menu: open image file in default app
    const openImageFile = vscode.commands.registerCommand(EXTENSION_ID + ".OpenImageFile", (context: MenuContext) => {
        if (ImageBrowserPanel.instance) {
            const result = ImageBrowserPanel.instance.findImageFromUri(context.imageUri);
            if (result)
                openInApp(joinPath(result.projectDir, result.image.path, result.image.name))
        }
    });
    context.subscriptions.push(openImageFile);
}