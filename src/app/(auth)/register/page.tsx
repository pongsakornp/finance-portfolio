import { RegisterForm } from "@/components/features/register-form";
import { getEnabledOAuthProviders } from "@/lib/auth-providers";

export default function RegisterPage() {
  return <RegisterForm providers={getEnabledOAuthProviders()} />;
}
