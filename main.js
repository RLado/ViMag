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
                },
                {
                    label: 'Load project'
                },
                {
                    label: 'Save project'
                },
                {
                    label: 'Save as new project'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Import video',
                    accelerator: 'CmdOrCtrl+I',
                    click() { 
                        let vpath = import_vid(win);
                    }
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
        // See place holder 1 in above image
        title : "Import video", 
        
        // See place holder 2 in above image
        defaultPath : ".",
        
        // See place holder 3 in above image
        buttonLabel : "Import",
        
        // See place holder 4 in above image
        filters :[
            {name: 'Movies', extensions: ['mkv', 'avi', 'mp4']},
            {name: 'All Files', extensions: ['*']}
        ],
        properties: ['openFile','multiSelections']
    };

    dialog.showOpenDialog(MainWindow, options).then((filePaths) => {
        //console.log({filePaths})
        if (!filePaths.canceled){
            MainWindow.webContents.send('vimport', filePaths.filePaths);
        }
    });
}