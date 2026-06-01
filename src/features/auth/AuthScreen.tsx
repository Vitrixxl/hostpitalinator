import { useState } from "react"
import type { FormEvent } from "react"
import { ShieldCheck, Stethoscope, UserPlus, RefreshCw } from "lucide-react"

import { bootstrapAdmin, login } from "@/api"
import { errorMessage } from "@/app/error-utils"
import { AlertMessage } from "@/components/common/Feedback"
import { Field } from "@/components/common/Field"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Account } from "@/types"

export function AuthScreen({
  initialError,
  onAuthenticated,
}: {
  initialError: string
  onAuthenticated: (account: Account) => void
}) {
  const [mode, setMode] = useState<"login" | "bootstrap">("login")
  const [loginForm, setLoginForm] = useState({ email: "", password: "" })
  const [bootstrapForm, setBootstrapForm] = useState({
    name: "",
    email: "",
    service: "",
  })
  const [generatedPassword, setGeneratedPassword] = useState("")
  const [message, setMessage] = useState(initialError)
  const [busy, setBusy] = useState(false)

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage("")

    try {
      const session = await login(loginForm.email, loginForm.password)
      onAuthenticated(session.account)
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function handleBootstrap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage("")
    setGeneratedPassword("")

    try {
      const result = await bootstrapAdmin({
        name: bootstrapForm.name,
        email: bootstrapForm.email,
        service: bootstrapForm.service,
      })
      setGeneratedPassword(result.generatedPassword)
      setLoginForm({
        email: result.account.email,
        password: result.generatedPassword,
      })
      setMode("login")
      setMessage("Compte administrateur cree. Le mot de passe est pret.")
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-muted/30 text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
        <Card className="w-full rounded-3xl">
          <CardHeader>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Stethoscope className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Hospitalinator
                </p>
                <CardTitle>Connexion</CardTitle>
              </div>
            </div>
            <CardDescription>
              Identifiez-vous pour acceder aux dossiers patients.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === "login" ? "default" : "outline"}
                onClick={() => setMode("login")}
              >
                <ShieldCheck className="size-4" />
                Connexion
              </Button>
              <Button
                type="button"
                variant={mode === "bootstrap" ? "default" : "outline"}
                onClick={() => setMode("bootstrap")}
              >
                <UserPlus className="size-4" />
                Initialisation
              </Button>
            </div>

            {message && <AlertMessage message={message} />}
            {generatedPassword && (
              <AlertMessage
                tone="success"
                message={`Mot de passe initial: ${generatedPassword}`}
              />
            )}

            {mode === "login" ? (
              <form className="grid gap-4" onSubmit={handleLogin}>
                <Field label="Courriel" required>
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Mot de passe" required>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  Se connecter
                </Button>
              </form>
            ) : (
              <form className="grid gap-4" onSubmit={handleBootstrap}>
                <Field label="Nom" required>
                  <Input
                    required
                    value={bootstrapForm.name}
                    onChange={(event) =>
                      setBootstrapForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Courriel" required>
                  <Input
                    type="email"
                    required
                    value={bootstrapForm.email}
                    onChange={(event) =>
                      setBootstrapForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Service initial" required>
                  <Input
                    required
                    value={bootstrapForm.service}
                    onChange={(event) =>
                      setBootstrapForm((current) => ({
                        ...current,
                        service: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  Creer le premier administrateur
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
