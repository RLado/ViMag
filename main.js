// Import
const {app, BrowserWindow, Menu, ipcMain} = require('electron');
const Main = require('electron/main');
let {PythonShell} = require('python-shell');

// Define main window
const createWindow = () => {
    const win = new BrowserWindow({
        width: 1200,
        height: 720,
        //frame: False,
        webPreferences: {
            nodeIntegration: true, // These arguments are now required since they are disabled by default for security reasons
            contextIsolation: false,
        },
    });
    win.toggleDevTools(); //For debug
    win.loadFile('index.html');

    const menu_template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New project',
                    accelerator: 'CmdOrCtrl+N',
                    click(){
                        win.webContents.send('new_prj', true);
                    }
                },
                {
                    label: 'Load project',
                    accelerator: 'CmdOrCtrl+O',
                    click() {
                        load_project(win);
                    }
                },
                {
                    label: 'Save project',
                    accelerator: 'CmdOrCtrl+S',
                    click() {
                        save_project(win);
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Import video',
                    accelerator: 'CmdOrCtrl+I',
                    click() { 
                        import_vid(win);
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

        {
            label: 'View',
            submenu: [
                {
                    role: 'reload'
                },
                {
                    role: 'togglefullscreen'
                }
            ]
        },
        
        {
            role: 'help',
            submenu: [
                {
                    label: 'About'
                }
            ]
        }
    ]
    
    const menu = Menu.buildFromTemplate(menu_template)
    Menu.setApplicationMenu(menu)
};

app.whenReady().then(() => {
    createWindow()
});

// When all windows are closed quit the app
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
});

// Functions -------------------------------------------------------------------
async function import_vid(MainWindow){
    const {dialog} = require('electron');
    let options = {
        title : "Import video", 
        defaultPath : ".",
        buttonLabel : "Import",
        
        filters :[
            {name: 'Movies', extensions: ['mkv', 'avi', 'mp4']},
            {name: 'All Files', extensions: ['*']}
        ],
        properties: ['openFile','multiSelections']
    };

    dialog.showOpenDialog(MainWindow, options).then((filePaths) => {
        console.log('Import dialog')
        console.log({filePaths})

        if (!filePaths.canceled){
            MainWindow.webContents.send('vimport', filePaths.filePaths);
        }
    });
}

async function save_project(MainWindow){
    const {dialog} = require('electron');
    let options = {
        title : "Save project", 
        defaultPath : ".",
        buttonLabel : "Save",
        
        filters :[
            {name: 'VibroLab projects', extensions: ['vl']},
            {name: 'All Files', extensions: ['*']}
        ],
        properties: ['saveFile']
    };

    dialog.showSaveDialog(MainWindow, options).then((filePaths) => {
        console.log('Save dialog:')
        console.log({filePaths})
        
        if (!filePaths.canceled){
            MainWindow.webContents.send('save_path', filePaths.filePath);
        }
    });
}

async function load_project(MainWindow){
    const {dialog} = require('electron');
    let options = {
        title : "Load project", 
        defaultPath : ".",
        buttonLabel : "Load",
        
        filters :[
            {name: 'VibroLab projects', extensions: ['vl']},
            {name: 'All Files', extensions: ['*']}
        ],
        properties: ['openFile']
    };

    dialog.showOpenDialog(MainWindow, options).then((filePaths) => {
        console.log('Load dialog')
        console.log({filePaths})

        if (!filePaths.canceled){
            MainWindow.webContents.send('load_path', filePaths.filePaths[0]);
        }
    });
}