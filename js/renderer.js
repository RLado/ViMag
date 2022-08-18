// Import ----------------------------------------------------------------------
const { ipcRenderer } = require('electron');
let Dialogs = require('dialogs'); // Don't like it
const dialogs = Dialogs();

const path = require('path');
fs = require('fs');

const { PythonShell } = require('python-shell');
const getDimensions = require('get-video-dimensions');
const sizeOfimg = require('image-size');
const csvtojson = require("csvtojson");


// Functions -------------------------------------------------------------------
function python_test(args) {
    console.log('Testing python')
    let options = {
        args: ['-i "test data"'],
    }
    PythonShell.run('python/test.py', options, function (err, results) {
        if (err) throw err;
        console.log('results: %j', results);
    });
}

// Get click position inside the video element in order to create a slice
function setPtSlice(e) {
    let video_coords = video.getBoundingClientRect();
    let xPosition = e.clientX - video_coords.left;
    let yPosition = e.clientY - video_coords.top;
    if (temp_slice_pt_start[0] == -1 && temp_slice_pt_start[1] == -1) { // First point
        temp_slice_pt_start = [xPosition / video_coords.width, yPosition / video_coords.height];
        console.log(`First slice pt: ${temp_slice_pt_start}`);
    }
    else { // Second point
        temp_slice_pt_stop = [xPosition / video_coords.width, yPosition / video_coords.height];

        // Add new slice to the project
        let target = find_data_by_name(vid_id_disp);
        prj.items[target[0]].items.push(new slice(`slice_${prj.name_num_count}`, [temp_slice_pt_start, temp_slice_pt_stop], false));
        prj.name_num_count++;

        // Set project.saved to false
        prj.saved = false;

        // Reset
        console.log(`Second slice pt: ${temp_slice_pt_stop}`);
        temp_slice_pt_start = [-1, -1];
        temp_slice_pt_stop = [-1, -1];

        // Update interface
        draw_slices();
        update_accordions();
    }
    // alert('pos x:' + xPosition + '/' + video_coords.width + ' pos y: ' + yPosition + '/' + video_coords.height);
}

// Draw video slices
function draw_slices() {
    if (vid_id_disp != '') {
        let target = find_data_by_name(vid_id_disp);
        var video_coords = video.getBoundingClientRect(); // Access values as height and width

        // Get canvas element
        let cnvas = document.getElementById('video_canvas');
        let ctx = cnvas.getContext('2d');

        // Move/Resize canvas
        cnvas.style.left = video_coords.x + 'px';
        cnvas.width = video_coords.width;
        cnvas.height = video_coords.height;

        console.log('Drawing slices');
        for (let i = 0; i < prj.items[target[0]].items.length; i++) {
            ctx.beginPath();
            ctx.lineWidth = "2";
            ctx.strokeStyle = "red";
            ctx.moveTo(prj.items[target[0]].items[i].coord[0][0] * video_coords.width, prj.items[target[0]].items[i].coord[0][1] * video_coords.height);
            ctx.lineTo(prj.items[target[0]].items[i].coord[1][0] * video_coords.width, prj.items[target[0]].items[i].coord[1][1] * video_coords.height);
            ctx.stroke();
        }
    }
}

// Toggle slicing mode
function toggle_slice_mode() {
    draw_slices(); // Resize video canvas

    if (vid_id_disp != '' | slice_state) {
        let vcnvas = document.getElementById("video_canvas"); //get video canvas
        slice_state = !slice_state; // Change state

        video.controls = !slice_state; // If not slicing show controls

        if (slice_state) {
            console.log(`Slice mode activated on ${vid_id_disp}`);

            document.getElementById("play-pause").style.visibility = "visible";
            vcnvas.style.visibility = "visible";
            window.addEventListener("resize", draw_slices, false);
            vcnvas.addEventListener("click", setPtSlice, false);
        }
        else {
            document.getElementById("play-pause").style.visibility = "hidden";
            vcnvas.style.visibility = "hidden";
            window.removeEventListener("resize", draw_slices);
            vcnvas.removeEventListener('click', setPtSlice);
        }
    }
}


// Proceses the slices through the python pipeline
async function process_slices() {
    if (!prj.saved && prj.path == null) {
        alert("The project must be saved before processing");
        ipcRenderer.send('save_as', null);
        return null;
    }
    // Spin the icon to indicate it's working and disable functonality
    document.getElementById("process_slices_btn").innerHTML = '<i class="fa fa-sm fa-cog fa-spin"></i>';
    document.getElementById("process_slices_btn").onclick = null;

    // Do the processing
    for (let i = 0; i < prj.items.length; i++) { // Level 1
        for (let j = 0; j < prj.items[i].items.length; j++) { // Level 2
            if (prj.items[i].items[j].type == 'slice' && !prj.items[i].items[j].processed) {
                console.log(prj.items[i].path);
                console.log(prj.items[i].items[j].coord);

                // Correct coords with original resolution
                let video_res = await getDimensions(prj.items[i].path); //{width: 1920, height:1080};
                prj.items[i].items[j].true_coord = [[
                    prj.items[i].items[j].coord[0][0] * video_res.width,
                    prj.items[i].items[j].coord[0][1] * video_res.height,
                ],
                [
                    prj.items[i].items[j].coord[1][0] * video_res.width,
                    prj.items[i].items[j].coord[1][1] * video_res.height,
                ]
                ];

                // Calculate slice square coord + dim
                function slice2patch64(X) { // Xmin,Xmax => Xmin_new,Xmax_new (Only on one dimension)
                    let W = X[1] - X[0];

                    if (W % 64 === 0 && W != 0) {
                        // floor the result because pixels are integers
                        X[0] = Math.floor(X[0]);
                        X[1] = Math.floor(X[1]);
                        return X;
                    }
                    else {
                        let nlen = 64 * Math.abs(Math.floor(W / 64) + 1);
                        let mid_pt = (X[1] + X[0]) / 2;

                        // floor the result because pixels are integers
                        X[0] = Math.floor(mid_pt - nlen / 2);
                        X[1] = Math.floor(mid_pt + nlen / 2);

                        return X;
                    }
                }

                // --Get Xmin,Xmax Ymin,Ymax from coord
                let X = [0, 0];
                let Y = [0, 0];

                if (prj.items[i].items[j].true_coord[0][0] < prj.items[i].items[j].true_coord[1][0]) {
                    X = [prj.items[i].items[j].true_coord[0][0], prj.items[i].items[j].true_coord[1][0]];
                }
                else {
                    X = [prj.items[i].items[j].true_coord[1][0], prj.items[i].items[j].true_coord[0][0]];
                }

                if (prj.items[i].items[j].true_coord[0][1] < prj.items[i].items[j].true_coord[1][1]) {
                    Y = [prj.items[i].items[j].true_coord[0][1], prj.items[i].items[j].true_coord[1][1]];
                }
                else {
                    Y = [prj.items[i].items[j].true_coord[1][1], prj.items[i].items[j].true_coord[0][1]];
                }
                //console.log({corrected_coord});

                // --Now calculate the square
                X = slice2patch64(X);
                Y = slice2patch64(Y);

                // --So... coord and dim are...
                prj.items[i].items[j].win_coord = [X[0], Y[0]];
                prj.items[i].items[j].win_dim = [X[1] - X[0], Y[1] - Y[0]]; // W,H


                // Set data destination
                prj.items[i].items[j].path_original = prj.data + '/' + prj.items[i].items[j].name + '_original';
                prj.items[i].items[j].path_vmm = prj.data + '/' + prj.items[i].items[j].name + '_vmm';
                prj.items[i].items[j].path_slice = prj.data + '/' + prj.items[i].items[j].name + '_slice';

                // Run python code
                // Split video into frames
                let original_stats;
                let options = {
                    args: [
                        '-i', prj.items[i].path,
                        '-o', prj.items[i].items[j].path_original,
                        '-c', prj.items[i].items[j].win_coord[0], prj.items[i].items[j].win_coord[1],
                        '-d', prj.items[i].items[j].win_dim[0], prj.items[i].items[j].win_dim[1],
                    ],
                };

                //console.log({ options });

                await new Promise((resolve, reject) => {
                    PythonShell.run('python/video2frames.py', options, function (err_v2f, results_v2f) {
                        if (err_v2f) throw err_v2f; // Error callback

                        // Results callback
                        console.log('Video crop results: %j', results_v2f);
                        prj.items[i].framerate = results_v2f[0].split(',')[1];
                        let nframes = results_v2f[0].split(',')[2];
                        nframes = nframes.slice(0, nframes.length - 1) - 1;

                        // Magnify the cut video results
                        options = {
                            args: [
                                '--load_ckpt', './python/STB-VMM/ckpt/ckpt_e49.pth.tar',
                                '--save_dir', prj.items[i].items[j].path_vmm,
                                '--video_path', prj.items[i].items[j].path_original + '/frame',
                                '--num_data', nframes,
                                '--mode', 'static',
                                '-j', 1,
                                '-b', 1,
                                '-m', 20,
                            ],
                        };

                        //console.log({ options });

                        PythonShell.run('python/STB-VMM/run.py', options, function (err_STB, results_STB) {
                            if (err_STB) throw err_STB; // Error callback

                            // Results callback
                            //console.log({ results_STB });

                            // Run slicing
                            // --Correct global coordinates to magnified window
                            let slice_start_coord = [
                                Math.round(prj.items[i].items[j].true_coord[0][0] - prj.items[i].items[j].win_coord[0]),
                                Math.round(prj.items[i].items[j].true_coord[0][1] - prj.items[i].items[j].win_coord[1]),
                            ];
                            let slice_end_coord = [
                                Math.round(prj.items[i].items[j].true_coord[1][0] - prj.items[i].items[j].win_coord[0]),
                                Math.round(prj.items[i].items[j].true_coord[1][1] - prj.items[i].items[j].win_coord[1]),
                            ];

                            // --Run python slicer
                            let slice_files = fs.readdirSync(prj.items[i].items[j].path_vmm);
                            for (let l = 0; l < slice_files.length; l++) {
                                slice_files[l] = prj.items[i].items[j].path_vmm + '/' + slice_files[l];
                            }
                            //console.log({ slice_files });

                            options = {
                                args: [
                                    '-s', slice_start_coord[0], slice_start_coord[1],
                                    '-e', slice_end_coord[0], slice_end_coord[1],
                                    '-o', prj.items[i].items[j].path_slice,
                                    '-i',
                                ].concat(slice_files),
                            };

                            PythonShell.run('python/TempSlice/tempslice.py', options, function (err_slice, results_slice) {
                                if (err_slice) throw err_slice; // Error callback

                                // Results callback
                                console.log(`Slice for ${prj.items[i].items[j].name} completed`);

                                // Flag as processed
                                prj.items[i].items[j].processed = true;

                                // Update data_tab
                                update_data_tab();

                                // Resolve promise
                                resolve({ success: true });
                            });

                        });

                    });
                });

            }
        }
    }
    // Stop the spinning icon and restore functionality
    document.getElementById("process_slices_btn").innerHTML = '<i class="fa fa-sm fa-cog"></i>';
    document.getElementById("process_slices_btn").onclick = function () { process_slices(); };
}

// Populate data tab
function update_data_tab() {
    let data_tab_contents = document.getElementById('data_tab_contents');
    data_tab_contents.innerHTML = '';

    // HTML generation
    for (let i = 0; i < prj.items.length; i++) { // Level 1
        for (let j = 0; j < prj.items[i].items.length; j++) { // Level 2
            if (prj.items[i].items[j].type == 'slice' && prj.items[i].items[j].processed) {
                //console.log(prj.items[i].path);
                //console.log(prj.items[i].items[j].path_slice);

                // Add sliders and image
                data_tab_contents.innerHTML += `
                    <p>
                    <hr color=#a6a6a6>
                    <h3>${prj.items[i].items[j].name}</h3>

                    <input type="checkbox" id="${prj.items[i].items[j].name}_chkbx">
                    <label for="${prj.items[i].items[j].name}_chkbx"> B/W threshold </label>
                    <input id="${prj.items[i].items[j].name}_bw_range_slider" type="range" min="0" max="255" value="128" oninput="${prj.items[i].items[j].name}_bw_range_slider_box.value=${prj.items[i].items[j].name}_bw_range_slider.value">
                    <input id="${prj.items[i].items[j].name}_bw_range_slider_box" type="number" min="0" max="255" value="128" oninput="${prj.items[i].items[j].name}_bw_range_slider.value=${prj.items[i].items[j].name}_bw_range_slider_box.value">
                    <br>
                    
                    Color threshold: 
                    <input id="${prj.items[i].items[j].name}_color_range_slider" type="range" min="0" max="255" value="15" oninput="${prj.items[i].items[j].name}_color_range_slider_box.value=${prj.items[i].items[j].name}_color_range_slider.value">
                    <input id="${prj.items[i].items[j].name}_color_range_slider_box" type="number" min="0" max="255" value="15" oninput="${prj.items[i].items[j].name}_color_range_slider.value=${prj.items[i].items[j].name}_color_range_slider_box.value">
                    <br>

                    <img id="${prj.items[i].items[j].name}_slice_img" src="${prj.items[i].items[j].path_slice}_slice.png" class="slice_img">

                    </p>
                `;

                // Level 3 features
                for (let k = 0; k < prj.items[i].items[j].items.length; k++) { // Level 3
                    if (prj.items[i].items[j].items[k].type == 'signal') { // Signals
                        // Add canvas
                        data_tab_contents.innerHTML += `
                            <p>Signal:</p>
                            <canvas id="${prj.items[i].items[j].items[k].name}_chart" class="slice_img"></canvas><br>
                        `;

                        // Populate canvas with chart
                        csvtojson().fromFile(prj.items[i].items[j].items[k].csv).
                            then((data) => {
                                //console.log(data);
                                const data_time = data.map((obj) => obj.time);
                                const data_ulbp = data.map((obj) => obj['upper lower band pixel']);
                                const data_lubp = data.map((obj) => obj['lower upper band pixel']);

                                new Chart(`${prj.items[i].items[j].items[k].name}_chart`, {
                                    type: "line",
                                    data: {
                                        labels: data_time,
                                        datasets: [{
                                            label: 'upper lower bound',
                                            data: data_ulbp,
                                            borderColor: "red",
                                            fill: false,
                                        }, {
                                            label: 'lower upper bound',
                                            data: data_lubp,
                                            borderColor: "blue",
                                            fill: false,
                                        }]
                                    },
                                    options: {
                                        legend: { display: false },
                                    }
                                });
                            });
                    }

                    if (prj.items[i].items[j].items[k].type == 'FFT') { // FFTs
                        data_tab_contents.innerHTML += `
                            <p>FFT: <button id="${prj.items[i].items[j].items[k].name}_compute_btn" class="generic_button"> Compute </button></p>
                            <p>
                                Data: 
                                <input type="radio" name="${prj.items[i].items[j].items[k].name}_data_col" value="avg" id="${prj.items[i].items[j].items[k].name}_radio_avg">
                                <label for="${prj.items[i].items[j].items[k].name}_radio_avg">avg</label> 
                                <input type="radio" name="${prj.items[i].items[j].items[k].name}_data_col" value="lub" id="${prj.items[i].items[j].items[k].name}_radio_lub">
                                <label for="${prj.items[i].items[j].items[k].name}_radio_lub">lub</label> 
                                <input type="radio" name="${prj.items[i].items[j].items[k].name}_data_col" value="ulb" id="${prj.items[i].items[j].items[k].name}_radio_ulb" checked>
                                <label for="${prj.items[i].items[j].items[k].name}_radio_ulb">ulb</label> 
                            </p>
                            <p>
                                <input type="checkbox" id="${prj.items[i].items[j].items[k].name}_smth_chkbx">
                                <label for="${prj.items[i].items[j].items[k].name}_smth_chkbx"> Smooth </label>
                                <input id="${prj.items[i].items[j].items[k].name}_smth_slider" type="range" min="0" max="1" step="0.01" value="0.02" oninput="${prj.items[i].items[j].items[k].name}_smth_slider_box.value=${prj.items[i].items[j].items[k].name}_smth_slider.value">
                                <input id="${prj.items[i].items[j].items[k].name}_smth_slider_box" type="number" min="0" max="1" step="0.01" value="0.02" oninput="${prj.items[i].items[j].items[k].name}_smth_slider.value=${prj.items[i].items[j].items[k].name}_smth_slider_box.value">
                            </p>
                            <p>
                                <canvas id="${prj.items[i].items[j].items[k].name}_chart" class="slice_img"></canvas>
                            </p>
                            <p>
                                <!-- y_axis scale: 
                                <input type="radio" name="${prj.items[i].items[j].items[k].name}_scale" value="mag" id="${prj.items[i].items[j].items[k].name}_radio_mag" checked>
                                <label for="${prj.items[i].items[j].items[k].name}_radio_mag">mag</label> 
                                <input type="radio" name="${prj.items[i].items[j].items[k].name}_scale" value="log" id="${prj.items[i].items[j].items[k].name}_radio_log">
                                <label for="${prj.items[i].items[j].items[k].name}_radio_log">log</label> -->
                                Crop: 
                                <input id="${prj.items[i].items[j].items[k].name}_crop_start_box" type="number" min="0" max="${prj.items[i].framerate / 2}" value="1.5" step="0.1">
                                <input id="${prj.items[i].items[j].items[k].name}_crop_stop_box" type="number" min="0" max="${prj.items[i].framerate / 2}" value="${prj.items[i].framerate / 2}" step="0.1">
                            </p>
                        `;

                        csvtojson().fromFile(prj.items[i].items[j].items[k].csv).
                            then((data) => {
                                //console.log(data); // 'freq.', 'real', 'imag', 'mag'
                                let data_freq = data.map((obj) => obj['freq.']);
                                let data_real = data.map((obj) => obj['real']);
                                let data_imag = data.map((obj) => obj['imag']);
                                let data_mag = data.map((obj) => obj['mag']);

                                new Chart(`${prj.items[i].items[j].items[k].name}_chart`, {
                                    type: "line",
                                    data: {
                                        labels: data_freq,
                                        datasets: [{
                                            label: 'mag',
                                            data: data_mag,
                                            borderColor: "red",
                                            fill: false,
                                        },]
                                    },
                                    options: {
                                        legend: { display: false },
                                    }
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
                document.getElementById(`${prj.items[i].items[j].name}_slice_img`).addEventListener('click', function (e) {
                    select_treshold_pt(e, [i, j]);
                }, false);

                // BW threshold when click the checkbox
                document.getElementById(`${prj.items[i].items[j].name}_chkbx`).addEventListener('click', function (e) {
                    prj.items[i].items[j].bw_checked = document.getElementById(`${prj.items[i].items[j].name}_chkbx`).checked;
                    bw_threshold([i, j]);
                }, false);

                // BW threshold on change
                document.getElementById(`${prj.items[i].items[j].name}_bw_range_slider`).addEventListener('change', function (e) {
                    prj.items[i].items[j].bw_slider_val = document.getElementById(`${prj.items[i].items[j].name}_bw_range_slider`).value;
                    bw_threshold([i, j]);
                }, false);
                document.getElementById(`${prj.items[i].items[j].name}_bw_range_slider_box`).addEventListener('change', function (e) {
                    prj.items[i].items[j].bw_slider_val = document.getElementById(`${prj.items[i].items[j].name}_bw_range_slider_box`).value;
                    bw_threshold([i, j]);
                }, false);

                // Save color slider value
                document.getElementById(`${prj.items[i].items[j].name}_color_range_slider`).addEventListener('change', function (e) {
                    prj.items[i].items[j].color_slider_val = document.getElementById(`${prj.items[i].items[j].name}_color_range_slider`).value;
                    bw_threshold([i, j]);
                }, false);
                document.getElementById(`${prj.items[i].items[j].name}_color_range_slider_box`).addEventListener('change', function () {
                    prj.items[i].items[j].color_slider_val = document.getElementById(`${prj.items[i].items[j].name}_color_range_slider_box`).value;
                    bw_threshold([i, j]);
                }, false);


                // Restore sliders/UI
                // --BW checkbox
                document.getElementById(`${prj.items[i].items[j].name}_chkbx`).checked = prj.items[i].items[j].bw_checked;
                if (prj.items[i].items[j].bw_checked) {
                    bw_threshold([i, j]);
                }

                // --BW slider
                document.getElementById(`${prj.items[i].items[j].name}_bw_range_slider`).value = prj.items[i].items[j].bw_slider_val;
                document.getElementById(`${prj.items[i].items[j].name}_bw_range_slider_box`).value = prj.items[i].items[j].bw_slider_val;


                // --Color slider
                document.getElementById(`${prj.items[i].items[j].name}_color_range_slider`).value = prj.items[i].items[j].color_slider_val;
                document.getElementById(`${prj.items[i].items[j].name}_color_range_slider_box`).value = prj.items[i].items[j].color_slider_val;

                // Refresh image slices
                bw_threshold([i, j]);
            }

            for (let k = 0; k < prj.items[i].items[j].items.length; k++) { // Level 3
                if (prj.items[i].items[j].items[k].type == 'FFT') {
                    // Compute button
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_compute_btn`).addEventListener('click', () => {
                        signal2fft([i, j, k]);
                    });

                    // FFT radio
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_avg`).addEventListener('change', function (e) {
                        prj.items[i].items[j].items[k].radio_avg = document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_avg`).checked;
                        prj.items[i].items[j].items[k].radio_lub = document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_lub`).checked;
                        prj.items[i].items[j].items[k].radio_ulb = document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_ulb`).checked;
                    }, false);
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_lub`).addEventListener('change', function (e) {
                        prj.items[i].items[j].items[k].radio_avg = document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_avg`).checked;
                        prj.items[i].items[j].items[k].radio_lub = document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_lub`).checked;
                        prj.items[i].items[j].items[k].radio_ulb = document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_ulb`).checked;
                    }, false);
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_ulb`).addEventListener('change', function (e) {
                        prj.items[i].items[j].items[k].radio_avg = document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_avg`).checked;
                        prj.items[i].items[j].items[k].radio_lub = document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_lub`).checked;
                        prj.items[i].items[j].items[k].radio_ulb = document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_ulb`).checked;
                    }, false);

                    // FFT smooth slider
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_smth_chkbx`).addEventListener('change', function () {
                        prj.items[i].items[j].items[k].smth_chkbx = document.getElementById(`${prj.items[i].items[j].items[k].name}_smth_chkbx`).checked;
                    }, false);
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_smth_slider`).addEventListener('change', function () {
                        prj.items[i].items[j].items[k].smth_slider = document.getElementById(`${prj.items[i].items[j].items[k].name}_smth_slider`).value;
                    }, false);
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_smth_slider_box`).addEventListener('change', function () {
                        prj.items[i].items[j].items[k].smth_slider_box = document.getElementById(`${prj.items[i].items[j].items[k].name}_smth_slider_box`).value;
                    }, false);

                    // Crop boxes
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_crop_start_box`).addEventListener('change', function () {
                        prj.items[i].items[j].items[k].crop_start_box = document.getElementById(`${prj.items[i].items[j].items[k].name}_crop_start_box`).value;
                    }, false);
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_crop_stop_box`).addEventListener('change', function () {
                        prj.items[i].items[j].items[k].crop_stop_box = document.getElementById(`${prj.items[i].items[j].items[k].name}_crop_stop_box`).value;
                    }, false);

                    // Restore sliders/UI
                    // Radio
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_avg`).checked = prj.items[i].items[j].items[k].radio_avg;
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_lub`).checked = prj.items[i].items[j].items[k].radio_lub;
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_radio_ulb`).checked = prj.items[i].items[j].items[k].radio_ulb;

                    // FFT smooth slider
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_smth_chkbx`).checked = prj.items[i].items[j].items[k].smth_chkbx;
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_smth_slider`).value = prj.items[i].items[j].items[k].smth_slider;
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_smth_slider_box`).value = prj.items[i].items[j].items[k].smth_slider_box;

                    // Crop boxes
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_crop_start_box`).value = prj.items[i].items[j].items[k].crop_start_box;
                    document.getElementById(`${prj.items[i].items[j].items[k].name}_crop_stop_box`).value = prj.items[i].items[j].items[k].crop_stop_box;
                }

            }
        }
    }

    // Functions:
    // Add click tracking to image element and run slice2csv
    function select_treshold_pt(e, elem) { // e -> event_elem; elem -> [i,j] elements on prj
        let img = document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}_slice_img`);

        let img_coords = img.getBoundingClientRect();
        let xPosition = e.clientX - img_coords.left;
        let yPosition = e.clientY - img_coords.top;
        if (prj.items[elem[0]].items[elem[1]].pt_color_thrhd_up[0] == -1 && prj.items[elem[0]].items[elem[1]].pt_color_thrhd_up[1] == -1) { // First point
            prj.items[elem[0]].items[elem[1]].pt_color_thrhd_up = [xPosition / img_coords.width, yPosition / img_coords.height];
        }
        else { // Second point
            prj.items[elem[0]].items[elem[1]].pt_color_thrhd_low = [xPosition / img_coords.width, yPosition / img_coords.height];

            // Correct coordinates
            const original_img_size = sizeOfimg(`${prj.items[elem[0]].items[elem[1]].path_slice}_slice.png`); // Read img res

            prj.items[elem[0]].items[elem[1]].pt_color_thrhd_up = [ // Use floor() instead of round() to avoid out of range
                Math.floor(prj.items[elem[0]].items[elem[1]].pt_color_thrhd_up[0] * original_img_size.width),
                Math.floor(prj.items[elem[0]].items[elem[1]].pt_color_thrhd_up[0] * original_img_size.height),
            ];
            prj.items[elem[0]].items[elem[1]].pt_color_thrhd_low = [
                Math.floor(prj.items[elem[0]].items[elem[1]].pt_color_thrhd_low[0] * original_img_size.width),
                Math.floor(prj.items[elem[0]].items[elem[1]].pt_color_thrhd_low[1] * original_img_size.height),
            ];

            // Run slice2csv
            let bw_img;

            if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}_chkbx`).checked) {
                bw_img = `${prj.items[elem[0]].items[elem[1]].path_slice}_slice_bw.png`;
            }
            else {
                bw_img = `${prj.items[elem[0]].items[elem[1]].path_slice}_slice.png`;
            }

            // Initialize new signal & fft object (if needed)
            // Check if new signals or FFTs are needed
            let has_signal = false;
            let has_fft = false;
            for (let i = 0; i < prj.items[elem[0]].items[elem[1]].items.length; i++) {
                if (prj.items[elem[0]].items[elem[1]].items[i].type == 'signal') {
                    has_signal = true;
                }
                if (prj.items[elem[0]].items[elem[1]].items[i].type == 'FFT') {
                    has_fft = true;
                }
            }
            if (!has_signal) {
                // Add new signal object
                prj.items[elem[0]].items[elem[1]].items.push(new signal(`${prj.items[elem[0]].items[elem[1]].name}_signal`, `${bw_img}.csv`));

                // Set project.saved to false
                prj.saved = false;
            }
            if (!has_fft) {
                // Add new FFT object
                prj.items[elem[0]].items[elem[1]].items.push(new FFT(`${prj.items[elem[0]].items[elem[1]].name}_FFT`, `${prj.items[elem[0]].items[elem[1]].items[0].csv}_fft.csv`, crop_stop_box = prj.items[elem[0]].framerate / 2));

                // Set project.saved to false
                prj.saved = false;
            }

            let options = {
                args: [
                    '-u', prj.items[elem[0]].items[elem[1]].pt_color_thrhd_up[0], prj.items[elem[0]].items[elem[1]].pt_color_thrhd_up[1],
                    '-l', prj.items[elem[0]].items[elem[1]].pt_color_thrhd_low[0], prj.items[elem[0]].items[elem[1]].pt_color_thrhd_low[1],
                    '-t', document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}_color_range_slider_box`).value,
                    '-i', bw_img,
                    '-o', prj.data,
                ],
            };

            //console.log({ options });

            PythonShell.run('python/TempSlice/slice2csv.py', options, function (err_s2csv, results_s2csv) {
                if (err_s2csv) {
                    // Reset
                    prj.items[elem[0]].items[elem[1]].pt_color_thrhd_up = [-1, -1];
                    prj.items[elem[0]].items[elem[1]].pt_color_thrhd_low = [-1, -1];

                    // Error throw callback
                    throw err_s2csv;
                }

                // Results callback
                console.log(`slice2csv for ${prj.items[elem[0]].items[elem[1]].name} completed`);

                // Reset
                prj.items[elem[0]].items[elem[1]].pt_color_thrhd_up = [-1, -1];
                prj.items[elem[0]].items[elem[1]].pt_color_thrhd_low = [-1, -1];

                // Update accordions
                update_accordions();

                // Refresh image
                bw_threshold([elem[0], elem[1]]);
            });

        }
    }

    // BW threshold image
    function bw_threshold(elem) { // elem -> [i,j] elements on prj
        const d = new Date(); //This will be used to force an image refresh

        if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}_chkbx`).checked) { // BW threshold
            let options = {
                args: [
                    '-t', document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}_bw_range_slider_box`).value,
                    '-i', `${prj.items[elem[0]].items[elem[1]].path_slice}_slice.png`,
                    '-o', `${prj.items[elem[0]].items[elem[1]].path_slice}_slice_bw.png`,
                ],
            };

            //console.log({ options })

            PythonShell.run('python/TempSlice/threshold-slice.py', options, function (err_bwthrhd, results_bwthrhd) {
                if (err_bwthrhd) throw err_bwthrhd; // Error callback

                // Results callback
                document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}_slice_img`).src = `${prj.items[elem[0]].items[elem[1]].path_slice}_slice_bw.png?${d.getMilliseconds()}`;

            });
        }
        else { // If BW checkbox is not checked return to normal color image
            document.getElementById(`${prj.items[elem[0]].items[elem[1]].name}_slice_img`).src = `${prj.items[elem[0]].items[elem[1]].path_slice}_slice.png?${d.getMilliseconds()}`;
        }

    }

    // FFT a signal
    function signal2fft(elem) { // elem -> [i,j,k] elements on prj
        // Data source radio buttons check
        let options;

        // Set crop boxes if empty
        if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_crop_start_box`).value === '') {
            document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_crop_start_box`).value = 0;
        }
        if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_crop_stop_box`).value === '') {
            document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_crop_stop_box`).value = prj.items[elem[0]].framerate / 2;
        }

        // Search for signal component in the item array (generally 0)
        let signal_index = null;
        for (let i = 0; i < prj.items[elem[0]].items[elem[1]].items.length; i++) {
            if (prj.items[elem[0]].items[elem[1]].items[i].type == 'signal') {
                signal_index = i;
                break;
            }
        }
        if (signal_index === null) {
            //console.log("No signal found in slice. Could not calculate FFT.");
            alert('No signal found. Could not calculate FFT.');
            return null;
        }

        if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_radio_avg`).checked) {
            options = {
                args: [
                    '-f', `${prj.items[elem[0]].framerate}`,
                    '-i', `${prj.items[elem[0]].items[elem[1]].items[signal_index].csv}`,
                    '-o', `${prj.items[elem[0]].items[elem[1]].items[elem[2]].csv}_graph.png`,
                    '-od', `${prj.data}`,
                    '-c', document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_crop_start_box`).value, document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_crop_stop_box`).value,
                    '--data_col', 'avg',
                ],
            };
        }
        else if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_radio_lub`).checked) {
            options = {
                args: [
                    '-f', `${prj.items[elem[0]].framerate}`,
                    '-i', `${prj.items[elem[0]].items[elem[1]].items[signal_index].csv}`,
                    '-o', `${prj.items[elem[0]].items[elem[1]].items[elem[2]].csv}_graph.png`,
                    '-od', `${prj.data}`,
                    '-c', document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_crop_start_box`).value, document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_crop_stop_box`).value,
                    '--data_col', 'lub',
                ],
            };
        }
        else if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_radio_ulb`).checked) {
            options = {
                args: [
                    '-f', `${prj.items[elem[0]].framerate}`,
                    '-i', `${prj.items[elem[0]].items[elem[1]].items[signal_index].csv}`,
                    '-o', `${prj.items[elem[0]].items[elem[1]].items[elem[2]].csv}_graph.png`,
                    '-od', `${prj.data}`,
                    '-c', document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_crop_start_box`).value, document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_crop_stop_box`).value,
                    '--data_col', 'ulb',
                ],
            };
        }

        // Add smooth settings if checked
        if (document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_smth_chkbx`).checked) {
            options.args = options.args.concat([
                '--smooth', document.getElementById(`${prj.items[elem[0]].items[elem[1]].items[elem[2]].name}_smth_slider_box`).value,
            ]);
        }

        //console.log('FFT options');
        //console.log({ options });


        PythonShell.run('python/TempSlice/csv-fft.py', options, function (err_csvfft, results_csvfft) {
            if (err_csvfft) throw err_csvfft; // Error callback

            // Results callback
            console.log(`FFT done for: ${prj.items[elem[0]].items[elem[1]].name}`);

            // Update accordions
            update_accordions();

            // Refresh image
            bw_threshold([elem[0], elem[1]]);
        });

    }

}

// Navigation bar functions
function toggleNav() {
    if (togglenav_c) {
        closeNav();
    }
    else {
        openNav();
    }
    togglenav_c = !togglenav_c;

    // Update UI
    draw_slices();
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
function toggleDataTab() {
    if (toggledatatab_c) {
        openDataTab();
    }
    else {
        closeDataTab();
    }
    toggledatatab_c = !toggledatatab_c;
}

function openDataTab() {
    document.getElementById("toggle_data_tab").innerHTML = '<i class="fa-solid fa-caret-down"></i>';
    document.getElementById("data_tab").style.overflow = "auto";
    document.getElementById("data_tab").style.height = "calc(100% - 15px)";
}

function closeDataTab() {
    document.getElementById("toggle_data_tab").innerHTML = '<i class="fa-solid fa-caret-up"></i>';
    document.getElementById("data_tab").style.overflow = "hidden";
    document.getElementById("data_tab").style.height = "15px";
}

// Video player
function togglePlay() {
    if (!!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2)) { // Is the video playing?
        video.pause();
    }
    else {
        video.play();
    }
}

function show_vid(name, path) {
    video.src = path;
    video.poster = '';
    vid_id_disp = name;
    draw_slices();

    console.log('video: ' + path);
}

function update_accordions() { // Reads project object to populate the accordions
    // Save accordion states (To later unfold)
    let acc = document.getElementsByClassName("accordion");
    let unfolded_acc = [];

    for (let i = 0; i < acc.length; i++) {
        if (acc[i].classList.contains("active")) {
            unfolded_acc.push(acc[i].id);
        }
    }

    // Update
    let target = document.getElementById("Sidebar");
    //target.innerHTML = ''; // Empty out the code
    let buffer = '';

    for (let i = 0; i < prj.items.length; i++) { // Level 1 features
        // Video
        //console.log(prj.items[i].path);
        if (prj.items[i].type == 'video_datum') {
            buffer += '<button id=\'' + prj.items[i].name + '\' class="accordion" ondblclick = "show_vid(\'' + prj.items[i].name + '\',\'' + prj.items[i].path + '\')" oncontextmenu = "sb_ctx_rightClick(' + prj.items[i].name + ')">' + prj.items[i].name + '</button>\n';
            buffer += '<div class="accordion_item">\n';
        }
        // Graph
        else {
            buffer += '<button id=\'' + prj.items[i].name + '\' class="accordion" oncontextmenu = "sb_ctx_rightClick(' + prj.items[i].name + ')">' + prj.items[i].name + '</button>\n';
            buffer += '<div class="accordion_item">\n';
        }

        for (let j = 0; j < prj.items[i].items.length; j++) { // Level 2 features
            buffer += '<button id=\'' + prj.items[i].items[j].name + '\' class="accordion" oncontextmenu = "sb_ctx_rightClick(' + prj.items[i].items[j].name + ')">' + prj.items[i].items[j].name + '</button>\n';
            buffer += '<div class="accordion_item">\n';

            for (let k = 0; k < prj.items[i].items[j].items.length; k++) { // Level 3 features
                buffer += '<button id=\'' + prj.items[i].items[j].items[k].name + '\' class="accordion" oncontextmenu = "sb_ctx_rightClick(' + prj.items[i].items[j].items[k].name + ')">' + prj.items[i].items[j].items[k].name + '</button>\n';
                //buffer += '<div class="accordion_item">\n';
            }
            buffer += '</div>';
        }
        buffer += '</div>';
    }

    target.innerHTML = buffer;

    // Add accordions click events
    acc = document.getElementsByClassName("accordion");

    function toggle_acc_item(acc_item) {
        // Toggle between adding and removing the "active" class, to highlight the button that controls the panel
        acc_item.classList.toggle("active");

        // Toggle between hiding and showing the active panel
        let panel = acc_item.nextElementSibling;
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
            toggle_acc_item(this);
        });

        // Restore unfolded accordions
        if (unfolded_acc.includes(acc[i].id)) {
            toggle_acc_item(acc[i]);
        }
    }

    // Update data_tab
    update_data_tab();
}

function hide_sb_ctx_Menu() {
    document.getElementById("sidebarCxtMenu").style.display = "none";
}

function sb_ctx_rightClick(elem) {
    if (document.getElementById("sidebarCxtMenu").style.display == "block") {
        hide_sb_ctx_Menu();
    }
    else {
        let menu = document.getElementById("sidebarCxtMenu");

        // Modify menu
        menu.innerHTML = '';
        menu.innerHTML +=
            `<ul>
        <li onclick="rename_prj_elem(${elem.id})"><a>Rename</a></li>
        <li onclick="delete_prj_elem(${elem.id})"><a>Delete</a></li>
        </ul>`;

        // Place menu on top of clicked element
        menu.style.display = 'block';
        menu.style.left = elem.offsetWidth + "px";
        menu.style.top = elem.offsetTop + "px";
    }
}

function find_data_by_name(name) { // 3 levels of search depth
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

function prj_exists(name) { // Optimizable
    return find_data_by_name(name)[0] != -1 || find_data_by_name(name)[1] != -1 || find_data_by_name(name)[2] != -1;
}

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

function rename_prj_elem(elem) {
    console.log('Renaming element: ')
    console.log({ elem });
    console.log(find_data_by_name(elem.id));

    let target = find_data_by_name(elem.id);

    if (target[1] == -1) {
        dialogs.prompt("Rename:", prj.items[target[0]].name, r => {
            r = sanitizeString(r);

            if (prj_exists(r)) {
                alert('Already created an element named: ' + r);
                throw ('Already existing name');
            }
            else if (r === undefined) {
                console.log('User canceled');
            }
            else {
                prj.items[target[0]].name = r.toString();
                show_vid('', ''); // Deactivate video player to force reselection
                update_accordions();
            }
        })
        //prj.items[target[0]].name = prompt("Rename:", prj.items[target[0]].name);
    }
    else if (target[2] == -1) {
        dialogs.prompt("Rename:", prj.items[target[0]].items[target[1]].name, r => {
            r = sanitizeString(r);

            if (prj_exists(r)) {
                alert('Already created an element named: ' + r);
                throw ('Already existing name');
            }
            else if (r === undefined) {
                console.log('User canceled');
            }
            else {
                prj.items[target[0]].items[target[1]].name = r;
                update_accordions();
            }
        })
        //prj.items[target[0]].items[target[1]].name = prompt("Rename:", prj.items[target[0]].items[target[1]].name);
    }
    else {
        dialogs.prompt("Rename:", prj.items[target[0]].items[target[1]].items[target[2]].name, r => {
            r = sanitizeString(r);

            if (prj_exists(r)) {
                alert('Already created an element named: ' + r);
                throw ('Already existing name');
            }
            else if (r === undefined) {
                console.log('User canceled');
            }
            else {
                prj.items[target[0]].items[target[1]].items[target[2]].name = r;
                update_accordions();
            }
        })
        //prj.items[target[0]].items[target[1]].items[target[2]].name = prompt("Rename:", prj.items[target[0]].items[target[1]].items[target[2]].name);
    }
}

function delete_prj_elem(elem) {
    console.log('Deleting element: ');
    console.log({ elem });

    let target = find_data_by_name(elem.id);

    if (target[1] == -1) {
        prj.items.splice(target[0], 1);

        show_vid('', ''); // Deactivate video player to force reselection
        toggle_slice_mode(); // Deactivate slice mode
    }
    else if (target[2] == -1) {
        prj.items[target[0]].items.splice(target[1], 1);
    }
    else {
        prj.items[target[0]].items[target[1]].items.splice(target[2], 1);
    }

    // Update interface
    update_accordions();
    draw_slices();
}


// Classes ---------------------------------------------------------------------
class prj_dict {
    constructor(name, path = null, saved = false, items = []) {
        this.type = 'prj_dict';
        this.name = name;
        this.saved = saved;
        this.path = path;
        this.items = items;
        this.data = '';

        this.name_num_count = 0;
    }
}

class video_datum {
    constructor(name, path, items = [], start_time = 0, end_time = -1) {
        this.type = 'video_datum';
        this.name = name;
        this.path = path;
        this.items = items;
        this.start_time = start_time;
        this.end_time = end_time;
        this.framerate = -1;
    }
}

class slice {
    constructor(name, coord, true_coord = null, win_coord = null, win_dim = null, processed = false, path_original = null, path_vmm = null, path_slice = null, items = [], bw_checked = false, bw_slider_val = 128, color_slider_val = 15) {
        this.type = 'slice';
        this.name = name;
        this.coord = coord;
        this.true_coord = true_coord;
        this.win_coord = win_coord;
        this.win_dim = win_dim;
        this.processed = processed;
        this.path_original = path_original;
        this.path_vmm = path_vmm;
        this.path_slice = path_slice;
        this.items = items;
        this.pt_color_thrhd_up = [-1, -1];
        this.pt_color_thrhd_low = [-1, -1];

        // Signal generation controls
        this.bw_checked = bw_checked;
        this.bw_slider_val = bw_slider_val;
        this.color_slider_val = color_slider_val;
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
    constructor(name, csv, radio_avg = false, radio_lub = false, radio_ulb = true, smth_chkbx = false, smth_slider = 0.02, smth_slider_box = 0.02, crop_start_box = 1, crop_stop_box = null) {
        this.type = 'FFT';
        this.name = name;
        this.csv = csv;
        // FFT generation controls
        this.radio_avg = radio_avg;
        this.radio_lub = radio_lub;
        this.radio_ulb = radio_ulb;
        this.smth_chkbx = smth_chkbx;
        this.smth_slider_box = smth_slider_box;
        this.crop_start_box = crop_start_box;
        this.crop_stop_box = crop_stop_box;
    }
}

class signal_graph {
    constructor(name, sources) {
        this.type = 'signal_graph';
        this.name = name;
        this.sources = sources;
    }
}

class FFT_graph {
    constructor(name, sources) {
        this.type = 'FFT_graph';
        this.name = name;
        this.sources = sources;
    }
}


// Menu interactions -----------------------------------------------------------
// New project
ipcRenderer.on('new_prj', function (event, args) {
    if (args && !prj.saved) {
        let confirmed = confirm('Are you sure you want to create a new project? All unsaved changes will be lost');
        if (confirmed) {
            prj = new prj_dict('new_project');
        }
    } else if (args && prj.saved) {
        prj = new prj_dict('new_project');
    }
    update_accordions();
    show_vid('', ''); // Deactivate video player to force reselection
    toggle_slice_mode();

    // Stop the spinning icon and restore functionality (if it was)
    document.getElementById("process_slices_btn").innerHTML = '<i class="fa fa-sm fa-cog"></i>';
    document.getElementById("process_slices_btn").onclick = function () { process_slices(); };
});

// Video import
ipcRenderer.on('vimport', function (event, args) {
    for (let i = 0; i < args.length; i++) {
        imp_vid_name_temp = sanitizeString(args[i].split('/')[args[i].split('/').length - 1].split('.')[0]);
        // Check if importing two elements with the same name
        if (prj_exists(imp_vid_name_temp)) {
            alert('Already created an element named: ' + imp_vid_name_temp);
            //throw('Already created an element named: ' + imp_vid_name_temp);
        }
        else {
            // Import elements
            prj.items.push(new video_datum(imp_vid_name_temp, args[i]));
            show_vid(imp_vid_name_temp, args[i]);

            // Set project.saved to false
            prj.saved = false;
        }
    }
    update_accordions();
});

function vimport_req() { // Request video import from button
    ipcRenderer.send('vimport_req', null);
}

// Save project
ipcRenderer.on('save_path', function (event, args) { // Save as
    prj.saved = true;
    prj.name = path.basename(args);
    prj.path = args; // Set project.path (to avoid always saving as)

    console.log({ prj });

    // Update prj_data
    prj.data = path.dirname(args) + '/' + path.basename(args).split('.')[0] + '_data';

    // Serialize project object
    let prj_dict_str = JSON.stringify(prj);

    // Write to file
    fs.mkdir(path.dirname(args) + '/' + path.basename(args).split('.')[0] + '_data', (err) => {
        if (err) {
            return console.error(err);
        }
    });
    fs.writeFile(args, prj_dict_str, 'utf8', function (err) {
        if (err) {
            return console.log(err);
        } else {
            console.log('Saved');
        }
    });
});

function save() {
    if (prj.path != null) {
        prj.saved = true;

        // Serialize project object
        let prj_dict_str = JSON.stringify(prj);

        // Write to file
        fs.writeFile(prj.path, prj_dict_str, 'utf8', function (err) {
            if (err) {
                return console.log(err);
            } else {
                console.log('Saved');
            }
        });
    }
    else {
        // Use the Save As dialog
        ipcRenderer.send('save_as', null);
    }
}

ipcRenderer.on('save', function (event, args) { // Save
    save()
});

// Load project
function load(args) {
    let prj_dict_str = fs.readFileSync(args, 'utf-8').toString();
    prj = JSON.parse(prj_dict_str);
    console.log({ prj });
    update_accordions();

    // Clean UI
    show_vid('', ''); // Deactivate video player to force reselection
    toggle_slice_mode();

    // Stop the spinning icon and restore functionality (if it was)
    document.getElementById("process_slices_btn").innerHTML = '<i class="fa fa-sm fa-cog"></i>';
    document.getElementById("process_slices_btn").onclick = function () { process_slices(); };
}

function load_req() {
    ipcRenderer.send('load_req', null);
}

ipcRenderer.on('load_path', function (event, args) {
    load(args);
});


// Main ------------------------------------------------------------------------
// State variables
let togglenav_c = true;
let toggledatatab_c = true;
let prj = new prj_dict('new_project');

// Slice selector
const video = document.getElementById('video');
let slice_state = false;
let vid_id_disp = '';

let temp_slice_pt_start = [-1, -1];
let temp_slice_pt_stop = [-1, -1];

// Sidebar context menu
document.onclick = hide_sb_ctx_Menu;

// Slice slector initialization
document.getElementById("play-pause").style.visibility = "hidden";

// Initialize UI
update_accordions();