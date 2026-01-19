import { RouterProvider, createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { DailyRoute } from './routes/DailyRoute'
import { TodosRoute } from './routes/TodosRoute'
import { TodoDetailRoute } from './routes/TodoDetailRoute'
import { TopicsRoute } from './routes/TopicsRoute'
import { TopicDetailRoute } from './routes/TopicDetailRoute'
import { todayISO } from './lib/dates'
import { LoginRoute } from './routes/LoginRoute'
import { AuthGate } from './auth/AuthGate'
import { SettingsRoute } from './routes/SettingsRoute'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginRoute />,
  },
  {
    path: '/',
    element: (
      <AuthGate>
        <AppShell />
      </AuthGate>
    ),
    children: [
      { index: true, element: <Navigate to={`/daily/${todayISO()}`} replace /> },
      { path: 'daily/:date', element: <DailyRoute /> },
      { path: 'todos', element: <TodosRoute /> },
      { path: 'todos/:id', element: <TodoDetailRoute /> },
      { path: 'topics', element: <TopicsRoute /> },
      { path: 'topics/:name', element: <TopicDetailRoute /> },
      { path: 'settings', element: <SettingsRoute /> },
      { path: '*', element: <div className="p-6 text-muted">Not found</div> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
