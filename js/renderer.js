// Import ----------------------------------------------------------------------
const { ipcRenderer } = require('electron');
let Dialogs = require('dialogs');
const dialogs = Dialogs();

const path = require('path');
const fs = require('fs-extra');
const os = require('os');

const { PythonShell } = require('python-shell');
const csvtojson = require("csvtojson");

const preferences = require("../js/preferences.js");


// Functions -------------------------------------------------------------------
/**
 * Converts an Event to a Promise
 * @param  {HTMLElement} item The item to be stuck with an EventListener
 * @param  {string} event The event to be listened for
 * @return {Promise}      Promise that resolves once the event has triggered
 */
function getPromiseFromEvent(item, event) {
    return new Promise((resolve) => {
        const listener = () => {
            item.removeEventListener(event, listener);
            resolve();
        }
        item.addEventListener(event, listener);
    })
}

/**
 * Get click position inside the video element to create a slice
 * @param  {Event} e Event object passed by an EventListener
 */
function setPtSlice(e) {
    const video = document.getElementById('video');

    let videoCoords = video.getBoundingClientRect();
    let xPosition = e.clientX - videoCoords.left;
    let yPosition = e.clientY - videoCoords.top;
    if (tempSlicePtStart[0] == -1 && tempSlicePtStart[1] == -1) { // First point
        tempSlicePtStart = [xPosition / videoCoords.width, yPosition / videoCoords.height];
        console.log(`First slice pt: ${tempSlicePtStart}`);
    }
    else { // Second point
        tempSlicePtStop = [xPosition / videoCoords.width, yPosition / videoCoords.height];

        // Add new slice to the project
        let target = findDataByName(vidIdDisp);
        prj.items[target[0]].items.push(new slice(`slice_${prj.nameNumCount}`, [tempSlicePtStart, tempSlicePtStop], false));
        prj.nameNumCount++;

        // Set project.saved to false
        prj.saved = false;

        // Reset
        console.log(`Second slice pt: ${tempSlicePtStop}`);
        tempSlicePtStart = [-1, -1];
        tempSlicePtStop = [-1, -1];

        // Update interface
        drawSlices();
        updateAccordions();
    }
    // alert('pos x:' + xPosition + '/' + videoCoords.width + ' pos y: ' + yPosition + '/' + videoCoords.height);
}

/**
 * Draw slices on top of the video canvas
 */
function drawSlices() {
    pref = preferences.loadPreferences();
    const video = document.getElementById('video');

    if (vidIdDisp != '') {
        let target = findDataByName(vidIdDisp);
        var videoCoords = video.getBoundingClientRect(); // Access values as height and width

        // Get canvas element
        let cnvas = document.getElementById('videoCanvas');
        let ctx = cnvas.getContext('2d');

        // Move/Resize canvas
        cnvas.style.left = videoCoords.x + 'px';
        cnvas.width = videoCoords.width;
        cnvas.height = videoCoords.height;

        console.log('Drawing slices');
        for (let i = 0; i < prj.items[target[0]].items.length; i++) {
            // Draw slices
            ctx.beginPath();
            ctx.lineWidth = '2';
            ctx.strokeStyle = pref.sliceColor;
            ctx.moveTo(prj.items[target[0]].items[i].coord[0][0] * videoCoords.width, prj.items[target[0]].items[i].coord[0][1] * videoCoords.height);
            ctx.lineTo(prj.items[target[0]].items[i].coord[1][0] * videoCoords.width, prj.items[target[0]].items[i].coord[1][1] * videoCoords.height);

            // Draws labels
            ctx.font = '14px Helvetica';
            ctx.fillStyle = pref.sliceFontColor;
            ctx.fillText(prj.items[target[0]].items[i].name, prj.items[target[0]].items[i].coord[1][0] * videoCoords.width, prj.items[target[0]].items[i].coord[1][1] * videoCoords.height);

            // Actually draw on the canvas
            ctx.stroke();
        }
    }
}

/**
 * Toggle slicing mode on and off. Redraws or hides slices.
 */
function toggleSliceMode() {
    const video = document.getElementById('video');

    drawSlices(); // Resize video canvas
    let vcnvas = document.getElementById("videoCanvas"); // Get video canvas
    document.getElementById("sliceBtn").disabled = false;

    if (vidIdDisp != '') {
        sliceState = !sliceState; // Change state
        document.getElementById("sliceBtn").checked = false;
        video.controls = !sliceState; // If not slicing show controls

        if (sliceState) {
            console.log(`Slice mode activated on ${vidIdDisp}`);

            document.getElementById("sliceBtn").checked = true;
            document.getElementById("play-pause").style.visibility = "visible";
            vcnvas.style.visibility = "visible";
            window.addEventListener("resize", drawSlices, false);
            vcnvas.addEventListener("click", setPtSlice, false);
        }
        else {
            document.getElementById("sliceBtn").checked = false;
            document.getElementById("play-pause").style.visibility = "hidden";
            vcnvas.style.visibility = "hidden";
            window.removeEventListener("resize", drawSlices);
            vcnvas.removeEventListener('click', setPtSlice);
        }
    }
    else {
        sliceState = false;
        video.controls = !sliceState; // If not slicing show controls

        // Hide slice mode
        document.getElementById("play-pause").style.visibility = "hidden";
        vcnvas.style.visibility = "hidden";
        window.removeEventListener("resize", drawSlices);
        vcnvas.removeEventListener('click', setPtSlice);
    }
}

/**
 * Proceses the slices through the python pipeline
 */
async function processSlices() {
    const video = document.getElementById('video');

    if (!prj.saved && prj.path == null) {
        alert("The project must be saved before processing");
        ipcRenderer.send('saveAs', null);
        return null;
    }
    // Spin the icon to indicate it's working and disable functonality
    document.getElementById("processSlicesBtn").innerHTML = '<i class="fa fa-sm fa-cog fa-spin"></i>';
    document.getElementById("processSlicesBtn").onclick = null;

    // Reload preferences
    pref = preferences.loadPreferences();

    // Do the processing
    for (let i = 0; i < prj.items.length; i++) { // Level 1
        for (let j = 0; j < prj.items[i].items.length; j++) { // Level 2
            if (prj.items[i].items[j].type == 'slice' && (!prj.items[i].items[j].processed || pref.reprocess)) {
                //console.log(prj.items[i].path);
                //console.log(prj.items[i].items[j].coord);

                // Correct coords with original resolution
                showVid(prj.items[i].name, prj.items[i].path);
                await getPromiseFromEvent(video, 'loadedmetadata');
                prj.items[i].items[j].trueCoord = [[
                    prj.items[i].items[j].coord[0][0] * video.videoWidth,
                    prj.items[i].items[j].coord[0][1] * video.videoHeight,
                ],
                [
                    prj.items[i].items[j].coord[1][0] * video.videoWidth,
                    prj.items[i].items[j].coord[1][1] * video.videoHeight,
                ]
                ];

                // Calculate slice square coord + dim
                function slice2patch64(X) { // Xmin,Xmax => XminNew,XmaxNew (Only on one dimension)
                    let W = X[1] - X[0];

                    if (W % 64 === 0 && W != 0) {
                        // floor the result because pixels are integers
                        X[0] = Math.floor(X[0]);
                        X[1] = Math.floor(X[1]);
                        return X;
                    }
                    else {
                        let nlen = 64 * Math.abs(Math.floor(W / 64) + 1);
                        let midPt = (X[1] + X[0]) / 2;

                        // floor the result because pixels are integers
                        X[0] = Math.floor(midPt - nlen / 2);
                        X[1] = Math.floor(midPt + nlen / 2);

                        return X;
                    }
                }

                // --Get Xmin,Xmax Ymin,Ymax from coord
                let X = [0, 0];
                let Y = [0, 0];

                if (prj.items[i].items[j].trueCoord[0][0] < prj.items[i].items[j].trueCoord[1][0]) {
                    X = [prj.items[i].items[j].trueCoord[0][0], prj.items[i].items[j].trueCoord[1][0]];
                }
                else {
                    X = [prj.items[i].items[j].trueCoord[1][0], prj.items[i].items[j].trueCoord[0][0]];
                }

                if (prj.items[i].items[j].trueCoord[0][1] < prj.items[i].items[j].trueCoord[1][1]) {
                    Y = [prj.items[i].items[j].trueCoord[0][1], prj.items[i].items[j].trueCoord[1][1]];
                }
                else {
                    Y = [prj.items[i].items[j].trueCoord[1][1], prj.items[i].items[j].trueCoord[0][1]];
                }
                //console.log({correctedCoord});

                // --Now calculate the square
                X = slice2patch64(X);
                Y = slice2patch64(Y);

                // --If the coordinates go out of bounds balance them
                if (X[0] < 0) {
                    X[1] -= X[0];
                    X[0] = 0;
                }
                if (Y[0] < 0) {
                    Y[1] -= Y[0];
                    Y[0] = 0;
                }
                if (X[1] > video.videoWidth) {
                    X[0] -= X[1] - video.videoWidth;
                    X[1] = video.videoWidth;
                }
                if (Y[1] > video.videoHeight) {
                    Y[0] -= Y[1] - video.videoHeight;
                    Y[1] = video.videoHeight;
                }

                // --So... coord and dim are...
                prj.items[i].items[j].winCoord = [X[0], Y[0]];
                prj.items[i].items[j].winDim = [X[1] - X[0], Y[1] - Y[0]]; // W,H


                // Set data destination
                prj.items[i].items[j].pathOriginal = path.join(prj.data, prj.items[i].items[j].name + 'Original');
                prj.items[i].items[j].pathVmm = path.join(prj.data, prj.items[i].items[j].name + 'Vmm');
                prj.items[i].items[j].pathSlice = path.join(prj.data, prj.items[i].items[j].name + 'Slice');

                // Run python code
                // Split video into frames
                let originalStats;
                let options = {
                    pythonPath: 'python/interpreter/vibrolab_venv/bin/python',
                    args: [
                        '-i', prj.items[i].path,
                        '-o', prj.items[i].items[j].pathOriginal,
                        '-c', prj.items[i].items[j].winCoord[0], prj.items[i].items[j].winCoord[1],
                        '-d', prj.items[i].items[j].winDim[0], prj.items[i].items[j].winDim[1],
                    ],
                };

                //console.log({ options });

                await new Promise((resolve, reject) => {
                    PythonShell.run('python/video2frames.py', options, function (errV2f, resultsV2f) {
                        if (errV2f) { // Error callback
                            // Stop the spinning icon and restore functionality (if it was)
                            document.getElementById("processSlicesBtn").innerHTML = '<i class="fa fa-sm fa-cog"></i>';
                            document.getElementById("processSlicesBtn").onclick = function () { processSlices(); };
                            throw errV2f;
                        }

                        // Results callback
                        //console.log('Video crop results: %j', resultsV2f);
                        prj.items[i].framerate = resultsV2f[0].split(',')[1];
                        let nframes = resultsV2f[0].split(',')[2];
                        nframes = nframes.slice(0, nframes.length - 1) - 1;

                        // Magnify the cut video results
                        options = {
                            pythonPath: 'python/interpreter/vibrolab_venv/bin/python',
                            args: [
                                '--load_ckpt', './python/STB-VMM/ckpt/ckpt_e49.pth.tar',
                                '--save_dir', prj.items[i].items[j].pathVmm,
                                '--video_path', path.join(prj.items[i].items[j].pathOriginal, 'frame'),
                                '--num_data', nframes,
                                '--mode', 'static',
                                '-j', 1,
                                '-b', 1,
                                '-m', pref.alpha,
                                '--device', 'cpu',
                            ],
                        };

                        //console.log({ options });

                        PythonShell.run('python/STB-VMM/run.py', options, function (errSTB, resultsSTB) {
                            if (errSTB) { // Error callback
                                // Stop the spinning icon and restore functionality (if it was)
                                document.getElementById("processSlicesBtn").innerHTML = '<i class="fa fa-sm fa-cog"></i>';
                                document.getElementById("processSlicesBtn").onclick = function () { processSlices(); };
                                throw errSTB;
                            }

                            // Results callback
                            //console.log({ resultsSTB });

                            // Run slicing
                            // --Correct global coordinates to magnified window
                            let sliceStartCoord = [
                                Math.round(prj.items[i].items[j].trueCoord[0][0] - prj.items[i].items[j].winCoord[0]),
                                Math.round(prj.items[i].items[j].trueCoord[0][1] - prj.items[i].items[j].winCoord[1]),
                            ];
                            let sliceEndCoord = [
                                Math.round(prj.items[i].items[j].trueCoord[1][0] - prj.items[i].items[j].winCoord[0]),
                                Math.round(prj.items[i].items[j].trueCoord[1][1] - prj.items[i].items[j].winCoord[1]),
                            ];
                            // --Clamp coordinates to window dimension (Avoids rounding errors)
                            if (sliceStartCoord[0] < 0) {
                                sliceStartCoord[0] = 0;
                            }
                            else if (sliceStartCoord[0] >= prj.items[i].items[j].winDim[0]) {
                                sliceStartCoord[0] = prj.items[i].items[j].winDim[0] - 1;
                            }
                            if (sliceStartCoord[1] < 0) {
                                sliceStartCoord[1] = 0;
                            }
                            else if (sliceStartCoord[1] >= prj.items[i].items[j].winDim[1]) {
                                sliceStartCoord[1] = prj.items[i].items[j].winDim[1] - 1;
                            }
                            if (sliceEndCoord[0] < 0) {
                                sliceEndCoord[0] = 0;
                            }
                            else if (sliceEndCoord[0] >= prj.items[i].items[j].winDim[0]) {
                                sliceEndCoord[0] = prj.items[i].items[j].winDim[0] - 1;
                            }
                            if (sliceEndCoord[1] < 0) {
                                sliceEndCoord[1] = 0;
                            }
                            else if (sliceEndCoord[1] >= prj.items[i].items[j].winDim[1]) {
                                sliceEndCoord[1] = prj.items[i].items[j].winDim[1] - 1;
                            }

                            // --Run python slicer
                            let sliceFiles = fs.readdirSync(prj.items[i].items[j].pathVmm);
                            for (let l = sliceFiles.length - 1; l >= 0; l--) {
                                if (sliceFiles[l].slice(-4) == '.png') {
                                    sliceFiles[l] = path.join(prj.items[i].items[j].pathVmm, sliceFiles[l]);
                                }
                                else {
                                    sliceFiles.splice(l, 1); // pop the item from the array
                                }
                            }
                            //console.log({ sliceFiles });

                            // --Write a file list separated by \n
                            let content = '';
                            for (let fpath = 0; fpath < sliceFiles.length; fpath++) {
                                content += `${sliceFiles[fpath]}\n`;
                            }
                            fs.writeFile(path.join(prj.items[i].items[j].pathVmm, 'list.txt'), content, err => {
                                if (err) {
                                    console.error(err);
                                }
                                // file written successfully
                            });

                            options = {
                                pythonPath: 'python/interpreter/vibrolab_venv/bin/python',
                                args: [
                                    '-s', sliceStartCoord[0], sliceStartCoord[1],
                                    '-e', sliceEndCoord[0], sliceEndCoord[1],
                                    '-o', prj.items[i].items[j].pathSlice,
                                    '-i', path.join(prj.items[i].items[j].pathVmm, 'list.txt'),
                                ],
                            };

                            // Check if coordinates are invalid (too small of a slice)
                            if (sliceStartCoord[0] === sliceEndCoord[0] && sliceStartCoord[1] === sliceEndCoord[1]) {
                                console.log(`${prj.items[i].items[j].name} is of size 0. Ignoring`);

                                // Resolve promise
                                resolve({ success: false });
                            }
                            else {
                                PythonShell.run('python/TempSlice/tempslice.py', options, function (errSlice, resultsSlice) {
                                    if (errSlice) { // Error callback
                                        // Stop the spinning icon and restore functionality (if it was)
                                        document.getElementById("processSlicesBtn").innerHTML = '<i class="fa fa-sm fa-cog"></i>';
                                        document.getElementById("processSlicesBtn").onclick = function () { processSlices(); };

                                        //console.log( {resultsSlice} );
                                        throw errSlice;
                                    }

                                    // Results callback
                                    console.log(`Slice for ${prj.items[i].items[j].name} completed`);

                                    // Flag as processed
                                    prj.items[i].items[j].processed = true;

                                    // Update dataTab
                                    updateDataTab();

                                    // Resolve promise
                                    resolve({ success: true });
                                });
                            }

                        });

                    });
                });

            }
        }
    }
    // Stop the spinning icon and restore functionality
    document.getElementById("processSlicesBtn").innerHTML = '<i class="fa fa-sm fa-cog"></i>';
    document.getElementById("processSlicesBtn").onclick = function () { processSlices(); };
}

/**
 * Proceses full video magnification. (Extremely computationally expensive)
 */
function fullVideoMag() {
    const video = document.getElementById('video');

    if (!prj.saved && prj.path == null) {
        alert("The project must be saved before processing");
        ipcRenderer.send('saveAs', null);
        return null;
    }

    if (video.src === '' || video.src.includes('index.html')) {
        console.log('Nothing to magnify');
        return
    }

    let options = {
        pythonPath: 'python/interpreter/vibrolab_venv/bin/python',
        scriptPath: '.',
        args: [
            '-i', video.src,
            '--temp', path.join(prj.data, 'temp_' + vidIdDisp),
            '-c', './python/STB-VMM/ckpt/ckpt_e49.pth.tar',
            '-o', path.join(prj.data, vidIdDisp + '_x' + pref.fvmAlpha + '.webM'),
            '-m', pref.fvmAlpha,
            '--mode', 'static',
            '-t', pref.tileSize,
            '-j', 4,
            '-b', 1,
            '--device', 'cpu',
        ],
    };

    console.log({ options });
    PythonShell.run('python/tile_mag.py', options, function (errV2f, resultsV2f) {
        if (errV2f) { // Error callback
            throw errV2f;
        }
        // Import magnified video
        console.log('Full video magnification done');
        args = [path.join(prj.data, vidIdDisp + '_x' + pref.fvmAlpha + '.webM')]
        for (let i = 0; i < args.length; i++) {
            impVidNameTemp = sanitizeString(path.basename(args[i]).split('.')[0]);
            // Check if importing two elements with the same name
            if (prjExists(impVidNameTemp)) {
                alert('Already created an element named: ' + impVidNameTemp);
                //throw('Already created an element named: ' + impVidNameTemp);
            }
            else {
                // Import elements
                prj.items.push(new videoDatum(impVidNameTemp, args[i]));
                showVid(impVidNameTemp, args[i]);

                // Set project.saved to false
                prj.saved = false;
            }
        }
        updateAccordions();

    });
}

/**
 * Populate data tab (Slide up graphs tab)
 */
function updateDataTab() {
    let dataTabContents = document.getElementById('dataTabContents');
    dataTabContents.innerHTML = '';

    // HTML generation
    for (let i = 0; i < prj.items.length; i++) { // Level 1
        for (let j = 0; j < prj.items[i].items.length; j++) { // Level 2
            if (prj.items[i].items[j].type == 'slice' && prj.items[i].items[j].processed) {
                //console.log(prj.items[i].path);
                //console.log(prj.items[i].items[j].pathSlice);

                // Add sliders and image
                dataTabContents.innerHTML += `
                    <hr color=#a6a6a6>
                    <h3>${prj.items[i].items[j].name}</h3>

                    <p>
                        <input type="checkbox" id="${prj.items[i].items[j].name}Chkbx" class="genericChkbox">
                        <label for="${prj.items[i].items[j].name}Chkbx"> B/W threshold </label>
                        <input id="${prj.items[i].items[j].name}BwRangeSlider" class="genericSlider" type="range" min="0" max="255" value="128" oninput="${prj.items[i].items[j].name}BwRangeSliderBox.value=${prj.items[i].items[j].name}BwRangeSlider.value">
                        <input id="${prj.items[i].items[j].name}BwRangeSliderBox" class="genericBox" type="number" min="0" max="255" value="128" oninput="${prj.items[i].items[j].name}BwRangeSlider.value=${prj.items[i].items[j].name}BwRangeSliderBox.value">
                    </p>
                    
                    <p>
                        Color threshold: 
                        <input id="${prj.items[i].items[j].name}ColorRangeSlider" class="genericSlider" type="range" min="0" max="255" value="15" oninput="${prj.items[i].items[j].name}ColorRangeSliderBox.value=${prj.items[i].items[j].name}ColorRangeSlider.value">
                        <input id="${prj.items[i].items[j].name}ColorRangeSliderBox" class="genericBox" type="number" min="0" max="255" value="15" oninput="${prj.items[i].items[j].name}ColorRangeSlider.value=${prj.items[i].items[j].name}ColorRangeSliderBox.value">
                    </p>

                    <p>
                        <img id="${prj.items[i].items[j].name}SliceImg" src="${prj.items[i].items[j].pathSlice}_slice.png" class="sliceImg">
                    </p>
                `;

                // Level 3 features
                for (let k = 0; k < prj.items[i].items[j].items.length; k++) { // Level 3
                    if (prj.items[i].items[j].items[k].type == 'signal') { // Signals
                        // Add canvas
                        dataTabContents.innerHTML += `
                            <p>Signal: <button class="genericButton" onclick="dexportReq('${prj.items[i].items[j].items[k].csv.replaceAll('\\', '\\\\')}')"> Export </button>
                            </p>
                            <p>
                                <canvas id="${prj.items[i].items[j].items[k].name}Chart" class="graphFormatLegend"></canvas>
                            </p>
                        `;

                        // Populate canvas with chart
                        csvtojson().fromFile(prj.items[i].items[j].items[k].csv).
                            then((data) => {
                                //console.log(data);
                                const dataTime = data.map((obj) => obj.time);
                                const dataUlbp = data.map((obj) => - obj['upper lower band pixel']);
                                const dataLubp = data.map((obj) => - obj['lower upper band pixel']);

                                // Convert data into the necessary dataset format
                                let signalUlbpPlotData = [];
                                let signalLubpPlotData = [];
                                for (let n = 0; n < dataTime.length; n++) {
                                    signalUlbpPlotData.push({ x: dataTime[n], y: dataUlbp[n] });
                                    signalLubpPlotData.push({ x: dataTime[n], y: dataLubp[n] });
                                }

                                new Chart(`${prj.items[i].items[j].items[k].name}Chart`, {
                                    type: "scatter",
                                    data: {
                                        datasets: [{
                                            label: 'upper lower bound',
                                            data: signalUlbpPlotData,
                                            showLine: true,
                                            borderColor: '#205fac',
                                            fill: false,
                                        }, {
                                            label: 'lower upper bound',
                                            data: signalLubpPlotData,
                                            showLine: true,
                                            borderColor: '#474747',
                                            fill: false,
                                        }]
                                    },
                                    options: {
                                        animation: false,
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        elements: {
                                            point: {
                                                radius: 0,
                                            },
                                        },
                                        plugins: {
                                            legend: {
                                                display: true,
                                                position: 'bottom',
                                            },
                                        },
                                        scales: {
                                            x: {
                                                title: {
                                                    display: true,
                                                    text: 'px',
                                                    color: '#000000',
                                                },
                                                grid: {
                                                    color: '#00000010',
                                                    borderColor: '#000000',
                                                },
                                                ticks: {
                                                    color: '#000000',
                                                    maxTicksLimit: '10',
                                                },
                                            },
                                            y: {
                                                title: {
                                                    display: true,
                                                    text: 'px',
                                                    color: '#000000',
                                                },
                                                grid: {
                                                    color: '#00000010',
                                                    borderColor: '#000000',
                                                },
                                                ticks: {
                                                    color: '#000000',
                                                    maxTicksLimit: '10',
                                                },
                                            },
                                        },
                                    },
                                });
                            });
                    }

                    if (prj.items[i].items[j].items[k].type == 'FFT') { // FFTs
                        dataTabContents.innerHTML += `
                            <p>FFT: <button id="${prj.items[i].items[j].items[k].name}ComputeBtn" class="genericButton"> Compute </button> <button class="genericButton" onclick="dexportReq('${prj.items[i].items[j].items[k].csv.replaceAll('\\', '\\\\')}')"> Export </button>
                            </p>
                            <p>
                                Data: 
                                <input type="radio" name="${prj.items[i].items[j].items[k].name}DataCol" class="genericRadio" value="avg" id="${prj.items[i].items[j].items[k].name}RadioAvg">
                                <label for="${prj.items[i].items[j].items[k].name}RadioAvg">avg</label> 
                                <input type="radio" name="${prj.items[i].items[j].items[k].name}DataCol" class="genericRadio" value="lub" id="${prj.items[i].items[j].items[k].name}RadioLub">
                                <label for="${prj.items[i].items[j].items[k].name}RadioLub">lub</label> 
                                <input type="radio" name="${prj.items[i].items[j].items[k].name}DataCol" class="genericRadio" value="ulb" id="${prj.items[i].items[j].items[k].name}RadioUlb" checked>
                                <label for="${prj.items[i].items[j].items[k].name}RadioUlb">ulb</label> 
                            </p>
                            <p>
                                <input type="checkbox" id="${prj.items[i].items[j].items[k].name}SmthChkbx" class="genericChkbox">
                                <label for="${prj.items[i].items[j].items[k].name}SmthChkbx"> Smooth </label>
                                <input id="${prj.items[i].items[j].items[k].name}SmthSlider" class="genericSlider" type="range" min="0" max="1" step="0.01" value="0.95" oninput="${prj.items[i].items[j].items[k].name}SmthSliderBox.value=${prj.items[i].items[j].items[k].name}SmthSlider.value">
                                <input id="${prj.items[i].items[j].items[k].name}SmthSliderBox" class="genericBox" type="number" min="0" max="1" step="0.01" value="0.95" oninput="${prj.items[i].items[j].items[k].name}SmthSlider.value=${prj.items[i].items[j].items[k].name}SmthSliderBox.value">
                            </p>
                            <p>
                                <canvas id="${prj.items[i].items[j].items[k].name}Chart" class="graphFormat"></canvas>
                            </p>
                            <p>
                                <!-- yAxis scale: 
                                <input type="radio" name="${prj.items[i].items[j].items[k].name}Scale" class="genericRadio" value="mag" id="${prj.items[i].items[j].items[k].name}RadioMag" checked>
                                <label for="${prj.items[i].items[j].items[k].name}RadioMag">mag</label> 
                                <input type="radio" name="${prj.items[i].items[j].items[k].name}Scale" class="genericRadio" value="log" id="${prj.items[i].items[j].items[k].name}RadioLog">
                                <label for="${prj.items[i].items[j].items[k].name}RadioLog">log</label> -->
                                Crop: 
                                <input id="${prj.items[i].items[j].items[k].name}CropStartBox" class="genericBox" type="number" min="0" max="${prj.items[i].framerate / 2}" value="1.5" step="0.1">
                                <input id="${prj.items[i].items[j].items[k].name}CropStopBox" class="genericBox" type="number" min="0" max="${prj.items[i].framerate / 2}" value="${prj.items[i].framerate / 2}" step="0.1">
                            </p>
                        `;

                        csvtojson().fromFile(prj.items[i].items[j].items[k].csv).
                            then((data) => {
                                //console.log(data); // 'freq.', 'real', 'imag', 'mag'
                                let dataFreq = data.map((obj) => obj['freq.']);
                                let dataReal = data.map((obj) => obj['real']);
                                let dataImag = data.map((obj) => obj['imag']);
                                let dataMag = data.map((obj) => obj['mag']);

                                // Convert data into the necessary dataset format
                                let FFTPlotData = [];
                                for (let n = 0; n < dataFreq.length; n++) {
                                    FFTPlotData.push({ x: dataFreq[n], y: dataMag[n] });
                                }

                                new Chart(`${prj.items[i].items[j].items[k].name}Chart`, {
                                    type: "scatter",
                                    data: {
                                        datasets: [
                                            {
                                                label: 'FFT',
                                                data: FFTPlotData,
                                                showLine: true,
                                                fill: false,
                                                borderColor: '#205fac',
                                            },
                                        ]
                                    },
                                    options: {
                                        animation: false,
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        elements: {
                                            point: {
                                                radius: 0,
                                            },
                                        },
                                        plugins: {
                                            legend: {
                                                display: false,
                                                position: 'bottom',
                                            },
                                        },
                                        scales: {
                                            x: {
                                                title: {
                                                    display: true,
                                                    text: 'Hz',
                                                    color: '#000000',
                                                },
                                                grid: {
                                                    color: '#00000010',
                                                    borderColor: '#000000',
                                                },
                                                ticks: {
                                                    color: '#000000',
                                                    precision: 2,
                                                },
                                            },
                                            y: {
                                                title: {
                                                    display: true,
                                                    text: 'Mag. (px)',
                                                    color: '#000000',
                                                },
                                                grid: {
                                                    color: '#00000010',
                                                    borderColor: '#000000',
                                                },
                                                ticks: {
                                                    color: '#000000',
                                                    precision: 2,
                                                },
                                            },
                                        },
                                    },
                                });
                            }).catch(() => {
                                // Do nothing
                                console.log('CSV file still unavailable');
                            });
                    }
                }
            }
        }
    }

    // Re-run the same loop to populate events on the written HTML code
    for (let i = 0; i < prj.items.length; i++) { // Level 1
        for (let j = 0; j < prj.items[i].items.length; j++) { // Level 2
            if (prj.items[i].items[j].type == 'slice' && prj.items[i].items[j].processed) {
                // Image 2 csv click event
                document.getElementById(`${prj.items[i].items[j].name}SliceImg`).addEventListener('click', function (e) {
                    selectTresholdPt(e, [i, j]);
                }, false);

                // BW threshold when click the checkbox
                document.getElementById(`${prj.items[i].items[j].name}Chkbx`).addEventListener('click', function (e) {
                    prj.items[i].items[j].bwChecked = document.getElementById(`${prj.items[i].items[j].name}Chkbx`).checked;
                    bwThreshold([i, j]);
                }, false);

                // BW threshold on change
                document.getElementById(`${prj.items[i].items[j].name}BwRangeSlider`).addEventListener('change', function (e) {
                    prj.items[i].items[j].bwSliderVal = document.getElementById(`${prj.items[i].items[j].name}BwRangeSlider`).value;
                    bwThreshold([i, j]);
                }, false);
                document.getElementById(`${prj.items[i].items[j].name}BwRangeSliderBox`).addEventListener('change', function (e) {
                    prj.items[i].items[j].bwSliderVal = document.getElementById(`${prj.items[i].items[j].name}BwRangeSliderBox`).value;
                    bwThreshold([i, j]);
                }, false);

                // Save color slider value
                document.getElementById(`${prj.items[i].items[j].name}ColorRangeSlider`).addEventListener('change', function (e) {
                    prj.items[i].items[j].colorSliderVal = document.getElementById(`${prj.items[i].items[j].name}ColorRangeSlider`).value;
                    bwThreshold([i, j]);
                }, false);
                document.getElementById(`${prj.items[i].items[j].name}ColorRangeSliderBox`).addEventListener('change', function () {
                    prj.items[i].items[j].colorSliderVal = document.getElementById(`${prj.items[i].items[j].name}ColorRangeSliderBox`).value;
                    bwThreshold([i, j]);
                }, false);


                // Restore sliders/UI
                // --BW checkbox
                document.getElementById(`${prj.items[i].items[j].name}Chkbx`).checked = prj.items[i].items[j].bwChecked;
                if (prj.items[i].items[j].bwChecked) {
                    bwThreshold([i, j]);
                }

                // --BW slider
                document.getElementById(`${prj.items[i].items[j].name}BwRangeSlider`).value = prj.items[i].items[j].bwSliderVal;
                document.getElementById(`${prj.items[i].items[j].name}BwRangeSliderBox`).value = prj.items[i].items[j].bwSliderVal;


                // --Color slider
                document.getElementById(`${prj.items[i].items[j].name}ColorRangeSlider`).value = prj.items[i].items[j].colorSliderVal;
                document.getElementById(`${prj.items[i].items[j].name}ColorRangeSliderBox`).value = prj.items[i].items[j].colorSliderVal;

                // Refresh image slices
                bwThreshold([i, j]);
            }

            for (let k = 0; k < prj.items[i].items[j].items.length; k++) { // Level 3
                if (prj.items[i].items[j].items[k].type == 'FFT') {
                    // Compute button
                    document.getElementById(`${prj.items[i].items[j].items[k].name}ComputeBtn`).addEventListener('click', () => {
                        signal2fft([i, j, k]);
                    });

                    // FFT radio
                    document.getElementById(`${prj.items[i].items[j].items[k].name}RadioAvg`).addEventListener('change', function (e) {
                        prj.items[i].items[j].items[k].radioAvg = document.getElementById(`${prj.items[i].items[j].items[k].name}RadioAvg`).checked;
                        prj.items[i].items[j].items[k].radioLub = document.getElementById(`${prj.items[i].items[j].items[k].name}RadioLub`).checked;
                        prj.items[i].items[j].items[k].radioUlb = document.getElementById(`${prj.items[i].items[j].items[k].name}RadioUlb`).checked;
                    }, false);
                    document.getElementById(`${prj.items[i].items[j].items[k].name}RadioLub`).addEventListener('change', function (e) {
                        prj.items[i].items[j].items[k].radioAvg = document.getElementById(`${prj.items[i].items[j].items[k].name}RadioAvg`).checked;
                        prj.items[i].items[j].items[k].radioLub = document.getElementById(`${prj.items[i].items[j].items[k].name}RadioLub`).checked;
                        prj.items[i].items[j].items[k].radioUlb = document.getElementById(`${prj.items[i].items[j].items[k].name}RadioUlb`).checked;
                    }, false);
                    document.getElementById(`${prj.items[i].items[j].items[k].name}RadioUlb`).addEventListener('change', function (e) {
                        prj.items[i].items[j].items[k].radioAvg = document.getElementById(`${prj.items[i].items[j].items[k].name}RadioAvg`).checked;
                        prj.items[i].items[j].items[k].radioLub = document.getElementById(`${prj.items[i].items[j].items[k].name}RadioLub`).checked;
                        prj.items[i].items[j].items[k].radioUlb = document.getElementById(`${prj.items[i].items[j].items[k].name}RadioUlb`).checked;
                    }, false);

                    // FFT smooth slider
                    document.getElementById(`${prj.items[i].items[j].items[k].name}SmthChkbx`).addEventListener('change', function () {
                        prj.items[i].items[j].items[k].smthChkbx = document.getElementById(`${prj.items[i].items[j].items[k].name}SmthChkbx`).checked;
                    }, false);
                    document.getElementById(`${prj.items[i].items[j].items[k].name}SmthSlider`).addEventListener('change', function () {
                        prj.items[i].items[j].items[k].smthSlider = document.getElementById(`${prj.items[i].items[j].items[k].name}SmthSlider`).value;
                        prj.items[i].items[j].items[k].smthSliderBox = document.getElementById(`${prj.items[i].items[j].items[k].name}SmthSliderBox`).value;
                    }, false);
                    document.getElementById(`${prj.items[i].items[j].items[k].name}SmthSliderBox`).addEventListener('change', function () {
                        prj.items[i].items[j].items[k].smthSlider = document.getElementById(`${prj.items[i].items[j].items[k].name}SmthSlider`).value;
                        prj.items[i].items[j].items[k].smthSliderBox = document.getElementById(`${prj.items[i].items[j].items[k].name}SmthSliderBox`).value;
                    }, false);

                    // Crop boxes
                    document.getElementById(`${prj.items[i].items[j].items[k].name}CropStartBox`).addEventListener('change', function () {
                        prj.items[i].items[j].items[k].cropStartBox = document.getElementById(`${prj.items[i].items[j].items[k].name}CropStartBox`).value;
                    }, false);
                    document.getElementById(`${prj.items[i].items[j].items[k].name}CropStopBox`).addEventListener('change', function () {
                        prj.items[i].items[j].items[k].cropStopBox = document.getElementById(`${prj.items[i].items[j].items[k].name}CropStopBox`).value;
                    }, false);

                    // Restore sliders/UI
                    // Radio
                    document.getElementById(`${prj.items[i].items[j].items[k].name}RadioAvg`).checked = prj.items[i].items[j].items[k].radioAvg;
                    document.getElementById(`${prj.items[i].items[j].items[k].name}RadioLub`).checked = prj.items[i].items[j].items[k].radioLub;
                    document.getElementById(`${prj.items[i].items[j].items[k].name}RadioUlb`).checked = prj.items[i].items[j].items[k].radioUlb;

                    // FFT smooth slider
                    document.getElementById(`${prj.items[i].items[j].items[k].name}SmthChkbx`).checked = prj.items[i].items[j].items[k].smthChkbx;
                    document.getElementById(`${prj.items[i].items[j].items[k].name}SmthSlider`).value = prj.items[i].items[j].items[k].smthSlider;
                    document.getElementById(`${prj.items[i].items[j].items[k].name}SmthSliderBox`).value = prj.items[i].items[j].items[k].smthSliderBox;

                    // Crop boxes
                    document.getElementById(`${prj.items[i].items[j].items[k].name}CropStartBox`).value = prj.items[i].items[j].items[k].cropStartBox;
                    document.getElementById(`${prj.items[i].items[j].items[k].name}CropStopBox`).value = prj.items[i].items[j].items[k].cropStopBox;
                }

            }
        }
    }

    // Functions:
    /**
     * Add click tracking to image element and run slice2csv
     * @param  {Event} e Event object passed by an EventListener
     * @param  {Array} elem [i,j] elements on prj
     */
    function selectTresholdPt(e, elem) { // e -> eventElem; elem -> [i,j] elements on prj
        let img = document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}SliceImg`);

        let imgCoords = img.getBoundingClientRect();
        let xPosition = e.clientX - imgCoords.left;
        let yPosition = e.clientY - imgCoords.top;
        if (prj.items[elem[0]].items[elem[1]].ptColorThrhdUp[0] == -1 && prj.items[elem[0]].items[elem[1]].ptColorThrhdUp[1] == -1) { // First point
            prj.items[elem[0]].items[elem[1]].ptColorThrhdUp = [xPosition / imgCoords.width, yPosition / imgCoords.height];
        }
        else { // Second point
            prj.items[elem[0]].items[elem[1]].ptColorThrhdLow = [xPosition / imgCoords.width, yPosition / imgCoords.height];

            // Correct coordinates
            prj.items[elem[0]].items[elem[1]].ptColorThrhdUp = [ // Use floor() instead of round() to avoid out of range
                Math.floor(prj.items[elem[0]].items[elem[1]].ptColorThrhdUp[0] * img.naturalWidth),
                Math.floor(prj.items[elem[0]].items[elem[1]].ptColorThrhdUp[0] * img.naturalHeight),
            ];
            prj.items[elem[0]].items[elem[1]].ptColorThrhdLow = [
                Math.floor(prj.items[elem[0]].items[elem[1]].ptColorThrhdLow[0] * img.naturalWidth),
                Math.floor(prj.items[elem[0]].items[elem[1]].ptColorThrhdLow[1] * img.naturalHeight),
            ];

            // Run slice2csv
            let bwImg;

            if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}Chkbx`).checked) {
                bwImg = `${prj.items[elem[0]].items[elem[1]].pathSlice}_slice_bw.png`;
            }
            else {
                bwImg = `${prj.items[elem[0]].items[elem[1]].pathSlice}_slice.png`;
            }

            // Initialize new signal & fft object (if needed)
            // Check if new signals or FFTs are needed
            let hasSignal = false;
            let hasFft = false;
            for (let i = 0; i < prj.items[elem[0]].items[elem[1]].items.length; i++) {
                if (prj.items[elem[0]].items[elem[1]].items[i].type == 'signal') {
                    hasSignal = true;
                }
                if (prj.items[elem[0]].items[elem[1]].items[i].type == 'FFT') {
                    hasFft = true;
                }
            }
            if (!hasSignal) {
                // Add new signal object
                prj.items[elem[0]].items[elem[1]].items.push(new signal(`${prj.items[elem[0]].items[elem[1]].name}_Signal`, `${bwImg}.csv`));

                // Set project.saved to false
                prj.saved = false;
            }
            if (!hasFft) {
                // Add new FFT object
                prj.items[elem[0]].items[elem[1]].items.push(new FFT(`${prj.items[elem[0]].items[elem[1]].name}_FFT`, `${prj.items[elem[0]].items[elem[1]].items[0].csv}_fft.csv`, cropStopBox = prj.items[elem[0]].framerate / 2));

                // Set project.saved to false
                prj.saved = false;
            }

            let options = {
                pythonPath: 'python/interpreter/vibrolab_venv/bin/python',
                args: [
                    '-u', prj.items[elem[0]].items[elem[1]].ptColorThrhdUp[0], prj.items[elem[0]].items[elem[1]].ptColorThrhdUp[1],
                    '-l', prj.items[elem[0]].items[elem[1]].ptColorThrhdLow[0], prj.items[elem[0]].items[elem[1]].ptColorThrhdLow[1],
                    '-t', document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}ColorRangeSliderBox`).value,
                    '-i', bwImg,
                    '-o', prj.data,
                ],
            };

            PythonShell.run('python/TempSlice/slice2csv.py', options, function (errS2csv, resultsS2csv) {
                if (errS2csv) {
                    // Reset
                    prj.items[elem[0]].items[elem[1]].ptColorThrhdUp = [-1, -1];
                    prj.items[elem[0]].items[elem[1]].ptColorThrhdLow = [-1, -1];

                    // Error throw callback
                    throw errS2csv;
                }

                // Results callback
                console.log(`slice2csv for ${prj.items[elem[0]].items[elem[1]].name} completed`);

                // Reset
                prj.items[elem[0]].items[elem[1]].ptColorThrhdUp = [-1, -1];
                prj.items[elem[0]].items[elem[1]].ptColorThrhdLow = [-1, -1];

                // Update accordions
                updateAccordions();

                // Refresh image
                bwThreshold([elem[0], elem[1]]);
            });

        }
    }

    // BW threshold image
    /**
     * Apply a binary threshold to a prj element (image)
     * @param  {Array} elem [i,j] elements on prj
     */
    function bwThreshold(elem) { // elem -> [i,j] elements on prj
        const d = new Date(); //This will be used to force an image refresh

        if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}Chkbx`).checked) { // BW threshold
            let options = {
                pythonPath: 'python/interpreter/vibrolab_venv/bin/python',
                args: [
                    '-t', document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}BwRangeSliderBox`).value,
                    '-i', `${prj.items[elem[0]].items[elem[1]].pathSlice}_slice.png`,
                    '-o', `${prj.items[elem[0]].items[elem[1]].pathSlice}_slice_bw.png`,
                ],
            };

            //console.log({ options })

            PythonShell.run('python/TempSlice/threshold-slice.py', options, function (errBwthrhd, resultsBwthrhd) {
                if (errBwthrhd) throw errBwthrhd; // Error callback

                // Results callback
                document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}SliceImg`).src = `${prj.items[elem[0]].items[elem[1]].pathSlice}_slice_bw.png?${d.getMilliseconds()}`;

            });
        }
        else { // If BW checkbox is not checked return to normal color image
            document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}SliceImg`).src = `${prj.items[elem[0]].items[elem[1]].pathSlice}_slice.png?${d.getMilliseconds()}`;
        }

    }

    // FFT a signal
    /**
     * Use a prj signal to generate an FFT using python
     * @param  {Array} elem [i,j,k] elements on prj
     */
    function signal2fft(elem) { // elem -> [i,j,k] elements on prj
        // Data source radio buttons check
        let options;

        // Set crop boxes if empty
        if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}CropStartBox`).value === '') {
            document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}CropStartBox`).value = 0;
        }
        if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}CropStopBox`).value === '') {
            document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}CropStopBox`).value = prj.items[elem[0]].framerate / 2;
        }

        // Search for signal component in the item array (generally 0)
        let signalIndex = null;
        for (let i = 0; i < prj.items[elem[0]].items[elem[1]].items.length; i++) {
            if (prj.items[elem[0]].items[elem[1]].items[i].type == 'signal') {
                signalIndex = i;
                break;
            }
        }
        if (signalIndex === null) {
            //console.log("No signal found in slice. Could not calculate FFT.");
            alert('No signal found. Could not calculate FFT.');
            return null;
        }

        if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}RadioAvg`).checked) {
            options = {
                pythonPath: 'python/interpreter/vibrolab_venv/bin/python',
                args: [
                    '-f', `${prj.items[elem[0]].framerate}`,
                    '-i', `${prj.items[elem[0]].items[elem[1]].items[signalIndex].csv}`,
                    '-o', `${prj.items[elem[0]].items[elem[1]].items[elem[2]].csv}_graph.png`,
                    '-od', `${prj.data}`,
                    '-c', document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}CropStartBox`).value, document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}CropStopBox`).value,
                    '--data_col', 'avg',
                ],
            };
        }
        else if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}RadioLub`).checked) {
            options = {
                pythonPath: 'python/interpreter/vibrolab_venv/bin/python',
                args: [
                    '-f', `${prj.items[elem[0]].framerate}`,
                    '-i', `${prj.items[elem[0]].items[elem[1]].items[signalIndex].csv}`,
                    '-o', `${prj.items[elem[0]].items[elem[1]].items[elem[2]].csv}_graph.png`,
                    '-od', `${prj.data}`,
                    '-c', document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}CropStartBox`).value, document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}CropStopBox`).value,
                    '--data_col', 'lub',
                ],
            };
        }
        else if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}RadioUlb`).checked) {
            options = {
                pythonPath: 'python/interpreter/vibrolab_venv/bin/python',
                args: [
                    '-f', `${prj.items[elem[0]].framerate}`,
                    '-i', `${prj.items[elem[0]].items[elem[1]].items[signalIndex].csv}`,
                    '-o', `${prj.items[elem[0]].items[elem[1]].items[elem[2]].csv}_graph.png`,
                    '-od', `${prj.data}`,
                    '-c', document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}CropStartBox`).value, document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}CropStopBox`).value,
                    '--data_col', 'ulb',
                ],
            };
        }

        // Add smooth settings if checked
        if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}SmthChkbx`).checked) {
            options.args = options.args.concat([
                '--smooth', document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}SmthSliderBox`).value,
            ]);
        }

        //console.log('FFT options');
        //console.log({ options });


        PythonShell.run('python/csv-fft.py', options, function (errCsvfft, resultsCsvfft) {
            if (errCsvfft) throw errCsvfft; // Error callback

            // Results callback
            console.log(`FFT done for: ${prj.items[elem[0]].items[elem[1]].name}`);

            // Update accordions
            updateAccordions();

            // Refresh image
            bwThreshold([elem[0], elem[1]]);
        });

    }

}

// Navigation bar functions
/**
 * Open and close (toggle) the side Navigation Bar (contains accordions)
 */
function toggleNav() {
    if (togglenavC) {
        closeNav();
    }
    else {
        openNav();
    }
    togglenavC = !togglenavC;

    // Update UI
    drawSlices();
    setTimeout(() => drawSlices(), 500); // wait for resize transition to redraw
}

/**
 * Open the side Navigation Bar
 */
function openNav() {
    document.getElementById("Sidebar").style.width = "160px";
    document.getElementById("main").style.marginLeft = "210px";
    document.getElementById("dataTab").style.width = "calc(100% - 160px - 50px - 10px * 2)";  // - Sidebar - IconBar - Padding
    document.getElementById("dataTab").style.marginLeft = "210px";
}

/**
 * Close the side Navigation Bar
 */
function closeNav() {
    document.getElementById("Sidebar").style.width = "0px";
    document.getElementById("main").style.marginLeft = "50px"; /* Same as IconBar */
    document.getElementById("dataTab").style.width = "calc(100% - 50px - 10px * 2)"; // - IconBar - Padding
    document.getElementById("dataTab").style.marginLeft = "50px";
}

// Data tab functions
/**
 * Open and close (toggle) the data tab (or graph tab) containing video 
 * processing results.
 */
function toggleDataTab() {
    if (toggledatatabC) {
        openDataTab();
    }
    else {
        closeDataTab();
    }
    toggledatatabC = !toggledatatabC;
}

/**
 * Open (toggle) the data tab (or graph tab) containing video processing 
 * results.
 */
function openDataTab() {
    document.getElementById("toggleDataTab").innerHTML = '<i class="fa-solid fa-caret-down"></i>';
    document.getElementById("dataTab").style.overflow = "auto";
    document.getElementById("dataTab").style.height = "calc(100% - 15px)";
}

/**
 * Close (toggle) the data tab (or graph tab) containing video processing 
 * results.
 */
function closeDataTab() {
    document.getElementById("toggleDataTab").innerHTML = '<i class="fa-solid fa-caret-up"></i>';
    document.getElementById("dataTab").style.overflow = "hidden";
    document.getElementById("dataTab").style.height = "15px";
}

// Video player
/**
 * Toggle main video playback
 */
function togglePlay() {
    const video = document.getElementById('video');

    if (!!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2)) { // Is the video playing?
        video.pause();
    }
    else {
        video.play();
    }
}

/**
 * Change the video displayed by the main video element
 * @param   {String} name Name of the video file
 * @param   {String} path Path to the video file
 */
function showVid(name, path) {
    const video = document.getElementById('video');

    // Reset slice mode
    vidIdDisp = '';
    document.getElementById("sliceBtn").checked = false;
    toggleSliceMode(); //drawSlices();

    // Change video
    video.src = path;
    video.poster = '';
    vidIdDisp = name;

    console.log('video: ' + path);
}

/**
 * Update NavBar contents with relevant prj data
 */
function updateAccordions() { // Reads project object to populate the accordions
    // Save accordion states (To later unfold)
    let acc = document.getElementsByClassName("accordion");
    let unfoldedAcc = [];

    for (let i = 0; i < acc.length; i++) {
        if (acc[i].classList.contains("active")) {
            unfoldedAcc.push(acc[i].id);
        }
    }

    // Update
    let target = document.getElementById("Sidebar");
    //target.innerHTML = ''; // Empty out the code
    let buffer = '';

    for (let i = 0; i < prj.items.length; i++) { // Level 1 features
        // Video
        //console.log(prj.items[i].path);
        if (prj.items[i].type == 'videoDatum') {
            if (os.platform() === 'win32') {
                buffer += '<button id=\'' + prj.items[i].name + '\' class="accordion" ondblclick = "showVid(\'' + prj.items[i].name + '\',\'' + prj.items[i].path.replaceAll('\\', '\\\\') + '\')" oncontextmenu = "sbCtxRightClick(' + prj.items[i].name + ')">' + prj.items[i].name + '</button>\n';
            }
            else {
                buffer += '<button id=\'' + prj.items[i].name + '\' class="accordion" ondblclick = "showVid(\'' + prj.items[i].name + '\',\'' + prj.items[i].path + '\')" oncontextmenu = "sbCtxRightClick(' + prj.items[i].name + ')">' + prj.items[i].name + '</button>\n';
            }
            buffer += '<div class="accordionItem">\n';
        }
        // Graph
        else {
            buffer += '<button id=\'' + prj.items[i].name + '\' class="accordion" oncontextmenu = "sbCtxRightClick(' + prj.items[i].name + ')">' + prj.items[i].name + '</button>\n';
            buffer += '<div class="accordionItem">\n';
        }

        for (let j = 0; j < prj.items[i].items.length; j++) { // Level 2 features
            buffer += '<button id=\'' + prj.items[i].items[j].name + '\' class="accordion" oncontextmenu = "sbCtxRightClick(' + prj.items[i].items[j].name + ')" ondblclick = "toggleDataTab()">' + prj.items[i].items[j].name + '</button>\n';
            buffer += '<div class="accordionItem">\n';

            for (let k = 0; k < prj.items[i].items[j].items.length; k++) { // Level 3 features
                buffer += '<button id=\'' + prj.items[i].items[j].items[k].name + '\' class="accordion" oncontextmenu = "sbCtxRightClick(' + prj.items[i].items[j].items[k].name + ')">' + prj.items[i].items[j].items[k].name + '</button>\n';
                //buffer += '<div class="accordionItem">\n';
            }
            buffer += '</div>';
        }
        buffer += '</div>';
    }

    target.innerHTML = buffer;

    // Add accordions click events
    acc = document.getElementsByClassName("accordion");

    /**
     * Toggle open/close NavBar items
     * @param   {HTMLElement} accItem An accordion element
     */
    function toggleAccItem(accItem) {
        // Toggle between adding and removing the "active" class, to highlight the button that controls the panel
        accItem.classList.toggle("active");

        // Toggle between hiding and showing the active panel
        let panel = accItem.nextElementSibling;
        if (panel != null) { // panel will be null at the end of the hierarchy
            if (panel.style.display === "block") {
                panel.style.display = "none";
            } else {
                panel.style.display = "block";
            }
        }
    }

    for (let i = 0; i < acc.length; i++) {
        acc[i].addEventListener("click", function () {
            toggleAccItem(this);
        });

        // Restore unfolded accordions
        if (unfoldedAcc.includes(acc[i].id)) {
            toggleAccItem(acc[i]);
        }
    }

    // Update dataTab
    updateDataTab();
}

/**
 * Hide right click context menu of the NavBar (accordions)
 */
function hideSbCtxMenu() {
    document.getElementById("sidebarCxtMenu").style.display = "none";
}

/**
 * Open NavBar context menu (rename, delete)
 * @param   {HTMLElement} elem HTML element
 */
function sbCtxRightClick(elem) {
    if (document.getElementById("sidebarCxtMenu").style.display == "block") {
        hideSbCtxMenu();
    }
    else {
        let menu = document.getElementById("sidebarCxtMenu");

        // Modify menu
        menu.innerHTML = '';
        menu.innerHTML +=
            `<ul>
        <li onclick="renamePrjElem(${elem.id})"><a>Rename</a></li>
        <li onclick="deletePrjElem(${elem.id})"><a>Delete</a></li>
        </ul>`;

        // Place menu on top of clicked element
        let viewportOffset = elem.getBoundingClientRect();
        menu.style.display = 'block';
        menu.style.position = 'fixed';
        menu.style.left = elem.offsetWidth + "px";
        menu.style.top = viewportOffset.top + "px";
    }
}

/**
 * Return the prj coordinates of an element given it's name
 * @param   {String} name Element name as appears in prj
 * @return  {Array}     An array containing the 3 coordinates [i,j,k] of the 
 *                      element searched. If a coordinate position does not 
 *                      exist returns -1 in that position
 */
function findDataByName(name) { // 3 levels of search depth
    for (let i = 0; i < prj.items.length; i++) { // Level 1
        if (prj.items[i].name == name) {
            return [i, -1, -1];
        }

        for (let j = 0; j < prj.items[i].items.length; j++) { // Level 2
            if (prj.items[i].items[j].name == name) {
                return [i, j, -1];
            }

            for (let k = 0; k < prj.items[i].items[j].items.length; k++) { // Level 3
                if (prj.items[i].items[j].items[k].name == name) {
                    return [i, j, k];
                }
            }
        }
    }
    return [-1, -1, -1];
}

/**
 * Check if an element exists inside prj searching by name
 * @param {String} name 
 * @returns {Boolean}
 */
function prjExists(name) { // Optimizable
    return findDataByName(name)[0] != -1 || findDataByName(name)[1] != -1 || findDataByName(name)[2] != -1;
}

/**
 * Removes problematic characters from a String and returns the sanitized String
 * @param {String} str 
 * @returns {String} Sanitized string
 */
function sanitizeString(str) {
    // If undefined return undefined
    if (str === undefined) {
        return str;
    }

    // Sanitize
    str = str.replace(/[^a-z0-9áéíóúñü_]/gim, "");
    if (!isNaN(parseInt(str[0], 10))) {
        return '_' + str.trim();
    }
    else {
        return str.trim();
    }
}

/**
 * Renames an element from prj by name
 * @param {HTMLElement} elem prj element
 */
function renamePrjElem(elem) {
    console.log('Renaming element: ');
    console.log({ elem });
    console.log(findDataByName(elem.id));

    let target = findDataByName(elem.id);

    if (target[1] == -1) {
        dialogs.prompt("Rename:", prj.items[target[0]].name, r => {
            r = sanitizeString(r);

            if (prjExists(r)) {
                alert('Already created an element named: ' + r);
                throw ('Already existing name');
            }
            else if (r === undefined) {
                console.log('User canceled');
            }
            else {
                prj.items[target[0]].name = r.toString();
                showVid('', ''); // Deactivate video player to force reselection
                updateAccordions();
            }
        })
        //prj.items[target[0]].name = prompt("Rename:", prj.items[target[0]].name);
    }
    else if (target[2] == -1) {
        dialogs.prompt("Rename:", prj.items[target[0]].items[target[1]].name, r => {
            r = sanitizeString(r);

            if (prjExists(r)) {
                alert('Already created an element named: ' + r);
                throw ('Already existing name');
            }
            else if (r === undefined) {
                console.log('User canceled');
            }
            else {
                prj.items[target[0]].items[target[1]].name = r;
                updateAccordions();
            }
        })
        //prj.items[target[0]].items[target[1]].name = prompt("Rename:", prj.items[target[0]].items[target[1]].name);
    }
    else {
        dialogs.prompt("Rename:", prj.items[target[0]].items[target[1]].items[target[2]].name, r => {
            r = sanitizeString(r);

            if (prjExists(r)) {
                alert('Already created an element named: ' + r);
                throw ('Already existing name');
            }
            else if (r === undefined) {
                console.log('User canceled');
            }
            else {
                prj.items[target[0]].items[target[1]].items[target[2]].name = r;
                updateAccordions();
            }
        })
        //prj.items[target[0]].items[target[1]].items[target[2]].name = prompt("Rename:", prj.items[target[0]].items[target[1]].items[target[2]].name);
    }

    // Set project.saved to false
    prj.saved = false;
}

/**
 * Removes an element from prj by name
 * @param {HTMLElement} elem prj element
 */
function deletePrjElem(elem) {
    console.log('Deleting element: ');
    console.log({ elem });

    let target = findDataByName(elem.id);

    if (target[1] == -1) {
        prj.items.splice(target[0], 1);

        showVid('', ''); // Deactivate video player to force reselection
    }
    else if (target[2] == -1) {
        prj.items[target[0]].items.splice(target[1], 1);
    }
    else {
        prj.items[target[0]].items[target[1]].items.splice(target[2], 1);
    }

    // Update interface
    updateAccordions();
    drawSlices();

    // Set project.saved to false
    prj.saved = false;
}


// Classes ---------------------------------------------------------------------
class prjDict {
    constructor(name, path = null, saved = false, items = []) {
        this.type = 'prjDict';
        this.name = name;
        this.saved = saved;
        this.path = path;
        this.items = items;
        this.data = '';

        this.nameNumCount = 0;
    }
}

class videoDatum {
    constructor(name, path, items = [], startTime = 0, endTime = -1) {
        this.type = 'videoDatum';
        this.name = name;
        this.path = path;
        this.items = items;
        this.startTime = startTime;
        this.endTime = endTime;
        this.framerate = -1;
    }
}

class slice {
    constructor(name, coord, trueCoord = null, winCoord = null, winDim = null, processed = false, pathOriginal = null, pathVmm = null, pathSlice = null, items = [], bwChecked = false, bwSliderVal = 128, colorSliderVal = 15) {
        this.type = 'slice';
        this.name = name;
        this.coord = coord;
        this.trueCoord = trueCoord;
        this.winCoord = winCoord;
        this.winDim = winDim;
        this.processed = processed;
        this.pathOriginal = pathOriginal;
        this.pathVmm = pathVmm;
        this.pathSlice = pathSlice;
        this.items = items;
        this.ptColorThrhdUp = [-1, -1];
        this.ptColorThrhdLow = [-1, -1];

        // Signal generation controls
        this.bwChecked = bwChecked;
        this.bwSliderVal = bwSliderVal;
        this.colorSliderVal = colorSliderVal;
    }
}

class signal {
    constructor(name, csv) {
        this.type = 'signal';
        this.name = name;
        this.csv = csv;
    }
}

class FFT {
    constructor(name, csv, radioAvg = false, radioLub = false, radioUlb = true, smthChkbx = false, smthSlider = 0.95, smthSliderBox = 0.95, cropStartBox = 1, cropStopBox = null) {
        this.type = 'FFT';
        this.name = name;
        this.csv = csv;
        // FFT generation controls
        this.radioAvg = radioAvg;
        this.radioLub = radioLub;
        this.radioUlb = radioUlb;
        this.smthChkbx = smthChkbx;
        this.smthSliderBox = smthSliderBox;
        this.cropStartBox = cropStartBox;
        this.cropStopBox = cropStopBox;
    }
}

class signalGraph {
    constructor(name, sources) {
        this.type = 'signalGraph';
        this.name = name;
        this.sources = sources;
    }
}

class FFTGraph {
    constructor(name, sources) {
        this.type = 'FFTGraph';
        this.name = name;
        this.sources = sources;
    }
}


// Menu interactions -----------------------------------------------------------
// New project
ipcRenderer.on('newPrj', function (event, args) {
    if (args && !prj.saved) {
        let confirmed = confirm('Are you sure you want to create a new project? All unsaved changes will be lost');
        if (confirmed) {
            prj = new prjDict('newProject');
        }
    } else if (args && prj.saved) {
        prj = new prjDict('newProject');
    }
    updateAccordions();
    showVid('', ''); // Deactivate video player to force reselection

    // Stop the spinning icon and restore functionality (if it was)
    document.getElementById("processSlicesBtn").innerHTML = '<i class="fa fa-sm fa-cog"></i>';
    document.getElementById("processSlicesBtn").onclick = function () { processSlices(); };
});

// Video import
ipcRenderer.on('vimport', function (event, args) {
    for (let i = 0; i < args.length; i++) {
        impVidNameTemp = sanitizeString(path.basename(args[i]).split('.')[0]);
        // Check if importing two elements with the same name
        if (prjExists(impVidNameTemp)) {
            alert('Already created an element named: ' + impVidNameTemp);
            //throw('Already created an element named: ' + impVidNameTemp);
        }
        else {
            // Import elements
            prj.items.push(new videoDatum(impVidNameTemp, args[i]));
            showVid(impVidNameTemp, args[i]);

            // Set project.saved to false
            prj.saved = false;
        }
    }
    updateAccordions();
});

function vimportReq() { // Request video import from button
    ipcRenderer.send('vimportReq', null);
}

// Save project
ipcRenderer.on('savePath', function (event, args) { // Save as
    // Store current project values
    let oldPath = prj.path;
    let oldData = prj.data;

    // Change project name and path
    prj.name = path.basename(args);
    prj.path = args; // Set project.path (to avoid always saving as)

    // Update prjData
    prj.data = path.join(path.dirname(args), path.basename(args).split('.')[0] + 'Data');

    // Serialize project object
    let prjDictStr = JSON.stringify(prj);

    // Correct paths if needed
    if (oldData !== '') {
        prjDictStr = prjDictStr.replaceAll(oldPath, args);
        prjDictStr = prjDictStr.replaceAll(oldData, path.join(path.dirname(args), path.basename(args).split('.')[0] + 'Data'));

        // If there was any project data copy it into the prjData directory
        fs.copySync(oldData, prj.data);
    }
    else {
        fs.mkdir(path.dirname(args) + '/' + path.basename(args).split('.')[0] + 'Data', (err) => {
            if (err) {
                return console.error(err);
            }
        });
    }

    // Write to file   
    fs.writeFileSync(args, prjDictStr, 'utf8', function (err) {
        if (err) {
            return console.log(err);
        } else {
            console.log('Saved');
            prj.saved = true;
        }
    });

    // Load
    prj = JSON.parse(prjDictStr);
});

function save() {
    if (prj.path != null) {
        prj.saved = true;

        // Serialize project object
        let prjDictStr = JSON.stringify(prj);

        // Write to file
        fs.writeFile(prj.path, prjDictStr, 'utf8', function (err) {
            if (err) {
                return console.log(err);
            } else {
                console.log('Saved');
            }
        });
    }
    else {
        // Use the Save As dialog
        ipcRenderer.send('saveAs', null);
    }
}

ipcRenderer.on('save', function (event, args) { // Save
    save()
});

// Load project
function load(args) {
    // Load JSON .vl file
    let prjDictStr = fs.readFileSync(args, 'utf-8').toString();
    prj = JSON.parse(prjDictStr);

    // Correct paths if needed
    if (prj.path !== args) {
        prjDictStr = prjDictStr.replaceAll(prj.path, args);
        prjDictStr = prjDictStr.replaceAll(prj.data, path.join(path.dirname(args), path.basename(args).split('.')[0] + 'Data'));
        // Reload
        prj = JSON.parse(prjDictStr);
    }
    updateAccordions();

    // Clean UI
    showVid('', ''); // Deactivate video player to force reselection

    // Stop the spinning icon and restore functionality (if it was)
    document.getElementById("processSlicesBtn").innerHTML = '<i class="fa fa-sm fa-cog"></i>';
    document.getElementById("processSlicesBtn").onclick = function () { processSlices(); };
}

function loadReq() {
    ipcRenderer.send('loadReq', null);
}

ipcRenderer.on('loadPath', function (event, args) {
    load(args);
});

// Export data
function dexportReq(file) {
    if (fs.existsSync(file)) {
        ipcRenderer.send('dexportReq', null);
        edPath = file;
    }
    else {
        alert('Please compute FFT first');
    }

}

ipcRenderer.on('dexport', function (event, args) {
    console.log(`Exporting: ${args}`);

    if (args.substring(args.length - 4) != '.csv') {
        args += '.csv';
    }

    // File destination.txt will be created or overwritten by default.
    fs.copyFile(edPath, args, (err) => {
        if (err) {
            throw err;
        }
    }
    );

    // Empty edPath
    edPath = '';
});

// Main ------------------------------------------------------------------------
// State variables
let togglenavC = true;
let toggledatatabC = true;
let prj = new prjDict('newProject');
let pref = preferences.loadPreferences();
// Update button visibility (requires restart)
if (pref.fullVideoMagEnable) {
    document.getElementById("fullVideoMagButton").style.visibility = "visible";
}
else {
    document.getElementById("fullVideoMagButton").style.visibility = "hidden";
}

// Slice selector
let sliceState = false;
let vidIdDisp = '';

let tempSlicePtStart = [-1, -1];
let tempSlicePtStop = [-1, -1];

// Sidebar context menu
document.onclick = hideSbCtxMenu;

// Slice slector initialization
document.getElementById("play-pause").style.visibility = "hidden";

// Export data PATH
let edPath = '';

// Initialize UI
updateAccordions();