@echo off
rem Demonstracao: banco, API e app com um clique, sem Supabase.
rem Na primeira vez baixa o PostgREST e cria os dados de exemplo.
cd /d "%~dp0"
if not exist node_modules\@electric-sql\pglite-socket call npm install
call npm run demo
pause
