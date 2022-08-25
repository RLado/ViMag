# Vibrolab: *A Visual Vibration Toolbox*

(introducction to the application placeholder)

## Use instrucctions
(soon)


## Build instructions
- Run ```git submodule update --init --recursive``` to download necesary submodule dependencies.
- Download STB-VMM latest model checkpoint from https://github.com/RLado/STB-VMM/releases/ and place it in a directory named **ckpt** inside **STB-VMM**. *Alternatively you may train your own model. If you do so remember to change the checkpoint used when calling STB-VMM/run.py in **js/renderer.js***
- Install cpython (v3.10.6) build dependencies for your OS of choice
- Next, run the build scripts and let them package the application for you:

- On Linux:
```bash
npm install dev_setup
npm run package
```

- On Windows:

Using **cmd** run:
```batch
git submodule update --init --recursive
npm install dev_win_setup
npm run package
```

*Note: The application bundles the python interpreter to provide a hassle free portable application, but this increases app size and build time.*