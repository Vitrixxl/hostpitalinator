import { useEffect, useState } from "react"
import { HashRouter } from "react-router"

import { getCurrentAccount, logout } from "@/api"
import { clearApiAuthToken, getApiAuthToken } from "@/api/client"
import { errorMessage } from "@/app/error-utils"
import { LoadingScreen } from "@/components/common/LoadingScreen"
import { AuthScreen } from "@/features/auth/AuthScreen"
import { AppShell } from "@/layouts/AppShell"
import type { Account } from "@/types"

function App() {
  const [account, setAccount] = useState<Account | null>(null)
  const [authChecked, setAuthChecked] = useState(() => !getApiAuthToken())
  const [authError, setAuthError] = useState("")

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

  if (!authChecked) {
    return <LoadingScreen label="Ouverture du dossier hospitalier" />
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
