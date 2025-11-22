
# 🤖 MilkStack Multi-Agent Hub

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

A multi-agent hub for streamlined and collaborative software development workflows.

---

## 📖 Description

The MilkStack Multi-Agent Hub is not just another AI coding assistant. It's a simulated team of specialized AI agents designed to collaborate, debate, and execute complex software development tasks. It transforms the development process from a simple command-and-response interaction into a dynamic, two-phase workflow: **Discovery** and **Execution**.

This project aims to solve the problem of premature execution in AI-driven development. Instead of jumping straight to code, the hub facilitates a crucial upfront "discovery" phase where different AI personas discuss requirements, challenge assumptions, and explore alternatives, mirroring the workflow of a high-functioning human development team.

### ✨ Key Features

*   **Collaborative Agent System:** Interact with a team of specialized AI agents, including an Architect, an Adversarial Thinker, a Debug Specialist, and more.
*   **Two-Phase Workflow:**
    1.  **Discovery Mode:** A conversational phase for brainstorming, debating, and refining ideas with the AI agent team.
    2.  **Execution Mode:** A deterministic, task-based phase where the agreed-upon plan is implemented by the agents.
*   **User-Driven Control:** You are in the director's seat. The system only moves from discovery to execution when you give the explicit go-ahead.
*   **Living Team UX:** Visualize the AI team's "thinking" process as different agents contribute to the conversation.
*   **Extensible & Configurable:** Built with modern web technologies (React, TypeScript, Vite) for easy customization and extension.

### 🚀 What Makes It Unique?

MilkStack focuses on the **process** of creation, not just the output. By simulating a collaborative team, it helps uncover better solutions, identify potential pitfalls early, and provides a more robust and well-thought-out final product. It's a true partner in the creative and technical process.

## 📚 Table of Contents

1.  [Description](#-description)
2.  [Installation](#-installation)
3.  [Quick Start](#-quick-start)
4.  [Development](#-development)
5.  [Configuration](#-configuration)
6.  [Roadmap](#-roadmap)
7.  [Contributing](#-contributing)
8.  [Testing](#-testing)
9.  [License](#-license)
10. [Acknowledgments](#-acknowledgments)
11. [Support & Contact](#-support--contact)

## ⚙️ Installation

### Prerequisites

*   Node.js (v18+ recommended)
*   npm (or a compatible package manager like yarn or pnpm)

### Installation Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/clduab11/gemini-flow.git
    cd gemini-flow
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env.local` file in the root of the project and add your API keys. At a minimum, you will need a Gemini API key.
    ```
    VITE_GEMINI_API_KEY=your_gemini_api_key_here
    ```

4.  **Run the application:**
    ```bash
    npm run dev
    ```

### Verification

Once you run `npm run dev`, the application should be available at `http://localhost:5173` (or the next available port). You should see the main interface of the MilkStack Multi-Agent Hub.

## 🚀 Quick Start

The core workflow is designed to be intuitive. Here's how you get started:

1.  **Start a Conversation:** Open the app and start by describing a task, problem, or idea. For example:
    > "I need to build a login system for my new SaaS application."

2.  **Engage in Discovery Mode:**
    The Orchestrator agent will route your request to the most relevant specialist (e.g., the Product Planner or Architect). A conversation will unfold, with different agents chiming in to ask clarifying questions, propose solutions, and critique ideas.
    *   **Architect:** "I recommend OAuth 2.0 with Google/GitHub and JWT sessions."
    *   **Adversary:** "That's a good start, but have you considered the risks of token hijacking and CSRF? We must store tokens in httpOnly cookies."

3.  **Trigger Execution:**
    Once you are satisfied with the proposed solution, you can explicitly trigger the execution phase by typing a command like:
    > "This sounds great. Go ahead."

4.  **Approve the Plan:**
    The system will switch to **Execution Mode**. The Product Planner agent will generate a detailed `TaskMap` (a step-by-step implementation plan). You will be prompted to review and approve this plan.

5.  **Watch the Execution:**
    Once approved, the agents will begin executing the plan, writing code, and performing the necessary tasks in a deterministic sequence.

## 🔧 Configuration

The application is configured via environment variables. Create a `.env.local` file in the project root.

### Environment Variables

*   `VITE_GEMINI_API_KEY`: **(Required)** Your API key for Google Gemini. The agents are powered by this model.
*   Other AI model keys (e.g., for Claude) can be configured in the `src/config/` directory if you wish to extend the `aiServiceFactory`.

### Config Files

The `src/config/` directory contains files for more advanced configuration:
*   `ai.ts`: Default safety settings and model choices.
*   `featureFlags.ts`: Toggle experimental features.
*   `claudeConfig.ts`, `rustyConfig.ts`: Configuration for other potential integrations.

## 🗺️ Roadmap

Based on the core concept, here are some of the planned features and future directions:

*   **Smart Consensus Detection:** Train the Orchestrator to automatically detect when a debate has naturally concluded, without waiting for a user trigger.
*   **Debate Summaries:** Automatically generate a summary of decisions made during the Discovery phase before switching to execution.
*   **Phase History:** Track analytics on how much time is spent in Discovery vs. Execution to optimize workflows.
*   **Agent Voting:** A UI feature to show which agents "agree" or "disagree" with a proposed solution.
*   **Return to Discovery:** Add a "Pause & Revise" button during the Execution phase to go back to the drawing board if a problem is found.

## 🛠️ Development

### Development Environment

To set up the development environment, follow the [Installation](#-installation) steps.

### Running Tests

To run the linter and ensure code quality:
```bash
npm run lint
```
*(Note: As of now, only linting is configured. Unit and end-to-end testing infrastructure is a future goal.)*

### Building the Project

To create a production-ready build of the application:
```bash
npm run build
```
The output will be in the `dist/` directory. You can preview the production build locally with `npm run preview`.

## 🙏 Contributing

We welcome contributions! Please follow these steps to contribute:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a Pull Request.

Please read our `CONTRIBUTING.md` for more details on our code of conduct and the process for submitting pull requests. (Note: A `CONTRIBUTING.md` file should be created).

## 🧪 Testing

Currently, the project is set up with ESLint for static analysis and linting.
```bash
npm run lint
```
A formal testing suite (e.g., using Vitest or Jest) is on the roadmap to improve code quality and prevent regressions.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE.md) file for details.
*(A `LICENSE` file with the MIT license text should be created).*

## ❤️ Acknowledgments

*   This project is heavily inspired by the idea of collaborative, conversational AI systems.
*   Thanks to the creators of the powerful open-source libraries that make this project possible, including React, Vite, and an extensive ecosystem of tools.

## 📞 Support & Contact

*   **Issues:** If you encounter a bug or have a feature request, please [open an issue](https://github.com/clduab11/gemini-flow/issues).
*   **Community:** (Community channels like Discord or Slack can be linked here in the future).
