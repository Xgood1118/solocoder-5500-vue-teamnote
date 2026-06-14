@echo off
echo ================================================
echo   TeamNote - 启动脚本 (Windows)
echo ================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 16+
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] 检查后端依赖...
if not exist backend\node_modules (
    echo   正在安装后端依赖...
    cd backend && call npm install && cd ..
)

echo [2/4] 检查前端依赖...
if not exist frontend\node_modules (
    echo   正在安装前端依赖...
    cd frontend && call npm install && cd ..
)

echo [3/4] 启动后端服务 (端口 3001)...
start "TeamNote Backend" cmd /k "cd /d %~dp0backend && echo === TeamNote 后端 === && node src/index.js"

timeout /t 3 /nobreak >nul

echo [4/4] 启动前端开发服务器 (端口 5173)...
start "TeamNote Frontend" cmd /k "cd /d %~dp0frontend && echo === TeamNote 前端 === && npx vite"

echo.
echo ================================================
echo   服务启动中！
echo   前端地址：http://localhost:5173
echo   后端地址：http://localhost:3001
echo.
echo   默认账号：owner / admin / editor / viewer / guest
echo   所有账号密码均为：123456
echo ================================================
echo.
pause
