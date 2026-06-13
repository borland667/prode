# Fix: "Tool submit not found" Error

## Problem

You were getting the error "Tool submit not found" when trying to use the `submit` command.

## Root Cause

The pi coding agent does NOT have a built-in `submit` tool. The available built-in tools are:

- `read` - Read file contents
- `bash` - Execute bash commands
- `edit` - Make precise file edits
- `write` - Create or overwrite files
- `grep` - Search for patterns
- `find` - Find files/directories
- `ls` - List directory contents

## Solution

**There is no way to add a "submit" tool** because:

1. The agent architecture doesn't support custom tool registration from within sessions
2. The tools are hardcoded in the pi package
3. Extensions can add their own tools, but `submit` would need to be a core feature

## What You Should Use Instead

For saving files and persisting work, use:

```javascript
// Use write to save files
write({ path: "/path/to/file", content: "..." })

// Use bash for shell operations
bash({ command: "git add -A && git commit -m 'message'" })
```

## Prevention

To prevent this from happening again:

1. **Bookmark this document** - Keep `docs/TOOLS_REFERENCE.md` handy
2. **Check available tools first** - Run `pi --help` before starting work
3. **Remember the 7 built-in tools** - read, bash, edit, write, grep, find, ls
4. **Test with bash first** - If unsure, use bash commands to verify
5. **Use write instead of submit** - `write` is the closest equivalent

## Quick Reference

### Built-in Tools (7 total)
- `read(path)` - Read a file
- `bash(command)` - Run a shell command
- `edit(path, edits)` - Edit a file
- `write(path, content)` - Write a file
- `grep(pattern, path)` - Search files
- `find(pattern)` - Find files
- `ls(path)` - List directory

### Common Mistakes

❌ **Wrong**
```javascript
submit()
```

✅ **Correct**
```javascript
write({ path: "/path/to/file.txt", content: "..." })
```

## Documentation

- `docs/TOOLS_REFERENCE.md` - Complete tools reference
- `AGENTS.md` - Repository standards and tool reference

## Why There's No Submit

The pi agent is designed for coding tasks, not for submitting work. The philosophy is:

1. Use the agent to **make changes** to files
2. Use git (via bash) to **save and commit** changes
3. Use the file system to **persist** your work

This keeps the agent focused on what it does best: coding and file manipulation.