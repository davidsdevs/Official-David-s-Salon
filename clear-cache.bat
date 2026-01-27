@echo off
echo ========================================
echo Clearing Vite Build Cache
echo ========================================
echo.

if exist "node_modules\.vite" (
    echo Removing Vite cache...
    rmdir /s /q "node_modules\.vite"
    echo Vite cache cleared!
) else (
    echo No Vite cache found.
)

echo.

if exist "dist" (
    echo Removing dist folder...
    rmdir /s /q "dist"
    echo Dist folder cleared!
) else (
    echo No dist folder found.
)

echo.
echo ========================================
echo Cache cleared successfully!
echo ========================================
echo.
echo Now restart your dev server with:
echo npm run dev
echo.
pause
