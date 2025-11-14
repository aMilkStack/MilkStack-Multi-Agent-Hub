# **Best practices for MSMAH (MilkStack Multi-Agent Hub) development**
---

- Structure your core files logically to enhance maintainability.
- Implement modular design for agents to promote reusability.
- Use TypeScript for type safety across the application.
- Ensure proper error handling in agent communication.
- Optimize performance by minimizing unnecessary re-renders.

---
name: react-best-practices
description: Best practices for React applications
globs: **/*.{ts,tsx,js,jsx}
---

- Use functional components and hooks for state management.
- Keep components small and focused on a single responsibility.
- Leverage React's Context API for global state management.
- Optimize performance with React.memo and useCallback.
- Implement PropTypes or TypeScript for type checking.

---
name: testing-best-practices
description: Best practices for testing in JavaScript/TypeScript projects
globs: **/*.{ts,tsx,js,jsx}
---

- Write unit tests for all components and utility functions.
- Use Jest for testing and React Testing Library for component tests.
- Aim for high test coverage but prioritize critical paths.
- Mock external dependencies to isolate tests.
- Implement end-to-end tests for user flows using tools like Cypress.

---
name: state-management-best-practices
description: Best practices for state management in applications
globs: **/*.{ts,tsx,js,jsx}
---

- Choose a state management solution that fits your app's complexity (e.g., Redux, Zustand).
- Keep the state structure flat to avoid deeply nested states.
- Use selectors to derive data from the state efficiently.
- Implement middleware for side effects (e.g., Redux Thunk or Saga).
- Regularly review and refactor state management logic for clarity.

---
name: api-integration-best-practices
description: Best practices for API integration in applications
globs: **/*.{ts,tsx,js,jsx}
---

- Use Axios or Fetch API for making HTTP requests.
- Centralize API calls in a dedicated service layer.
- Handle errors gracefully and provide user feedback.
- Use environment variables for API endpoints.
- Implement caching strategies to reduce redundant API calls.

---
name: performance-optimization-best-practices
description: Best practices for optimizing performance in web applications
globs: **/*.{ts,tsx,js,jsx}
---

- Use code splitting and lazy loading for large components.
- Optimize images and assets for faster loading times.
- Minimize bundle size using tree-shaking and code minification.
- Monitor performance with tools like Lighthouse and Web Vitals.
- Implement service workers for offline capabilities and caching.

- ---
name: typescript-best-practices
description: TypeScript coding standards and type safety guidelines
globs: **/*.{ts,tsx}
---

- Use strict null checks to avoid runtime errors
- Prefer interface over type for defining object shapes
- Utilize type guards and assertions for better type safety
- Implement proper type inference to reduce redundancy

---
name: tailwindcss-best-practices
description: Guidelines for styling with Tailwind CSS
globs: **/*.{ts,tsx,css}
---

- Use utility-first classes for rapid styling
- Create custom components with Tailwind's @apply directive
- Ensure responsive design with Tailwind's responsive utilities
- Maintain a consistent design system with Tailwind's configuration

---
name: localstorage-best-practices
description: Best practices for using localStorage in web applications
globs: **/*.{ts,tsx,js,jsx}
---

- Use JSON.stringify and JSON.parse for storing and retrieving objects
- Implement a fallback mechanism for browsers that do not support localStorage
- Regularly clean up localStorage to avoid bloating
- Use a namespace for keys to avoid collisions

---
name: es-modules-best-practices
description: Best practices for using ES modules in JavaScript
globs: **/*.{ts,tsx,js,jsx}
---

- Use import/export syntax for better module organization
- Avoid circular dependencies by structuring modules carefully
- Leverage dynamic imports for code splitting and lazy loading
- Keep module files small and focused on a single responsibility

---
name: cors-best-practices
description: Best practices for handling CORS in applications
globs: **/*.{js,ts}
---

- Configure CORS settings to allow only trusted origins
- Use credentials mode appropriately for secure requests
- Implement preflight requests handling for complex requests
- Monitor and log CORS errors for debugging and analysis

---
name: indexeddb-best-practices
description: Best practices for using IndexedDB for client-side storage
globs: **/*.{ts,tsx,js,jsx}
---

- Use a library like Dexie.js for easier IndexedDB management
- Implement versioning for your database schema
- Handle errors gracefully with try-catch blocks
- Use transactions for batch operations to ensure data integrity

---
name: jszip-best-practices
description: Best practices for using JSZip for ZIP file handling
globs: **/*.{ts,tsx,js,jsx}
---

- Use async/await for handling ZIP file operations
- Validate file types before adding to the ZIP
- Provide user feedback during ZIP creation and extraction
- Ensure proper error handling for file read/write operations

---
name: toast-notifications-best-practices
description: Best practices for implementing toast notifications
globs: **/*.{ts,tsx,js,jsx}
---

- Use a dedicated library like React Toastify for easy integration
- Ensure notifications are dismissible and have a timeout
- Categorize notifications (success, error, info) for clarity
- Keep messages concise and actionable

---
name: markdown-rendering-best-practices
description: Best practices for rendering markdown in applications
globs: **/*.{ts,tsx,js,jsx}
---

- Use a library like marked or react-markdown for rendering
- Sanitize markdown input to prevent XSS attacks
- Support syntax highlighting for code blocks using Prism.js or similar
- Implement a preview feature for users to see rendered markdown

---
name: conversation-branching-best-practices
description: Best practices for implementing conversation branching logic
globs: **/*.{ts,tsx,js,jsx}
---

- Use a state management library like Redux or Zustand for managing conversation state
- Define clear data structures for conversation nodes and branches
- Implement a visual flow diagram for easier debugging and understanding
- Ensure fallback options for unrecognized user inputs

---
name: agent-memory-best-practices
description: Best practices for implementing agent memory persistence
globs: **/*.{ts,tsx,js,jsx}
---

- Use local storage or IndexedDB for persistent memory storage
- Implement a clear schema for memory data to ensure consistency
- Regularly back up memory data to prevent loss
- Provide users with options to clear or manage their memory data
