// Thrown by apiFetch on a 401 so the global QueryCache can reset the session.
// Lives in its own dependency-free module so apiFetch doesn't pull in App.tsx
// (and the whole React/Mantine tree) — keeps it importable in unit tests.
export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'UnauthorizedError'
  }
}
