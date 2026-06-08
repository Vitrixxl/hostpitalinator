import { useState } from "react";
import { useForm } from "react-hook-form";
import { ShieldCheck, UserPlus, RefreshCw } from "lucide-react";

import { bootstrapAdmin, login } from "@/api";
import { errorMessage } from "@/app/error-utils";
import {
  validateRequired,
  validateRequiredEmail,
} from "@/app/form-validation";
import { AlertMessage } from "@/components/common/Feedback";
import { Field } from "@/components/common/Field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Account } from "@/types";

type LoginFormValues = {
  email: string;
  password: string;
};

type BootstrapFormValues = {
  name: string;
  email: string;
  service: string;
};

export function AuthScreen({
  initialError,
  onAuthenticated,
}: {
  initialError: string;
  onAuthenticated: (account: Account) => void;
}) {
  const [mode, setMode] = useState<"login" | "bootstrap">("login");
  const loginForm = useForm<LoginFormValues>({
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const bootstrapForm = useForm<BootstrapFormValues>({
    defaultValues: { name: "", email: "", service: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [message, setMessage] = useState(initialError);
  const [busy, setBusy] = useState(false);

  async function handleLogin(values: LoginFormValues) {
    setBusy(true);
    setMessage("");

    try {
      const session = await login(values.email, values.password);
      onAuthenticated(session.account);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleBootstrap(values: BootstrapFormValues) {
    setBusy(true);
    setMessage("");
    setGeneratedPassword("");

    try {
      const result = await bootstrapAdmin({
        name: values.name,
        email: values.email,
        service: values.service,
      });
      setGeneratedPassword(result.generatedPassword);
      loginForm.setValue("email", result.account.email);
      loginForm.setValue("password", result.generatedPassword);
      setMode("login");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/30 text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
        <Card className="w-full rounded-3xl">
          <CardHeader>
            <div className="mb-2 flex items-center gap-3">
              <div
                className="flex size-10 items-center justify-center rounded-lg border bg-card text-foreground"
              >
                <span className="text-xs font-semibold">
                  CH
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  CH de Versailles
                </p>
                <CardTitle>Connexion</CardTitle>
              </div>
            </div>
            <CardDescription>
              Identifiez-vous pour accéder aux dossiers patients.
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
              <form
                className="grid gap-4"
                noValidate
                onSubmit={loginForm.handleSubmit(handleLogin)}
              >
                <Field
                  label="Courriel"
                  required
                  error={loginForm.formState.errors.email?.message}
                >
                  <Input
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    aria-invalid={!!loginForm.formState.errors.email}
                    {...loginForm.register("email", {
                      validate: validateRequiredEmail,
                    })}
                  />
                </Field>
                <Field
                  label="Mot de passe"
                  required
                  error={loginForm.formState.errors.password?.message}
                >
                  <Input
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={!!loginForm.formState.errors.password}
                    {...loginForm.register("password", {
                      validate: validateRequired,
                    })}
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
              <form
                className="grid gap-4"
                noValidate
                onSubmit={bootstrapForm.handleSubmit(handleBootstrap)}
              >
                <Field
                  label="Nom"
                  required
                  error={bootstrapForm.formState.errors.name?.message}
                >
                  <Input
                    aria-invalid={!!bootstrapForm.formState.errors.name}
                    {...bootstrapForm.register("name", {
                      validate: validateRequired,
                    })}
                  />
                </Field>
                <Field
                  label="Courriel"
                  required
                  error={bootstrapForm.formState.errors.email?.message}
                >
                  <Input
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    aria-invalid={!!bootstrapForm.formState.errors.email}
                    {...bootstrapForm.register("email", {
                      validate: validateRequiredEmail,
                    })}
                  />
                </Field>
                <Field
                  label="Service initial"
                  required
                  error={bootstrapForm.formState.errors.service?.message}
                >
                  <Input
                    aria-invalid={!!bootstrapForm.formState.errors.service}
                    {...bootstrapForm.register("service", {
                      validate: validateRequired,
                    })}
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                  Créer le premier administrateur
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
