import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, validateCredentials } from '@/auth';
import { Button, Field } from '@/ui/components';
import { space, useTheme } from '@/ui/theme';

export default function Login() {
  const t = useTheme();
  const router = useRouter();
  const { status, signIn, signUp, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const submit = async () => {
    setError(null);
    setInfo(null);
    const invalid = validateCredentials(email, password);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    try {
      const res = mode === 'signIn' ? await signIn(email, password) : await signUp(email, password);
      if (res.error) {
        setError(res.error);
      } else if (res.needsConfirmation) {
        setMode('signIn');
        setInfo('Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre.');
      } else {
        router.replace('/');
      }
    } finally {
      setBusy(false);
    }
  };

  const guest = async () => {
    await continueAsGuest();
    router.replace('/');
  };

  const isSignIn = mode === 'signIn';
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: space.xl * 2, maxWidth: 480, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: t.text, fontSize: 28, fontWeight: '700' }}>Flashcards</Text>
        <Text style={{ color: t.muted, marginTop: space.xs, marginBottom: space.lg }}>
          {isSignIn
            ? 'Entre para sincronizar seus decks entre dispositivos.'
            : 'Crie uma conta para guardar e sincronizar seus decks na nuvem.'}
        </Text>

        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          placeholder="voce@exemplo.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Field
          label="Senha"
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo de 6 caracteres"
          secureTextEntry
          autoCapitalize="none"
          autoComplete={isSignIn ? 'current-password' : 'new-password'}
          textContentType={isSignIn ? 'password' : 'newPassword'}
          onSubmitEditing={submit}
        />

        {error && (
          <Text accessibilityRole="alert" style={{ color: t.danger, marginBottom: space.md }}>
            {error}
          </Text>
        )}
        {info && <Text style={{ color: t.good, marginBottom: space.md }}>{info}</Text>}

        <Button label={busy ? 'Aguarde...' : isSignIn ? 'Entrar' : 'Criar conta'} onPress={submit} disabled={busy} />

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode(isSignIn ? 'signUp' : 'signIn');
            setError(null);
            setInfo(null);
          }}
          style={{ paddingVertical: space.md, alignItems: 'center' }}
        >
          <Text style={{ color: t.primary, fontWeight: '600' }}>
            {isSignIn ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar'}
          </Text>
        </Pressable>

        <View style={{ height: 1, backgroundColor: t.border, marginVertical: space.sm }} />

        {status === 'signedOut' ? (
          <Button variant="secondary" label="Continuar sem conta" onPress={guest} disabled={busy} style={{ marginTop: space.md }} />
        ) : (
          <Button variant="secondary" label="Voltar" onPress={leave} disabled={busy} style={{ marginTop: space.md }} />
        )}
        <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center', marginTop: space.sm }}>
          Sem conta, seus dados ficam apenas neste dispositivo.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
