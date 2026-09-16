import sys

try:
    with open('seed_error.log', 'r', encoding='utf-16le') as f:
        content = f.read()
        
        # Search for the ProgrammingError or UndefinedColumnError
        for line in content.split('\n'):
            if "Error:" in line or "Exception:" in line or "Error" in line:
                if "ProgrammingError" in line or "UndefinedColumnError" in line or "asyncpg.exceptions" in line:
                    print(line)
except Exception as e:
    print(f"Failed to read: {e}")
