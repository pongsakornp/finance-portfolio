import { LoginForm } from "@/components/features/login-form";
import { getEnabledOAuthProviders } from "@/lib/auth-providers";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const hasOAuthError = Array.isArray(error) ? error.length > 0 : Boolean(error);

  return (
    <LoginForm
      providers={getEnabledOAuthProviders()}
      oauthError={
        hasOAuthError
          ? "Sign-in was not completed. If using LINE, grant email access and try again."
          : undefined
      }
    />
  );
}
