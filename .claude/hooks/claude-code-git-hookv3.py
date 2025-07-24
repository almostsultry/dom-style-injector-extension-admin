#!/usr/bin/env python3
"""
Claude Code Post-Message Git Hook with Context Analysis

This hook automatically stages changes and generates a descriptive commit message
that includes context about what features/functions were altered based on the changes
and chat context. The commit is NOT executed - only staged with a message.
"""

import subprocess
import sys
import os
import re
import json
from datetime import datetime
from difflib import unified_diff

def get_git_diff(cached=False):
    """Get the git diff to analyze changes."""
    try:
        cmd = ['git', 'diff']
        if cached:
            cmd.append('--cached')
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError:
        return ""

def analyze_code_changes(diff_text):
    """Analyze the diff to understand what was changed."""
    changes = {
        'functions_added': [],
        'functions_modified': [],
        'classes_added': [],
        'classes_modified': [],
        'imports_added': [],
        'features': [],
        'files_modified': set(),
        'patterns_detected': []
    }
    
    # Parse diff to find specific changes
    current_file = None
    added_lines = []
    removed_lines = []
    
    for line in diff_text.split('\n'):
        # Track current file
        if line.startswith('diff --git'):
            current_file = line.split()[-1].lstrip('b/')
            changes['files_modified'].add(current_file)
            
        # Collect added/removed lines
        if line.startswith('+') and not line.startswith('+++'):
            added_lines.append(line[1:])
        elif line.startswith('-') and not line.startswith('---'):
            removed_lines.append(line[1:])
    
    # Analyze all changed content
    all_added = '\n'.join(added_lines)
    all_removed = '\n'.join(removed_lines)
    
    # Detect specific implementation patterns
    pattern_checks = [
        # Git-related patterns
        (r'git\s+(add|commit|push|pull|diff|status)', "git automation"),
        (r'subprocess.*git', "git command execution"),
        (r'commit.*message', "commit message generation"),
        
        # Code analysis patterns
        (r'analyze.*code|code.*analysis', "code analysis"),
        (r'diff.*analyz|analyz.*diff', "diff analysis"),
        (r'extract.*context|context.*extract', "context extraction"),
        
        # Automation patterns
        (r'hook|post.*message|pre.*commit', "hook implementation"),
        (r'automat(?:e|ing|ically)', "automation"),
        (r'stage.*changes|git.*add', "automatic staging"),
        
        # UI/Integration patterns
        (r'pyautogui', "UI automation with pyautogui"),
        (r'prompt.*submission|submit.*prompt', "prompt submission"),
        
        # Feature patterns
        (r'qualitative.*analys|explain.*why', "qualitative analysis"),
        (r'context.*aware|based.*on.*context', "context-aware processing"),
        (r'without.*commit|not.*commit|stage.*only', "stage-only workflow")
    ]
    
    for pattern, description in pattern_checks:
        if re.search(pattern, all_added, re.IGNORECASE):
            changes['patterns_detected'].append(description)
    
    # Extract function/class information
    for line in added_lines:
        # Detect function definitions
        func_match = re.match(r'\s*(def|function|const|let|var)\s+(\w+)\s*\(', line)
        if func_match:
            func_name = func_match.group(2)
            if any(func_name in removed for removed in removed_lines):
                changes['functions_modified'].append(func_name)
            else:
                changes['functions_added'].append(func_name)
        
        # Detect class definitions
        class_match = re.match(r'\s*class\s+(\w+)', line)
        if class_match:
            class_name = class_match.group(1)
            changes['classes_added'].append(class_name)
    
    return changes

def get_chat_context():
    """Read the chat context from Claude Code."""
    # Claude Code should write context to a temporary file
    context_file = os.path.join(os.environ.get('CLAUDE_WORKSPACE', '.'), '.claude-context.json')
    
    if os.path.exists(context_file):
        try:
            with open(context_file, 'r') as f:
                context = json.load(f)
                return context
        except Exception as e:
            print(f"Failed to read context: {e}")
    
    # Fallback: try to get from environment
    return {
        'last_prompt': os.environ.get('CLAUDE_LAST_PROMPT', ''),
        'task_description': os.environ.get('CLAUDE_TASK_DESCRIPTION', ''),
        'work_summary': os.environ.get('CLAUDE_WORK_SUMMARY', '')
    }

def generate_descriptive_summary(changes, context):
    """Generate descriptive bullet points about what was implemented."""
    summary_points = []
    
    # Get context information
    last_prompt = context.get('last_prompt', '').lower()
    work_summary = context.get('work_summary', '').lower()
    task_desc = context.get('task_description', '').lower()
    full_context = f"{last_prompt} {work_summary} {task_desc}"
    
    # Build descriptive points based on detected patterns and context
    
    # Check for hook implementation
    if any('hook' in p for p in changes['patterns_detected']):
        if 'stop' in full_context or 'post-message' in full_context:
            summary_points.append("Implemented stop matcher hook to auto-generate commit messages")
        else:
            summary_points.append("Created git hook for automated workflow")
    
    # Check for code analysis features
    if any('analysis' in p for p in changes['patterns_detected']):
        if 'diff' in full_context or 'change' in full_context:
            summary_points.append("Added code analysis to extract meaningful change context")
        else:
            summary_points.append("Implemented code analysis functionality")
    
    # Check for automation features
    if any('automation' in p for p in changes['patterns_detected']):
        if 'pyautogui' in full_context or any('pyautogui' in p for p in changes['patterns_detected']):
            summary_points.append("Integrated with pyautogui for prompt submission")
        elif 'git' in full_context:
            summary_points.append("Automated git workflow for efficiency")
    
    # Check for staging behavior
    if any('stage' in p for p in changes['patterns_detected']) or 'stage' in full_context:
        if 'without' in full_context or 'not' in full_context:
            summary_points.append("Stages changes automatically without committing")
        else:
            summary_points.append("Implemented automatic staging of changes")
    
    # Check for commit message features
    if any('message' in p for p in changes['patterns_detected']):
        if 'descriptive' in full_context or 'meaningful' in full_context or 'context' in full_context:
            summary_points.append("Generates context-aware commit messages")
        elif 'why' in full_context:
            summary_points.append('Focuses on explaining the "why" behind changes')
    
    # Add function-specific features if relevant
    if 'analyze_code_changes' in changes['functions_added']:
        summary_points.append("Analyzes diffs to understand code modifications")
    
    if 'generate_qualitative_summary' in changes['functions_added'] or 'qualitative' in full_context:
        summary_points.append("Creates qualitative summaries of changes")
    
    if 'extract_context' in changes['functions_added'] or 'context' in full_context:
        summary_points.append("Extracts context from Claude conversation")
    
    # Look for specific requested features
    if 'echo' in last_prompt or 'tail' in last_prompt:
        summary_points.append("Echoes formatted message at end of chat")
    
    if 'delineate' in last_prompt:
        summary_points.append("Clearly delineates output for readability")
    
    # Ensure we don't duplicate similar points
    seen_concepts = set()
    filtered_points = []
    for point in summary_points:
        key_words = set(point.lower().split())
        if not any(len(key_words & seen) > 2 for seen in seen_concepts):
            filtered_points.append(point)
            seen_concepts.append(key_words)
    
    return filtered_points[:6]  # Return up to 6 points

def generate_commit_title(changes, context):
    """Generate a meaningful commit title."""
    last_prompt = context.get('last_prompt', '').lower()
    work_summary = context.get('work_summary', '').lower()
    
    # Look for the main feature being implemented
    if 'hook' in last_prompt and ('git' in last_prompt or 'commit' in last_prompt):
        if 'claude' in last_prompt:
            return "Add Git hook automation for Claude Code"
        else:
            return "Implement Git commit hook with context analysis"
    
    if 'stage' in last_prompt and 'message' in last_prompt:
        return "Create staging hook with commit message generation"
    
    # Check detected patterns for title inspiration
    if 'git automation' in changes['patterns_detected']:
        return "Add automated Git workflow integration"
    
    if 'hook implementation' in changes['patterns_detected']:
        return "Implement automated hook system"
    
    # Fallback to generic but descriptive title
    if changes['patterns_detected']:
        main_feature = changes['patterns_detected'][0]
        return f"Add {main_feature} functionality"
    
    return "Enhance codebase with automated tooling"

def stage_changes():
    """Stage all changes without committing."""
    try:
        # Stage all changes
        subprocess.run(['git', 'add', '-A'], check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Git staging failed: {e}")
        return False

def get_git_status():
    """Get the current git status."""
    try:
        result = subprocess.run(['git', 'status', '--porcelain'], 
                              capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None

def format_commit_message(title, summary_points):
    """Format the final commit message."""
    message = title + "\n\n"
    for point in summary_points:
        message += f"- {point}\n"
    return message.strip()

def main():
    """Main hook function."""
    # Check if we're in a git repository
    try:
        subprocess.run(['git', 'rev-parse', '--git-dir'], 
                      capture_output=True, check=True)
    except subprocess.CalledProcessError:
        print("Not in a git repository, skipping")
        return
    
    # Check if there are changes to stage
    if not get_git_status():
        print("No changes to stage")
        return
    
    # Get the diff to analyze changes
    diff_text = get_git_diff()
    changes = analyze_code_changes(diff_text)
    
    # Get chat context
    context = get_chat_context()
    
    # Generate commit title and summary
    title = generate_commit_title(changes, context)
    summary_points = generate_descriptive_summary(changes, context)
    
    # Format the complete message
    commit_message = format_commit_message(title, summary_points)
    
    # Stage the changes (NO COMMIT)
    if stage_changes():
        print("\n" + "="*60)
        print("STAGED CHANGES WITH COMMIT MESSAGE:")
        print("="*60)
        print(commit_message)
        print("="*60)
        print("\nChanges have been staged. To commit, run:")
        print('  git commit -F .git/COMMIT_EDITMSG')
        print("\nOr edit and commit with:")
        print('  git commit -e')
        
        # Save the message for easy access
        try:
            with open('.git/COMMIT_EDITMSG', 'w') as f:
                f.write(commit_message)
        except Exception as e:
            print(f"\nCouldn't save message file: {e}")
            print("Copy the message above to use it.")
        
        # Clean up context file if it exists
        context_file = '.claude-context.json'
        if os.path.exists(context_file):
            try:
                os.remove(context_file)
            except:
                pass
    else:
        print("Failed to stage changes")

if __name__ == "__main__":
    main()
