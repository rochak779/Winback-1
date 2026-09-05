import { Suspense } from 'react';
import SignInForm from './sign-in-form';

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
