// Import ----------------------------------------------------------------------
const {ipcRenderer} = require('electron');
let {PythonShell} = require('python-shell');
fs = require('fs');


// Slice selector
const video = document.getElementById('video');
video.addEventListener("click", getClickPosition, false);

// prj_dict (testing)
let prj_dict = {
    Name: "Test",
    Age: 69,
    Job: "Freelancer",
    Skills : "JavaScript"
};

// Video import
ipcRenderer.on('vimport', function(event, args){
    video.src = args[0];
    python_test();
  });

// Save project
ipcRenderer.on('save_path', function(event, args){
    let prj_dict_str = JSON.stringify(prj_dict);
    fs.writeFile(args, prj_dict_str, 'utf8', function (err) {
        if (err) return console.log(err);
        console.log('Saved');
    });
});

// Load project
ipcRenderer.on('load_path', function(event, args){
    let prj_dict_str = fs.readFileSync(args, 'utf-8').toString();
    prj_dict = JSON.parse(prj_dict_str);
    console.log({prj_dict});
});


// Functions -------------------------------------------------------------------
function python_test(){
    console.log('Testing python')
    let options={}
    PythonShell.run('python/test.py', options, function (err, results) {
        if (err) throw err;
        console.log('results: %j', results);
    });
}

function getClickPosition(e) { // Get click position inside an element
    var video_coords = video.getBoundingClientRect();
    var xPosition = e.clientX - video_coords.left;
    var yPosition = e.clientY - video_coords.top;
    alert('pos x:' + xPosition + '/' + video_coords.width + ' pos y: ' + yPosition + '/' + video_coords.height);
}