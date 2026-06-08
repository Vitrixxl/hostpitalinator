import { useEffect, useState } from "react"
import { HashRouter } from "react-router"

import { getCurrentAccount, logout } from "@/api"
import { clearApiAuthToken, getApiAuthToken } from "@/api/client"
import { errorMessage } from "@/app/error-utils"
import { LoadingScreen } from "@/components/common/LoadingScreen"
import { AuthScreen } from "@/features/auth/AuthScreen"
import { AppShell } from "@/layouts/AppShell"
import type { Account } from "@/types"

const SKIP_STARTUP_LOADING = process.env.PUBLIC_SKIP_STARTUP_LOADING === "true"
const STARTUP_LOADING_DURATION_MS = SKIP_STARTUP_LOADING ? 0 : 3000

function App() {
  const [account, setAccount] = useState<Account | null>(null)
  const [authChecked, setAuthChecked] = useState(() => !getApiAuthToken())
  const [authError, setAuthError] = useState("")
  const [startupLoadingDone, setStartupLoadingDone] = useState(
    () => SKIP_STARTUP_LOADING,
  )

  useEffect(() => {
    if (SKIP_STARTUP_LOADING) {
      return
    }

    const startupTimer = window.setTimeout(() => {
      setStartupLoadingDone(true)
    }, STARTUP_LOADING_DURATION_MS)

    return () => window.clearTimeout(startupTimer)
  }, [])

  useEffect(() => {
    if (!getApiAuthToken()) {
      return
    }

    getCurrentAccount()
      .then((result) => {
        setAccount(result.account)
      })
      .catch((error) => {
        clearApiAuthToken()
        setAuthError(errorMessage(error))
      })
      .finally(() => setAuthChecked(true))
  }, [])

  async function handleLogout() {
    try {
      await logout()
    } catch {
      clearApiAuthToken()
    } finally {
      setAccount(null)
    }
  }

  const loading = !startupLoadingDone || !authChecked

  if (loading) {
    return <LoadingScreen label="Initialisation de l'espace patient" />
  }

  if (!account) {
    return <AuthScreen initialError={authError} onAuthenticated={setAccount} />
  }

  return (
    <HashRouter>
      <AppShell account={account} onLogout={handleLogout} />
    </HashRouter>
  )
}

export default App
