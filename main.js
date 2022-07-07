// Import
const {app, BrowserWindow, Menu} = require('electron')
let {PythonShell} = require('python-shell')

// Define main window
const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        //frame: False,
    })

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
                    click() { 
                        import_vid();
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

    win.loadFile('index.html')
}

app.whenReady().then(() => {
    createWindow()
})

// When all windows are closed quit the app
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

// Functions -------------------------------------------------------------------
function import_vid(){
    console.log('Testing python')
    let options={}
    PythonShell.run('python/test.py', options, function (err, results) {
        if (err) throw err;
        console.log('results: %j', results);
      });
}
