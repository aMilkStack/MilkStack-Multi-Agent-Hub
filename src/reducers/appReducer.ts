import { Project, Settings, Message, AgentProposedChanges, ActiveTaskState } from '../../types';

// Centralized app state
export interface AppState {
  projects: Project[];
  activeProjectId: string | null;
  settings: Settings;
  isLoading: boolean;
  isNewProjectModalOpen: boolean;
  isSettingsModalOpen: boolean;
  isProjectSettingsModalOpen: boolean;
  isKeyboardShortcutsOpen: boolean;
  isRustyChatOpen: boolean;
  activeAgentId: string | null;
  initialMessageToSend: { projectId: string; content: string } | null;
  abortController: AbortController | null;
  lastAgentResponseTime: number | null;
  rustyCodebaseContext: string;
  isRustyConnected: boolean;
}

// Discriminated union of all possible actions
export type AppAction =
  // Project Management
  | { type: 'PROJECT_CREATED'; payload: Project }
  | { type: 'PROJECT_SELECTED'; payload: string }
  | { type: 'PROJECT_RENAMED'; payload: { id: string; newName: string } }
  | { type: 'PROJECT_DELETED'; payload: string }
  | { type: 'PROJECTS_LOADED'; payload: Project[] }
  | { type: 'PROJECT_UPDATED'; payload: { id: string; updates: Partial<Project> } }
  | { type: 'PROJECT_CODEBASE_UPDATED'; payload: { id: string; codebaseContext: string } }

  // Message Management
  | { type: 'MESSAGE_ADDED'; payload: { projectId: string; message: Message } }
  | { type: 'MESSAGE_UPDATED'; payload: { projectId: string; chunk: string } }
  | { type: 'MESSAGE_EDITED'; payload: { projectId: string; messageId: string; newContent: string } }
  | { type: 'MESSAGES_TRUNCATED'; payload: { projectId: string; messages: Message[] } }
  | { type: 'MESSAGE_QUEUED'; payload: { projectId: string; message: Message } }
  | { type: 'MESSAGE_DEQUEUED'; payload: { projectId: string; messageId: string } }
  | { type: 'PROPOSED_CHANGES_REMOVED'; payload: { projectId: string; messageId: string } }

  // Workflow State (Agency V2)
  | { type: 'WORKFLOW_STATE_UPDATED'; payload: { projectId: string; state: ActiveTaskState | undefined } }

  // Settings
  | { type: 'SETTINGS_LOADED'; payload: Settings }
  | { type: 'SETTINGS_SAVED'; payload: Settings }

  // Modal State
  | { type: 'MODAL_OPENED'; payload: 'newProject' | 'settings' | 'projectSettings' | 'keyboardShortcuts' | 'rustyChat' }
  | { type: 'MODAL_CLOSED'; payload: 'newProject' | 'settings' | 'projectSettings' | 'keyboardShortcuts' | 'rustyChat' }

  // Loading State
  | { type: 'LOADING_STARTED' }
  | { type: 'LOADING_STOPPED' }

  // Agent State
  | { type: 'AGENT_CHANGED'; payload: string | null }
  | { type: 'ABORT_CONTROLLER_SET'; payload: AbortController | null }
  | { type: 'LAST_RESPONSE_TIME_SET'; payload: number | null }

  // Rusty State
  | { type: 'RUSTY_CODEBASE_UPDATED'; payload: string }
  | { type: 'RUSTY_CONNECTION_STATUS'; payload: boolean }
  | { type: 'RUSTY_CHAT_CREATED'; payload: { projectId: string; chat: any } }
  | { type: 'RUSTY_CHAT_SWITCHED'; payload: { projectId: string; chatId: string } }
  | { type: 'RUSTY_CHAT_DELETED'; payload: { projectId: string; chatId: string } }
  | { type: 'RUSTY_CHAT_UPDATED'; payload: { projectId: string; chatId: string; messages: any[] } }

  // Initial Message Queue
  | { type: 'INITIAL_MESSAGE_QUEUED'; payload: { projectId: string; content: string } }
  | { type: 'INITIAL_MESSAGE_CLEARED' };

export const initialAppState: AppState = {
  projects: [],
  activeProjectId: null,
  settings: {
    apiKey: '',
    rustyApiKey: '',
    githubPat: '',
    globalRules: '',
    model: 'gemini-2.5-flash',
  },
  isLoading: false,
  isNewProjectModalOpen: false,
  isSettingsModalOpen: false,
  isProjectSettingsModalOpen: false,
  isKeyboardShortcutsOpen: false,
  isRustyChatOpen: false,
  activeAgentId: null,
  initialMessageToSend: null,
  abortController: null,
  lastAgentResponseTime: null,
  rustyCodebaseContext: '',
  isRustyConnected: false,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Project Management
    case 'PROJECT_CREATED':
      return {
        ...state,
        projects: [...state.projects, action.payload],
        activeProjectId: action.payload.id,
        isNewProjectModalOpen: false,
      };

    case 'PROJECT_SELECTED':
      return {
        ...state,
        activeProjectId: action.payload,
      };

    case 'PROJECT_RENAMED':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.id
            ? { ...p, name: action.payload.newName, updatedAt: new Date() }
            : p
        ),
      };

    case 'PROJECT_DELETED': {
      const updatedProjects = state.projects.filter(p => p.id !== action.payload);
      const newActiveId = state.activeProjectId === action.payload
        ? (updatedProjects.length > 0 ? updatedProjects[0].id : null)
        : state.activeProjectId;

      return {
        ...state,
        projects: updatedProjects,
        activeProjectId: newActiveId,
      };
    }

    case 'PROJECTS_LOADED':
      return {
        ...state,
        projects: action.payload,
        activeProjectId: state.activeProjectId || (action.payload.length > 0 ? action.payload[0].id : null),
      };

    case 'PROJECT_UPDATED':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.id
            ? { ...p, ...action.payload.updates, updatedAt: new Date() }
            : p
        ),
      };

    case 'PROJECT_CODEBASE_UPDATED':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.id
            ? { ...p, codebaseContext: action.payload.codebaseContext }
            : p
        ),
      };

    // Message Management
    case 'MESSAGE_ADDED':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, messages: [...p.messages, action.payload.message] }
            : p
        ),
      };

    case 'MESSAGE_UPDATED': {
      return {
        ...state,
        projects: state.projects.map(p => {
          if (p.id === action.payload.projectId) {
            const lastMessage = p.messages[p.messages.length - 1];
            if (lastMessage && typeof lastMessage.author !== 'string') {
              const updatedLastMessage = {
                ...lastMessage,
                content: lastMessage.content + action.payload.chunk,
              };
              return { ...p, messages: [...p.messages.slice(0, -1), updatedLastMessage] };
            }
          }
          return p;
        }),
      };
    }

    case 'MESSAGE_EDITED': {
      const { projectId, messageId, newContent } = action.payload;
      return {
        ...state,
        projects: state.projects.map(p => {
          if (p.id !== projectId) return p;

          const messageIndex = p.messages.findIndex(m => m.id === messageId);
          if (messageIndex === -1) return p;

          const updatedMessages = p.messages.slice(0, messageIndex);
          const editedMessage: Message = {
            ...p.messages[messageIndex],
            content: newContent,
            timestamp: new Date(),
          };

          return { ...p, messages: [...updatedMessages, editedMessage] };
        }),
      };
    }

    case 'MESSAGES_TRUNCATED':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, messages: action.payload.messages }
            : p
        ),
      };

    case 'MESSAGE_QUEUED':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, messages: [...p.messages, action.payload.message] }
            : p
        ),
      };

    case 'MESSAGE_DEQUEUED':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? {
                ...p,
                messages: p.messages.map(m =>
                  m.id === action.payload.messageId
                    ? { ...m, queuedUntil: undefined }
                    : m
                ),
              }
            : p
        ),
      };

    case 'PROPOSED_CHANGES_REMOVED':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? {
                ...p,
                messages: p.messages.map(m =>
                  m.id === action.payload.messageId
                    ? { ...m, proposedChanges: undefined }
                    : m
                ),
              }
            : p
        ),
      };

    // Workflow State (Agency V2)
    case 'WORKFLOW_STATE_UPDATED':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, activeTaskState: action.payload.state }
            : p
        ),
      };

    // Settings
    case 'SETTINGS_LOADED':
      return {
        ...state,
        settings: action.payload,
      };

    case 'SETTINGS_SAVED':
      return {
        ...state,
        settings: action.payload,
        isSettingsModalOpen: false,
      };

    // Modal State
    case 'MODAL_OPENED': {
      const modalKey = `is${action.payload.charAt(0).toUpperCase() + action.payload.slice(1)}Open` as keyof AppState;
      return {
        ...state,
        [modalKey]: true,
      };
    }

    case 'MODAL_CLOSED': {
      const modalKey = `is${action.payload.charAt(0).toUpperCase() + action.payload.slice(1)}Open` as keyof AppState;
      return {
        ...state,
        [modalKey]: false,
      };
    }

    // Loading State
    case 'LOADING_STARTED':
      return {
        ...state,
        isLoading: true,
        activeAgentId: null,
      };

    case 'LOADING_STOPPED':
      return {
        ...state,
        isLoading: false,
        activeAgentId: null,
        abortController: null,
      };

    // Agent State
    case 'AGENT_CHANGED':
      return {
        ...state,
        activeAgentId: action.payload,
      };

    case 'ABORT_CONTROLLER_SET':
      return {
        ...state,
        abortController: action.payload,
      };

    case 'LAST_RESPONSE_TIME_SET':
      return {
        ...state,
        lastAgentResponseTime: action.payload,
      };

    // Rusty State
    case 'RUSTY_CODEBASE_UPDATED':
      return {
        ...state,
        rustyCodebaseContext: action.payload,
      };

    case 'RUSTY_CONNECTION_STATUS':
      return {
        ...state,
        isRustyConnected: action.payload,
      };

    case 'RUSTY_CHAT_CREATED':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? {
                ...p,
                rustyChats: [...p.rustyChats, action.payload.chat],
                activeRustyChatId: action.payload.chat.id,
              }
            : p
        ),
      };

    case 'RUSTY_CHAT_SWITCHED':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, activeRustyChatId: action.payload.chatId }
            : p
        ),
      };

    case 'RUSTY_CHAT_DELETED': {
      return {
        ...state,
        projects: state.projects.map(p => {
          if (p.id !== action.payload.projectId) return p;

          const updatedChats = p.rustyChats.filter(c => c.id !== action.payload.chatId);
          const newActiveChatId = p.activeRustyChatId === action.payload.chatId
            ? updatedChats[0]?.id
            : p.activeRustyChatId;

          return {
            ...p,
            rustyChats: updatedChats,
            activeRustyChatId: newActiveChatId,
          };
        }),
      };
    }

    case 'RUSTY_CHAT_UPDATED':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? {
                ...p,
                rustyChats: p.rustyChats.map(c =>
                  c.id === action.payload.chatId
                    ? { ...c, messages: action.payload.messages, updatedAt: new Date() }
                    : c
                ),
              }
            : p
        ),
      };

    // Initial Message Queue
    case 'INITIAL_MESSAGE_QUEUED':
      return {
        ...state,
        initialMessageToSend: action.payload,
      };

    case 'INITIAL_MESSAGE_CLEARED':
      return {
        ...state,
        initialMessageToSend: null,
      };

    default:
      return state;
  }
}
