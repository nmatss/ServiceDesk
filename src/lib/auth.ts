import { StackServerApp } from "@stackframe/stack";

// Configuração do Stack Auth com fallbacks para build
const stackConfig = {
  tokenStore: "nextjs-cookie" as const,
  urls: {
    signIn: "/auth/sign-in",
    signUp: "/auth/sign-up",
    emailVerification: "/auth/email-verification",
    passwordReset: "/auth/password-reset",
    home: "/dashboard",
    afterSignIn: "/dashboard",
    afterSignUp: "/auth/setup-profile",
  },
};

// Criar instância apenas se as variáveis de ambiente estiverem configuradas
export const stackServerApp = process.env.NEXT_PUBLIC_STACK_PROJECT_ID && process.env.STACK_SECRET_SERVER_KEY
  ? new StackServerApp(stackConfig)
  : null;
