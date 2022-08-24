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
call .\python.bat -m venv --copies vibrolab_venv
ren .\vibrolab_venv\Scripts\ bin
call .\vibrolab_venv\bin\activate.bat
call .\vibrolab_venv\bin\pip.exe install --upgrade pip
call .\vibrolab_venv\bin\pip.exe install -r ../STB-VMM/requirements.txt
call .\vibrolab_venv\bin\pip.exe install -r ../TempSlice/requirements.txt
call .\vibrolab_venv\bin\pip.exe install -r ../requirements.txt

rem Deactivate venv and go back
echo "Deactivate venv and go back"
call .\vibrolab_venv\bin\deactivate.bat
cd ..\..