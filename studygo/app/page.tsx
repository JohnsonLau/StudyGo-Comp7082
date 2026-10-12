import { Suspense } from "react";
import { LoginForm } from "./components/login-form";
import styles from "./login/login.module.css";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className={styles.loginLoading}>StudyGo</div>}>
      <LoginForm />
    </Suspense>
  );
}
