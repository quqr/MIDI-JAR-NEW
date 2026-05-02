import {
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  app,
  dialog,
  shell,
} from "electron";
import { join } from "path";

const isMac = process.platform === "darwin";

function createMenuTemplate(
  mainWindow: BrowserWindow,
): MenuItemConstructorOptions[] {
  const appMenu: MenuItemConstructorOptions = {
    label: "MIDI-JAR",
    submenu: [
      { role: "about" },
      { type: "separator" },
      { role: "services" },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit" },
    ],
  };

  const fileMenu: MenuItemConstructorOptions = {
    label: "文件",
    submenu: [
      {
        label: "打开 MIDI 文件",
        accelerator: isMac ? "CmdOrCtrl+O" : "CmdOrCtrl+O",
        click: async () => {
          const { canceled, filePaths } = await dialog.showOpenDialog(
            mainWindow,
            {
              title: "打开 MIDI 文件",
              properties: ["openFile"],
              filters: [
                { name: "MIDI 文件", extensions: ["mid", "midi"] },
                { name: "所有文件", extensions: ["*"] },
              ],
            },
          );
          if (!canceled && filePaths.length > 0) {
            mainWindow.webContents.send("file:opened", filePaths[0]);
          }
        },
      },
      {
        label: "导出 MIDI 文件",
        accelerator: "CmdOrCtrl+E",
        click: async () => {
          const { canceled, filePath } = await dialog.showSaveDialog(
            mainWindow,
            {
              title: "导出 MIDI 文件",
              defaultPath: "untitled.mid",
              filters: [{ name: "MIDI 文件", extensions: ["mid", "midi"] }],
            },
          );
          if (!canceled && filePath) {
            mainWindow.webContents.send("file:save-requested", filePath);
          }
        },
      },
      { type: "separator" },
      {
        label: "退出",
        accelerator: isMac ? "Cmd+Q" : "CmdOrCtrl+Q",
        click: () => {
          app.quit();
        },
      },
    ],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: "编辑",
    submenu: [
      { role: "undo", accelerator: isMac ? "Cmd+Z" : "CmdOrCtrl+Z" },
      { role: "redo", accelerator: isMac ? "Cmd+Shift+Z" : "CmdOrCtrl+Y" },
      { type: "separator" },
      { role: "cut", accelerator: isMac ? "Cmd+X" : "CmdOrCtrl+X" },
      { role: "copy", accelerator: isMac ? "Cmd+C" : "CmdOrCtrl+C" },
      { role: "paste", accelerator: isMac ? "Cmd+V" : "CmdOrCtrl+V" },
      ...(isMac
        ? [
            { type: "separator" } as MenuItemConstructorOptions,
            { role: "delete" } as MenuItemConstructorOptions,
            {
              role: "selectAll",
              accelerator: "Cmd+A",
            } as MenuItemConstructorOptions,
          ]
        : [
            { type: "separator" } as MenuItemConstructorOptions,
            { role: "delete" } as MenuItemConstructorOptions,
            {
              role: "selectAll",
              accelerator: "CmdOrCtrl+A",
            } as MenuItemConstructorOptions,
          ]),
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: "视图",
    submenu: [
      {
        label: "重新加载",
        accelerator: isMac ? "Cmd+R" : "CmdOrCtrl+R",
        click: () => {
          mainWindow.reload();
        },
      },
      {
        label: "切换开发者工具",
        accelerator: isMac ? "Cmd+Shift+I" : "CmdOrCtrl+Shift+I",
        click: () => {
          mainWindow.webContents.toggleDevTools();
        },
      },
      { type: "separator" },
      {
        label: "切换全屏",
        accelerator: "F11",
        click: () => {
          mainWindow.setFullScreen(!mainWindow.isFullScreen());
        },
      },
      { type: "separator" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { role: "resetZoom" },
    ],
  };

  const midiMenu: MenuItemConstructorOptions = {
    label: "MIDI",
    submenu: [
      {
        label: "刷新设备",
        accelerator: isMac ? "Cmd+Shift+M" : "CmdOrCtrl+Shift+M",
        click: () => {
          mainWindow.webContents.send("midi:refresh-devices");
        },
      },
      {
        label: "MIDI 设置",
        accelerator: isMac ? "Cmd+," : "CmdOrCtrl+,",
        click: () => {
          mainWindow.webContents.send("midi:open-settings");
        },
      },
    ],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: "窗口",
    submenu: [
      {
        label: "最小化",
        accelerator: isMac ? "Cmd+M" : "CmdOrCtrl+M",
        click: () => {
          mainWindow.minimize();
        },
      },
      { role: "zoom" },
      { type: "separator" },
      {
        label: "始终置顶",
        type: "checkbox",
        checked: mainWindow.isAlwaysOnTop(),
        click: (_, item) => {
          const flag = (item as any).checked ?? false;
          mainWindow.setAlwaysOnTop(flag);
        },
      },
      { type: "separator" },
      ...(isMac ? [] : [{ role: "close" } as MenuItemConstructorOptions]),
    ],
  };

  const helpMenu: MenuItemConstructorOptions = {
    label: "帮助",
    submenu: [
      {
        label: "关于",
        click: async () => {
          await dialog.showMessageBox(mainWindow, {
            type: "info",
            title: "关于 MIDI-JAR",
            message: "MIDI-JAR",
            detail: `版本: ${app.getVersion()}\n一个 MIDI 工具应用程序`,
            buttons: ["确定"],
          });
        },
      },
      {
        label: "文档",
        click: async () => {
          await shell.openExternal("https://github.com/your-org/midi-jar");
        },
      },
      {
        label: "报告问题",
        click: async () => {
          await shell.openExternal(
            "https://github.com/your-org/midi-jar/issues",
          );
        },
      },
    ],
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [appMenu] : []),
    fileMenu,
    editMenu,
    viewMenu,
    midiMenu,
    windowMenu,
    helpMenu,
  ];

  return template;
}

export function setupApplicationMenu(mainWindow: BrowserWindow): void {
  const template = createMenuTemplate(mainWindow);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
