const { app, screen, BrowserWindow } = require('electron')

const createWindow = () => {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size
    const win = new BrowserWindow({
      width: width,
      height: height
    })
    win.webContents.openDevTools();
    win.loadFile('./index.html')
}

app.whenReady().then(() => {
createWindow()
})

// Grayscale:
// #3C3E40
// #8C8C8C
// #F2F2F2

// Red:
// #F24B4B
// #A63333

// Blue:
// #235FA8
// #338AF5
// #76AFF5