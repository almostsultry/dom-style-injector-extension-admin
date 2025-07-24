#!/usr/bin/env python3
"""
Claude Code Post-Message Git Commit Hook with Context Analysis

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
        'fixes': [],
        'refactors': [],
        'files_modified': set(),
        'qualitative_changes': []
    }
    
    # Parse diff to find specific changes
    current_file = None
    added_lines = []
    removed_lines = []
    context_lines = []
    
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
        elif line.startswith(' '):
            context_lines.append(line[1:])
    
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
    
    # Analyze qualitative changes based on patterns
    all_changes = '\n'.join(added_lines + removed_lines)
    
    # Detect major implementation patterns
    if re.search(r'subprocess\.(run|call|check_output)', all_changes):
        changes['qualitative_changes'].append("Added subprocess execution capabilities")
    
    if re.search(r'(async|await|asyncio)', all_changes):
        changes['qualitative_changes'].append("Implemented asynchronous functionality")
    
    if re.search(r'(try|except|finally)', all_changes):
        changes['qualitative_changes'].append("Added error handling")
    
    if re.search(r'(unittest|pytest|test_|assert)', all_changes):
        changes['qualitative_changes'].append("Added test coverage")
    
    if re.search(r'(logging|logger|log\.|print\()', all_changes):
        changes['qualitative_changes'].append("Enhanced logging/debugging output")
    
    if re.search(r'(argparse|click|sys\.argv)', all_changes):
        changes['qualitative_changes'].append("Added command-line interface")
    
    if re.search(r'(json\.|yaml\.|toml\.|config)', all_changes):
        changes['qualitative_changes'].append("Implemented configuration handling")
    
    if re.search(r'(@\w+|decorator)', all_changes):
        changes['qualitative_changes'].append("Added decorator patterns")
    
    if re.search(r'(git\s+(add|commit|push|pull|diff))', all_changes):
        changes['qualitative_changes'].append("Integrated git automation")
    
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
        'conversation_summary': os.environ.get('CLAUDE_CONVERSATION_SUMMARY', ''),
        'work_summary': os.environ.get('CLAUDE_WORK_SUMMARY', '')
    }

def extract_key_concepts(text):
    """Extract key concepts and features from text."""
    concepts = []
    
    # Common development concepts
    concept_patterns = {
        'hook': r'hook(?:s)?\s+(?:for|to)\s+(\w+)',
        'automation': r'automat(?:e|ing|ion)\s+(\w+)',
        'integration': r'integrat(?:e|ing|ion)\s+(?:with\s+)?(\w+)',
        'analysis': r'analyz(?:e|ing|is)\s+(\w+)',
        'generation': r'generat(?:e|ing|ion)\s+(?:of\s+)?(\w+)',
        'parsing': r'pars(?:e|ing)\s+(\w+)',
        'validation': r'validat(?:e|ing|ion)\s+(?:of\s+)?(\w+)',
        'optimization': r'optimiz(?:e|ing|ation)\s+(?:of\s+)?(\w+)'
    }
    
    for concept, pattern in concept_patterns.items():
        matches = re.findall(pattern, text.lower())
        for match in matches:
            concepts.append(f"{concept} for {match}")
    
    return concepts

def generate_qualitative_summary(changes, context):
    """Generate a qualitative summary of what changed."""
    summary_points = []
    
    # Analyze context for high-level goals
    work_summary = context.get('work_summary', '')
    last_prompt = context.get('last_prompt', '')
    task_desc = context.get('task_description', '')
    
    # Extract concepts from context
    concepts = extract_key_concepts(work_summary + ' ' + last_prompt + ' ' + task_desc)
    
    # Build qualitative points based on actual changes
    if changes['functions_added']:
        if len(changes['functions_added']) == 1:
            summary_points.append(f"Implemented {changes['functions_added'][0]} function")
        else:
            summary_points.append(f"Added {len(changes['functions_added'])} new functions for enhanced functionality")
    
    if changes['functions_modified']:
        summary_points.append(f"Refactored existing functions to improve {changes['functions_modified'][0]}")
    
    if changes['classes_added']:
        summary_points.append(f"Created {changes['classes_added'][0]} class structure")
    
    # Add detected qualitative changes
    for qual_change in changes['qualitative_changes'][:3]:  # Limit to top 3
        summary_points.append(qual_change)
    
    # Add specific implementation details based on imports
    if changes['imports_added']:
        for imp in changes['imports_added']:
            if 'pyautogui' in imp:
                summary_points.append("Integrated pyautogui for UI automation")
            elif 'subprocess' in imp:
                summary_points.append("Added subprocess handling for system commands")
            elif 'json' in imp:
                summary_points.append("Implemented JSON data persistence")
            elif 'difflib' in imp:
                summary_points.append("Added diff analysis capabilities")
    
    # Add context-based insights
    if 'commit' in last_prompt.lower() and 'message' in last_prompt.lower():
        summary_points.append("Focuses on generating meaningful commit messages")
    
    if 'stage' in last_prompt.lower() and 'not' in last_prompt.lower() and 'commit' in last_prompt.lower():
        summary_points.append("Stages changes without auto-committing for review")
    
    # Ensure we have meaningful points
    if not summary_points and changes['files_modified']:
        summary_points.append(f"Modified {len(changes['files_modified'])} files")
    
    return summary_points[:5]  # Return top 5 most relevant points

def generate_commit_title(changes, context):
    """Generate a concise commit title."""
    # Extract main action from context
    last_prompt = context.get('last_prompt', '')
    work_summary = context.get('work_summary', '')
    
    # Look for key action verbs
    action_patterns = [
        (r'implement(?:ed)?\s+(.+?)\s+(?:for|to|that)', 'Implement {}'),
        (r'add(?:ed)?\s+(.+?)\s+(?:for|to|that)', 'Add {}'),
        (r'creat(?:ed)?\s+(.+?)\s+(?:for|to|that)', 'Create {}'),
        (r'fix(?:ed)?\s+(.+?)\s+(?:in|for)', 'Fix {}'),
        (r'update(?:d)?\s+(.+?)\s+(?:to|for)', 'Update {}'),
        (r'refactor(?:ed)?\s+(.+?)\s+(?:to|for)', 'Refactor {}')
    ]
    
    for pattern, template in action_patterns:
        match = re.search(pattern, last_prompt.lower() + ' ' + work_summary.lower())
        if match:
            subject = match.group(1).strip()
            # Clean up subject
            subject = re.sub(r'\s+', ' ', subject)
            if len(subject.split()) <= 5:  # Keep it concise
                return template.format(subject)
    
    # Fallback based on changes
    if changes['functions_added']:
        return f"Add {changes['functions_added'][0]} functionality"
    elif changes['classes_added']:
        return f"Implement {changes['classes_added'][0]} class"
    elif len(changes['files_modified']) == 1:
        file = list(changes['files_modified'])[0]
        return f"Update {os.path.basename(file)}"
    else:
        return "Update codebase with new features"

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
    summary_points = generate_qualitative_summary(changes, context)
    
    # Format the complete message
    commit_message = format_commit_message(title, summary_points)
    
    # Stage the changes
    if stage_changes():
        print("\n" + "="*60)
        print("STAGED CHANGES WITH COMMIT MESSAGE:")
        print("="*60)
        print(commit_message)
        print("="*60)
        print("\nChanges have been staged. To commit, run:")
        print("  git commit -m \"$(git log -1 --pretty=%B)\"")
        print("\nOr amend the message and commit manually.")
        
        # Save the message for easy access
        with open('.git/COMMIT_EDITMSG', 'w') as f:
            f.write(commit_message)
        
        # Clean up context file
        context_file = '.claude-context.json'
        if os.path.exists(context_file):
            os.remove(context_file)
    else:
        print("Failed to stage changes")

if __name__ == "__main__":
    main()
