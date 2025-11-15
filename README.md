# MilkStack Multi-Agent Hub Roadmap

This document tracks the features and improvements planned for the application.

##   High-Impact Improvements

    - [ ] **Enhanced Persistence & Data Management**
    - [ ] Migrate from `localStorage` to `IndexedDB` for larger storage capacity.
    - [ ] Implement chunked codebase storage (store files individually).
    - [ ] Add project export/import (JSON/ZIP format).
    - [ ] Implement auto-save with conflict resolution for multi-tab usage.
    - [ ] **Codebase Intelligence Upgrade**
    - [ ] Implemented initial analysis on project creation.
    - [ ] Create a semantic index of the codebase.
    - [ ] Use vector embeddings for relevant code retrieval to send only relevant snippets to the AI.
    - [ ] **Message Management & Conversation Control**
    - [ ] Edit & Resend: Click any user message to edit and re-run from that point.
    - [ ] Regenerate: Re-run the last agent response.
    - [ ] Branch Conversations: Fork the conversation at any point to explore different paths.
    - [ ] Message Reactions: Upvote/downvote agent responses for future fine-tuning
    - [ ] Implement a system where agents can argue, present evidence, and force critical thinking.


##  Medium-Impact Improvements

    - [ ] **Search & Filtering**
    - [ ] Search messages by content, agent, or date.
    - [ ] Filter by agent to see only their responses.
    - [ ] Tag important messages or artifacts.
    - [ ] **Better Error Handling**
    - [ ] Provide more descriptive and actionable error dialogs.
    - [ ] **Markdown Rendering**
    - [ ] Render code blocks with syntax highlighting, tables, and other markdown features in agent responses.
    - [ ] **Keyboard Shortcuts**
    - [ ] `Cmd/Ctrl + K`: Open command palette.
    - [ ] `Cmd/Ctrl + Enter`: Send message.
    - [ ] `Cmd/Ctrl + /`: Focus message input.
    - [ ] `Cmd/Ctrl + B`: Toggle sidebar.
    - [ ] `Escape`: Cancel current generation.

##  Nice-to-Have / Future Enhancements

    - [ ] **Agent Memory Across Projects**
    - [ ] Allow agents to remember patterns, preferences, and solutions from previous projects.
    - [ ] **Custom Agent Creation**
    - [ ] Add a UI for users to create their own custom agents with unique prompts and purposes.
    - [ ] Add a "Hire New Agents" button.
    - [ ] **Code Execution Environment**
    - [ ] Integrate a sandboxed environment (like WebContainers or Pyodide) to allow agents to run code.
    - [ ] **Enhanced GitHub Integration**
    - [ ] Move beyond read-only to create branches, open PRs, and comment on code.
    - [ ] **VS Code Extension**
    - [ ] Create a companion extension to interact with the agent hub directly from the editor.
    - [ ] **Temporal Branching - Git for Conversations**
    - [ ] Allow users to fork conversations to explore multiple parallel realities of a project.
    - [ ] **Background Processing**
    - [ ] Enable agents to work on tasks (e.g., code optimization, research) even when the app is closed.
    - [ ] **Visual Agent Embodiment**
    - [ ] Replace text avatars with animated characters that show mood and activity.
    - [ ] **Agent Performance Metrics & "Firing"**
    - [ ] Track agent accuracy, speed, and user satisfaction to manage the AI staff.
    - [ ] **Sentient Project Mode**
    - [ ] Allow the project itself to become an agent that can suggest priorities, warn about scope creep, and request help.


##  UI/UX Polish

    - [ ] **Agent Visual Distinction**
    - [ ] Replace letter avatars with unique icons for each agent.
    - [ ] **Message Grouping**
    - [ ] Group consecutive messages from the same agent into a single block.
    - [ ] **Agent Progress Indicators**
    - [ ] Show the steps an agent is taking to complete a task (e.g., "Searching documentation...", "Analyzing patterns...").

