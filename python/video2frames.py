import argparse
import cv2
import os


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
        tuple: True if sucessful; Framerate; Frame count

    """

    vidObj = cv2.VideoCapture(vid_path)
    fps = vidObj.get(cv2.CAP_PROP_FPS) # Get framerate

    count = 0
    success = 1
    
    # Check if output path exisist, if not create directory
    if not os.path.exists(out_path):
        os.makedirs(out_path)

    while True:
        success, image = vidObj.read()
        if success:
            # Saves the frames with frame-count
            if crop == None:
                cv2.imwrite(os.path.join(out_path,'frame_%06d.png' % count), image)
            else:
                cv2.imwrite(os.path.join(out_path,'frame_%06d.png' % count), image[crop[0][1]:crop[0][1]+crop[1][1],crop[0][0]:crop[0][0]+crop[1][0]])
            count += 1
        else:
            break
    
    return True, fps, count-1

if __name__ == '__main__':
     # Argument parser
    parser = argparse.ArgumentParser(description='Extracts frames from a video and saves them on a user designated directory.')
    parser._action_groups.pop()
    required = parser.add_argument_group('required arguments')
    optional = parser.add_argument_group('optional arguments')

    # Datasets parameters
    required.add_argument('-i', '--input', type=str, help='Input video file', required=True)
    optional.add_argument('-o', '--output', type=str, help='Path for output files')
    optional.add_argument('-c', '--coordinate', type=int, nargs=2, help='Starting point coordinates of the crop as x y')
    optional.add_argument('-d', '--dimension', type=int, nargs=2, help='Dimensions of the crop W,H')

    args = parser.parse_args()

    if args.output == None:
        args.output = '.'
    if args.coordinate == None or args.dimension == None:
        crop = None
    else:
        crop = (args.coordinate, args.dimension)

    print(vid2frames(args.input, args.output, crop))
    #print(vid2frames('../test_vid.mp4', 'test_out', ((1000,1000),(128,128))))