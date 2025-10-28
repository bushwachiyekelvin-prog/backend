# User Groups CRUD TODO

- [ ] Create initial TODO checklist for user groups CRUD and commit plan
- [ ] Explore codebase structure (schema, services, routes) to mirror patterns
- [ ] Add DB schema for user groups with unique name, unique slug (auto-generate if missing), optional description
- [ ] Add join/relationship (users <-> groups) and support linking existing users at group creation
- [ ] Implement model/service layer for groups CRUD following existing conventions
- [ ] Implement routes/controllers for groups CRUD (list, get, create, update, delete)
- [ ] Validate inputs (name required unique, slug unique auto or provided, description optional)
- [ ] Add tests or request-based verification (optional per project norms)
- [ ] Update caching/invalidation hooks if applicable (follow CACHING.md patterns)
- [ ] Add docs to README or CACHING.md if needed
