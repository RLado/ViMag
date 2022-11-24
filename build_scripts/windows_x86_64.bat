rem Clone cpython if needed
if exist ./python/interpreter (
	rem No need to download
) else (
    echo "Clone cpython"
    git clone  --depth 1 --branch v3.10.6 https://github.com/python/cpython.git ./python/interpreter
)

rem Configure and compile
echo "Configure and compile"
cd python\interpreter\
call .\PCbuild\build.bat


rem Create a venv
echo "Create a venv"
call .\python.bat -m venv --copies ViMag_venv
ren .\ViMag_venv\Scripts\ bin
call .\ViMag_venv\bin\activate.bat
call .\ViMag_venv\bin\pip.exe install --upgrade pip
call .\ViMag_venv\bin\pip.exe install -r ../STB-VMM/requirements.txt
call .\ViMag_venv\bin\pip.exe install -r ../TempSlice/requirements.txt
call .\ViMag_venv\bin\pip.exe install -r ../requirements.txt

rem Deactivate venv and go back
echo "Deactivate venv and go back"
call .\ViMag_venv\bin\deactivate.bat
cd ..\..