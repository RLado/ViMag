import numpy as np
from PIL import Image
import cv2
import argparse
import os
import shutil

# STB-VMM imports
import sys
sys.path.insert(1, './python/Tiled-STB-VMM/STB-VMM')
from utils import pad_img
import run

# Progressbar imports
from tkinter import ttk
import tkinter as tk
from tkinter.messagebox import showinfo
import threading


class STB_args:
    def __init__(
            self,
            mag, 
            video_path, 
            save_dir,
            load_ckpt,
            num_data,
            mode = 'static',
            device = 'auto',
            workers = 4, 
            batch_size = 1,
            print_freq = 1000
        ):
        self.workers = workers
        self.batch_size = batch_size
        self.load_ckpt = load_ckpt
        self.save_dir = save_dir
        self.device = device
        self.mag = mag
        self.mode = mode
        self.video_path = video_path
        self.num_data = num_data
        self.print_freq = print_freq


def vid2frames(vid_path, out_path = '.', crop = None): #Frame extractor function
    """
    Extracts frames from a video and saves them on a user designated directory.

    Parameters:
        vid_path (str): Path to the source video
        out_path (str): Path to output the extracted frames (the directory will 
            be created if it does not exist). Default = .
        crop (tuple): Crop region defined by a tuple containing a top left 
            coordinate and Width + Height, e.g. ((0,0),(100,100)). Default = None

    Returns:
        tuple: True if sucessful; Framerate; Frame count; List of frames' paths

    """
    
    vidObj = cv2.VideoCapture(vid_path)
    fps = vidObj.get(cv2.CAP_PROP_FPS) # Get framerate

    count = 0
    success = 1
    
    # Check if output path exisist, if not create directory
    if not os.path.exists(out_path):
        os.makedirs(out_path)

    frames = []
    while True:
        success, image = vidObj.read()
        if success:
            # Saves the frames with frame-count
            if crop == None:
                cv2.imwrite(os.path.join(out_path,'frame_%06d.png' % count), image)
            else:
                cv2.imwrite(os.path.join(out_path,'frame_%06d.png' % count), image[crop[0][1]:crop[0][1]+crop[1][1],crop[0][0]:crop[0][0]+crop[1][0]])
            frames.append(os.path.join(out_path,'frame_%06d.png' % count))
            count += 1
        else:
            break
    
    return True, fps, count-1, frames


def tile(img, tile_size = 128, overlap = 30):
    # Load Image
    frame = Image.open(img).convert('RGB')

    # Calculate tiling stride
    stride = tile_size - overlap
    # - width
    nx_tiles=len(range(tile_size, frame.size[0]+tile_size, stride))
    x_pad = 0
    while (frame.size[0]+x_pad)%stride != 0:
        x_pad += 2

    # - height
    ny_tiles=len(range(tile_size, frame.size[1]+tile_size, stride))
    y_pad = 0
    while (frame.size[1]+y_pad)%stride != 0:
        y_pad += 2

    # Pad image
    frame = pad_img.pad_img(frame, frame.size[0]+x_pad+overlap, frame.size[1]+y_pad+overlap)

    # Convert to OpenCV format
    frame = np.array(frame) 
    # Convert RGB to BGR 
    frame = frame[:, :, ::-1].copy()

    # Break into tiles
    tiles = []
    for i in range(tile_size, frame.shape[1]+1, stride): # X axis
        for j in range(tile_size, frame.shape[0]+1, stride): #Y axis
            tiles.append(frame[j-tile_size:j, i-tile_size:i])
            assert(tiles[-1].shape[0] == tile_size)
            assert(tiles[-1].shape[1] == tile_size)
    
    return tiles, frame.shape


def stitch(tiles, frame_shape, stride = 98):
    # Read tile_size
    tile_size = tiles[0].shape[0]

    # Generate placeholder black frame
    s = np.zeros(frame_shape, dtype='uint8')

    t = 0
    for i in range(tile_size, frame_shape[1]+1, stride): # X axis
        for j in range(tile_size, frame_shape[0]+1, stride): #Y axis
            s[j-tile_size:j, i-tile_size:i] = tiles[t]
            t += 1
    t = 0
    for i in range(tile_size, frame_shape[1]+1, stride*2): # X axis
        for j in range(tile_size, frame_shape[0]+1, stride*2): #Y axis
            s[j-tile_size:j, i-tile_size:i] = s[j-tile_size:j, i-tile_size:i]*.5 + tiles[t]*.5
            t += 2
        if len(range(tile_size, frame_shape[0]+1, stride))%2 != 0:
            t -= 1
        t += len(range(tile_size, frame_shape[0]+1, stride))

    return s


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Tiled STB-VMM: Break large videos into tiles, magnify those tiles and stitch\'em together. Makes large videos processable with low amounts of RAM ')

    # Application parameters
    parser.add_argument('-i', '--video_path', type=str, metavar='PATH', required=True,
                        help='path to video input frames')
    parser.add_argument('--temp', type=str, default='/dev/shm/temp_STB-VMM', metavar='PATH', help='path to save temporal data (deleted on exit) (default: /dev/shm/temp_STB-VMM)')
    parser.add_argument('-c', '--load_ckpt', type=str, metavar='PATH', required=True,
                        help='path to load checkpoint')
    parser.add_argument('-o', '--output', default='demo.webM', type=str, metavar='PATH',
                        help='path to save generated frames (default: demo.webM)')
    parser.add_argument('-m', '--mag', metavar='N', default=20.0, type=float,
                        help='magnification factor (default: 20.0)')
    parser.add_argument('--mode', default='static', type=str, choices=['static', 'dynamic'],
                        help='magnification mode (static, dynamic)')

    # Execute parameters
    parser.add_argument('-t', '--tile_size', type=int, default=512, metavar='T', 
                        choices=[64, 128, 192, 256, 320, 384, 448, 512, 576, 640, 704, 768, 832, 896, 960, 1024, 1088, 1152, 1216], 
                        help='size of the tiles to be processed. The bigger the tile the faster magnification runs, as long as the tile fits in VRAM (default: 512')
    parser.add_argument('--overlap', type=int, default=30, metavar='O', 
                        help='tile edge overlap in pixels (default: 30)')
    parser.add_argument('-j', '--workers', default=16, type=int, metavar='N',
                        help='number of data loading workers (default: 16)')
    parser.add_argument('-b', '--batch_size', default=1, type=int, metavar='N', 
                        help='batch size (default: 1)')
    parser.add_argument('-p', '--print_freq', default=100, type=int, metavar='N', 
                        help='print frequency (default: 100)')

    # Device
    parser.add_argument('--device', type=str, default='auto',
                        choices=['auto', 'cpu', 'cuda'],
                        help='select device [auto/cpu/cuda] (default: auto)')

    args = parser.parse_args()

    # Main processing function
    def mag_process():
        stride = args.tile_size-args.overlap

        print('Extracting frames...')
        # Update progressbar
        pb['value'] = 0
        value_label['text'] = f"Extracting frames: {pb['value']:.2f}%  [1/5]"
        # Extract frames
        _, fps, _, frames = vid2frames(args.video_path, out_path=args.temp)
        # Update progressbar
        pb['value'] = 100
        value_label['text'] = f"Extracting frames: {pb['value']:.2f}%  [1/5]"

        print('Splitting tiles...')
        tiles_files = []
        for i, f in enumerate(frames):
            # Update progressbar
            pb['value'] = i/len(frames) * 100
            value_label['text'] = f"Splitting tiles: {pb['value']:.2f}%  [2/5]"
            # Split tiles
            tiles_files.append([])
            tiles, frame_shape = tile(f, args.tile_size, args.overlap)
            for j, t in enumerate(tiles):
                if not os.path.exists(os.path.join(args.temp,f'tile_{j}')):
                    os.makedirs(os.path.join(args.temp,f'tile_{j}'))
                cv2.imwrite(os.path.join(args.temp,f'tile_{j}',f'fragment_{str(i).zfill(6)}.png'), t)
                tiles_files[-1].append(os.path.join(args.temp,f'tile_mag_{j}',f'STBVMM_static_{str(i).zfill(6)}.png'))

        print('Computing magnification...')
        for j in range(len(tiles)):
            # Update progressbar
            pb['value'] = j/len(tiles) * 100
            value_label['text'] = f"Computing magnification: {pb['value']:.2f}%  [3/5]"
            # Compute magnification
            stb_args = STB_args(
                mag = args.mag,
                video_path = os.path.join(args.temp,f'tile_{j}')+'/fragment',
                save_dir = os.path.join(args.temp,f'tile_mag_{j}'),
                load_ckpt = args.load_ckpt,
                num_data = len(frames)-2,
                mode = args.mode,
                device = args.device,
                workers = args.workers, 
                batch_size = args.batch_size,
                print_freq = args.print_freq
            )
            run.main(stb_args)

        print('Stitching tiles...')
        video = cv2.VideoWriter(args.output, cv2.VideoWriter_fourcc('V','P','8','0'), fps, (frame_shape[1], frame_shape[0]))
        for i in range(len(frames)-1):
            # Update progressbar
            pb['value'] = i/(len(frames)-1) * 100
            value_label['text'] = f"Stitching tiles: {pb['value']:.2f}%  [4/5]"
            # Stitch tiles
            t = []
            for f in tiles_files[i]:
                t.append(cv2.imread(f))
            if not os.path.exists(args.output):
                os.makedirs(args.output)
            video.write(cv2.resize(stitch(t, frame_shape, stride = stride), (frame_shape[1], frame_shape[0])))
        video.release()

        print('Cleaning up temporary files...')
        # Update progressbar
        pb['value'] = 0
        value_label['text'] = f"Cleaning up temporary files: {pb['value']:.2f}%  [5/5]"
        # Clean up
        shutil.rmtree(args.temp)
        # Update progressbar
        pb['value'] = 100
        value_label['text'] = f"Cleaning up temporary files: {pb['value']:.2f}%  [5/5]"
        showinfo(message=f'{os.path.basename(args.video_path)} x{args.mag} completed!')
        print('Done')
        root.quit()
        exit(0)
    
    # Progress bar GUI
    # Define root window for tkinter
    root = tk.Tk()
    root.geometry('600x120')
    root.title(f'Magnifying: {os.path.basename(args.video_path)} x{args.mag}')
    root.resizable(False, False)

    # Progressbar
    pb = ttk.Progressbar(
        root,
        orient='horizontal',
        mode='determinate',
        length=580
    )
    # Place the progressbar
    pb.grid(column=0, row=0, columnspan=2, padx=10, pady=20)

    # Label
    value_label = ttk.Label(root, text='')
    value_label.grid(column=0, row=1, columnspan=2)

    # Start magnification thread
    mag_thread = threading.Thread(target=mag_process, args=())
    mag_thread.start()

    # Start tkinter main thread (progress bar)
    root.mainloop()
    