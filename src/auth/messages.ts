/** Turns Supabase auth errors into clear Portuguese messages. */
export function authErrorMessage(error: { message?: string; code?: string; status?: number } | null | undefined): string {
  if (!error) return 'Erro desconhecido. Tente novamente.';
  const msg = (error.message ?? '').toLowerCase();
  const code = (error.code ?? '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed'))
    return 'Confirme seu e-mail antes de entrar: abra o link que enviamos para a sua caixa de entrada.';
  if (code === 'user_already_exists' || msg.includes('already registered')) return 'Este e-mail já está cadastrado. Tente entrar.';
  if (code === 'weak_password' || msg.includes('password should be')) return 'Senha fraca: use pelo menos 6 caracteres.';
  if (code === 'validation_failed' || msg.includes('valid email') || msg.includes('invalid email')) return 'Digite um e-mail válido.';
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || error.status === 429 || msg.includes('rate limit'))
    return 'Muitas tentativas. Aguarde um instante e tente novamente.';
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to'))
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  return 'Não foi possível concluir. Tente novamente.';
}

/** Client-side validation. Returns an error message, or null when valid. */
export function validateCredentials(email: string, password: string): string | null {
  const e = email.trim();
  if (!e) return 'Digite seu e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Digite um e-mail válido.';
  if (!password) return 'Digite sua senha.';
  if (password.length < 6) return 'A senha deve ter pelo menos 6 caracteres.';
  return null;
}
