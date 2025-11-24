# React Patterns Skill

Best practices for React 19 + TypeScript development in MilkStack Multi-Agent Hub.

## Component Patterns

### Functional Components with Props

```typescript
// Define props interface
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

// Use React.FC for components
const Button: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  variant = 'primary',
  disabled = false 
}) => {
  return (
    <button 
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};
```

### Custom Hooks Pattern

```typescript
// Hook for managing async state
function useAsync<T>(asyncFunction: () => Promise<T>) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await asyncFunction();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error : new Error(String(error)) 
      }));
    }
  }, [asyncFunction]);

  return { ...state, execute };
}
```

## State Management Patterns

### Context with Reducer

```typescript
// Define action types
type Action = 
  | { type: 'SET_USER'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> };

// Reducer function
function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'LOGOUT':
      return { ...state, user: null };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    default:
      return state;
  }
}

// Context with dispatch
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | undefined>(undefined);
```

### Optimized Context

```typescript
// Split contexts for performance
const UserContext = createContext<User | null>(null);
const SettingsContext = createContext<Settings | null>(null);
const ActionsContext = createContext<Actions | null>(null);

// Provider composition
const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  
  const actions = useMemo(() => ({
    setUser,
    setSettings,
  }), []);

  return (
    <UserContext.Provider value={user}>
      <SettingsContext.Provider value={settings}>
        <ActionsContext.Provider value={actions}>
          {children}
        </ActionsContext.Provider>
      </SettingsContext.Provider>
    </UserContext.Provider>
  );
};
```

## Performance Patterns

### Memoization

```typescript
// useMemo for expensive computations
const sortedItems = useMemo(() => {
  return items.sort((a, b) => a.name.localeCompare(b.name));
}, [items]);

// useCallback for stable function references
const handleClick = useCallback(() => {
  onSelect(item.id);
}, [item.id, onSelect]);

// React.memo for component memoization
const ListItem = React.memo<ListItemProps>(({ item, onSelect }) => {
  return (
    <div onClick={() => onSelect(item.id)}>
      {item.name}
    </div>
  );
});
```

### Lazy Loading

```typescript
// Lazy load heavy components
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

// Use Suspense for loading state
const App = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <HeavyComponent />
  </Suspense>
);
```

## Error Handling Patterns

### Error Boundary

```typescript
class ErrorBoundary extends React.Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(_error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

### Async Error Handling

```typescript
// Always handle async errors
const fetchData = async () => {
  try {
    const response = await api.get('/data');
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      // Handle API-specific errors
      toast.error(error.message);
    } else {
      // Log unexpected errors
      console.error('Unexpected error:', error);
      throw error; // Re-throw for error boundary
    }
  }
};
```

## TypeScript Patterns

### Generic Components

```typescript
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map(item => (
        <li key={keyExtractor(item)}>
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}
```

### Type Guards

```typescript
// Type guard for discriminated unions
function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && 'statusCode' in error;
}

// Usage
if (isApiError(error)) {
  // TypeScript knows error is ApiError here
  console.log(error.statusCode);
}
```
