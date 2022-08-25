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
            if (platform.platform === 'linux') {
                
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
                    "./out/vibrolab_dev/vibrolab-linux-x64/resources/app/python", 
                    "./out/vibrolab_dev/vibrolab-linux-x64/python"
                )
            }

            // Windows build
            if (platform.platform === 'win32') {
                // Move python files to the root of the package
                fse.move(
                    "./out/vibrolab_dev/vibrolab-win32-x64/resources/app/python", 
                    "./out/vibrolab_dev/vibrolab-win32-x64/python"
                )
            }
        }, 
    },
    buildIdentifier: 'vibrolab_dev'
}

