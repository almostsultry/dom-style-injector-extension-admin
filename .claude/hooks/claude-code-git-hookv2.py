#!/usr/bin/env python3
"""
Claude Code Post-Message Git Commit Hook with Context Analysis

This hook automatically generates and executes a git commit with a descriptive message
that includes context about what features/functions were altered based on the changes
and chat context.
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
        'fixes': [],
        'refactors': []
    }
    
    # Parse diff to find specific changes
    current_file = None
    added_lines = []
    removed_lines = []
    
    for line in diff_text.split('\n'):
        # Track current file
        if line.startswith('diff --git'):
            current_file = line.split()[-1].lstrip('b/')
            
        # Collect added/removed lines
        if line.startswith('+') and not line.startswith('+++'):
            added_lines.append(line[1:])
        elif line.startswith('-') and not line.startswith('---'):
            removed_lines.append(line[1:])
    
    # Analyze patterns in changes
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
            if any(class_name in removed for removed in removed_lines):
                changes['classes_modified'].append(class_name)
            else:
                changes['classes_added'].append(class_name)
        
        # Detect imports
        import_match = re.match(r'\s*(import|from)\s+', line)
        if import_match:
            changes['imports_added'].append(line.strip())
        
        # Detect common patterns indicating features/fixes
        if re.search(r'(TODO|FIXME|BUG|HACK)', line, re.IGNORECASE):
            changes['fixes'].append(line.strip())
        if re.search(r'(feature|implement|add)', line, re.IGNORECASE):
            changes['features'].append(line.strip())
    
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
        'conversation_summary': os.environ.get('CLAUDE_CONVERSATION_SUMMARY', '')
    }

def extract_key_actions(text):
    """Extract key action words and concepts from text."""
    action_patterns = {
        'implement': r'implement(?:ed|ing|s)?\s+(\w+)',
        'add': r'add(?:ed|ing|s)?\s+(\w+)',
        'fix': r'fix(?:ed|ing|es)?\s+(\w+)',
        'update': r'updat(?:ed|ing|es)?\s+(\w+)',
        'refactor': r'refactor(?:ed|ing|s)?\s+(\w+)',
        'optimize': r'optimiz(?:ed|ing|es)?\s+(\w+)',
        'create': r'creat(?:ed|ing|es)?\s+(\w+)',
        'remove': r'remov(?:ed|ing|es)?\s+(\w+)',
        'enhance': r'enhanc(?:ed|ing|es)?\s+(\w+)',
        'integrate': r'integrat(?:ed|ing|es)?\s+(\w+)'
    }
    
    actions = []
    for action, pattern in action_patterns.items():
        matches = re.findall(pattern, text.lower())
        for match in matches:
            actions.append(f"{action} {match}")
    
    return actions

def generate_detailed_commit_message(changes, context):
    """Generate a detailed commit message based on changes and context."""
    # Extract key information from context
    last_prompt = context.get('last_prompt', '')
    task_desc = context.get('task_description', '')
    
    # Analyze what the user asked for
    user_actions = extract_key_actions(last_prompt + ' ' + task_desc)
    
    # Build the commit message
    message_parts = []
    
    # Primary action based on context
    if user_actions:
        primary_action = user_actions[0].capitalize()
        message_parts.append(primary_action)
    elif changes['functions_added']:
        message_parts.append(f"Add {', '.join(changes['functions_added'][:2])} function{'s' if len(changes['functions_added']) > 1 else ''}")
    elif changes['functions_modified']:
        message_parts.append(f"Update {', '.join(changes['functions_modified'][:2])} function{'s' if len(changes['functions_modified']) > 1 else ''}")
    elif changes['classes_added']:
        message_parts.append(f"Add {changes['classes_added'][0]} class")
    else:
        # Fallback to file-based message
        changed_files = get_changed_files()
        if len(changed_files) == 1:
            message_parts.append(f"Update {changed_files[0]}")
        else:
            message_parts.append(f"Update {len(changed_files)} files")
    
    # Add details about what was done
    details = []
    
    if changes['functions_added']:
        details.append(f"new functions: {', '.join(changes['functions_added'][:3])}")
    
    if changes['functions_modified']:
        details.append(f"modified: {', '.join(changes['functions_modified'][:3])}")
    
    if changes['classes_added']:
        details.append(f"new classes: {', '.join(changes['classes_added'])}")
    
    if changes['imports_added']:
        # Extract module names from imports
        modules = []
        for imp in changes['imports_added'][:3]:
            if 'import' in imp:
                module_match = re.search(r'(?:from|import)\s+(\w+)', imp)
                if module_match:
                    modules.append(module_match.group(1))
        if modules:
            details.append(f"imports: {', '.join(modules)}")
    
    # Add context from user prompt if it provides clarity
    if last_prompt:
        # Extract specific feature mentions
        feature_patterns = [
            r'hook\s+for\s+(\w+)',
            r'support\s+for\s+(\w+)',
            r'integration\s+with\s+(\w+)',
            r'(\w+)\s+functionality',
            r'(\w+)\s+feature'
        ]
        
        for pattern in feature_patterns:
            match = re.search(pattern, last_prompt.lower())
            if match:
                details.append(f"for {match.group(1)}")
                break
    
    # Construct final message
    if details:
        return f"{message_parts[0]} ({'; '.join(details[:2])})"
    else:
        return message_parts[0]

def get_changed_files():
    """Get list of changed files."""
    status = get_git_status()
    if not status:
        return []
    
    files = []
    for line in status.split('\n'):
        if line:
            parts = line.strip().split(None, 1)
            if len(parts) > 1:
                files.append(parts[1])
    return files

def get_git_status():
    """Get the current git status."""
    try:
        result = subprocess.run(['git', 'status', '--porcelain'], 
                              capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None

def stage_and_commit(message):
    """Stage all changes and create a commit."""
    try:
        # Stage all changes
        subprocess.run(['git', 'add', '-A'], check=True)
        
        # Create commit
        subprocess.run(['git', 'commit', '-m', message], check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Git commit failed: {e}")
        return False

def save_example_context():
    """Save an example context file for testing."""
    example_context = {
        'last_prompt': 'Create a hook for Claude Code that automatically writes Git commit messages',
        'task_description': 'Implement post-message hook with context analysis',
        'conversation_summary': 'User wants automated git commits with descriptive messages based on code changes'
    }
    
    context_file = '.claude-context.json'
    with open(context_file, 'w') as f:
        json.dump(example_context, f, indent=2)
    print(f"Created example context file: {context_file}")

def main():
    """Main hook function."""
    # Check if we're in a git repository
    try:
        subprocess.run(['git', 'rev-parse', '--git-dir'], 
                      capture_output=True, check=True)
    except subprocess.CalledProcessError:
        print("Not in a git repository, skipping commit")
        return
    
    # Check if there are changes to commit
    if not get_git_status():
        print("No changes to commit")
        return
    
    # Get the diff to analyze changes
    diff_text = get_git_diff()
    changes = analyze_code_changes(diff_text)
    
    # Get chat context
    context = get_chat_context()
    
    # Generate detailed commit message
    message = generate_detailed_commit_message(changes, context)
    
    print(f"Generated commit message: {message}")
    print(f"Detected changes: {json.dumps(changes, indent=2)}")
    
    # Create the commit
    if stage_and_commit(message):
        print("Successfully created git commit")
        
        # Clean up context file
        context_file = '.claude-context.json'
        if os.path.exists(context_file):
            os.remove(context_file)
    else:
        print("Failed to create git commit")

if __name__ == "__main__":
    # Uncomment to create example context file for testing
    # save_example_context()
    main()
