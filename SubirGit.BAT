@echo off
setlocal
echo ===========================================
echo  Automatizando tu proceso de commit y push
echo ===========================================

rem --- 1. Agrega todos los archivos nuevos y modificados ---
echo.
echo Agregando todos los cambios al staging area...
git add .
echo Listo.

rem --- 2. Pide el mensaje del commit ---
echo.
set /p commit_message="Ingresa tu mensaje para el commit: "

rem --- 3. Confirma los cambios con el mensaje ---
echo.
echo Creando el commit...
git commit -m "%commit_message%"
echo Commit creado con exito.

rem --- 4. Sube los cambios al repositorio remoto ---
echo.
echo Subiendo los cambios a la rama master (o main)...
git push origin master

rem Si tu rama principal es 'main', usa la siguiente linea en su lugar
rem git push origin main

echo.
echo ===========================================
echo  Proceso finalizado.
echo ===========================================
pause
endlocal