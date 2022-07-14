// Import ----------------------------------------------------------------------
const {ipcRenderer} = require('electron');
let {PythonShell} = require('python-shell');
fs = require('fs');

// State variables
let togglenav_c = true;
let toggledatatab_c = true;
let prj_dict = {
    Name: "Test",
    Age: 69,
    Job: "Freelancer",
    Skills : "JavaScript"
};

// Slice selector
const video = document.getElementById('video');
video.addEventListener("click", getClickPosition, false);

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

// Accordions
let acc = document.getElementsByClassName("accordion");

for (let i = 0; i < acc.length; i++) {
  acc[i].addEventListener("click", function() {
    /* Toggle between adding and removing the "active" class,
    to highlight the button that controls the panel */
    this.classList.toggle("active");

    /* Toggle between hiding and showing the active panel */
    var panel = this.nextElementSibling;
    if (panel.style.display === "block") {
      panel.style.display = "none";
    } else {
      panel.style.display = "block";
    }
  });
} 


// Functions -------------------------------------------------------------------
function python_test(){
    console.log('Testing python')
    let options={}
    PythonShell.run('python/test.py', options, function (err, results) {
        if (err) throw err;
        console.log('results: %j', results);
    });
}

// Get click position inside an element
function getClickPosition(e) {
    var video_coords = video.getBoundingClientRect();
    var xPosition = e.clientX - video_coords.left;
    var yPosition = e.clientY - video_coords.top;
    alert('pos x:' + xPosition + '/' + video_coords.width + ' pos y: ' + yPosition + '/' + video_coords.height);
}

// Navigation bar functions
function toggleNav(){
    if (togglenav_c){
        closeNav();
    }
    else{
        openNav();
    }
    togglenav_c = !togglenav_c;
}

function openNav() {
    document.getElementById("Sidebar").style.width = "160px";
    document.getElementById("main").style.marginLeft = "210px";
    document.getElementById("data_tab").style.width = "calc(100% - 160px - 50px - 10px * 2)";  // - Sidebar - IconBar - Padding
    document.getElementById("data_tab").style.marginLeft = "210px";
}

function closeNav() {
    document.getElementById("Sidebar").style.width = "0px";
    document.getElementById("main").style.marginLeft = "50px"; /* Same as IconBar */
    document.getElementById("data_tab").style.width = "calc(100% - 50px - 10px * 2)"; // - IconBar - Padding
    document.getElementById("data_tab").style.marginLeft = "50px";
}

// Data tab functions
function toggleDataTab(){
    if (toggledatatab_c){
        openDataTab();
    }
    else{
        closeDataTab();
    }
    toggledatatab_c = !toggledatatab_c;
}

function openDataTab() {
    document.getElementById("data_tab_arrow").src = "img/DownArrow.png";
    document.getElementById("data_tab").style.overflow = "auto";
    document.getElementById("data_tab").style.height = "95%";
}

function closeDataTab(){
    document.getElementById("data_tab_arrow").src = "img/UpArrow.png";
    document.getElementById("data_tab").style.overflow = "hidden";
    document.getElementById("data_tab").style.height = "20px";
}

// Video player
function togglePlay(){
    if (!!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2)){ // Is the video playing?
        video.pause();
    }
    else{
        video.play();
    }
}