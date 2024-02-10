import * as vscode from "vscode";
import * as path from 'path'

import { ImageBrowserPanel } from "./panels/ImageBrowserPanel";
import { MenuContext } from "./protocol";


export const EXTENSION_ID = "vscode-project-image-browser";

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
                vscode.env.clipboard.writeText(path.join(result.image.path, result.image.name));
        }
    });
    context.subscriptions.push(copyRelativePath);

    // Context menu: copy image name to clipboard
    const copyFullPath = vscode.commands.registerCommand(EXTENSION_ID + ".CopyFullPath", (context: MenuContext) => {
        if (ImageBrowserPanel.instance) {
            const result = ImageBrowserPanel.instance.findImageFromUri(context.imageUri);
            if (result)
                vscode.env.clipboard.writeText(path.join(result.folder.base, result.image.path, result.image.name));
        }
    });
    context.subscriptions.push(copyFullPath);
    // Add command to the extension context
}