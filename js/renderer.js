// Import ----------------------------------------------------------------------
const {ipcRenderer} = require('electron');
let {PythonShell} = require('python-shell');
fs = require('fs');


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

function show_vid(path){
    video.src = path;
    console.log('video: '+ path);
}

function update_accordions(){ // Reads project object to populate the accordions
    var target = document.getElementById("Sidebar");
    target.innerHTML = ""; // Empty out the code

    for (let i=0; i < prj.items.length; i++) { // Level 1 features
        // Video
        console.log(prj.items[i].path);
        if (prj.items[i].type == 'video_datum'){
            target.innerHTML += '<button id="'+prj.items[i].name+'"class="accordion" ondblclick = "show_vid(\'' + prj.items[i].path + '\')" oncontextmenu = "sb_ctx_rightClick(' + prj.items[i].name + ')">'+prj.items[i].name+'</button>\n';
            target.innerHTML += '<div class="accordion_item">\n';
        }
        // Graph
        else {
            target.innerHTML += '<button id="'+prj.items[i].name+'"class="accordion" oncontextmenu = "sb_ctx_rightClick(' + prj.items[i].name + ')">'+prj.items[i].name+'</button>\n';
            target.innerHTML += '<div class="accordion_item">\n';
        }

        for (let j=0; j < prj.items[i].items.length; j++) { // Level 2 features
            target.innerHTML += '<button id="'+prj.items[i].items[j].name+'"class="accordion" oncontextmenu = "sb_ctx_rightClick(' + prj.items[i].name + ')">'+prj.items[i].items[j].name+'</button>\n';
            target.innerHTML += '<div class="accordion_item">\n';

            for (let k=0; k < prj.items[i].items[j].items.length; k++) { // Level 3 features
                target.innerHTML += '<button id="'+prj.items[i].items[j].items[k].name+'"class="accordion" oncontextmenu = "sb_ctx_rightClick(' + prj.items[i].name + ')">'+prj.items[i].items[j].items[k].name+'</button>\n';
                //target.innerHTML += '<div class="accordion_item">\n';
            }
        }
    }
}

function hide_sb_ctx_Menu() {
    document.getElementById("sidebarCxtMenu").style.display = "none";
}

function sb_ctx_rightClick(elem) {
    console.log({elem});

    if (document.getElementById("sidebarCxtMenu").style.display == "block"){
        hide_sb_ctx_Menu();
    }
    else {
        var menu = document.getElementById("sidebarCxtMenu")
            
        menu.style.display = 'block';
        menu.style.left = elem.offsetWidth + "px";
        menu.style.top = elem.offsetTop + "px";
    }
}

function find_data_by_name(name){ // 3 levels of search depth
    for (let i=0; i<prj.items.length; i++){ // Level 1
        if (prj.items[i].name == name){
            return [i, -1, -1];
        }

        for (let j=0; j<prj.items[i].items.length; j++){ // Level 2
            if (prj.items[i].items[j].name == name){
                return [i, j, -1];
            }

            for (let k=0; k<prj.items[i].items[j].items.length; k++){ // Level 3
                if (prj.items[i].items[j].items[k].name == name){
                    return [i, j, k];
                }
            }
        }
    }
    return [-1,-1,-1];
}

// Classes ---------------------------------------------------------------------
class prj_dict {
    constructor(name, saved=false, items=[]){
        this.type = 'prj_dict';
        this.name = name;
        this.saved = saved;
        this.items = items;
    }
}

class video_datum {
    constructor(name, path, items = [], start_time = 0, end_time = -1){
        this.type = 'video_datum';
        this.name = name;
        this.path = path;
        this.items = items;
        this.start_time = start_time;
        this.end_time = end_time;
    }
}

class slice {
    constructor(name, coord, processed = false, path_vmm = null, slice_path = null, items = []){
        this.type = 'slice';
        this.name = name;
        this.coord = coord;
        this.processed = processed;
        this.path_vmm = path_vmm;
        this.slice_path = slice_path;
        this.items = items;
    }
}

class signal {
    constructor(name, csv){
        this.type = 'signal';
        this.name = name;
        this.csv = csv;
    }
}

class FFT {
    constructor(name, csv){
        this.type = 'FFT';
        this.name = name;
        this.csv = csv;
    }
}

class signal_graph {
    constructor(name, sources){
        this.type = 'signal_graph';
        this.name = name;
        this.sources = sources;
    }
}

class FFT_graph {
    constructor(name, sources){
        this.type = 'FFT_graph';
        this.name = name;
        this.sources = sources;
    }
}

// Menu interactions -----------------------------------------------------------

// New project
ipcRenderer.on('new_prj', function(event, args){
    if(args && !prj.saved){
        let confirmed = confirm('Are you sure you want to create a new project? All unsaved changes will be lost');
        if (confirmed){
            prj = new prj_dict('new_project');
        }
    }else if(args && prj.saved){
        prj = new prj_dict('new_project');
    }
    update_accordions();
});

// Video import
ipcRenderer.on('vimport', function(event, args){
    for (let i = 0; i < args.length; i++) {
        imp_vid_name_temp = args[i].split('/')[args[i].split('/').length - 1].split('.')[0]
        // Check if importing two elements with the same name
        if (find_data_by_name(imp_vid_name_temp)[0]!=-1 || find_data_by_name(imp_vid_name_temp)[1]!=-1 || find_data_by_name(imp_vid_name_temp)[2]!=-1){
            alert('Already created an element named: '+imp_vid_name_temp);
            //throw('Already created an element named: '+imp_vid_name_temp);
        }
        else{
            // Import elements
            prj.items.push(new video_datum(imp_vid_name_temp,args[i]));
            video.src = args[i];
        }
    }
    update_accordions();
});

// Save project
ipcRenderer.on('save_path', function(event, args){
    prj.saved = true;
    prj.name = args.split('/')[args.split('/').length - 1];

    console.log({ prj });

    // Serialize project object
    let prj_dict_str = JSON.stringify(prj);
    
    // Write to file
    fs.writeFile(args, prj_dict_str, 'utf8', function (err) {
        if (err){
            return console.log(err);
        } else{
            console.log('Saved');
        }
    });
});

// Load project
ipcRenderer.on('load_path', function(event, args){
    let prj_dict_str = fs.readFileSync(args, 'utf-8').toString();
    prj = JSON.parse(prj_dict_str);
    console.log({prj});
    update_accordions();
});

// Accordions
let acc = document.getElementsByClassName("accordion");

for (let i = 0; i < acc.length; i++) {
    acc[i].addEventListener("click", function() {
        // Toggle between adding and removing the "active" class, to highlight the button that controls the panel
        this.classList.toggle("active");

        // Toggle between hiding and showing the active panel
        var panel = this.nextElementSibling;
        if (panel.style.display === "block") {
            panel.style.display = "none";
        } else {
            panel.style.display = "block";
        }
    });
}

// Main ------------------------------------------------------------------------
// State variables
let togglenav_c = true;
let toggledatatab_c = true;
let prj = new prj_dict('new_project');

// Slice selector
const video = document.getElementById('video');
video.addEventListener("click", getClickPosition, false);

// Sidebar context menu
document.onclick = hide_sb_ctx_Menu;