#!/usr/bin/env python3
import sys
import json

def main():
    data = sys.stdin.read()
    try:
        obj = json.loads(data)
    except json.JSONDecodeError as exc:
        print("JSON decode error:", exc)
        return
    print(json.dumps(obj, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
