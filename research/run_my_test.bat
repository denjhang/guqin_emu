@echo off
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-26.0.1.8-hotspot"
set "PATH=C:\Program Files\Eclipse Adoptium\jdk-26.0.1.8-hotspot\bin;%PATH%"
set "GHIDRA_HOME=D:\Program Files\ghidra_12.1_PUBLIC_20260513\ghidra_12.1_PUBLIC"
set "GHIDRA_EXPORT_DIR=D:\working\vscode-projects\guqin_emu\research\ghidra_bend"
"%GHIDRA_HOME%\support\analyzeHeadless.bat" "C:\Users\Administrator\AppData\Local\Temp\ghidra_projects" iso2 -overwrite -import "D:\working\vscode-projects\guqin_emu\apk\extracted\lib\arm64-v8a\libapp.so" -scriptPath "D:\working\vscode-projects\guqin_emu\research\ghidra_scripts" -postScript GhidraDartBendScript.java > "D:\working\vscode-projects\guqin_emu\research\ghidra_bend\my_test.log" 2>&1
