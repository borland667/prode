# Tools Reference

## Built-in Tools

The following tools are always available in this agent:

| Tool | Description |
|------|-------------|
| `read` | Read file contents |
| `bash` | Execute bash commands |
| `edit` | Make precise file edits with exact text matching |
| `write` | Create or overwrite files |
| `grep` | Search for patterns in files |
| `find` | Find files and directories |
| `ls` | List directory contents |

## Commands

| Command | Description |
|---------|-------------|
| `pi install <source>` | Install an extension |
| `pi remove <source>` | Remove an extension |
| `pi update [source\|self\|pi]` | Update pi and installed extensions |
| `pi list` | List installed extensions |
| `pi config` | Open TUI to enable/disable package resources |
| `pi --help` | Show help for pi |

## Important Notes

### ❌ There is NO "submit" tool

**Important:** The agent does NOT have a `submit` tool. Any attempt to use `submit` will fail with the error "Tool submit not found".

**Alternative:** Use the `write` tool to save files, or the `bash` tool to execute shell commands.

### Tool Usage Guidelines

1. **Always verify tool names** - Use the built-in tools list above
2. **Check documentation** - Run `pi --help` to see available commands
3. **Use bash for testing** - Before using other tools, test with bash commands

### How to Check Available Tools

To see what tools are available:

```bash
# Check built-in tools
pi --help | grep "Built-in tools"

# List installed extensions
pi list

# Open resource configuration
pi config

# See all available commands
pi --help
```

## Common Mistakes

### ❌ Wrong
```javascript
// This will fail
submit()
```

### ✅ Correct
```javascript
// Use write to save files
write({ path: "/path/to/file.txt", content: "Hello world" })

// Use bash for shell commands
bash({ command: "ls -la" })
```

## Getting Help

- `pi --help` - Show general help
- `pi install <source> --help` - Help for specific commands
- Check `docs/` folder for project-specific documentation