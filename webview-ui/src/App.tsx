import { onMount, Component, onCleanup, createSignal, createEffect, For, Accessor, Setter, Show, PropsWithChildren, createMemo, Signal } from "solid-js";
import { provideVSCodeDesignSystem, vsCodeBadge, vsCodeButton, vsCodeCheckbox, vsCodeDivider, vsCodeOption, vsCodeTextArea, vsCodeTextField } from "@vscode/webview-ui-toolkit";
import { vscode } from "./utilities/vscode";
import "./App.css";
import * as protocol from "../../src/protocol";

provideVSCodeDesignSystem().register(
    vsCodeButton(),
    vsCodeOption(),
    vsCodeTextField(),
    vsCodeCheckbox(),
    vsCodeTextArea(),
    vsCodeBadge(),
    vsCodeDivider(),
);

// Types for expandable/collapsable group data
type Expandable = {
    title: string;
    expanded: Accessor<boolean>;
    setExpanded: Setter<boolean>;
}

type ImageGroup = Expandable & {
    images: protocol.ImageFile[];
}

type ProjectDirImageGroups = Expandable & {
    groups: ImageGroup[];
}

// Available background style for images. The format is [color];[classes]. Color can be any valid CSS color.
const imagebackgroundStyles = [
    'transparent',
    'transparent;checkerboard',
    'white;checkerboard',
    'black;checkerboard',
    'black',
    'white',
    'grey',
    '#CCCCCC'
];

/*----------------------------------------------------------------------------------------------------------------------
    Main component for image browser
----------------------------------------------------------------------------------------------------------------------*/

const App: Component = () => {
    let config = {} as protocol.Configuration;

    // Image data
    const [imageGroups, setImageGroups] = createSignal([] as ProjectDirImageGroups[]);

    // Config setting displayed on the main 
    const [imageBackground, setImageBackground] = createSignal("transparent");
    const [imageSize, setImageSize] = createSignal(100);

    // Other temporary states
    const [filter, setFilter] = createSignal("");
    const [viewImage, setViewImage] = createSignal<protocol.ImageFile | undefined>();
    const [showBackgroundColorModal, setShowBackgroundColorModal] = createSignal(false);
    const [showSettingsModal, setShowSettingsModal] = createSignal(false);

    onMount(() => {
        window.addEventListener("message", messageHandler);
        onCleanup(() => window.addEventListener("message", messageHandler));

        // Reload state. We will refresh the image list anyway but this preserves the group expansion state
        //setImageGroups(vscode.getState() as ProjectDirImageGroups[] || []);

        vscode.postMessage({ command: protocol.ClientCommand.InitComplete });
    });

    // Handles incoming server messages
    const messageHandler = (ev: MessageEvent) => {
        const message = ev.data as protocol.Message;
        switch (message.command) {
            case protocol.ServerCommand.PostConfig:
                setConfig(message.data);
                break;
            case protocol.ServerCommand.PostImageData:
                setImageGroups(processImageData(message.data))
                break;
        }
    }

    // Converts the file list sent by the server into the structure we want to display by grouping images based on realtive path
    const processImageData = (imageFileLists: protocol.ImageFileList[]) => {
        const projectDirGroups: ProjectDirImageGroups[] = [];
        const createOrCopySignal = (group: Expandable | undefined) => group ? [group.expanded, group.setExpanded] : createSignal(true);

        for (const imageFileList of imageFileLists) {
            let previous = "$*";
            let group: ImageGroup | undefined;

            // Check is we were displaying this group before and copy the expansion signal to preserve state
            const existingProjectDir = imageGroups().find(group => imageFileList.base == group.title);
            const [expanded, setExpanded] = createOrCopySignal(existingProjectDir) as Signal<boolean>;
            projectDirGroups.push({ title: imageFileList.base, groups: [], expanded, setExpanded });

            for (const imageFile of imageFileList.imgs) {
                if (imageFile.path === previous) {
                    group!.images.push(imageFile);
                }
                else {
                    if (group)
                        projectDirGroups[projectDirGroups.length - 1]!.groups.push(group);

                    const existingGroup = existingProjectDir?.groups.find(group => imageFile.path == group.title);
                    const [expanded, setExpanded] = createOrCopySignal(existingGroup) as Signal<boolean>;
                    group = {
                        title: imageFile.path,
                        images: [imageFile],
                        expanded,
                        setExpanded
                    };
                    previous = imageFile.path;
                }
            }
            if (group)
                projectDirGroups[projectDirGroups.length - 1]!.groups.push(group);
        }

        vscode.setState({ projectDirGroups });

        return projectDirGroups;
    }

    // Applies a new config sent from the server
    const setConfig = (newConfig: protocol.Configuration) => {
        config = newConfig;
        setImageBackground(config.imageBackground);
        setImageSize(config.imageSize);
    }

    // Called to modify local config and update the server
    const onChangeConfig = (partialConfig: Partial<protocol.Configuration>) => {
        const newConfig = Object.assign({}, config, partialConfig);
        vscode.postMessage({ command: protocol.ClientCommand.PostConfig, data: newConfig });
        setConfig(newConfig);
    }

    // Update the VSCode state to record group expansions
    const saveState = () => vscode.setState(imageGroups());

    // Set expansion for all groups
    const onExpandAll = (expanded: boolean) => imageGroups().forEach(group => {
        group.setExpanded(expanded); group.groups.forEach(group => group.setExpanded(expanded));
    });

    // Backgrounds style for image list
    const backgroundStyle = createMemo(() => imageBackground().split(';'));

    // Lowest level image group
    const createImageGroup = (group: ImageGroup) => <ImageGroup
        group={group}
        background={backgroundStyle()}
        imageSize={imageSize() + 'px'}
        filter={filter()}
        loading={config.lazyLoading ? "lazy" : undefined}
        onImageClick={setViewImage}
    />

    // Size for englarged image when clicked
    const getViewImageSize = () => {
        const dim = Math.max(document.documentElement.clientWidth, document.documentElement.clientHeight);
        return (dim * 0.7) + 'px';
    }

    return (
        <main>
            <div class="toolbar">
                <vscode-button class="toolbar-expand-button group-expander" appearance="secondary" onclick={() => onExpandAll(true)}>
                    +
                </vscode-button>
                <vscode-button class="toolbar-expand-button group-expander" appearance="secondary" onclick={() => onExpandAll(false)}>
                    -
                </vscode-button>
                <vscode-text-field class="filter-text" placeholder="Filter" value={filter()} onInput={(e: any) => setFilter(e.target.value)} />
                Background:
                <vscode-button id="toolbar-background-button" appearance="icon" onclick={() => setShowBackgroundColorModal(true)}>
                    <Background background={backgroundStyle()} modifiers="color-button-content" />
                </vscode-button>
                <div class='toolbar-spacer' />
                <vscode-button class="settings-button" appearance="secondary" onclick={() => setShowSettingsModal(true)}>
                    ...
                </vscode-button>
            </div>

            {/* Actual image list */}
            <For each={imageGroups()}>
                {projectDir =>
                    <Show
                        when={imageGroups().length > 1}
                        fallback={
                            <For each={projectDir.groups}>
                                {createImageGroup}
                            </For>
                        }>
                        <Group group={projectDir} modifiers="project-dir">
                            <For each={projectDir.groups}>
                                {createImageGroup}
                            </For>
                        </Group>
                        <vscode-divider />
                    </Show>
                }
            </For>

            <Show when={showBackgroundColorModal()}>
                <ModalPanel anchorId="toolbar-background-button" modifiers='backgroundColor'>
                    {imagebackgroundStyles.map(
                        style =>
                            <vscode-button appearance="icon" onclick={() => {
                                onChangeConfig({ imageBackground: style });
                                setShowBackgroundColorModal(false);
                            }}>
                                <Background background={style.split(';')} modifiers="color-button-content" />
                            </vscode-button>
                    )}
                </ModalPanel>
            </Show>

            <Show when={showSettingsModal()}>
                <SettingsPanel config={config} onChangeConfig={onChangeConfig} onCancel={() => setShowSettingsModal(false)} />
            </Show>

            <Show when={viewImage() != undefined}>
                <ModalPanel modifiers="view-image" onbackgroundclick={() => setViewImage(undefined)}>
                    <Background background={backgroundStyle()} modifiers="view-image" size={getViewImageSize()}>
                        <img class="image" src={viewImage()!.uri}></img>
                    </Background>
                    {/* <div class="view-image-buttons">
                        <vscode-button appearance="secondary">
                            Copy Name
                        </vscode-button>
                        <vscode-button appearance="secondary" class="margin-left">
                            Copy Path
                        </vscode-button>
                        <vscode-button appearance="secondary" class="margin-left">
                            Copy Path
                        </vscode-button>
                    </div> */}
                </ModalPanel>
            </Show>
        </main >
    );
};

export default App;

/*----------------------------------------------------------------------------------------------------------------------
    Exandable group of other components
----------------------------------------------------------------------------------------------------------------------*/

const Group: Component<{ group: Expandable, modifiers: string, count?: number } & PropsWithChildren> = (props) => {
    return (
        <div class="group">
            <vscode-option class={"group-header " + props.modifiers}
                onmousedown={() => props.group.setExpanded(!props.group.expanded())}
            >
                <span class="group-expander">{props.group.expanded() ? "- " : "+ "}</span>
                <span class={"group-title " + props.modifiers}>{props.group.title}</span>
                <Show when={props.count != undefined}>
                    <vscode-badge class="group-badge">{props.count}</vscode-badge>
                </Show>
            </vscode-option>
            <Show when={props.group.expanded()}>
                {props.children}
            </Show>
        </div>
    );
};

/*----------------------------------------------------------------------------------------------------------------------
    An expandable list of images
----------------------------------------------------------------------------------------------------------------------*/
type ImageGroupProps = {
    group: ImageGroup;
    background: string[];
    imageSize: string;
    filter: string;
    loading: "lazy" | undefined;
    onImageClick: (image: protocol.ImageFile) => void;
}

const ImageGroup: Component<ImageGroupProps> = (props) => {
    const filteredImages = () => props.filter.length ? props.group.images.filter(image => image.name.includes(props.filter))
        : props.group.images;
    const dataContext = '{"webviewSection": "image", "preventDefaultContextMenuItems": true, "imageUri": "';
    return (
        <Group group={props.group} modifiers="image-dir" count={filteredImages().length}>
            <div class="image-list">
                <For each={filteredImages()}>
                    {(image, index) =>
                        <div class={"image-box" + (index() == 0 ? " first" : "")}
                            onclick={() => props.onImageClick(image)}
                            data-vscode-context={dataContext + image.uri + '"}'}
                        >
                            <Background background={props.background} modifiers="" size={props.imageSize}>
                                <img class="image" src={image.uri} loading={props.loading}></img>
                            </Background>
                            <div class="image-name" style={{ width: props.imageSize }}>
                                {image.name}
                            </div>
                        </div>
                    }
                </For>
            </div >
        </Group >
    );
}

/*----------------------------------------------------------------------------------------------------------------------
    Component for the background of buttons and images
----------------------------------------------------------------------------------------------------------------------*/

const Background: Component<{ background: string[], modifiers: string, size?: string } & PropsWithChildren> = (props) => {
    return <div class={"background " + props.modifiers + " " + props.background[1]} style={{ "background-color": props.background[0], width: props.size, height: props.size }}>
        {props.children}
    </div>;
}

/*----------------------------------------------------------------------------------------------------------------------
    A basic modal panel for settings, menus etc.
----------------------------------------------------------------------------------------------------------------------*/

const ModalPanel: Component<{ anchorId?: string, onbackgroundclick?: () => void, modifiers: string } & PropsWithChildren> = (props) => {
    let x = 0, y = 0;
    if (props.anchorId) {
        const el = document.getElementById(props.anchorId);
        if (el) {
            x = el.getBoundingClientRect().left;
            y = el.getBoundingClientRect().bottom + 4;
        }
    }

    return (
        <div class="modal-background dark" onclick={props.onbackgroundclick}>
            <div class={"modal-panel " + props.modifiers} style={x && y ? { position: 'absolute', left: x + 'px', top: y + 'px' } : undefined}>
                {props.children}
            </div>
        </div>
    );
};

/*----------------------------------------------------------------------------------------------------------------------
    Settings Panel
----------------------------------------------------------------------------------------------------------------------*/

type SettingsPanelProps = PropsWithChildren & {
    config: protocol.Configuration;
    onChangeConfig: (partialConfig: Partial<protocol.Configuration>) => void;
    onCancel: () => void;
}

const SettingsPanel: Component<SettingsPanelProps> = (props) => {
    const [includeProjectFolders, setIncludeProjectFolders] = createSignal(props.config.includeProjectFolders);
    const [includeFolders, setIncludeFolders] = createSignal(props.config.includeFolders.join("\n"));
    const [excludeFolders, setExcludeFolders] = createSignal(props.config.excludeFolders.join("\n"));
    const projectFolders = Object.keys(includeProjectFolders());

    const toggleProjectFolder = (folder: string) => {
        const folders = Object.assign({}, includeProjectFolders());
        folders[folder] = !folders[folder];
        setIncludeProjectFolders(folders);
    }
    const onOK = () => {
        props.onChangeConfig({
            includeProjectFolders: includeProjectFolders(),
            includeFolders: includeFolders().split("\n").map(i => i.trim()).filter(i => i),
            excludeFolders: excludeFolders().split("\n").map(i => i.trim()).filter(i => i),
        });
        props.onCancel();
    };

    return (
        <ModalPanel modifiers='settings'>
            <Show when={projectFolders.length > 1}>
                Included
                <For each={projectFolders}>
                    {folder =>
                        <vscode-checkbox checked={includeProjectFolders()[folder]} onchange={() => toggleProjectFolder(folder)}>
                            {folder}
                        </vscode-checkbox>
                    }
                </For>
            </Show>
            <div class="section-break">Include folders - only these folders will be searched:</div>
            <vscode-text-area rows={5}
                value={includeFolders()}
                onInput={(e: any) => setIncludeFolders(e.target.value)}
            />
            <div class="section-break">Exclude folders - these folders will be ignored:</div>
            <vscode-text-area rows={5}
                value={excludeFolders()}
                onInput={(e: any) => setExcludeFolders(e.target.value)}
            />
            <div class='settings-buttons section-break'>
                <vscode-button onclick={onOK}>OK</vscode-button>
                <vscode-button class='margin-left' appearance="secondary" onclick={props.onCancel}>Cancel</vscode-button>
            </div>
        </ModalPanel >
    );
};