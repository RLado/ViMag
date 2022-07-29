import argparse

# Argument parser
parser = argparse.ArgumentParser(description='Extracts frames from a video and saves them on a user designated directory.')
parser._action_groups.pop()
required = parser.add_argument_group('required arguments')
optional = parser.add_argument_group('optional arguments')

# Datasets parameters
optional.add_argument('-i', '--input', type=str, default='', help='', required=False)

args = parser.parse_args()

print(f'Hello from python! Got: {args.input}')