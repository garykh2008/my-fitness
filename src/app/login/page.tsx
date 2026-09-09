import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="auth-wrap">
      <div className="auth-box">
        <h1>訓練紀錄</h1>
        <p className="sub">照表操課，把每一組都留下來。</p>
        <LoginForm next={next && next.startsWith("/") ? next : "/"} />
      </div>
    </main>
  );
}
