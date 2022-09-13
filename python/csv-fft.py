## Code copied from TempSlice; removed all code referencing matplotlib.


#import matplotlib.pyplot as plt
import numpy as np
import csv
import argparse
import os
import csaps


def main():
    # Argument parser
    parser = argparse.ArgumentParser(
        description='Plots the fft(s) of the input slices csv')
    parser._action_groups.pop()
    required = parser.add_argument_group('required arguments')
    optional = parser.add_argument_group('optional arguments')

    # Datasets parameters
    required.add_argument('-f', '--sample_rate', type=float,
                          help='Sample rate in Hz (or fps)', required=True)
    required.add_argument('-i', '--input', type=str,
                          nargs='+', help='List of input files', required=True)
    optional.add_argument('-o', '--output', type=str,
                          help='Path for the output graph')
    optional.add_argument('-od', '--output_data', type=str,
                          help='Path for csv output files')
    optional.add_argument('--dpi', type=int, default=300,
                          help='Output graph dpi')
    optional.add_argument('-c', '--freq_cap', type=float, nargs=2,
                          help='Frequency graph cutoff as: start end', required=False)
    optional.add_argument('-m', '--mode', type=str,
                          choices=['abs', 'imag'], default='abs', help='Path for the output graph')
    optional.add_argument('-s', '--scale', type=str, choices=[
                          'log', 'mag'], default='mag', help='Enable logarithmic scale on the y axis')
    optional.add_argument('--data_col', type=str, choices=['avg', 'lub', 'ulb'], default='avg',
                          help='Data column to be used for fft, by default averages both columns')
    optional.add_argument('--smooth', type=float, default=None,
                          help='Smoothing factor [0-1]. Smoothens data using a cubic spline approximation')
    optional.add_argument('-w', '--window', type=str,
                          choices=['none','hamming','bartlett','blackman','hanning'], default='none', help='Apply window before FFT')

    args = parser.parse_args()

    ###

    legend = []

    for infile in args.input:
        frame_num = []
        ulb = []
        lub = []
        with open(infile, 'r', newline='') as csvfile:  # args.input()
            csvreader = csv.reader(
                csvfile, delimiter=',', quotechar='|', quoting=csv.QUOTE_MINIMAL)

            # Skip headings
            csvreader.__next__()

            # Read file to memory
            for i in csvreader:
                frame_num.append(float(i[0]))
                ulb.append(float(i[1]))
                lub.append(float(i[2]))
            ulb = np.array(ulb)
            lub = np.array(lub)

        # Number of sample points
        N = len(frame_num)
        # sample spacing
        T = 1.0 / args.sample_rate

        #Check if windowing is necessary
        if (args.window) == 'hamming':
            w = np.hamming(N)
        elif (args.window) == 'bartlett':
            w = np.bartlett(N)
        elif (args.window) == 'blackman':
            w = np.blackman(N)
        elif (args.window) == 'hanning':
            w = np.hanning(N)
        else:
            w = np.ones(N)

        if args.data_col == 'avg':
            yf = np.fft.fft((lub+ulb)/2*w)
        elif args.data_col == 'lub':
            yf = np.fft.fft(lub*w)
        elif args.data_col == 'ulb':
            yf = np.fft.fft(ulb*w)

        xf = np.fft.fftfreq(N, T)[:N//2]

        if args.freq_cap != None:
            sc = 0
            ec = None
            for j in range(len(xf)):
                if xf[j] <= args.freq_cap[0]:
                    sc = j
                if xf[j] >= args.freq_cap[1]:
                    ec = j
                    break
            if ec == None:
                ec = len(xf)-1
            
            xf = xf[sc:ec]
            yf = yf[sc:ec]
        
        if args.smooth != None:
            yfr = csaps.csaps(xf, 2.0/N * np.real(yf[0:N//2]), xf, smooth=args.smooth)
            yfi = csaps.csaps(xf, 2.0/N * np.imag(yf[0:N//2]), xf, smooth=args.smooth)
            yfm = csaps.csaps(xf, 2.0/N * np.abs(yf[0:N//2]), xf, smooth=args.smooth)
        else:
            yfr = 2.0/N * np.real(yf[0:N//2])
            yfi = 2.0/N * np.imag(yf[0:N//2])
            yfm = 2.0/N * np.abs(yf[0:N//2])

        # if args.mode == 'abs':
        #     plt.plot(xf, yfm, linewidth=1)
        # elif args.mode == 'imag':
        #     plt.plot(xf, yfi, linewidth=1)

        legend.append(os.path.basename(infile))

        # Saving fft data to csv
        if args.output_data != None:
            with open(f'{os.path.join(args.output_data, os.path.basename(infile))}_fft.csv', 'w', newline='') as csvfile:
                csvwriter = csv.writer(
                    csvfile, delimiter=',', quotechar='|', quoting=csv.QUOTE_MINIMAL)
                csvwriter.writerow(['freq.', 'real', 'imag', 'mag'])

                for xd, ydr, ydi, ydm in zip(xf, yfr, yfi, yfm):
                    csvwriter.writerow([xd, ydr, ydi, ydm])

    # if args.scale == 'log':
    #     plt.semilogy()
    # plt.legend(legend, bbox_to_anchor=(0, 1, 1, 0), ncol=1)
    # plt.grid()
    # plt.grid(visible=True, which='minor', linestyle='--')

    # if args.output != None:
    #     plt.savefig(args.output, dpi=args.dpi, bbox_inches='tight')
    # else:
    #     plt.show()


if __name__ == '__main__':
    main()
