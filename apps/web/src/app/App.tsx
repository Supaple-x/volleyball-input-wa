import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router'
import { Layout } from './layout'

// Dashboard — static (critical path, first screen)
import { DashboardPage } from './routes/dashboard'

// All other routes — lazy loaded
const TeamsPage = lazy(() => import('./routes/teams/index'))
const TeamDetailPage = lazy(() => import('./routes/teams/[teamId]'))
const MatchHistoryPage = lazy(() => import('./routes/matches/index'))
const NewMatchPage = lazy(() => import('./routes/matches/new'))
const LiveMatchPage = lazy(() => import('./routes/matches/[matchId]/live'))
const MatchStatsPage = lazy(() => import('./routes/matches/[matchId]/stats'))
const MatchTimelinePage = lazy(() => import('./routes/matches/[matchId]/timeline'))
const PlayerStatsPage = lazy(() => import('./routes/players/[playerId]'))

function LoadingSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

export function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="teams/:teamId" element={<TeamDetailPage />} />
          <Route path="matches" element={<MatchHistoryPage />} />
          <Route path="matches/:matchId/stats" element={<MatchStatsPage />} />
          <Route path="matches/:matchId/timeline" element={<MatchTimelinePage />} />
          <Route path="players/:playerId" element={<PlayerStatsPage />} />
        </Route>
        {/* Full-screen routes without bottom nav */}
        <Route path="matches/new" element={<NewMatchPage />} />
        <Route path="matches/:matchId/live" element={<LiveMatchPage />} />
      </Routes>
    </Suspense>
  )
}
