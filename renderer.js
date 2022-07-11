const {ipcRenderer} = require('electron');
let {PythonShell} = require('python-shell')

ipcRenderer.on('vimport', function(event, args){
    alert(args);
    python_test();
  });

function python_test(){
    console.log('Testing python')
    let options={}
    PythonShell.run('python/test.py', options, function (err, results) {
        if (err) throw err;
        console.log('results: %j', results);
    });
}