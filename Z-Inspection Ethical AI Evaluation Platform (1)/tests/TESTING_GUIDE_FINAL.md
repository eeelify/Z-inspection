# Testing Guide

This guide covers the testing strategy for the Z-Inspection Ethical AI Evaluation Platform.

## Running Tests

### Backend
Run all backend tests:
```bash
npm test
```

### Frontend
Run frontend test suite:
```bash
npm run test:frontend
```

### Lighthouse
Generate lighthouse reports:
```bash
node tests/generate_lighthouse_chart.js
```

## Structure
- `tests/`: Contains helper scripts and manual test guides.
- `backend/tests/`: Backend unit and integration tests.
