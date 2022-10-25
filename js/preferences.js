const path = require('path');
const fs = require('fs');


class preferences {
    constructor() {
        // Motion magnification compute
        this.alpha = 20;
        this.reprocess = false;

        // Full video motion magnification compute
        this.fullVideoMagEnable = false;
        this.fvmAlpha = 20;
        this.tileSize = 512;
    }
}

/**
 * Loads the preferences from the ./preferences.json file
 * @returns {preferences}  Preferences object
 */
function loadPreferences() {
    if (fs.existsSync('./preferences.json')) {
        console.log('Loading preferences from ./preferences.json');
        let prefDictStr = fs.readFileSync('./preferences.json', 'utf-8').toString();
        return JSON.parse(prefDictStr);
    }
    else {
        console.log('No preferences file found. Loading defaults');
        return new preferences();
    }

}

/**
 * Save preferences dialog to ./preferences.json
 */
function savePreferences() {
    pref = new preferences();

    // Get preferences

    // Motion magnification compute preferences
    pref.alpha = document.getElementById('MagFactorCombobox').value;
    pref.reprocess = document.getElementById('reprocessChkbox').checked;

    // Full video motion magnifiaction compute preferences
    pref.fullVideoMagEnable = document.getElementById('fullVideoMagChkbox').checked;
    pref.fvmAlpha = document.getElementById('FullMagFactorCombobox').value;
    pref.tileSize = document.getElementById('TileSizeCombobox').value;

    // Serialize project object
    let prefDictStr = JSON.stringify(pref);

    // Save file
    fs.writeFile('./preferences.json', prefDictStr, 'utf8', function (err) {
        if (err) {
            return console.log(err);
        } else {
            console.log('Saved preferences');
        }
    });

}

/**
 * Read the preference file and place the configuration in the preferences dialog
 */
function readPref() {
    let pref = loadPreferences();

    // Read and display alpha
    for (var i = 0; i < document.getElementById('MagFactorCombobox').length; i++) {
        if (document.getElementById('MagFactorCombobox').options[i].value == pref.alpha) {
            document.getElementById('MagFactorCombobox').selectedIndex = i;
        }
    }

    // Read and display reprocess checkbox
    document.getElementById('reprocessChkbox').checked = pref.reprocess;

    // Read and display full video motion magnifiaction compute preferences
    document.getElementById('fullVideoMagChkbox').checked = pref.fullVideoMagEnable;

    for (var i = 0; i < document.getElementById('FullMagFactorCombobox').length; i++) {
        if (document.getElementById('FullMagFactorCombobox').options[i].value == pref.fvmAlpha) {
            document.getElementById('FullMagFactorCombobox').selectedIndex = i;
        }
    }

    for (var i = 0; i < document.getElementById('TileSizeCombobox').length; i++) {
        if (document.getElementById('TileSizeCombobox').options[i].value == pref.tileSize) {
            document.getElementById('TileSizeCombobox').selectedIndex = i;
        }
    }

}

// Module exports
module.exports = { preferences, loadPreferences };