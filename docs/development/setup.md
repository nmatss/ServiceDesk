# Development Environment Setup

Complete guide to setting up your ServiceDesk development environment.

## Prerequisites

### Required Software

- **Node.js**: 20 LTS (recommended)
- **npm**: 10+ (comes with Node.js)
- **Git**: Latest version

### Recommended Tools

- **VS Code**: With extensions:
  - ESLint
  - Prettier
  - TypeScript
  - Tailwind CSS IntelliSense
- **Postman**: API testing
- **DB Browser**: SQLite management

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-org/ServiceDesk.git
cd ServiceDesk
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

```bash
cp .env.local.example .env.local
```

No additional configuration needed for development!

### 4. Initialize Database

```bash
npm run init-db
```

### 5. Start Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

## Project Structure

```
ServiceDesk/
├── app/                    # Next.js App Router
├── lib/                    # Core libraries
├── components/             # React components
├── tests/                  # Test suites
├── docs/                   # Documentation
└── public/                 # Static assets
```

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

Follow coding standards in [CONTRIBUTING.md](CONTRIBUTING.md)

### 3. Run Tests

```bash
npm run lint
npm run type-check
npm test
```

### 4. Commit Changes

```bash
git commit -m "feat: add my feature"
```

### 5. Push and Create PR

```bash
git push origin feature/my-feature
```

## Troubleshooting

### Port Already in Use

```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>
```

### Database Issues

```bash
# Reset database
npm run db:clear
npm run init-db
```

### Module Not Found

```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

## Next Steps

- [Database Guide](database.md)
- [Testing Guide](testing.md)
- [Contributing Guide](contributing.md)
