#!/usr/bin/env python3
"""
Claude Code Stop Matcher Hook
Automatically types and submits a git commit prompt when triggered
"""

import pyautogui
import time

def type_and_submit_prompt():
    """Types the git commit prompt and submits it."""
    
    # Small delay to ensure the interface is ready
    time.sleep(0.5)
    
    # The prompt to type
    prompt = "Write a concise git commit message for the uncommitted changes."

    # Type the prompt
    pyautogui.typewrite(prompt)
    
    # Small delay before submitting
    time.sleep(0.1)
    
    # Submit the prompt (Enter key)
    pyautogui.press('enter')

if __name__ == "__main__":
    type_and_submit_prompt()
