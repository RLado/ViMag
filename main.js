// Import
const fs = require('fs');
const process = require('process');
const path = require('path');
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const Main = require('electron/main');
let { PythonShell } = require('python-shell');


// Setup python environament
console.log('Setting up python environament ...');
let pyvenvContent;
if (process.platform === 'win32') {
    pyvenvContent = `home = ${path.join(process.cwd(), 'python/interpreter/PCbuild/amd64')}
include-system-site-packages = false
version = 3.10.6
`;
}
else {
    pyvenvContent = `home = ${path.join(process.cwd(), 'python/interpreter')}
include-system-site-packages = false
version = 3.10.6
`;
}
fs.writeFile(path.join(process.cwd(), 'python/interpreter/vibrolab_venv/pyvenv.cfg'), pyvenvContent, err => {
    if (err) {
        console.error(err);
    }
    // file written successfully
});
console.log('Done');

// Add application icon
app.getFileIcon('./img/icon.ico');

// Define main window
const createWindow = () => {
    const win = new BrowserWindow({
        title: 'VibroLab',
        width: 1200,
        height: 720,
        icon: './img/icon.ico',
        fullscreenable: false,
        //frame: False,
        webPreferences: {
            nodeIntegration: true, // These arguments are now required since they are disabled by default for security reasons
            contextIsolation: false,
        },
    });
    win.toggleDevTools(); //For debug
    win.loadFile('./html/index.html');

    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New project',
                    accelerator: 'CmdOrCtrl+N',
                    click() {
                        win.webContents.send('newPrj', true);
                    }
                },
                {
                    label: 'Load project',
                    accelerator: 'CmdOrCtrl+O',
                    click() {
                        loadProject(win);
                    }
                },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click() {
                        win.webContents.send('save', null);
                    }
                },
                {
                    label: 'Save As',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click() {
                        saveProject(win);
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Import video',
                    accelerator: 'CmdOrCtrl+I',
                    click() {
                        importVid(win);
                    },
                },
                {
                    type: 'separator'
                },
                {
                    role: 'Quit'
                }
            ]
        },

        /*{
            label: 'View',
            submenu: [
                {
                    role: 'reload'
                },
                {
                    role: 'togglefullscreen'
                }
            ]
        },*/

        {
            role: 'help',
            submenu: [
                {
                    label: 'About',
                    click() {
                        const aboutWin = new BrowserWindow({
                            title: 'About',
                            width: 340,
                            height: 215,
                            icon: './img/icon.ico',
                            resizable: false,
                            fullscreenable: false,
                        });
                        aboutWin.removeMenu();
                        aboutWin.loadFile('./html/about.html');
                    },
                }
            ]
        },
    ];

    const menu = Menu.buildFromTemplate(menuTemplate)
    Menu.setApplicationMenu(menu)

    // Renderer events ---------------------------------------------------------
    // The renderer asks for a "Save As" dialog
    ipcMain.on('saveAs', function (event, args) {
        saveProject(win);
    });

    // Request for video import
    ipcMain.on('vimportReq', function (event, args) {
        importVid(win);
    });

    // Request for project load
    ipcMain.on('loadReq', function (event, args) {
        loadProject(win);
    });

};

app.whenReady().then(() => {
    createWindow()
});

// When all windows are closed quit the app
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
});

// Functions -------------------------------------------------------------------
async function loadProject(MainWindow) {
    const { dialog } = require('electron');
    let options = {
        title: "Load project",
        defaultPath: ".",
        buttonLabel: "Load",

        filters: [
            { name: 'VibroLab projects', extensions: ['vl'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
    };

    dialog.showOpenDialog(MainWindow, options).then((filePaths) => {
        console.log('Load dialog')
        console.log({ filePaths })

        if (!filePaths.canceled) {
            MainWindow.webContents.send('loadPath', filePaths.filePaths[0]);
        }
    });
}

async function saveProject(MainWindow) {
    const { dialog } = require('electron');
    let options = {
        title: "Save project",
        defaultPath: ".",
        buttonLabel: "Save As",

        filters: [
            { name: 'VibroLab projects', extensions: ['vl'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['saveFile']
    };

    dialog.showSaveDialog(MainWindow, options).then((filePaths) => {
        console.log('Save dialog:')
        console.log({ filePaths })

        if (!filePaths.canceled) {
            MainWindow.webContents.send('savePath', filePaths.filePath);
        }
    });
}

async function importVid(MainWindow) {
    const { dialog } = require('electron');
    let options = {
        title: "Import video",
        defaultPath: ".",
        buttonLabel: "Import",

        filters: [
            { name: 'Movies', extensions: ['mkv', 'avi', 'mp4'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile', 'multiSelections']
    };

    dialog.showOpenDialog(MainWindow, options).then((filePaths) => {
        console.log('Import dialog')
        console.log({ filePaths })

        if (!filePaths.canceled) {
            MainWindow.webContents.send('vimport', filePaths.filePaths);
        }
    });
}