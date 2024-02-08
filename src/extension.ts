import { commands, ExtensionContext } from "vscode";
import { ImageBrowserPanel } from "./panels/ImageBrowserPanel";


export const EXTENSION_ID = "vscode-project-image-browser";

export function activate(context: ExtensionContext) {
    console.log('actived')
    // Create the show hello world command
    const viewImagesCommand = commands.registerCommand(EXTENSION_ID + ".viewImages", () => {
        ImageBrowserPanel.show(context.extensionUri);
    });

    // Add command to the extension context
    context.subscriptions.push(viewImagesCommand);
}