@echo off
echo Syncing API files to XAMPP...
xcopy "C:\Ken\CLCC System\api\*" "C:\xampp\htdocs\api\" /E /Y /I
echo Sync complete!
pause
