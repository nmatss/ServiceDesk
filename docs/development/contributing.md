# Contributing Guide

Thank you for contributing to ServiceDesk!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Run tests
6. Submit a PR

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guide.

## Development Process

### 1. Pick an Issue

Browse [good first issues](https://github.com/your-org/ServiceDesk/labels/good%20first%20issue)

### 2. Create Branch

```bash
git checkout -b feature/issue-123-my-feature
```

### 3. Write Code

Follow coding standards:
- TypeScript strict mode
- ESLint rules
- Prettier formatting

### 4. Write Tests

Add tests for new features:
- Unit tests
- E2E tests (if UI changes)

### 5. Run Checks

```bash
npm run lint
npm run type-check
npm test
```

### 6. Commit

Use conventional commits:

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug"
git commit -m "docs: update guide"
```

### 7. Push and PR

```bash
git push origin feature/issue-123-my-feature
```

Create PR on GitHub with:
- Clear description
- Screenshots (if UI)
- Test results

## Code Review

- All PRs require 1 approval
- CI must pass
- No merge conflicts

## Questions?

- Open a [Discussion](https://github.com/your-org/ServiceDesk/discussions)
- Ask in Slack: #servicedesk-dev
- Email: dev@servicedesk.com
