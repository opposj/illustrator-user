# How to Interact with Illustrator

1. NEVER formulate complex operations in a single script. Instead, first break them down into smaller, functional, reusable, and self-executable scripts under `illustrator_scripts\`, then modularly call them in the message you send to Illustrator to achieve the desired result (e.g., `CALL <script_1> <args>; TRANSITION OPERATIONS; CALL <script_2> <args>; TRANSITION OPERATIONS; ...`). This approach allows for better flexibility and reusability, accumulating a library of useful scripts over time.

2. MUST write descriptive comments at the beginning of each script to explain its purpose and functionality. This makes it easier to retrieve relevant scripts for future use.

3. UTILIZE `run_mcp_server.py` to communicate with Illustrator:
    - Eval string: `& 'C:\Users\User\.conda\envs\adobe-ai-mcp\python.exe' 'D:\Lab\final_thesis\illustrator-user\run_mcp_server.py' --code <your_code_here>`
    - Eval file: `& 'C:\Users\User\.conda\envs\adobe-ai-mcp\python.exe' 'D:\Lab\final_thesis\illustrator-user\run_mcp_server.py' --code-file <your_file_path>`

4. GUIDE of Illustrator scripting can be found under `illustrator-scripting-guide\`