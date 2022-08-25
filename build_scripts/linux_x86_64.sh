#!/bin/bash
set -e

# Clone cpython (if needed)
if [ ! -f ./python/interpreter ]
then
    set +e
    echo "Clone cpython"
    git clone  --depth 1 --branch v3.10.6 https://github.com/python/cpython.git ./python/interpreter
    set -e
fi

# Configure and compile
echo "Configure and compile"
cd python/interpreter/
./configure --enable-optimizations
make -j 32

# Create a venv
echo "Create a venv"
./python -m venv --copies vibrolab_venv
source vibrolab_venv/bin/activate
pip install --upgrade pip
pip install -r ../STB-VMM/requirements.txt
pip install -r ../TempSlice/requirements.txt
pip install -r ../requirements.txt

# Deactivate venv and go back
echo "Deactivate venv and go back"
deactivate
cd ../..