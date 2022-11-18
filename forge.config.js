const fse = require('fs-extra');

module.exports = {
    packagerConfig: {
        icon: './img/icon.ico',
        appCopyright: 'Copyright (c) 2022 Ricard Lado',
    },
    electronRebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-flatpak',
            platforms: ['linux'],
            config: {
                summary: 'A video vibration toolbox',
            },
        },
        {
            name: '@electron-forge/maker-squirrel',
            platforms: ['windows'],
            config: {
                name: "vibrolab",
            },
        },
        
    ],
    publishers: [],
    plugins: [],
    hooks: {
        generateAssets: async (forgeConfig, platform, arch) => { // Runs before start
            // Linux build
            if (platform === 'linux') {
                
            }

            // Windows build
            if (platform === 'win32') {
                
            }
        },
        
        prePackage: async (forgeConfig, platform, arch) => { // Runs before package
            // Print arguments
            //console.log({forgeConfig});
            console.log('');
            console.log({platform});
            console.log({arch});

            // Linux build
            if (platform.platform === 'linux') {interpreter
                
            }

            // Windows build
            if (platform.platform === 'win32') {

            }
        },
        
        postPackage: async (forgeConfig, platform, arch) => { // Runs after package
            // Linux build
            if (platform.platform === 'linux') {
                // Move python files to the root of the package
                fse.move(
                    "./out/vibrolab_v0.1.5/vibrolab-linux-x64/resources/app/python", 
                    "./out/vibrolab_v0.1.5/vibrolab-linux-x64/python"
                );
            }

            // Windows build
            if (platform.platform === 'win32') {
                // Move python files to the root of the package
                fse.moveSync(
                    "./out/vibrolab_v0.1.5/vibrolab-win32-x64/resources/app/python", 
                    "./out/vibrolab_v0.1.5/vibrolab-win32-x64/python"
                );
                fse.copySync(
                    "./out/vibrolab_v0.1.5/vibrolab-win32-x64/python/interpreter/externals/tcltk-8.6.12.0/amd64/lib/tcl8.6",
                    "./out/vibrolab_v0.1.5/vibrolab-win32-x64/python/interpreter/PCbuild/lib/tcl8.6"
                );
                fse.copySync(
                    "./out/vibrolab_v0.1.5/vibrolab-win32-x64/python/interpreter/externals/tcltk-8.6.12.0/amd64/lib/tk8.6",
                    "./out/vibrolab_v0.1.5/vibrolab-win32-x64/python/interpreter/PCbuild/lib/tcl8.6/tk8.6"
                );
            }
        }, 
    },
    buildIdentifier: 'vibrolab_v0.1.5'
}

