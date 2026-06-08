# Daily Checklist for Using the Agent

## Before Starting Work

- [ ] Check `docs/TOOLS_REFERENCE.md` for available tools
- [ ] Remember: NO `submit` tool - use `write` instead
- [ ] Run `pi --help` to see available commands
- [ ] Review `docs/WORK_SUMMARY.md` for project context

## When Making Changes

### Code Changes
- [ ] Edit files using `edit` tool (not `submit`)
- [ ] Test with `bash` commands before deploying
- [ ] Verify lint passes: `npm run lint`
- [ ] Verify build: `npm run build`
- [ ] Run verification: `npm run verify`

### Database Changes
- [ ] Update `prisma/schema.prisma`
- [ ] Create migration: `npm run db:migrate`
- [ ] Generate client: `npm run db:generate`
- [ ] Run verification: `npm run verify`

### Translation Changes
- [ ] Add English translations first
- [ ] Update all 5 languages (en, es, pt, it, nl)
- [ ] Run `npm run db:backfill:translations`

## After Making Changes

- [ ] Run `npm run verify` (lint + test + build)
- [ ] Check that all tests pass (16/16)
- [ ] Verify build succeeds
- [ ] Update `docs/RESUMEN_FINAL.md` if needed

## Common Mistakes to Avoid

❌ **Don't use:**
- `submit()` - Doesn't exist
- `db push` - Use migrations instead
- Hardcoded colors - Use design system tokens
- Direct vendor analytics calls - Use `analytics.js`

✅ **Do use:**
- `write()` - For saving files
- `bash()` - For testing commands
- `npm run db:migrate` - For schema changes
- Design system classes (`ds-*`)
- `analytics.js` for events

## Quick Commands Reference

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Lint check

# Database
npm run db:migrate   # Create/apply migration
npm run db:seed      # Seed data
npm run db:studio    # Open Prisma Studio

# Testing
npm test             # Run tests
npm run verify       # Full verification
```

## Tools Shortcuts

| Task | Command |
|------|---------|
| Read file | `read({ path: "..." })` |
| Edit file | `edit({ path: "...", edits: [...] })` |
| Write file | `write({ path: "...", content: "..." })` |
| Run command | `bash({ command: "..." })` |
| Search files | `grep({ pattern: "...", path: "..." })` |
| Find files | `find({ pattern: "..." })` |
| List dir | `ls({ path: "..." })` |

## Verification Checklist

Before marking work complete:

- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm run verify`)
- [ ] Build succeeds (`npm run build`)
- [ ] Database migrations created
- [ ] Translations updated
- [ ] Documentation updated
- [ ] No errors in console
- [ ] All tests passing (16/16)

## Google OAuth Checklist

To enable Google OAuth:

1. Get credentials from Google Cloud Console
2. Set in `.env`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL`
3. Set in `.env`:
   - `VITE_GOOGLE_CLIENT_ID`
4. All three must be set together

## World Cup 2026 Checklist

To verify World Cup 2026:

1. Run `npm run db:seed`
2. Check rounds: should include `third_place_match`
3. Check matches: 16+8+4+2+1+1 = 32 matches total
4. Check points: 2→4→6→8→10→12 (increasing)
5. Check translation: "Partido por el Tercer Puesto"

## Important Notes

1. **NO submit tool** - use write
2. **Migration-first** - never use db push
3. **Translation first** - update all 5 languages
4. **Design system** - use ds-* classes
5. **Verification** - run npm run verify

## Emergency Contacts

If something breaks:

1. Check `docs/FIX_SUBMIT_ERROR.md`
2. Run `npm run verify`
3. Check console for errors
4. Review recent commits
5. Check documentation for known issues