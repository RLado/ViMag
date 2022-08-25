
# <img title="Logo" alt="Logo: A tuning fork with an eye" src="./img/icon.svg" width="40px"></img>    Vibrolab: *A Visual Vibration Toolbox*

(introducction to the application placeholder)

## Use instrucctions

To start working with VibroLab import a video file using the *File>Import video* menu or click the import icon in the left:

<img src="./img/readme_assets/screen02.png" width="600px"></img>

A dialog will open and let you select your desired video file(s). It is advised that input videos be recorded using a tripod and be no longer than 10 seconds approx.

Next, add slices to the areas in which you want to monitor vibration. This areas must have a contrasting color from the background. To add slices switch *Slice Mode* on by clicking the button. Then click once on the video to define the first point of the slice and again to define a second. Now your first slice should appear on screen. 

<img src="./img/readme_assets/screen03.png" width="600px"></img>
<img src="./img/readme_assets/screen04.png" width="600px"></img>

Note that you may click on the left navigation bar to unfold its contents. Further, right clicking each item will allow you to rename or delete the entry. When video items are double clicked they appear on the main window video player.

<img src="./img/readme_assets/screen05.png" width="600px"></img>

Once the slices have been defined it is time for motion magnification computation. Save your project as a **.vl** file and click the cog icon on the left. The icon should spin until calculation is finished. (This may take several minutes)

<img src="./img/readme_assets/screen09.png" width="600px"></img>

Once the calculation is finished unfold the bottom menu to see the magnified slices.

<img src="./img/readme_assets/screen10.png" width="600px"></img>

To obtain a numeric signal out of an image you must tell VibroLab which colors define the upper and lower bounds of the signal. This can be done by clicking on the image twice once for upper and a second time for lower. In scenarios like the one on the following picture you might click twice on the black line. Take as many attempts as you need to get a good signal, test the available tunnig parameters.

<img src="./img/readme_assets/screen11.png" width="600px"></img>

Once a good signal has been obtained. You may compute the FFT by clicking the compute button. Note that changing the FFT parameters require FFT recalculation.

<img src="./img/readme_assets/screen12.png" width="600px"></img>

If you need the raw data used by the application you may find it in the folder *[name of the project]_data* once the project has been saved.


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