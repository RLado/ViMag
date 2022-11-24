
# <img title="Logo" alt="Logo: A tuning fork with an eye" src="./img/icon.svg" width="40px"></img>    ViMag: *A Visual Vibration Toolbox*

Vision-based damage detection techinques can reduce sensor deployment costs while providing accurate, useful, and full-field readings of structural behaviour. Our work presents a video processing methodology based on [STB-VMM](https://github.com/RLado/STB-VMM) implemented in a software toolbox that allows the processing of video data to obtain vibrational signatures of complex structures. Our [tests](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4229935) have demonstrated that this technique enables the identification of very light structural damage in a controlled lab environament. This vision-based technique may not be as precise as other contact-based or laser methods, but on the other hand, it offers an easy to use, efective, full-field, tool for structural health monitoring at a fraction of the cost.

## Initial setup

### Linux 
- Run the packaged executable

### Windows
- Install Microsoft Visual C++ Redistributable from [here](https://aka.ms/vs/16/release/vc_redist.x64.exe) (if not installed already)
- Run the packaged executable


## Use instrucctions

To start working with ViMag import a video file using the *File>Import video* menu or click the import icon in the left:

<img src="https://user-images.githubusercontent.com/25719985/203530586-c6216f03-5cdb-4226-bdd1-7cd3635ce857.png" width="600px"></img>

A dialog will open and let you select your desired video file(s). It is advised that input videos be recorded using a tripod and be no longer than 10 seconds approx.

Next, add slices to the areas in which you want to monitor vibration. This areas must have a contrasting color from the background. To add slices switch *Slice Mode* on by clicking the button. Then click once on the video to define the first point of the slice and again to define a second. Now your first slice should appear on screen. 

<img src="https://user-images.githubusercontent.com/25719985/203531232-98eb8e3f-d559-4c7d-8ba7-fa83923ff05f.png" width="600px"></img>
<img src="https://user-images.githubusercontent.com/25719985/203531284-d5542d4e-17af-4665-8d01-5761acf24d18.png" width="600px"></img>

Note that you may click on the left navigation bar to unfold its contents. Further, right clicking each item will allow you to rename or delete the entry. When video items are double clicked they appear on the main window video player.

<img src="https://user-images.githubusercontent.com/25719985/203531424-59c9509b-3898-46b2-a7f4-e0d2bb11a27b.png" width="600px"></img>

Once the slices have been defined it is time for motion magnification computation. Save your project as a **.vl** file and click the cog icon on the left. The icon should spin until calculation is finished. (This may take several minutes)

<img src="https://user-images.githubusercontent.com/25719985/203531613-ba0a7f18-77c7-4946-b65c-45cc747fa1e7.png" width="600px"></img>

Once the calculation is finished unfold the bottom menu to see the magnified slices.

<img src="https://user-images.githubusercontent.com/25719985/203531979-dffe4e3f-666c-4dad-a31e-51f97d31f13a.png" width="600px"></img>

To obtain a numeric signal out of an image you must tell ViMag which colors define the upper and lower bounds of the signal. This can be done by clicking on the image twice, once for upper and a second time for lower. In scenarios like the one on the following picture you might click twice on the white line. Take as many attempts as you need to get a good signal, test the available tunnig parameters.

<img src="https://user-images.githubusercontent.com/25719985/203532454-595fbe58-1ef3-4090-87a9-4bd0bdc090a8.png" width="600px"></img>

Once a good signal has been obtained. You may compute the FFT by clicking the compute button. Note that changing the FFT parameters require FFT recalculation.

<img src="https://user-images.githubusercontent.com/25719985/203532581-f083cba2-af91-4cf2-a508-376fe55077ba.png" width="600px"></img>

If you need the raw data used by the application you may find it in the folder *[name of the project]_data* once the project has been saved.


## Build instructions
- Run ```git submodule update --init --recursive``` to download necesary submodule dependencies.
- Download [STB-VMM](https://github.com/RLado/STB-VMM) latest model checkpoint from [here](https://github.com/RLado/STB-VMM/releases/), and place it in a directory named **ckpt** inside **STB-VMM**. *Alternatively you may train your own model. If you do so remember to change the checkpoint used when calling STB-VMM/run.py in **js/renderer.js***
- Install cpython (v3.10.6) build dependencies for your OS of choice
- Next, run the build scripts and let them package the application for you:

- On Linux:

```bash
npm run dev_setup
npm run package
```

- On Windows:

Using **cmd** run:
```batch
npm run dev_win_setup
npm run package
```

*Note: The application bundles the python interpreter to provide a hassle free portable application, but this increases app size and build time.*